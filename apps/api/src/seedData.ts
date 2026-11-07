import {
  DOMAIN_KEYS,
  type CheckInStatus,
  type DomainKey,
  type Domains,
  type Severity,
} from "@careos/shared";
import { scoreAgainstHistory, type HistoryRow } from "./services/baseline";
import { extractDomainsFromKeywords } from "./services/extractDomains";
import { buildAiSummary } from "./services/processCheckIn";
import { HERO_DURATION_SEC, HERO_PATIENT_NAME, HERO_TRANSCRIPT } from "./services/transcripts";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const MINUTE_MS = 60 * 1000;

// ---------------------------------------------------------------------------
// Deterministic randomness
// ---------------------------------------------------------------------------

/** mulberry32: small, seedable, and stable across Node versions. */
export function createRandom(seedValue: number) {
  let state = seedValue >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)] as T,
    /** A v4-shaped uuid, so ids are stable across demo resets. */
    uuid: () => {
      const hex = Array.from({ length: 32 }, () => Math.floor(next() * 16).toString(16));
      hex[12] = "4";
      hex[16] = ((Math.floor(next() * 4) + 8) as number).toString(16);
      const s = hex.join("");
      return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
    },
  };
}

type Random = ReturnType<typeof createRandom>;

// ---------------------------------------------------------------------------
// Spoken phrases. Each one is written so the real keyword rules read it back at
// exactly the severity it is listed under, which seed.test.ts verifies.
// ---------------------------------------------------------------------------

type Phrases = Partial<Record<Severity, readonly string[]>>;

const PHRASES: Record<DomainKey, Phrases> = {
  appetite: {
    1: ["{S} ate a little less than usual at lunch.", "Breakfast went okay but {s} left some of it."],
    2: ["{S} only managed half portions at dinner again.", "{S} skipped lunch and picked at the rest."],
  },
  sleep: {
    1: ["{S} was a bit restless at bedtime.", "{S} napped more than usual this afternoon."],
    2: ["{S} woke up three times last night.", "It was another restless night for {o}."],
    3: ["{S} was up most of the night again."],
  },
  mobility: {
    1: ["{S} was slower getting to the bathroom today.", "{S} seems slower on {p} feet this week."],
    2: ["{S} seemed unsteady in the hallway."],
  },
  cognition: {
    1: ["{S} forgot where {s} put {p} glasses.", "{S} mixed up the days of the week."],
    2: ["{S} got confused about what day it was.", "{S} was confused about who visited earlier."],
  },
  mood: {
    1: ["{S} seemed a bit down this afternoon.", "{S} has been a little quiet today."],
    2: ["{S} was tearful for part of the evening."],
  },
  pain: {
    1: ["{P} knees are sore today.", "{S} says {p} back is aching a bit."],
    2: ["{S} was in a lot of pain this morning."],
  },
  medications: {
    2: ["{S} missed {p} pills this morning."],
  },
  caregiverStrain: {
    1: ["I'm feeling a bit tired myself.", "I'm tired but managing."],
    2: ["I'm honestly exhausted these days.", "I'm worn out by the evenings."],
  },
};

const FILLERS = [
  "We watched the hockey game together.",
  "We sat out on the porch for a while.",
  "{S} enjoyed a phone call with the grandkids.",
  "A neighbour dropped by to say hello.",
  "We did the crossword together after supper.",
  "It was a fairly ordinary day here.",
];

interface Pronouns {
  S: string;
  s: string;
  o: string;
  p: string;
}
const HE: Pronouns = { S: "He", s: "he", o: "him", p: "his" };
const SHE: Pronouns = { S: "She", s: "she", o: "her", p: "her" };

function fill(template: string, pronouns: Pronouns): string {
  const capitalized = pronouns.p.charAt(0).toUpperCase() + pronouns.p.slice(1);
  return template
    .replaceAll("{S}", pronouns.S)
    .replaceAll("{s}", pronouns.s)
    .replaceAll("{o}", pronouns.o)
    .replaceAll("{P}", capitalized)
    .replaceAll("{p}", pronouns.p);
}

