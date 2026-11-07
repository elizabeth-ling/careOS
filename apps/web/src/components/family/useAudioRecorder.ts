import { useCallback, useEffect, useRef, useState } from "react";

/** Recordings stop on their own after 3 minutes. */
export const MAX_RECORDING_SEC = 180;

export type RecorderError = "denied" | "unavailable";

export interface Recording {
  blob: Blob;
  /** Unknown for some uploaded files. */
  durationSec?: number;
}

function pickMimeType(): string | undefined {
  const preferred = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
  return preferred.find((type) => MediaRecorder.isTypeSupported(type));
}

/**
 * Records from the microphone with MediaRecorder (webm/opus where supported),
 * and reports a live 0–1 input level from a Web Audio AnalyserNode.
 */
export function useAudioRecorder(onFinished: (recording: Recording) => void) {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<RecorderError | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const frameRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const discardRef = useRef(false);
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;

  const release = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    if (timerRef.current !== null) clearInterval(timerRef.current);
    frameRef.current = null;
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    void audioContextRef.current?.close().catch(() => undefined);
    audioContextRef.current = null;
    setLevel(0);
  }, []);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }, []);

  /** Stops without delivering the recording (the dialog was closed). */
  const cancel = useCallback(() => {
    discardRef.current = true;
    stop();
    release();
    setIsRecording(false);
  }, [release, stop]);

  const start = useCallback(async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("unavailable");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (cause) {
      const name = cause instanceof DOMException ? cause.name : "";
      setError(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unavailable");
      return;
    }
    streamRef.current = stream;
    discardRef.current = false;

    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onstop = () => {
      const durationSec = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
      release();
      setIsRecording(false);
      recorderRef.current = null;
      if (discardRef.current) return;
      const type = (recorder.mimeType || mimeType || "audio/webm").split(";")[0]!;
      onFinishedRef.current({ blob: new Blob(chunks, { type }), durationSec });
    };
    recorderRef.current = recorder;

    // Live level meter: RMS of the time-domain signal, scaled to roughly 0–1.
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      const context = new AudioCtx();
      audioContextRef.current = context;
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      context.createMediaStreamSource(stream).connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      const tick = () => {
        analyser.getByteTimeDomainData(samples);
        let sum = 0;
        for (const sample of samples) {
          const centred = (sample - 128) / 128;
          sum += centred * centred;
        }
        setLevel(Math.min(1, Math.sqrt(sum / samples.length) * 4));
        frameRef.current = requestAnimationFrame(tick);
      };
      tick();
    }

    startedAtRef.current = Date.now();
    setElapsedSec(0);
    timerRef.current = window.setInterval(() => {
      const elapsed = (Date.now() - startedAtRef.current) / 1000;
      setElapsedSec(Math.min(elapsed, MAX_RECORDING_SEC));
      if (elapsed >= MAX_RECORDING_SEC) stop();
    }, 250);

    recorder.start(1000);
    setIsRecording(true);
  }, [release, stop]);

  // Never leave the microphone on after the component goes away.
  useEffect(
    () => () => {
      discardRef.current = true;
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") recorder.stop();
      release();
    },
    [release],
  );

  return { start, stop, cancel, isRecording, elapsedSec, level, error, clearError: () => setError(null) };
}
