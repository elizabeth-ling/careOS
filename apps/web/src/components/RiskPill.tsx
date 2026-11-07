import { tierFor } from "@careos/shared";
import { cn } from "@/lib/utils";
import { TIER_STYLES } from "./tiers";

/** The risk score (0–100) in its tier colour. The tier comes from the shared risk rules. */
export function RiskPill({ score, className }: { score: number; className?: string }) {
  const tier = TIER_STYLES[tierFor(score)];
  return (
    <span
      className={cn(
        "inline-flex h-7 min-w-10 items-center justify-center rounded-control px-2 text-[15px] font-semibold tabular-nums",
        tier.bg,
        tier.text,
        className,
      )}
    >
      <span className="sr-only">Risk score </span>
      {score}
    </span>
  );
}
