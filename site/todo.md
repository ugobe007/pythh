# Pythh.ai — Project TODO

## Core Pages
- [x] Home page (Obsidian Terminal design, PYTHIA hero, live signals table, science section, testimonials, newsletter, footer)
- [x] Activate page (URL submission → PYTHIA pipeline flow)
- [x] Pricing page (Scout / Oracle / Pantheon plans, billing toggle, feature comparison table)

## Stripe Checkout Integration
- [x] Install stripe + @stripe/stripe-js packages
- [x] Add `stripe.createCheckoutSession` tRPC procedure (server/routers.ts)
  - [x] Monthly billing: $299/mo (29900 cents)
  - [x] Annual billing: $2,988/yr (298800 cents)
  - [x] Dynamic success/cancel URLs from `origin` input
  - [x] Lazy Stripe init (throws if STRIPE_SECRET_KEY missing)
- [x] Wire Oracle plan CTA on Pricing page (desktop table + mobile cards) to call tRPC mutation
  - [x] Loading spinner while redirecting
  - [x] Error toast on failure
- [x] Checkout Success page (/checkout/success)
- [x] Checkout Cancel page (/checkout/cancel)
- [x] Register /checkout/success and /checkout/cancel routes in App.tsx
- [x] Vitest tests for Stripe procedure (5 tests, all passing)

## Infrastructure
- [x] Upgrade to web-db-user template (db, server, user features)
- [x] Database migration (pnpm db:push)
- [x] Fix storageProxy.ts TypeScript error

## Stripe Webhook & Subscription Provisioning
- [x] Add `subscriptions` table to drizzle/schema.ts (userId FK, stripeSubscriptionId, stripeCustomerId, plan, billingCycle, status, currentPeriodEnd)
- [x] Run pnpm db:push to migrate
- [x] Add subscription DB helpers to server/db.ts (upsertSubscription, getSubscriptionByUserId, getSubscriptionByStripeId)
- [x] Build /api/stripe/webhook Express route (raw body, signature verification, handle checkout.session.completed + customer.subscription.deleted)
- [x] Register webhook route in server/_core/index.ts BEFORE json body parser
- [x] Add STRIPE_WEBHOOK_SECRET to env (via webdev_request_secrets)
- [x] Add stripe.getSubscription tRPC query (protectedProcedure)
- [x] Update Pricing page Oracle CTA: show "Active Plan" badge if user already subscribed
- [x] Vitest tests for webhook handler logic (17/17 passing)

## Subscriber Dashboard (/account)
- [x] Add stripe.createPortalSession tRPC protectedProcedure (Stripe Customer Portal)
- [x] Build /account page: plan status card, billing cycle, renewal date, portal CTA
- [x] Handle unauthenticated state (redirect to login) and no-subscription state (empty state with View Plans CTA)
- [x] Register /account route in App.tsx
- [x] Add nav link to /account from the home page navbar (when user is logged in)
- [x] Vitest test for createPortalSession procedure (24/24 passing)

## Subscription Gate, Notifications & Invoice History
- [x] Gate /activate page: redirect non-subscribers (no active/trialing plan) to /pricing
- [x] Add owner notification (notifyOwner) in handleCheckoutSessionCompleted webhook
- [x] Add stripe.getInvoices tRPC protectedProcedure (list last 10 invoices via Stripe API)
- [x] Add invoice history section to /account page (amount, date, status, PDF download link, hosted invoice view link)
- [x] Vitest tests for getInvoices procedure + notifyOwner call (32/32 passing)

## Cancellation Confirmation Modal
- [x] Add stripe.pauseSubscription tRPC protectedProcedure (pause collection via Stripe)
- [x] Add stripe.downgradeToScout tRPC protectedProcedure (switch to Scout/free plan)
- [x] Build CancelConfirmModal component with three choices: Pause, Downgrade, Cancel
- [x] Show "what you will lose" loss-aversion list in the modal
- [x] Wire modal to the Manage Billing button — only redirect to portal on explicit Cancel confirmation
- [x] Handle success/error toasts for pause and downgrade actions
- [x] Vitest tests for pauseSubscription and downgradeToScout procedures (41/41 passing)

