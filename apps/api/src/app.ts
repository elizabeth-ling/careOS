import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { zValidator } from "@hono/zod-validator";
import {
  callRequestListResponseSchema,
  callRequestSchema,
  checkInIdParamSchema,
  checkInListResponseSchema,
  checkInSchema,
  confirmCallRequestSchema,
  createCallRequestSchema,
  createCheckInFieldsSchema,
  createMessageRequestSchema,
  demoResetResponseSchema,
  familyHomeQuerySchema,
  familyHomeResponseSchema,
  guidanceDraftsResponseSchema,
  guidanceRequestSchema,
  guidanceResultSchema,
  healthResponseSchema,
  limitQuerySchema,
  messageListResponseSchema,
  messageSchema,
  nurseActionListResponseSchema,
  nurseActionSchema,
  patientDetailResponseSchema,
  queueQuerySchema,
  scheduleCallRequestSchema,
  simulateRequestSchema,
  trendsQuerySchema,
  uuidParamSchema,
} from "@careos/shared";
import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import type { ZodError, ZodType } from "zod";
import { prisma } from "./db";
import { env } from "./env";
import { HttpError, notFound } from "./errors";
import {
  formatCallNote,
  toCallRequest,
  toCareHome,
  toCaregiver,
  toCheckIn,
  toMessage,
  toNurse,
  toNurseAction,
  toPatient,
} from "./mappers";
import { seed } from "./seed";
import { getProviderHealth } from "./services/ai/health";
import { changesFromBaseline } from "./services/baseline";
import { getCalendar } from "./services/calendar";
import { buildGuidanceDrafts } from "./services/guidanceDrafts";
import { MAX_AUDIO_BYTES, processCheckIn } from "./services/processCheckIn";
import { getQueue } from "./services/queue";
import { getCareSummary } from "./services/summary";
import {
  EMERGENCY_DURATION_SEC,
  EMERGENCY_TRANSCRIPT,
  HERO_DURATION_SEC,
  HERO_PATIENT_NAME,
  HERO_TRANSCRIPT,
} from "./services/transcripts";
import { checkInRateLimit } from "./services/rateLimit";
import { getTrends } from "./services/trends";

const VOX_DELAY_MS = 1500;

function describeZodError(error: ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Invalid request.";
  const where = issue.path.join(".");
  return where ? `Invalid ${where}: ${issue.message}` : `Invalid request: ${issue.message}`;
}

/** zValidator, reporting failures in the API's `{ error }` shape. */
function validate<T extends ZodType, Target extends "json" | "query" | "param">(target: Target, schema: T) {
  return zValidator(target, schema, (result, c) => {
    if (!result.success) {
      return c.json({ error: describeZodError(result.error as unknown as ZodError) }, 400);
    }
  });
}

const idParam = validate("param", uuidParamSchema);

async function requirePatient(id: string) {
  const patient = await prisma.patient.findUnique({
    where: { id },
    include: {
      caregivers: { orderBy: { createdAt: "asc" }, take: 1 },
      primaryNurse: true,
      careHome: true,
    },
  });
  const caregiver = patient?.caregivers[0];
  if (!patient || !caregiver) throw notFound("Patient");
  return { patient, caregiver };
}

async function requireCheckIn(id: string) {
  const checkIn = await prisma.checkIn.findUnique({
    where: { id },
    include: { patient: true, caregiver: true },
  });
  if (!checkIn) throw notFound("Check-in");
  return checkIn;
}

async function heroPatientId(): Promise<string> {
  const hero = await prisma.patient.findFirst({ where: { name: HERO_PATIENT_NAME }, select: { id: true } });
  if (!hero) throw notFound("Demo patient");
  return hero.id;
}

const AUDIO_CONTENT_TYPES: Record<string, string> = {
  ".webm": "audio/webm",
  ".ogg": "audio/ogg",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".wav": "audio/wav",
};

/** Only ever a direct child of the upload directory, whatever the stored value says. */
function resolveAudioFile(audioPath: string): string | null {
  const root = path.resolve(env.UPLOAD_DIR);
  const resolved = path.resolve(root, audioPath);
  return path.dirname(resolved) === root ? resolved : null;
}

