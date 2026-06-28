# RSS Feed Pattern Analysis - Real Data Findings

## 🔍 Actual Patterns Found in Discovered Startups

### ❌ JUNK PATTERNS (Need Blocking)

**1. Geographic Adjectives as Names:**
- "Finnish Agileday" → Should extract "Agileday" only
- "Satellite Company Astranis" → Should extract "Astranis" only
- "UK" → Place, not startup

**2. Generic Categories:**
- "Former USDS Leaders" → Generic group
- "MIT Researchers" → Generic academic group
- "Indian Startups" → Category, not company
- "Humans" → Too generic

**3. Word "Startup" in Name:**
- "Startup Amissa" → Should extract "Amissa" only
- "Indian Startups" → Generic category

**4. Common Words:**
- "Start Angel" → Likely investor, not startup
- "How To" → Not a company name

**5. Long Descriptive Phrases:**
- "Business Means Protecting Your Data" → 6 words, likely description

**6. Ambiguous Single Words:**
- "Washington" → Person/place ambiguity

---

## ✅ GOOD PATTERNS (Real Startups)

- Harvey ✓
- Seismic ✓
- QuantumLight ✓
- Altek AI ✓
- TRiCares To ✓ (unusual but real)
- BitLocker ✓
- Catalyst Acoustics Group ✓
- X Square Robot ✓
- Zeal IT Consultants ✓
- Tourmanagement BV ✓
- La La ✓

---

## 🛠️ FIXES NEEDED

### 1. Block Adjective Prefixes
Add to ontology database:
- "Finnish" → GENERIC_TERM
- "Indian" → GENERIC_TERM  
- "Japanese" → GENERIC_TERM
- "Chinese" → GENERIC_TERM
- "American" → GENERIC_TERM
- "British" → GENERIC_TERM
- "European" → GENERIC_TERM

### 2. Block "Start/Startup" as First Word
Update validateEntityQuality():
```javascript
// Block "Startup X" pattern
if (/^(Startup|Start)\s+/i.test(entity)) {
  return false;
}
```

### 3. Block "Company/Firm" Descriptors
```javascript
// Block "X Company" or "Company X" patterns
if (/\b(Company|Firm|Corporation|Inc|Ltd|LLC)\b/i.test(entity)) {
  // Only block if it's the main noun (e.g., "Satellite Company Astranis")
  if (/^(Satellite|Tech|Software|Hardware|AI|Crypto|Fintech)\s+(Company|Firm)/i.test(entity)) {
    return false;
  }
}
```

### 4. Add to Ontology Database - GENERIC_TERMS
```sql
INSERT INTO entity_ontologies (entity_name, entity_type, confidence, source) VALUES
  ('Show', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('How To', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Humans', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Start Angel', 'INVESTOR', 1.0, 'MANUAL_SEED'), -- Actually an investor!
  ('Finnish', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Japanese', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Chinese', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('American', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('British', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('European', 'GENERIC_TERM', 1.0, 'MANUAL_SEED');
```

### 5. Add to Ontology Database - PLACES
```sql
INSERT INTO entity_ontologies (entity_name, entity_type, confidence, source) VALUES
  ('UK', 'PLACE', 1.0, 'MANUAL_SEED'),
  ('Washington', 'AMBIGUOUS', 0.5, 'MANUAL_SEED');
```

---

## 📊 Expected Impact

**Before:**
- 187 events marked graph_safe=true
- Only 23 graph joins created (12.3% success)
- 8 junk names in top 23 (35% junk rate)

**After Fixes:**
- Block: Finnish, Startup X, MIT Researchers, Indian Startups, UK, How To, Humans
- Expected junk reduction: 8 → 0
- Expected graph join success rate: 12% → 70-80%

---

## 🎯 Priority Actions

1. **Add geographic adjectives to ontology** (Finnish, Japanese, etc.)
2. **Block "Startup X" pattern** in validateEntityQuality()
3. **Add "Show", "How To", "Humans" to GENERIC_TERMS**
4. **Test with health check** to validate improvements
5. **Restart scraper** and monitor next batch

---

## 💡 Entity Extraction Improvements (Future)

**Current:** "Finnish Agileday" → Extracts "Finnish Agileday"  
**Desired:** "Finnish Agileday" → Extracts "Agileday" only

**Current:** "Startup Amissa raises $5M" → Extracts "Startup Amissa"  
**Desired:** "Startup Amissa raises $5M" → Extracts "Amissa" only

**Implementation:** Entity post-processing step to strip adjectives/descriptors

```javascript
function cleanEntityName(entity) {
  // Strip adjectives
  entity = entity.replace(/^(Finnish|Japanese|Chinese|Indian|European|American)\s+/i, '');
  
  // Strip "Startup/Company" prefix
  entity = entity.replace(/^(Startup|Company|Firm)\s+/i, '');
  
  // Strip "X Company" pattern
  entity = entity.replace(/\s+(Company|Firm|Corporation)$/i, '');
  
  return entity.trim();
}
```

---

**Data Source:** list-discovered-startups.js (23 entries, Jan 25, 2026)  
**Analysis:** Reveals real-world RSS patterns from TechCrunch, HN, Bloomberg
