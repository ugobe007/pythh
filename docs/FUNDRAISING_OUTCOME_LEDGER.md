# Pythh Fundraising Outcome Ledger

Status: migration applied to the linked Pythh database on 2026-08-15; application changes require deployment.

## Purpose

The ledger records actual fundraising transitions separately from match scores. It makes qualified meetings measurable without allowing incomplete outcome data to affect live ranking.

## Canonical funnel

`outreach_sent → reply_received → meeting_proposed → meeting_confirmed → diligence_started → term_sheet_received → capital_committed`

`meeting_declined` is a terminal observation for a proposed meeting, not success.

## Evidence policy

- Provider-confirmed email sends are verified.
- PYTHIA-created meeting proposals are verified as system actions, not investor interest.
- Founder-confirmed meetings are recorded but remain unverified until a calendar or provider callback confirms them.
- Every event has an idempotency key so retries cannot inflate funnel metrics.
- Outcome recording is append-only and service-only.
- A telemetry failure cannot fail or delay a completed outreach or meeting action.

## Current instrumentation

| Product action | Outcome | Verification |
| --- | --- | --- |
| Resend accepts an outreach email | `outreach_sent` | verified |
| PYTHIA creates meeting choices | `meeting_proposed` | verified system action |
| Founder selects a meeting slot | `meeting_confirmed` | unverified founder report |
| Founder declines a meeting | `meeting_declined` | unverified founder report |
| Signed Resend inbound webhook is attributed to an outreach email | `reply_received` | verified |
| Trusted calendar callback confirms a meeting | `meeting_confirmed` | verified |
| Founder submits diligence, term-sheet, or capital evidence | corresponding event | pending review |

The outreach modal reads per-run counts from `outreach.fundraisingMetrics` and gives confirmed meetings the primary visual emphasis.

## Rollout

1. Apply `20260815190000_pythh_fundraising_outcomes.sql` in an isolated staging database.
2. Confirm browser roles cannot read or write the ledger directly.
3. Send one staging outreach email twice with the same provider event and confirm one `outreach_sent` row.
4. Propose, confirm, and decline staging meetings and verify the expected event sequence.
5. Verify the metrics endpoint is scoped to the authenticated user and requested run.
6. Deploy the application code only after the migration is present.

## Provider configuration required

- Configure Resend to send `email.received` events to `/api/outreach/webhook` and preserve `In-Reply-To` headers. A `reply+<outreachEmailId>@…` alias is also supported when an inbound domain is configured.
- Set `PYTHH_CALENDAR_WEBHOOK_SECRET` and configure the calendar integration to call `/api/outreach/calendar/webhook` with `meeting_id`, `provider_event_id`, and `confirmed_time_ms`.

## Next instrumentation gates

1. Review submitted diligence, term-sheet, and capital evidence and add a service-only verification action.
2. Measure conversion by cohort and source after sufficient verified observations exist.
3. Backfill graph outcomes only from verified ledger rows with canonical startup and investor IDs.

## Graph boundary

No ledger event changes match score or order. Graph intelligence may consume a read-only copy only after outcome attribution, verification coverage, sample size, and offline lift have been reviewed. Live promotion requires a separate explicit release.
