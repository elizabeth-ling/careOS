# Task 5 of 5 — Family sub-pages, care summary, demo mode (and optional real AI)

Finish the product loop and make the demo bulletproof. Read `docs/DESIGN.md`, `src/store.ts`, `src/lib/processCheckIn.ts` and the existing pages first. Family pages stay **simple**: a page title, one list or one form, and a "‹ Home" back link. No dashboards.

## Family sub-pages

**`/family/check-ins` — Check-in history.** All of Walter's check-ins, newest first. Each item shows:
- Date and time, duration, and a one-line plain-language summary.
- A **3-step status stepper**: Received → Reviewed by Nurse Priya → Guidance sent.
  - Done steps: filled olive circles with a white check, joined by olive lines.
  - Pending steps: hollow sage circles, joined by sage lines.
- If guidance exists, the nurse's reply in a cream panel with Priya's avatar and the time.
- If still `received`: "Nurse Priya usually replies within 4 hours."

**`/family/history` — Health history.** Plain-language trends, not clinical scores:
- One row per domain: a coloured dot, the plain name, a sentence, and a tiny 64×24 sparkline with no axes. For example:
  - "Appetite: Lower over the past 3 weeks. Nurse Priya is aware."
  - "Sleep: Steady this week."
- A row for the caregiver herself, e.g. "And you, Sarah: You've mentioned feeling tired in 3 of your last 5 check-ins." It links to `/family/care-team`.
- Then a "Care summary" section with a "View care summary ›" button linking to `/summary/:patientId`.

**`/family/care-team` — Contact care team.**
- Priya's card: avatar, "Priya Sharma, RN", "Maple Grove Care Home", "Usually replies within 4 hours".
- Two actions:
  - **Message:** a textarea plus Send. The message is stored and appears in the nurse's sidebar "Messages" count.
  - **Request a call:** pick 3 preferred times; this creates a pending call request that the nurse sees in Scheduled calls.
- The 911 / Health811 line.

**`/family/calendar` — Calendar.** Upcoming items as a simple list, from `call_scheduled` actions plus family call requests (with a "Requested" or "Confirmed" badge). Past items sit in a collapsed "Earlier" section. No month grid.

## Care summary — `/summary/:patientId` (reachable from both views)

A clean, printable, document-style page for a long-term care transition.
- **Header:** CareOS logo, "Nurse-verified care summary", patient demographics, date range, number of check-ins, reviewing nurse.
- **Sections:**
  - Current status
  - Trends by domain (small charts)
  - Notable events timeline (falls, new symptoms)
  - Interventions and guidance given
  - Medication adherence
  - Caregiver context
  - Open concerns
- Tag every item "Nurse-verified" (olive check) or "Family-reported" (grey).
- **Buttons:**
  - "Print / Save as PDF" calls `window.print()`, with print CSS that hides the app chrome and uses black-on-white with 12pt body.
  - "Share with care home" opens a mock dialog asking for a facility email.

## Demo mode

A small gear button fixed to the bottom-left corner of every page (above the nurse account block in the nurse view) opens a "Demo controls" popover:
- **Reset demo data** calls `resetDemo()`.
- **Simulate Sarah's check-in** runs `processCheckIn(null)` instantly, with no recording. This is the backup for when the mic or wifi fails on stage.
- **Simulate emergency check-in** uses a transcript containing "chest pain" to show the safety banner.
- **Jump to:** Family home, Nurse queue, Walter's patient page, Care summary.

## Polish pass

- Empty states for every list, skeletons while "processing", and toasts on every action.
- Focus rings on all interactive elements. Check contrast: muted text `#5B6150` on white or cream passes 4.5:1, and nothing should be lighter.
- Check every route at 390px and 1440px. The family view should feel phone-first.
- Remove leftover placeholder pages, and make sure nav items without a page show a simple "Coming soon" state rather than a 404.

## Optional — real AI behind `processCheckIn` (only if time allows)

Keep the simulated path as the fallback, so the live demo never dies.
- Add a tiny Express or Hono server (`/server`) with one endpoint: `POST /api/process-checkin` (multipart audio).
  1. Transcribe with a speech-to-text API. Keys go in `.env` and are never shipped to the browser.
  2. Call Claude via the Anthropic SDK with **tool use and a strict JSON schema**: the 8 domains, each `{severity 0–3, summary, quote}` with `quote` an exact substring, plus `aiSummary` and `questions[]`.
  3. Validate with zod. If any `quote` is not found in the transcript, drop that quote.
  4. Return JSON. The client then computes risk with the same rules as Task 4 (red flags + severities + drift from baseline), so ranking stays explainable.
- In the client: if the request fails or takes longer than 12 seconds, fall back to the simulated result and show a quiet toast: "Using offline demo mode".

## Acceptance criteria (full demo path)

1. Family home → record (or Simulate) → Done shows "What we heard".
2. `/nurse` → Walter is #1 at 82, "New".
3. Open Walter → send a suggested guidance draft → schedule a call for Mon 10:00 AM.
4. `/family/check-ins` shows "Guidance sent" with Priya's reply. `/family/calendar` shows the call.
5. Care summary prints cleanly.
6. Reset demo data restores everything. A refresh at any step loses nothing.