import { z } from "zod";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const riskTierSchema = z.enum(["urgent", "watch", "stable"]);
export type RiskTier = z.infer<typeof riskTierSchema>;

export const checkInStatusSchema = z.enum(["received", "reviewed", "guidance_sent"]);
export type CheckInStatus = z.infer<typeof checkInStatusSchema>;

export const checkInSourceSchema = z.enum(["voice", "upload", "simulated"]);
export type CheckInSource = z.infer<typeof checkInSourceSchema>;

export const actionTypeSchema = z.enum(["guidance", "call_scheduled", "call_note", "reviewed"]);
export type ActionType = z.infer<typeof actionTypeSchema>;

export const roleSchema = z.enum(["family", "nurse"]);
export type Role = z.infer<typeof roleSchema>;

export const callRequestStatusSchema = z.enum(["requested", "confirmed", "cancelled"]);
export type CallRequestStatus = z.infer<typeof callRequestStatusSchema>;

// ---------------------------------------------------------------------------
// Domains
// ---------------------------------------------------------------------------

export const DOMAIN_KEYS = [
  "appetite",
  "sleep",
  "mobility",
  "cognition",
  "mood",
  "pain",
  "medications",
  "caregiverStrain",
] as const;

export const domainKeySchema = z.enum(DOMAIN_KEYS);
export type DomainKey = z.infer<typeof domainKeySchema>;

/** Clinical names, used in nurse-facing flags and insights. */
export const DOMAIN_NAMES: Record<DomainKey, string> = {
  appetite: "Appetite",
  sleep: "Sleep",
  mobility: "Mobility",
  cognition: "Cognition",
  mood: "Mood",
  pain: "Pain",
  medications: "Medications",
  caregiverStrain: "Caregiver strain",
};

/** Plain-language labels for families. */
export const DOMAIN_LABELS: Record<DomainKey, string> = {
  appetite: "Eating",
  sleep: "Sleep",
  mobility: "Getting around",
  cognition: "Memory",
  mood: "Mood",
  pain: "Pain",
  medications: "Medications",
  caregiverStrain: "You",
};

export const severitySchema = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);
export type Severity = z.infer<typeof severitySchema>;

export const domainEntrySchema = z.object({
  severity: severitySchema,
  summary: z.string(),
  /** Must be an exact substring of the transcript. See `quotesMatchTranscript`. */
  quote: z.string().nullable(),
});
export type DomainEntry = z.infer<typeof domainEntrySchema>;

export const domainsSchema = z.object({
  appetite: domainEntrySchema,
  sleep: domainEntrySchema,
  mobility: domainEntrySchema,
  cognition: domainEntrySchema,
  mood: domainEntrySchema,
  pain: domainEntrySchema,
  medications: domainEntrySchema,
  caregiverStrain: domainEntrySchema,
});
export type Domains = z.infer<typeof domainsSchema>;

export const baselinesSchema = z.object({
  appetite: z.number(),
  sleep: z.number(),
  mobility: z.number(),
  cognition: z.number(),
  mood: z.number(),
  pain: z.number(),
  medications: z.number(),
  caregiverStrain: z.number(),
});
export type Baselines = z.infer<typeof baselinesSchema>;

export function quotesMatchTranscript(transcript: string, domains: Domains): boolean {
  return DOMAIN_KEYS.every((key) => {
    const quote = domains[key].quote;
    return quote === null || (quote.length > 0 && transcript.includes(quote));
  });
}

