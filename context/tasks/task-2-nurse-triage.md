# Task 2 of 5 — Nurse view: triage queue

Build the nurse home page at `/nurse` (Triage queue), inside the nurse layout from Task 1. Read `docs/DESIGN.md`, `src/data/` and `src/store.ts` first and reuse them. Don't hard-code data in components; derive everything from the store. If `careos-nurse-full.png` is attached, match it.

## Page structure, top to bottom

**1. Title row**
- Left: "Triage queue" (34px, weight 400). Under it, muted 14px: "Saturday, November 7 · Ranked by check-in content, red-flag rules and change from each patient's own baseline" (use today's date).
- Right: an "Export" secondary button and a "Start rounds" primary button with a chevron.

**2. Four stat cards** (responsive grid, 16px gap)
- Each card: a small square colour dot with a label, a big number (38px / 400), and a muted one-liner.
- Needs attention (urgent): count, plus "Walter M. and Margaret O. waiting", built from the urgent patients' names.
- Watch (amber): count, "Drifting from their baseline".
- Stable (olive): count, "No new concerns this week".
- Avg response time (blue): "3.2h", "Target: under 4 hours".

**3. Queue card** (white, radius 8, 1px border, overflow hidden)
- Toolbar:
  - Filter buttons (4px radius): All, Urgent, Watch, Stable, Reviewed today, each with its count. The active one is ink with white text.
  - "Sort by" select: Risk score (default), Most recent, Longest unreviewed. Make all three actually sort.
- A real `<table>` inside a horizontally scrolling wrapper (min-width ~1020px). Header row on `#FAFCF5`, 13px muted. Columns:
  - **Risk:** rank number, plus the score in a 4px-radius pill tinted by tier.
  - **Patient:** round sage avatar with initials, name (600), and muted "82 · Early dementia, hypertension".
  - **Caregiver:** name, plus relationship (muted).
  - **Why flagged:** up to 3 chips (4px radius, tier tint). Stable patients get a neutral "No changes" chip.
  - **14-day trend:** a 96×28 sparkline (inline SVG or Recharts) of daily risk, stroked in the tier colour.
  - **Last check-in:** relative time, plus a status badge: New (blue tint), Reviewed (olive tint), Guidance sent (solid olive, white text).
  - **Action:** "Review ›" primary button for New; otherwise an "Open" secondary button. Both link to `/nurse/patients/:id` (built in Task 3).
- Rows have a subtle hover background. Clicking a row also opens the patient.
- Footnote row on `#FAFCF5`, 12px muted: "AI ranking supports triage only. Clinical decisions remain with the nurse."
- Add a tooltip on the Risk header: "Ranked from check-in content, red-flag rules and change from each patient's own baseline."

**4. Two cards side by side** (stacked on narrow screens), both about the top-ranked patient

- **Changes from baseline**
  - Subtitle: "Walter Morrison · last 21 days · severity 0–3".
  - A legend: Appetite (`#B54708`), Cognition (`#2E5E8C`), and Baseline (a sage band).
  - A Recharts line chart of those two domains over 21 days, y from 0 to 3, with a shaded baseline band from 0 to 0.5.
  - Below it, two insight rows from `changesFromBaseline()`. Each has a small tinted 4px-radius icon square:
    - "**Appetite** below baseline in 5 of the last 7 check-ins. Gradual; easy to miss day to day."
    - "**Cognition**: first time misidentifying a family member (today)."
- **Latest check-in**
  - Meta line: "Walter Morrison · from Sarah (daughter) · Today, 1:43 PM · 0:48", with an "Urgent · 82" badge on the right.
  - An AI summary panel (cream, radius 6). Its label is a sparkles icon plus "AI SUMMARY · VERIFY AGAINST TRANSCRIPT", followed by the summary text.
  - The transcript, with each domain's `quote` wrapped in `<mark>`. Use one tint per domain (appetite amber, cognition blue, caregiver strain sage). Hovering a mark shows the domain name.
  - Buttons: "Send guidance ›" (primary), "Schedule call" (secondary, phone icon), "Mark reviewed" (text button in olive).
  - For now these buttons only route to the patient page. Task 3 wires the real actions.

## Behaviour

- The queue re-sorts live when the store changes. Task 4 adds new check-ins and the hero patient must jump to the top.
- The sidebar's "Triage queue" badge shows the number of check-ins with status `received`.

## Acceptance criteria

- With seed data, Walter is #1 at 82, Margaret #2 at 74, then Henri, Grace and Anand, then the stable patients.
- Filters and sort work. The page has no horizontal scroll at 1280px or wider; at narrow widths only the table scrolls.
- The visual details match DESIGN.md: 8px cards, 4px controls, no shadows, regular-weight titles.