## Resume Subscription

- [x] Add stripe.resumeSubscription tRPC protectedProcedure (lift pause_collection via Stripe)
- [x] Show Resume button on /account page when status=paused
- [x] Handle success toast and refetch subscription after resume
- [x] Vitest tests for resumeSubscription procedure (49/49 passing)

## 7-Day Free Trial

- [x] Add subscription_data: { trial_period_days: 7 } to stripe.createCheckoutSession
- [x] Update Pricing page Oracle CTA to show "Start 7-day free trial" copy
- [x] Update Checkout Success page to mention the trial period
- [x] Update vitest tests to assert trial_period_days is passed to Stripe (51/51 passing)

## Rankings Page

- [x] Add investors table to drizzle/schema.ts with all signal fields
- [x] Seed the investors table with 44 investor records (scripts/seed-investors.mjs)
- [x] Add investors.getRankings tRPC publicProcedure with search, sector filter, and sort params
- [x] Build Rankings page: search bar, sector filter chips, sortable table header, row data
- [x] Gate full signal data (GOD score, VCPP) behind active Oracle subscription; locked row skeletons for non-subscribers
- [x] Add "Rankings" nav link in Home.tsx navbar (desktop + mobile)
- [x] Register /rankings route in App.tsx
- [x] Vitest tests for getRankings procedure (filter, sort, pagination) — 60/60 passing

## SEO & Meta Tags

- [ ] Add meta description, Open Graph tags, and Twitter card to client/index.html
- [ ] Add dynamic per-page <title> tags via react-helmet or document.title in each page
- [ ] Add robots.txt to client/public/
- [ ] Add sitemap.xml to client/public/

## Investor Detail Modal

- [ ] Add investors.getById tRPC publicProcedure returning full investor profile
- [ ] Build InvestorDetailModal component (slide-over panel with full profile, thesis, check size, geo, recent activity)
- [ ] Add "Request intro via PYTHIA" CTA in the modal (links to /activate with investor pre-filled)
- [ ] Wire row click on Rankings table to open the modal

## Pitch Deck Export to PDF

- [x] Install pdfkit npm package for server-side PDF generation
- [x] Add `outreach.exportDeckPdf` tRPC protectedProcedure (takes deckId, returns base64 PDF)
- [x] Add `getPitchDeckById` DB helper to server/db.ts
- [x] PDF layout: dark cover slide (startup name, "Investor Pitch Deck", pythh.ai branding), content slides (slide number chip, title, body, speaker notes section), emerald accent bar + amber numbering, branded footer
- [x] Add "Export PDF" button to slide editor toolbar in ActivatePythiaModal (disabled until deck is saved, shows spinner while generating)
- [x] Wire download: decode base64 on client, create Blob URL, trigger anchor download, revoke URL
- [x] Vitest tests for exportDeckPdf (9 tests — auth gate, NOT_FOUND, empty slides, base64 output, filename, %PDF magic bytes, validation)

## PYTHIA Outreach Activation Flow

