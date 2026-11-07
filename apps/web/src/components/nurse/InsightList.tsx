import { DOMAIN_NAMES, type Insight } from "@careos/shared";
import { ArrowDownRight, ArrowUpRight, Info, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Domains where "worse" means the number went up rather than down. */
const RISING_IS_WORSE = new Set(["caregiverStrain", "pain"]);

function iconFor(insight: Insight): { icon: LucideIcon; tone: string; label: string } {
  if (insight.kind === "first_time") return { icon: Info, tone: "bg-info-bg text-info", label: "New" };
  return RISING_IS_WORSE.has(insight.domain)
    ? { icon: ArrowUpRight, tone: "bg-watch-bg text-watch", label: "Rising" }
    : { icon: ArrowDownRight, tone: "bg-watch-bg text-watch", label: "Falling" };
}

/** Bolds the leading domain name ("Appetite below baseline…", "Cognition: first time…"). */
function InsightText({ insight }: { insight: Insight }) {
  const name = DOMAIN_NAMES[insight.domain];
  if (!insight.text.startsWith(name)) return <>{insight.text}</>;
  return (
    <>
      <strong className="font-semibold">{name}</strong>
      {insight.text.slice(name.length)}
    </>
  );
}

/** The API's "changes from baseline" rows, each with a small tinted trend icon. */
export function InsightList({ insights, className }: { insights: Insight[]; className?: string }) {
  if (insights.length === 0) {
    return <p className={cn("text-sm text-muted-foreground", className)}>No changes from baseline.</p>;
  }
  return (
    <ul className={cn("flex flex-col gap-3", className)}>
      {insights.map((insight) => {
        const { icon: Icon, tone, label } = iconFor(insight);
        return (
          <li key={`${insight.domain}-${insight.kind}`} className="flex items-start gap-3 text-[15px] text-ink">
            <span className={cn("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-control", tone)}>
              <Icon className="size-3.5" aria-hidden />
              <span className="sr-only">{label}: </span>
            </span>
            <span className="leading-snug">
              <InsightText insight={insight} />
            </span>
          </li>
        );
      })}
    </ul>
  );
}
