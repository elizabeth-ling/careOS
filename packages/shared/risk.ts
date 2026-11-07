import {
  DOMAIN_KEYS,
  DOMAIN_NAMES,
  type Baselines,
  type DomainKey,
  type Domains,
  type RiskTier,
} from "./schemas";

export const EMERGENCY_TERMS = [
  "chest pain",
  "can't breathe",
  "not breathing",
  "unconscious",
  "stroke",
  "can't get up",
  "bleeding heavily",
] as const;

export const RED_FLAG_POINTS = {
  newConfusion: 25,
  fall: 30,
  notEating: 20,
  emergency: 60,
} as const;

export type RedFlagKey = keyof typeof RED_FLAG_POINTS;

export interface RedFlag {
  key: RedFlagKey;
  label: string;
  points: number;
}

export function tierFor(score: number): RiskTier {
  if (score >= 70) return "urgent";
  if (score >= 40) return "watch";
  return "stable";
}

/** Lowercases and straightens typographic apostrophes, so spoken-text variants still match. */
export function normalizeTranscript(transcript: string): string {
  return transcript
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/\bcan ?not\b/g, "can't");
}

/**
 * Deliberately has no negation handling: "no chest pain" still matches. The 911
 * banner must always show for these terms, and a false alarm costs less than a miss.
 */
export function findEmergencyTerms(transcript: string): string[] {
  const text = normalizeTranscript(transcript);
  return EMERGENCY_TERMS.filter((term) => new RegExp(`\\b${term}\\b`).test(text));
}

const FIRST_TIME_CUE = /never (done|said|did|happened)|never before|first time|out of nowhere|didn't recogni[sz]e/;
const FALL_WORD = /\b(fell|falls?|fallen)\b/;
const NEGATED_FALL = /\b(no|not|never|without|didn't|hasn't|haven't|hadn't)\b[^.?!]*\b(fell|falls?|fallen)\b/;
const NOT_EATING =
  /\b(not|hasn't|hardly|barely|stopped|refus\w+)\s+(been\s+|to\s+)?(eating|eaten|eat|ate)\b[^.?!]*\b(two|2|three|3|four|4|couple|few|several)\b[^.?!]*\bdays?\b/;

function sentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/);
}

export function redFlags(transcript: string, domains: Domains): RedFlag[] {
  const text = normalizeTranscript(transcript);
  const flags: RedFlag[] = [];

  if (domains.cognition.severity === 3 && FIRST_TIME_CUE.test(text)) {
    flags.push({ key: "newConfusion", label: "New confusion", points: RED_FLAG_POINTS.newConfusion });
  }
  if (sentences(text).some((s) => FALL_WORD.test(s) && !NEGATED_FALL.test(s))) {
    flags.push({ key: "fall", label: "Fall reported", points: RED_FLAG_POINTS.fall });
  }
  if (NOT_EATING.test(text)) {
    flags.push({ key: "notEating", label: "Not eating 2+ days", points: RED_FLAG_POINTS.notEating });
  }
  if (findEmergencyTerms(transcript).length > 0) {
    flags.push({ key: "emergency", label: "Emergency terms", points: RED_FLAG_POINTS.emergency });
  }
  return flags;
}

const COUNT_WORDS: Record<string, number> = { once: 1, twice: 2, two: 2, three: 3, four: 4 };

/** Things worth showing a nurse that carry no points of their own. */
export function observations(transcript: string): string[] {
  const text = normalizeTranscript(transcript);
  const found: string[] = [];

  const missed = text.match(
    /\b(?:missed|skipped)\b[^.?!]*\b(?:pills?|medications?|meds|insulin|doses?)\b[^.?!]*\b(once|twice|two|three|four)\b/,
  );
  if (missed?.[1]) found.push(`Missed meds ×${COUNT_WORDS[missed[1]]}`);

  if (/\b(breathless|short of breath|out of breath)\b[^.?!]*\bstairs\b/.test(text)) {
    found.push("Breathless on stairs");
  }
  return found;
}

function formatDuration(days: number): string {
  if (days >= 14) return ` ${Math.round(days / 7)} wks`;
  if (days >= 2) return ` ${days} days`;
  return "";
}

export interface ScoreInput {
  redFlags: RedFlag[];
  domains: Domains;
  baselines: Baselines;
  /** How long each domain has been continuously affected, used to label flags. */
  declineDays?: Partial<Record<DomainKey, number>>;
  observations?: string[];
}

export interface ScoreResult {
  score: number;
  tier: RiskTier;
  flags: string[];
  isEmergency: boolean;
}

/** A domain must reach this severity, and be above baseline, to earn its own flag. */
const FLAG_SEVERITY = 2;

export function scoreCheckIn(input: ScoreInput): ScoreResult {
  const { domains, baselines, declineDays = {}, observations: observed = [] } = input;

  const redFlagPoints = input.redFlags.reduce((sum, flag) => sum + flag.points, 0);
  const severitySum = DOMAIN_KEYS.reduce((sum, key) => sum + domains[key].severity, 0);
  const aboveBaseline = DOMAIN_KEYS.filter((key) => domains[key].severity > baselines[key]);

  const score = Math.min(100, redFlagPoints + severitySum * 6 + aboveBaseline.length * 4);

  // Skip domain flags that would only repeat a more specific flag.
  const hasConfusion = input.redFlags.some((flag) => flag.key === "newConfusion");
  const hasMissedMeds = observed.some((text) => text.startsWith("Missed meds"));
  const covered = (key: DomainKey) =>
    (key === "cognition" && hasConfusion) ||
    (key === "medications" && hasMissedMeds) ||
    key === "caregiverStrain";

  const driftFlags = aboveBaseline
    .filter((key) => domains[key].severity >= FLAG_SEVERITY && !covered(key))
    .map((key) => `${DOMAIN_NAMES[key]} ↓${formatDuration(declineDays[key] ?? 0)}`);

  const strainFlags = domains.caregiverStrain.severity >= FLAG_SEVERITY ? ["Caregiver strain"] : [];

  return {
    score,
    tier: tierFor(score),
    flags: [...input.redFlags.map((flag) => flag.label), ...driftFlags, ...strainFlags, ...observed],
    isEmergency: input.redFlags.some((flag) => flag.key === "emergency"),
  };
}
