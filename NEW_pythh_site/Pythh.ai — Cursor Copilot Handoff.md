# Pythh.ai — Cursor Copilot Handoff

> **Scope:** This file describes the **`NEW_pythh_site/` prototype stack** (tRPC, Drizzle, etc.) — not the live hot-honey monolith.  
> **Production pythh.ai (Vite + `server/index.js` + Fly + Vercel):** use repo root **`../PYTHH_AI_CURSOR_COPILOT_HANDOFF.md`**.

---

> **Project:** pythh-redesign  
> **Stack:** React 19 + Tailwind 4 + Express 4 + tRPC 11 + Drizzle ORM + TiDB (MySQL-compatible) + Manus OAuth  
> **Design System:** Obsidian Terminal — Data Noir (dark backgrounds, emerald `#10b981` primary, amber `#f59e0b` accent, Inter/Geist font)  
> **Prepared:** May 2026

---

## 1. Project Overview

Pythh.ai is an **AI-powered investor intelligence and fundraising automation platform**. The core product is **PYTHIA** — a predictive AI agent that identifies signal-aligned investors, generates pitch materials, and manages outreach on behalf of startup founders.

The platform has three user-facing tiers:

| Plan | Price | Key Capability |
|---|---|---|
| Scout | Free | Public investor rankings |
| Oracle | $299/mo or $2,988/yr | Full signal data, PYTHIA pipeline, 7-day trial |
| Pantheon | Custom | Enterprise, white-glove |

---

## 2. Repository Structure

```
pythh-redesign/
├── client/
│   ├── index.html                  ← Google Fonts CDN, app entry
│   ├── public/                     ← favicon, robots.txt only
│   └── src/
│       ├── _core/hooks/useAuth.ts  ← Auth state hook (DO NOT EDIT)
│       ├── App.tsx                 ← Route definitions
│       ├── main.tsx                ← tRPC + QueryClient providers
│       ├── index.css               ← Global theme (OKLCH CSS vars, dark theme)
│       ├── const.ts                ← getLoginUrl(), APP_ID
│       ├── lib/
│       │   ├── trpc.ts             ← tRPC client binding
│       │   ├── emailInference.ts   ← Infer investor email from name + firm
│       │   └── utils.ts            ← cn() class helper
│       ├── pages/
│       │   ├── Home.tsx            ← Landing page (hero, signals, science, testimonials)
│       │   ├── Activate.tsx        ← PYTHIA pipeline flow (URL → scan → results)
│       │   ├── Rankings.tsx        ← Investor rankings table
│       │   ├── Pricing.tsx         ← Plan cards + Stripe checkout
│       │   ├── Account.tsx         ← Subscription management
│       │   ├── CheckoutSuccess.tsx
│       │   └── CheckoutCancel.tsx
│       └── components/
│           ├── ActivatePythiaModal.tsx  ← 3-step outreach modal (deck + email)
│           ├── FeedbackWidget.tsx       ← Thumbs up/down + reason chips
│           ├── PythiaReveal.tsx         ← Animated PYTHIA intro component
│           ├── PythiaRadarFeed.tsx      ← Live signal radar feed component
│           ├── DashboardLayout.tsx      ← Sidebar layout (internal tools)
│           └── ui/                     ← shadcn/ui components (button, card, dialog…)
├── server/
│   ├── _core/                      ← Framework plumbing — DO NOT EDIT
│   │   ├── index.ts                ← Express app entry
│   │   ├── trpc.ts                 ← publicProcedure / protectedProcedure
│   │   ├── context.ts              ← ctx.user injection
│   │   ├── llm.ts                  ← invokeLLM() helper
│   │   ├── notification.ts         ← notifyOwner() helper
│   │   ├── imageGeneration.ts      ← generateImage() helper
│   │   └── env.ts                  ← Typed env vars
│   ├── routers.ts                  ← Root tRPC router (merges all sub-routers)
│   ├── outreachRouter.ts           ← outreach.* procedures
│   ├── stripeWebhook.ts            ← Stripe webhook handler
│   ├── db.ts                       ← All Drizzle query helpers
│   ├── storage.ts                  ← S3 storagePut / storageGet
│   └── *.test.ts                   ← Vitest test files
├── drizzle/
│   └── schema.ts                   ← All database tables
└── shared/
    ├── const.ts                    ← UNAUTHED_ERR_MSG, AXIOS_TIMEOUT_MS
    └── types.ts                    ← Shared TypeScript types
```

---

## 3. Tech Stack & Key Conventions

### Data Flow
All backend calls go through **tRPC** — never add raw `fetch` or Axios calls in the frontend. The pattern is:

