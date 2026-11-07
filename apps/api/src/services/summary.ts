import {
  DOMAIN_KEYS,
  DOMAIN_NAMES,
  careSummaryResponseSchema,
  domainsSchema,
  type CareSummaryResponse,
  type Provenance,
  type SummaryItem,
} from "@careos/shared";
import { prisma } from "../db";
import { notFound } from "../errors";
import { toCareHome, toCaregiver, toNurse, toPatient } from "../mappers";
import { domainSeries } from "./trends";

const item = (text: string, provenance: Provenance, at: Date | null = null): SummaryItem => ({
  text,
  provenance,
  at: at ? at.toISOString() : null,
});

/** Family-reported until a nurse has acted on that check-in. */
const provenanceFor = (status: string): Provenance =>
  status === "received" ? "family_reported" : "nurse_verified";

const ACTION_LABEL: Record<string, string> = {
  guidance: "Guidance sent",
  call_scheduled: "Call scheduled",
  call_note: "Call documented",
};

export async function getCareSummary(patientId: string): Promise<CareSummaryResponse> {
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: { caregivers: { orderBy: { createdAt: "asc" }, take: 1 }, primaryNurse: true, careHome: true },
  });
  const caregiver = patient?.caregivers[0];
  if (!patient || !caregiver) throw notFound("Patient");

  const [stored, actions] = await Promise.all([
    prisma.checkIn.findMany({ where: { patientId }, orderBy: { createdAt: "asc" } }),
    prisma.nurseAction.findMany({
      where: { patientId, type: { in: ["guidance", "call_scheduled", "call_note"] } },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const checkIns = stored.map((row) => ({ ...row, domains: domainsSchema.parse(row.domains) }));
  const first = checkIns[0];
  const latest = checkIns.at(-1);
  const series = domainSeries(checkIns);
  const provenance = latest ? provenanceFor(latest.status) : "family_reported";

  const trends = DOMAIN_KEYS.map((domain) => {
    const points = series[domain];
    const peak = points.reduce((max, point) => Math.max(max, point.severity), 0);
    const current = latest?.domains[domain].severity ?? 0;
    const text =
      peak === 0
        ? `${DOMAIN_NAMES[domain]}: no concerns reported.`
        : `${DOMAIN_NAMES[domain]}: currently ${current} of 3, highest ${peak} of 3 in this period.`;
    return { domain, label: DOMAIN_NAMES[domain], series: points, item: item(text, provenance) };
  });

  const notableEvents = checkIns
    .filter((row) => row.flags.length > 0)
    .slice(-8)
    .reverse()
    .map((row) => item(row.flags.join(", "), provenanceFor(row.status), row.createdAt));

  const interventions = actions.map((action) =>
    item(`${ACTION_LABEL[action.type] ?? action.type}: ${action.body}`, "nurse_verified", action.createdAt),
  );

  const recent = checkIns.slice(-14);
  const mentioned = recent.filter((row) => row.domains.medications.quote !== null);
  const missed = mentioned.filter((row) => row.domains.medications.severity >= 2);
  const medicationAdherence = mentioned.length
    ? [
        item(
          `Missed doses mentioned in ${missed.length} of the last ${mentioned.length} check-ins that discussed medications.`,
          "family_reported",
        ),
      ]
    : [item("Medications not discussed in recent check-ins.", "family_reported")];

  const tired = recent.filter((row) => row.domains.caregiverStrain.severity >= 1).length;
  const caregiverContext = [
    item(`${caregiver.name} (${caregiver.relationship}) is the primary caregiver.`, "nurse_verified"),
    item(`Reported feeling tired or strained in ${tired} of the last ${recent.length} check-ins.`, "family_reported"),
  ];

  const openConcerns = (latest?.flags ?? []).map((flag) =>
    item(flag, latest?.status === "received" ? "family_reported" : "nurse_verified", latest?.createdAt ?? null),
  );

  return careSummaryResponseSchema.parse({
    patient: toPatient(patient),
    caregiver: toCaregiver(caregiver),
    nurse: toNurse(patient.primaryNurse),
    careHome: toCareHome(patient.careHome),
    dateRange: {
      from: first ? first.createdAt.toISOString() : null,
      to: latest ? latest.createdAt.toISOString() : null,
    },
    checkInCount: checkIns.length,
    status: latest
      ? [item(`Risk ${latest.riskScore} (${latest.riskTier}). ${latest.aiSummary}`, provenance, latest.createdAt)]
      : [],
    trends,
    notableEvents,
    interventions,
    medicationAdherence,
    caregiverContext,
    openConcerns,
  });
}
