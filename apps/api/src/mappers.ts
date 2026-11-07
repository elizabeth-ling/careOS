import {
  callNoteSectionsSchema,
  callRequestSchema,
  careHomeSchema,
  caregiverSchema,
  checkInSchema,
  domainsSchema,
  messageSchema,
  nurseActionSchema,
  nurseSchema,
  patientSchema,
  type CallNoteSections,
  type CallRequest,
  type CareHome,
  type Caregiver,
  type CheckIn,
  type Message,
  type Nurse,
  type NurseAction,
  type Patient,
} from "@careos/shared";
import type {
  CallRequest as DbCallRequest,
  CareHome as DbCareHome,
  Caregiver as DbCaregiver,
  CheckIn as DbCheckIn,
  Message as DbMessage,
  Nurse as DbNurse,
  NurseAction as DbNurseAction,
  Patient as DbPatient,
} from "./generated/prisma/client";

const iso = (date: Date) => date.toISOString();
const isoOrNull = (date: Date | null) => (date ? date.toISOString() : null);

export function toCareHome(row: DbCareHome): CareHome {
  return careHomeSchema.parse({ id: row.id, name: row.name, createdAt: iso(row.createdAt) });
}

export function toNurse(row: DbNurse): Nurse {
  return nurseSchema.parse({
    id: row.id,
    careHomeId: row.careHomeId,
    name: row.name,
    credentials: row.credentials,
    createdAt: iso(row.createdAt),
  });
}

export function toPatient(row: DbPatient): Patient {
  return patientSchema.parse({
    id: row.id,
    name: row.name,
    age: row.age,
    conditions: row.conditions,
    initials: row.initials,
    careHomeId: row.careHomeId,
    primaryNurseId: row.primaryNurseId,
    createdAt: iso(row.createdAt),
  });
}

export function toCaregiver(row: DbCaregiver): Caregiver {
  return caregiverSchema.parse({
    id: row.id,
    patientId: row.patientId,
    name: row.name,
    relationship: row.relationship,
    createdAt: iso(row.createdAt),
  });
}

export function toCheckIn(row: DbCheckIn): CheckIn {
  return checkInSchema.parse({
    id: row.id,
    patientId: row.patientId,
    caregiverId: row.caregiverId,
    durationSec: row.durationSec,
    audioPath: row.audioPath,
    audioUrl: row.audioPath ? `/api/audio/${row.id}` : null,
    transcript: row.transcript,
    aiSummary: row.aiSummary,
    domains: domainsSchema.parse(row.domains),
    questions: row.questions,
    riskScore: row.riskScore,
    riskTier: row.riskTier,
    flags: row.flags,
    isEmergency: row.isEmergency,
    is_emergency: row.isEmergency,
    status: row.status,
    source: row.source,
    createdAt: iso(row.createdAt),
  });
}

const CALL_NOTE_HEADINGS = ["Reason", "Assessment", "Plan", "Follow-up"] as const;

export function formatCallNote(sections: CallNoteSections): string {
  return [
    `Reason: ${sections.reason}`,
    `Assessment: ${sections.assessment}`,
    `Plan: ${sections.plan}`,
    `Follow-up: ${sections.followUp}`,
  ].join("\n");
}

function parseCallNote(body: string): CallNoteSections | null {
  const lines = body.split("\n");
  const values = CALL_NOTE_HEADINGS.map((heading) => {
    const line = lines.find((text) => text.startsWith(`${heading}: `));
    return line?.slice(heading.length + 2);
  });
  const [reason, assessment, plan, followUp] = values;
  if (!reason || !assessment || !plan || !followUp) return null;
  return callNoteSectionsSchema.parse({ reason, assessment, plan, followUp });
}

export function toNurseAction(row: DbNurseAction & { nurse: Pick<DbNurse, "name" | "credentials"> }): NurseAction {
  return nurseActionSchema.parse({
    id: row.id,
    patientId: row.patientId,
    checkInId: row.checkInId,
    nurseId: row.nurseId,
    nurseName: `${row.nurse.name}, ${row.nurse.credentials}`,
    type: row.type,
    body: row.body,
    sections: row.type === "call_note" ? parseCallNote(row.body) : null,
    scheduledFor: isoOrNull(row.scheduledFor),
    source: row.source,
    createdAt: iso(row.createdAt),
  });
}

export function toMessage(row: DbMessage): Message {
  return messageSchema.parse({
    id: row.id,
    patientId: row.patientId,
    fromRole: row.fromRole,
    authorName: row.authorName,
    body: row.body,
    readAt: isoOrNull(row.readAt),
    createdAt: iso(row.createdAt),
  });
}

export function toCallRequest(row: DbCallRequest): CallRequest {
  return callRequestSchema.parse({
    id: row.id,
    patientId: row.patientId,
    caregiverId: row.caregiverId,
    preferredTimes: row.preferredTimes.map(iso),
    note: row.note,
    status: row.status,
    confirmedFor: isoOrNull(row.confirmedFor),
    createdAt: iso(row.createdAt),
  });
}
