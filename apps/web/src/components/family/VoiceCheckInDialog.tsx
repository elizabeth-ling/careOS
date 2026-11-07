import { DOMAIN_KEYS, DOMAIN_LABELS, type CheckIn, type DomainKey, type RiskTier } from "@careos/shared";
import { Check, Loader2, Mic, Phone, Square, TriangleAlert, Upload } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useCreateCheckIn } from "@/api/hooks";
import { AiSummaryPanel } from "@/components/AiSummaryPanel";
import { TIER_STYLES } from "@/components/tiers";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { formatTimer } from "@/lib/format";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { cn } from "@/lib/utils";
import { MAX_RECORDING_SEC, useAudioRecorder, type Recording } from "./useAudioRecorder";

const PROMPTS = ["How was eating today?", "Any falls or near-falls?", "Memory and mood?", "How are you doing?"];

const STEP_ANNOUNCEMENTS: Record<Flow["step"], string> = {
  ready: "",
  recording: "Recording. Press Stop when you're done.",
  processing: "Sending your check-in.",
  done: "Check-in sent.",
  failed: "Your check-in couldn't be sent.",
};

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const STEP_MS = 900;

type Flow =
  | { step: "ready" }
  | { step: "recording" }
  | { step: "processing"; recording: Recording }
  | { step: "done"; checkIn: CheckIn }
  | { step: "failed"; recording: Recording; message: string };

interface VoiceCheckInDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  caregiverId: string;
  patientFirstName: string;
  nurseFirstName: string;
}

/** The family's voice check-in: Ready → Recording → Processing → Done. A full-screen sheet on phones. */
export function VoiceCheckInDialog(props: VoiceCheckInDialogProps) {
  const { open, onOpenChange, patientFirstName } = props;
  const isPhone = useMediaQuery("(max-width: 639px)");
  const title = `Check in about ${patientFirstName}`;
  const description = "Tap and talk. Say it in your own words.";

  // Remount the flow each time the dialog opens, so it always starts at Ready.
  const [session, setSession] = useState(0);
  useEffect(() => {
    if (open) setSession((n) => n + 1);
  }, [open]);

  const body = <CheckInFlow key={session} {...props} onClose={() => onOpenChange(false)} />;

  if (isPhone) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="inset-0 h-dvh gap-0 overflow-y-auto border-0 bg-surface p-5 pt-6">
          <SheetTitle className="pr-8 text-[26px] font-normal text-ink">{title}</SheetTitle>
          <SheetDescription className="sr-only">{description}</SheetDescription>
          {body}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto bg-surface p-8 sm:max-w-[560px]">
        <DialogTitle className="pr-8 text-[26px] leading-tight font-normal text-ink">{title}</DialogTitle>
        <DialogDescription className="sr-only">{description}</DialogDescription>
        {body}
      </DialogContent>
    </Dialog>
  );
}

