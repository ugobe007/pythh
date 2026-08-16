# Pythh Fundraising Outcome Ledger

Status: implemented in code; database migration not deployed.

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

The outreach modal reads per-run counts from `outreach.fundraisingMetrics` and gives confirmed meetings the primary visual emphasis.

## Rollout

1. Apply `20260815190000_pythh_fundraising_outcomes.sql` in an isolated staging database.
2. Confirm browser roles cannot read or write the ledger directly.
3. Send one staging outreach email twice with the same provider event and confirm one `outreach_sent` row.
4. Propose, confirm, and decline staging meetings and verify the expected event sequence.
5. Verify the metrics endpoint is scoped to the authenticated user and requested run.
6. Deploy the application code only after the migration is present.

## Next instrumentation gates

1. Record `reply_received` only from a verified inbound provider callback linked to an existing outreach email.
2. Upgrade `meeting_confirmed` to verified only from a calendar/provider confirmation.
3. Add founder-authorized, evidence-bearing paths for diligence, term sheets, and committed capital.
4. Measure conversion by cohort and source after sufficient verified observations exist.

## Graph boundary

No ledger event changes match score or order. Graph intelligence may consume a read-only copy only after outcome attribution, verification coverage, sample size, and offline lift have been reviewed. Live promotion requires a separate explicit release.
