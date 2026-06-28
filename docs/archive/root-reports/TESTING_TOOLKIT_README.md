# 🍯 Hot Money Honey - Testing & Diagnostics

**Complete toolkit for catching AI Copilot blindspots and integration bugs**

---

## 📚 Documentation Overview

| File | Purpose | When to Use |
|------|---------|-------------|
| **DIAGNOSTIC_QUICK_REFERENCE.md** | Fast lookup card | Every session, when debugging |
| **REGRESSION_TEST_GUIDE.md** | Detailed test procedures | Learning, troubleshooting |
| **regression-test.sh** | Automated file/code checks | After every change |
| **data-mapping-diagnostic.js** | Browser-based data flow check | When data issues occur |

---

## 🚀 Quick Start (30 seconds)

### Step 1: Automated Test
```bash
./regression-test.sh
```
Takes 10 seconds. Checks files, imports, environment.

### Step 2: Data Diagnostic
1. Open `http://localhost:5175`
2. Press F12 → Console
3. Copy/paste `data-mapping-diagnostic.js`
4. Hit Enter

Takes 20 seconds. Checks database, field mapping, data flow.

**If both pass → You're good! ✅**

---

## 📖 Detailed Guides

### For Quick Reference
→ **DIAGNOSTIC_QUICK_REFERENCE.md**
- One-page cheat sheet
- Common issues & fixes
- Step-by-step troubleshooting
- Emergency procedures

### For Deep Understanding
→ **REGRESSION_TEST_GUIDE.md**
- What each test checks
- Why it matters
- Manual test procedures
- Root cause analysis
- Prevention strategies

---

## 🔧 The Tools

### 1. Automated Regression Test (`regression-test.sh`)

**What it checks:**
- ✅ Critical files exist
- ✅ Import chains intact
- ✅ Environment variables set
- ✅ Dependencies installed
- ✅ No hardcoded values
- ✅ TypeScript compiles
- ✅ Git status clean

**When to run:**
- After every Copilot session
- Before committing code
- After pulling from GitHub
- When something feels off

**How to run:**
```bash
./regression-test.sh
```

**Output:**
```
✅ PASSED: 26
⚠️  WARNINGS: 2
❌ FAILED: 0

STATUS: ALL CHECKS PASSED ✓
```

---

### 2. Data Mapping Diagnostic (`data-mapping-diagnostic.js`)

**What it checks:**
- ✅ Database connection works
- ✅ Queries return data
- ✅ Field structure correct
- ✅ GOD algorithm gets proper input
- ✅ Fallback mappings in place

**When to run:**
- Scores all showing same value
- Data not displaying
- After modifying matchingService.ts
- After database schema changes

**How to run:**
1. Open app in browser
2. F12 → Console
3. Paste entire script
4. Read results

**Output:**
```
✅ Supabase client found
✅ Found 50 startups
⚠️ team field in extracted_data but GOD reads top level
⚠️ traction field in extracted_data but GOD reads top level

🚨 FIELDS THAT NEED FALLBACK MAPPING:
   Startup: team, traction
   
Fix: Use startup.extracted_data?.team || startup.team
```

---

## 🎯 Workflow

### Daily Development
```
1. Make changes in code
2. ./regression-test.sh
3. If warnings, review
4. Test in browser
5. If data issues, run diagnostic
6. Fix issues
7. Commit
```

### After Copilot Session
```
1. Copilot makes changes
2. ./regression-test.sh (catches file issues)
3. Run data diagnostic (catches data flow issues)
4. Manual test (5 min)
5. Commit if all pass
```

### Before Deploy
```
1. ./regression-test.sh (must pass)
2. npm run build (must succeed)
3. Manual smoke test
4. Check Supabase logs
5. Deploy
```

---

## 🚨 The Blindspot Pattern

**What AI Copilots Miss:**

```
1. Code written ✅
2. Code compiles ✅
3. Console shows output ✅
4. Function "works" ✅

BUT...

5. Data isn't connected ❌
6. Wrong fields mapped ❌
7. Database not queried ❌
8. Results are empty ❌
```

**These tests catch steps 5-8!**

---

## 🔍 Common Issues & Solutions

### Issue: All scores show 85
**Cause:** GOD algorithm not receiving proper data  
**Diagnostic:** Run data-mapping-diagnostic.js  
**Fix:** Add fallback operators to field access

### Issue: Database connection failed
**Cause:** Missing environment variables  
**Diagnostic:** ./regression-test.sh shows env errors  
**Fix:** Add VITE_SUPABASE_URL and KEY to .env