async function streamAudio(c: Context, audioPath: string) {
  const file = resolveAudioFile(audioPath);
  if (!file) throw notFound("Audio");

  const stats = await stat(file).catch(() => null);
  if (!stats?.isFile()) throw notFound("Audio");

  const headers: Record<string, string> = {
    "Content-Type": AUDIO_CONTENT_TYPES[path.extname(file)] ?? "application/octet-stream",
    "Accept-Ranges": "bytes",
    "X-Content-Type-Options": "nosniff",
  };

  // Browsers need range support to seek in an <audio> element.
  const range = /^bytes=(\d*)-(\d*)$/.exec(c.req.header("range") ?? "");
  if (range && stats.size > 0 && (range[1] || range[2])) {
    const start = range[1] ? Number(range[1]) : Math.max(0, stats.size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), stats.size - 1) : stats.size - 1;
    if (start > end || start >= stats.size) {
      return c.json({ error: "Requested range not satisfiable." }, 416);
    }
    headers["Content-Range"] = `bytes ${start}-${end}/${stats.size}`;
    headers["Content-Length"] = String(end - start + 1);
    const stream = Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream;
    return new Response(stream, { status: 206, headers });
  }

  headers["Content-Length"] = String(stats.size);
  return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, { status: 200, headers });
}

export interface AppOptions {
  demoMode?: boolean;
}

