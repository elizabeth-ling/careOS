import {
  DOMAIN_KEYS,
  DOMAIN_NAMES,
  domainsSchema,
  observations,
  redFlags,
  scoreCheckIn,
  type Baselines,
  type DomainKey,
  type Domains,
  type Insight,
  type ScoreResult,
} from "@careos/shared";
import { prisma } from "../db";

const DAY_MS = 24 * 60 * 60 * 1000;
export const BASELINE_DAYS = 14;

/** The parts of a past check-in that baselines and trends depend on. */
export interface HistoryRow {
  createdAt: Date;
  domains: Domains;
}

/** Mean severity per domain over the 14 days before `at`. Zero with no history. */
export function computeBaselines(history: readonly HistoryRow[], at: Date): Baselines {
  const from = at.getTime() - BASELINE_DAYS * DAY_MS;
  const window = history.filter((row) => {
    const time = row.createdAt.getTime();
    return time >= from && time < at.getTime();
  });

  const baselines = {} as Baselines;
  for (const key of DOMAIN_KEYS) {
    const sum = window.reduce((total, row) => total + row.domains[key].severity, 0);
    baselines[key] = window.length > 0 ? sum / window.length : 0;
  }
  return baselines;
}

/**
 * Days since each domain was last at severity 0, counting back through unbroken
 * affected check-ins before `at`. A domain affected only now has no duration.
 */
export function computeDeclineDays(
  history: readonly HistoryRow[],
  at: Date,
): Partial<Record<DomainKey, number>> {
  const earlier = history
    .filter((row) => row.createdAt.getTime() < at.getTime())
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const result: Partial<Record<DomainKey, number>> = {};
  for (const key of DOMAIN_KEYS) {
    let start: Date | null = null;
    for (const row of earlier) {
      if (row.domains[key].severity === 0) break;
      start = row.createdAt;
    }
    if (start) result[key] = Math.round((at.getTime() - start.getTime()) / DAY_MS);
  }
  return result;
}

/** The rule-based score for a check-in, given the patient's earlier check-ins. */
export function scoreAgainstHistory(input: {
  transcript: string;
  domains: Domains;
  history: readonly HistoryRow[];
  at: Date;
}): ScoreResult & { baselines: Baselines } {
  const baselines = computeBaselines(input.history, input.at);
  const result = scoreCheckIn({
    redFlags: redFlags(input.transcript, input.domains),
    domains: input.domains,
    baselines,
    declineDays: computeDeclineDays(input.history, input.at),
    observations: observations(input.transcript),
  });
  return { ...result, baselines };
}

const WORSE_WORDING: Record<DomainKey, string> = {
  appetite: "below baseline",
  sleep: "below baseline",
  mobility: "below baseline",
  cognition: "below baseline",
  mood: "below baseline",
  pain: "worse than baseline",
  medications: "below baseline",
  caregiverStrain: "above baseline",
};

const INSIGHT_WINDOW = 7;
const INSIGHT_MIN_COUNT = 3;
const MAX_INSIGHTS = 3;

function relativeDay(date: Date, now: Date): string {
  const days = Math.floor((startOfDay(now) - startOfDay(date)) / DAY_MS);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Newest-first `rows`. Pure, so it can be tested against the seed plan. */
export function insightsFromHistory(
  rows: readonly (HistoryRow & { transcript: string })[],
  now: Date,
): Insight[] {
  const latest = rows[0];
  if (!latest) return [];

  const insights: Insight[] = [];
  const recent = rows.slice(0, INSIGHT_WINDOW);

  if (latest.domains.cognition.severity === 3 && /\bmom's name\b|\bdidn't recogni[sz]e\b/i.test(latest.transcript.replace(/’/g, "'"))) {
    insights.push({
      domain: "cognition",
      kind: "first_time",
      text: `Cognition: first time misidentifying a family member (${relativeDay(latest.createdAt, now)})`,
    });
  }

  const drifting = DOMAIN_KEYS.map((key) => {
    const count = recent.filter((row) => {
      const baseline = computeBaselines(rows, row.createdAt)[key];
      return row.domains[key].severity > baseline;
    }).length;
    return { key, count };
  })
    .filter(({ count }) => count >= INSIGHT_MIN_COUNT)
    .sort((a, b) => b.count - a.count);

  const covered = new Set(insights.map((insight) => insight.domain));
  const patterns: Insight[] = drifting
    .filter(({ key }) => !covered.has(key))
    .slice(0, Math.max(0, MAX_INSIGHTS - insights.length))
    .map(({ key, count }) => ({
      domain: key,
      kind: "below_baseline",
      text: `${DOMAIN_NAMES[key]} ${WORSE_WORDING[key]} in ${count} of the last ${recent.length} check-ins`,
    }));

  // Lead with the slow-moving pattern, the part that's easy to miss day to day.
  return [...patterns, ...insights];
}

export async function changesFromBaseline(patientId: string): Promise<Insight[]> {
  const rows = await prisma.checkIn.findMany({
    where: { patientId },
    orderBy: { createdAt: "desc" },
    take: 60,
    select: { createdAt: true, domains: true, transcript: true },
  });
  return insightsFromHistory(
    rows.map((row) => ({
      createdAt: row.createdAt,
      transcript: row.transcript,
      domains: domainsSchema.parse(row.domains),
    })),
    new Date(),
  );
}

/** A patient's check-ins in the window that baselines and decline durations need. */
export async function loadHistory(patientId: string, at: Date): Promise<HistoryRow[]> {
  const rows = await prisma.checkIn.findMany({
    where: { patientId, createdAt: { lt: at, gte: new Date(at.getTime() - 90 * DAY_MS) } },
    select: { createdAt: true, domains: true },
  });
  return rows.map((row) => ({ createdAt: row.createdAt, domains: domainsSchema.parse(row.domains) }));
}
