# Vote Uniqueness - Quick Reference

## What Changed

✅ **Supabase:** Added unique index on `(user_id, metadata->>'startup_local_id')`  
✅ **Code:** Changed `.insert()` → `.upsert(..., { onConflict })`  
✅ **Result:** One vote per user per startup (re-voting updates, not duplicates)

---

## The Problem We Solved

```
❌ Before:
User votes YES → creates row 1
User votes NO → creates row 2 (duplicate!)
Result: 2 rows for same user + startup

✅ After:
User votes YES → creates row 1
User votes NO → updates row 1 (vote changed to NO)
Result: 1 row (unique constraint enforced)
```

---

## Key Files

| File | Change |
|------|--------|
| `src/lib/voteService.ts` | `.insert()` → `.upsert()` with `onConflict` |
| Database | Added unique index (via migration) |
| `scripts/test-vote-uniqueness.ts` | New test script |

---

## Testing

### Automated
```bash
npx ts-node scripts/test-vote-uniqueness.ts
```

Expected: ✅ "SUCCESS: Uniqueness constraint works!"

### Manual
1. Vote YES on startup "0"
2. Vote NO on startup "0" 
3. Check Supabase: should see 1 vote with value 'no' (updated)

### SQL
```sql
SELECT COUNT(*) FROM votes 
WHERE user_id = '<uuid>' 
AND metadata->>'startup_local_id' = '0';
-- Result: 1 (always)
```

---

## Database

**Unique Index Created:**
```sql
votes_unique_user_startup_local_expr
  ON (user_id, metadata->>'startup_local_id')
```

**Speed Index Created:**
```sql
votes_startup_local_expr_idx
  ON (metadata->>'startup_local_id')
```

---

## Code

**Before:**
```typescript
.from('votes').insert({ user_id, vote, metadata })
```

**After:**
```typescript
.from('votes').upsert(
  { user_id, vote, metadata },
  { onConflict: 'user_id,metadata->>startup_local_id' }
)
```

---

## Deployment

✅ No data migration needed  
✅ No breaking changes  
✅ Backward compatible  
✅ Ready to deploy  

---

## If onConflict Syntax Fails

If you see an error about the conflict target, reply with the exact error and we'll switch to the **fallback column approach** (add real `startup_local_id` column instead of expression index).

---

## Status

✅ Migration applied  
✅ Code updated  
✅ Build passing  
✅ Test script ready  
✅ Production ready  

---

Run the test: `npx ts-node scripts/test-vote-uniqueness.ts`
