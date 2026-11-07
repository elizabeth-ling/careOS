# Task 4 of 5 — Family view: home and voice check-in

Build the family home at `/family` and the voice check-in flow. The family view must be **as simple as possible**: one primary action and four doors. Read `docs/DESIGN.md` and `src/store.ts` first. If `careos-family-v2.png` is attached, match it exactly.

The family user is Sarah Morrison, caring for her father Walter.

## Home page (`/family`), top to bottom

1. **Greeting:** "Good afternoon, Sarah" (44px, weight 400; the greeting follows the time of day). Under it, 18px body-secondary: "How is Walter doing today?"

2. **Check-in card** (white, radius 8, 1px border, padding 32px, overflow hidden)
   - Left: a **120px round olive mic button** with a 10px sage-50 ring and a white mic icon. Its `aria-label` is "Start a voice check-in about Walter".
   - Right of the button:
     - "Check in about Walter" (30px / 400)
     - "Tap and talk. Tell us how he's doing in your own words. Nurse Priya will see it." (16px, max-width ~430px)
     - "Last check-in: today at 1:43 PM" (14px muted), from the store
   - Decoration: three nested rounded squares behind the right edge, absolutely positioned and `aria-hidden`. They are sage-50 (340px, radius 96), sage-100 (210px, radius 64) and sage-200 (110px, radius 36). Text must never overlap them.

3. **Four blocks** in a responsive grid: `repeat(auto-fit, minmax(min(210px, 100%), 1fr))`, 16px gap. Each block is a full-card link:
   - Layout: white, radius 8, 1px border, padding 22px, min-height 168px.
   - Contents: a 44px sage-50 icon square (radius 6), a title (20px / 500), a one-line live status (14px), and an olive action link with a chevron pinned to the bottom.
   - Hover: border `#C7D3B0`, background `#FCFEF7`.

   | Block | Icon | Live status line | Link text → route |
   |---|---|---|---|
   | Check-ins | mic | from the latest check-in status, e.g. "Today's check-in is waiting for Nurse Priya" | View all → `/family/check-ins` |
   | Health history | file-text | "Trends and notes from Nurse Priya" | Open → `/family/history` |
   | Contact care team | message | "Priya Sharma, RN · replies within 4 hours" | Message or call → `/family/care-team` |
   | Calendar | calendar | next scheduled call, e.g. "Next: call with Nurse Priya, Mon Nov 9 at 10:00 AM" | See schedule → `/family/calendar` |

4. **Emergency line:** a small red warning icon plus "In an emergency, call 911. For health advice any time, call Health811." (14px).

**Nothing else on this page:** no timelines, trends, charts or extra cards.

## Voice check-in flow

Clicking the mic opens a centred `Dialog` (full-screen `Sheet` on mobile) with four states:

1. **Ready**
   - A big mic button and four prompt chips: "How was eating today?", "Any falls or near-falls?", "Memory and mood?", "How are you doing?"
   - A small "Upload audio instead" link (a file input) as a backup.
2. **Recording**
   - Uses the browser's `MediaRecorder` (ask for mic permission; handle denial gracefully with the upload fallback).
   - Shows a pulsing ring, a live level meter (Web Audio `AnalyserNode`), a mm:ss timer and a "Stop" button.
3. **Processing:** a step list that ticks off about once per second:
   - "Transcribing"
   - "Understanding Walter's update"
   - "Checking against his recent history"
   - "Sending to Nurse Priya"
4. **Done**
   - Shows the transcript, then "What we heard": up to 4 domain cards, each with a tier-coloured dot, the domain name in plain words ("Eating", "Memory and mood", "Medications", "You") and a one-line summary.
   - Then: "Sent to Nurse Priya. You'll get a reply under Check-ins." and a "Back to home" button.

### Processing logic

Put this in `src/lib/processCheckIn.ts` so Task 5 can swap in real AI later.

- Signature: `processCheckIn(audio: Blob | null, opts?: { transcriptOverride?: string }) => Promise<CheckIn>`.
- For now it is **simulated**: it ignores the audio and uses Walter's hero transcript from the seed.
- It extracts domains with simple keyword rules, so the quotes are exact substrings of the transcript:
  - dinner, ate → appetite
  - mom's name, confused → cognition
  - pills → medications
  - tired → caregiverStrain
- It computes risk from three parts:
  - **Red-flag rules:**
    - new confusion +25
    - fall +30
    - not eating 2+ days +20
    - emergency terms +60
  - **Domain severities:** the sum × 6.
  - **Drift from baseline:** +4 per domain above its 14-day baseline.
  - Cap the total at 100.
- It adds the check-in to the store with status `received`, so Walter re-sorts to the top of the nurse queue live.

### Safety

If the transcript contains emergency terms, the Done state opens with a red banner and the check-in is marked urgent:
- Terms: chest pain, can't breathe, unconscious, stroke, can't get up, bleeding heavily, not breathing.
- Banner: "This may be an emergency. Call 911 now." with a secondary "Call Health811" button.

## Acceptance criteria

- The home page matches the screenshot and nothing else is on it.
- Recording works in Chrome. If the mic is denied, the upload path still completes the flow.
- After a check-in, `/nurse` shows Walter at #1 with status "New" and the queue badge count increases.
- Keyboard: the mic button and all four blocks are reachable with Tab and show visible focus rings.