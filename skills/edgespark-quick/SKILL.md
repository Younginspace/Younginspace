---
name: edgespark-quick
description: One-shot scaffolding for ANY EdgeSpark app — not limited to a specific product type. Auto-infers a visual thesis from the product description, hands off to edgespark:edgespark-frontend-design for distinctive (non-generic) UI, auto-seeds an admin account using a two-phase deploy (no human signup step), then deploys with public registration locked down. Use when the user says "用 edgespark 做一个 xxx", "用 edgespark 快速搭一个 xxx", "edgespark quick", "/edgespark-quick", or any generic "make X with edgespark" request. Works for SaaS, dashboards, internal tools, content sites, AI apps, marketing sites, waitlists — anything.
---

# EdgeSpark Quick

One-shot scaffolding skill for **any** EdgeSpark application. The user answers 4 questions, everything else is automatic — including the admin account. They never have to "register" themselves.

This skill is a thin orchestrator. It depends on:
- `edgespark:edgespark-frontend-design` — for the visual layer (composition, art direction, anti-generic UI)
- `edgespark:building-edgespark-apps` — for EdgeSpark mechanics (CLI, types, db, auth, deploy)

Quick provides the **product spine** (intake → schema → admin → dashboard → seed+lockdown → deploy). Frontend-design provides the **visual quality**. Building-edgespark-apps provides the **mechanical correctness**.

## What This Skill Always Produces

Regardless of product type:

1. **Distinctive visual identity** — generated through `edgespark:edgespark-frontend-design`, with a deliberate visual thesis (not generic "modern AI" UI)
2. **Admin account at `/admin`** — pre-seeded with the credentials the user supplied at intake, no signup step
3. **Public registration locked down** — `disableSignUp: true` after the admin is seeded; nobody else can register
4. **Product-specific surface** — pages, APIs, schema for what the user actually described
5. **Live deployment** — fully deployed to EdgeSpark, admin credentials work on first login

If the user explicitly says "no admin / no dashboard", skip Steps 5/6/7-admin parts and Step 8.

## EdgeSpark Reality (constraints to design around)

These are the actual hard constraints I learned the hard way — the skill must respect them:

| Constraint | Implication for the skill |
|------------|---------------------------|
| No `auth.api.signUpEmail` server-side | Can't seed admin from a Hono middleware. Must use platform's HTTP signup endpoint. |
| `/api/_es/auth/sign-up/email` is the platform signup endpoint | Reachable from anywhere (including server-to-self fetch) when `disableSignUp: false` |
| `disableSignUp` is the only lockdown knob (boolean, no allowlist) | Must use a two-phase deploy: open → seed → lock → redeploy |
| `auth.api.listUsers` does NOT exist | To check if admin exists, query `esSystemAuthUser` table directly via Drizzle |
| Better Auth password hash format is not public | Cannot direct-insert users into the DB; must go through the platform endpoint |
| `edgespark secret set` requires human browser hand-off | For automation, store ADMIN_PASSWORD as a plain `var` by default. Document the secret-upgrade path. |
| Generated tables use prefix `esSystemAuth*` | Imported from `../__generated__/sys_schema` (re-exported via `@defs`) |

## Workflow

### Step 1: Intake (4 questions, single message)

```
To set up your project, I need 4 things:

1. **Product name** — What's it called?
2. **What it does + core data** — Briefly: what does it do, who is it for, and what core entities/data does it have?
3. **Admin email + password** — for the /admin dashboard login (I'll pre-seed this — you won't need to register)
4. **(Optional) Visual hint** — any aesthetic direction you want? (editorial / luxury / industrial / playful / organic / brutalist / retro-futuristic / something else). Leave blank to auto-decide.
```

**Hard rules for intake**:
- Ask all 4 in **one message**. Do NOT pre-ask follow-ups about tech stack, layout, colors, fonts.
- If #2 is too vague to infer a primary entity, ask **one** clarifying question — otherwise proceed.
- Move on the moment you have answers.

