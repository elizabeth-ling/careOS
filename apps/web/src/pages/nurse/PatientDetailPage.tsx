import {
  DOMAIN_KEYS,
  type CheckIn,
  type Message,
  type NurseAction,
  type PatientDetailResponse,
} from "@careos/shared";
import { ChevronLeft, FileText, Loader2, Mic, Play } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";
import {
  useCheckIns,
  useGenerateCallNote,
  useMarkMessagesRead,
  useMessages,
  useNurseActions,
  usePatient,
  useSendMessage,
  useTrends,
} from "@/api/hooks";
import { AiSummaryPanel } from "@/components/AiSummaryPanel";
import { EmergencyNotice } from "@/components/EmergencyNotice";
import { HighlightedTranscript } from "@/components/HighlightedTranscript";
import { CheckInActions } from "@/components/nurse/CheckInActions";
import { FlagChips } from "@/components/nurse/FlagChips";
import { InsightList } from "@/components/nurse/InsightList";
import { DomainMiniChart } from "@/components/nurse/SeverityCharts";
import { PageTitle } from "@/components/PageTitle";
import { RiskPill } from "@/components/RiskPill";
import { StatusBadge } from "@/components/StatusBadge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/api/api";
import { firstNameOf, formatDayTime, formatDuration, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

const TREND_DAYS = 42;
const VOX_SOURCE = "vox_advantage";

function Card({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={cn("rounded-card border border-border bg-surface px-5 py-4", className)}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 id={id} className="text-card-title font-medium text-ink">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

// --- Header ----------------------------------------------------------------

function HeaderCard({ detail, checkIn }: { detail: PatientDetailResponse; checkIn: CheckIn | null }) {
  const { patient, caregiver, careHome } = detail;
  return (
    <section aria-label="Patient" className="rounded-card border border-border bg-surface px-6 py-5">
      <Link
        to="/nurse"
        className="inline-flex items-center gap-1 rounded-control text-sm font-medium text-brand hover:text-brand-deep"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Triage queue
      </Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-5">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar className="size-14">
            <AvatarFallback className="text-lg">{patient.initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <PageTitle className="mb-0" title={patient.name} />
            <p className="mt-1 text-sm text-body-2">
              {patient.age} · {patient.conditions.join(", ")} · Caregiver: {caregiver.name} (
              {caregiver.relationship.toLowerCase()}) · {careHome.name}
            </p>
            {checkIn && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <RiskPill score={checkIn.riskScore} />
                <FlagChips checkIn={checkIn} max={4} />
              </div>
            )}
          </div>
        </div>
      </div>
      <CheckInActions patient={patient} caregiver={caregiver} checkIn={checkIn} className="mt-5">
        <Button asChild variant="outline">
          <Link to={`/summary/${patient.id}`}>
            <FileText aria-hidden />
            Generate care summary
          </Link>
        </Button>
      </CheckInActions>
    </section>
  );
}

// --- Left column -----------------------------------------------------------

function SummaryCard({ checkIn, detail }: { checkIn: CheckIn; detail: PatientDetailResponse }) {
  const isLatest = detail.latestCheckIn?.id === checkIn.id;
  return (
    <Card
      title="AI summary"
      description={`${isLatest ? "Latest check-in" : "Earlier check-in"} · from ${firstNameOf(detail.caregiver.name)} · ${formatDayTime(checkIn.createdAt)} · ${formatDuration(checkIn.durationSec)}`}
      action={<StatusBadge status={checkIn.status} />}
    >
      {checkIn.isEmergency && <EmergencyNotice audience="nurse" className="mb-3" />}
      <AiSummaryPanel>{checkIn.aiSummary}</AiSummaryPanel>
    </Card>
  );
}

function DomainTrendsCard({ patientId, flagged }: { patientId: string; flagged: Set<string> }) {
  const trends = useTrends(patientId, TREND_DAYS);
  return (
    <Card title="Domain trends" description="Severity 0–3 over 6 weeks. Shaded: this patient's baseline.">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {trends.data
          ? DOMAIN_KEYS.map((key) => (
              <DomainMiniChart
                key={key}
                domain={key}
                points={trends.data.domains[key]}
                baseline={trends.data.baselines[key]}
                flagged={flagged.has(key)}
              />
            ))
          : DOMAIN_KEYS.map((key) => <Skeleton key={key} className="h-[92px] rounded-panel" />)}
      </div>
    </Card>
  );
}

function TranscriptCard({ checkIn }: { checkIn: CheckIn }) {
  return (
    <Card title="Transcript" description={`${formatDayTime(checkIn.createdAt)} · ${formatDuration(checkIn.durationSec)}`}>
      {checkIn.audioUrl ? (
        <audio
          controls
          preload="metadata"
          src={checkIn.audioUrl}
          className="mb-4 w-full"
          aria-label={`Check-in recording, ${formatDuration(checkIn.durationSec)}`}
        />
      ) : (
        <div className="mb-4 flex items-center gap-3 rounded-panel border border-border bg-table-head px-3 py-2.5">
          <span className="flex size-8 items-center justify-center rounded-full bg-sage-100 text-brand-deep" aria-hidden>
            <Play className="size-3.5" />
          </span>
          <span className="h-1 flex-1 rounded-full bg-sage-100" aria-hidden />
          <span className="text-[13px] text-muted-foreground tabular-nums">{formatDuration(checkIn.durationSec)}</span>
          <span className="sr-only">No audio was stored for this check-in. The transcript is below.</span>
        </div>
      )}
      <HighlightedTranscript transcript={checkIn.transcript} domains={checkIn.domains} />
    </Card>
  );
}

// --- Right column ----------------------------------------------------------

function CaregiverCard({ patientId, checkIn, caregiverName }: { patientId: string; checkIn: CheckIn; caregiverName: string }) {
  const trends = useTrends(patientId, TREND_DAYS);
  const strain = checkIn.domains.caregiverStrain;
  return (
    <Card title="Caregiver wellbeing" description={`${caregiverName} · caregiver strain, 6 weeks`}>
      {trends.data ? (
        <DomainMiniChart
          domain="caregiverStrain"
          label="Caregiver strain"
          points={trends.data.domains.caregiverStrain}
          baseline={trends.data.baselines.caregiverStrain}
          flagged={strain.severity >= 2}
          height={64}
        />
      ) : (
        <Skeleton className="h-[100px] rounded-panel" />
      )}
      <AiSummaryPanel className="mt-3 px-4 py-3">
        {strain.summary}
        {strain.quote && <span className="mt-1 block text-sm text-body-2">“{strain.quote}”</span>}
      </AiSummaryPanel>
    </Card>
  );
}

function HistoryCard({
  checkIns,
  selectedId,
  onSelect,
}: {
  checkIns: CheckIn[] | undefined;
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}) {
  return (
    <Card title="Check-in history" description={checkIns ? `${checkIns.length} check-ins` : undefined}>
      {!checkIns ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <ul className="-mx-2 flex max-h-[360px] flex-col gap-0.5 overflow-y-auto px-2 py-0.5">
          {checkIns.map((checkIn) => {
            const selected = checkIn.id === selectedId;
            return (
              <li key={checkIn.id}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onSelect(checkIn.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-panel px-2 py-2 text-left transition-colors",
                    selected ? "bg-sage-50" : "hover:bg-table-head",
                  )}
                >
                  <RiskPill score={checkIn.riskScore} className="h-6 min-w-9 text-[13px]" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium text-ink">{formatDayTime(checkIn.createdAt)}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {checkIn.flags.length > 0 ? checkIn.flags.join(", ") : "No changes"}
                    </span>
                  </span>
                  <StatusBadge status={checkIn.status} className="h-5 px-1.5 text-xs" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

const ACTION_LABEL: Record<NurseAction["type"], string> = {
  guidance: "Guidance sent",
  call_scheduled: "Call scheduled",
  call_note: "Call note",
  reviewed: "Check-in reviewed",
};

function CareNote({ action }: { action: NurseAction }) {
  const fromVox = action.source === VOX_SOURCE;
  const body = action.sections ? (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
      {(
        [
          ["Reason", action.sections.reason],
          ["Assessment", action.sections.assessment],
          ["Plan", action.sections.plan],
          ["Follow-up", action.sections.followUp],
        ] as const
      ).map(([term, value]) => (
        <div key={term} className="contents">
          <dt className="font-semibold text-ink">{term}</dt>
          <dd className="text-body-2">{value}</dd>
        </div>
      ))}
    </dl>
  ) : action.type === "reviewed" ? null : (
    action.body && <p className="text-[13px] text-body-2">{action.body}</p>
  );

  return (
    <li className="relative pb-4 pl-5 last:pb-0">
      <span className="absolute top-1.5 left-0 size-2 rounded-full bg-brand" aria-hidden />
      <span className="absolute top-4 bottom-0 left-[3.5px] w-px bg-border" aria-hidden />
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-sm font-medium text-ink">
          {ACTION_LABEL[action.type]}
          {action.scheduledFor && ` for ${formatDayTime(action.scheduledFor)}`}
        </span>
        {fromVox && (
          <span className="inline-flex h-5 items-center rounded-control bg-info-bg px-1.5 text-xs font-medium text-info">
            Documented via Vox Advantage
          </span>
        )}
      </div>
      <p className="mb-1 text-xs text-muted-foreground">
        {action.nurseName} · <time dateTime={action.createdAt}>{formatRelative(action.createdAt)}</time>
      </p>
      {body && fromVox ? <AiSummaryPanel className="px-3 py-2.5">{body}</AiSummaryPanel> : body}
    </li>
  );
}

function CareNotesCard({ patientId }: { patientId: string }) {
  const actions = useNurseActions(patientId);
  const vox = useGenerateCallNote();

  function documentCall() {
    vox.mutate(patientId, { onSuccess: () => toast.success("Call note added to care notes") });
  }

  return (
    <Card title="Care notes">
      <div aria-live="polite">
        {vox.isPending && (
          <p className="mb-3 flex items-center gap-2 rounded-panel bg-info-bg px-3 py-2 text-[13px] text-info">
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
            Transcribing call…
          </p>
        )}
      </div>
      {!actions.data ? (
        <Skeleton className="h-32 w-full" />
      ) : actions.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No care notes yet.</p>
      ) : (
        <ol className="max-h-[420px] overflow-y-auto">
          {actions.data.map((action) => (
            <CareNote key={action.id} action={action} />
          ))}
        </ol>
      )}
      <Button type="button" variant="outline" className="mt-4 w-full" disabled={vox.isPending} onClick={documentCall}>
        {vox.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Mic aria-hidden />}
        {vox.isPending ? "Transcribing call…" : "Document call with Vox Advantage"}
      </Button>
    </Card>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const fromNurse = message.fromRole === "nurse";
  return (
    <li className={cn("flex flex-col", fromNurse ? "items-end" : "items-start")}>
      <p
        className={cn(
          "max-w-[85%] rounded-panel px-3 py-2 text-[13px] leading-snug",
          fromNurse ? "bg-sage-50 text-ink" : "border border-border bg-surface text-ink",
        )}
      >
        {message.body}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {message.authorName} · <time dateTime={message.createdAt}>{formatRelative(message.createdAt)}</time>
      </p>
    </li>
  );
}

function MessagesCard({ patientId, caregiverName }: { patientId: string; caregiverName: string }) {
  const messages = useMessages(patientId);
  const markRead = useMarkMessagesRead();
  const send = useSendMessage();
  const [body, setBody] = useState("");
  const inputId = useId();
  // The newest unread family message this view has already tried to mark read.
  const markedUpTo = useRef<string | null>(null);
  const markReadMutate = markRead.mutate;

  const newestUnread = messages.data
    ?.filter((message) => message.fromRole === "family" && message.readAt === null)
    .at(-1)?.id;

  // Viewing the thread marks the family's messages read (and clears the sidebar badge).
  // One attempt per new unread message, so a failing request doesn't retry on every render.
  useEffect(() => {
    if (!newestUnread || markedUpTo.current === newestUnread) return;
    markedUpTo.current = newestUnread;
    markReadMutate(patientId);
  }, [newestUnread, patientId, markReadMutate]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    send.mutate(
      { patientId, fromRole: "nurse", body },
      {
        onSuccess: () => {
          setBody("");
          toast.success(`Message sent to ${firstNameOf(caregiverName)}`);
        },
      },
    );
  }

  return (
    <Card title="Messages from family">
      {!messages.data ? (
        <Skeleton className="h-24 w-full" />
      ) : messages.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No messages yet.</p>
      ) : (
        <ul className="flex max-h-[320px] flex-col gap-3 overflow-y-auto">
          {messages.data.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
        </ul>
      )}
      <form onSubmit={submit} className="mt-4 flex flex-col gap-2">
        <label htmlFor={inputId} className="text-sm font-medium text-ink">
          Reply to {firstNameOf(caregiverName)}
        </label>
        <Textarea
          id={inputId}
          value={body}
          maxLength={5000}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Write a reply…"
          className="min-h-20"
        />
        <Button type="submit" className="self-end" disabled={send.isPending || !body.trim()}>
          {send.isPending && <Loader2 className="animate-spin" aria-hidden />}
          {send.isPending ? "Sending…" : "Send reply"}
        </Button>
      </form>
    </Card>
  );
}

// --- Page ------------------------------------------------------------------

/** `/nurse/patients/:id`: one patient's check-ins, trends, care notes and messages. */
export function PatientDetailPage() {
  const { id } = useParams();
  const detail = usePatient(id);
  const checkIns = useCheckIns(id);
  const [selectedId, setSelectedId] = useState<string>();

  // A new patient starts on their latest check-in.
  useEffect(() => setSelectedId(undefined), [id]);

  if (detail.isError) {
    const missing = detail.error instanceof ApiError && (detail.error.status === 404 || detail.error.status === 400);
    return (
      <div className="flex flex-col gap-4">
        <PageTitle
          title={missing ? "Patient not found" : "Couldn't load this patient"}
          subtitle={missing ? "There's no patient at this address." : "Please try again in a moment."}
        />
        <Link to="/nurse" className="inline-flex items-center gap-1 font-medium text-brand hover:underline">
          <ChevronLeft className="size-4" aria-hidden />
          Triage queue
        </Link>
      </div>
    );
  }

  if (!detail.data || !id) {
    return (
      <div className="flex flex-col gap-5" aria-busy="true">
        <Skeleton className="h-[200px] rounded-card" />
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Skeleton className="h-[480px] rounded-card" />
          <Skeleton className="h-[480px] rounded-card" />
        </div>
      </div>
    );
  }

  const data = detail.data;
  const selected =
    (selectedId && checkIns.data?.find((checkIn) => checkIn.id === selectedId)) || data.latestCheckIn;
  const flagged = new Set(data.insights.map((insight) => insight.domain));

  return (
    <div className="flex flex-col gap-5">
      <HeaderCard detail={data} checkIn={selected} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-5">
          {selected ? (
            <SummaryCard checkIn={selected} detail={data} />
          ) : (
            <Card title="AI summary">
              <p className="text-sm text-muted-foreground">No check-ins yet.</p>
            </Card>
          )}
          <Card title="Changes from baseline" description="Compared with this patient's own last 14 days">
            <InsightList insights={data.insights} />
          </Card>
          <DomainTrendsCard patientId={id} flagged={flagged} />
          {selected && <TranscriptCard checkIn={selected} />}
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          {selected && <CaregiverCard patientId={id} checkIn={selected} caregiverName={data.caregiver.name} />}
          <HistoryCard checkIns={checkIns.data} selectedId={selected?.id} onSelect={setSelectedId} />
          <CareNotesCard patientId={id} />
          <MessagesCard patientId={id} caregiverName={data.caregiver.name} />
        </div>
      </div>
    </div>
  );
}
