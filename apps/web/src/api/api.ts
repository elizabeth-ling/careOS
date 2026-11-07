import {
  calendarResponseSchema,
  callRequestListResponseSchema,
  callRequestSchema,
  careSummaryResponseSchema,
  checkInListResponseSchema,
  checkInSchema,
  confirmCallRequestSchema,
  createCallRequestSchema,
  createCheckInFieldsSchema,
  createMessageRequestSchema,
  demoResetResponseSchema,
  errorResponseSchema,
  familyHomeResponseSchema,
  guidanceDraftsResponseSchema,
  guidanceRequestSchema,
  guidanceResultSchema,
  healthResponseSchema,
  messageListResponseSchema,
  messageSchema,
  nurseActionListResponseSchema,
  nurseActionSchema,
  patientDetailResponseSchema,
  queueQuerySchema,
  queueResponseSchema,
  scheduleCallRequestSchema,
  simulateRequestSchema,
  trendsResponseSchema,
  type ConfirmCallRequest,
  type CreateCallRequest,
  type CreateCheckInFields,
  type CreateMessageRequest,
  type GuidanceRequest,
  type QueueFilter,
  type QueueSort,
  type ScheduleCallRequest,
  type SimulateRequest,
} from "@careos/shared";
import type { ZodType } from "zod";
import { connection } from "./connection";

const BASE = "/api";

/** The API answered with an error status and an `{ error }` message. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** The API could not be reached at all (server down, proxy failure, network). */
export class ApiUnreachableError extends Error {
  constructor() {
    super("Can't reach the CareOS server.");
    this.name = "ApiUnreachableError";
  }
}

/** The API answered, but not in the shape the shared schemas describe. */
export class ApiResponseError extends Error {
  constructor(path: string) {
    super(`Unexpected response from ${path}.`);
    this.name = "ApiResponseError";
  }
}

const GATEWAY_STATUSES = new Set([502, 503, 504]);

async function request<T>(path: string, schema: ZodType<T>, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { accept: "application/json", ...init?.headers },
    });
  } catch {
    connection.markUnreachable();
    throw new ApiUnreachableError();
  }

  const body: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    const parsedError = errorResponseSchema.safeParse(body);
    // The API always answers errors with `{ error }`. Anything else at a 5xx
    // (the dev proxy's own failure page, a gateway timeout) means it isn't up.
    if (GATEWAY_STATUSES.has(response.status) || (response.status >= 500 && !parsedError.success)) {
      connection.markUnreachable();
      throw new ApiUnreachableError();
    }
    connection.markReachable();
    throw new ApiError(
      response.status,
      parsedError.success ? parsedError.data.error : `Request failed (${response.status}).`,
    );
  }

  connection.markReachable();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    console.error(`Response from ${path} failed validation`, parsed.error);
    throw new ApiResponseError(path);
  }
  return parsed.data;
}

function json(method: "POST", body?: unknown): RequestInit {
  return {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  };
}

const enc = encodeURIComponent;

export const api = {
  health: () => request("/health", healthResponseSchema),

  // --- Nurse ---------------------------------------------------------------

  queue: (filter: QueueFilter = "all", sort: QueueSort = "risk") => {
    const query = queueQuerySchema.parse({ filter, sort });
    return request(`/nurse/queue?filter=${query.filter}&sort=${query.sort}`, queueResponseSchema);
  },

  patient: (id: string) => request(`/patients/${enc(id)}`, patientDetailResponseSchema),

  checkIns: (patientId: string, limit = 50) =>
    request(`/patients/${enc(patientId)}/check-ins?limit=${limit}`, checkInListResponseSchema),

  trends: (patientId: string, days = 42) =>
    request(`/patients/${enc(patientId)}/trends?days=${days}`, trendsResponseSchema),

  nurseActions: (patientId: string) =>
    request(`/patients/${enc(patientId)}/actions`, nurseActionListResponseSchema),

  guidanceDrafts: (checkInId: string) =>
    request(`/check-ins/${enc(checkInId)}/guidance-drafts`, guidanceDraftsResponseSchema),

  sendGuidance: (checkInId: string, input: GuidanceRequest) =>
    request(
      `/check-ins/${enc(checkInId)}/guidance`,
      guidanceResultSchema,
      json("POST", guidanceRequestSchema.parse(input)),
    ),

  markReviewed: (checkInId: string) =>
    request(`/check-ins/${enc(checkInId)}/review`, guidanceResultSchema, json("POST")),

  scheduleCall: (patientId: string, input: ScheduleCallRequest) =>
    request(
      `/patients/${enc(patientId)}/calls`,
      nurseActionSchema,
      json("POST", scheduleCallRequestSchema.parse(input)),
    ),

  generateCallNote: (patientId: string) =>
    request(`/patients/${enc(patientId)}/call-notes/vox`, nurseActionSchema, json("POST")),

  // --- Family --------------------------------------------------------------

  familyHome: (patientId?: string) =>
    request(
      patientId ? `/family/home?patientId=${enc(patientId)}` : "/family/home",
      familyHomeResponseSchema,
    ),

  createCheckIn: (fields: CreateCheckInFields, audio?: Blob) => {
    const valid = createCheckInFieldsSchema.parse(fields);
    const form = new FormData();
    form.set("patientId", valid.patientId);
    form.set("caregiverId", valid.caregiverId);
    if (valid.transcriptOverride) form.set("transcriptOverride", valid.transcriptOverride);
    if (valid.durationSec) form.set("durationSec", String(valid.durationSec));
    if (audio) form.set("audio", audio, audio instanceof File ? audio.name : "check-in.webm");
    return request("/check-ins", checkInSchema, { method: "POST", body: form });
  },

  simulateCheckIn: (input: SimulateRequest) =>
    request("/check-ins/simulate", checkInSchema, json("POST", simulateRequestSchema.parse(input))),

  messages: (patientId: string) =>
    request(`/patients/${enc(patientId)}/messages`, messageListResponseSchema),

  sendMessage: (patientId: string, input: CreateMessageRequest) =>
    request(
      `/patients/${enc(patientId)}/messages`,
      messageSchema,
      json("POST", createMessageRequestSchema.parse(input)),
    ),

  markMessagesRead: (patientId: string) =>
    request(`/patients/${enc(patientId)}/messages/read`, messageListResponseSchema, json("POST")),

  callRequests: (patientId: string) =>
    request(`/patients/${enc(patientId)}/call-requests`, callRequestListResponseSchema),

  createCallRequest: (patientId: string, input: CreateCallRequest) =>
    request(
      `/patients/${enc(patientId)}/call-requests`,
      callRequestSchema,
      json("POST", createCallRequestSchema.parse(input)),
    ),

  confirmCallRequest: (callRequestId: string, input: ConfirmCallRequest) =>
    request(
      `/call-requests/${enc(callRequestId)}/confirm`,
      callRequestSchema,
      json("POST", confirmCallRequestSchema.parse(input)),
    ),

  calendar: (patientId: string) =>
    request(`/patients/${enc(patientId)}/calendar`, calendarResponseSchema),

  /** Audio is streamed by the browser, not fetched as JSON; check-ins carry `audioUrl` too. */
  audioUrl: (checkInId: string) => `${BASE}/audio/${enc(checkInId)}`,

  // --- Shared --------------------------------------------------------------

  careSummary: (patientId: string) =>
    request(`/patients/${enc(patientId)}/summary`, careSummaryResponseSchema),

  demoReset: () => request("/demo/reset", demoResetResponseSchema, json("POST")),
};