function CheckInFlow({
  patientId,
  caregiverId,
  patientFirstName,
  nurseFirstName,
  onClose,
}: VoiceCheckInDialogProps & { onClose: () => void }) {
  const [flow, setFlow] = useState<Flow>({ step: "ready" });
  const [uploadError, setUploadError] = useState<string | null>(null);
  const createCheckIn = useCreateCheckIn();
  const recorder = useAudioRecorder((recording) => submit(recording));
  const fileInput = useRef<HTMLInputElement>(null);

  function submit(recording: Recording) {
    setFlow({ step: "processing", recording });
    createCheckIn.mutate(
      { patientId, caregiverId, audio: recording.blob, durationSec: recording.durationSec },
      {
        onSuccess: (checkIn) => setFlow({ step: "done", checkIn }),
        onError: (error) =>
          setFlow({
            step: "failed",
            recording,
            message: error instanceof Error ? error.message : "Something went wrong.",
          }),
      },
    );
  }

  async function startRecording() {
    setUploadError(null);
    await recorder.start();
  }

  useEffect(() => {
    if (recorder.isRecording) setFlow({ step: "recording" });
  }, [recorder.isRecording]);

  async function onFileChosen(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      setUploadError("That file isn't audio. Choose a voice recording.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError("That file is too big. Recordings must be 10 MB or smaller.");
      return;
    }
    setUploadError(null);
    submit({ blob: file, durationSec: await audioDuration(file) });
  }

  const uploadControl = (
    <>
      <input
        ref={fileInput}
        type="file"
        accept="audio/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={onFileChosen}
      />
      <button
        type="button"
        onClick={() => fileInput.current?.click()}
        className="inline-flex min-h-11 items-center gap-2 rounded-control text-[15px] font-medium text-brand underline-offset-4 hover:underline"
      >
        <Upload className="size-4" aria-hidden />
        Upload audio instead
      </button>
    </>
  );

  return (
    <div className="mt-5 flex flex-col gap-6">
      <p className="sr-only" aria-live="polite">
        {STEP_ANNOUNCEMENTS[flow.step]}
      </p>
      {flow.step === "ready" && (
        <>
          <div className="flex flex-col items-center gap-3 py-2">
            <MicButton label="Start recording" onClick={startRecording}>
              <Mic className="size-10" aria-hidden />
            </MicButton>
            <p className="text-[15px] text-body-2">Tap to start. You can talk for up to 3 minutes.</p>
          </div>
          {recorder.error && (
            <p role="alert" className="rounded-panel bg-watch-bg px-4 py-3 text-[15px] text-watch">
              {recorder.error === "denied"
                ? "Your browser blocked the microphone, so allow it in your browser settings or upload a recording instead."
                : "This browser can't record audio, so please upload a recording instead."}
            </p>
          )}
          <Prompts />
          <div className="flex flex-col items-center gap-1">
            {uploadControl}
            {uploadError && (
              <p role="alert" className="text-sm text-urgent">
                {uploadError}
              </p>
            )}
          </div>
        </>
      )}

      {flow.step === "recording" && (
        <>
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="relative">
              <span className="absolute inset-0 animate-ping rounded-full bg-sage-200 motion-reduce:hidden" aria-hidden />
              <span className="relative flex size-[120px] items-center justify-center rounded-full bg-brand text-on-ink">
                <Mic className="size-10" aria-hidden />
              </span>
            </div>
            <LevelMeter level={recorder.level} />
            <p className="text-[28px] font-normal text-ink tabular-nums" aria-label="Recording time">
              {formatTimer(recorder.elapsedSec)}
              <span className="ml-2 text-base text-muted-foreground">/ {formatTimer(MAX_RECORDING_SEC)}</span>
            </p>
            <Button onClick={recorder.stop} className="h-11 min-w-36 px-6">
              <Square className="fill-current" aria-hidden />
              Stop
            </Button>
          </div>
          <Prompts />
        </>
      )}

      {flow.step === "processing" && (
        <ProcessingSteps done={createCheckIn.isSuccess} patientFirstName={patientFirstName} nurseFirstName={nurseFirstName} />
      )}

      {flow.step === "failed" && (
        <div className="flex flex-col gap-4">
          <p role="alert" className="rounded-panel bg-urgent-bg px-4 py-3 text-[15px] text-urgent">
            We couldn't send your check-in ({flow.message}). Your recording is kept here, so you can try again.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button className="h-11 px-6" onClick={() => submit(flow.recording)}>
              Try again
            </Button>
            <Button variant="outline" className="h-11 px-6" onClick={() => setFlow({ step: "ready" })}>
              Record again
            </Button>
          </div>
        </div>
      )}

      {flow.step === "done" && (
        <DoneState checkIn={flow.checkIn} nurseFirstName={nurseFirstName} onClose={onClose} />
      )}
    </div>
  );
}

function MicButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-[140px] items-center justify-center rounded-full border-[10px] border-sage-50 bg-brand bg-clip-padding text-on-ink transition-colors hover:bg-brand-deep"
    >
      {children}
    </button>
  );
}

function Prompts() {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-body-2">Things you might mention</p>
      <ul className="flex flex-wrap gap-2">
        {PROMPTS.map((prompt) => (
          <li key={prompt} className="rounded-control bg-sage-50 px-3 py-1.5 text-[15px] text-brand-deep">
            {prompt}
          </li>
        ))}
      </ul>
    </div>
  );
}

const METER_BARS = 16;

function LevelMeter({ level }: { level: number }) {
  const lit = Math.round(level * METER_BARS);
  return (
    <div className="flex h-8 items-end gap-1" aria-hidden>
      {Array.from({ length: METER_BARS }, (_, i) => (
        <span
          key={i}
          className={cn("w-1.5 rounded-full transition-colors", i < lit ? "bg-brand" : "bg-sage-100")}
          style={{ height: `${30 + 70 * Math.sin(((i + 1) / (METER_BARS + 1)) * Math.PI)}%` }}
        />
      ))}
    </div>
  );
}