```ts
// Query
const { data, isLoading } = trpc.feature.getData.useQuery({ param });

// Mutation
const doThing = trpc.feature.doThing.useMutation({
  onSuccess: () => trpc.useUtils().feature.getData.invalidate(),
});
```

### Authentication
- `useAuth()` hook returns `{ user, loading, isAuthenticated, logout }`
- `protectedProcedure` on the server injects `ctx.user` (throws `UNAUTHORIZED` if not logged in)
- `adminProcedure` additionally checks `ctx.user.role === 'admin'`
- Login URL: `getLoginUrl(returnPath?)` from `client/src/const.ts`

### Database
- Schema: `drizzle/schema.ts` — edit here first, then run `pnpm db:push`
- Helpers: `server/db.ts` — add typed query functions here, import in routers
- **Never store file bytes in DB columns** — use S3 via `storagePut()` and store the key

### LLM
```ts
import { invokeLLM } from "./_core/llm";
const response = await invokeLLM({ messages: [...], response_format: { ... } });
```
Always call from server-side procedures. Use `response_format.type = "json_schema"` for structured output.

### File Storage
```ts
import { storagePut } from "./storage";
const { key, url } = await storagePut(relKey, buffer, mimeType);
// url = "/manus-storage/{key}" — use directly in frontend
```

### Email (Resend)
Outbound email is sent via Resend using `RESEND_API_KEY`. The from address is `pythia@pythh.ai`. All send logic lives in `server/outreachRouter.ts → sendEmail`.

### Styling
- **Tailwind 4** with OKLCH color format in `@theme` blocks
- Dark theme is default — CSS vars defined in `client/src/index.css` under `.dark {}`
- Design tokens: emerald `oklch(0.696 0.17 162.48)`, amber `oklch(0.769 0.188 70.08)`, background `oklch(0.13 0.01 264)`
- Use `shadcn/ui` components from `@/components/ui/*` for all interactive elements

### Testing
Run `pnpm test` — all tests must pass before committing. Pattern:
```ts
// server/feature.test.ts
const caller = appRouter.createCaller({ user: AUTHED_USER, req: {} as any, res: {} as any });
await caller.feature.procedure(input);
```

---

## 4. Database Schema (Current Tables)

| Table | Purpose |
|---|---|
| `users` | Auth users (openId, name, email, role: admin\|user) |
| `subscriptions` | Stripe subscriptions (plan, status, billingCycle, currentPeriodEnd) |
| `investors` | 44 investor records (name, firm, signal, god, vcpp, delta, sector, email…) |
| `pipelineFeedback` | Thumbs up/down ratings on PYTHIA analysis (runId, rating, reason, comment) |
| `pitchDecks` | Generated/uploaded pitch decks (slidesJson, sourceType, fileKey, status) |
| `outreachEmails` | Per-investor outreach email drafts (subject, body, status, sentAt, resendMessageId) |

---

## 5. Completed Features

### Public Pages
- **Home** (`/`) — Full landing page: sticky navbar with auth-aware links, hero with URL submission form, PYTHIA radar feed widget, live signals table, science/methodology section, testimonials, newsletter signup, footer
- **Rankings** (`/rankings`) — Paginated, sortable, filterable investor table. Non-Oracle users see locked rows for GOD score and VCPP columns
- **Pricing** (`/pricing`) — Scout / Oracle / Pantheon plan cards with monthly/annual billing toggle, Stripe checkout integration, active plan badge for subscribers, 7-day free trial copy

### Authentication & Subscriptions
- Manus OAuth flow (handled by `server/_core/oauth.ts`)
- Stripe checkout with 7-day free trial (`stripe.createCheckoutSession`)
- Stripe webhook handler for subscription provisioning, updates, and cancellation
- Subscription gate on `/activate` — redirects non-subscribers to `/pricing`
- Account page (`/account`) — plan status, renewal date, invoice history, Stripe Customer Portal
- Cancellation modal with three choices: Pause, Downgrade to Scout, Cancel
- Resume paused subscription

### PYTHIA Pipeline (`/activate`)
The activate page is a multi-step flow:

1. **URL Submission** — founder enters their startup URL
2. **Scanning** — animated scanning sequence (PYTHIA "reading" the startup)
3. **Results** — matched investors with signal scores, PYTHIA summary paragraph, thumbs up/down feedback widget

The `pipeline.analyzeStartup` tRPC mutation fires in parallel with the animation. Real LLM results are shown when available; mock data is the fallback.

### PYTHIA Outreach Activation (`ActivatePythiaModal`)
Triggered by the "Activate PYTHIA" button at the top of the results page. Three-step modal:

**Step 1 — Materials**
- Upload existing deck (PDF/PPTX → stored in S3, placeholder slides created)
- Or skip → PYTHIA generates a 10-slide deck via LLM

