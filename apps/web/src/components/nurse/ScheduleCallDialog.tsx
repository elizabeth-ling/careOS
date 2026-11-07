import type { Caregiver, Patient } from "@careos/shared";
import { Loader2 } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { useCallRequests, useConfirmCallRequest, useScheduleCall } from "@/api/hooks";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { firstNameOf } from "@/lib/format";

interface ScheduleCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: Patient;
  caregiver: Caregiver;
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** yyyy-mm-dd for a date input, in local time. */
function dateInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function tomorrow(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return dateInputValue(date);
}

/** Schedule a call with the caregiver, or confirm one of the family's pending call requests. */
export function ScheduleCallDialog({ open, onOpenChange, patient, caregiver }: ScheduleCallDialogProps) {
  const requests = useCallRequests(open ? patient.id : undefined);
  const schedule = useScheduleCall();
  const confirm = useConfirmCallRequest();
  const [date, setDate] = useState(tomorrow);
  const [time, setTime] = useState("10:00");
  const [note, setNote] = useState("");
  const id = useId();
  const caregiverFirst = firstNameOf(caregiver.name);

  const pending = requests.data?.filter((request) => request.status === "requested") ?? [];

  function reset() {
    setDate(tomorrow());
    setTime("10:00");
    setNote("");
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const when = new Date(`${date}T${time}`);
    if (Number.isNaN(when.getTime())) {
      toast.error("Choose a valid date and time.");
      return;
    }
    schedule.mutate(
      { patientId: patient.id, scheduledFor: when.toISOString(), note },
      {
        onSuccess: () => {
          toast.success(`Call with ${caregiverFirst} scheduled for ${formatWhen(when.toISOString())}`);
          reset();
          onOpenChange(false);
        },
      },
    );
  }

  function confirmRequest(callRequestId: string, at: string) {
    confirm.mutate(
      { callRequestId, confirmedFor: at },
      {
        onSuccess: () => {
          toast.success(`Call with ${caregiverFirst} confirmed for ${formatWhen(at)}`);
          onOpenChange(false);
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface">
        <DialogHeader>
          <DialogTitle className="text-card-title font-medium">Schedule call</DialogTitle>
          <DialogDescription>
            A call with {caregiver.name} about {patient.name}.
          </DialogDescription>
        </DialogHeader>

        {pending.length > 0 && (
          <section aria-labelledby={`${id}-requests`} className="rounded-panel border border-border bg-sage-50 p-3">
            <h3 id={`${id}-requests`} className="text-sm font-semibold text-brand-deep">
              {caregiverFirst} asked for a call
            </h3>
            <ul className="mt-2 flex flex-col gap-3">
              {pending.map((request) => (
                <li key={request.id} className="text-sm text-body-2">
                  {request.note && <p className="mb-2">“{request.note}”</p>}
                  <div className="flex flex-col gap-2">
                    {request.preferredTimes.map((at) => (
                      <div key={at} className="flex items-center justify-between gap-3">
                        <span className="text-ink">{formatWhen(at)}</span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={confirm.isPending}
                          onClick={() => confirmRequest(request.id, at)}
                        >
                          Confirm
                          <span className="sr-only"> call for {formatWhen(at)}</span>
                        </Button>
                      </div>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${id}-date`} className="text-sm font-medium">
                Date
              </label>
              <Input
                id={`${id}-date`}
                type="date"
                required
                min={dateInputValue(new Date())}
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${id}-time`} className="text-sm font-medium">
                Time
              </label>
              <Input
                id={`${id}-time`}
                type="time"
                required
                value={time}
                onChange={(event) => setTime(event.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-note`} className="text-sm font-medium">
              Note <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <Textarea
              id={`${id}-note`}
              value={note}
              maxLength={5000}
              onChange={(event) => setNote(event.target.value)}
              placeholder="What the call is about"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={schedule.isPending}>
              {schedule.isPending && <Loader2 className="animate-spin" aria-hidden />}
              {schedule.isPending ? "Scheduling…" : "Schedule call"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
