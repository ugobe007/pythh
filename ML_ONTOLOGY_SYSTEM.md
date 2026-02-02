# ML Ontology Learning System (FULLY AUTOMATED)

## 🧠 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    RSS FEEDS (Input)                            │
│              TechCrunch, HN, Bloomberg, etc.                    │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                 SSOT PARSER (frameParser.ts)                    │
│           • Extracts entities from headlines                    │
│           • Validates with current ontologies                   │
│           • Creates startup_events & discovered_startups        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                     DATABASE                                    │
│  • startup_events (all extractions)                             │
│  • discovered_startups (graph joins)                            │
│  • entity_ontologies (current classifications)                  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              ML ONTOLOGY LEARNING AGENT                         │
│                (ml-ontology-agent.js)                           │
│                                                                 │
│  1. Collect entity patterns (frequency, contexts)               │
│  2. Filter to unclassified entities                             │
│  3. ML classification (GPT-4o-mini)                             │
│  4. AUTO-APPLY if confidence ≥ 85%                              │
│  5. Log to ai_logs (audit trail)                                │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│            UPDATED ONTOLOGIES (AUTOMATIC)                       │
│     • High-confidence entities added to entity_ontologies       │
│     • Parser automatically uses new classifications             │
│     • Quality improves over time (self-learning)                │
│     • Low-confidence flagged for optional review                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Workflow (FULLY AUTOMATED)

### Phase 1: Data Collection (Continuous)
```bash
# RSS scraper runs every 15 minutes
pm2 logs rss-scraper

# Collects ~100-200 headlines/day
# Extracts entities → startup_events table
```

### Phase 2: Pattern Analysis (Daily/On-Demand)
```bash
# Run ML ontology learning agent
node scripts/ml-ontology-agent.js

# Analyzes last 500 events
# Finds entities appearing 3+ times
# Classifies with GPT-4o-mini
# AUTO-APPLIES if confidence ≥ 85%
```

### Phase 3: Automatic Application ✨
```
✅ Confidence ≥ 85% → Auto-applied to entity_ontologies
📝 All classifications logged to ai_logs (audit trail)
🔍 Confidence < 85% → Flagged for optional review
🔄 Parser immediately uses new ontologies in next run
```

### Phase 4: Optional Review (Low-Confidence Only)
```sql
-- Check low-confidence classifications (optional)
SELECT * FROM ai_logs 
WHERE type = 'ontology_suggestion' 
  AND status = 'pending_review'
ORDER BY created_at DESC;
```

---

## 🎯 ML Agent Configuration

**File:** `scripts/ml-ontology-agent.js`

**Settings:**
```javascript
BATCH_SIZE: 50                  // Entities to analyze per run
MIN_OCCURRENCES: 3              // Must appear 3+ times
CONFIDENCE_THRESHOLD: 0.7       // 70% minimum to classify
AUTO_APPLY_THRESHOLD: 0.85      // 85% minimum to auto-apply
AUTO_APPLY_ENABLED: true        // Fully automated mode
MODEL: 'gpt-4o-mini'            // Fast, cheap for classification
```

**Automation Rules:**
- ✅ Confidence ≥ 85% → **Auto-applied** to entity_ontologies
- 🔍 Confidence 70-84% → **Flagged** for optional review
- ❌ Confidence < 70% → **Rejected** (not logged)

**Classification Categories:**
- `STARTUP` - Specific companies
- `INVESTOR` - VC firms, angels, funds
- `FOUNDER` - People starting companies
- `EXECUTIVE` - People in company roles
- `PLACE` - Geographic entities
- `GENERIC_TERM` - Categories (Researchers, Big VCs)
- `AMBIGUOUS` - Needs more context

---

## 📊 Example ML Classification

**Input:**
```
Entity: "Lattice"
Appears 5 times

Contexts:
- "Y Combinator Backs Lattice" (INVESTMENT, OBJECT)
- "Lattice Raises $50M Series C" (FUNDING, SUBJECT)
- "Lattice Announces New HR Features" (LAUNCH, SUBJECT)
```

**ML Output:**
```json
{
  "entity_type": "STARTUP",
  "confidence": 0.95,
  "reasoning": "Lattice appears as funding recipient and product launcher, typical startup patterns"
}
```

**Result:**
```sql
INSERT INTO entity_ontologies (entity_name, entity_type, confidence, source) VALUES
  ('Lattice', 'STARTUP', 0.95, 'ML_INFERENCE');
```

---

## 🔍 Monitoring & Debugging

### Check Auto-Applied Classifications
```sql
-- Recently auto-applied entities
SELECT 
  output->>'entity_name' as entity,
  output->>'suggested_type' as type,
  output->>'confidence' as confidence,
  output->>'reasoning' as reasoning,
  created_at
FROM ai_logs
WHERE type = 'ontology_suggestion'
  AND status = 'auto_applied'
ORDER BY created_at DESC
LIMIT 20;
```

### Check Classifications Needing Review (Optional)
```sql
-- Low-confidence classifications
SELECT 
  output->>'entity_name' as entity,
  output->>'suggested_type' as type,
  output->>'confidence' as confidence,
  output->>'reasoning' as reasoning,
  created_at
FROM ai_logs
WHERE type = 'ontology_suggestion'
  AND status = 'pending_review'
ORDER BY created_at DESC;
```