**Step 2 — Visual Slide Editor**
- Per-slide title, content body, and speaker notes editing
- Add / remove / reorder slides
- Edit / Preview toggle
- Auto-save with 1-second debounce
- **Export PDF button** — generates a branded PDF (dark theme, emerald accents, amber slide numbers, speaker notes section, pythh.ai footer) via pdfkit on the server; triggers browser download

**Step 3 — Email Pitch Panel**
- Per-investor email drafts generated by LLM (personalised to each investor's sector and thesis)
- Edit subject, body, recipient email inline
- Approve individual emails
- Send via Resend (from `pythia@pythh.ai`, reply-to set to founder's email)
- Copy-paste button on every draft

### Feedback Widget
Appears below the PYTHIA summary in the results view:
- Thumbs up (emerald) / Thumbs down (amber)
- On thumbs-down: reason chip selector — Wrong investors, Inaccurate scores, Missing sectors, Poor summary, Wrong stage, Other
- Selecting "Other" auto-expands and focuses the comment textarea
- Optional free-text comment (up to 500 chars)
- Auto-saves on chip click; persists across re-renders

---

## 6. Remaining Features (Implement These)

The following items are **not yet built** and are the primary work for Cursor Copilot.

### 6.1 SEO & Meta Tags
**Files to edit:** `client/index.html`, each page component

- Add `<meta name="description">`, Open Graph (`og:title`, `og:description`, `og:image`, `og:url`), and Twitter card tags to `client/index.html`
- Add dynamic per-page `<title>` using `document.title = "..."` in a `useEffect` at the top of each page component (or use `react-helmet-async`)
- Add `client/public/robots.txt` allowing all crawlers
- Add `client/public/sitemap.xml` with the five public routes: `/`, `/rankings`, `/pricing`, `/activate`, `/account`

### 6.2 Investor Detail Modal
**Files to create:** `client/src/components/InvestorDetailModal.tsx`  
**Files to edit:** `server/routers.ts`, `client/src/pages/Rankings.tsx`

- Add `investors.getById` tRPC `publicProcedure` in `server/routers.ts` that returns the full investor row by ID
- Build `InvestorDetailModal` as a slide-over panel (use `Sheet` from `@/components/ui/sheet`). Show: name, firm, signal score, GOD score, VCPP, delta, sector tags, thesis summary, check size range, geo focus, recent activity
- Gate GOD score and VCPP behind active Oracle subscription (same pattern as Rankings table — blur/lock for non-subscribers)
- Add a **"Request intro via PYTHIA"** CTA button that navigates to `/activate` with the investor name pre-filled in session storage
- Wire row click on the Rankings table to open the modal

### 6.3 Pipeline Run Persistence
**Files to edit:** `drizzle/schema.ts`, `server/db.ts`, `server/routers.ts`

The `pipeline.analyzeStartup` procedure currently returns results without saving them. Add persistence:

- Add a `pipelineRuns` table to `drizzle/schema.ts`:
  ```ts
  export const pipelineRuns = mysqlTable("pipeline_runs", {
    id: int("id").primaryKey().autoincrement(),
    userId: int("user_id").notNull(),
    runId: varchar("run_id", { length: 64 }).notNull().unique(),
    startupUrl: varchar("startup_url", { length: 512 }).notNull(),
    summary: text("summary"),
    matchedInvestorsJson: text("matched_investors_json"), // JSON array
    status: varchar("status", { length: 32 }).default("completed"),
    createdAt: timestamp("created_at").defaultNow(),
  });
  ```
- Run `pnpm db:push`
- Add `createPipelineRun` and `getPipelineRunByRunId` helpers to `server/db.ts`
- In `pipeline.analyzeStartup`, save the run after LLM analysis completes
- Add `pipeline.getRunHistory` protectedProcedure returning the last 10 runs for the user
- Add a "Run History" section to the `/account` page showing past analyses with links back to results

### 6.4 Meeting Scheduler Integration
**Files to create:** `client/src/components/MeetingScheduler.tsx`  
**Files to edit:** `server/outreachRouter.ts`, `drizzle/schema.ts`

After an outreach email is sent, PYTHIA should be able to follow up with meeting scheduling:

- Add a `meetings` table: `(id, userId, runId, investorName, investorFirm, proposedTimes JSON, status: proposed|confirmed|declined, confirmedTime, calendarLink, createdAt)`
- Add `outreach.proposeMeeting` protectedProcedure — generates 3 proposed meeting times (30 min slots, next 5 business days) and sends a follow-up email via Resend with a Calendly-style plain-text time picker
- Build `MeetingScheduler` component in Step 3 of `ActivatePythiaModal` — shows a "Schedule Meeting" button per sent email, displays proposed times, and shows confirmation status
- Add `outreach.confirmMeeting` and `outreach.declineMeeting` procedures

### 6.5 Founder Profile Page
**Files to create:** `client/src/pages/Profile.tsx`  
**Files to edit:** `drizzle/schema.ts`, `server/db.ts`, `server/routers.ts`, `client/src/App.tsx`

- Add a `founderProfiles` table: `(userId, companyName, companyUrl, stage, sector, askAmount, deckFileKey, bio, linkedinUrl, updatedAt)`
- Add `profile.upsert` and `profile.get` tRPC protectedProcedures
- Build `/profile` page: editable form with company details, funding ask, sector, bio, LinkedIn URL, deck upload
- Pre-populate the PYTHIA pipeline with profile data when available (pass to `analyzeStartup`)
- Add "Profile" link in the account navbar

### 6.6 Admin Dashboard
**Files to create:** `client/src/pages/Admin.tsx`  
**Files to edit:** `server/routers.ts`, `client/src/App.tsx`

- Gate with `adminProcedure` (role check: `ctx.user.role === 'admin'`)
- Add `admin.getStats` procedure returning: total users, active subscribers, pipeline runs today, emails sent today
- Add `admin.getRecentFeedback` procedure returning last 20 feedback rows with user info
- Build `/admin` page using `DashboardLayout` with sidebar: Stats overview, Recent Feedback table, User list
- Add route in `App.tsx` with role guard (redirect non-admins to `/`)

---

## 7. Environment Variables

All secrets are injected automatically by the Manus platform. When running locally, create a `.env` file (never commit it):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | TiDB/MySQL connection string |
| `JWT_SECRET` | Session cookie signing |
| `VITE_APP_ID` | Manus OAuth app ID |
| `OAUTH_SERVER_URL` | Manus OAuth backend |
| `VITE_OAUTH_PORTAL_URL` | Manus login portal |
| `BUILT_IN_FORGE_API_URL` | Manus built-in APIs (LLM, storage) |
| `BUILT_IN_FORGE_API_KEY` | Server-side bearer token |
| `VITE_FRONTEND_FORGE_API_KEY` | Frontend bearer token |
| `RESEND_API_KEY` | Resend email sending |
| `STRIPE_SECRET_KEY` | Stripe server-side key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signature verification |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe frontend key |

---

## 8. Development Commands

```bash
pnpm dev          # Start dev server (Express + Vite HMR on port 3000)
pnpm build        # Production build
pnpm test         # Run all Vitest tests (145 tests, ~5s)
pnpm db:push      # Generate + apply Drizzle migrations
pnpm format       # Prettier
```

---

## 9. Design Rules (Important)

- **Never use light backgrounds** — the entire app is dark theme (`oklch(0.13 0.01 264)`)
- **Primary accent:** emerald `oklch(0.696 0.17 162.48)` / hex `#10b981`
- **Secondary accent:** amber `oklch(0.769 0.188 70.08)` / hex `#f59e0b`
- **Muted text:** `oklch(0.65 0.01 264)` / hex `#6b7280`
- **Font:** Inter (loaded via Google Fonts CDN in `client/index.html`)
- **Avoid light blue** — reduce its prominence; prefer emerald and amber for highlights
- All Tailwind color values in `@theme` blocks must use OKLCH format
- Use `shadcn/ui` components — never rebuild buttons, dialogs, or cards from scratch
- Section labels use `font-mono text-xs tracking-widest uppercase` styling
- Headings use `font-display font-bold` (maps to Inter with tight tracking)

---

## 10. Testing Conventions

Every new tRPC procedure must have a corresponding test in `server/*.test.ts`. The minimum test set per procedure is:

1. Throws `UNAUTHORIZED` when called without authentication
2. Happy path — correct output for valid input
3. At least one validation error case (invalid input)

Use `vi.mock("./db", ...)` to mock all DB helpers. Use `vi.mock("./_core/llm", ...)` to mock LLM calls. Never make real network calls in tests (except the Resend key validation test which is intentionally live).

---

## 11. Key Files Quick Reference

| What you want to do | File to edit |
|---|---|
| Add a new page | `client/src/pages/NewPage.tsx` + register in `client/src/App.tsx` |
| Add a tRPC procedure | `server/routers.ts` (or new `server/featureRouter.ts` + merge in routers.ts) |
| Add a DB table | `drizzle/schema.ts` → `pnpm db:push` |
| Add a DB query helper | `server/db.ts` |
| Change global styles / theme | `client/src/index.css` |
| Change nav links | `client/src/pages/Home.tsx` (Navbar component) |
| Change route definitions | `client/src/App.tsx` |
| Change Stripe prices | `server/routers.ts` → `stripe.createCheckoutSession` |
| Add a new env variable | Use `webdev_request_secrets` tool (or add to `.env` locally) |
