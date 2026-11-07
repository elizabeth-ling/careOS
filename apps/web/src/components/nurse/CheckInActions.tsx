import type { Caregiver, CheckIn, Patient } from "@careos/shared";
import { Check, ChevronRight, Loader2, Phone } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useMarkReviewed } from "@/api/hooks";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ScheduleCallDialog } from "./ScheduleCallDialog";
import { SendGuidanceSheet } from "./SendGuidanceSheet";

interface CheckInActionsProps {
  patient: Patient;
  caregiver: Caregiver;
  /** The check-in that guidance and reviews apply to. */
  checkIn: CheckIn | null;
  /** Extra buttons after the standard three, e.g. "Generate care summary". */
  children?: ReactNode;
  className?: string;
}

/** Send guidance ›, Schedule call and Mark reviewed, with their sheet and dialog. */
export function CheckInActions({ patient, caregiver, checkIn, children, className }: CheckInActionsProps) {
  const [guidanceOpen, setGuidanceOpen] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const review = useMarkReviewed();
  const handled = checkIn !== null && checkIn.status !== "received";

  function markReviewed() {
    if (!checkIn) return;
    review.mutate(checkIn.id, {
      onSuccess: () => toast.success(`${patient.name}'s check-in marked reviewed`),
    });
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <Button type="button" disabled={!checkIn} onClick={() => setGuidanceOpen(true)}>
        Send guidance
        <ChevronRight aria-hidden />
      </Button>
      <Button type="button" variant="outline" onClick={() => setCallOpen(true)}>
        <Phone aria-hidden />
        Schedule call
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="text-brand hover:text-brand-deep"
        disabled={!checkIn || handled || review.isPending}
        onClick={markReviewed}
      >
        {review.isPending ? (
          <>
            <Loader2 className="animate-spin" aria-hidden />
            Marking…
          </>
        ) : handled ? (
          <>
            <Check aria-hidden />
            Reviewed
          </>
        ) : (
          "Mark reviewed"
        )}
      </Button>
      {children}

      {checkIn && (
        <SendGuidanceSheet
          open={guidanceOpen}
          onOpenChange={setGuidanceOpen}
          patient={patient}
          caregiver={caregiver}
          checkIn={checkIn}
        />
      )}
      <ScheduleCallDialog open={callOpen} onOpenChange={setCallOpen} patient={patient} caregiver={caregiver} />
    </div>
  );
}
