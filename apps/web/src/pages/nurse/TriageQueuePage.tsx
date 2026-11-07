import {
  queueFilterSchema,
  queueSortSchema,
  type Insight,
  type QueueFilter,
  type QueueRow,
  type QueueSort,
  type QueueStats,
} from "@careos/shared";
import { ChevronRight, Info } from "lucide-react";
import type { MouseEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { usePatient, useQueue, useTrends } from "@/api/hooks";
import { AiSummaryPanel } from "@/components/AiSummaryPanel";
import { EmergencyNotice } from "@/components/EmergencyNotice";
import { HighlightedTranscript } from "@/components/HighlightedTranscript";
import { CheckInActions } from "@/components/nurse/CheckInActions";
import { FlagChips } from "@/components/nurse/FlagChips";
import { InsightList } from "@/components/nurse/InsightList";
import { BaselineChart, BaselineLegend } from "@/components/nurse/SeverityCharts";
import { PageTitle } from "@/components/PageTitle";
import { RiskPill } from "@/components/RiskPill";
import { Sparkline } from "@/components/Sparkline";
import { StatusBadge } from "@/components/StatusBadge";
import { TierChip } from "@/components/TierChip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { downloadText, toCsv } from "@/lib/csv";
import {
  firstNameOf,
  formatDayTime,
  formatDuration,
  formatHours,
  formatLongDate,
  formatRelative,
  joinWithAnd,
  shortNameOf,
} from "@/lib/format";
import { cn } from "@/lib/utils";

const FILTERS: { value: QueueFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "urgent", label: "Urgent" },
  { value: "watch", label: "Watch" },
  { value: "stable", label: "Stable" },
  { value: "reviewed", label: "Reviewed today" },
];

const SORTS: { value: QueueSort; label: string }[] = [
  { value: "risk", label: "Risk score" },
  { value: "recent", label: "Most recent" },
  { value: "longest_unreviewed", label: "Longest unreviewed" },
];

/** The two domains the "Changes from baseline" card compares. */
const COMPARED_DOMAINS = ["appetite", "cognition"] as const;
const BASELINE_CHART_DAYS = 21;

const patientPath = (id: string) => `/nurse/patients/${id}`;

// --- Stat cards ------------------------------------------------------------

function StatCard({ dot, label, value, note }: { dot: string; label: string; value: string; note: string }) {
  return (
    <div className="rounded-card border border-border bg-surface px-5 py-4">
      <p className="flex items-center gap-2 text-sm font-medium text-body-2">
        <span className={cn("size-2 rounded-[2px]", dot)} aria-hidden />
        {label}
      </p>
      <p className="mt-1.5 text-stat font-normal text-ink tabular-nums">{value}</p>
      <p className="mt-2 text-[13px] text-muted-foreground">{note}</p>
    </div>
  );
}

function StatCards({ stats }: { stats: QueueStats | undefined }) {
  if (!stats) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-[118px] rounded-card" />
        ))}
      </div>
    );
  }
  const waiting = stats.urgentWaiting.map(shortNameOf);
  return (
    <section aria-label="Queue summary" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard
        dot="bg-urgent"
        label="Needs attention"
        value={String(stats.counts.urgent)}
        note={waiting.length > 0 ? `${joinWithAnd(waiting)} waiting` : "No urgent check-ins waiting"}
      />
      <StatCard dot="bg-watch" label="Watch" value={String(stats.counts.watch)} note="Drifting from their baseline" />
      <StatCard dot="bg-stable" label="Stable" value={String(stats.counts.stable)} note="No new concerns this week" />
      <StatCard
        dot="bg-info"
        label="Avg response time"
        value={formatHours(stats.avgResponseHours)}
        note="Target: under 4 hours"
      />
    </section>
  );
}

// --- Queue table -----------------------------------------------------------

