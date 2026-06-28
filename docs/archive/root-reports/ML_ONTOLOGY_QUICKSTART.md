# 🤖 Fully Automated ML Ontology System - Quick Reference

## ✅ System Status: FULLY OPERATIONAL

**Mode:** Autonomous (zero human intervention required)  
**Confidence Threshold:** ≥85% for auto-apply  
**Schedule:** Every 6 hours via PM2  
**Last Update:** January 25, 2026

---

## 🎯 How It Works

```
1. RSS Scraper collects headlines (every 15 min)
          ↓
2. Parser extracts entities
          ↓
3. ML Agent analyzes patterns (every 6 hours)
          ↓
4. HIGH CONFIDENCE (≥85%) → Auto-applied ✅
5. LOW CONFIDENCE (70-84%) → Flagged for review 🔍
6. Parser uses new ontologies immediately 🔄
```

---

## 🚀 Commands

### Run ML Agent Manually
```bash
node scripts/ml-ontology-agent.js
```

### Test System (Demo Mode)
```bash
node scripts/test-ml-ontology-auto.js
```

### Check Auto-Applied Classifications
```sql
SELECT 
  output->>'entity_name' as entity,
  output->>'suggested_type' as type,
  output->>'confidence' as confidence,
  created_at
FROM ai_logs
WHERE type = 'ontology_suggestion'
  AND status = 'auto_applied'
ORDER BY created_at DESC
LIMIT 20;
```

### Check Classifications Needing Review (Optional)
```sql
SELECT 
  output->>'entity_name' as entity,
  output->>'suggested_type' as type,
  output->>'confidence' as confidence,
  output->>'reasoning' as reasoning
FROM ai_logs
WHERE type = 'ontology_suggestion'
  AND status = 'pending_review'
ORDER BY created_at DESC;
```

### View Audit Reports
```bash
ls -lth logs/ml-ontology-audit-*.txt | head -5
cat logs/ml-ontology-audit-[timestamp].txt
```

---

## 📊 PM2 Management

### Check Status
```bash
pm2 list
# Look for: ml-ontology-agent (cron: 0 */6 * * *)
```

### View Logs
```bash
pm2 logs ml-ontology-agent --lines 50
```

### Restart Agent
```bash
pm2 restart ml-ontology-agent
```

### Trigger Immediate Run
```bash
pm2 trigger ml-ontology-agent
```

---

## 🎛️ Configuration

**File:** `scripts/ml-ontology-agent.js`

```javascript
CONFIG = {
  BATCH_SIZE: 50,                  // Entities per run
  MIN_OCCURRENCES: 3,              // Must appear 3+ times
  CONFIDENCE_THRESHOLD: 0.7,       // 70% minimum to classify
  AUTO_APPLY_THRESHOLD: 0.85,      // 85% minimum to auto-apply
  AUTO_APPLY_ENABLED: true,        // Fully automated
  MODEL: 'gpt-4o-mini'            // Fast classification
}
```

**To disable automation:**
```javascript
AUTO_APPLY_ENABLED: false  // Reverts to manual review
```

---

## 📈 Expected Performance

### Week 1
- 200+ headlines collected
- ~30-50 entities discovered
- ~15-25 auto-applied (≥85%)
- 10-15% accuracy improvement

### Month 1
- 1000+ headlines collected
- 100+ entities classified
- ~70+ auto-applied
- 95%+ parser accuracy

### Long-term
- **Zero manual intervention**
- Continuous self-improvement
- Adapts to new terminology automatically

---

## 🔍 Monitoring Queries

### Auto-Apply Success Rate
```sql
SELECT 
  status,
  COUNT(*) as count,
  ROUND(AVG((output->>'confidence')::numeric), 2) as avg_confidence
FROM ai_logs 
WHERE type = 'ontology_suggestion'
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY status;
```

### Recent Ontology Growth
```sql
SELECT 
  source,
  entity_type,
  COUNT(*) as count
FROM entity_ontologies
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY source, entity_type
ORDER BY count DESC;
```

### Classification Accuracy Over Time
```sql
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total,
  SUM(CASE WHEN status = 'auto_applied' THEN 1 ELSE 0 END) as auto_applied,
  ROUND(AVG((output->>'confidence')::numeric), 2) as avg_confidence
FROM ai_logs
WHERE type = 'ontology_suggestion'
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

---

## 🆘 Troubleshooting

### ML Agent Not Running
```bash
# Check PM2 status
pm2 status ml-ontology-agent

# View errors
pm2 logs ml-ontology-agent --err --lines 20

# Restart
pm2 restart ml-ontology-agent
```

### No Classifications Being Made
```bash
# Check if RSS data is coming in
node list-discovered-startups.js | tail -20

# Check entity frequency
# Should see entities appearing 3+ times
```

### Low Auto-Apply Rate
```sql
-- Check confidence distribution
SELECT 
  CASE 
    WHEN (output->>'confidence')::numeric >= 0.85 THEN '≥85%'
    WHEN (output->>'confidence')::numeric >= 0.70 THEN '70-84%'
    ELSE '<70%'
  END as confidence_range,
  COUNT(*) as count
FROM ai_logs
WHERE type = 'ontology_suggestion'
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY confidence_range;

-- If most are < 85%, ML model may need tuning
-- Check contexts/prompts in ml-ontology-agent.js
```

### OpenAI API Issues
```bash
# Check API key is set
echo $OPENAI_API_KEY

# Test API call manually
# Agent will log specific API errors
pm2 logs ml-ontology-agent --lines 100 | grep "401\|429\|500"
```

---

## ⚙️ Advanced Configuration

### Change Auto-Apply Threshold
```javascript
// More conservative (higher confidence required)
AUTO_APPLY_THRESHOLD: 0.90  // 90%

// More aggressive (lower confidence required)
AUTO_APPLY_THRESHOLD: 0.80  // 80%
```

### Change Schedule
```javascript
// In ecosystem.config.js
cron_restart: '0 */3 * * *'  // Every 3 hours (more frequent)
cron_restart: '0 */12 * * *' // Every 12 hours (less frequent)
```

### Batch Size
```javascript
// More entities per run (more API calls)
BATCH_SIZE: 100

// Fewer entities (faster runs)
BATCH_SIZE: 25
```

---

## 📖 Related Documentation

- [ML_ONTOLOGY_SYSTEM.md](ML_ONTOLOGY_SYSTEM.md) - Full system documentation
- [ONTOLOGY_SYSTEM.md](ONTOLOGY_SYSTEM.md) - Ontology architecture
- [PARSER_TESTING_GUIDE.md](PARSER_TESTING_GUIDE.md) - Testing procedures
- [ecosystem.config.js](ecosystem.config.js) - PM2 configuration

---

## ✨ Key Benefits

✅ **Zero Human Labor** - Fully autonomous operation  
✅ **Self-Improving** - Quality increases over time  
✅ **Audit Trail** - All decisions logged to ai_logs  
✅ **Safe Thresholds** - Only high-confidence auto-applied  
✅ **Immediate Impact** - Parser uses new ontologies instantly  
✅ **Cost Efficient** - Uses gpt-4o-mini (fast & cheap)  
✅ **Scalable** - Handles growing RSS data automatically  

---

**Status:** 🟢 Production Ready  
**Last Tested:** January 25, 2026  
**Auto-Applied Today:** Check `ai_logs` table  
**Next Scheduled Run:** Check `pm2 list`
