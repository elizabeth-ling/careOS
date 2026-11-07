# CareOS design system

The look is calm, flat, clinical SaaS: a cream canvas, white cards, black primary buttons and olive green accents. Use **no other company's name, logo or imagery**.

The visual source of truth is the screenshots in `context/ui/` (`nurse-view.png`, `nurse-view-2.png`, `family-view.png`).

## Where the tokens live

- `apps/web/src/index.css` is the only file with raw colour values. It defines each token as a CSS variable on `:root`, maps the shadcn/ui variables (`--background`, `--primary`, `--border`, `--ring`, ...) onto them, and exposes everything to Tailwind v4 in `@theme inline` (Tailwind v4 has no `tailwind.config.js`; the `@theme` block is the config).
- Components use the generated classes only, for example `bg-canvas`, `text-ink`, `bg-urgent-bg text-urgent`, `border-border`, `rounded-card`. **No raw hex values in components.** Charts reference the variables, e.g. `stroke="var(--color-urgent)"`.

## Colours

| Token | Hex | Use | Tailwind |
|---|---|---|---|
| canvas | `#F3FBDF` | page background | `bg-canvas` (also shadcn `background`) |
| surface | `#FFFFFF` | cards, sidebar, top bars | `bg-surface` (shadcn `card`, `popover`) |
| ink | `#111111` | text; primary buttons (white text) | `text-ink`, `bg-ink` (shadcn `primary`, `foreground`); white is `text-on-ink` |
| brand | `#4A5A35` | logo mark, mic button, active states, links, "stable" | `bg-brand`, `text-brand` (shadcn `ring`) |
| brand-deep | `#2F4A23` | hover/pressed on brand; text on sage | `text-brand-deep`, `bg-brand-deep` |
| sage-50 / 100 / 200 | `#EEF3E2` / `#DDE6C9` / `#C7D3B0` | active nav, fills, avatars, decorative shapes | `bg-sage-50`, `bg-sage-100`, `bg-sage-200` (shadcn `secondary`, `muted`, `accent` = sage-50) |
| border | `#E3E8D6` | every 1px border | `border-border` (default for every `border`; shadcn `input`) |
| table-head | `#FAFCF5` | table header and footnote rows | `bg-table-head` |
| surface-hover | `#FCFEF7` | hovered family home blocks (with a sage-200 border) | `bg-surface-hover` |
| muted / body-2 | `#5B6150` / `#3F4535` | secondary text | `text-muted-foreground` / `text-body-2` |
| urgent | `#B42318` on `#FEF3F2` | risk ≥ 70 | `text-urgent` on `bg-urgent-bg` (shadcn `destructive`) |
| watch | `#B54708` on `#FFF6E5` | risk 40–69 | `text-watch` on `bg-watch-bg` |
| stable | `#4A5A35` on `#EEF3E2` | risk < 40 | `text-stable` on `bg-stable-bg` |
| info | `#2E5E8C` on `#EAF1F8` | "New" status, cognition line | `text-info` on `bg-info-bg` |

Note on `muted`: shadcn uses `muted` for a *fill* and `muted-foreground` for secondary *text*. So the design token "muted" (secondary text, `#5B6150`) is `text-muted-foreground`, and `bg-muted` is the sage-50 fill.

Risk tiers come from `tierFor()` in `packages/shared/risk.ts`; never recompute thresholds in the UI. `src/components/tiers.ts` maps each tier to its classes.

### Contrast

Every text pairing above meets 4.5:1 (checked): muted on canvas 6.0, muted on white 6.4, muted on sage-50 5.7, urgent 6.1, watch 5.1, stable 6.6, info 6.0, white on brand 7.5, brand-deep on sage-50 8.7. Don't put muted text on sage-100 or darker without checking.

## Type

**Figtree** from Google Fonts (400/500/600/700), loaded in `apps/web/index.html`. Tailwind's `font-sans` is Figtree.

| Role | Spec | Class |
|---|---|---|
| Page title | 34px, weight **400** (never bold), letter-spacing -0.01em, line-height 1.1 | `text-page-title font-normal` (use `<PageTitle>`) |
| Family greeting | 44px, weight 400 | `text-greeting font-normal` (`<PageTitle size="greeting">`) |
| Card title | 18px / 500 | `text-card-title font-medium` |
| Stat number | 38px / 400 | `text-stat font-normal` |
| Body, nurse view | 14px | set on the nurse layout (`text-sm`) |
| Body, family view | 16px | set on the family layout (`text-base`) |
| Meta text | 12–13px, muted | `text-xs` / `text-[13px] text-muted-foreground` |
| Buttons | 15px / 500 | built into `<Button>` |

