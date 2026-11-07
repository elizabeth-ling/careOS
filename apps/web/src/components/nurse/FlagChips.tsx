import type { CheckIn } from "@careos/shared";
import { TierChip } from "@/components/TierChip";
import { cn } from "@/lib/utils";

/**
 * Why a check-in was flagged: up to `max` of the rule-based flags, tinted by the
 * check-in's tier. A check-in with no flags shows "No changes".
 */
export function FlagChips({
  checkIn,
  max = 3,
  className,
}: {
  checkIn: Pick<CheckIn, "flags" | "riskTier">;
  max?: number;
  className?: string;
}) {
  const shown = checkIn.flags.slice(0, max);
  const hidden = checkIn.flags.length - shown.length;

  if (shown.length === 0) {
    return (
      <span
        className={cn(
          "inline-flex h-6 items-center rounded-control bg-sage-50 px-2 text-[13px] font-medium text-muted-foreground",
          className,
        )}
      >
        No changes
      </span>
    );
  }

  return (
    <ul aria-label="Why flagged" className={cn("flex flex-wrap gap-1.5", className)}>
      {shown.map((flag) => (
        <li key={flag}>
          <TierChip tier={checkIn.riskTier} label={flag} />
        </li>
      ))}
      {hidden > 0 && (
        <li className="inline-flex h-6 items-center text-[13px] text-muted-foreground">+{hidden} more</li>
      )}
    </ul>
  );
}
