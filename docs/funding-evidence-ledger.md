# Funding Evidence Ledger

This shadow system tests whether PYTHH recommended the investors that later
participated in a startup's financing, and how far in advance it did so. It
does not change GOD scores, candidate generation, or live match ordering.

## Evidence chain

1. The existing SSOT RSS scraper writes source-backed `FUNDING` and
   `INVESTMENT` rows to `startup_events`.
2. The evidence sync resolves the startup and every named funding participant
   against canonical `startup_uploads` and `investors` records. It prefers the
   scraper's `discovery_event_id` plus the independent LLM resolver evidence;
   exact normalized-name resolution is only a fallback. Ambiguous fuzzy names
   are never auto-merged.
   Parser-rejected, low-confidence, and non-financing headlines are excluded.
   Debt and grant events may remain as funding evidence but do not evaluate VC
   investor predictions; only equity and mixed rounds do.
3. The ledger preserves `shown_at`, best-known `occurred_at`, `announced_at`,
   and `discovered_at` separately. Announcement time is explicitly labeled as
   a proxy when the close date is unknown.
4. Historical top-five recommendation sets are evaluated only when they were
   shown before the event. Rows are written at 30, 90, 180, and 365-day
   horizons.
   When the serving model supplies `predicted_probability` and
   `predicted_horizon_days` in impression context, the ledger also evaluates
   probability calibration (Brier score) and timing accuracy. Historical
   models without those predictions remain nullable rather than receiving
   invented estimates.
5. Recommended firms that did not participate are retained as non-hits. Actual
   participants absent from the top five are retained as misses. Unresolved
   names remain visible instead of being silently discarded.
6. Canonical coverage repairs are conservative. Startup events auto-link only
   when a unique name also shares the original source URL or source-event ID.
   Name-only candidates remain in a review queue. Funding participants auto-link
   only to an exact existing investor profile or a unique reviewed organization
   member; normalized-name-only matches remain unresolved.

These rows establish temporal correlation, not causal attribution. A funding
announcement does not prove that PYTHH caused an investment.

## Safe rollout

1. Apply `20260817030000_funding_evidence_prediction_ledger.sql` to a staging
   clone first.
   Then apply `20260817031000_funding_evidence_service_role_grants.sql` so the
   private backend sync can access the tables while browser roles remain
   revoked.
2. Run `npm run funding:evidence` for a dry-run resolution preview.
3. Review `startup_resolution_rate`, `participant_extraction_rate`,
   `participant_resolution_rate`, ambiguous startups, source quality, and date
   precision.
4. Run `npm run funding:evidence:apply -- --limit=50` in staging.
5. Compare ledger totals with the underlying `startup_events` sample and rerun
   to verify idempotency.
   Use `--resolved-only` for the first cohort so unresolved news cannot create
   unattached evidence. Match evaluations are withheld unless resolver evidence
   explicitly marks the participant list complete; partial headlines must not
   label an unmentioned investor as a non-participant.
   Use `--equity-only` when evaluating venture-investor predictions; debt and
   grant evidence must not be mixed into VC precision metrics.
6. Enable production writes only after the same checks pass. The scheduled
   signal pipeline treats ledger failure as non-fatal.
   Set `FUNDING_EVIDENCE_RESOLVER_ENABLED=true` only when recurring external
   model and article-resolution cost is approved; the resolver is idempotent and remains
   disabled by default. `FUNDING_EVIDENCE_RESOLVER_PROVIDER` defaults to
   `openai`, but resolution remains inference-first: OpenAI is called only for
   ambiguous items. Set the provider to `inference` for a strictly free run, or
   `anthropic` after that account has API credits. Deterministic inference hints
   are included in each model request to reduce ambiguity and wasted calls.
   obvious noise and complete deterministic startup/investor relationships do
   not call a paid model. `--llm-all` exists only for explicit audits.
7. Do not use these outcomes in live ranking until cohort size, verification
   coverage, precision@5, miss rate, calibration, and baseline lift pass an
   explicit promotion review.

## Coverage and quality commands

- `npm run funding:audit` measures evidence quality and formal evaluability.
- `npm run funding:audit:candidates` re-scores the audited cohort without
  writes, resolves actual investors through canonical organizations and
  reviewed aliases, excludes unknown relationships, and reports rank and
  score gaps. Retrospective output is diagnostic rather than formal accuracy.
- `npm run funding:coverage:startups` previews provenance-backed startup links;
  the `:apply` variant writes only those safe links.
- `npm run funding:coverage:investors` ranks missing investor identities by
  repeated evidence and role.
- `npm run funding:coverage:investors:resolve` previews exact existing-profile
  links; the `:apply` variant writes them.
- `node scripts/scrub-funding-participant-chronology.mjs` previews ontology
  repairs for historical-round leakage, ambiguous “backed by” evidence,
  mixed lead/joined clauses, and directional-headline subject drift.
- `npm run enrich:investors:safe` previews sparse-investor enrichment. Only
  articles that name the target investor in an investment context are used;
  ordinary funding-round amounts cannot become check sizes, and third-party
  prose cannot become a first-party investment thesis. A claim must have one
  reviewed reputable source or two independent unreviewed publishers before
  it is eligible to change matching inputs.
- `npm run funding:enrich:investors` targets only resolved investors who are
  proven participants in audited, verified rounds. The `:apply` variant fills
  missing structured fields without overwriting existing claims and stores the
  exact source set and proposed values back on the participant evidence row.

## Required next evidence upgrades

- Corroborate rounds across multiple independent articles and first-party
  investor portfolio pages.
- Add founder-confirmed complete cap-table/round-participant submissions.
- Resolve aliases and firm/fund hierarchy without fuzzy auto-merges.
- Record independently verified close dates when available.
- Compare top-five performance against eligible, non-recommended investors and
  evaluate calibration by model version.
