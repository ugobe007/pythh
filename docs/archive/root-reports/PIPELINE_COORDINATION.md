# 🔄 Pipeline Coordination: Discovery → Import → Enrichment

## Current Status: **PARTIALLY AUTOMATED**

### ✅ What's Automated

#### 1. Discovery → Import (Automated)
- **Script**: `unified-scraper-orchestrator.js` or `automation-engine.js`
- **Flow**:
  1. `tiered-scraper-pipeline.js` discovers startups → saves to `discovered_startups` table
  2. `auto-import-pipeline.js` automatically imports quality startups → `startup_uploads` table
- **Schedule**: Runs every 30 minutes (discovery) + every 2 hours (auto-import)

#### 2. Import → Scoring (Automated)
- **Script**: `auto-import-pipeline.js`
- **Flow**: When importing, automatically assigns GOD scores
- **Schedule**: Every 2 hours via PM2

### ❌ What's NOT Automated

#### 3. Enrichment (Manual)
- **Script**: `enrichment-orchestrator.js`
- **Status**: NOT integrated into orchestrators
- **You need to run manually**: `node enrichment-orchestrator.js --limit=50`

---

## 📊 Current Pipeline Flow

```
┌─────────────────────────────────────────────────────────────┐
│ AUTOMATED (via unified-scraper-orchestrator.js)            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Step 1: DISCOVERY                                          │
│  ─────────────────                                          │
│  tiered-scraper-pipeline.js                                 │
│    ↓                                                        │
│  discovered_startups table                                  │
│                                                             │
│  Step 2: AUTO-IMPORT (automatic)                           │
│  ───────────────────────────────                            │
│  auto-import-pipeline.js                                    │
│    ↓                                                        │
│  startup_uploads table (with GOD scores)                   │
│                                                             │
│  Step 3: MATCHING (automatic)                               │
│  ────────────────────────────                               │
│  queue-processor-v16.js                                     │
│    ↓                                                        │
│  startup_investor_matches table                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ MANUAL (you need to run)                                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Step 4: ENRICHMENT                                         │
│  ─────────────────                                          │
│  node enrichment-orchestrator.js --limit=50                │
│    ↓                                                        │
│  Updates startup_uploads with:                             │
│    - canonical_domain                                       │
│    - stage inference                                        │
│    - category inference                                     │
│    - traction signals                                       │
│    - meta tags (Tier 2)                                     │
│    - LLM enrichment (Tier 3, for top startups)             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 How to Make It Fully Automated

### Option 1: Add to unified-scraper-orchestrator.js

Add enrichment step after import:

```javascript
// After auto-import
if (SCRIPTS.enrichment.exists()) {
  await runScript('enrichment', CONFIG.timeouts.enrichment);
}
```

### Option 2: Add to PM2 Schedule

Add to `ecosystem.config.js`:

```javascript
{
  name: 'enrichment',
  script: 'node',
  args: 'enrichment-orchestrator.js --limit=50',
  cron_restart: '0 */6 * * *',  // Every 6 hours
}
```

### Option 3: Add to automation-engine.js

Add enrichment job:

```javascript
enrichment: {
  name: 'Enrichment',
  command: 'node enrichment-orchestrator.js --limit=50',
  timeout: 600000, // 10 min
  description: 'Enrich existing startups with missing data'
}
```

---

## 📋 Current Orchestrators

1. **unified-scraper-orchestrator.js** (Recommended)
   - Runs: Discovery → Auto-Import → Inference → Scoring → Matching
   - Missing: Enrichment step

2. **automation-engine.js** (Legacy)
   - Runs: Multiple jobs on different schedules
   - Missing: Enrichment step

3. **scripts/hot-match-autopilot.js**
   - Runs: Discovery → Inference → Scoring → Matching
   - Missing: Enrichment step

---

## ✅ Recommendation

**Add enrichment to unified-scraper-orchestrator.js** so the full pipeline runs automatically:

1. Discovery (every 30 min)
2. Auto-Import (every 2 hours)
3. **Enrichment (every 6 hours)** ← ADD THIS
4. Scoring (every 2 hours)
5. Matching (every 4 hours)
