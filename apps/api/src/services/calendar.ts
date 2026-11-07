import { calendarResponseSchema, type CalendarItem } from "@careos/shared";
import { prisma } from "../db";

export async function getCalendar(patientId: string, now = new Date()): Promise<CalendarItem[]> {
  const [calls, requests] = await Promise.all([
    prisma.nurseAction.findMany({
      where: { patientId, type: "call_scheduled", scheduledFor: { not: null } },
      include: { nurse: true },
    }),
    prisma.callRequest.findMany({
      where: { patientId, status: { not: "cancelled" } },
      include: { patient: { include: { primaryNurse: true } } },
    }),
  ]);

  const items = [
    ...calls.map((call) => ({
      id: call.id,
      kind: "scheduled_call" as const,
      status: "scheduled" as const,
      at: call.scheduledFor as Date,
      title: `Call with Nurse ${call.nurse.name.split(" ")[0]}`,
      note: call.body,
      preferredTimes: [] as Date[],
    })),
    ...requests.map((request) => {
      const times = [...request.preferredTimes].sort((a, b) => a.getTime() - b.getTime());
      const nextOffered = times.find((time) => time > now) ?? times[0] ?? request.createdAt;
      const nurse = request.patient.primaryNurse.name.split(" ")[0];
      return {
        id: request.id,
        kind: "call_request" as const,
        status: request.status === "confirmed" ? ("confirmed" as const) : ("requested" as const),
        at: request.confirmedFor ?? nextOffered,
        title: `Call with Nurse ${nurse}`,
        note: request.note,
        preferredTimes: request.status === "confirmed" ? [] : times,
      };
    }),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  return calendarResponseSchema.parse(
    items.map((item) => ({
      ...item,
      at: item.at.toISOString(),
      preferredTimes: item.preferredTimes.map((time) => time.toISOString()),
      isPast: item.at <= now,
    })),
  );
}
