# Task 4 of 5 — Family view: home, voice check-in and sub-pages

Build Sarah's side of CareOS on top of the API and design system. The family view must be **as simple as possible**: one primary action and four doors. Read `docs/DESIGN.md`, `src/api/` and `src/components/` first. Open `context/ui/family-view.png` first: the home page must match it exactly.

## A. Home — `/family` (data from `GET /family/home`)

1. **Greeting:** "Good afternoon, Sarah" (44px, weight 400; the greeting follows the time of day). Under it, 18px: "How is Walter doing today?"
2. **Check-in card** (white, radius 8, 1px border, padding 32px, overflow hidden)
   - A **120px round olive mic button** with a 10px sage-50 ring and a white mic icon, `aria-label` "Start a voice check-in about Walter".
   - Beside it:
     - "Check in about Walter" (30px / 400)
     - "Tap and talk. Tell us how he's doing in your own words. Nurse Priya will see it." (max-width ~430px)
     - "Last check-in: today at 1:43 PM" (live)
   - Decoration: three nested rounded squares at the right edge, `aria-hidden`, and never under the text:
     - sage-50, 340px, radius 96
     - sage-100, 210px, radius 64
     - sage-200, 110px, radius 36
3. **Four blocks** in a responsive grid: `repeat(auto-fit, minmax(min(210px, 100%), 1fr))`, 16px gap. Each block is a full-card link:
   - White, radius 8, 1px border, padding 22px, min-height 168px.
   - A 44px sage-50 icon square, a 20px / 500 title, a live one-line status, and an olive link with a chevron pinned to the bottom.
   - Hover: border `#C7D3B0`, background `#FCFEF7`.

   | Block | Icon | Live status | Link → route |
   |---|---|---|---|
   | Check-ins | mic | e.g. "Today's check-in is waiting for Nurse Priya" / "Nurse Priya replied" | View all → `/family/check-ins` |
   | Health history | file-text | "Trends and notes from Nurse Priya" | Open → `/family/history` |
   | Contact care team | message | "Priya Sharma, RN · replies within 4 hours" | Message or call → `/family/care-team` |
   | Calendar | calendar | next item, e.g. "Next: call with Nurse Priya, Mon Nov 9 at 10:00 AM" | See schedule → `/family/calendar` |

4. **Emergency line:** a red warning icon plus "In an emergency, call 911. For health advice any time, call Health811."

**Nothing else on this page.**

## B. Voice check-in flow

The mic opens a centred Dialog (a full-screen Sheet on mobile) with four states:

1. **Ready:**
   - Prompt chips: "How was eating today?", "Any falls or near-falls?", "Memory and mood?", "How are you doing?"
   - An "Upload audio instead" link (a file input).
2. **Recording:**
   - `MediaRecorder` (webm/opus), with a pulsing ring, a live level meter (Web Audio `AnalyserNode`), an mm:ss timer and a Stop button.
   - Cap recordings at 3 minutes.
   - If mic permission is denied, explain it in one sentence and offer the upload.
3. **Processing:**
   - Upload to `POST /api/check-ins` (multipart).
   - While waiting, a step list ticks off: Transcribing → Understanding Walter's update → Checking against his recent history → Sending to Nurse Priya. Advance it on a timer, but don't finish it until the response arrives.
4. **Done:**
   - The transcript, then "What we heard": up to 4 cards, each with a tier dot, a plain domain label (Eating, Memory, Medications, You…) and a one-line summary.
   - Then "Sent to Nurse Priya. You'll get a reply under Check-ins." and a "Back to home" button.
   - **If `is_emergency`**, open with a red banner: "This may be an emergency. Call 911 now." plus a secondary "Call Health811" button.
   - If the request fails, keep the recording in memory and offer "Try again".

## C. Sub-pages

Each sub-page has a "‹ Home" link, a 34px title, and one list or form. No dashboards.

- **`/family/check-ins`:** all check-ins, newest first. Each shows:
  - Date, time and duration, plus a one-line plain summary.
  - A **3-step stepper**: Received → Reviewed by Nurse Priya → Guidance sent.
    - Done steps: filled olive circles with a white check, joined by olive lines.
    - Pending steps: hollow sage circles, joined by sage lines.
  - Priya's reply, when present, in a cream panel with her avatar and the time.
  - If the status is still `received`: "Nurse Priya usually replies within 4 hours."
- **`/family/history`:** plain-language trends from `GET /patients/:id/trends`.
  - One row per domain: a dot, the plain label, one sentence, and a 64×24 sparkline with no axes.
  - Then a row for Sarah herself: "And you, Sarah: you've mentioned feeling tired in 3 of your last 5 check-ins.", linking to Care team.
  - Then a "View care summary ›" button linking to `/summary/:patientId`.
- **`/family/care-team`:**
  - Priya's card.
  - **Message:** a textarea plus Send, posting to `POST /messages`. Show the thread below.
  - **Request a call:** pick up to 3 preferred times, posting to `POST /call-requests`.
  - The 911 / Health811 line.
- **`/family/calendar`:** upcoming items from `GET /calendar` as a simple list, with "Requested" or "Confirmed" badges. Past items go in a collapsed "Earlier" section. No month grid.

## Acceptance criteria

- The home page matches the screenshot, with nothing extra.
- Record in Chrome → Done state: the audio file is saved on the server, and within about 4s Walter appears as #1 "New" in `/nurse` in another window.
- The nurse sends guidance → the Check-ins page shows the completed stepper and the reply, without a reload (polling).
- A message sent here appears in the nurse's Messages badge and thread. A call request appears in the nurse's Schedule call dialog; once confirmed, it shows as "Confirmed" in Calendar.
- Every page works at 390px wide, and all controls are keyboard-reachable with visible focus.