### Check Auto-Apply Success Rate
```sql
-- Auto-apply statistics
SELECT 
  status,
  COUNT(*) as count,
  ROUND(AVG((output->>'confidence')::numeric), 2) as avg_confidence
FROM ai_logs 
WHERE type = 'ontology_suggestion'
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY status;
```

### Check Ontology Growth
```sql
SELECT 
  source,
  entity_type,
  COUNT(*) as count
FROM entity_ontologies
GROUP BY source, entity_type
ORDER BY source, count DESC;
```

### Entity Frequency Analysis
```sql
SELECT 
  entity_name,
  COUNT(*) as appearances
FROM (
  SELECT jsonb_array_elements(entities) ->> 'name' as entity_name
  FROM startup_events
  WHERE created_at > NOW() - INTERVAL '7 days'
) t
GROUP BY entity_name
HAVING COUNT(*) >= 3
ORDER BY appearances DESC
LIMIT 50;
```

---

## 🎛️ PM2 Integration (Optional)

**Add to ecosystem.config.js:**
```javascript
{
  name: 'ml-ontology-agent',
  script: 'scripts/ml-ontology-agent.js',
  cron_restart: '0 2 * * *', // Run daily at 2am
  autorestart: false,
  watch: false,
  env: {
    NODE_ENV: 'production'
  }
}
```

**Manual runs:**
```bash
# Run now
node scripts/ml-ontology-agent.js

# Schedule with PM2
pm2 start ecosystem.config.js --only ml-ontology-agent
pm2 logs ml-ontology-agent
```

---

## 🔐 Safety Features

**1. Confidence-Based Auto-Apply**
- Only entities with ≥85% confidence are auto-applied
- Lower confidence (70-84%) logged for optional review
- Very low confidence (<70%) rejected entirely

**2. Audit Trail**
- All classifications logged to `ai_logs` table
- Status field: 'auto_applied' or 'pending_review'
- Full reasoning and context preserved

**3. Duplicate Prevention**
- Filters entities already in ontology before classification
- Gracefully handles duplicate inserts
- No wasted API calls on known entities

**4. Rate Limiting**
- 500ms delay between ML API calls
- Batch size capped at 50 entities per run
- Prevents OpenAI API rate limit issues

**5. Error Handling**
- Database errors logged but don't stop execution
- Failed classifications tracked in ai_logs
- Continues processing remaining entities

---

## 📈 Expected Results

**Week 1:**
- 200+ RSS headlines collected
- ~30-50 new entities discovered
- ~15-25 auto-applied (≥85% confidence)
- Parser accuracy improves 10-15%

**Month 1:**
- 1000+ headlines collected
- 100+ entities classified
- ~70+ auto-applied
- Ontology database grows to 500+ entities
- Parser accuracy reaches 95%+

**Long-term:**
- **Fully autonomous system**
- Zero manual intervention needed
- Continuously adapting to new startup terminology
- Self-improving quality over time

---

## 🆚 Comparison: ML Agent vs GOD Scoring

| Feature | ML Ontology Agent | GOD Scoring Agent |
|---------|-------------------|-------------------|
| **Purpose** | Entity classification | Startup quality scoring |
| **Input** | RSS headlines, entity patterns | Startup profiles |
| **Output** | Entity type suggestions | GOD scores (0-100) |
| **Frequency** | Daily | On-demand |
| **Model** | GPT-4o-mini (fast, cheap) | GPT-4 (deep analysis) |
| **Auto-apply** | No (requires review) | Yes (trusted system) |
| **Table** | entity_ontologies | startup_uploads |

**Completely separate instances - no interference!**

---

## 🚀 Quick Start (FULLY AUTOMATED)

```bash
# 1. Run ML agent (fully automated)
node scripts/ml-ontology-agent.js

# Expected output:
# - Analyze 500 recent events
# - Find 10-20 unclassified entities
# - Auto-apply high-confidence (≥85%)
# - Flag low-confidence for optional review
# - Generate audit report in logs/

# 2. Check what was auto-applied (optional)
# View audit report: logs/ml-ontology-audit-[timestamp].txt
# Or query ai_logs WHERE status='auto_applied'

# 3. Parser automatically uses new ontologies
# Next RSS scraper run will benefit immediately

# 4. Optional: Review low-confidence classifications
# Query ai_logs WHERE status='pending_review'
```

**That's it! The system is fully autonomous.** 🎉

---

## 📖 Related Documentation

- [ONTOLOGY_SYSTEM.md](ONTOLOGY_SYSTEM.md) - Ontology architecture
- [PARSER_TESTING_GUIDE.md](PARSER_TESTING_GUIDE.md) - Testing procedures
- [RSS_PATTERN_FINDINGS.md](RSS_PATTERN_FINDINGS.md) - Real-world patterns
- [SYSTEM_GUARDIAN.md](SYSTEM_GUARDIAN.md) - Health monitoring

---

**Last Updated:** January 25, 2026  
**Status:** Ready for production use  
**ML Model:** GPT-4o-mini (entity classification)
