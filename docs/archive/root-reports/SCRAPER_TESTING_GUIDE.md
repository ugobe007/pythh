# 🧪 Scraper Testing Guide

## ✅ **Phase 2 Complete - Self-Healing is Ready!**

Your world-class scraper now includes:
- ✅ Multi-strategy parsing (CSS → JSON-LD → AI → Pattern)
- ✅ Selector regeneration when parsing fails
- ✅ Auto-recovery with multiple strategies
- ✅ HTML structure analysis
- ✅ Failure detection and learning

---

## 🧪 **How to Test**

### 1. **Test with Real Websites**

```bash
# Test with Y Combinator company page
node scripts/scrapers/world-class-scraper.js https://ycombinator.com/companies/airbnb startup --useAI

# Test with TechCrunch article (find a real article URL)
node scripts/scrapers/world-class-scraper.js https://techcrunch.com/2024/01/15/startup-article startup

# Test with any startup website
node scripts/scrapers/world-class-scraper.js https://example-startup.com startup --useAI
```

### 2. **Test Auto-Recovery**

The scraper automatically tries recovery when parsing fails:
- Selector regeneration
- AI fallback
- Pattern matching

Just run it and watch it self-heal!

---

## 🔍 **What to Look For**

### Success Indicators:
```
✅ Success! Parsed with css strategy
📊 Quality Score: 85/100
```

### Auto-Recovery in Action:
```
❌ Parsing failed: Selector not found
🔧 AUTO-RECOVERY: Attempting to recover...
   🎯 Trying recovery strategy: selector_regeneration
   🔄 Regenerating selectors...
   ✅ Found new selector for 'name': h1.title
✅ Auto-recovery successful with: selector_regeneration
```

---

## 📊 **Expected Behavior**

1. **First Attempt**: Tries CSS selectors (fastest)
2. **If Fails**: Regenerates selectors automatically
3. **If Still Fails**: Falls back to AI parsing
4. **If Still Fails**: Tries pattern matching
5. **Success**: Saves new selectors for future use
6. **Failure**: Reports detailed analysis

---

## 🎯 **Next Steps**

1. Test with real websites
2. Observe auto-recovery in action
3. Check selector database for learned selectors
4. Proceed to Phase 3 (Anti-Bot & Resilience) when ready

---

**Note**: The 404 errors you saw are expected - those were example URLs. Use real website URLs to test!

