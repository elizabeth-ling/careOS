import { readFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../../env";
import { withTimeout } from "./timeout";

export const STT_TIMEOUT_MS = 20_000;

/** Turns a stored recording into text. One implementation per provider. */
export interface Transcriber {
  readonly name: string;
  /** `audioPath` is the stored file name inside UPLOAD_DIR. */
  transcribe(audioPath: string, signal: AbortSignal): Promise<string>;
  /** A cheap reachability check for /health. Never transcribes anything. */
  ping(signal: AbortSignal): Promise<void>;
}

const MIME_BY_EXTENSION: Record<string, string> = {
  ".webm": "audio/webm",
  ".ogg": "audio/ogg",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".wav": "audio/wav",
};

/** Any Whisper-compatible `POST {base}/audio/transcriptions` API. */
function whisperTranscriber(baseUrl: string, apiKey: string, model: string): Transcriber {
  const base = baseUrl.replace(/\/+$/, "");
  const headers = { authorization: `Bearer ${apiKey}` };

  return {
    name: "whisper",
    async transcribe(audioPath, signal) {
      const fileName = path.basename(audioPath);
      const bytes = await readFile(path.join(env.UPLOAD_DIR, fileName));
      const type = MIME_BY_EXTENSION[path.extname(fileName)] ?? "application/octet-stream";

      const form = new FormData();
      form.set("file", new Blob([bytes], { type }), fileName);
      form.set("model", model);
      form.set("response_format", "json");

      const response = await fetch(`${base}/audio/transcriptions`, { method: "POST", headers, body: form, signal });
      if (!response.ok) throw new Error(`Speech-to-text failed with HTTP ${response.status}.`);
      const body = (await response.json()) as { text?: unknown };
      const text = typeof body.text === "string" ? body.text.trim() : "";
      if (!text) throw new Error("Speech-to-text returned no text.");
      return text;
    },
    async ping(signal) {
      const response = await fetch(`${base}/models`, { headers, signal });
      if (!response.ok) throw new Error(`Speech-to-text health check failed with HTTP ${response.status}.`);
    },
  };
}

/** The configured provider, or null when live speech-to-text isn't set up. */
export function getTranscriber(): Transcriber | null {
  if (env.STT_PROVIDER === "none" || !env.STT_API_KEY) return null;
  return whisperTranscriber(env.STT_API_URL, env.STT_API_KEY, env.STT_MODEL);
}

export async function transcribe(audioPath: string, outer?: AbortSignal): Promise<string> {
  const transcriber = getTranscriber();
  if (!transcriber) throw new Error("Speech-to-text is not configured.");
  return withTimeout("Speech-to-text", STT_TIMEOUT_MS, (signal) => transcriber.transcribe(audioPath, signal), outer);
}