export function createApp(options: AppOptions = {}) {
  const demoMode = options.demoMode ?? env.DEMO_MODE;
  const limitCheckIns = checkInRateLimit(env.TRUST_PROXY);

  const api = new Hono();

  // --- Nurse ---------------------------------------------------------------

  api.get("/health", async (c) => {
    await prisma.$queryRaw`SELECT 1`;
    const providerHealth =
      env.AI_MODE === "live" ? await getProviderHealth() : { sttOk: false, llmOk: false };
    return c.json(
      healthResponseSchema.parse({
        status: "ok",
        database: "ok",
        aiMode: env.AI_MODE,
        ...providerHealth,
        demoMode,
      }),
    );
  });

  api.get("/nurse/queue", validate("query", queueQuerySchema), async (c) => {
    const { filter, sort } = c.req.valid("query");
    return c.json(await getQueue(filter, sort));
  });

  api.get("/patients/:id", idParam, async (c) => {
    const { id } = c.req.valid("param");
    const { patient, caregiver } = await requirePatient(id);
    const [latest, insights] = await Promise.all([
      prisma.checkIn.findFirst({ where: { patientId: id }, orderBy: { createdAt: "desc" } }),
      changesFromBaseline(id),
    ]);
    return c.json(
      patientDetailResponseSchema.parse({
        patient: toPatient(patient),
        caregiver: toCaregiver(caregiver),
        nurse: toNurse(patient.primaryNurse),
        careHome: toCareHome(patient.careHome),
        latestCheckIn: latest ? toCheckIn(latest) : null,
        insights,
      }),
    );
  });

  api.get("/patients/:id/check-ins", idParam, validate("query", limitQuerySchema), async (c) => {
    const { id } = c.req.valid("param");
    await requirePatient(id);
    const rows = await prisma.checkIn.findMany({
      where: { patientId: id },
      orderBy: { createdAt: "desc" },
      take: c.req.valid("query").limit,
    });
    return c.json(checkInListResponseSchema.parse(rows.map(toCheckIn)));
  });

  api.get("/patients/:id/trends", idParam, validate("query", trendsQuerySchema), async (c) => {
    const { id } = c.req.valid("param");
    await requirePatient(id);
    return c.json(await getTrends(id, c.req.valid("query").days));
  });

  api.get("/patients/:id/actions", idParam, async (c) => {
    const { id } = c.req.valid("param");
    await requirePatient(id);
    const rows = await prisma.nurseAction.findMany({
      where: { patientId: id },
      orderBy: { createdAt: "desc" },
      include: { nurse: true },
    });
    return c.json(nurseActionListResponseSchema.parse(rows.map(toNurseAction)));
  });

  api.post("/check-ins/:id/guidance", idParam, validate("json", guidanceRequestSchema), async (c) => {
    const { id } = c.req.valid("param");
    const { body } = c.req.valid("json");
    const checkIn = await requireCheckIn(id);

    const [action, updated] = await prisma.$transaction([
      prisma.nurseAction.create({
        data: {
          patientId: checkIn.patientId,
          checkInId: id,
          nurseId: checkIn.patient.primaryNurseId,
          type: "guidance",
          body,
        },
        include: { nurse: true },
      }),
      prisma.checkIn.update({ where: { id }, data: { status: "guidance_sent" } }),
    ]);

    return c.json(
      guidanceResultSchema.parse({ checkIn: toCheckIn(updated), action: toNurseAction(action) }),
      201,
    );
  });

  api.post("/check-ins/:id/review", idParam, async (c) => {
    const { id } = c.req.valid("param");
    const checkIn = await requireCheckIn(id);

    const { action, updated } = await prisma.$transaction(async (tx) => {
      // Conditional on the current row, so a concurrent guidance isn't overwritten.
      await tx.checkIn.updateMany({
        where: { id, status: { not: "guidance_sent" } },
        data: { status: "reviewed" },
      });
      const action = await tx.nurseAction.create({
        data: {
          patientId: checkIn.patientId,
          checkInId: id,
          nurseId: checkIn.patient.primaryNurseId,
          type: "reviewed",
          body: "Check-in reviewed.",
        },
        include: { nurse: true },
      });
      const updated = await tx.checkIn.findUniqueOrThrow({ where: { id } });
      return { action, updated };
    });

    return c.json(
      guidanceResultSchema.parse({ checkIn: toCheckIn(updated), action: toNurseAction(action) }),
      201,
    );
  });

  api.post("/patients/:id/calls", idParam, validate("json", scheduleCallRequestSchema), async (c) => {
    const { id } = c.req.valid("param");
    const { scheduledFor, note } = c.req.valid("json");
    const { patient } = await requirePatient(id);
    const action = await prisma.nurseAction.create({
      data: {
        patientId: id,
        nurseId: patient.primaryNurseId,
        type: "call_scheduled",
        body: note,
        scheduledFor: new Date(scheduledFor),
      },
      include: { nurse: true },
    });
    return c.json(nurseActionSchema.parse(toNurseAction(action)), 201);
  });

  api.post("/patients/:id/call-notes/vox", idParam, async (c) => {
    const { id } = c.req.valid("param");
    const { patient, caregiver } = await requirePatient(id);
    const latest = await prisma.checkIn.findFirst({ where: { patientId: id }, orderBy: { createdAt: "desc" } });

    // Mocks the time a real call transcription would take.
    await new Promise((resolve) => setTimeout(resolve, VOX_DELAY_MS));

    const concerns = latest?.flags.length ? latest.flags.join(", ") : "routine check-in";
    const action = await prisma.nurseAction.create({
      data: {
        patientId: id,
        nurseId: patient.primaryNurseId,
        type: "call_note",
        source: "vox_advantage",
        body: formatCallNote({
          reason: `Call with ${caregiver.name} (${caregiver.relationship}) about ${patient.name}: ${concerns}.`,
          assessment: "Caregiver describes the changes above. No emergency symptoms reported during the call.",
          plan: "Continue daily check-ins. Caregiver to report any new symptoms or changes straight away.",
          followUp: "Nurse to review the next check-in and call back within 48 hours.",
        }),
      },
      include: { nurse: true },
    });
    return c.json(nurseActionSchema.parse(toNurseAction(action)), 201);
  });

  api.get("/check-ins/:id/guidance-drafts", idParam, async (c) => {
    const checkIn = await requireCheckIn(c.req.valid("param").id);
    return c.json(buildGuidanceDrafts(checkIn.caregiver.name, checkIn.flags));
  });

  // --- Family --------------------------------------------------------------

  api.get("/family/home", validate("query", familyHomeQuerySchema), async (c) => {
    const id = c.req.valid("query").patientId ?? (await heroPatientId());
    const { patient, caregiver } = await requirePatient(id);
    const [last, calendar] = await Promise.all([
      prisma.checkIn.findFirst({
        where: { patientId: id },
        orderBy: { createdAt: "desc" },
        select: { id: true, createdAt: true, status: true, isEmergency: true },
      }),
      getCalendar(id),
    ]);
    return c.json(
      familyHomeResponseSchema.parse({
        patient: toPatient(patient),
        caregiver: toCaregiver(caregiver),
        lastCheckIn: last ? { ...last, createdAt: last.createdAt.toISOString() } : null,
        nextCalendarItem: calendar.find((item) => !item.isPast) ?? null,
        careTeam: { nurse: toNurse(patient.primaryNurse), careHome: toCareHome(patient.careHome) },
      }),
    );
  });

  api.post(
    "/check-ins",
    limitCheckIns,
    // Multipart framing adds a little on top of the audio itself.
    bodyLimit({
      maxSize: MAX_AUDIO_BYTES + 1024 * 1024,
      onError: (c) => c.json({ error: "Audio must be 10 MB or smaller." }, 413),
    }),
    async (c) => {
      const contentType = c.req.header("content-type") ?? "";
      if (!contentType.includes("multipart/form-data") && !contentType.includes("x-www-form-urlencoded")) {
        throw new HttpError(400, "Send the check-in as multipart/form-data.");
      }
      const form = await c.req.parseBody();
      const fields = createCheckInFieldsSchema.safeParse({
        patientId: form.patientId,
        caregiverId: form.caregiverId,
        transcriptOverride:
          typeof form.transcriptOverride === "string" ? form.transcriptOverride : undefined,
        durationSec: typeof form.durationSec === "string" ? form.durationSec : undefined,
      });
      if (!fields.success) throw new HttpError(400, describeZodError(fields.error));

      const audio = form.audio instanceof File && form.audio.size > 0 ? form.audio : undefined;
      const row = await processCheckIn({
        ...fields.data,
        audio,
        source: audio ? "voice" : "simulated",
      });
      return c.json(checkInSchema.parse(toCheckIn(row)), 201);
    },
  );

  api.post("/check-ins/simulate", validate("json", simulateRequestSchema), async (c) => {
    const { patientId, kind } = c.req.valid("json");
    const { patient, caregiver } = await requirePatient(patientId ?? (await heroPatientId()));
    const row = await processCheckIn({
      patientId: patient.id,
      caregiverId: caregiver.id,
      transcriptOverride: kind === "hero" ? HERO_TRANSCRIPT : EMERGENCY_TRANSCRIPT,
      durationSec: kind === "hero" ? HERO_DURATION_SEC : EMERGENCY_DURATION_SEC,
      source: "simulated",
    });
    return c.json(checkInSchema.parse(toCheckIn(row)), 201);
  });

  api.get("/patients/:id/messages", idParam, async (c) => {
    const { id } = c.req.valid("param");
    await requirePatient(id);
    const rows = await prisma.message.findMany({ where: { patientId: id }, orderBy: { createdAt: "asc" } });
    return c.json(messageListResponseSchema.parse(rows.map(toMessage)));
  });

  api.post("/patients/:id/messages", idParam, validate("json", createMessageRequestSchema), async (c) => {
    const { id } = c.req.valid("param");
    const { fromRole, authorName, body } = c.req.valid("json");
    const { patient, caregiver } = await requirePatient(id);
    const defaultAuthor =
      fromRole === "family" ? caregiver.name : `${patient.primaryNurse.name}, ${patient.primaryNurse.credentials}`;
    const row = await prisma.message.create({
      data: { patientId: id, fromRole, authorName: authorName ?? defaultAuthor, body },
    });
    return c.json(messageSchema.parse(toMessage(row)), 201);
  });

  // Needed by the nurse view (Task 3): viewing the thread clears the unread badge.
  api.post("/patients/:id/messages/read", idParam, async (c) => {
    const { id } = c.req.valid("param");
    await requirePatient(id);
    await prisma.message.updateMany({
      where: { patientId: id, fromRole: "family", readAt: null },
      data: { readAt: new Date() },
    });
    const rows = await prisma.message.findMany({ where: { patientId: id }, orderBy: { createdAt: "asc" } });
    return c.json(messageListResponseSchema.parse(rows.map(toMessage)));
  });

  api.get("/patients/:id/call-requests", idParam, async (c) => {
    const { id } = c.req.valid("param");
    await requirePatient(id);
    const rows = await prisma.callRequest.findMany({ where: { patientId: id }, orderBy: { createdAt: "desc" } });
    return c.json(callRequestListResponseSchema.parse(rows.map(toCallRequest)));
  });

  api.post("/patients/:id/call-requests", idParam, validate("json", createCallRequestSchema), async (c) => {
    const { id } = c.req.valid("param");
    const { caregiverId, preferredTimes, note } = c.req.valid("json");
    const { caregiver } = await requirePatient(id);
    if (caregiverId) {
      const match = await prisma.caregiver.findFirst({ where: { id: caregiverId, patientId: id } });
      if (!match) throw notFound("Caregiver");
    }
    const row = await prisma.callRequest.create({
      data: {
        patientId: id,
        caregiverId: caregiverId ?? caregiver.id,
        preferredTimes: preferredTimes.map((time) => new Date(time)),
        note,
      },
    });
    return c.json(callRequestSchema.parse(toCallRequest(row)), 201);
  });

  api.post("/call-requests/:id/confirm", idParam, validate("json", confirmCallRequestSchema), async (c) => {
    const { id } = c.req.valid("param");
    const existing = await prisma.callRequest.findUnique({ where: { id } });
    if (!existing) throw notFound("Call request");
    const row = await prisma.callRequest.update({
      where: { id },
      data: { status: "confirmed", confirmedFor: new Date(c.req.valid("json").confirmedFor) },
    });
    return c.json(callRequestSchema.parse(toCallRequest(row)));
  });

  api.get("/patients/:id/calendar", idParam, async (c) => {
    const { id } = c.req.valid("param");
    await requirePatient(id);
    return c.json(await getCalendar(id));
  });

  api.get("/audio/:checkInId", validate("param", checkInIdParamSchema), async (c) => {
    const row = await prisma.checkIn.findUnique({
      where: { id: c.req.valid("param").checkInId },
      select: { audioPath: true },
    });
    if (!row?.audioPath) throw notFound("Audio");
    return streamAudio(c, row.audioPath);
  });

  // --- Shared --------------------------------------------------------------

  api.get("/patients/:id/summary", idParam, async (c) => {
    return c.json(await getCareSummary(c.req.valid("param").id));
  });

  api.post("/demo/reset", async (c) => {
    if (!demoMode) throw new HttpError(403, "Demo mode is off.");
    // Names every app table, so Prisma's _prisma_migrations can't be touched. In a
    // transaction, so polling clients wait for the new data instead of seeing empty tables.
    await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`
          TRUNCATE TABLE care_homes, nurses, patients, caregivers, check_ins, nurse_actions, messages, call_requests
          RESTART IDENTITY CASCADE
        `;
        await seed(tx);
      },
      { timeout: 30_000, maxWait: 10_000 },
    );
    return c.json(demoResetResponseSchema.parse({ ok: true }));
  });

  // --- App -----------------------------------------------------------------

  const app = new Hono();
  app.use("/api/*", cors({ origin: env.WEB_ORIGIN }));
  app.route("/api", api);

  app.notFound((c) => c.json({ error: "Not found." }, 404));

  app.onError((error, c) => {
    if (error instanceof HttpError) return c.json({ error: error.message }, error.status);
    if (error instanceof HTTPException) {
      return c.json({ error: error.message || "Request failed." }, error.status);
    }
    // The detail stays in the server log. Clients never get it, or a stack trace.
    console.error(`${c.req.method} ${c.req.path} failed:`, error);
    return c.json({ error: "Something went wrong on the server." }, 500);
  });

  return app;
}