/** Every phrase with its intended severity, for the seed tests. */
export function allPhrases(): { domain: DomainKey; severity: Severity; text: string }[] {
  return DOMAIN_KEYS.flatMap((domain) =>
    ([1, 2, 3] as const).flatMap((severity) =>
      (PHRASES[domain][severity] ?? []).flatMap((template) =>
        [HE, SHE].map((pronouns) => ({ domain, severity, text: fill(template, pronouns) })),
      ),
    ),
  );
}

export function allFillers(): string[] {
  return FILLERS.flatMap((template) => [HE, SHE].map((pronouns) => fill(template, pronouns)));
}

// ---------------------------------------------------------------------------
// The patients
// ---------------------------------------------------------------------------

type Plan = Partial<Record<DomainKey, Severity>>;

interface PatientSpec {
  name: string;
  age: number;
  conditions: string[];
  initials: string;
  pronouns: Pronouns;
  caregiver: { name: string; relationship: string };
  historyDays: number;
  /** Days that must have a check-in, so durations like "3 wks" come out exact. */
  anchorDays?: number[];
  plan: (ageDays: number, index: number, random: Random) => Plan;
  latest: { ageMs: number; transcript: string; durationSec: number; status: CheckInStatus };
  /** Score and tier the real rules must produce for the latest check-in. */
  expected: { score: number; flags: string[] };
}

/** True on about every `n`th check-in, for symptoms that come and go. */
const every = (index: number, n: number) => index % n === 0;

