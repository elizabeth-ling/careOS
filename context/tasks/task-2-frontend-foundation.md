# Task 2 of 5 — Frontend foundation: design system, layouts, API client

Create `apps/web` in the monorepo from Task 1. Read `packages/shared` and the API routes in `apps/api` first. **All data comes from the API**; never hard-code it in components. Open the reference screenshots and treat them as the visual source of truth:
- `context/ui/nurse-view.png` and `context/ui/nurse-view-2.png` (nurse layout, sidebar, triage queue)
- `context/ui/family-view.png` (family layout and home)

## Stack

- React + TypeScript + Vite, React Router.
- Tailwind CSS + shadcn/ui. Init it, then add: button, card, input, select, badge, tabs, table, dialog, sheet, textarea, tooltip, sonner, separator, avatar, popover, skeleton.
- lucide-react icons and Recharts.
- **TanStack Query** for all server state.
- Vite dev proxy: `/api` → `http://localhost:8787`.

## API client (`src/api/`)

- One typed `api.ts` using `fetch`, parsing responses with the zod schemas from `packages/shared`.
- One hook per endpoint, e.g. `useQueue(filter, sort)`, `usePatient(id)`, `useTrends(id)`, `useSendGuidance()`, `useCreateCheckIn()`.
- **Live demo behaviour:**
  - The queue, family home and check-in lists poll every 4s (`refetchInterval`).
  - Every mutation invalidates the queries it affects.
  - This makes a check-in in one window show up in the nurse queue in another window within seconds.
- Error states show a friendly toast. If the API is down, show a top banner: "Can't reach the CareOS server".

## Design system

Create `docs/DESIGN.md` with everything below, and wire it into Tailwind and the shadcn CSS variables. The look is calm, flat, clinical SaaS: a cream canvas, white cards, black primary buttons and olive green accents. Use **no other company's name, logo or imagery**.

**Colours**

| Token | Hex | Use |
|---|---|---|
| canvas | `#F3FBDF` | page background |
| surface | `#FFFFFF` | cards, sidebar, top bars |
| ink | `#111111` | text; primary buttons (white text) |
| brand | `#4A5A35` | logo mark, mic button, active states, links, "stable" |
| brand-deep | `#2F4A23` | hover/pressed on brand; text on sage |
| sage-50 / 100 / 200 | `#EEF3E2` / `#DDE6C9` / `#C7D3B0` | active nav, fills, avatars, decorative shapes |
| border | `#E3E8D6` | every 1px border |
| table-head | `#FAFCF5` | table header and footnote rows |
| muted / body-2 | `#5B6150` / `#3F4535` | secondary text |
| urgent | `#B42318` on `#FEF3F2` | risk ≥ 70 |
| watch | `#B54708` on `#FFF6E5` | risk 40–69 |
| stable | `#4A5A35` on `#EEF3E2` | risk < 40 |
| info | `#2E5E8C` on `#EAF1F8` | "New" status, cognition line |

**Type:** Figtree from Google Fonts (400/500/600/700).
- Page titles: 34px at weight **400** (never bold), letter-spacing -0.01em, line-height 1.1. The family greeting is 44px.
- Card titles: 18px / 500. Stat numbers: 38px / 400.
- Body: 14px in the nurse view, 16px in the family view. Meta text: 12–13px muted.
- Buttons: 15px / 500.

**Shape:** flat, **no shadows** anywhere.
- Radius: cards 8px; inner panels and nav items 6px; buttons, inputs, tabs, badges and chips 4px; avatars round.
- Buttons are 40px tall with 16px horizontal padding.
  - Primary: ink black, with a ChevronRight icon after the label on main calls to action.
  - Secondary: white with a 1px border.
- Family touch targets are at least 44px. Every interactive element has a visible focus ring.

**Shared components** (`src/components/`): RiskPill, TierChip, StatusBadge, Sparkline, AiSummaryPanel (sparkles icon plus "AI SUMMARY · VERIFY AGAINST TRANSCRIPT"), HighlightedTranscript, EmergencyNotice, PageTitle.

## Routes and layouts

- `/`: an entry page with the CareOS wordmark, the line "Professional support for families caring at home", and two buttons, "Continue as family" and "Continue as nurse".
- **Nurse layout** (`/nurse/*`):
  - **Sidebar:** fixed, non-collapsible and full height. 272px wide, white, with a 1px right border; `position: sticky; top: 0; height: 100vh`.
    - **Top:** the logo (a 32px olive square with radius 6 and a white leaf icon, plus the "CareOS" wordmark at 21px / 700). Then the nav: Triage queue (badge = unreviewed count from the API), Families, Messages (badge = unread family messages), Scheduled calls, Care summaries.
    - **Bottom:** an "On shift" panel ("3 nurses · 8 families · until 7 PM"), Settings, a divider, then the **account block**: avatar "PS", "Priya Sharma, RN", "Maple Grove Care Home", and an up/down chevron.
  - **Main column:** a white top bar with a 1px bottom border, holding search on the left and the role switcher plus a notification bell on the right. Content below has max-width 1280px and padding 24px 28px.
  - Below 760px wide, the sidebar stacks above the content.
- **Family layout** (`/family/*`): a white top bar with a 1px bottom border, holding the logo on the left and the role switcher plus account on the right (avatar "SM", "Sarah Morrison", "Caring for Walter"). Content is centred with max-width 1000px. There are no nav links.
- **Role switcher:** a segmented control ("Family view" / "Nurse view") in both layouts.
- **Demo identity:** no auth for the hackathon. `src/demo.ts` exports the hero patient, caregiver and nurse ids, loaded once from `GET /api/family/home` and the queue. Put a TODO where real auth would go.
- Placeholder pages for routes built in tasks 3–5.

## Acceptance criteria

- `npm run dev` runs both API and web. The entry page, both layouts and the role switcher all work.
- The nurse sidebar badge shows the real unreviewed count from the API.
- Stopping the API shows the "Can't reach the CareOS server" banner; restarting it recovers without a reload.
- No hex values in components (tokens only), and no shadows. `docs/DESIGN.md` matches this file.