### Step 2: Frame the Visual Thesis (auto, no user confirmation)

Derive the inputs `edgespark:edgespark-frontend-design` expects:

| Input | How to derive |
|---|---|
| User goal | Job-to-be-done from #2 |
| Audience | Inferred from product context |
| Emotional tone | Inferred; biased by #4 hint if present |
| Visual thesis (one sentence: mood + material + energy) | Synthesize from above |
| Concrete direction | Pick one: editorial / luxury / industrial / playful / organic / brutalist / retro-futuristic / cyber / minimalist-swiss / vaporwave / neo-brutalist / etc. |
| One unforgettable visual move | A single distinctive element |

**Direction inference heuristics** (when #4 not supplied):

| Product signal | Default direction |
|---|---|
| Developer tool / CLI / API | Industrial or brutalist |
| Consumer SaaS / productivity | Editorial or playful |
| Creative / design tool | Bold / experimental |
| Finance / enterprise | Luxury or minimalist-swiss |
| AI / ML product | Retro-futuristic or cyber |
| Health / wellness | Organic |
| E-commerce / marketplace | Editorial-luxury |
| Content / media / blog | Editorial |

Pick something **specific and committed**, not "modern". Two products in the same category should not look the same. Do NOT show a preview. Do NOT ask the user to confirm.

### Step 3: Project Init

```bash
edgespark init <product-slug> --agent claude
```

This creates a cloud project AND scaffolds locally at `./<product-slug>/` (with `server/` + `web/` + `edgespark.toml` + `CLAUDE.md`).

**Important** — read these scaffold files before touching code (per `building-edgespark-apps`):
- `server/src/__generated__/edgespark.d.ts` — what's importable from `edgespark`
- `server/src/__generated__/server-types.d.ts` — SDK method signatures
- `server/src/__generated__/sys_schema.ts` — Better Auth tables (esSystemAuthUser, etc.)
- `server/src/defs/db_schema.ts` (empty), `runtime.ts`, `index.ts`
- `web/src/lib/edgespark.ts` (the `client` singleton)
- `web/src/hooks/useAuth.ts` (auth hook)
- `web/CLAUDE.md` and `server/CLAUDE.md`

Install deps once dependencies are needed:
```bash
cd <project>/server && npm install
cd <project>/web && npm install
```

### Step 4: Database Schema

Generate based on the product description in #2.

- Identify the **primary entity** (the noun the product is most about)
- Use `text("created_at").notNull().default(sql\`(current_timestamp)\`)` consistently
- Add indexes on `created_at` and any frequently-filtered field (e.g. `type`, `status`)
- DO NOT add a `signups` table by default — only if the product is genuinely a waitlist

```bash
edgespark db generate
edgespark db migrate
```

### Step 5: Server API

Generate routes in three groups:

**Public** — `/api/public/*`:
- Whatever the public-facing product needs (e.g. `POST /api/public/feedback`, `GET /api/public/<entity>/count`)

**Authenticated user** — `/api/*`:
- `GET /api/me` — returns `{ email, isAdmin }` so the frontend can route-gate (this is the cleanest way for the SPA to know if the current session is admin)

**Admin** — `/api/admin/*` (still under `/api/*` so login is enforced; admin-email check is in your handler):
- `GET /api/admin/stats` — counts of the main entities (totals, today, 7-day trend, by-type breakdown if applicable)
- `GET /api/admin/<entity>` — paginated list with search + type filter
- `GET /api/admin/<entity>/export` — CSV export (return a `Response` with `text/csv` content-type)

Admin gate (in handler, NOT a separate middleware — keep it composable):
```typescript
function isAdmin(): boolean {
  const adminEmail = vars.get("ADMIN_EMAIL");
  if (!adminEmail) return false;
  if (!auth.isAuthenticated()) return false;
  return auth.user.email === adminEmail;
}
// inside admin handler:
if (!isAdmin()) return c.json({ error: "Forbidden" }, 403);
```

Update `src/defs/runtime.ts` first:
```typescript
export type VarKey = "ADMIN_EMAIL" | "ADMIN_PASSWORD";
export type SecretKey = never;
```

### Step 6: Admin Vars Setup

Set both as plain vars (the seed needs to read both at runtime; secrets require human hand-off which would break the auto-flow):

```bash
edgespark var set ADMIN_EMAIL=<email-from-intake>
edgespark var set ADMIN_PASSWORD=<password-from-intake>
```

After deploy succeeds, mention to the user: "ADMIN_PASSWORD is stored as a plain var. If you want to upgrade it to a secret, run `edgespark secret set ADMIN_PASSWORD` and update `runtime.ts` to declare it on `SecretKey` instead."

### Step 7: Frontend Pages

All pages use the design tokens generated in Step 3. No hardcoded colors anywhere.

#### Public/Product pages
- Generated based on the product description
- Embodies the **one unforgettable visual move** from Step 2
- Real-image search for hero/visual surfaces (CSS/SVG-only is fine for retro/CRT/abstract directions)
- Section structure follows frontend-design's "give each section one job" rule

#### `/admin/login` — LOGIN ONLY
- **Single form**: email + password
- **No "register" link, no "create account" toggle, no signup tab**
- Use `client.auth.signIn.email({ email, password })` directly
- Redirect to `/admin` on success
- Show a clear error if credentials wrong

#### `/admin` — Dashboard (always generated)
- Wrapped by an `AdminLayout` component that:
  - Checks `useAuth()` for session
  - Calls `GET /api/me` and reads `isAdmin`
  - Redirects to `/admin/login` if not authed
  - Shows "ACCESS DENIED" if authed but not admin (with sign-out button)
- Top: 3 stat cards
- Middle: 7-day trend line chart (lightweight inline SVG, no chart library)
- Bottom: recent-records preview + link to full table

#### `/admin/<entity>` — Full Table
- Search bar + type/status filter chips
- Sortable columns (at minimum: created_at)
- Pagination (20 per page)
- "Export CSV" button → `/api/admin/<entity>/export`

#### Visual rules
- Same brand tokens as public pages (one product, two surfaces)
- Admin shell is more restrained: less motion, higher density
- Stat cards: `bg-card`, big number in `text-primary font-display`
- Tables: `bg-card`, header `bg-muted/10`, zebra striping

### Step 8: Two-Phase Deploy + Admin Seed

**This is the critical step the old skill got wrong.** EdgeSpark has no server-side `signUpEmail` API, so the seed must go through the platform's public endpoint while it's temporarily open.

**Phase 1 — open, deploy, seed:**

1. Confirm `configs/auth-config.yaml` has `disableSignUp: false` (default after init)
2. `edgespark deploy` — wait for the URL (`https://<slug>.edgespark.app`)
3. POST to the platform signup endpoint with the credentials from intake:
   ```bash
   curl -s -X POST "https://<slug>.edgespark.app/api/_es/auth/sign-up/email" \
     -H "content-type: application/json" \
     -d '{"email":"<admin-email>","password":"<admin-password>","name":"Admin"}'
   ```
   Expect HTTP 200 with `{"token":"...","user":{...}}`. If you get 4xx, abort and surface the error.
4. (Optional verify) Query `esSystemAuthUser` via the running app or wait — the user should now exist.

**Phase 2 — lock down, redeploy:**

5. Edit `configs/auth-config.yaml` → `disableSignUp: true`
6. `edgespark auth apply`
7. `edgespark deploy`
8. (Optional smoke test) Try the signup endpoint again with a different email — should return `400 EMAIL_PASSWORD_SIGN_UP_DISABLED`

**Tailwind / CSS gotcha** (from real bug):
Google Fonts `@import url(...)` MUST appear BEFORE `@import "tailwindcss"` in `web/src/index.css`, otherwise Vite/Lightning CSS warns and may strip it.

### Step 9: Output

```
✅ Your project is live!

🌐 App: https://xxx.edgespark.app
🔐 Admin dashboard: https://xxx.edgespark.app/admin

Admin login (already seeded — no registration needed):
- Email: [email user provided]
- Password: [password user set]

Public registration is locked down — only the admin email can sign in.

Visual direction: [one short phrase, e.g. "editorial newsroom" or "industrial CLI"].
If you'd like to adjust anything — direction, colors, typography, layout, copy, features — just say the word.
```

Single sentence offer of customization at the end. Do NOT explain design choices. Do NOT pre-list options.

## Hard Rules

- **Not restricted to any product type.** SaaS, internal tools, dashboards, content sites, AI apps, marketing sites, waitlists, etc.
- **4 questions maximum at intake.** No design or stack questions.
- **The user never registers themselves.** Admin account is auto-seeded with the credentials they supplied. If you find yourself building a "register" or "signup" UI for /admin/login, stop — you've reverted to the broken pattern.
- **Public registration MUST be `disableSignUp: true` after seed.** Verify by curling the signup endpoint with a junk email and confirming 400 EMAIL_PASSWORD_SIGN_UP_DISABLED.
- **Always invoke `edgespark:edgespark-frontend-design`** for the visual layer. Never inline-author CSS variables — let it do that.
- **Always pick a concrete, committed visual direction.** Never default to "modern" or "clean".
- **Always generate an admin dashboard shell** (Steps 5/6/7) unless the user explicitly says "no admin".
- **Admin credentials are mandatory at intake.**
- **No design preview or confirmation step.** Generate, deploy, then offer adjustment.
- **Follow `edgespark:building-edgespark-apps` rules** for all EdgeSpark mechanics.
- **All UI uses design tokens.** No hardcoded colors anywhere.
- **Real-image search by default** for visual surfaces — except when the chosen direction is purely abstract/retro/terminal (CSS/SVG appropriate).
- **Never run multiple `edgespark` CLI commands in parallel** (per building-edgespark-apps).
- **`edgespark var set ADMIN_PASSWORD=<value>`** is fine for auto-flow. Tell the user about the secret-upgrade path in the final output but don't block on it.

## Recovery Paths (document in final output if asked)

**Admin password lost or admin user deleted?**
1. Edit `configs/auth-config.yaml` → `disableSignUp: false`
2. `edgespark auth apply`
3. POST to `/api/_es/auth/sign-up/email` with new credentials (or use the managed authUI)
4. Update `ADMIN_EMAIL` / `ADMIN_PASSWORD` vars to match
5. `disableSignUp: true` → `auth apply` → `deploy`

**Want to add a second admin?**
- The current model is single-admin (matched by `ADMIN_EMAIL`).
- For multi-admin: change `isAdmin()` to check against a comma-separated `ADMIN_EMAILS` var, or add a `is_admin` column to a custom table.

## Skill Composition Diagram

```
        edgespark-quick (this skill)
        ├── intake (4 questions)
        ├── frame visual thesis (auto-derive direction)
        │
        ├── invoke → edgespark:edgespark-frontend-design
        │            (composition, typography, color, motion, anti-generic)
        │
        ├── invoke → edgespark:building-edgespark-apps
        │            (CLI, types, db, auth, deploy mechanics)
        │
        ├── product schema + APIs + admin shell + dashboard
        ├── two-phase deploy:
        │     phase 1: deploy(signup-open) → curl seed → verify
        │     phase 2: lock signup → auth apply → redeploy
        └── output → links + credentials + visual phrase
```

## What This Skill Does NOT Do

- Does not set up payment processing
- Does not handle custom domains (`edgespark domains` separately)
- Does not migrate or import existing data
- Does not make destructive changes to an existing project — if cwd already has `edgespark.toml`, confirm with the user before running a fresh `edgespark init`
- Does not support multi-admin out of the box (see Recovery Paths above for the upgrade)
