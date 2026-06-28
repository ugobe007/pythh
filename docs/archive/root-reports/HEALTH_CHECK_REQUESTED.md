# Health Check Requested

## Issue
Unable to run `npm run pythia:health 2` due to shell issues in sandbox.

## What's Needed
Please run:
```bash
npm run pythia:health 2
```

And paste the output, specifically:
- Tier Distribution section
- Feature Markers section  
- Top Sources by Yield section

## What to Look For
Based on user's analysis:
- Tier 2 should appear IF new snippets are Tier 2
- If 94 snippets were stored as Tier 3 (PR-dominated), Tier 2 may still be 0%
- Reality contact should be > 0% (health bug fix working)

## Publisher Blocking Code Ready
I've created `scripts/pythia/utils/publisher-classifier.js` with:
- Hard blacklist (includes cointelegraph, fintechnews, arcticstartup, mattermark, axios, finsmes)
- Pattern heuristics (publisher tokens, publisher paths)
- `isPublisherDomain()` function ready to integrate

Once we see the health check output, we can:
1. Confirm tiering behavior
2. Integrate publisher blocking
3. Prevent publisher RSS from being saved as "company_blog"
