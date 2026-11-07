import {
  queueResponseSchema,
  type QueueFilter,
  type QueueResponse,
  type QueueSort,
} from "@careos/shared";
import { prisma } from "../db";
import type { CheckInStatus, RiskTier } from "../generated/prisma/client";
import { toCaregiver, toCheckIn, toPatient } from "../mappers";

const SERIES_DAYS = 14;

interface LatestRow {
  patient_id: string;
  check_in_id: string;
}

interface SeriesRow {
  patient_id: string;
  day: string;
  max_risk: number;
}

/** Latest check-in per patient. */
function latestCheckInIds() {
  return prisma.$queryRaw<LatestRow[]>`
    SELECT DISTINCT ON (patient_id)
      patient_id::text AS patient_id,
      id::text AS check_in_id
    FROM check_ins
    ORDER BY patient_id, created_at DESC
  `;
}

/** Highest risk per patient per day over the last 14 days. */
function dailyMaxRisk() {
  return prisma.$queryRaw<SeriesRow[]>`
    SELECT
      patient_id::text AS patient_id,
      to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
      max(risk_score)::int AS max_risk
    FROM check_ins
    WHERE created_at >= now() - make_interval(days => ${SERIES_DAYS}::int)
    GROUP BY 1, 2
    ORDER BY 1, 2
  `;
}

/** Mean hours from a check-in to its first nurse action. */
async function averageResponseHours(): Promise<number | null> {
  const [row] = await prisma.$queryRaw<{ hours: number | null }[]>`
    SELECT avg(extract(epoch FROM first_action.at - c.created_at) / 3600)::float8 AS hours
    FROM check_ins c
    JOIN (
      SELECT check_in_id, min(created_at) AS at
      FROM nurse_actions
      WHERE check_in_id IS NOT NULL
      GROUP BY check_in_id
    ) first_action ON first_action.check_in_id = c.id
  `;
  return row?.hours === null || row?.hours === undefined ? null : Math.round(row.hours * 10) / 10;
}

function matchesFilter(row: { riskTier: RiskTier; status: CheckInStatus }, filter: QueueFilter): boolean {
  if (filter === "all") return true;
  if (filter === "reviewed") return row.status !== "received";
  return row.riskTier === filter;
}

export async function getQueue(filter: QueueFilter, sort: QueueSort): Promise<QueueResponse> {
  const [latest, series, avgResponseHours, unreviewedCheckIns, unreadFamilyMessages] = await Promise.all([
    latestCheckInIds(),
    dailyMaxRisk(),
    averageResponseHours(),
    prisma.checkIn.count({ where: { status: "received" } }),
    prisma.message.count({ where: { fromRole: "family", readAt: null } }),
  ]);

  const checkIns = await prisma.checkIn.findMany({
    where: { id: { in: latest.map((row) => row.check_in_id) } },
    include: { patient: true, caregiver: true },
  });

  const byRisk = [...checkIns].sort(
    (a, b) => b.riskScore - a.riskScore || b.createdAt.getTime() - a.createdAt.getTime(),
  );
  const rank = new Map(byRisk.map((row, index) => [row.id, index + 1]));

  const sorted = [...byRisk];
  if (sort === "recent") {
    sorted.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } else if (sort === "longest_unreviewed") {
    // Waiting check-ins first, oldest at the top. Handled ones follow by risk.
    sorted.sort((a, b) => {
      const aWaiting = a.status === "received";
      const bWaiting = b.status === "received";
      if (aWaiting !== bWaiting) return aWaiting ? -1 : 1;
      return aWaiting ? a.createdAt.getTime() - b.createdAt.getTime() : 0;
    });
  }

  const count = (f: QueueFilter) => checkIns.filter((row) => matchesFilter(row, f)).length;

  return queueResponseSchema.parse({
    stats: {
      counts: {
        all: count("all"),
        urgent: count("urgent"),
        watch: count("watch"),
        stable: count("stable"),
        reviewed: count("reviewed"),
      },
      unreviewedCheckIns,
      unreadFamilyMessages,
      avgResponseHours,
      urgentWaiting: byRisk
        .filter((row) => row.riskTier === "urgent" && row.status === "received")
        .map((row) => row.patient.name),
    },
    rows: sorted
      .filter((row) => matchesFilter(row, filter))
      .map((row) => ({
        rank: rank.get(row.id),
        patient: toPatient(row.patient),
        caregiver: toCaregiver(row.caregiver),
        latestCheckIn: toCheckIn(row),
        series: series
          .filter((point) => point.patient_id === row.patientId)
          .map((point) => ({ date: point.day, maxRisk: point.max_risk })),
      })),
  });
}
