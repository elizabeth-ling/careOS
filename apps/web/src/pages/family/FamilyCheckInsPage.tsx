import { DOMAIN_KEYS, DOMAIN_LABELS, type CheckIn, type NurseAction } from "@careos/shared";
import { Check } from "lucide-react";
import { useCheckIns, useNurseActions } from "@/api/hooks";
import { EmergencyNotice } from "@/components/EmergencyNotice";
import { SubPageHeader } from "@/components/family/SubPageHeader";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useDemoIdentity } from "@/demo";
import { firstNameOf, formatDayTime, formatDuration, initialsOf, joinWithAnd } from "@/lib/format";
import { cn } from "@/lib/utils";

/** "You talked about eating, memory and how you're doing." From the topics the check-in touched. */
function plainSummary(checkIn: CheckIn): string {
  const topics = DOMAIN_KEYS.filter((key) => checkIn.domains[key].quote !== null).map((key) =>
    key === "caregiverStrain" ? "how you're doing" : DOMAIN_LABELS[key].toLowerCase(),
  );
  return topics.length > 0 ? `You talked about ${joinWithAnd(topics)}.` : "A general update.";
}

const STEPS_DONE: Record<CheckIn["status"], number> = { received: 1, reviewed: 2, guidance_sent: 3 };

export function FamilyCheckInsPage() {
  const identity = useDemoIdentity();
  const patientId = identity.data?.heroPatientId;
  const checkIns = useCheckIns(patientId);
  // Polls, so the nurse's reply appears here without a reload.
  const actions = useNurseActions(patientId, { poll: true });
  const nurse = identity.data ? firstNameOf(identity.data.nurse.name) : "";

  const replies = new Map<string, NurseAction>();
  // Actions arrive newest first; keep the latest guidance per check-in.
  for (const action of actions.data ?? []) {
    if (action.type === "guidance" && action.checkInId && !replies.has(action.checkInId)) {
      replies.set(action.checkInId, action);
    }
  }

  return (
    <>
      <SubPageHeader title="Check-ins" />
      {!checkIns.data || !identity.data ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : checkIns.data.length === 0 ? (
        <p className="rounded-card border border-border bg-surface p-6 text-body-2">
          No check-ins yet. Go back home and tap the mic to send your first.
        </p>
      ) : (
        <ol className="flex flex-col gap-4">
          {checkIns.data.map((checkIn) => (
            <CheckInItem key={checkIn.id} checkIn={checkIn} reply={replies.get(checkIn.id)} nurse={nurse} />
          ))}
        </ol>
      )}
    </>
  );
}

function CheckInItem({ checkIn, reply, nurse }: { checkIn: CheckIn; reply?: NurseAction; nurse: string }) {
  return (
    <li className="rounded-card border border-border bg-surface p-5 sm:p-6">
      <p className="text-sm text-muted-foreground">
        {formatDayTime(checkIn.createdAt)} · {formatDuration(checkIn.durationSec)}
      </p>
      {checkIn.isEmergency && <EmergencyNotice className="mt-3" />}
      <p className="mt-1 text-base text-ink">{plainSummary(checkIn)}</p>
      <p className="mt-1 text-xs text-muted-foreground">AI summary · verify against transcript</p>
      <details className="mt-1 text-sm">
        <summary className="inline-flex min-h-11 cursor-pointer items-center rounded-control font-medium text-brand">
          Show what you said
        </summary>
        <p className="mt-1 rounded-panel border border-border px-4 py-3 leading-relaxed text-body-2">{checkIn.transcript}</p>
      </details>

      <Stepper done={STEPS_DONE[checkIn.status]} nurse={nurse} />

      {reply ? (
        <div className="mt-5 flex gap-3 rounded-panel bg-canvas p-4">
          <Avatar className="size-9 shrink-0">
            <AvatarFallback>{initialsOf(reply.nurseName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm">
              <span className="font-semibold text-ink">Nurse {firstNameOf(reply.nurseName)}</span>{" "}
              <span className="text-muted-foreground">· {formatDayTime(reply.createdAt)}</span>
            </p>
            <p className="mt-1 text-[15px] leading-relaxed whitespace-pre-line text-ink">{reply.body}</p>
          </div>
        </div>
      ) : (
        checkIn.status === "received" && (
          <p className="mt-4 text-sm text-body-2">Nurse {nurse} usually replies within 4 hours.</p>
        )
      )}
    </li>
  );
}

/** Received → Reviewed by Nurse Priya → Guidance sent. */
function Stepper({ done, nurse }: { done: number; nurse: string }) {
  const steps = ["Received", `Reviewed by Nurse ${nurse}`, "Guidance sent"];
  return (
    <ol className="mt-4 flex items-start" aria-label="Progress">
      {steps.map((label, i) => {
        const isDone = i < done;
        return (
          <li key={label} className="relative flex flex-1 flex-col items-center text-center">
            {i > 0 && (
              <span
                aria-hidden
                className={cn("absolute top-3 right-1/2 h-0.5 w-full -translate-y-1/2", isDone ? "bg-brand" : "bg-sage-200")}
              />
            )}
            <span
              className={cn(
                "relative flex size-6 items-center justify-center rounded-full",
                isDone ? "bg-brand text-on-ink" : "border-2 border-sage-200 bg-surface",
              )}
            >
              {isDone && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
            </span>
            <span className={cn("mt-2 px-1 text-[13px] leading-snug", isDone ? "text-ink" : "text-muted-foreground")}>
              {label}
              <span className="sr-only">{isDone ? " (done)" : " (not yet)"}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