function RiskHeader() {
  return (
    <span className="inline-flex items-center gap-1">
      Risk
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex size-5 items-center justify-center rounded-control text-muted-foreground hover:text-ink"
          >
            <Info className="size-3.5" aria-hidden />
            <span className="sr-only">How the ranking works</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="start" className="max-w-xs text-[13px] leading-snug">
          Each patient's latest check-in gets a 0–100 score from fixed rules: red flags in what the family said
          (new confusion, a fall, not eating, emergency terms), how severe each area is, and how far it has moved
          from that patient's own 14-day baseline. The AI only extracts what was said; it never sets the score.
        </TooltipContent>
      </Tooltip>
    </span>
  );
}

function QueueTableRow({ row }: { row: QueueRow }) {
  const navigate = useNavigate();
  const { patient, caregiver, latestCheckIn: checkIn } = row;
  const isNew = checkIn.status === "received";

  function openRow(event: MouseEvent<HTMLTableRowElement>) {
    // Links and buttons inside the row handle their own clicks.
    if ((event.target as HTMLElement).closest("a, button")) return;
    void navigate(patientPath(patient.id));
  }

  return (
    <TableRow onClick={openRow} className="cursor-pointer">
      <TableCell className="py-3 pl-5">
        <span className="inline-flex items-center gap-3">
          <span className="w-4 text-right text-muted-foreground tabular-nums">
            <span className="sr-only">Rank </span>
            {row.rank}
          </span>
          <RiskPill score={checkIn.riskScore} />
        </span>
      </TableCell>
      <TableCell className="py-3 whitespace-normal">
        <div className="flex items-center gap-3">
          <Avatar className="size-9">
            <AvatarFallback className="text-[13px]">{patient.initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-semibold text-ink">{patient.name}</p>
            <p className="text-[13px] leading-snug text-muted-foreground">
              {patient.age} · {patient.conditions.join(", ")}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell className="py-3 whitespace-normal">
        <p className="text-ink">{caregiver.name}</p>
        <p className="text-[13px] text-muted-foreground">{caregiver.relationship}</p>
      </TableCell>
      <TableCell className="py-3 whitespace-normal">
        <FlagChips checkIn={checkIn} className="max-w-[210px]" />
        {checkIn.isEmergency && <span className="sr-only">Emergency terms in this check-in.</span>}
      </TableCell>
      <TableCell className="py-3">
        <Sparkline points={row.series} tier={checkIn.riskTier} label="14-day risk trend" />
      </TableCell>
      <TableCell className="py-3">
        <p className="text-[13px] text-body-2">
          <time dateTime={checkIn.createdAt} title={formatDayTime(checkIn.createdAt)}>
            {formatRelative(checkIn.createdAt)}
          </time>
        </p>
        <StatusBadge status={checkIn.status} className="mt-1" />
      </TableCell>
      <TableCell className="py-3 pr-5 text-right">
        <Button asChild variant={isNew ? "default" : "outline"} className="min-w-[72px]">
          <Link to={patientPath(patient.id)}>
            {isNew ? "Review" : "Open"}
            <span className="sr-only"> {patient.name}</span>
            {isNew && <ChevronRight aria-hidden />}
          </Link>
        </Button>
      </TableCell>
    </TableRow>
  );
}

function QueueCard({
  filter,
  sort,
  onFilter,
  onSort,
}: {
  filter: QueueFilter;
  sort: QueueSort;
  onFilter: (filter: QueueFilter) => void;
  onSort: (sort: QueueSort) => void;
}) {
  const queue = useQueue(filter, sort);
  const counts = queue.data?.stats.counts;
  const rows = queue.data?.rows;

  return (
    <section aria-label="Triage queue" className="overflow-hidden rounded-card border border-border bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div role="group" aria-label="Filter the queue" className="flex flex-wrap gap-2">
          {FILTERS.map((option) => {
            const active = option.value === filter;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() => onFilter(option.value)}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-control border px-3 text-[15px] font-medium transition-colors",
                  active ? "border-ink bg-ink text-on-ink" : "border-border bg-surface text-ink hover:bg-sage-50",
                )}
              >
                {option.label}
                <span className={cn("tabular-nums", active ? "text-on-ink" : "text-body-2")}>
                  {counts ? counts[option.value] : ""}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-3">
          <label htmlFor="queue-sort" className="text-[13px] text-muted-foreground">
            Sort by
          </label>
          <select
            id="queue-sort"
            value={sort}
            onChange={(event) => onSort(queueSortSchema.parse(event.target.value))}
            className="h-10 min-w-[170px] rounded-control border border-border bg-surface px-3 text-[15px] text-ink"
          >
            {SORTS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Table className="min-w-[940px]" aria-busy={queue.isFetching && queue.isPlaceholderData}>
        <TableHeader className="bg-table-head">
          <TableRow className="border-t hover:bg-transparent">
            <TableHead className="h-10 w-[92px] pl-5 text-[13px] font-normal text-muted-foreground">
              <RiskHeader />
            </TableHead>
            <TableHead className="w-[230px] text-[13px] font-normal text-muted-foreground">Patient</TableHead>
            <TableHead className="w-[130px] text-[13px] font-normal text-muted-foreground">Caregiver</TableHead>
            <TableHead className="w-[210px] text-[13px] font-normal text-muted-foreground">Why flagged</TableHead>
            <TableHead className="w-[120px] text-[13px] font-normal text-muted-foreground">14-day trend</TableHead>
            <TableHead className="w-[128px] text-[13px] font-normal text-muted-foreground">Last check-in</TableHead>
            <TableHead className="pr-5 text-right text-[13px] font-normal text-muted-foreground">
              <span className="sr-only">Action</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {!rows &&
            Array.from({ length: 5 }, (_, index) => (
              <TableRow key={index} className="hover:bg-transparent">
                <TableCell colSpan={7} className="px-5 py-3">
                  <Skeleton className="h-10 w-full" />
                </TableCell>
              </TableRow>
            ))}
          {rows?.length === 0 && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={7} className="px-5 py-8 text-center text-muted-foreground">
                No patients match this filter.
              </TableCell>
            </TableRow>
          )}
          {rows?.map((row) => <QueueTableRow key={row.patient.id} row={row} />)}
        </TableBody>
      </Table>

      <p className="border-t border-border bg-table-head px-5 py-3 text-[13px] text-muted-foreground">
        AI ranking supports triage only. Clinical decisions remain with the nurse.
      </p>
    </section>
  );
}

// --- Top patient cards -----------------------------------------------------

/** Two insight rows, those about the charted domains first. */
function topInsights(insights: Insight[]): Insight[] {
  const charted = (insight: Insight) => (COMPARED_DOMAINS as readonly string[]).includes(insight.domain);
  return [...insights.filter(charted), ...insights.filter((insight) => !charted(insight))].slice(0, 2);
}

function ChangesFromBaselineCard({ row }: { row: QueueRow }) {
  const trends = useTrends(row.patient.id, BASELINE_CHART_DAYS);
  const detail = usePatient(row.patient.id);

  return (
    <section
      aria-labelledby="baseline-title"
      className="flex flex-col rounded-card border border-border bg-surface px-6 py-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="baseline-title" className="text-card-title font-medium text-ink">
            Changes from baseline
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {row.patient.name} · last {BASELINE_CHART_DAYS} days · severity 0–3
          </p>
        </div>
        <BaselineLegend domains={COMPARED_DOMAINS} />
      </div>
      <div className="mt-4">
        {trends.data ? (
          <BaselineChart trends={trends.data} domains={COMPARED_DOMAINS} />
        ) : (
          <Skeleton className="h-[220px] w-full" />
        )}
      </div>
      <div className="mt-4">
        {detail.data ? (
          <InsightList insights={topInsights(detail.data.insights)} />
        ) : (
          <Skeleton className="h-12 w-full" />
        )}
      </div>
    </section>
  );
}

function LatestCheckInCard({ row }: { row: QueueRow }) {
  const { patient, caregiver, latestCheckIn: checkIn } = row;

  return (
    <section
      aria-labelledby="latest-title"
      className="flex flex-col rounded-card border border-border bg-surface px-6 py-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="latest-title" className="text-card-title font-medium text-ink">
            Latest check-in
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {patient.name} · from {firstNameOf(caregiver.name)} ({caregiver.relationship.toLowerCase()}) ·{" "}
            {formatDayTime(checkIn.createdAt)} · {formatDuration(checkIn.durationSec)}
          </p>
        </div>
        <TierChip tier={checkIn.riskTier} score={checkIn.riskScore} className="shrink-0" />
      </div>

      {checkIn.isEmergency && <EmergencyNotice audience="nurse" className="mt-4" />}

      <AiSummaryPanel className="mt-4">{checkIn.aiSummary}</AiSummaryPanel>

      <h3 className="mt-5 text-xs font-semibold tracking-wide text-body-2 uppercase">Transcript</h3>
      <HighlightedTranscript transcript={checkIn.transcript} domains={checkIn.domains} className="mt-2" />

      <CheckInActions patient={patient} caregiver={caregiver} checkIn={checkIn} className="mt-5" />
    </section>
  );
}

// --- Page ------------------------------------------------------------------

function exportQueue(rows: QueueRow[], filter: QueueFilter) {
  const csv = toCsv(
    ["Rank", "Risk score", "Tier", "Patient", "Age", "Conditions", "Caregiver", "Relationship", "Why flagged", "Last check-in", "Status"],
    rows.map(({ rank, patient, caregiver, latestCheckIn: checkIn }) => [
      rank,
      checkIn.riskScore,
      checkIn.riskTier,
      patient.name,
      patient.age,
      patient.conditions.join("; "),
      caregiver.name,
      caregiver.relationship,
      checkIn.flags.join("; ") || "No changes",
      checkIn.createdAt,
      { received: "New", reviewed: "Reviewed", guidance_sent: "Guidance sent" }[checkIn.status],
    ]),
  );
  const day = new Date().toISOString().slice(0, 10);
  downloadText(`triage-queue-${filter}-${day}.csv`, csv);
}

/** `/nurse`: the ranked triage queue. */
export function TriageQueuePage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const filter = queueFilterSchema.catch("all").parse(params.get("filter") ?? undefined);
  const sort = queueSortSchema.catch("risk").parse(params.get("sort") ?? undefined);

  // The risk-ordered queue, shared with the sidebar: stats, rounds and the top patient.
  const ranked = useQueue("all", "risk");
  const current = useQueue(filter, sort);
  const top = ranked.data?.rows[0];
  const nextUnreviewed = ranked.data?.rows.find((row) => row.latestCheckIn.status === "received");

  function update(key: "filter" | "sort", value: string, fallback: string) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value === fallback) next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true },
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PageTitle
        className="mb-1"
        title="Triage queue"
        subtitle={`${formatLongDate()} · Ranked by check-in content, red-flag rules and change from each patient's own baseline`}
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              disabled={!current.data}
              onClick={() => current.data && exportQueue(current.data.rows, filter)}
            >
              Export
            </Button>
            <Button
              type="button"
              disabled={!nextUnreviewed}
              onClick={() => nextUnreviewed && void navigate(patientPath(nextUnreviewed.patient.id))}
            >
              Start rounds
              <ChevronRight aria-hidden />
            </Button>
          </>
        }
      />

      <StatCards stats={ranked.data?.stats} />

      <QueueCard
        filter={filter}
        sort={sort}
        onFilter={(value) => update("filter", value, "all")}
        onSort={(value) => update("sort", value, "risk")}
      />

      {top ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <ChangesFromBaselineCard row={top} />
          <LatestCheckInCard row={top} />
        </div>
      ) : (
        ranked.isPending && (
          <div className="grid gap-5 lg:grid-cols-2">
            <Skeleton className="h-[420px] rounded-card" />
            <Skeleton className="h-[420px] rounded-card" />
          </div>
        )
      )}
    </div>
  );
}
