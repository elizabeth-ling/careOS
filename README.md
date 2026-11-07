# CareOS

**Professional support for families caring at home.**

Families record a short voice check-in about an aging parent. AI turns it into a structured update, and nurses at a local care home see every family in one explainable triage queue, so they can respond before a slow decline becomes a crisis.

**[Live demo](TODO) · [Demo video](TODO)**

> **Build in progress:** this repo currently holds the product specs and design mockups, and the app is being built from them. Remove this note, and update [What's real in this prototype](#whats-real-in-this-prototype), before submitting.

![Family home screen with a single voice check-in button](context/ui/family-view.png)

## The problem

Warning signs in home care rarely arrive as one dramatic event. A parent eats a little less each week, or calls their daughter by the wrong name for the first time. Each moment looks minor on its own, and the person noticing it is an exhausted family member who may not know whether it matters.

Nurses have the expertise to spot the pattern, but they aren't in the home. Forms ask too much of tired caregivers, and a nurse can't phone every family every day.

## The solution

CareOS connects the two sides with one simple loop:

```mermaid
flowchart LR
    A[Family records<br/>a voice check-in] --> B[AI structures it<br/>across 8 care domains]
    B --> C[AI scores it on the<br/>interRAI rubric]
    C --> D[Nurse reviews a<br/>ranked triage queue]
    D --> E[Guidance or a call<br/>goes back to the family]
    E --> A
```

- **For families, one button.** Tap, talk, and get a clear reply. There are no forms or dashboards to learn.
- **For nurses, a ranked queue.** Each patient shows why they were flagged, how they've trended, and the caregiver's own words.
- **For care transitions, a printable summary.** Each item is tagged as nurse-verified or family-reported, ready to hand to a care home.

## Demo: one check-in, start to finish

Walter, 82, has early dementia and lives at home with support from his daughter, Sarah.

1. **Sarah checks in.** She says: *"Dad barely touched his dinner again tonight... this morning he called me by my mom's name, which he's never done before... I'm pretty tired."*
2. **CareOS shows what it heard.** Sarah sees plain-language notes on eating, memory and mood, medications, and how she's doing herself.
3. **Walter reaches the top of the queue.** Nurse Priya sees him at #1 with a critical score of 82, flagged for new confusion and a three-week drop in appetite.
4. **Priya sees the pattern.** The trend chart shows a gradual decline that would be easy to miss day to day. Each interRAI item score links to the quote it came from.
5. **Priya responds.** She edits a suggested draft asking Sarah to look for signs of a UTI, then schedules a call.
6. **Sarah gets the reply.** The guidance appears under Check-ins, and the call appears on her calendar.
7. **The record travels.** Priya generates a care summary that can be printed or saved as a PDF.

![Nurse triage queue ranking patients by risk](context/ui/nurse-view.png)

![Baseline trend chart beside an AI summary and highlighted transcript](context/ui/nurse-view-2.png)

## What makes it different

**It scores against a recognised clinical rubric.** Instead of inventing its own scale, CareOS scores each check-in against the interRAI rubric, the assessment framework used in home and long-term care. The LLM reads the caregiver's description and rates the relevant interRAI items. That result is the patient's **critical score**, and it ranks the triage queue.

| interRAI scale | What it captures | Range |
|---|---|---|
| CHESS | Health instability (appetite, weight loss, breathlessness, swelling) | 0–5 |
| Cognitive Performance Scale (CPS) | Memory, decision-making, being understood | 0–6 |
| ADL Hierarchy | Help needed with daily activities | 0–6 |
| Depression Rating Scale (DRS) | Low mood, anxiety, withdrawal | 0–14 |
| Pain Scale | Pain frequency and intensity | 0–4 |

Each scale is normalised and combined into a single critical score from 0 to 100.

**Every score shows its evidence.** For each item it rates, the LLM must quote the caregiver's words that support it. A nurse sees which items drove the critical score and can check each one against the transcript.

**It looks for change, not just bad days.** Each patient's scale scores are charted against their own recent baseline, so a gradual drift is visible even when no single check-in looks alarming.

**It cares for the caregiver too.** Caregiver strain is tracked as its own domain, so a nurse can notice when the person providing care is struggling.

## Safety by design

- **Nurses make the decisions.** AI ranks and drafts, but a nurse reviews and sends every response.
- **AI output can be checked.** AI-generated content, including the critical score, is labeled, and each supporting quote must match the transcript exactly.
- **Emergencies aren't left in a queue.** Terms like "chest pain" or "not breathing" immediately tell the family to call 911. This check is a fixed keyword rule, so it never depends on the LLM.
- **Sources stay visible.** Care summaries separate what a nurse verified from what a family reported.

## What's real in this prototype

We want judges to know exactly what they're looking at.

| Area | Status |
|---|---|
| Family and nurse screens, including the full response loop | Planned as working features |
| interRAI critical score | Planned: LLM scoring against the interRAI rubric |
| Baselines and trend insights | Planned as working logic, running on seeded data |
| Microphone recording and live level meter | Planned as working in the browser |
| Transcription and domain extraction | **Simulated:** uses a scripted transcript and keyword rules |
| Patients, families, and nurses | **Fictional:** seeded data with no real patient information |
| Data storage | **Browser only:** `localStorage`, with no backend |
| Call documentation through Vox Advantage | **Mocked** |

CareOS is a hackathon prototype, not a medical device. It should not be used with real patient data or for real clinical decisions.

## Tech stack

- **Frontend:** React, TypeScript, Vite, React Router
- **UI:** Tailwind CSS, shadcn/ui, lucide-react, Recharts
- **State:** Zustand, persisted to `localStorage`
- **Audio:** MediaRecorder and Web Audio APIs

## Getting started

You need Node 20.19 or newer and Docker. From the repo root:

```bash
npm i              # installs everything and generates the Prisma client
npm run db:up      # starts Postgres 16 in Docker on port 5432
npm run db:reset   # drops the local database, applies migrations and seeds demo data
npm run dev        # API on http://localhost:8787/api (and the web app once it exists)
```

No `.env` is needed for local development: the API falls back to the values in `.env.example`. To change them, copy it to `.env`. With `NODE_ENV=production` there are no fallbacks, so `DATABASE_URL` must be set and `DEMO_MODE` defaults to off.

Other commands: `npm test` runs the unit tests, `npm run typecheck` checks types, `npm run smoke` calls every endpoint of a running API, `npm run db:studio` opens Prisma Studio, and `npm run db:deploy` applies migrations to a hosted database.

The app includes demo controls, opened from the gear icon in the bottom-left corner. They can reset the data, simulate a check-in if the mic or wifi fails, trigger the emergency flow, and jump between screens.

## What's next

- **Real AI pipeline:** speech-to-text, then Claude with a strict JSON schema that returns the interRAI item scores and a supporting quote for each.
- **Backend:** a server and a Postgres database to replace browser storage, with accounts and access controls for each care home.
- **Clinical validation:** interRAI is designed for trained assessors, not family self-report. Before real-world use, nurses would need to check how well LLM scores from caregiver descriptions match a full interRAI assessment.
- **interRAI licensing:** the interRAI instruments are licensed, so a real deployment would need a licence from interRAI.
- **Privacy and compliance:** a review of health privacy requirements before handling real patient data.

## Team

TODO: names and roles
