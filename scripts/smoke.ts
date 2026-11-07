// Calls every API endpoint once against a running server and prints ✓ or ✗.
// Usage: npm run smoke (API_URL defaults to http://localhost:8787/api).
// It writes real rows, then finishes with the demo reset, which restores the seed.
import {
  callRequestListResponseSchema,
  callRequestSchema,
  calendarResponseSchema,
  careSummaryResponseSchema,
  checkInListResponseSchema,
  checkInSchema,
  demoResetResponseSchema,
  errorResponseSchema,
  familyHomeResponseSchema,
  guidanceDraftsResponseSchema,
  guidanceResultSchema,
  healthResponseSchema,
  messageListResponseSchema,
  messageSchema,
  nurseActionListResponseSchema,
  nurseActionSchema,
  patientDetailResponseSchema,
  queueResponseSchema,
  trendsResponseSchema,
} from "@careos/shared";
import type { ZodType } from "zod";

const BASE = process.env.API_URL ?? "http://localhost:8787/api";
const failures: string[] = [];
const WALTER = "Walter Morrison";

async function call<T>(
  label: string,
  path: string,
  schema: ZodType<T> | null,
  init?: RequestInit,
  check?: (value: T) => string | null,
): Promise<T | undefined> {
  try {
    const response = await fetch(`${BASE}${path}`, init);
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    if (!schema) {
      await response.arrayBuffer();
      console.log(`✓ ${label}`);
      return undefined;
    }
    const value = schema.parse(await response.json());
    const problem = check?.(value);
    if (problem) throw new Error(problem);
    console.log(`✓ ${label}`);
    return value;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failures.push(label);
    console.log(`✗ ${label}\n    ${message.slice(0, 400)}`);
    return undefined;
  }
}

const post = (body?: unknown): RequestInit => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

async function main() {
  await call("GET /health", "/health", healthResponseSchema);

  const queue = await call(
    "GET /nurse/queue",
    "/nurse/queue?filter=all&sort=risk",
    queueResponseSchema,
    undefined,
    (value) => (value.rows[0]?.patient.name === WALTER ? null : "Walter isn't first"),
  );
  const top = queue?.rows[0];
  if (!top) throw new Error("The queue is empty. Has the database been seeded?");
  const patientId = top.patient.id;
  const caregiverId = top.caregiver.id;
  const p = `/patients/${patientId}`;

  await call("GET /patients/:id", p, patientDetailResponseSchema);
  await call("GET /patients/:id/check-ins", `${p}/check-ins?limit=5`, checkInListResponseSchema, undefined, (v) =>
    v.length === 5 ? null : `expected 5 rows, got ${v.length}`,
  );
  await call("GET /patients/:id/trends", `${p}/trends?days=42`, trendsResponseSchema);
  await call("GET /patients/:id/actions", `${p}/actions`, nurseActionListResponseSchema);
  await call("GET /check-ins/:id/guidance-drafts", `/check-ins/${top.latestCheckIn.id}/guidance-drafts`, guidanceDraftsResponseSchema);

  await call("POST /check-ins/:id/review", `/check-ins/${top.latestCheckIn.id}/review`, guidanceResultSchema, post(), (v) =>
    v.checkIn.status === "reviewed" ? null : `status is ${v.checkIn.status}`,
  );
  await call("POST /check-ins/:id/guidance", `/check-ins/${top.latestCheckIn.id}/guidance`, guidanceResultSchema, post({ body: "Smoke test guidance." }), (v) =>
    v.checkIn.status === "guidance_sent" ? null : `status is ${v.checkIn.status}`,
  );
  await call("POST /patients/:id/calls", `${p}/calls`, nurseActionSchema, post({ scheduledFor: inDays(3), note: "Smoke test call" }));
  await call("POST /patients/:id/call-notes/vox", `${p}/call-notes/vox`, nurseActionSchema, post(), (v) =>
    v.source === "vox_advantage" && v.sections ? null : "not a structured Vox note",
  );

  await call("GET /family/home", `/family/home?patientId=${patientId}`, familyHomeResponseSchema);

  const form = new FormData();
  form.set("patientId", patientId);
  form.set("caregiverId", caregiverId);
  form.set("transcriptOverride", "He ate well at dinner. I'm a bit tired.");
  form.set("audio", new File([new Uint8Array(64)], "../../smoke.webm", { type: "audio/webm" }));
  const upload = await call("POST /check-ins", "/check-ins", checkInSchema, { method: "POST", body: form }, (v) =>
    v.audioPath && !v.audioPath.includes("/") && !v.audioPath.includes("smoke") ? null : `unsafe audio path ${v.audioPath}`,
  );
  await call("GET /audio/:checkInId", `/audio/${upload?.id}`, null);

  await call("POST /check-ins/simulate hero", "/check-ins/simulate", checkInSchema, post({ kind: "hero" }), (v) =>
    Math.abs(v.riskScore - 82) <= 1 ? null : `score is ${v.riskScore}`,
  );
  await call("POST /check-ins/simulate emergency", "/check-ins/simulate", checkInSchema, post({ patientId, kind: "emergency" }), (v) =>
    v.is_emergency === true && v.isEmergency === true ? null : "not flagged as an emergency",
  );

  await call("GET /patients/:id/messages", `${p}/messages`, messageListResponseSchema);
  await call("POST /patients/:id/messages", `${p}/messages`, messageSchema, post({ fromRole: "family", body: "Smoke test message." }));
  await call("POST /patients/:id/messages/read", `${p}/messages/read`, messageListResponseSchema, post());

  await call("GET /patients/:id/call-requests", `${p}/call-requests`, callRequestListResponseSchema);
  const request = await call("POST /patients/:id/call-requests", `${p}/call-requests`, callRequestSchema, post({ preferredTimes: [inDays(4)], note: "Smoke test request" }));
  await call("POST /call-requests/:id/confirm", `/call-requests/${request?.id}/confirm`, callRequestSchema, post({ confirmedFor: inDays(4) }), (v) =>
    v.status === "confirmed" ? null : `status is ${v.status}`,
  );
  await call("GET /patients/:id/calendar", `${p}/calendar`, calendarResponseSchema);

  await call("GET /patients/:id/summary", `${p}/summary`, careSummaryResponseSchema);

  // Errors must be clean JSON. This one is expected to come back as a 404.
  try {
    const response = await fetch(`${BASE}/does-not-exist`);
    errorResponseSchema.parse(await response.json());
    if (response.status !== 404) throw new Error(`HTTP ${response.status}`);
    console.log("✓ unknown route returns { error }");
  } catch (error) {
    failures.push("unknown route");
    console.log(`✗ unknown route returns { error }\n    ${String(error)}`);
  }

  await call("POST /demo/reset", "/demo/reset", demoResetResponseSchema, post());
  await call("GET /nurse/queue after reset", "/nurse/queue", queueResponseSchema, undefined, (v) =>
    v.rows.length === 8 && v.rows[0]?.patient.name === WALTER ? null : "seed wasn't restored",
  );

  console.log(failures.length === 0 ? "\nAll endpoints passed." : `\n${failures.length} failed: ${failures.join(", ")}`);
  process.exitCode = failures.length === 0 ? 0 : 1;
}

main().catch((error: unknown) => {
  console.log(`✗ smoke test aborted: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
