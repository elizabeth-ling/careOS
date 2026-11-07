import type { CalendarItem } from "@careos/shared";
import { ChevronDown } from "lucide-react";
import { Link } from "react-router";
import { useCalendar } from "@/api/hooks";
import { SubPageHeader } from "@/components/family/SubPageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { useDemoIdentity } from "@/demo";
import { formatWeekdayAt, joinWithAnd } from "@/lib/format";
import { cn } from "@/lib/utils";

export function FamilyCalendarPage() {
  const identity = useDemoIdentity();
  const calendar = useCalendar(identity.data?.heroPatientId);

  if (!calendar.data) {
    return (
      <>
        <SubPageHeader title="Calendar" />
        <Skeleton className="h-64 w-full" />
      </>
    );
  }

  const upcoming = calendar.data.filter((item) => !item.isPast);
  // Most recent first.
  const earlier = calendar.data.filter((item) => item.isPast).reverse();

  return (
    <>
      <SubPageHeader title="Calendar" />
      {upcoming.length === 0 ? (
        <p className="rounded-card border border-border bg-surface p-6 text-body-2">
          Nothing coming up.{" "}
          <Link to="/family/care-team" className="font-medium text-brand underline underline-offset-4">
            Request a call
          </Link>{" "}
          with the care team.
        </p>
      ) : (
        <ItemList items={upcoming} />
      )}

      {earlier.length > 0 && (
        <details className="group mt-6">
          <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-control font-medium text-brand [&::-webkit-details-marker]:hidden">
            <ChevronDown className="size-4 -rotate-90 transition-transform group-open:rotate-0" aria-hidden />
            Earlier ({earlier.length})
          </summary>
          <ItemList items={earlier} className="mt-3" past />
        </details>
      )}
    </>
  );
}

function ItemList({ items, className, past = false }: { items: CalendarItem[]; className?: string; past?: boolean }) {
  return (
    <ul className={cn("divide-y divide-border rounded-card border border-border bg-surface", className)}>
      {items.map((item) => {
        const confirmed = item.status !== "requested";
        return (
          <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
            <div className="min-w-0">
              <p className={cn("font-medium", past ? "text-body-2" : "text-ink")}>{item.title}</p>
              <p className="text-[15px] text-body-2">
                {confirmed || item.preferredTimes.length <= 1
                  ? formatWeekdayAt(item.at)
                  : `You offered ${joinWithAnd(item.preferredTimes.map(formatWeekdayAt))}`}
              </p>
              {item.note && <p className="mt-1 text-sm text-muted-foreground">{item.note}</p>}
            </div>
            <span
              className={cn(
                "inline-flex h-6 shrink-0 items-center rounded-control px-2 text-[13px] font-medium",
                confirmed ? "bg-brand text-on-ink" : "bg-watch-bg text-watch",
              )}
            >
              {confirmed ? "Confirmed" : "Requested"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