export const PATIENTS: readonly PatientSpec[] = [
  {
    name: HERO_PATIENT_NAME,
    age: 82,
    conditions: ["Early dementia", "Hypertension"],
    initials: "WM",
    pronouns: HE,
    caregiver: { name: "Sarah Morrison", relationship: "Daughter" },
    historyDays: 40,
    anchorDays: [2, 21],
    // Appetite and cognition drift from 0 to 2 in small steps over the last 21 days.
    plan: (age, index) => ({
      appetite: age > 21 ? 0 : age > 10 ? 1 : 2,
      cognition: age > 16 ? 0 : age > 5 ? 1 : 2,
      caregiverStrain: age <= 14 && every(index, 3) ? 1 : 0,
      mood: age <= 14 && every(index, 4) ? 1 : 0,
    }),
    latest: {
      ageMs: 12 * MINUTE_MS,
      transcript: HERO_TRANSCRIPT,
      durationSec: HERO_DURATION_SEC,
      status: "received",
    },
    expected: { score: 83, flags: ["New confusion", "Appetite ↓ 3 wks"] },
  },
  {
    name: "Margaret Okafor",
    age: 88,
    conditions: ["Osteoporosis", "CHF"],
    initials: "MO",
    pronouns: SHE,
    caregiver: { name: "David Okafor", relationship: "Son" },
    historyDays: 35,
    plan: () => ({ sleep: 1, mood: 1 }),
    latest: {
      ageMs: 2 * HOUR_MS,
      transcript:
        "Mom fell in the bathroom this morning when she got up. She says her hip is sore but she can still walk with help. She was a bit restless at bedtime and she seemed a bit down after it all.",
      durationSec: 41,
      status: "received",
    },
    expected: { score: 74, flags: ["Fall reported", "Mobility ↓"] },
  },
  {
    name: "Henri Tremblay",
    age: 79,
    conditions: ["Parkinson's disease"],
    initials: "HT",
    pronouns: HE,
    caregiver: { name: "Louise Tremblay", relationship: "Spouse" },
    historyDays: 42,
    anchorDays: [10],
    plan: (age, index) => ({
      sleep: age > 10 ? 0 : 2,
      caregiverStrain: age > 10 ? 0 : 1,
      mobility: every(index, 3) ? 1 : 0,
      mood: every(index, 4) ? 1 : 0,
    }),
    latest: {
      ageMs: 5 * HOUR_MS,
      transcript:
        "Henri was up most of the night again, that's ten nights of poor sleep now. He was slower getting to the bathroom today. He seemed a bit down this afternoon. I'm honestly exhausted these days.",
      durationSec: 37,
      status: "reviewed",
    },
    expected: { score: 58, flags: ["Sleep ↓ 10 days", "Caregiver strain"] },
  },
  {
    name: "Grace Li",
    age: 84,
    conditions: ["Type 2 diabetes"],
    initials: "GL",
    pronouns: SHE,
    caregiver: { name: "Kevin Li", relationship: "Son" },
    historyDays: 30,
    plan: (_age, index) => ({
      sleep: 1,
      caregiverStrain: 1,
      appetite: every(index, 3) ? 1 : 0,
      mood: every(index, 3) ? 1 : 0,
    }),
    latest: {
      ageMs: 26 * HOUR_MS,
      transcript:
        "Mom missed her pills twice this week because her routine got disrupted. She ate a little less than usual at lunch. She was a bit restless at bedtime. She seemed a bit down this afternoon. I'm feeling a bit tired myself.",
      durationSec: 39,
      status: "guidance_sent",
    },
    expected: { score: 48, flags: ["Missed meds ×2"] },
  },
  {
    name: "Anand Mehta",
    age: 77,
    conditions: ["COPD"],
    initials: "AM",
    pronouns: HE,
    caregiver: { name: "Ritu Mehta", relationship: "Daughter" },
    historyDays: 36,
    plan: (_age, index) => ({
      pain: 1,
      caregiverStrain: 1,
      sleep: every(index, 3) ? 1 : 0,
      mood: every(index, 3) ? 1 : 0,
    }),
    latest: {
      ageMs: 28 * HOUR_MS,
      transcript:
        "Dad gets breathless on the stairs now and has to stop halfway. His knees are sore today. He was a bit restless at bedtime. He seemed a bit down this afternoon. I'm feeling a bit tired myself.",
      durationSec: 33,
      status: "received",
    },
    expected: { score: 42, flags: ["Breathless on stairs"] },
  },
  {
    name: "Dorothy Campbell",
    age: 91,
    conditions: ["Mild cognitive impairment"],
    initials: "DC",
    pronouns: SHE,
    caregiver: { name: "Ellen Campbell", relationship: "Daughter-in-law" },
    historyDays: 38,
    plan: (_age, index) => ({
      sleep: 1,
      appetite: 1,
      mood: 1,
      cognition: every(index, 4) ? 1 : 0,
    }),
    latest: {
      ageMs: 30 * HOUR_MS,
      transcript:
        "Dorothy forgot where she put her glasses again. She ate a little less than usual at lunch. She was a bit restless at bedtime. She seemed a bit down this afternoon.",
      durationSec: 28,
      status: "reviewed",
    },
    expected: { score: 28, flags: [] },
  },
  {
    name: "Frank Russo",
    age: 80,
    conditions: ["Osteoarthritis"],
    initials: "FR",
    pronouns: HE,
    caregiver: { name: "Maria Russo", relationship: "Spouse" },
    historyDays: 33,
    plan: (_age, index) => ({
      pain: every(index, 3) ? 1 : 0,
      mobility: every(index, 4) ? 1 : 0,
    }),
    latest: {
      ageMs: 2 * DAY_MS,
      transcript:
        "Frank's knees are sore today, it's the damp weather. He was slower getting to the bathroom today. Otherwise we had a fairly ordinary day.",
      durationSec: 24,
      status: "reviewed",
    },
    expected: { score: 20, flags: [] },
  },
  {
    name: "Rose Fontaine",
    age: 86,
    conditions: ["Hypertension"],
    initials: "RF",
    pronouns: SHE,
    caregiver: { name: "Julie Fontaine", relationship: "Granddaughter" },
    historyDays: 31,
    plan: () => ({ sleep: 1, mood: 1 }),
    latest: {
      ageMs: 3 * DAY_MS,
      transcript:
        "Grandma was a bit restless at bedtime. She has been a little quiet today. We sat out on the porch for a while and she enjoyed that.",
      durationSec: 22,
      status: "guidance_sent",
    },
    expected: { score: 12, flags: [] },
  },
];

export const WALTER_GUIDANCE =
  "Thanks Sarah. Half portions a few days in a row is worth watching. Try smaller meals more often, and keep a glass of water within reach. Let's keep tracking it here.";