function ProcessingSteps({
  done,
  patientFirstName,
  nurseFirstName,
}: {
  done: boolean;
  patientFirstName: string;
  nurseFirstName: string;
}) {
  const steps = [
    "Transcribing",
    `Understanding ${patientFirstName}'s update`,
    "Checking against his recent history",
    `Sending to Nurse ${nurseFirstName}`,
  ];
  const [active, setActive] = useState(0);

  // Tick forward on a timer, but hold on the last step until the server answers.
  useEffect(() => {
    if (done) return;
    const timer = window.setInterval(() => setActive((i) => Math.min(i + 1, steps.length - 1)), STEP_MS);
    return () => clearInterval(timer);
  }, [done, steps.length]);

  const current = done ? steps.length : active;

  return (
    <ol className="flex flex-col gap-3 py-2" aria-label="Progress">
      {steps.map((label, i) => {
        const state = i < current ? "done" : i === current ? "active" : "pending";
        return (
          <li key={label} className="flex items-center gap-3 text-base">
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full",
                state === "done" && "bg-brand text-on-ink",
                state === "active" && "bg-sage-50 text-brand",
                state === "pending" && "border-2 border-sage-200",
              )}
            >
              {state === "done" && <Check className="size-4" aria-hidden />}
              {state === "active" && <Loader2 className="size-4 animate-spin" aria-hidden />}
            </span>
            <span className={state === "pending" ? "text-muted-foreground" : "text-ink"}>
              {label}
              <span className="sr-only">{state === "done" ? " (done)" : state === "active" ? " (in progress)" : ""}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

const SEVERITY_TIER: Record<number, RiskTier> = { 1: "stable", 2: "watch", 3: "urgent" };
const SEVERITY_WORDS: Record<number, string> = { 0: "No concern", 1: "Minor", 2: "Worth watching", 3: "Needs attention" };

/** Up to four things the check-in mentioned, most concerning first. */
function heardDomains(checkIn: CheckIn): DomainKey[] {
  return DOMAIN_KEYS.filter((key) => checkIn.domains[key].quote !== null || checkIn.domains[key].severity > 0)
    .sort((a, b) => checkIn.domains[b].severity - checkIn.domains[a].severity)
    .slice(0, 4);
}

function DoneState({
  checkIn,
  nurseFirstName,
  onClose,
}: {
  checkIn: CheckIn;
  nurseFirstName: string;
  onClose: () => void;
}) {
  const heard = heardDomains(checkIn);

  return (
    <>
      {checkIn.is_emergency && (
        <div role="alert" className="flex flex-col gap-3 rounded-panel border border-urgent/30 bg-urgent-bg p-4 text-urgent">
          <p className="flex items-center gap-2 text-lg font-semibold">
            <TriangleAlert className="size-5 shrink-0" aria-hidden />
            This may be an emergency. Call 911 now.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="destructive" className="h-11 px-6">
              <a href="tel:911">
                <Phone aria-hidden />
                Call 911
              </a>
            </Button>
            <Button asChild variant="outline" className="h-11 px-6">
              <a href="tel:811">Call Health811</a>
            </Button>
          </div>
        </div>
      )}

      <section aria-labelledby="transcript-heading">
        <h3 id="transcript-heading" className="mb-2 text-card-title font-medium text-ink">
          What you said
        </h3>
        <p className="max-h-40 overflow-y-auto rounded-panel border border-border px-4 py-3 text-[15px] leading-relaxed text-body-2">
          {checkIn.transcript}
        </p>
      </section>

      <AiSummaryPanel>
        <h3 className="mb-3 text-card-title font-medium text-ink">What we heard</h3>
        {heard.length === 0 ? (
          <p>Nothing worrying stood out.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {heard.map((key) => {
              const entry = checkIn.domains[key];
              const tier = SEVERITY_TIER[entry.severity];
              return (
                <li key={key} className="rounded-panel bg-surface px-3 py-2.5">
                  <p className="flex items-center gap-2 text-[15px] font-medium text-ink">
                    <span
                      className={cn("size-2.5 shrink-0 rounded-full", tier ? `bg-current ${TIER_STYLES[tier].text}` : "bg-sage-200")}
                      aria-hidden
                    />
                    {DOMAIN_LABELS[key]}
                    <span className="sr-only">: {SEVERITY_WORDS[entry.severity]}.</span>
                  </p>
                  <p className="mt-0.5 text-sm text-body-2">{entry.summary}</p>
                </li>
              );
            })}
          </ul>
        )}
      </AiSummaryPanel>

      <div className="flex flex-col items-start gap-4">
        <p className="flex items-center gap-2 text-base text-ink">
          <Check className="size-5 shrink-0 text-brand" aria-hidden />
          Sent to Nurse {nurseFirstName}. You'll get a reply under Check-ins.
        </p>
        <Button className="h-11 px-6" onClick={onClose}>
          Back to home
        </Button>
      </div>
    </>
  );
}

/** Reads an uploaded file's length, when the browser can tell. */
function audioDuration(file: File): Promise<number | undefined> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    const finish = (value: number | undefined) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    audio.preload = "metadata";
    audio.onloadedmetadata = () =>
      finish(
        Number.isFinite(audio.duration) && audio.duration > 0 && audio.duration <= 600
          ? Math.max(1, Math.round(audio.duration))
          : undefined,
      );
    audio.onerror = () => finish(undefined);
    window.setTimeout(() => finish(undefined), 3000);
    audio.src = url;
  });
}
