import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DOMAIN_KEYS,
  domainsSchema,
  dropUnmatchedQuotes,
  type CheckInSource,
  type Domains,
} from "@careos/shared";
import { prisma } from "../db";
import { env } from "../env";
import { HttpError } from "../errors";
import { loadHistory, scoreAgainstHistory } from "./baseline";
import { extractDomains } from "./extractDomains";
import { HERO_DURATION_SEC, HERO_TRANSCRIPT } from "./transcripts";

export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

/** Stored names are always a uuid plus one of these, so client filenames never reach the disk. */
const AUDIO_EXTENSIONS: Record<string, string> = {
  "audio/webm": ".webm",
  "audio/ogg": ".ogg",
  "audio/mpeg": ".mp3",
  "audio/mp3": ".mp3",
  "audio/mp4": ".m4a",
  "audio/x-m4a": ".m4a",
  "audio/aac": ".aac",
  "audio/wav": ".wav",
  "audio/x-wav": ".wav",
  "audio/wave": ".wav",
};

export interface ProcessCheckInInput {
  patientId: string;
  caregiverId: string;
  audio?: File;
  transcriptOverride?: string;
  durationSec?: number;
  source: CheckInSource;
}

async function saveAudio(audio: File): Promise<string> {
  const mimeType = audio.type.split(";")[0]?.trim().toLowerCase() ?? "";
  const extension = AUDIO_EXTENSIONS[mimeType];
  if (!extension) throw new HttpError(400, "Audio must be an audio file.");
  if (audio.size > MAX_AUDIO_BYTES) throw new HttpError(413, "Audio must be 10 MB or smaller.");

  await mkdir(env.UPLOAD_DIR, { recursive: true });
  const fileName = `${randomUUID()}${extension}`;
  await writeFile(path.join(env.UPLOAD_DIR, fileName), Buffer.from(await audio.arrayBuffer()));
  return fileName;
}

/** Task 5 adds real speech-to-text behind this. */
async function getTranscript(input: ProcessCheckInInput): Promise<string> {
  return input.transcriptOverride || HERO_TRANSCRIPT;
}

const SUMMARY_ORDER = DOMAIN_KEYS;

export function buildAiSummary(domains: Domains, flags: readonly string[]): string {
  const findings = SUMMARY_ORDER.filter((key) => domains[key].quote !== null).map(
    (key) => domains[key].summary,
  );
  const sentences = findings.length > 0 ? findings : ["No specific concerns mentioned."];
  const flagged = flags.length > 0 ? ` Flagged: ${flags.join(", ")}.` : "";
  return `${sentences.join(" ")}${flagged}`;
}

/** The single pipeline behind real uploads and simulated check-ins. */
export async function processCheckIn(input: ProcessCheckInInput) {
  const caregiver = await prisma.caregiver.findFirst({
    where: { id: input.caregiverId, patientId: input.patientId },
    select: { id: true },
  });
  if (!caregiver) throw new HttpError(404, "Patient or caregiver not found.");

  const audioPath = input.audio ? await saveAudio(input.audio) : null;

  try {
    const transcript = await getTranscript(input);
    const domains = domainsSchema.parse(
      dropUnmatchedQuotes(transcript, await extractDomains(transcript)),
    );

    const at = new Date();
    const history = await loadHistory(input.patientId, at);
    const result = scoreAgainstHistory({ transcript, domains, history, at });

    return await prisma.checkIn.create({
      data: {
        patientId: input.patientId,
        caregiverId: input.caregiverId,
        durationSec: input.durationSec ?? HERO_DURATION_SEC,
        audioPath,
        transcript,
        aiSummary: buildAiSummary(domains, result.flags),
        domains,
        riskScore: result.score,
        riskTier: result.tier,
        flags: result.flags,
        isEmergency: result.isEmergency,
        status: "received",
        source: input.source,
        createdAt: at,
      },
    });
  } catch (error) {
    // Don't leave an orphaned recording behind when the check-in wasn't stored.
    if (audioPath) await rm(path.join(env.UPLOAD_DIR, audioPath), { force: true });
    throw error;
  }
}