// ---------------------------------------------------------------------------
// Building the rows
// ---------------------------------------------------------------------------

/** Next Monday at 10:00 AM local time, never today. */
export function nextMondayAtTen(now: Date): Date {
  const result = new Date(now);
  result.setHours(10, 0, 0, 0);
  const daysAhead = (8 - result.getDay()) % 7 || 7;
  result.setDate(result.getDate() + daysAhead);
  return result;
}

function composeTranscript(plan: Plan, pronouns: Pronouns, random: Random): string {
  const sentences = DOMAIN_KEYS.flatMap((key) => {
    const severity = plan[key] ?? 0;
    const options = severity > 0 ? PHRASES[key][severity] : undefined;
    return options ? [fill(random.pick(options), pronouns)] : [];
  });
  while (sentences.length < 2) {
    const filler = fill(random.pick(FILLERS), pronouns);
    if (!sentences.includes(filler)) sentences.push(filler);
  }
  return sentences.join(" ");
}

function historyAges(spec: PatientSpec, random: Random): number[] {
  // A check-in every 1-3 days, back from the latest, plus any required days.
  const firstAge = Math.max(2, Math.ceil(spec.latest.ageMs / DAY_MS) + 1);
  const ages = new Set<number>(spec.anchorDays ?? []);
  for (let age = firstAge; age <= spec.historyDays; age += random.int(1, 3)) ages.add(age);
  return [...ages].sort((a, b) => b - a);
}

export interface SeedCheckIn {
  id: string;
  patientId: string;
  caregiverId: string;
  durationSec: number;
  transcript: string;
  aiSummary: string;
  domains: Domains;
  riskScore: number;
  riskTier: "urgent" | "watch" | "stable";
  flags: string[];
  isEmergency: boolean;
  status: CheckInStatus;
  source: "voice";
  createdAt: Date;
}

export interface SeedAction {
  id: string;
  patientId: string;
  checkInId: string | null;
  nurseId: string;
  type: "guidance" | "reviewed" | "call_scheduled" | "call_note";
  body: string;
  scheduledFor: Date | null;
  source: string | null;
  createdAt: Date;
}

export interface SeedPatientPlan {
  spec: PatientSpec;
  id: string;
  caregiverId: string;
  /** Oldest first. The last one is the check-in in the queue. */
  checkIns: SeedCheckIn[];
}

export interface SeedPlan {
  now: Date;
  careHome: { id: string; name: string };
  nurse: { id: string; careHomeId: string; name: string; credentials: string };
  patients: SeedPatientPlan[];
  actions: SeedAction[];
}

const ROUTINE_GUIDANCE = [
  "Thanks for the update. This looks steady compared with recent weeks. Keep doing what you're doing.",
  "Thanks for letting me know. Nothing here worries me today, and I'll keep an eye on the trend.",
  "That's helpful, thank you. Please tell me if anything changes over the next few days.",
];

// Response times are spread around the 3-4 hour mark the queue's stat card expects.
const RESPONSE_HOURS = [1.5, 2.5, 3, 3.5, 4, 4.5];

