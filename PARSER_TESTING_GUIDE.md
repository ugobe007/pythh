# SSOT Parser Testing & Ontology Management

## 🏥 Health Check System

The parser acts as our Single Source of Truth (SSOT) for entity extraction. Regular health checks are essential.

### Run Health Check
```bash
npx tsx scripts/parser-health-check.js
```

**What it tests:**
- ✅ Valid Startups (10 tests) - Should PASS graph_safe=true
- 💰 Investment Events (5 tests) - Extract OBJECT as startup
- ❌ Generic Terms (9 tests) - Should FAIL (Researchers, MIT Scientists, etc.)
- 🌍 Geographic Entities (6 tests) - Should FAIL (Africa, India, UK, etc.)
- 🔒 Possessive/Prepositional (5 tests) - Should FAIL ("your startup", "for you")
- 🏛️ Institutional/Government (4 tests) - Should FAIL (Former USDS Leaders, etc.)
- 📝 Long Statements (3 tests) - Should FAIL (>6 words)
- ⚠️ Ambiguous Entities (3 tests) - Context-dependent (Washington, Apple, Google)

**60+ test cases total**

### Health Status Thresholds
- **95%+ = EXCELLENT** ✅ Parser is healthy
- **85-94% = GOOD** ⚠️ Minor tuning needed
- **70-84% = FAIR** ⚠️ Significant tuning needed
- **<70% = POOR** ❌ Parser requires major fixes

### Current Results (Dec 25, 2025)
```
Total Tests: 60+
Pass Rate: ~85%
Status: GOOD - Minor tuning needed
```

**Known Issues:**
1. Some "LAUNCH" verbs not matching frames correctly
2. Long entity names (>6 words) sometimes pass when should fail
3. "Y Combinator" gets split into "Y" + "Combinator"

---

## 📊 Ontology Database

The ontology system is the brain behind entity classification.

### Current Coverage

**After expanded seed data:**

| Category | Count | Examples |
|----------|-------|----------|
| **INVESTOR** | 50+ | Sequoia, a16z, Y Combinator, Accel, Greylock |
| **GENERIC_TERM** | 70+ | Researchers, MIT Scientists, Big VCs, Indian Startups, IPO |
| **PLACE** | 50+ | Africa, Silicon Valley, San Francisco, Berlin, Tel Aviv |
| **STARTUP** | 40+ | Stripe, Figma, Notion, Anthropic, Waymo, Databricks |
| **AMBIGUOUS** | 6 | Washington, Apple, Google (need context) |

**Total: 200+ entities**

---

## 🔧 Managing Ontologies

### Add New Entity (Quick)
```bash
node scripts/add-ontology-entry.js "Entity Name" TYPE [confidence] [source]
```

**Examples:**
```bash
# Add new investor
node scripts/add-ontology-entry.js "Techstars" INVESTOR 1.0 MANUAL_SEED

# Add new startup
node scripts/add-ontology-entry.js "DeepMind" STARTUP 1.0 MANUAL_SEED

# Add generic term
node scripts/add-ontology-entry.js "Miami Tech Scene" GENERIC_TERM 1.0 MANUAL_SEED

# Add ambiguous entity
node scripts/add-ontology-entry.js "Paris" AMBIGUOUS 0.5 MANUAL_SEED
```

### Apply Bulk Seed Data
```bash
# Via Supabase Dashboard (recommended)
# 1. Open Supabase Dashboard → SQL Editor
# 2. Copy/paste: migrations/ontology-expanded-seed.sql
# 3. Run

# Or via script (limited support)
node scripts/apply-expanded-seed.js
```

### Query Ontologies
```sql
-- View all entities by type
SELECT entity_type, COUNT(*) 
FROM entity_ontologies 
GROUP BY entity_type;

-- Find specific entity
SELECT * FROM entity_ontologies 
WHERE entity_name ILIKE '%sequoia%';

-- View recent additions
SELECT * FROM entity_ontologies 
ORDER BY created_at DESC 
LIMIT 20;
```

---

## 🎯 Expanding Language Coverage

### When to Add More Terms

**Add INVESTORS when:**
- New VC firms appear frequently in RSS feeds
- Parser marks investor as startup (false positive)
- International VCs not yet in database

**Add GENERIC_TERMS when:**
- Headlines contain categories like "Top 10 Startups"
- Academic institutions appear ("Oxford Researchers")
- Government entities show up ("Pentagon Officials")