/** Clears any quote that isn't an exact substring of the transcript. */
export function dropUnmatchedQuotes(transcript: string, domains: Domains): Domains {
  const result = { ...domains };
  for (const key of DOMAIN_KEYS) {
    const quote = result[key].quote;
    if (quote !== null && (quote.length === 0 || !transcript.includes(quote))) {
      result[key] = { ...result[key], quote: null };
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Table rows (as DTOs: dates are ISO strings, ids are uuids)
// ---------------------------------------------------------------------------

const id = z.uuid();
const timestamp = z.iso.datetime();

export const uuidParamSchema = z.object({ id });
export const checkInIdParamSchema = z.object({ checkInId: id });

export const careHomeSchema = z.object({ id, name: z.string(), createdAt: timestamp });
export type CareHome = z.infer<typeof careHomeSchema>;

export const nurseSchema = z.object({
  id,
  careHomeId: id,
  name: z.string(),
  credentials: z.string(),
  createdAt: timestamp,
});
export type Nurse = z.infer<typeof nurseSchema>;

export const patientSchema = z.object({
  id,
  name: z.string(),
  age: z.number().int(),
  conditions: z.array(z.string()),
  initials: z.string(),
  careHomeId: id,
  primaryNurseId: id,
  createdAt: timestamp,
});
export type Patient = z.infer<typeof patientSchema>;

export const caregiverSchema = z.object({
  id,
  patientId: id,
  name: z.string(),
  relationship: z.string(),
  createdAt: timestamp,
});
export type Caregiver = z.infer<typeof caregiverSchema>;

export const checkInSchema = z.object({
  id,
  patientId: id,
  caregiverId: id,
  durationSec: z.number().int(),
  audioPath: z.string().nullable(),
  /** Where the web client can stream the audio, or null when there is none. */
  audioUrl: z.string().nullable(),
  transcript: z.string(),
  aiSummary: z.string(),
  domains: domainsSchema,
  riskScore: z.number().int().min(0).max(100),
  riskTier: riskTierSchema,
  flags: z.array(z.string()),
  isEmergency: z.boolean(),
  /**
   * Same value as `isEmergency`. The acceptance criteria and the family view
   * name this field `is_emergency`, so the safety flag is exposed under both.
   */
  is_emergency: z.boolean(),
  status: checkInStatusSchema,
  source: checkInSourceSchema,
  createdAt: timestamp,
});
export type CheckIn = z.infer<typeof checkInSchema>;

export const callNoteSectionsSchema = z.object({
  reason: z.string(),
  assessment: z.string(),
  plan: z.string(),
  followUp: z.string(),
});
export type CallNoteSections = z.infer<typeof callNoteSectionsSchema>;

export const nurseActionSchema = z.object({
  id,
  patientId: id,
  checkInId: id.nullable(),
  nurseId: id,
  nurseName: z.string(),
  type: actionTypeSchema,
  body: z.string(),
  /** The Reason / Assessment / Plan / Follow-up parts of a structured call note. */
  sections: callNoteSectionsSchema.nullable(),
  scheduledFor: timestamp.nullable(),
  source: z.string().nullable(),
  createdAt: timestamp,
});
export type NurseAction = z.infer<typeof nurseActionSchema>;

export const messageSchema = z.object({
  id,
  patientId: id,
  fromRole: roleSchema,
  authorName: z.string(),
  body: z.string(),
  readAt: timestamp.nullable(),
  createdAt: timestamp,
});
export type Message = z.infer<typeof messageSchema>;

export const callRequestSchema = z.object({
  id,
  patientId: id,
  caregiverId: id,
  preferredTimes: z.array(timestamp),
  note: z.string(),
  status: callRequestStatusSchema,
  confirmedFor: timestamp.nullable(),
  createdAt: timestamp,
});
export type CallRequest = z.infer<typeof callRequestSchema>;

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

const nonEmptyText = z.string().trim().min(1).max(5000);

export const queueFilterSchema = z.enum(["all", "urgent", "watch", "stable", "reviewed"]);
export type QueueFilter = z.infer<typeof queueFilterSchema>;

export const queueSortSchema = z.enum(["risk", "recent", "longest_unreviewed"]);
export type QueueSort = z.infer<typeof queueSortSchema>;

export const queueQuerySchema = z.object({
  filter: queueFilterSchema.default("all"),
  sort: queueSortSchema.default("risk"),
});

export const limitQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const trendsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(42),
});

export const familyHomeQuerySchema = z.object({ patientId: id.optional() });

export const guidanceRequestSchema = z.object({ body: nonEmptyText });
export type GuidanceRequest = z.infer<typeof guidanceRequestSchema>;

export const scheduleCallRequestSchema = z.object({
  scheduledFor: z.iso.datetime({ offset: true }),
  note: z.string().trim().max(5000).default(""),
});
export type ScheduleCallRequest = z.input<typeof scheduleCallRequestSchema>;

export const createCheckInFieldsSchema = z.object({
  patientId: id,
  caregiverId: id,
  transcriptOverride: z.string().trim().max(20000).optional(),
});
export type CreateCheckInFields = z.infer<typeof createCheckInFieldsSchema>;

export const simulateRequestSchema = z.object({
  /** Defaults to the hero patient, so the demo button needs no ids. */
  patientId: id.optional(),
  kind: z.enum(["hero", "emergency"]),
});
export type SimulateRequest = z.infer<typeof simulateRequestSchema>;

export const createMessageRequestSchema = z.object({
  fromRole: roleSchema,
  /** Defaults to the patient's caregiver or primary nurse, by role. */
  authorName: z.string().trim().min(1).max(200).optional(),
  body: nonEmptyText,
});
export type CreateMessageRequest = z.infer<typeof createMessageRequestSchema>;

export const createCallRequestSchema = z.object({
  /** Defaults to the patient's caregiver. */
  caregiverId: id.optional(),
  preferredTimes: z.array(z.iso.datetime({ offset: true })).min(1).max(3),
  note: z.string().trim().max(5000).default(""),
});
export type CreateCallRequest = z.input<typeof createCallRequestSchema>;

export const confirmCallRequestSchema = z.object({
  confirmedFor: z.iso.datetime({ offset: true }),
});
export type ConfirmCallRequest = z.infer<typeof confirmCallRequestSchema>;

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

export const errorResponseSchema = z.object({ error: z.string() });
export type ErrorResponse = z.infer<typeof errorResponseSchema>;

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  database: z.literal("ok"),
  aiMode: z.enum(["simulated", "live"]),
  demoMode: z.boolean(),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const riskPointSchema = z.object({
  date: z.iso.date(),
  maxRisk: z.number().int(),
});
export type RiskPoint = z.infer<typeof riskPointSchema>;

export const queueStatsSchema = z.object({
  counts: z.object({
    all: z.number().int(),
    urgent: z.number().int(),
    watch: z.number().int(),
    stable: z.number().int(),
    reviewed: z.number().int(),
  }),
  unreviewedCheckIns: z.number().int(),
  unreadFamilyMessages: z.number().int(),
  /** Mean time from a check-in to its first nurse action, or null with no data. */
  avgResponseHours: z.number().nullable(),
  /** Names of the urgent patients still waiting, highest risk first. */
  urgentWaiting: z.array(z.string()),
});
export type QueueStats = z.infer<typeof queueStatsSchema>;

export const queueRowSchema = z.object({
  /** Position by risk across all patients, regardless of filter and sort. */
  rank: z.number().int().min(1),
  patient: patientSchema,
  caregiver: caregiverSchema,
  latestCheckIn: checkInSchema,
  series: z.array(riskPointSchema),
});
export type QueueRow = z.infer<typeof queueRowSchema>;

export const queueResponseSchema = z.object({
  stats: queueStatsSchema,
  rows: z.array(queueRowSchema),
});
export type QueueResponse = z.infer<typeof queueResponseSchema>;

export const insightSchema = z.object({
  domain: domainKeySchema,
  kind: z.enum(["below_baseline", "first_time"]),
  text: z.string(),
});
export type Insight = z.infer<typeof insightSchema>;

export const patientDetailResponseSchema = z.object({
  patient: patientSchema,
  caregiver: caregiverSchema,
  nurse: nurseSchema,
  careHome: careHomeSchema,
  latestCheckIn: checkInSchema.nullable(),
  insights: z.array(insightSchema),
});
export type PatientDetailResponse = z.infer<typeof patientDetailResponseSchema>;

export const checkInListResponseSchema = z.array(checkInSchema);
export const nurseActionListResponseSchema = z.array(nurseActionSchema);
export const messageListResponseSchema = z.array(messageSchema);
export const callRequestListResponseSchema = z.array(callRequestSchema);

export const domainPointSchema = z.object({
  date: z.iso.date(),
  severity: severitySchema,
});
export type DomainPoint = z.infer<typeof domainPointSchema>;

export const trendsResponseSchema = z.object({
  days: z.number().int(),
  domains: z.object({
    appetite: z.array(domainPointSchema),
    sleep: z.array(domainPointSchema),
    mobility: z.array(domainPointSchema),
    cognition: z.array(domainPointSchema),
    mood: z.array(domainPointSchema),
    pain: z.array(domainPointSchema),
    medications: z.array(domainPointSchema),
    caregiverStrain: z.array(domainPointSchema),
  }),
  baselines: baselinesSchema,
  risk: z.array(riskPointSchema),
});
export type TrendsResponse = z.infer<typeof trendsResponseSchema>;

export const guidanceDraftSchema = z.object({
  kind: z.enum(["detailed", "reassurance", "escalation"]),
  label: z.string(),
  body: z.string(),
});
export type GuidanceDraft = z.infer<typeof guidanceDraftSchema>;

export const guidanceDraftsResponseSchema = z.array(guidanceDraftSchema).length(3);

export const guidanceResultSchema = z.object({
  checkIn: checkInSchema,
  action: nurseActionSchema,
});
export type GuidanceResult = z.infer<typeof guidanceResultSchema>;

export const calendarItemSchema = z.object({
  id,
  kind: z.enum(["scheduled_call", "call_request"]),
  status: z.enum(["scheduled", "requested", "confirmed"]),
  at: timestamp,
  title: z.string(),
  note: z.string(),
  /** All the times the family offered, for a call request that isn't confirmed yet. */
  preferredTimes: z.array(timestamp),
  isPast: z.boolean(),
});
export type CalendarItem = z.infer<typeof calendarItemSchema>;

export const calendarResponseSchema = z.array(calendarItemSchema);

export const familyHomeResponseSchema = z.object({
  patient: patientSchema,
  caregiver: caregiverSchema,
  lastCheckIn: z
    .object({ id, createdAt: timestamp, status: checkInStatusSchema })
    .nullable(),
  nextCalendarItem: calendarItemSchema.nullable(),
  careTeam: z.object({ nurse: nurseSchema, careHome: careHomeSchema }),
});
export type FamilyHomeResponse = z.infer<typeof familyHomeResponseSchema>;

export const provenanceSchema = z.enum(["nurse_verified", "family_reported"]);
export type Provenance = z.infer<typeof provenanceSchema>;

export const summaryItemSchema = z.object({
  text: z.string(),
  provenance: provenanceSchema,
  at: timestamp.nullable(),
});
export type SummaryItem = z.infer<typeof summaryItemSchema>;

export const careSummaryResponseSchema = z.object({
  patient: patientSchema,
  caregiver: caregiverSchema,
  nurse: nurseSchema,
  careHome: careHomeSchema,
  dateRange: z.object({ from: timestamp.nullable(), to: timestamp.nullable() }),
  checkInCount: z.number().int(),
  status: z.array(summaryItemSchema),
  trends: z.array(
    z.object({
      domain: domainKeySchema,
      label: z.string(),
      series: z.array(domainPointSchema),
      item: summaryItemSchema,
    }),
  ),
  notableEvents: z.array(summaryItemSchema),
  interventions: z.array(summaryItemSchema),
  medicationAdherence: z.array(summaryItemSchema),
  caregiverContext: z.array(summaryItemSchema),
  openConcerns: z.array(summaryItemSchema),
});
export type CareSummaryResponse = z.infer<typeof careSummaryResponseSchema>;

export const demoResetResponseSchema = z.object({ ok: z.literal(true) });
export type DemoResetResponse = z.infer<typeof demoResetResponseSchema>;
