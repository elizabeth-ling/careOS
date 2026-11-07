import { ChevronRight, FileText } from "lucide-react";
import { Link } from "react-router";
import { useQueue } from "@/api/hooks";
import { PageTitle } from "@/components/PageTitle";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDayTime } from "@/lib/format";

export function CareSummariesPage() {
  const queue = useQueue("all", "risk");

  return (
    <>
      <PageTitle title="Care summaries" subtitle="Nurse-verified summaries for patients in your queue." />
      {queue.isError ? (
        <div role="alert" className="rounded-card border border-border bg-surface p-5 text-body-2">
          We couldn't load the patient list. Try again in a moment.
          <Button className="ml-3" size="sm" variant="outline" onClick={() => void queue.refetch()}>
            Retry
          </Button>
        </div>
      ) : !queue.data ? (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2].map((item) => <Skeleton key={item} className="h-20 w-full" />)}
        </div>
      ) : queue.data.rows.length ? (
        <ul className="space-y-3">
          {queue.data.rows.map(({ patient, caregiver, latestCheckIn }) => (
            <li key={patient.id}>
              <Link
                to={`/summary/${patient.id}`}
                className="flex min-h-20 items-center gap-4 rounded-card border border-border bg-surface p-4 hover:bg-surface-hover"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-panel bg-sage-50 text-brand-deep">
                  <FileText aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-ink">{patient.name}</span>
                  <span className="mt-1 block truncate text-sm text-muted-foreground">
                    {caregiver.name} · Latest check-in {formatDayTime(latestCheckIn.createdAt)}
                  </span>
                </span>
                <ChevronRight className="size-5 shrink-0 text-brand" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-card border border-border bg-surface p-5 text-body-2">No patients are in the queue yet.</p>
      )}
    </>
  );
}
