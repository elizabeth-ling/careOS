import {
  DOMAIN_KEYS,
  domainsSchema,
  trendsResponseSchema,
  type DomainPoint,
  type Domains,
  type Severity,
  type TrendsResponse,
} from "@careos/shared";
import { prisma } from "../db";
import { computeBaselines } from "./baseline";

const DAY_MS = 24 * 60 * 60 * 1000;
const dayOf = (date: Date) => date.toISOString().slice(0, 10);

/** One point per day with a check-in, using the worst severity reported that day. */
export function domainSeries(
  rows: readonly { createdAt: Date; domains: Domains }[],
): Record<keyof Domains, DomainPoint[]> {
  const series = {} as Record<keyof Domains, DomainPoint[]>;
  for (const key of DOMAIN_KEYS) {
    const byDay = new Map<string, Severity>();
    for (const row of rows) {
      const day = dayOf(row.createdAt);
      const severity = row.domains[key].severity;
      if ((byDay.get(day) ?? -1) < severity) byDay.set(day, severity);
    }
    series[key] = [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, severity]) => ({ date, severity }));
  }
  return series;
}

export async function getTrends(patientId: string, days: number): Promise<TrendsResponse> {
  const now = new Date();
  // Baselines look back 14 days, which may be further than the requested range.
  const from = new Date(now.getTime() - Math.max(days, 14) * DAY_MS);
  const cutoff = new Date(now.getTime() - days * DAY_MS);

  const stored = await prisma.checkIn.findMany({
    where: { patientId, createdAt: { gte: from } },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true, domains: true, riskScore: true },
  });
  const all = stored.map((row) => ({ ...row, domains: domainsSchema.parse(row.domains) }));
  const rows = all.filter((row) => row.createdAt >= cutoff);

  const risk = new Map<string, number>();
  for (const row of rows) {
    const day = dayOf(row.createdAt);
    risk.set(day, Math.max(risk.get(day) ?? 0, row.riskScore));
  }

  return trendsResponseSchema.parse({
    days,
    domains: domainSeries(rows),
    baselines: computeBaselines(all, now),
    risk: [...risk.entries()].map(([date, maxRisk]) => ({ date, maxRisk })),
  });
}
