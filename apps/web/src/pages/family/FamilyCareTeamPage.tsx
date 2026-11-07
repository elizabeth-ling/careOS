import type { Message } from "@careos/shared";
import { Check, Loader2 } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { useCreateCallRequest, useMessages, useSendMessage } from "@/api/hooks";
import { EmergencyNotice } from "@/components/EmergencyNotice";
import { SubPageHeader } from "@/components/family/SubPageHeader";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useDemoIdentity } from "@/demo";
import { firstNameOf, formatDayTime, formatWeekdayAt, initialsOf } from "@/lib/format";
import { cn } from "@/lib/utils";

const MAX_TIMES = 3;
const SLOT_HOURS = [10, 14, 16];
const SLOT_DAYS = 3;

/** Call slots on the next few weekdays, at a few set hours. */
function upcomingSlots(now = new Date()): string[][] {
  const days: string[][] = [];
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  while (days.length < SLOT_DAYS) {
    day.setDate(day.getDate() + 1);
    if (day.getDay() === 0 || day.getDay() === 6) continue;
    days.push(SLOT_HOURS.map((hour) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour).toISOString()));
  }
  return days;
}

export function FamilyCareTeamPage() {
  const identity = useDemoIdentity();

  if (!identity.data) {
    return (
      <>
        <SubPageHeader title="Contact care team" />
        <Skeleton className="h-96 w-full" />
      </>
    );
  }

  const { nurse, careHome, heroPatientId } = identity.data;
  const nurseFirst = firstNameOf(nurse.name);

  return (
    <>
      <SubPageHeader title="Contact care team" />
      <div className="flex flex-col gap-5">
        <section aria-label="Your nurse" className="flex items-center gap-4 rounded-card border border-border bg-surface p-5">
          <Avatar className="size-14">
            <AvatarFallback className="text-lg">{initialsOf(nurse.name)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-xl font-medium text-ink">
              {nurse.name}, {nurse.credentials}
            </p>
            <p className="text-[15px] text-body-2">{careHome.name}</p>
            <p className="text-sm text-muted-foreground">Usually replies within 4 hours</p>
          </div>
        </section>

        <MessageSection patientId={heroPatientId} nurseFirst={nurseFirst} />
        <CallRequestSection patientId={heroPatientId} nurseFirst={nurseFirst} />

        <EmergencyNotice variant="reminder" className="text-[15px]" />
      </div>
    </>
  );
}

function MessageSection({ patientId, nurseFirst }: { patientId: string; nurseFirst: string }) {
  const messages = useMessages(patientId);
  const send = useSendMessage();
  const [body, setBody] = useState("");
  const inputId = useId();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    send.mutate(
      { patientId, fromRole: "family", body },
      {
        onSuccess: () => {
          setBody("");
          toast.success(`Message sent to Nurse ${nurseFirst}`);
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  return (
    <section aria-labelledby="message-heading" className="rounded-card border border-border bg-surface p-5 sm:p-6">
      <h2 id="message-heading" className="text-card-title font-medium text-ink">
        Message
      </h2>
      <form onSubmit={submit} className="mt-3 flex flex-col gap-3">
        <label htmlFor={inputId} className="text-[15px] text-body-2">
          Write to Nurse {nurseFirst}. For anything urgent, call 911.
        </label>
        <Textarea
          id={inputId}
          value={body}
          maxLength={5000}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Type your message…"
          className="min-h-24 text-base md:text-base"
        />
        <Button type="submit" className="h-11 self-end px-6" disabled={send.isPending || !body.trim()}>
          {send.isPending && <Loader2 className="animate-spin" aria-hidden />}
          {send.isPending ? "Sending…" : "Send"}
        </Button>
      </form>

      <h3 className="mt-5 mb-3 text-sm font-medium text-body-2">Your messages</h3>
      {!messages.data ? (
        <Skeleton className="h-20 w-full" />
      ) : messages.data.length === 0 ? (
        <p className="text-[15px] text-muted-foreground">No messages yet.</p>
      ) : (
        <ul className="flex max-h-[420px] flex-col gap-3 overflow-y-auto">
          {messages.data.map((message) => (
            <Bubble key={message.id} message={message} />
          ))}
        </ul>
      )}
    </section>
  );
}

function Bubble({ message }: { message: Message }) {
  const mine = message.fromRole === "family";
  return (
    <li className={cn("flex max-w-[85%] flex-col", mine ? "self-end items-end" : "self-start items-start")}>
      <p className="mb-1 text-xs text-muted-foreground">
        {mine ? "You" : message.authorName} · {formatDayTime(message.createdAt)}
      </p>
      <p
        className={cn(
          "rounded-panel px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-line",
          mine ? "bg-sage-50 text-ink" : "bg-canvas text-ink",
        )}
      >
        {message.body}
      </p>
    </li>
  );
}

function CallRequestSection({ patientId, nurseFirst }: { patientId: string; nurseFirst: string }) {
  const days = useMemo(() => upcomingSlots(), []);
  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);
  const create = useCreateCallRequest();
  const noteId = useId();

  function toggle(slot: string) {
    setSent(false);
    setPicked((current) =>
      current.includes(slot) ? current.filter((s) => s !== slot) : current.length < MAX_TIMES ? [...current, slot] : current,
    );
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (picked.length === 0) return;
    create.mutate(
      { patientId, preferredTimes: [...picked].sort(), note },
      {
        onSuccess: () => {
          setPicked([]);
          setNote("");
          setSent(true);
          toast.success(`Call requested. Nurse ${nurseFirst} will confirm a time.`);
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  return (
    <section aria-labelledby="call-heading" className="rounded-card border border-border bg-surface p-5 sm:p-6">
      <h2 id="call-heading" className="text-card-title font-medium text-ink">
        Request a call
      </h2>
      <form onSubmit={submit} className="mt-3 flex flex-col gap-4">
        <fieldset>
          <legend className="text-[15px] text-body-2">
            Pick up to {MAX_TIMES} times that suit you. {picked.length > 0 && `(${picked.length} of ${MAX_TIMES} picked)`}
          </legend>
          <div className="mt-3 flex flex-col gap-3">
            {days.map((slots) => (
              <div key={slots[0]} className="flex flex-wrap items-center gap-2">
                <span className="w-full text-sm font-medium text-ink sm:w-28">
                  {new Date(slots[0]!).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                </span>
                {slots.map((slot) => {
                  const on = picked.includes(slot);
                  const full = !on && picked.length >= MAX_TIMES;
                  return (
                    <button
                      key={slot}
                      type="button"
                      aria-pressed={on}
                      aria-label={formatWeekdayAt(slot)}
                      disabled={full}
                      onClick={() => toggle(slot)}
                      className={cn(
                        "inline-flex h-11 min-w-24 items-center justify-center gap-1.5 rounded-control border px-3 text-[15px] font-medium transition-colors disabled:opacity-50",
                        on ? "border-brand bg-brand text-on-ink" : "border-border bg-surface text-ink hover:bg-sage-50",
                      )}
                    >
                      {on && <Check className="size-4" aria-hidden />}
                      {new Date(slot).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-col gap-2">
          <label htmlFor={noteId} className="text-sm font-medium text-ink">
            What would you like to talk about? <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <Textarea
            id={noteId}
            value={note}
            maxLength={5000}
            onChange={(event) => setNote(event.target.value)}
            className="min-h-20 text-base md:text-base"
          />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-4">
          {sent && (
            <p className="text-[15px] text-body-2" role="status">
              Requested. See it in{" "}
              <Link to="/family/calendar" className="font-medium text-brand underline underline-offset-4">
                Calendar
              </Link>
              .
            </p>
          )}
          <Button type="submit" className="h-11 px-6" disabled={create.isPending || picked.length === 0}>
            {create.isPending && <Loader2 className="animate-spin" aria-hidden />}
            {create.isPending ? "Requesting…" : "Request a call"}
          </Button>
        </div>
      </form>
    </section>
  );
}
