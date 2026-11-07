import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { domainsSchema } from "@careos/shared";
import { prisma as sharedPrisma } from "./db";
import type { Prisma, PrismaClient } from "./generated/prisma/client";
import { buildSeedPlan, createRandom, nextMondayAtTen } from "./seedData";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/** Shared by `db:seed` and `POST /demo/reset`, which runs it inside a transaction. */
export async function seed(prisma: PrismaClient | Prisma.TransactionClient): Promise<void> {
  const now = new Date();
  const plan = buildSeedPlan(now);
  const random = createRandom(7);
  const ago = (ms: number) => new Date(now.getTime() - ms);

  await prisma.careHome.create({ data: { ...plan.careHome, createdAt: ago(90 * DAY_MS) } });
  await prisma.nurse.create({ data: { ...plan.nurse, createdAt: ago(90 * DAY_MS) } });

  await prisma.patient.createMany({
    data: plan.patients.map(({ id, spec }) => ({
      id,
      name: spec.name,
      age: spec.age,
      conditions: spec.conditions,
      initials: spec.initials,
      careHomeId: plan.careHome.id,
      primaryNurseId: plan.nurse.id,
      createdAt: ago(60 * DAY_MS),
    })),
  });

  await prisma.caregiver.createMany({
    data: plan.patients.map(({ id, caregiverId, spec }) => ({
      id: caregiverId,
      patientId: id,
      name: spec.caregiver.name,
      relationship: spec.caregiver.relationship,
      createdAt: ago(60 * DAY_MS),
    })),
  });

  await prisma.checkIn.createMany({
    data: plan.patients.flatMap(({ checkIns }) =>
      checkIns.map((row) => ({ ...row, domains: domainsSchema.parse(row.domains) })),
    ),
  });

  await prisma.nurseAction.createMany({ data: plan.actions });

  const [walter, margaret] = plan.patients;
  if (!walter || !margaret) return;

  await prisma.message.createMany({
    data: [
      {
        id: random.uuid(),
        patientId: walter.id,
        fromRole: "nurse",
        authorName: "Priya Sharma, RN",
        body: "Hi Sarah, I saw this week's updates. Let me know if the smaller meals are helping.",
        readAt: ago(30 * HOUR_MS),
        createdAt: ago(32 * HOUR_MS),
      },
      {
        id: random.uuid(),
        patientId: walter.id,
        fromRole: "family",
        authorName: "Sarah Morrison",
        body: "A little, thanks. Is it normal for him to want more naps too?",
        readAt: null,
        createdAt: ago(5 * HOUR_MS),
      },
      {
        id: random.uuid(),
        patientId: margaret.id,
        fromRole: "family",
        authorName: "David Okafor",
        body: "Should Mom see someone about her hip after this morning?",
        readAt: null,
        createdAt: ago(90 * 60 * 1000),
      },
    ],
  });

  // A pending request after the scheduled call, so that call stays Sarah's next item.
  const monday = nextMondayAtTen(now);
  await prisma.callRequest.create({
    data: {
      id: random.uuid(),
      patientId: walter.id,
      caregiverId: walter.caregiverId,
      preferredTimes: [
        new Date(monday.getTime() + 1 * DAY_MS),
        new Date(monday.getTime() + 2 * DAY_MS + 4 * HOUR_MS),
      ],
      note: "Would like to talk about next steps for Dad's appetite.",
      createdAt: ago(20 * HOUR_MS),
    },
  });

  // An earlier call, so the family calendar has something under "Earlier".
  await prisma.nurseAction.create({
    data: {
      id: random.uuid(),
      patientId: walter.id,
      nurseId: plan.nurse.id,
      type: "call_scheduled",
      body: "Introductory call with Sarah.",
      scheduledFor: ago(12 * DAY_MS),
      createdAt: ago(14 * DAY_MS),
    },
  });
}

function isMainModule(): boolean {
  const entry = process.argv[1];
  return entry !== undefined && realpathSync(entry) === fileURLToPath(import.meta.url);
}

if (isMainModule()) {
  seed(sharedPrisma)
    .then(() => console.log("Seeded CareOS demo data."))
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => sharedPrisma.$disconnect());
}
