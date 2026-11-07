# Task 1 of 5 — Foundation, design system and mock data
 
You are a staff engineer building **CareOS**, a hackathon prototype. Families caring for an aging parent at home record short voice check-ins; AI turns each one into a structured update; nurses from a local care home see a ranked triage queue and respond. This task sets up the project so tasks 2–5 can build screens quickly and consistently.
 
If the reference screenshots `careos-nurse-full.png` and `careos-family-v2.png` are attached, treat them as the visual source of truth.
 
## Stack
 
- React + TypeScript + Vite, React Router
- Tailwind CSS + shadcn/ui (init it, then add: button, card, input, select, badge, tabs, table, dialog, sheet, textarea, tooltip, toast/sonner, separator, avatar)
- lucide-react icons, Recharts for charts
- Zustand for app state (one store), no backend yet. Everything runs on mock data.
- `npm run dev` must work with no environment variables.
## Design system
 
Create `docs/DESIGN.md` documenting everything below, and wire the values into Tailwind and the shadcn CSS variables so every component inherits them. The look is a calm, flat, clinical SaaS: cream canvas, white cards, black primary buttons, olive green accents. Inspired by modern care-software marketing sites, but use **no other company's name, logo or imagery**.
 
**Colours**
 
| Token | Hex | Use |
|---|---|---|
| canvas (`--background`) | `#F3FBDF` | page background |
| surface (`--card`) | `#FFFFFF` | cards, sidebar, top bar |
| ink (`--foreground`, `--primary`) | `#111111` | text and primary buttons (white text) |
| brand | `#4A5A35` | logo mark, mic button, active states, links, "stable" |
| brand-deep | `#2F4A23` | hover/pressed on brand, text on sage |
| sage-50 | `#EEF3E2` | active nav background, subtle fills |
| sage-100 | `#DDE6C9` | avatars, decorative shapes |
| sage-200 | `#C7D3B0` | decorative shapes |
| border | `#E3E8D6` | all 1px borders |
| table-head | `#FAFCF5` | table header and footnote rows |
| muted text | `#5B6150` | secondary text; body-secondary `#3F4535` |
| urgent | `#B42318` on `#FEF3F2` | risk ≥ 70 |
| watch | `#B54708` on `#FFF6E5` | risk 40–69 |
| stable | `#4A5A35` on `#EEF3E2` | risk < 40 |
| info | `#2E5E8C` on `#EAF1F8` | "New" status, cognition chart line |
 
**Type:** Figtree from Google Fonts (400/500/600/700) for everything.
- Page titles: 34px, weight **400** (regular, never bold), letter-spacing -0.01em, line-height 1.1. Family greeting: 44px.
- Card titles: 18px / 500. Stat numbers: 38px / 400.
- Nurse body and table text: 14px. Family body: 16px. Labels/meta: 12–13px muted.
- Buttons: 15px / 500.
**Shape:** flat, **no shadows**; depth comes from white on cream plus 1px `#E3E8D6` borders.
- Radius: cards 8px; inner panels and nav items 6px; buttons, inputs, tabs, badges and chips 4px; avatars and status dots fully round.
- Buttons are 40px tall with 16px horizontal padding. Primary buttons are ink black with a ChevronRight icon after the label. Secondary buttons are white with a 1px border.
- Touch targets are at least 44px in the family view.
## App shell and routes
 
- `/` → simple entry page: CareOS wordmark, the line "Professional support for families caring at home", and two buttons: "Continue as family" and "Continue as nurse".
- **Nurse layout** (`/nurse/*`):
  - A **fixed, non-collapsible, full-height left sidebar**: 272px wide, white, 1px right border, `position: sticky; top: 0; height: 100vh`.
  - Sidebar top: logo (32px olive rounded-6 square with a white leaf icon, plus the "CareOS" wordmark at 21px / 700), then nav: Triage queue (with a count badge), Families, Messages (with a count badge), Scheduled calls, Care summaries.
  - Sidebar bottom: an "On shift" panel ("3 nurses · 8 families · until 7 PM"), Settings, then a divider and the **account block**: avatar "PS", "Priya Sharma, RN", "Maple Grove Care Home", and an up/down chevron. Nothing collapses.
  - Main column: a white top bar with a 1px bottom border, holding search (left), the role switcher and a notifications bell (right). Page content sits below, max-width 1280px, padding 24px 28px.