/** Everything seed() inserts, built without touching the database. */
export function buildSeedPlan(now: Date): SeedPlan {
  const random = createRandom(20261107);
  const careHome = { id: random.uuid(), name: "Maple Grove Care Home" };
  const nurse = { id: random.uuid(), careHomeId: careHome.id, name: "Priya Sharma", credentials: "RN" };
  const actions: SeedAction[] = [];

  const respond = (checkIn: SeedCheckIn, type: "guidance" | "reviewed", body: string, hours: number) => {
    actions.push({
      id: random.uuid(),
      patientId: checkIn.patientId,
      checkInId: checkIn.id,
      nurseId: nurse.id,
      type,
      body,
      scheduledFor: null,
      source: null,
      createdAt: new Date(checkIn.createdAt.getTime() + hours * HOUR_MS),
    });
  };

  const patients = PATIENTS.map((spec, patientIndex) => {
    const id = random.uuid();
    const caregiverId = random.uuid();
    const history: HistoryRow[] = [];
    const checkIns: SeedCheckIn[] = [];

    const addCheckIn = (transcript: string, createdAt: Date, durationSec: number, status: CheckInStatus) => {
      const domains = extractDomainsFromKeywords(transcript);
      const result = scoreAgainstHistory({ transcript, domains, history, at: createdAt });
      const row: SeedCheckIn = {
        id: random.uuid(),
        patientId: id,
        caregiverId,
        durationSec,
        transcript,
        aiSummary: buildAiSummary(domains, result.flags),
        domains,
        riskScore: result.score,
        riskTier: result.tier,
        flags: result.flags,
        isEmergency: result.isEmergency,
        status,
        source: "voice",
        createdAt,
      };
      checkIns.push(row);
      history.push({ createdAt, domains });
      return row;
    };

    historyAges(spec, random).forEach((age, index) => {
      const plan = spec.plan(age, index, random);
      const transcript = composeTranscript(plan, spec.pronouns, random);
      // Morning to early afternoon, a little before the exact day boundary.
      const createdAt = new Date(now.getTime() - age * DAY_MS - random.int(0, 180) * MINUTE_MS);
      const row = addCheckIn(transcript, createdAt, random.int(20, 60), "reviewed");

      const hours = RESPONSE_HOURS[index % RESPONSE_HOURS.length] as number;
      if (index % 3 === 0) {
        row.status = "guidance_sent";
        respond(row, "guidance", random.pick(ROUTINE_GUIDANCE), hours);
      } else {
        respond(row, "reviewed", "Check-in reviewed.", hours);
      }
    });

    const { latest } = spec;
    addCheckIn(latest.transcript, new Date(now.getTime() - latest.ageMs), latest.durationSec, latest.status);

    return { spec, id, caregiverId, checkIns, patientIndex };
  });

  // Walter: the guidance two days ago, replacing whatever routine reply that check-in had.
  const walter = patients[0];
  if (walter) {
    const twoDaysAgo = walter.checkIns.find(
      (row) => Math.round((now.getTime() - row.createdAt.getTime()) / DAY_MS) === 2,
    );
    if (twoDaysAgo) {
      for (let i = actions.length - 1; i >= 0; i--) {
        if (actions[i]?.checkInId === twoDaysAgo.id) actions.splice(i, 1);
      }
      twoDaysAgo.status = "guidance_sent";
      actions.push({
        id: random.uuid(),
        patientId: walter.id,
        checkInId: twoDaysAgo.id,
        nurseId: nurse.id,
        type: "guidance",
        body: WALTER_GUIDANCE,
        scheduledFor: null,
        source: null,
        createdAt: new Date(now.getTime() - 2 * DAY_MS),
      });
    }
    actions.push({
      id: random.uuid(),
      patientId: walter.id,
      checkInId: null,
      nurseId: nurse.id,
      type: "call_scheduled",
      body: "Check in on appetite and memory changes with Sarah.",
      scheduledFor: nextMondayAtTen(now),
      source: null,
      createdAt: new Date(now.getTime() - 2 * DAY_MS),
    });
  }

  // The latest check-ins that a nurse has already handled.
  for (const patient of patients) {
    const latest = patient.checkIns.at(-1);
    if (!latest) continue;
    if (latest.status === "reviewed") {
      respond(latest, "reviewed", "Check-in reviewed.", 2.5);
    } else if (latest.status === "guidance_sent") {
      respond(latest, "guidance", random.pick(ROUTINE_GUIDANCE), 3.5);
    }
  }

  // Margaret and Anand each have an older check-in nobody has got to yet.
  for (const name of ["Margaret Okafor", "Anand Mehta"]) {
    const patient = patients.find((p) => p.spec.name === name);
    const previous = patient?.checkIns.at(-2);
    if (!previous) continue;
    previous.status = "received";
    for (let i = actions.length - 1; i >= 0; i--) {
      if (actions[i]?.checkInId === previous.id) actions.splice(i, 1);
    }
  }

  return {
    now,
    careHome,
    nurse,
    patients: patients.map(({ spec, id, caregiverId, checkIns }) => ({ spec, id, caregiverId, checkIns })),
    actions,
  };
}
