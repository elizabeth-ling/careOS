import { RotateCcw, Settings2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { useDemoReset, useHealth, useSimulateCheckIn } from "@/api/hooks";
import { DoneState } from "@/components/family/VoiceCheckInDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDemoIdentity } from "@/demo";
import { cn } from "@/lib/utils";

export function DemoControls({ sidebar = false }: { sidebar?: boolean }) {
  const health = useHealth();
  const identity = useDemoIdentity(Boolean(health.data?.demoMode));
  const reset = useDemoReset();
  const simulate = useSimulateCheckIn();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [completedCheckIn, setCompletedCheckIn] = useState<Awaited<ReturnType<typeof simulate.mutateAsync>>>();

  if (!health.data?.demoMode) return null;

  const patientId = identity.data?.heroPatientId;
  const offline = !health.data.sttOk || !health.data.llmOk;

  async function resetDemo() {
    try {
      await reset.mutateAsync();
      toast.success("Demo data reset to the seed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't reset demo data.");
    }
  }

  async function simulateCheckIn(kind: "hero" | "emergency") {
    try {
      const checkIn = await simulate.mutateAsync({ kind });
      setCompletedCheckIn(checkIn);
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't simulate a check-in.");
    }
  }

  return (
    <div className={cn("print:hidden print-hide", sidebar ? "w-full" : "fixed bottom-4 left-4 z-40")}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={cn("size-11 bg-surface")}
            aria-label="Open demo controls"
            title="Demo controls"
          >
            <Settings2 aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          side={sidebar ? "right" : "top"}
          align={sidebar ? "end" : "start"}
          className="w-[min(20rem,calc(100vw-2rem))] space-y-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="font-semibold text-ink">Demo controls</h2>
              {offline && (
                <span className="mt-1 inline-flex rounded-control bg-sage-50 px-2 py-1 text-xs text-body-2">
                  Offline demo mode
                </span>
              )}
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={reset.isPending}
              onClick={() => void resetDemo()}
            >
              <RotateCcw aria-hidden />
              Reset demo data
            </Button>
          </div>

          <div className="grid gap-2">
            <Button
              type="button"
              variant="outline"
              className="justify-start whitespace-normal text-left"
              disabled={simulate.isPending || !identity.data}
              onClick={() => void simulateCheckIn("hero")}
            >
              Simulate Sarah's check-in
            </Button>
            <Button
              type="button"
              variant="outline"
              className="justify-start whitespace-normal text-left"
              disabled={simulate.isPending || !identity.data}
              onClick={() => void simulateCheckIn("emergency")}
            >
              Simulate emergency check-in
            </Button>
          </div>

          <div className="border-t border-border pt-3">
            <p className="mb-2 text-xs font-semibold text-muted-foreground">Jump to</p>
            <nav aria-label="Demo shortcuts" className="grid gap-1">
              <Shortcut to="/family">Family home</Shortcut>
              <Shortcut to="/nurse">Nurse queue</Shortcut>
              {patientId && (
                <>
                  <Shortcut to={`/nurse/patients/${patientId}`}>Walter's page</Shortcut>
                  <Shortcut to={`/summary/${patientId}`}>Care summary</Shortcut>
                </>
              )}
            </nav>
          </div>
        </PopoverContent>
      </Popover>
      <Dialog
        open={Boolean(completedCheckIn)}
        onOpenChange={(isOpen) => {
          if (!isOpen) setCompletedCheckIn(undefined);
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-2rem)] gap-5 overflow-y-auto bg-surface p-5 sm:max-w-[560px] sm:p-8">
          <DialogTitle className="sr-only">Check-in sent</DialogTitle>
          {completedCheckIn && identity.data && (
            <DoneState
              checkIn={completedCheckIn}
              nurseFirstName={identity.data.nurse.name.split(/\s+/)[0] ?? identity.data.nurse.name}
              onClose={() => {
                setCompletedCheckIn(undefined);
                navigate("/family");
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Shortcut({ to, children }: { to: string; children: string }) {
  return (
    <Link
      to={to}
      className="min-h-11 rounded-control px-2 py-2 text-sm text-ink hover:bg-sage-50"
    >
      {children}
    </Link>
  );
}
