import type { SummaryItem } from "@careos/shared";
import { Check, Printer, Share2 } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { useParams } from "react-router";
import { toast } from "sonner";
import { useCareSummary } from "@/api/hooks";
import { AiSummaryPanel } from "@/components/AiSummaryPanel";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDayTime, formatShortDate } from "@/lib/format";
import { SummaryTrendChart } from "@/components/SummaryTrendChart";

export function CareSummaryPage() {
  const { patientId } = useParams();
  const summary = useCareSummary(patientId);
  const [shareOpen, setShareOpen] = useState(false);
  const [facilityEmail, setFacilityEmail] = useState("");

  if (!summary.data) {
    return (
      <main className="care-summary mx-auto w-full max-w-[1000px] px-4 py-8 sm:px-6">
        <div className="mb-6 flex items-center justify-between gap-4 border-b border-border pb-4">
          <Logo />
          <span className="text-sm text-muted-foreground">Nurse-verified care summary</span>
        </div>
        {summary.isError ? (
          <section role="alert" className="rounded-card border border-border bg-surface p-6">
            <h1 className="text-card-title font-medium text-ink">Care summary unavailable</h1>
            <p className="mt-2 text-body-2">We couldn't load this patient's care summary.</p>
            <Button className="mt-4" variant="outline" onClick={() => void summary.refetch()}>
              Try again
            </Button>
          </section>
        ) : (
          <div className="space-y-4" aria-busy="true">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-44 w-full" />
            <Skeleton className="h-72 w-full" />
          </div>
        )}
      </main>
    );
  }

  const data = summary.data;
  const from = data.dateRange.from ? formatShortDate(data.dateRange.from.slice(0, 10)) : "No check-ins";
  const to = data.dateRange.to ? formatShortDate(data.dateRange.to.slice(0, 10)) : "No check-ins";

  function share(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    toast.success("Share request prepared. This demo does not send email or patient records.");
    setShareOpen(false);
    setFacilityEmail("");
  }

  return (
    <main className="care-summary mx-auto w-full max-w-[1000px] px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <Logo />
        <div className="flex flex-wrap items-center gap-2 print:hidden print-hide">
          <Button type="button" variant="outline" onClick={() => window.print()}>
            <Printer aria-hidden />
            Print / Save as PDF
          </Button>
          <Button type="button" variant="outline" onClick={() => setShareOpen(true)}>
            <Share2 aria-hidden />
            Share with care home
          </Button>
        </div>
      </header>

      <section className="mb-6 rounded-card border border-border bg-surface p-5 sm:p-6 print:break-inside-avoid">
        <p className="text-sm font-medium text-brand-deep">Nurse-verified care summary</p>
        <h1 className="mt-1 text-page-title font-normal text-ink">{data.patient.name}</h1>
        <p className="mt-2 text-body-2">
          {data.patient.age} years · {data.patient.conditions.join(", ")}
        </p>
        <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Meta label="Caregiver" value={`${data.caregiver.name} (${data.caregiver.relationship})`} />
          <Meta label="Care home" value={data.careHome.name} />
          <Meta label="Reviewing nurse" value={`${data.nurse.name}, ${data.nurse.credentials}`} />
          <Meta label="Check-ins" value={String(data.checkInCount)} />
          <Meta label="Date range" value={`${from} – ${to}`} />
        </dl>
      </section>

      <div className="space-y-4">
        <SummarySection title="Current status">
          <SummaryItems items={data.status} empty="No check-ins have been recorded." aiSummary />
        </SummarySection>

        <SummarySection title="Trends by domain">
          {data.trends.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {data.trends.map((trend) => (
                <article key={trend.domain} className="min-w-0 rounded-panel border border-border p-3 print:break-inside-avoid">
                  <h3 className="truncate text-sm font-semibold text-ink">{trend.label}</h3>
                  <SummaryTrendChart label={trend.label} series={trend.series} />
                  <SummaryItems items={[trend.item]} />
                </article>
              ))}
            </div>
          ) : (
            <EmptyState>No trend data is available yet.</EmptyState>
          )}
        </SummarySection>

        <SummarySection title="Notable events">
          <SummaryItems items={data.notableEvents} empty="No notable events reported." />
        </SummarySection>

        <SummarySection title="Interventions and guidance given">
          <SummaryItems items={data.interventions} empty="No interventions or guidance have been recorded." />
        </SummarySection>

        <SummarySection title="Medication adherence">
          <SummaryItems items={data.medicationAdherence} empty="No medication information is available." />
        </SummarySection>

        <SummarySection title="Caregiver context">
          <SummaryItems items={data.caregiverContext} empty="No caregiver context is available." />
        </SummarySection>

        <SummarySection title="Open concerns">
          <SummaryItems items={data.openConcerns} empty="There are no open concerns from the latest check-in." />
        </SummarySection>
      </div>

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share with care home</DialogTitle>
            <DialogDescription>
              Enter a facility email to prepare a demo share request. No email or patient records will be sent.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={share} className="space-y-4">
            <label htmlFor="facility-email" className="block text-sm font-medium text-ink">
              Facility email
            </label>
            <Input
              id="facility-email"
              type="email"
              autoComplete="email"
              required
              value={facilityEmail}
              onChange={(event) => setFacilityEmail(event.target.value)}
              placeholder="care-home@example.ca"
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShareOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Prepare share</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-body-2">{value}</dd>
    </div>
  );
}

function SummarySection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="summary-section rounded-card border border-border bg-surface p-5 sm:p-6">
      <h2 className="mb-3 text-card-title font-medium text-ink">{title}</h2>
      {children}
    </section>
  );
}

function SummaryItems({ items, empty, aiSummary = false }: { items: SummaryItem[]; empty?: string; aiSummary?: boolean }) {
  if (!items.length) return empty ? <EmptyState>{empty}</EmptyState> : null;

  return (
    <ul className="space-y-3">
      {items.map((item, index) => (
        <li key={`${item.text}-${item.at ?? "undated"}-${index}`} className="flex flex-wrap items-start gap-x-3 gap-y-1">
          <ProvenanceTag provenance={item.provenance} />
          {aiSummary ? (
            <AiSummaryPanel className="min-w-0 flex-1 px-3 py-2">{item.text}</AiSummaryPanel>
          ) : (
            <p className="min-w-0 flex-1 text-sm leading-relaxed text-body-2">{item.text}</p>
          )}
          {item.at && <time className="w-full text-xs text-muted-foreground sm:w-auto">{formatDayTime(item.at)}</time>}
        </li>
      ))}
    </ul>
  );
}

function ProvenanceTag({ provenance }: { provenance: SummaryItem["provenance"] }) {
  const verified = provenance === "nurse_verified";
  return (
    <span
      className={
        verified
          ? "inline-flex shrink-0 items-center gap-1 rounded-control bg-sage-50 px-2 py-1 text-xs font-medium text-brand-deep"
          : "inline-flex shrink-0 items-center gap-1 rounded-control bg-table-head px-2 py-1 text-xs font-medium text-muted-foreground"
      }
    >
      {verified && <Check className="size-3.5" aria-hidden />}
      {verified ? "Nurse-verified" : "Family-reported"}
    </span>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-panel bg-table-head px-4 py-3 text-sm text-muted-foreground">{children}</p>;
}
