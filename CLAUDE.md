# CareOS

Hackathon prototype. Families caring for an aging parent at home record short voice check-ins. The backend turns each check-in into a structured update and ranks patients by risk. Nurses from a local care home triage the queue and respond, and families see the response.

Two views:
- **Nurse:** a dense, clinical triage dashboard.
- **Family:** as simple as possible; one check-in button and four blocks.

## How to work in this repo

- The build is split into five tasks in `context/tasks/`, run **in order, one per session**:
  1. `task-1-backend-database.md`: Postgres, Prisma, Hono API, seed, check-in pipeline
  2. `task-2-frontend-foundation.md`: design system, layouts, API client
  3. `task-3-nurse-view.md`: triage queue, patient detail, nurse actions
  4. `task-4-family-view.md`: family home, voice check-in, family pages
  5. `task-5-summary-demo-ai-deploy.md`: care summary, demo controls, real AI, deploy
- Before starting a task:
  - Read the whole task file.
  - Read the code that earlier tasks produced.
  - Open the screenshots it names in `context/ui/`.
- Finish a task by checking every item in its **Acceptance criteria** and reporting which pass. Fix failures before saying it's done.
- Don't start the next task unless asked.
- `context/` is read-only reference material. Never edit it.
- Commit at the end of each task with a message like `task 3: nurse view`.

## Stack

- npm-workspaces monorepo:
  - `apps/api`: Node 20, TypeScript, Hono, Prisma ORM, PostgreSQL 16 (Docker), zod
  - `apps/web`: React, Vite, TypeScript, Tailwind, shadcn/ui, TanStack Query, Recharts, lucide-react
  - `packages/shared`: zod schemas, shared types and the risk rules, used by both api and web
- Commands, from the repo root:
  - `npm run db:up`
  - `npm run db:reset`
  - `npm run dev` (api on 8787, web on 5173)
  - `npm test`
  - `npm run db:studio`

## Rules

- **Synthetic demo data only.** No real patient information, anywhere.
- **Data flow:**
  - All data comes from the API. Never hard-code data in components.
  - Every request and response is validated with the zod schemas in `packages/shared`.
  - Prisma's JSON fields are always parsed with zod.
- **Risk scoring:** risk is computed by the rules in `packages/shared/risk.ts`. An LLM may extract information from transcripts, but it never sets the score.
- **AI labelling and safety:**
  - Every AI-generated block in the UI carries "AI summary · verify against transcript".
  - The emergency banner ("call 911") must always show for emergency terms.
- **Secrets:** they live only in `.env` files. Never commit them, and never send them to the browser.
- **Design** follows `docs/DESIGN.md` (created in Task 2) and the screenshots in `context/ui/`. In particular:
  - Theme tokens only, no raw hex values in components.
  - No shadows.
  - Cards have an 8px radius; buttons, inputs and tags have 4px.
  - Figtree font; page titles at weight 400.
  - Use no other company's name, logo or branding.
- **Accessibility:**
  - Use real `<button>`, `<a>` and labelled inputs.
  - Every interactive element has a visible focus ring.
  - Text contrast is at least 4.5:1.
- **Scope:** keep changes scoped to the task at hand. If a broader change seems worth it, suggest it rather than doing it.
