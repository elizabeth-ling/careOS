import type { RiskTier } from "@careos/shared";
import { cn } from "@/lib/utils";
import { TIER_STYLES } from "./tiers";

interface TierChipProps {
  tier: RiskTier;
  score?: number;
  /** Text in place of the tier name, e.g. a flag such as "New confusion", in the tier's colours. */
  label?: string;
  className?: string;
}

/** "Urgent · 82": the tier name, optionally with its score. Or a flag, tinted by tier. */
export function TierChip({ tier, score, label, className }: TierChipProps) {
  const style = TIER_STYLES[tier];
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-control px-2 text-[13px] font-medium whitespace-nowrap",
        style.bg,
        style.text,
        className,
      )}
    >
      {label ?? style.label}
      {score !== undefined && <span className="tabular-nums">&nbsp;·&nbsp;{score}</span>}
    </span>
  );
}
