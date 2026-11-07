import type { Caregiver, CheckIn, Patient } from "@careos/shared";
import { ChevronRight, Loader2 } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { useGuidanceDrafts, useSendGuidance } from "@/api/hooks";
import { AiSummaryPanel } from "@/components/AiSummaryPanel";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { firstNameOf, formatDayTime } from "@/lib/format";
import { cn } from "@/lib/utils";

interface SendGuidanceSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: Patient;
  caregiver: Caregiver;
  checkIn: CheckIn;
}

/** Right-side sheet: pick a suggested draft or write guidance, then send it to the caregiver. */
export function SendGuidanceSheet({ open, onOpenChange, patient, caregiver, checkIn }: SendGuidanceSheetProps) {
  const drafts = useGuidanceDrafts(open ? checkIn.id : undefined);
  const send = useSendGuidance();
  const [body, setBody] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const textareaId = useId();
  const caregiverFirst = firstNameOf(caregiver.name);

  function close(next: boolean) {
    if (!next && send.isPending) return;
    onOpenChange(next);
    if (!next) {
      setBody("");
      setPicked(null);
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    send.mutate(
      { checkInId: checkIn.id, body },
      {
        onSuccess: () => {
          toast.success(`Guidance sent to ${caregiverFirst}`);
          close(false);
        },
      },
    );
  }

  return (
    <Sheet open={open} onOpenChange={close}>
      <SheetContent className="w-full gap-0 bg-surface sm:max-w-md">
        <form onSubmit={submit} className="flex h-full flex-col">
          <SheetHeader className="border-b border-border px-6 py-5">
            <SheetTitle className="text-card-title font-medium">Send guidance</SheetTitle>
            <SheetDescription>
              To {caregiver.name} ({caregiver.relationship.toLowerCase()}) about {patient.name}'s check-in from{" "}
              {formatDayTime(checkIn.createdAt)}.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
            <AiSummaryPanel className="px-4 py-3">
              <p id={`${textareaId}-drafts`} className="mb-2 text-sm text-body-2">
                Suggested drafts. Pick one to start from, then edit it.
              </p>
              {drafts.isPending ? (
                <div className="flex flex-wrap gap-2">
                  <Skeleton className="h-8 w-40" />
                  <Skeleton className="h-8 w-36" />
                  <Skeleton className="h-8 w-32" />
                </div>
              ) : (
                <div role="group" aria-labelledby={`${textareaId}-drafts`} className="flex flex-wrap gap-2">
                  {drafts.data?.map((draft) => (
                    <button
                      key={draft.kind}
                      type="button"
                      aria-pressed={picked === draft.kind}
                      onClick={() => {
                        setBody(draft.body);
                        setPicked(draft.kind);
                      }}
                      className={cn(
                        "inline-flex h-8 items-center rounded-control border px-3 text-[13px] font-medium transition-colors",
                        picked === draft.kind
                          ? "border-ink bg-ink text-on-ink"
                          : "border-border bg-surface text-ink hover:bg-sage-100",
                      )}
                    >
                      {draft.label}
                    </button>
                  ))}
                </div>
              )}
            </AiSummaryPanel>

            <div className="flex flex-1 flex-col gap-2">
              <label htmlFor={textareaId} className="text-sm font-medium text-ink">
                Message to {caregiverFirst}
              </label>
              <Textarea
                id={textareaId}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder={`Write guidance for ${caregiverFirst}…`}
                className="min-h-48 flex-1 text-[15px] md:text-[15px]"
                maxLength={5000}
              />
            </div>
          </div>

          <SheetFooter className="border-t border-border px-6 py-4">
            <Button type="submit" disabled={send.isPending || !body.trim()}>
              {send.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {send.isPending ? "Sending…" : `Send to ${caregiverFirst}`}
              {!send.isPending && <ChevronRight aria-hidden />}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
