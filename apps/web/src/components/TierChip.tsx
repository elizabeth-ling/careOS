import type { RiskTier } from "@careos/shared";
import { cn } from "@/lib/utils";
import { TIER_STYLES } from "./tiers";

/** "Urgent · 82": the tier name, optionally with its score. */
export function TierChip({ tier, score, className }: { tier: RiskTier; score?: number; className?: string }) {
  const style = TIER_STYLES[tier];
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-control px-2 text-[13px] font-medium",
        style.bg,
        style.text,
        className,
      )}
    >
      {style.label}
      {score !== undefined && <span className="tabular-nums">&nbsp;·&nbsp;{score}</span>}
    </span>
  );
}