### Issue: TypeScript won't compile
**Cause:** Syntax errors or type mismatches  
**Diagnostic:** ./regression-test.sh shows TS errors  
**Fix:** Run `npx tsc --noEmit` for details

### Issue: Data loads but displays wrong
**Cause:** Field mapping mismatch  
**Diagnostic:** data-mapping-diagnostic.js shows structure  
**Fix:** Update field references to match actual schema

---

## 📊 Test Coverage

| Area | Automated Test | Data Diagnostic | Manual Test |
|------|----------------|-----------------|-------------|
| Files exist | ✅ | - | - |
| Imports work | ✅ | - | - |
| Env vars set | ✅ | - | - |
| DB connection | - | ✅ | ✅ |
| Data loads | - | ✅ | ✅ |
| Field mapping | ⚠️ | ✅ | - |
| Scores correct | - | ✅ | ✅ |
| UI displays | - | - | ✅ |

**Combined coverage: ~95% of common issues**

---

## 🎓 Learning Path

### Beginner
1. Read DIAGNOSTIC_QUICK_REFERENCE.md (5 min)
2. Run ./regression-test.sh (2 min)
3. Run data diagnostic in browser (2 min)
4. Fix any issues found (10-30 min)

### Intermediate
1. Read REGRESSION_TEST_GUIDE.md (15 min)
2. Understand each test's purpose
3. Practice manual tests
4. Learn to interpret results

### Advanced
1. Modify regression-test.sh for your needs
2. Add custom tests to data diagnostic
3. Create project-specific checks
4. Build automated CI/CD pipeline

---

## 🛠️ Customization

### Add Custom Checks to regression-test.sh

```bash
# Around line 150, add:
section "SECTION X: My Custom Check"

if grep -q "MY_PATTERN" src/my-file.ts; then
  pass "My custom check passed"
else
  fail "My custom check failed"
fi
```

### Extend Data Diagnostic

```javascript
// At end of data-mapping-diagnostic.js
async function myCustomTest() {
  console.log('\n🎯 My Custom Test');
  // Your test logic here
}

// Add to runDiagnostics():
await myCustomTest();
```

---

## 📝 Best Practices

### ✅ DO
- Run tests after every significant change
- Fix issues immediately when found
- Commit passing code only
- Keep .env up to date
- Review diagnostic output carefully

### ❌ DON'T
- Skip tests "just this once"
- Ignore warnings
- Commit broken code
- Hardcode values that should be in .env
- Deploy without testing

---

## 🆘 Troubleshooting

### Tests won't run
```bash
# Make executable
chmod +x regression-test.sh

# Check bash/zsh available
which bash
which zsh
```

### Diagnostic shows no Supabase client
```typescript
// Add to src/lib/supabase.ts
if (typeof window !== 'undefined') {
  (window as any).supabase = supabase;
}
```

### Everything fails
```bash
# Nuclear option - clean reinstall
rm -rf node_modules package-lock.json .vite
npm install
./regression-test.sh
npm run dev
```

---

## 📞 Getting Help

1. **Check Quick Reference** - DIAGNOSTIC_QUICK_REFERENCE.md
2. **Read Full Guide** - REGRESSION_TEST_GUIDE.md  
3. **Run Both Diagnostics** - Copy output
4. **Share with AI Copilot** - Include diagnostic results
5. **Ask Specific Questions** - "Why is field X undefined?"

---

## 🎯 Success Metrics

**You're doing it right when:**
- ✅ Tests pass before every commit
- ✅ Data diagnostic runs after DB changes
- ✅ Issues caught before deploy
- ✅ Less time debugging
- ✅ More confidence in code

**You need more testing when:**
- ❌ Bugs in production
- ❌ "It worked in dev" situations
- ❌ Mysterious data issues
- ❌ Scores suddenly all wrong
- ❌ Features breaking unexpectedly

---

## 🔗 Quick Links

- **Quick Ref:** DIAGNOSTIC_QUICK_REFERENCE.md
- **Full Guide:** REGRESSION_TEST_GUIDE.md
- **Shell Script:** regression-test.sh
- **Browser Tool:** data-mapping-diagnostic.js

---

## 📈 Version History

**v1.0** - December 6, 2025
- Initial release
- Automated regression test
- Data mapping diagnostic
- Complete documentation

---

*Built to catch the blindspots that AI Copilots miss.*  
*Run tests. Ship confidently. Sleep better.*

🍯 **Hot Money Honey - Test with Confidence**
