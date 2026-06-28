# Hot Match Safety Measures

## ✅ What We've Fixed

All critical data loss bugs have been **FIXED**:
- ✅ No more DELETE/TRUNCATE operations in match generation
- ✅ All scripts now process ALL startups (no LIMITs)
- ✅ All scripts use UPSERT to preserve existing data
- ✅ `created_at` timestamps are preserved

## 🛡️ Safety Measures Implemented

### 1. Code-Level Safeguards

**All match generation scripts now:**
- Use `INSERT ... ON CONFLICT DO UPDATE` (preserves existing matches)
- Process ALL startups (no arbitrary LIMITs)
- Never DELETE or TRUNCATE the matches table
- Preserve `created_at` timestamps on updates

### 2. Monitoring Script

Created `scripts/safeguard-match-count.ts`:
- Monitors match count before/after operations
- Alerts if count drops below safe threshold (100K)
- Can be integrated into automation pipeline

### 3. Documentation

- `AUDIT_FINDINGS.md` - All bugs found and fixed
- `MATCH_GENERATION_BUG_FIX.md` - Detailed fix documentation
- `AUDIT_PLAN.md` - Ongoing audit checklist

## 🔍 What to Watch For

### Red Flags (Immediate Investigation)

1. **Match count drops suddenly**
   - Check PM2 logs for match generation runs
   - Review any recent script executions
   - Check database for DELETE operations

2. **Match count not growing**
   - Verify match generation scripts are running
   - Check for errors in automation logs
   - Verify startups are being processed

3. **All matches have same `created_at`**
   - Indicates bulk regeneration happened
   - Check if matches were preserved (count should be stable)

### Safe Operations

✅ **These are SAFE:**
- Running `generate-matches.js` (uses upsert)
- Running `generate-matches-v2.js` (now fixed)
- Running `match-regenerator.js` (now fixed)
- Updating individual match scores
- Adding new matches

❌ **These are DANGEROUS:**
- Any script with `DELETE FROM startup_investor_matches`
- Any script with `TRUNCATE startup_investor_matches`
- Any script with `LIMIT 1000` or similar on startups
- Running multiple match generation scripts simultaneously

## 📊 Monitoring Dashboard

Check these regularly:

1. **Match Count** (`/admin/control`)
   - Should be stable or growing
   - Alert if drops > 20%

2. **Match Generation Logs** (PM2)
   ```bash
   pm2 logs match-regen
   ```

3. **Daily Reports**
   - Check for match count in daily reports
   - Verify count is consistent

## 🚨 Emergency Procedures

### If Match Count Drops Suddenly

1. **STOP all match generation scripts**
   ```bash
   pm2 stop match-regen
   pm2 stop hot-match-automation
   ```

2. **Check what happened**
   ```bash
   pm2 logs --lines 100
   grep -i "delete\|truncate" logs/*.log
   ```

3. **Check database**
   ```bash
   npx tsx scripts/check-match-count.ts
   ```

4. **Restore from backup** (if available)
   - Check Supabase backups
   - Restore matches table if needed

### Prevention Checklist

Before running any script that modifies matches:
- [ ] Does it use UPSERT, not DELETE/TRUNCATE?
- [ ] Does it process ALL startups, not just a subset?
- [ ] Does it preserve `created_at` timestamps?
- [ ] Is it the only match generation script running?

## 📝 Best Practices Going Forward

1. **Always use UPSERT** for match generation
2. **Never DELETE/TRUNCATE** the matches table
3. **Process ALL data**, not subsets
4. **Preserve timestamps** on updates
5. **Test scripts** on a small dataset first
6. **Monitor match counts** after any changes
7. **Document** any destructive operations

## 🔄 Regular Audits

Schedule regular audits:
- **Weekly**: Check match count trends
- **Monthly**: Review all scripts for DELETE/TRUNCATE
- **Quarterly**: Full system audit

## 💡 Questions to Ask Before Changes

1. "Will this delete any data?"
2. "Does this process all records or just some?"
3. "What happens if this script fails partway through?"
4. "Can this run at the same time as other scripts?"
5. "How do we recover if something goes wrong?"

---

**Remember**: The bugs are fixed, but vigilance is key. Always verify scripts before running them, and monitor match counts regularly.



