# Task 1 of 5 — Backend: Postgres, API and check-in pipeline

You are a staff engineer building **CareOS**, a hackathon prototype:
- Families caring for an aging parent at home record short voice check-ins.
- The backend turns each check-in into a structured update and ranks patients by risk.
- Nurses from a local care home triage the queue and respond, and families see the response.

This task builds the whole backend so tasks 2–5 only build UI on top of it. **Demo data only: no real patient information anywhere.**

## Stack and repo layout

A monorepo with npm workspaces, Node 20 and TypeScript everywhere.

```
careOS/              (repo root; build the app here, alongside context/)
  CLAUDE.md          project rules; read first
  context/tasks/     these task files (read-only)
  context/ui/        reference screenshots (read-only)
  docs/DESIGN.md     (created in Task 2)
  apps/api/          Hono (@hono/node-server), Prisma ORM (prisma + @prisma/client), zod, @hono/zod-validator
  apps/api/prisma/   schema.prisma, migrations/
  apps/web/          (created in Task 2)
  packages/shared/   zod schemas, TS types, risk rules — imported by api AND web
  docker-compose.yml Postgres 16
  .env.example
```

- **`docker-compose.yml`:** `postgres:16`, user, password and database all `careos`, port 5432, a named volume, and a healthcheck.
- **`.env.example`:**
  - `DATABASE_URL=postgres://careos:careos@localhost:5432/careos`
  - `PORT=8787`
  - `UPLOAD_DIR=./uploads`
  - `AI_MODE=simulated`
  - `DEMO_MODE=true`
  - `WEB_ORIGIN=http://localhost:5173`
- **Root scripts:**
  - `db:up` (docker compose up -d)
  - `db:generate` (`prisma generate`)
  - `db:migrate` (`prisma migrate dev`) and `db:deploy` (`prisma migrate deploy`, for hosted databases)
  - `db:seed` (`prisma db seed`)
  - `db:reset` (`prisma migrate reset --force`, which drops, migrates and seeds)
  - `db:studio` (`prisma studio`)
  - `dev` (api + web together, via `concurrently`)
  - `test` (vitest)
- Use **`prisma migrate`, not `prisma db push`**, and commit `prisma/migrations/`.
- Register the seed command (`tsx src/seed.ts`) where the installed Prisma version expects it: the `prisma.seed` key in `package.json`, or `prisma.config.ts` in newer versions.
- Use one shared `PrismaClient` instance (`src/db.ts`); don't create one per request.
- Add a README "Getting started" section that goes from zero to running in 4 commands.

## Database schema (`apps/api/prisma/schema.prisma`)

**Conventions**
- Models are PascalCase with camelCase fields in TypeScript, mapped to snake_case tables and columns with `@@map` and `@map`.
- Primary keys: `id String @id @default(uuid()) @db.Uuid`.
- Every model has `createdAt DateTime @default(now()) @db.Timestamptz(6)`.
- Relations use `@relation` with `onDelete: Cascade` from patient to its children, so a demo reset is clean.

**Enums**
- `RiskTier`: urgent, watch, stable
- `CheckInStatus`: received, reviewed, guidance_sent
- `CheckInSource`: voice, upload, simulated
- `ActionType`: guidance, call_scheduled, call_note, reviewed
- `Role`: family, nurse
- `CallRequestStatus`: requested, confirmed, cancelled

**Models**
- `CareHome` (`care_homes`): name.
- `Nurse` (`nurses`): careHomeId → CareHome, name, credentials.
- `Patient` (`patients`): name, age, conditions `String[]`, initials, careHomeId, primaryNurseId → Nurse.
- `Caregiver` (`caregivers`): patientId → Patient, name, relationship.
- `CheckIn` (`check_ins`):
  - patientId, caregiverId, durationSec Int, audioPath String?, transcript, aiSummary.
  - `domains Json`. Prisma doesn't type JSON, so **always parse it with the shared zod schema** on read and write.
  - riskScore Int, riskTier RiskTier, flags `String[]`, isEmergency Boolean.
  - status CheckInStatus `@default(received)`, source CheckInSource.
  - `@@index([patientId, createdAt(sort: Desc)])`.
- `NurseAction` (`nurse_actions`): patientId, checkInId?, nurseId, type ActionType, body, scheduledFor DateTime?, source String? (e.g. `vox_advantage`).
- `Message` (`messages`): patientId, fromRole Role, authorName, body, readAt DateTime?.
- `CallRequest` (`call_requests`): patientId, caregiverId, preferredTimes `DateTime[] @db.Timestamptz(6)`, note, status CallRequestStatus `@default(requested)`, confirmedFor DateTime?.

