-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RiskTier" AS ENUM ('urgent', 'watch', 'stable');

-- CreateEnum
CREATE TYPE "CheckInStatus" AS ENUM ('received', 'reviewed', 'guidance_sent');

-- CreateEnum
CREATE TYPE "CheckInSource" AS ENUM ('voice', 'upload', 'simulated');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('guidance', 'call_scheduled', 'call_note', 'reviewed');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('family', 'nurse');

-- CreateEnum
CREATE TYPE "CallRequestStatus" AS ENUM ('requested', 'confirmed', 'cancelled');

-- CreateTable
CREATE TABLE "care_homes" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "care_homes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nurses" (
    "id" UUID NOT NULL,
    "care_home_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "credentials" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nurses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "conditions" TEXT[],
    "initials" TEXT NOT NULL,
    "care_home_id" UUID NOT NULL,
    "primary_nurse_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "caregivers" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "caregivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "check_ins" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "caregiver_id" UUID NOT NULL,
    "duration_sec" INTEGER NOT NULL,
    "audio_path" TEXT,
    "transcript" TEXT NOT NULL,
    "ai_summary" TEXT NOT NULL,
    "domains" JSONB NOT NULL,
    "risk_score" INTEGER NOT NULL,
    "risk_tier" "RiskTier" NOT NULL,
    "flags" TEXT[],
    "is_emergency" BOOLEAN NOT NULL,
    "status" "CheckInStatus" NOT NULL DEFAULT 'received',
    "source" "CheckInSource" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "check_ins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nurse_actions" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "check_in_id" UUID,
    "nurse_id" UUID NOT NULL,
    "type" "ActionType" NOT NULL,
    "body" TEXT NOT NULL,
    "scheduled_for" TIMESTAMPTZ(6),
    "source" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nurse_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "from_role" "Role" NOT NULL,
    "author_name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_requests" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "caregiver_id" UUID NOT NULL,
    "preferred_times" TIMESTAMPTZ(6)[],
    "note" TEXT NOT NULL,
    "status" "CallRequestStatus" NOT NULL DEFAULT 'requested',
    "confirmed_for" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "check_ins_patient_id_created_at_idx" ON "check_ins"("patient_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "nurses" ADD CONSTRAINT "nurses_care_home_id_fkey" FOREIGN KEY ("care_home_id") REFERENCES "care_homes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_care_home_id_fkey" FOREIGN KEY ("care_home_id") REFERENCES "care_homes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_primary_nurse_id_fkey" FOREIGN KEY ("primary_nurse_id") REFERENCES "nurses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caregivers" ADD CONSTRAINT "caregivers_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_caregiver_id_fkey" FOREIGN KEY ("caregiver_id") REFERENCES "caregivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nurse_actions" ADD CONSTRAINT "nurse_actions_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nurse_actions" ADD CONSTRAINT "nurse_actions_check_in_id_fkey" FOREIGN KEY ("check_in_id") REFERENCES "check_ins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nurse_actions" ADD CONSTRAINT "nurse_actions_nurse_id_fkey" FOREIGN KEY ("nurse_id") REFERENCES "nurses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_requests" ADD CONSTRAINT "call_requests_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_requests" ADD CONSTRAINT "call_requests_caregiver_id_fkey" FOREIGN KEY ("caregiver_id") REFERENCES "caregivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