- **Family layout** (`/family/*`): a white top bar with a 1px bottom border, holding the logo (left), and the role switcher plus account (avatar "SM", "Sarah Morrison", "Caring for Walter") on the right. Content is centred, max-width 1000px. No nav links; the home page blocks are the navigation.
- **Role switcher:** a segmented control ("Family view" / "Nurse view") in both layouts that navigates between `/family` and `/nurse`.
- Under 760px wide, the nurse sidebar stacks above the content instead of sitting beside it.
## Mock data — `src/data/`
 
Types in `types.ts`, seed data in `seed.ts`, and loaded into the Zustand store in `src/store.ts`.
 
- `Patient`: id, name, age, conditions[], caregiverId, nurseId, initials.
- `Caregiver`: id, name, relationship.
- `Nurse`: id, name, credentials, careHome.
- `CheckIn`:
  - id, patientId, createdAt, durationSec, transcript, status (`received` | `reviewed` | `guidance_sent`), riskScore (0–100), flags (string[]).
  - `domains`: a record of appetite, sleep, mobility, cognition, mood, pain, medications, caregiverStrain. Each holds `{ severity: 0|1|2|3, summary, quote }`, where `quote` is an exact substring of the transcript.
  - `aiSummary`.
- `NurseAction`: id, checkInId, patientId, type (`guidance` | `call_scheduled` | `call_note` | `reviewed`), body, createdAt, scheduledFor?, source? (e.g. `"vox_advantage"`).
**Seed 8 patients**, each with 4–6 weeks of check-ins every 1–3 days. Write a small deterministic generator (seeded random) for the background history so the trends look real.
 
| # | Patient | Age | Conditions | Caregiver | Risk | Flags | Latest | Status |
|---|---|---|---|---|---|---|---|---|
| 1 | **Walter Morrison** (hero) | 82 | early dementia, hypertension | Sarah Morrison (daughter) | 82 | New confusion, Appetite ↓ 3 wks | 12 min ago | received |
| 2 | Margaret Okafor | 88 | osteoporosis, CHF | David Okafor (son) | 74 | Fall reported, Mobility ↓ | 2 h ago | received |
| 3 | Henri Tremblay | 79 | Parkinson's | Louise Tremblay (spouse) | 58 | Sleep ↓ 10 days, Caregiver strain | | reviewed |
| 4 | Grace Li | 84 | type 2 diabetes | Kevin Li (son) | 47 | Missed meds ×2 | | guidance_sent |
| 5 | Anand Mehta | 77 | COPD | Ritu Mehta (daughter) | 41 | Breathless on stairs | | received |
| 6 | Dorothy Campbell | 91 | mild cognitive impairment | Ellen Campbell (daughter-in-law) | 28 | stable | | |
| 7 | Frank Russo | 80 | osteoarthritis | Maria Russo (spouse) | 19 | stable | | |
| 8 | Rose Fontaine | 86 | hypertension | Julie Fontaine (granddaughter) | 12 | stable | | |
 
**Walter's history:** over the last 21 days his appetite severity drifts 0→2 and cognition 0→2 in small steps.
 
**Walter's latest transcript (today 1:43 PM, 48s):**
> "Dad barely touched his dinner again tonight, maybe a few bites. And this morning he called me by my mom's name, which he's never done before. He seemed a bit off all day honestly. He did take all his pills though. I'm pretty tired."
 
**Nurse:** Priya Sharma, RN, Maple Grove Care Home.
 
**Earlier guidance for Walter (Thu Nov 5, 4:10 PM):**
> "Thanks Sarah. Half portions a few days in a row is worth watching. Try smaller meals more often, and keep a glass of water within reach. Let's keep tracking it here."
 
## Shared logic — `src/lib/`
 
- `risk.ts`:
  - `tierFor(score)` returns urgent, watch or stable.
  - `baselineFor(patientId, domain, days = 14)` returns the mean severity over that window.
  - `changesFromBaseline(patientId)` returns human-readable insights, e.g. "Appetite below baseline in 5 of the last 7 check-ins".
- `format.ts`: relative times ("12 min ago", "Yesterday") and durations ("0:48").
## Acceptance criteria
 
- `npm run dev` shows the entry page. Both layouts render with placeholder pages, and the role switcher works.
- Theme tokens are used everywhere: no stray hex values in components, and no shadows.
- The store exposes patients, check-ins and nurse actions, plus selectors like `latestCheckIn(patientId)` and `queue()`, which returns patients sorted by latest risk.
- `docs/DESIGN.md` exists and matches this file.
Do not build the dashboards yet; tasks 2–5 do that.