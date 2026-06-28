# E1.3: GitHub Issues/Discussions Collector - Complete ✅

## What Was Implemented

### E1.3: GitHub Issues/Discussions Collector ✅
**File**: `scripts/pythia/collect-from-github.js`

**Features:**
- ✅ Uses stored GitHub data from Module C1:
  - `github_primary_repo` (exact repo URL - no discovery needed!)
  - `github_repo_urls` (all repos)
  - `github_org` (org context)
- ✅ Collects from GitHub Issues:
  - Issue body (if founder/team speech)
  - Issue comments (from repo owners/contributors)
- ✅ Filters for founder/team speech:
  - Checks `author_association` (OWNER, MEMBER, COLLABORATOR)
  - Pattern matching for founder language
- ✅ Stores as Tier 1 (high confidence "earned" speech)
- ✅ Includes proper provenance (source_url, date_published, context)

**Usage:**
```bash
npm run pythia:collect:github
# or
node scripts/pythia/collect-from-github.js [limit]
```

## Why This Works Well

### High Precision:
- ✅ Uses stored `github_primary_repo` from Module C1 (no discovery overhead)
- ✅ Only collects from known repos (high confidence)
- ✅ Filters by `author_association` (OWNER/MEMBER/COLLABORATOR)
- ✅ Pattern matching for founder speech indicators

### High Quality (Tier 1):
- ✅ GitHub Issues/Discussions are "earned" speech (founders responding to users)
- ✅ Not PR/marketing (unlike blog posts)
- ✅ Technical, authentic communication
- ✅ Direct founder/team voice

### Efficient:
- ✅ No GitHub API discovery needed (repos already known)
- ✅ Only queries startups with `github_primary_repo IS NOT NULL`
- ✅ Rate limiting respected (2s delay between startups)

## Workflow

1. **First run Module C1** to discover and store GitHub repos:
   ```bash
   npm run github:enrich
   ```

2. **Then run E1.3** to collect snippets:
   ```bash
   npm run pythia:collect:github
   ```

3. **Run health check** to see yield:
   ```bash
   npm run pythia:health
   ```

## Next Steps

- ✅ **C1 → E1.3 pipeline complete!**
- 🚧 **C2**: Careers/jobs page signals
- 🚧 **C3**: Docs/changelog signals
- 🚧 **Module D**: Deal graph expansion

---

*E1.3 complete. GitHub speech collection pipeline fully operational.*