## Shape

Flat, **no shadows** anywhere. The `shadow-*` theme values are set to `none` in `index.css`, the shadow classes shadcn ships are stripped from `src/components/ui/`, and Sonner's toast elevation is overridden. Don't add `shadow`, `drop-shadow` or `ring` utilities (rings are box-shadows); focus uses `outline`.

| Element | Radius | Class |
|---|---|---|
| Cards | 8px | `rounded-card` |
| Inner panels and nav items | 6px | `rounded-panel` |
| Buttons, inputs, tabs, badges and chips | 4px | `rounded-control` |
| Avatars | round | `rounded-full` |

shadcn's own classes are mapped to match: `rounded-sm` and `rounded-md` = 4px, `rounded-lg` = 6px, `rounded-xl` = 8px.

### Buttons

- 40px tall with 16px horizontal padding (`<Button>` default size), 15px / 500.
- **Primary:** ink black with white text, with a `ChevronRight` icon after the label on main calls to action (e.g. "Review ›", "Start rounds ›", "Send guidance ›").
- **Secondary:** white with a 1px border (`variant="outline"`).

### Interaction and accessibility

- Use real `<button>`, `<a>` (`<Link>`) and labelled inputs.
- Family touch targets are at least 44px (`h-11`).
- Every interactive element has a visible focus ring: a 2px brand outline with a 2px offset. It's set globally in `index.css` for links, buttons and form controls, and on every shadcn component via `focus-visible:outline-*`.
- Text contrast is at least 4.5:1 (see above).

## Layouts

- **Nurse (`/nurse/*`):** a fixed, non-collapsible, full-height sidebar, 272px wide, white with a 1px right border (`position: sticky; top: 0; height: 100vh`). Top: the logo (32px olive square, radius 6, white leaf icon, and "CareOS" at 21px / 700), then the nav: Triage queue (badge = unreviewed check-ins from the API), Families, Messages (badge = unread family messages), Scheduled calls, Care summaries. Bottom: the "On shift" panel, Settings, a divider, then the account block (avatar, name and credentials, care home, up/down chevron). The main column has a white top bar with a 1px bottom border (search on the left, role switcher and notification bell on the right); content has max-width 1280px and padding 24px 28px. Below 760px wide the sidebar stacks above the content.
- **Family (`/family/*`):** a white top bar with a 1px bottom border, the logo on the left and the role switcher plus account (avatar, caregiver name, "Caring for <first name>") on the right. Content is centred with max-width 1000px. No nav links.
- **Role switcher:** a segmented control ("Family view" / "Nurse view") in both layouts. The active segment is white with a 1px border on a sage-50 track.

## Shared components (`apps/web/src/components/`)

| Component | What it is |
|---|---|
| `RiskPill` | The 0–100 score, tier-coloured, in a 4px-radius box. |
| `TierChip` | "Urgent · 82": tier name, optionally with the score. |
| `StatusBadge` | Check-in status: New (info), Reviewed (sage-50, brand-deep), Guidance sent (brand, white). |
| `Sparkline` | Axis-free Recharts line of daily max risk, coloured by tier. |
| `AiSummaryPanel` | Sage-50 panel with a sparkles icon and "AI SUMMARY · VERIFY AGAINST TRANSCRIPT". Wrap **every** AI-generated block in it. |
| `HighlightedTranscript` | The transcript with each domain's quote highlighted (cognition info-bg, caregiver strain sage-100, others watch-bg). |
| `EmergencyNotice` | `variant="alert"`: the red "call 911" banner, which must always show when a check-in has emergency terms (`isEmergency`). `variant="reminder"`: the standing 911 line under the family home. |
| `PageTitle` | 34px / 400 title (44px for the family greeting), optional subtitle and actions. |

Also: `Logo`, `RoleSwitcher`, `ConnectionBanner` (the "Can't reach the CareOS server" banner), `Placeholder`, and the shadcn/ui primitives in `components/ui/` (button, card, input, select, badge, tabs, table, dialog, sheet, textarea, tooltip, sonner, separator, avatar, popover, skeleton).

## Data

All data comes from the API through `apps/web/src/api/` (`api.ts` plus one hook per endpoint in `hooks.ts`). Responses are parsed with the zod schemas in `packages/shared`. Never hard-code data in components.