- [x] Add `pitchDecks` table (id, userId, runId, slides JSON, sourceType: 'uploaded'|'generated', fileKey?, status, createdAt, updatedAt)
- [x] Add `outreachEmails` table (id, userId, runId, investorId, subject, body, status: 'draft'|'approved'|'sent', sentAt?, resendMessageId?, createdAt)
- [x] Run pnpm db:push to migrate (applied manually via SQL for TiDB compatibility)
- [x] Add DB helpers: createPitchDeck, updatePitchDeckSlides, getPitchDeckByRunId, createOutreachEmail, updateOutreachEmailStatus, getOutreachEmailsByRunId
- [x] Add tRPC procedure: outreach.uploadDeck (accepts file upload, stores to S3, returns placeholder slides)
- [x] Add tRPC procedure: outreach.generateDeck (LLM generates 10 slides from startup URL + summary)
- [x] Add tRPC procedure: outreach.updateDeck (saves edited slide content, debounced auto-save)
- [x] Add tRPC procedure: outreach.generateEmailPitch (LLM generates per-investor email pitch, idempotent)
- [x] Add tRPC procedure: outreach.updateEmail (edit subject/body/toEmail)
- [x] Add tRPC procedure: outreach.approveEmail (mark as approved)
- [x] Add tRPC procedure: outreach.sendEmail (sends via Resend, updates status to sent)
- [x] Add tRPC procedure: outreach.getOutreachStatus (returns deck + emails for a runId)
- [x] Wire Resend API key via webdev_request_secrets (validated against Resend /domains endpoint)
- [x] Build ActivatePythiaModal component: Step 1 (upload or skip), Step 2 (visual slide editor), Step 3 (email pitch review/approve/auto)
- [x] Visual slide editor: per-slide title + content + speaker notes editing, add/remove/reorder slides, edit/preview toggle
- [x] Email pitch panel: per-investor draft, approve/edit/send buttons, copy-paste output, fromName + replyTo fields
- [x] Add "Activate PYTHIA" CTA button at top of ResultsStep, opens ActivatePythiaModal
- [x] Vitest tests for outreach tRPC procedures (24 tests — auth gates, idempotency, LLM mocks, Resend call, error cases)

## PYTHIA Feedback — Other Reason Auto-expand

- [x] When user selects "Other" chip, auto-expand comment textarea and focus it (useRef + 50ms setTimeout focus, showComment forced true)

## PYTHIA Feedback — Reason Dropdown

- [x] Add `reason` varchar(64) column to `pipelineFeedback` schema (nullable)
- [x] Run pnpm db:push to migrate
- [x] Update `upsertPipelineFeedback` DB helper to accept optional `reason`
- [x] Update `pipeline.submitFeedback` tRPC input schema to accept optional `reason` (enum of 6 known values)
- [x] Update `pipeline.getFeedback` to return `reason` field
- [x] Update FeedbackWidget: show reason chip selector after thumbs-down click, before comment textarea; auto-submits on chip click
- [x] Update vitest tests for reason field (8 new tests — all 6 valid reasons, unknown reason rejection, reason+comment together)

## PYTHIA Analysis Feedback

- [x] Add `pipelineFeedback` table to drizzle/schema.ts (userId, runId, rating: 'up'|'down', comment?, createdAt)
- [x] Run pnpm db:push to migrate
- [x] Add `upsertPipelineFeedback` and `getPipelineFeedbackByRunId` DB helpers to server/db.ts
- [x] Add `pipeline.submitFeedback` tRPC protectedProcedure (takes runId, rating, optional comment)
- [x] Add `pipeline.getFeedback` tRPC protectedProcedure (returns existing rating/comment for a runId)
- [x] Build FeedbackWidget component (thumbs up/down buttons, optional comment textarea, submitted state, restores on re-render)
- [x] Wire FeedbackWidget into the PYTHIA summary section in Activate.tsx ResultsStep
- [x] Vitest tests for pipeline.submitFeedback and pipeline.getFeedback (19 tests — auth gates, upsert semantics, validation, isolation)

## PYTHIA Pipeline (/activate)

- [x] Add pipeline.analyzeStartup tRPC protectedProcedure (takes startup URL + optional founderEmail, runs LLM analysis, returns matched investors + pitch insights)
- [ ] Stream LLM results back to the frontend using tRPC subscription or polling
- [x] Update /activate page to show real LLM analysis output (matched investors, pitch insights) — fires mutation in parallel with scanning animation; graceful fallback to MOCK data
- [ ] Save pipeline run results to a pipelineRuns table in the database
- [x] Vitest tests for pipeline.analyzeStartup procedure (16 tests — auth gates, enrichment, edge cases)