**Add PLACES when:**
- New tech hubs emerge (e.g., "Dubai Tech City")
- Country/city names being extracted as startups
- Regional terms ("APAC startups", "MENA region")

**Add STARTUPS when:**
- Well-known companies frequently mentioned
- High confidence needed (reduce UNKNOWN classifications)
- Building training dataset for ML model

### Priority Additions

**Investors (add next):**
- International VCs: SoftBank, Tencent, Alibaba, Tiger Global
- Corporate VCs: Intel Capital, Salesforce Ventures, Google Ventures
- Growth equity: Vista, Insight, Warburg Pincus

**Generic Terms (add next):**
- Roles: "CTOs", "Product Managers", "Data Scientists"
- Categories: "B2B SaaS", "Consumer Apps", "Deep Tech"
- Institutions: "Oxford", "ETH Zurich", "Tsinghua"

**Places (add next):**
- Emerging hubs: Dubai, Lagos, Jakarta, Mexico City
- Regions: "MENA", "APAC", "LATAM", "SEA"
- Tech parks: "Station F", "Google Campus", "WeWork Labs"

---

## 🔍 Monitoring Parser Health

### Daily Health Check
```bash
# Run health check
npx tsx scripts/parser-health-check.js

# If pass rate < 85%, investigate failures
# Common fixes:
# 1. Add missing terms to ontology database
# 2. Update validateEntityQuality() patterns
# 3. Adjust frame matching regex
```

### Weekly Ontology Audit
```sql
-- Check for entities with low confidence
SELECT * FROM entity_ontologies 
WHERE confidence < 0.8 
ORDER BY confidence ASC;

-- Find entities with no source
SELECT * FROM entity_ontologies 
WHERE source IS NULL OR source = '';

-- Review ambiguous entities
SELECT * FROM entity_ontologies 
WHERE entity_type = 'AMBIGUOUS';
```

### Production Monitoring
```bash
# Check recent graph joins
node list-discovered-startups.js | tail -20

# Monitor junk names
psql "$DATABASE_URL" -c "
SELECT name FROM startup_uploads 
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
"

# Check parser rejection rate
psql "$DATABASE_URL" -c "
SELECT 
  extraction_meta->>'graph_safe' as graph_safe,
  COUNT(*) as count
FROM startup_events
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY extraction_meta->>'graph_safe';
"
```

---

## 🧠 Machine Learning Integration (Future)

### User Correction Feedback Loop

When users correct entity classifications in the UI:

```javascript
// Example: User marks "Washington" as INVESTOR (not place)
await supabase.from('entity_ontologies').insert({
  entity_name: 'Washington',
  entity_type: 'INVESTOR',
  confidence: 0.9,
  source: 'USER_CORRECTION',
  metadata: {
    corrected_from: 'AMBIGUOUS',
    context: 'investment_subject',
    user_id: userId,
    correction_date: new Date().toISOString()
  }
});
```

### ML Training Dataset

Ontology database serves as training data:

```sql
-- Export training dataset
SELECT 
  entity_name,
  entity_type,
  confidence,
  source,
  metadata
FROM entity_ontologies
WHERE confidence >= 0.8
ORDER BY entity_type, entity_name;
```

Use this to train:
- Named Entity Recognition (NER) models
- Entity disambiguation models
- Context-based inference models

---

## 📈 Success Metrics

**Parser Health:**
- ✅ Health check pass rate > 90%
- ✅ Junk name rate < 5%
- ✅ Graph join success rate > 80%

**Ontology Coverage:**
- ✅ Top 100 VCs in database
- ✅ Top 50 tech hubs covered
- ✅ 100+ generic terms blocked
- ✅ 200+ known startups seeded

**Production Quality:**
- ✅ New startup discovery rate > 20/day
- ✅ False positive rate < 10%
- ✅ User corrections < 5/week

---

## 🚀 Quick Reference

```bash
# Health check
npx tsx scripts/parser-health-check.js

# Add entity
node scripts/add-ontology-entry.js "Name" TYPE 1.0 MANUAL_SEED

# View recent startups
node list-discovered-startups.js | tail -20

# Check ontology counts
psql "$DATABASE_URL" -c "SELECT entity_type, COUNT(*) FROM entity_ontologies GROUP BY entity_type;"

# Restart scraper
pm2 restart rss-scraper

# View scraper logs
pm2 logs rss-scraper --lines 50
```

---

**Last Updated:** December 25, 2025  
**Parser Version:** SSOT v2 (Ontology-Enhanced)  
**Test Coverage:** 60+ test cases  
**Ontology Size:** 200+ entities
