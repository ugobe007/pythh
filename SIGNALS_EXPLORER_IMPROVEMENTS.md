# SignalsExplorer Page Improvements

## Changes Implemented

### ✅ Patch A: Remove Blank-Page Gate
- **Before:** Users saw blank page until they selected a startup
- **After:** Empty state properly shows search instruction with recent startup suggestions
- **Implementation:**
  - Removed conditional render gate that only showed content if `selected`
  - Added proper empty state component that displays when no selection made
  - Shows first 6 recent results as quick-select buttons

### ✅ Patch B: Add Persistence & Auto-Select Logic

#### B.1: Load Last Selection on Mount
```typescript
useEffect(() => {
  const raw = localStorage.getItem('signals:selected');
  if (raw) {
    try { setSelected(JSON.parse(raw)); } catch {}
  }
}, []);
```
- Users returning to page see their last-searched startup immediately
- Stored in `signals:selected` key in localStorage
- Silent fallback if parsing fails (doesn't break page)

#### B.2: Auto-Select When Exactly 1 Result
```typescript
useEffect(() => {
  if (!selected && results?.length === 1) {
    handleSelect(results[0]);
  }
}, [results, selected]);
```
- If search returns exactly 1 startup, automatically select it
- Skips if already have a selection
- Dramatically improves UX for specific searches (e.g., "Karumi")

#### B.3: Unified Selection Handler
```typescript
async function handleSelect(s: StartupRow) {
  setSelected(s);
  localStorage.setItem('signals:selected', JSON.stringify(s));
  await loadForStartup(s);
}
```
- Both search results and "select all" buttons route through this handler
- Ensures consistent persistence + loading behavior
- Replaces previous inline `loadForStartup()` calls

### ✅ Search Configuration Verified
- **Table:** `startup_uploads`
- **Search Field:** `name`
- **Operator:** `.ilike()` (case-insensitive)
- **Pattern:** `%${query}%` (substring match)
- **Limit:** 10 results max
- **Result Fields:** `id, name, tagline, sectors, total_god_score`

### ✅ Debug Panel Enhanced
- Added expandable debug panel with detailed info:
  - Search configuration (table, field, operator, pattern)
  - Results count and first result details
  - Selected startup details with GOD score
  - Matches table info (count, alignment stats)
  - Related data loaded (investors, signals, exhaust)
- Uses `<details>` element to keep UI clean by default
- Click "Show Debug Info" to expand JSON output

## State Machine Flow

```
1. Page Mount
   ├─ Check localStorage for 'signals:selected'
   └─ If found, restore selected startup

2. User Types Query
   ├─ Debounced search (250ms)
   ├─ Query startup_uploads.name with ILIKE
   ├─ Set results (max 10)
   └─ Auto-select if exactly 1 result

3. User Selects Startup
   ├─ Set selected state
   ├─ Save to localStorage
   ├─ Load matches, investors, signals, exhaust
   └─ Display signals explorer view

4. Navigation Away & Back
   ├─ Restore selected startup from localStorage
   └─ Reload all match data
```

## Files Modified
- [src/pages/app/SignalsExplorer.tsx](src/pages/app/SignalsExplorer.tsx)
  - Removed blank-page conditional
  - Added empty state UI
  - Added persistence effects
  - Added unified selection handler
  - Enhanced debug panel

## Testing
- [x] Page loads without blank screen
- [x] Search works with ILIKE on name
- [x] Exact match (1 result) auto-selects
- [x] Selection persists on page reload
- [x] Search results show GOD scores
- [x] Debug panel shows table/field info
- [x] No console errors

## Related Components
- **parent:** [src/pages/app/index.tsx](src/pages/app/index.tsx)
- **queries:** Search uses `startup_uploads`, matches use `faith_alignment_matches`
- **sibling:** [src/pages/InstantMatches.tsx](src/pages/InstantMatches.tsx) (similar pattern)
