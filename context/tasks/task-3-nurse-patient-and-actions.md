# Task 3 of 5 — Nurse view: patient detail and the response loop

Build `/nurse/patients/:id` and the nurse actions, so a nurse's response shows up on the family side (Task 5 builds that side). Read `docs/DESIGN.md`, `src/store.ts` and the Task 2 components first; reuse the badges, chips, sparklines and AI-summary panel rather than re-creating them.

## Patient page layout

**Header card**
- A back link: "‹ Triage queue".
- Avatar, name, then age · conditions · "Caregiver: Sarah Morrison (daughter)" · "Maple Grove Care Home".
- The risk pill and "why flagged" chips.
- Actions on the right:
  - "Send guidance ›" (primary)
  - "Schedule call" (secondary)
  - "Mark reviewed" (text)
  - "Generate care summary" (secondary, links to `/summary/:patientId`, built in Task 5)

**Left column** (wide)
1. **AI summary of the latest check-in** (the same panel as Task 2).
2. **Changes from baseline:** insight rows with trend arrows, from `changesFromBaseline()`.
3. **Domain trends:** a grid of 8 small Recharts line charts, one per domain. Each shows severity 0–3 over 6 weeks, with a shaded baseline band. Flagged domains get an amber or red title and a thin tinted outline; the rest stay neutral.
4. **Transcript:** a mock audio bar (play button, waveform made of bars, duration), then the transcript with highlighted quotes as in Task 2.

**Right column**
1. **Caregiver wellbeing:** a small caregiver-strain sparkline, plus a note such as "Sarah mentioned feeling tired in 3 of her last 5 check-ins."
2. **Check-in history:** a list of past check-ins (date, one-line summary, status badge). Clicking one swaps the left column to that check-in.
3. **Care notes:** a timeline of `NurseAction`s (author, time, type icon, body). Below it, a secondary button "Document call with Vox Advantage".

## Actions (store actions, not component state)

- **Send guidance**
  - Opens a right-side `Sheet` containing a textarea.
  - Above the textarea are **3 suggested drafts** as clickable chips, built from the check-in's flags. For Walter:
    - *"Thanks Sarah. New confusion plus lower appetite is worth checking. Can you look for signs of a UTI (fever, burning, going more often) and offer extra fluids? I'll call you today at 4 PM."*
    - A shorter reassurance-plus-plan option.
    - A "please call 811 / go to urgent care if…" escalation option.
  - Clicking a chip fills the textarea; the nurse can edit before sending.
  - "Send to Sarah" saves a `guidance` action and sets the check-in status to `guidance_sent`.
- **Schedule call:** a dialog with a date, time and note. It saves a `call_scheduled` action with `scheduledFor`, which appears in the family's Calendar in Task 5.
- **Mark reviewed:** sets the status to `reviewed` (if it isn't already `guidance_sent`) and saves a `reviewed` action.
- **Document call with Vox Advantage** (mock):
  - Shows a 1.5s loading state ("Transcribing call…"), then saves a structured `call_note` with `source: "vox_advantage"`.
  - The note body reads: Reason for call / Assessment / Plan / Follow-up.
  - It renders in Care notes with a small "Documented via Vox Advantage" tag.
- Every action fires a toast and updates the triage queue's status badge, counts and sort immediately.

## Persistence

Persist the Zustand store to `localStorage` (wrapped in try/catch) so the demo survives a refresh. Add a `resetDemo()` store action that restores the seed data; Task 5 adds a button for it.

## Acceptance criteria

- From `/nurse`, clicking "Review" on Walter opens his page with all sections populated.
- Sending guidance updates his status to "Guidance sent" in the queue.
- Scheduling a call and documenting a call both add entries to Care notes.
- Refreshing the page keeps all changes; `resetDemo()` restores the seed.
- No AI disclaimers are missing: every AI-generated block carries the "AI-generated · verify against transcript" label.