import { DOMAIN_LABELS, type DomainKey, type DomainPoint, type RiskTier } from "@careos/shared";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router";
import { useCheckIns, useTrends } from "@/api/hooks";
import { SubPageHeader } from "@/components/family/SubPageHeader";
import { TIER_STYLES } from "@/components/tiers";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDemoIdentity } from "@/demo";
import { firstNameOf } from "@/lib/format";
import { cn } from "@/lib/utils";

const TREND_DAYS = 14;
const RECENT_DAYS = 7;

/** Walter's domains; caregiver strain gets its own row for Sarah. */
const PATIENT_DOMAINS = ["appetite", "sleep", "mobility", "cognition", "mood", "pain", "medications"] as const;

type Direction = "worse" | "same" | "better" | "none";

/** Compares the last week's average severity (0 best, 3 worst) with the patient's own baseline. */
function directionOf(points: DomainPoint[], baseline: number): Direction {
  const cutoff = Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000;
  const recent = points.filter((point) => new Date(point.date).getTime() >= cutoff);
  if (recent.length === 0) return "none";
  const average = recent.reduce((sum, point) => sum + point.severity, 0) / recent.length;
  if (average >= baseline + 0.5) return "worse";
  if (average <= baseline - 0.5) return "better";
  return "same";
}

function sentence(key: DomainKey, direction: Direction): string {
  const noun = DOMAIN_LABELS[key].toLowerCase();
  const Noun = DOMAIN_LABELS[key];
  switch (direction) {
    case "worse":
      return `More concerns about ${noun} than usual this past week.`;
    case "better":
      return `${Noun} has been better than usual this past week.`;
    case "same":
      return `${Noun} has been about the same as usual.`;
    case "none":
      return `Not mentioned in the last ${TREND_DAYS} days.`;
  }
}

const DIRECTION_TIER: Record<Direction, RiskTier | null> = { worse: "watch", same: "stable", better: "stable", none: null };

export function FamilyHistoryPage() {
  const identity = useDemoIdentity();
  const patientId = identity.data?.heroPatientId;
  const trends = useTrends(patientId, TREND_DAYS);
  const recent = useCheckIns(patientId, 5);

  if (!identity.data || !trends.data || !recent.data) {
    return (
      <>
        <SubPageHeader title="Health history" />
        <Skeleton className="h-96 w-full" />
      </>
    );
  }

  const patient = firstNameOf(identity.data.patient.name);
  const caregiver = firstNameOf(identity.data.caregiver.name);
  const tiredCount = recent.data.filter((checkIn) => checkIn.domains.caregiverStrain.severity > 0).length;
  const total = recent.data.length;

  return (
    <>
      <SubPageHeader title="Health history" subtitle={`How ${patient} has been over the last ${TREND_DAYS} days.`} />

      <ul className="divide-y divide-border rounded-card border border-border bg-surface">
        {PATIENT_DOMAINS.map((key) => {
          const points = [...trends.data.domains[key]].sort((a, b) => a.date.localeCompare(b.date));
          const direction = directionOf(points, trends.data.baselines[key]);
          const tier = DIRECTION_TIER[direction];
          return (
            <li key={key} className="flex items-center gap-4 px-5 py-4">
              <span
                aria-hidden
                className={cn("size-2.5 shrink-0 rounded-full", tier ? `bg-current ${TIER_STYLES[tier].text}` : "bg-sage-200")}
              />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink">{DOMAIN_LABELS[key]}</p>
                <p className="text-[15px] text-body-2">{sentence(key, direction)}</p>
              </div>
              <SeveritySparkline points={points} tier={tier} label={DOMAIN_LABELS[key]} />
            </li>
          );
        })}
        <li className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:gap-4">
          <p className="flex-1 text-[15px] text-ink">
            <span className="font-medium">And you, {caregiver}:</span>{" "}
            {total === 0
              ? "tell us how you're doing in your next check-in."
              : tiredCount > 0
                ? `you've mentioned feeling tired in ${tiredCount} of your last ${total} check-ins.`
                : `you haven't mentioned feeling tired in your last ${total} check-ins.`}
          </p>
          <Link
            to="/family/care-team"
            className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-control text-sm font-semibold text-brand underline-offset-4 hover:underline"
          >
            Talk to the care team
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        </li>
      </ul>

      <Button asChild className="mt-6 h-11 px-5">
        <Link to={`/summary/${identity.data.heroPatientId}`}>
          View care summary
          <ChevronRight aria-hidden />
        </Link>
      </Button>
    </>
  );
}

const WIDTH = 64;
const HEIGHT = 24;

/** 64×24 severity line with no axes. Higher means more concern. */
function SeveritySparkline({ points, tier, label }: { points: DomainPoint[]; tier: RiskTier | null; label: string }) {
  const description =
    points.length > 0
      ? `${label} trend over ${points.length} check-in days, latest ${points.at(-1)!.severity} of 3`
      : `${label}: no data`;
  const step = points.length > 1 ? (WIDTH - 4) / (points.length - 1) : 0;
  const path = points
    .map((point, i) => `${(2 + i * step).toFixed(1)},${(HEIGHT - 3 - (point.severity / 3) * (HEIGHT - 6)).toFixed(1)}`)
    .join(" ");

  return (
    <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={description} className="shrink-0">
      {points.length > 1 && (
        <polyline
          points={path}
          fill="none"
          stroke={tier ? TIER_STYLES[tier].stroke : "var(--color-sage-200)"}
          strokeWidth={1.75}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