**Querying notes**
- Use Prisma's normal client API for CRUD.
- Use `prisma.$transaction` wherever two writes must happen together (guidance + status change, review + action).
- Use typed `prisma.$queryRaw` (tagged template, never string-concatenated SQL) for the two queries Prisma can't express efficiently:
  - the queue's `DISTINCT ON` latest-check-in-per-patient
  - the 14-day daily-max risk series
- Map Prisma's camelCase results to the shared zod DTOs in one place (`src/mappers.ts`), so the web never sees raw Prisma types.

## `packages/shared`

- **zod schemas plus inferred types** for every table row and every API request and response.
- **Domains:** appetite, sleep, mobility, cognition, mood, pain, medications, caregiverStrain. Each is `{ severity: 0|1|2|3, summary: string, quote: string | null }`, where `quote` must be an exact substring of the transcript.
- **Plain-language domain labels** for families: Eating, Sleep, Getting around, Memory, Mood, Pain, Medications, You.
- **`risk.ts`:**
  - `tierFor(score)`: urgent ≥ 70, watch 40–69, stable < 40.
  - `redFlags(transcript, domains)`. Points:
    - new confusion +25
    - fall +30
    - not eating 2+ days +20
    - emergency terms +60
  - `scoreCheckIn({ redFlags, domains, baselines })`:
    - Score = red-flag points + (sum of severities × 6) + (4 for each domain above its baseline), capped at 100.
    - Returns the score, the tier and human-readable flags such as "New confusion" and "Appetite ↓ 3 wks".
  - `EMERGENCY_TERMS`: chest pain, can't breathe, not breathing, unconscious, stroke, can't get up, bleeding heavily.
- Unit tests (vitest) for `tierFor`, `redFlags` and `scoreCheckIn`.

## Services (`apps/api/src/services/`)

- **`baseline.ts`:**
  - Per-domain baseline = mean severity over the 14 days *before* the check-in.
  - `changesFromBaseline(patientId)` returns insights such as "Appetite below baseline in 5 of the last 7 check-ins" and "Cognition: first time misidentifying a family member (today)".
- **`processCheckIn.ts`:** one pipeline used by both real and simulated input.
  - Input: `{ patientId, caregiverId, audio?: file, transcriptOverride?: string, source }`.
  - Steps:
    1. Save the audio to `UPLOAD_DIR`.
    2. Get a transcript. In `AI_MODE=simulated`, use the override or Walter's hero transcript (below).
    3. Extract domains with keyword rules:
       - dinner, ate, eating → appetite
       - "mom's name", confused, forgot → cognition
       - pills, medication → medications
       - tired, exhausted → caregiverStrain
       - fell, fall → mobility
       Quotes must be exact substrings.
    4. Write an `ai_summary` from a template.
    5. Compute baselines and the score.
    6. Insert the row with status `received`.
  - Keep the extraction behind an interface (`extractDomains(transcript)`) so Task 5 can swap in Claude.
- **`queue.ts`:**
  - Latest check-in per patient (`DISTINCT ON (patient_id) … ORDER BY patient_id, created_at DESC`), joined to the patient and caregiver.
  - Plus a 14-day series of daily max risk per patient, for sparklines.
  - Plus counts by tier, the number of unreviewed check-ins, and the average response time (time from check-in to first nurse action).
  - Supports `filter` = all | urgent | watch | stable | reviewed and `sort` = risk | recent | longest_unreviewed.

## REST API (`/api`, JSON, zod-validated, errors as `{ error }`, CORS for `WEB_ORIGIN`)

**Nurse**
- `GET /health`
- `GET /nurse/queue?filter=&sort=` → `{ stats, rows }`
- `GET /patients/:id` → patient, caregiver, nurse, latest check-in, insights
- `GET /patients/:id/check-ins?limit=`
- `GET /patients/:id/trends?days=42` → per-domain daily series, baselines, daily risk
- `GET /patients/:id/actions`
- `POST /check-ins/:id/guidance { body }` → creates a `guidance` action and sets status to `guidance_sent` (in a transaction)
- `POST /check-ins/:id/review` → sets status to `reviewed` (unless it is already `guidance_sent`) and creates a `reviewed` action
- `POST /patients/:id/calls { scheduledFor, note }` → `call_scheduled`
- `POST /patients/:id/call-notes/vox` → mock: waits ~1.5s, then saves a `call_note` with sections Reason / Assessment / Plan / Follow-up and `source: "vox_advantage"`
- `GET /check-ins/:id/guidance-drafts` → 3 suggested replies built from the flags, rule-based for now. For Walter:
  - *"Thanks Sarah. New confusion plus lower appetite is worth checking. Can you look for signs of a UTI (fever, burning, going more often) and offer extra fluids? I'll call you today at 4 PM."*
  - A short reassurance-plus-plan option.
  - A "call 811 / urgent care if…" escalation option.

