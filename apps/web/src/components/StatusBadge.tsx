import type { CheckInStatus } from "@careos/shared";
import { cn } from "@/lib/utils";

const STATUS: Record<CheckInStatus, { label: string; className: string }> = {
  received: { label: "New", className: "bg-info-bg text-info" },
  reviewed: { label: "Reviewed", className: "bg-sage-50 text-brand-deep" },
  guidance_sent: { label: "Guidance sent", className: "bg-brand text-on-ink" },
};

/** A check-in's review status: New, Reviewed or Guidance sent. */
export function StatusBadge({ status, className }: { status: CheckInStatus; className?: string }) {
  const style = STATUS[status];
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-control px-2 text-[13px] font-medium",
        style.className,
        className,
      )}
    >
      {style.label}
    </span>
  );
}
