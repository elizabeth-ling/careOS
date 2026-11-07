# Task 3 of 5 — Nurse view: triage queue, patient detail and actions

Build the nurse screens on top of the API (Task 1) and the design system and hooks (Task 2). Read `docs/DESIGN.md`, `src/api/` and `src/components/` first, and reuse them. Open `context/ui/nurse-view.png` and `context/ui/nurse-view-2.png` first: `/nurse` must match them.

## A. Triage queue — `/nurse`

**1. Title row**
- Left: "Triage queue" (34px, weight 400). Under it, muted 14px: today's date plus "· Ranked by check-in content, red-flag rules and change from each patient's own baseline".
- Right: an "Export" secondary button (downloads the current queue as CSV, client-side) and a "Start rounds ›" primary button (opens the top unreviewed patient).

**2. Four stat cards** from `queue.stats`. Each card has a small square colour dot with a label, a 38px number and a muted one-liner:

| Card | Dot | Number | One-liner |
|---|---|---|---|
| Needs attention | urgent | urgent count | "Walter M. and Margaret O. waiting" (from the urgent patients' names) |
| Watch | amber | watch count | "Drifting from their baseline" |
| Stable | olive | stable count | "No new concerns this week" |
| Avg response time | blue | e.g. "3.2h" | "Target: under 4 hours" |

**3. Queue card** (white, radius 8, 1px border, overflow hidden)
- **Toolbar:** filter buttons (All, Urgent, Watch, Stable, Reviewed today, each with its count; the active one is ink with white text) and a "Sort by" select (Risk score, Most recent, Longest unreviewed). Both are passed to `GET /nurse/queue`.
- **Table:** a real `<table>` in a horizontally scrolling wrapper (min-width ~1020px). The header row is on `#FAFCF5`, 13px muted. Columns:
  - **Risk:** rank, plus the score in a RiskPill.
  - **Patient:** sage avatar with initials, name (600), and muted "age · conditions".
  - **Caregiver:** name, plus relationship.
  - **Why flagged:** up to 3 TierChips; stable patients show "No changes".
  - **14-day trend:** a 96×28 Sparkline in the tier colour.
  - **Last check-in:** relative time, plus a StatusBadge (New = info tint, Reviewed = olive tint, Guidance sent = solid olive).
  - **Action:** "Review ›" (primary) for New; otherwise "Open" (secondary).
- Rows have a hover background, and clicking a row opens the patient page.
- **Footnote row:** "AI ranking supports triage only. Clinical decisions remain with the nurse."
- **Risk header tooltip:** explains the ranking.

**4. Two cards side by side** for the top-ranked patient (they stack on narrow screens):
- **Changes from baseline**
  - A legend: Appetite `#B54708`, Cognition `#2E5E8C`, and a Baseline band.
  - A Recharts line chart over 21 days, y from 0 to 3, with a shaded 0–0.5 band.
  - Two insight rows from the API, each with a small tinted icon square (radius 4).
- **Latest check-in**
  - Meta line ("from Sarah (daughter) · Today, 1:43 PM · 0:48"), with a tier badge on the right.
  - An AiSummaryPanel.
  - A HighlightedTranscript: each domain's quote is wrapped in `<mark>`, tinted by domain, with a tooltip naming the domain.
  - Buttons: "Send guidance ›", "Schedule call" and "Mark reviewed". These open the same actions as section C.

The queue polls every 4s, so a new family check-in re-sorts the table live.

## B. Patient detail — `/nurse/patients/:id`

**Header card**
- A "‹ Triage queue" back link.
- Avatar, name, age · conditions · caregiver · care home.
- The RiskPill and flag chips.
- Actions: Send guidance ›, Schedule call, Mark reviewed, and "Generate care summary" (links to `/summary/:id`).

**Left column**
1. **AI summary** of the selected check-in.
2. **Changes from baseline** insights, with trend arrows.
3. **Domain trends:** a grid of 8 small charts (severity 0–3 over 6 weeks, with a baseline band). Flagged domains get a tinted title and outline.
4. **Transcript:** a real `<audio>` player when `audio_path` exists (`GET /audio/:id`), otherwise a mock bar. Then the HighlightedTranscript.

**Right column**
1. **Caregiver wellbeing:** a caregiver-strain sparkline plus a note.
2. **Check-in history:** a list; clicking an item switches the left column to that check-in.
3. **Care notes:** a timeline of nurse actions, with "Documented via Vox Advantage" tags where relevant. Below it, a "Document call with Vox Advantage" button.
4. **Messages from family:** the thread, plus a reply box. Viewing it marks the messages read.

## C. Actions (mutations; invalidate queue, patient and actions queries)

- **Send guidance:**
  - A right-side Sheet with a textarea.
  - The 3 drafts from `GET /check-ins/:id/guidance-drafts` appear as chips; clicking one fills the textarea.
  - "Send to Sarah" posts the guidance.
- **Schedule call:** a dialog with date, time and note. Pending family call requests are listed at the top with a one-click "Confirm".
- **Mark reviewed:** posts the review.
- **Vox Advantage note:** a loading state ("Transcribing call…"), then the structured note appears in Care notes.
- Every action shows a toast, and its button is disabled while the request is pending.

## Acceptance criteria

- Seed data shows Walter #1 (82), Margaret #2 (74), then Henri, Grace and Anand, then the stable patients. Filters and sort match the API.
- Run `POST /api/check-ins/simulate` from another tab: within about 4 seconds the queue shows Walter's new check-in as "New".
- Sending guidance turns his badge into "Guidance sent", and it persists after a refresh and an API restart.
- No horizontal page scroll at ≥ 1280px; on narrow screens only the table scrolls.
- Every AI-generated block carries the "verify against transcript" label.
