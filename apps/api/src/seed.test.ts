import {
  DOMAIN_KEYS,
  domainsSchema,
  quotesMatchTranscript,
  tierFor,
} from "@careos/shared";
import { describe, expect, it } from "vitest";
import { allFillers, allPhrases, buildSeedPlan, nextMondayAtTen, PATIENTS, WALTER_GUIDANCE } from "./seedData";
import { insightsFromHistory, scoreAgainstHistory, type HistoryRow } from "./services/baseline";
import { extractDomainsFromKeywords } from "./services/extractDomains";
import { EMERGENCY_TRANSCRIPT, HERO_TRANSCRIPT } from "./services/transcripts";

const NOW = new Date("2026-11-07T18:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;
const plan = buildSeedPlan(NOW);
const allCheckIns = plan.patients.flatMap((patient) => patient.checkIns);

describe("seed plan", () => {
  it("is deterministic for a given time", () => {
    const again = buildSeedPlan(NOW);
    expect(again.patients.map((p) => p.checkIns)).toEqual(plan.patients.map((p) => p.checkIns));
    expect(again.actions).toEqual(plan.actions);
  });

  it("keeps timestamps relative to seed time", () => {
    const later = new Date(NOW.getTime() + 5 * DAY_MS);
    const offset = (now: Date) =>
      buildSeedPlan(now).patients[0]?.checkIns.map((row) => now.getTime() - row.createdAt.getTime());
    expect(offset(later)).toEqual(offset(NOW));
  });

  it("has only valid v4-shaped ids", () => {
    for (const row of allCheckIns) expect(row.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("gives every patient 4-6 weeks of check-ins, 1-3 days apart", () => {
    for (const { spec, checkIns } of plan.patients) {
      const first = checkIns[0]?.createdAt.getTime() ?? 0;
      const weeks = (NOW.getTime() - first) / (7 * DAY_MS);
      expect(weeks, spec.name).toBeGreaterThanOrEqual(4);
      expect(weeks, spec.name).toBeLessThanOrEqual(6.2);

      const past = checkIns.slice(0, -1);
      for (let i = 1; i < past.length; i++) {
        const gap = ((past[i]?.createdAt.getTime() ?? 0) - (past[i - 1]?.createdAt.getTime() ?? 0)) / DAY_MS;
        expect(gap, spec.name).toBeGreaterThan(0.8);
        expect(gap, spec.name).toBeLessThan(3.2);
      }
    }
  });

  it("writes transcripts of 2-5 spoken sentences", () => {
    for (const row of allCheckIns) {
      const count = row.transcript.split(/(?<=[.!?])\s+/).length;
      expect(count, row.transcript).toBeGreaterThanOrEqual(2);
      expect(count, row.transcript).toBeLessThanOrEqual(5);
    }
  });

  it("stores only quotes that are exact substrings of their transcript", () => {
    for (const row of allCheckIns) {
      expect(quotesMatchTranscript(row.transcript, row.domains), row.transcript).toBe(true);
      for (const key of DOMAIN_KEYS) {
        const { quote, severity } = row.domains[key];
        if (severity > 0) expect(quote, `${key}: ${row.transcript}`).not.toBeNull();
      }
    }
  });

  it("stores the domains the real extractor reads from each transcript", () => {
    for (const row of allCheckIns) {
      expect(row.domains).toEqual(extractDomainsFromKeywords(row.transcript));
      expect(() => domainsSchema.parse(row.domains)).not.toThrow();
    }
  });

  it("stores the score the real rules give each check-in at the time it was made", () => {
    for (const { checkIns } of plan.patients) {
      checkIns.forEach((row, index) => {
        const history = checkIns.slice(0, index);
        const result = scoreAgainstHistory({
          transcript: row.transcript,
          domains: row.domains,
          history,
          at: row.createdAt,
        });
        expect(row.riskScore).toBe(result.score);
        expect(row.riskTier).toBe(tierFor(result.score));
        expect(row.flags).toEqual(result.flags);
      });
    }
  });

  // Spec table: 82, 74, 58, 47, 41, 28, 19, 12. 82, 47, 41 and 19 can't be produced
  // by the spec's formula, so those four use the next achievable score up. See README.
  it.each(PATIENTS.map((spec) => [spec.name, spec] as const))("gives %s the planned latest score and flags", (name, spec) => {
    const latest = plan.patients.find((p) => p.spec.name === name)?.checkIns.at(-1);
    expect(latest?.riskScore).toBe(spec.expected.score);
    expect(latest?.flags).toEqual(spec.expected.flags);
    expect(latest?.status).toBe(spec.latest.status);
  });

  it("ranks the patients in the spec's order with the spec's tiers", () => {
    const latest = plan.patients.map((p) => p.checkIns.at(-1));
    const scores = latest.map((row) => row?.riskScore ?? 0);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    expect(new Set(scores).size).toBe(scores.length);
    expect(latest.map((row) => row?.riskTier)).toEqual([
      "urgent", "urgent", "watch", "watch", "watch", "stable", "stable", "stable",
    ]);
  });

  it("contains the spec's Walter history", () => {
    const walter = plan.patients[0];
    expect(walter?.checkIns.at(-1)?.transcript).toBe(HERO_TRANSCRIPT);
    const guidance = plan.actions.find((action) => action.body === WALTER_GUIDANCE);
    expect(guidance?.patientId).toBe(walter?.id);
    expect(NOW.getTime() - (guidance?.createdAt.getTime() ?? 0)).toBe(2 * DAY_MS);

    // Drift: nothing before 21 days ago, and both at 2 in the check-ins just before the latest.
    const past = walter?.checkIns.slice(0, -1) ?? [];
    const old = past.filter((row) => NOW.getTime() - row.createdAt.getTime() > 22 * DAY_MS);
    expect(old.every((row) => row.domains.appetite.severity === 0 && row.domains.cognition.severity === 0)).toBe(true);
    expect(past.at(-1)?.domains.appetite.severity).toBe(2);
    expect(past.at(-1)?.domains.cognition.severity).toBe(2);
  });

  it("never dates a nurse action after seed time", () => {
    for (const action of plan.actions) {
      expect(action.createdAt.getTime()).toBeLessThanOrEqual(NOW.getTime());
    }
  });

  it("keeps each handled check-in's status in step with its actions", () => {
    const actioned = new Set(plan.actions.map((action) => action.checkInId));
    for (const row of allCheckIns) {
      expect(actioned.has(row.id), `${row.status}: ${row.transcript}`).toBe(row.status !== "received");
    }
  });

  it("averages a response time in the 3-4 hour range", () => {
    const first = new Map<string, number>();
    for (const action of plan.actions) {
      if (!action.checkInId) continue;
      const row = allCheckIns.find((c) => c.id === action.checkInId);
      if (row) first.set(row.id, (action.createdAt.getTime() - row.createdAt.getTime()) / (60 * 60 * 1000));
    }
    const hours = [...first.values()];
    const mean = hours.reduce((a, b) => a + b, 0) / hours.length;
    expect(mean).toBeGreaterThan(2.5);
    expect(mean).toBeLessThan(4);
  });

  it("schedules next Monday at 10 AM, never today", () => {
    const saturday = new Date(2026, 10, 7, 12);
    expect(nextMondayAtTen(saturday)).toEqual(new Date(2026, 10, 9, 10));
    const monday = new Date(2026, 10, 9, 8);
    expect(nextMondayAtTen(monday)).toEqual(new Date(2026, 10, 16, 10));
    const sunday = new Date(2026, 10, 8, 23);
    expect(nextMondayAtTen(sunday)).toEqual(new Date(2026, 10, 9, 10));
  });
});

describe("seed phrases", () => {
  it.each(allPhrases().map((p) => [p.text, p] as const))("%s", (text, phrase) => {
    const domains = extractDomainsFromKeywords(text);
    for (const key of DOMAIN_KEYS) {
      expect(domains[key].severity, key).toBe(key === phrase.domain ? phrase.severity : 0);
    }
  });

  it.each(allFillers())("filler has no clinical signal: %s", (text) => {
    const domains = extractDomainsFromKeywords(text);
    for (const key of DOMAIN_KEYS) expect(domains[key].severity, key).toBe(0);
  });
});

describe("the hero check-in", () => {
  const walter = plan.patients[0];
  const seeded: HistoryRow[] = walter?.checkIns ?? [];

  function run(history: readonly HistoryRow[], at: Date) {
    const domains = extractDomainsFromKeywords(HERO_TRANSCRIPT);
    return { domains, ...scoreAgainstHistory({ transcript: HERO_TRANSCRIPT, domains, history, at }) };
  }

  it("extracts the expected domains with exact quotes", () => {
    const { appetite, cognition, medications, caregiverStrain, mood, mobility } = extractDomainsFromKeywords(HERO_TRANSCRIPT);
    expect(appetite).toMatchObject({ severity: 2, quote: "Dad barely touched his dinner again tonight" });
    expect(cognition).toMatchObject({ severity: 3, quote: "And this morning he called me by my mom's name" });
    expect(medications).toMatchObject({ severity: 0, quote: "He did take all his pills though." });
    expect(caregiverStrain).toMatchObject({ severity: 1, quote: "I'm pretty tired." });
    expect(mood.severity).toBe(1);
    expect(mobility).toMatchObject({ severity: 0, quote: null });
  });

  it("scores 83 with the spec's flags, right after seeding", () => {
    const result = run(seeded, new Date(NOW.getTime() + 1000));
    expect(result.score).toBe(83);
    expect(result.tier).toBe("urgent");
    expect(result.flags).toEqual(["New confusion", "Appetite ↓ 3 wks"]);
    expect(result.isEmergency).toBe(false);
  });

  it("stays at 83 through repeated simulate calls, with each in the next one's baseline", () => {
    const history = [...seeded];
    for (let i = 1; i <= 50; i++) {
      const at = new Date(NOW.getTime() + i * 60 * 1000);
      const result = run(history, at);
      expect(result.score, `simulate call ${i}`).toBe(83);
      expect(result.flags).toEqual(["New confusion", "Appetite ↓ 3 wks"]);
      history.push({ createdAt: at, domains: result.domains });
    }
  });

  it("still scores 83 after emergency check-ins entered the baseline window", () => {
    const history = [...seeded];
    const emergencyDomains = extractDomainsFromKeywords(EMERGENCY_TRANSCRIPT);
    for (let i = 1; i <= 5; i++) {
      history.push({ createdAt: new Date(NOW.getTime() + i * 1000), domains: emergencyDomains });
    }
    expect(run(history, new Date(NOW.getTime() + 60_000)).score).toBe(83);
  });

  it("scores the emergency check-in as an urgent emergency", () => {
    const domains = extractDomainsFromKeywords(EMERGENCY_TRANSCRIPT);
    const result = scoreAgainstHistory({
      transcript: EMERGENCY_TRANSCRIPT,
      domains,
      history: seeded,
      at: new Date(NOW.getTime() + 1000),
    });
    expect(result.isEmergency).toBe(true);
    expect(result.tier).toBe("urgent");
    expect(quotesMatchTranscript(EMERGENCY_TRANSCRIPT, domains)).toBe(true);
  });

  it("produces the spec's insights", () => {
    const rows = [...(walter?.checkIns ?? [])].reverse();
    const text = insightsFromHistory(rows, NOW).map((insight) => insight.text);
    expect(text).toContain("Cognition: first time misidentifying a family member (today)");
    expect(text.length).toBeLessThanOrEqual(3);
    expect(text.filter((line) => line.startsWith("Cognition")).length).toBe(1);
    expect(text.some((line) => /^Appetite below baseline in \d of the last 7 check-ins$/.test(line))).toBe(true);
  });
});

describe("keyword extraction", () => {
  it.each([
    ["He ate well at dinner.", "appetite", 0],
    ["He seemed confused this morning.", "cognition", 2],
    ["He forgot the dog's name.", "cognition", 1],
    ["She missed her medication.", "medications", 2],
    ["I'm exhausted.", "caregiverStrain", 2],
    ["He fell on the stairs.", "mobility", 3],
    ["No falls this week.", "mobility", 0],
  ] as const)("reads %j as %s %i", (text, key, severity) => {
    expect(extractDomainsFromKeywords(text)[key].severity).toBe(severity);
  });

  it("keeps quotes exact with odd punctuation, spacing and typographic apostrophes", () => {
    const transcript = "  He  fell,   then got up!  I’m exhausted… Mom’s name, he said?\n\nHe skipped   lunch.";
    const domains = extractDomainsFromKeywords(transcript);
    expect(quotesMatchTranscript(transcript, domains)).toBe(true);
    expect(domains.mobility.severity).toBe(3);
    expect(domains.caregiverStrain.severity).toBe(2);
  });

  it("returns all-clear domains for an empty transcript", () => {
    const domains = extractDomainsFromKeywords("");
    for (const key of DOMAIN_KEYS) expect(domains[key]).toMatchObject({ severity: 0, quote: null });
  });
});