**Family**
- `GET /family/home?patientId=` → last check-in time and status, next calendar item, care team
- `POST /check-ins` (multipart: `audio?`, `patientId`, `caregiverId`, `transcriptOverride?`) → the processed check-in
- `POST /check-ins/simulate { patientId, kind: "hero" | "emergency" }`
- `GET|POST /patients/:id/messages`
- `GET|POST /patients/:id/call-requests`, and `POST /call-requests/:id/confirm { confirmedFor }`
- `GET /patients/:id/calendar` → upcoming scheduled calls plus requests, merged and sorted
- `GET /audio/:checkInId` → streams the audio file

**Shared**
- `GET /patients/:id/summary` → the care-summary payload: status, trends, notable events, interventions, medication adherence, caregiver context, open concerns. Each item is tagged `nurse_verified` or `family_reported`.
- `POST /demo/reset` → truncates every table (`TRUNCATE … RESTART IDENTITY CASCADE` via `prisma.$executeRaw`), then calls the same `seed(prisma)` function as `db:seed`. Only active when `DEMO_MODE=true`.

## Seed (`apps/api/src/seed.ts`)

Export a `seed(prisma: PrismaClient)` function, so `db:seed` and `POST /demo/reset` share it. Use `createMany` for the bulk check-in history so seeding takes seconds. Deterministic: use a seeded random generator. All timestamps are **relative to seed time**, so the demo always looks fresh.

**People**
- Care home: Maple Grove Care Home.
- Nurse: Priya Sharma, RN.

**Patients**, each with 4–6 weeks of check-ins every 1–3 days, and realistic transcripts of 2–5 spoken sentences:

| Patient | Age | Conditions | Caregiver | Latest risk | Flags | Latest | Status |
|---|---|---|---|---|---|---|---|
| **Walter Morrison** (hero) | 82 | early dementia, hypertension | Sarah Morrison (daughter) | 82 | New confusion, Appetite ↓ 3 wks | now − 12 min | received |
| Margaret Okafor | 88 | osteoporosis, CHF | David Okafor (son) | 74 | Fall reported, Mobility ↓ | now − 2 h | received |
| Henri Tremblay | 79 | Parkinson's | Louise Tremblay (spouse) | 58 | Sleep ↓ 10 days, Caregiver strain | | reviewed |
| Grace Li | 84 | type 2 diabetes | Kevin Li (son) | 47 | Missed meds ×2 | | guidance_sent |
| Anand Mehta | 77 | COPD | Ritu Mehta (daughter) | 41 | Breathless on stairs | | received |
| Dorothy Campbell | 91 | mild cognitive impairment | Ellen Campbell (daughter-in-law) | 28 | stable | | |
| Frank Russo | 80 | osteoarthritis | Maria Russo (spouse) | 19 | stable | | |
| Rose Fontaine | 86 | hypertension | Julie Fontaine (granddaughter) | 12 | stable | | |

**Walter's history**
- Over the last 21 days his appetite drifts 0→2 and cognition 0→2 in small steps.
- His latest transcript (48s):
  > "Dad barely touched his dinner again tonight, maybe a few bites. And this morning he called me by my mom's name, which he's never done before. He seemed a bit off all day honestly. He did take all his pills though. I'm pretty tired."
- An earlier guidance reply, 2 days ago:
  > "Thanks Sarah. Half portions a few days in a row is worth watching. Try smaller meals more often, and keep a glass of water within reach. Let's keep tracking it here."
- A scheduled call with Priya, next Monday at 10:00 AM.

## Acceptance criteria

- From a clean clone: `npm i && npm run db:up && npm run db:reset && npm run dev` gives a healthy `GET /api/health`.
- `GET /api/nurse/queue` returns Walter #1 (82), Margaret #2 (74), then Henri, Grace and Anand, then the stable patients.
- `POST /api/check-ins/simulate {kind:"hero"}` creates a new Walter check-in at about 82 and he stays #1. `kind:"emergency"` returns `is_emergency: true`.
- Guidance, review, call and message endpoints all persist, and are visible after an API restart.
- `npm run db:studio` shows the seeded data. A fresh `npm run db:reset` applies the committed migrations with no schema drift.
- `npm test` passes. Add a `scripts/smoke.ts` that calls every endpoint once and prints ✓/✗.
- No secrets are committed. The API never returns stack traces.
