# Production Test Suite for LongitudinalMatchPair

## High-Leverage Tests (Lock Regressions)

These 6 tests cover the most critical functionality and prevent regressions:

### 1. **Renders correct pair when currentIndex changes**
**Purpose:** Ensure startup + investor swap together atomically  
**Test:** Change currentIndex → verify both startup and investor update  
**Assertion:** `screen.getByText(match.startup.name)` AND `screen.getByText(match.investor.name)`

```typescript
test('renders correct startup-investor pair on index change', () => {
  const { rerender } = render(<MatchingEngine />);
  
  // Initial match
  expect(screen.getByText('Startup A')).toBeInTheDocument();
  expect(screen.getByText('Investor 1')).toBeInTheDocument();
  
  // Simulate next match
  act(() => {
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
  });
  
  // Verify both changed
  expect(screen.getByText('Startup B')).toBeInTheDocument();
  expect(screen.getByText('Investor 2')).toBeInTheDocument();
});
```

---

### 2. **Save toggles current batch item** (Regression Test)
**Purpose:** Prevent the bug where save used `matches[currentIndex]` instead of `batchMatches[currentIndex]`  
**Test:** With batched matches, verify save uses correct index  
**Assertion:** `saveMatch` called with correct startup/investor IDs

```typescript
test('save uses batchMatches[currentIndex], not matches[currentIndex]', () => {
  const saveMatchMock = jest.fn();
  render(<MatchingEngine saveMatch={saveMatchMock} />);
  
  // Navigate to batch 2, index 0
  // ... navigation code ...
  
  fireEvent.click(screen.getByRole('button', { name: /save/i }));
  
  // Verify correct match was saved (batch 2, index 0)
  expect(saveMatchMock).toHaveBeenCalledWith(
    expect.objectContaining({
      startupId: batchMatches[0].startup.id,
      investorId: batchMatches[0].investor.id,
    })
  );
});
```

---

### 3. **Copy outreach → toast appears + clipboard called**
**Purpose:** Verify clipboard integration and user feedback  
**Test:** Click copy → toast visible + clipboard API called  
**Assertion:** Toast with "Outreach copied ✅" + clipboard.writeText called

```typescript
test('copy outreach shows toast and calls clipboard API', async () => {
  const clipboardMock = jest.fn().mockResolvedValue(undefined);
  Object.assign(navigator, {
    clipboard: { writeText: clipboardMock },
  });
  
  render(<LongitudinalMatchPair {...mockProps} />);
  
  fireEvent.click(screen.getByRole('button', { name: /copy outreach/i }));
  
  // Toast appears
  expect(await screen.findByText(/outreach copied/i)).toBeInTheDocument();
  
  // Clipboard called with formatted text
  expect(clipboardMock).toHaveBeenCalledWith(
    expect.stringContaining('Hi Investor Name')
  );
});
```

---

### 4. **Clipboard fallback path test**
**Purpose:** Ensure Safari/insecure context fallback works  
**Test:** Mock clipboard failure → verify execCommand fallback  
**Assertion:** `document.execCommand('copy')` called on failure

```typescript
test('uses execCommand fallback when clipboard API fails', async () => {
  const clipboardMock = jest.fn().mockRejectedValue(new Error('API failed'));
  Object.assign(navigator, {
    clipboard: { writeText: clipboardMock },
  });
  
  const execCommandSpy = jest.spyOn(document, 'execCommand');
  
  render(<LongitudinalMatchPair {...mockProps} />);
  fireEvent.click(screen.getByRole('button', { name: /copy outreach/i }));
  
  await waitFor(() => {
    expect(execCommandSpy).toHaveBeenCalledWith('copy');
  });
});
```

---

### 5. **LinkedIn normalization**
**Purpose:** Ensure protocol-less URLs get https:// prepended  
**Test:** Pass `linkedin.com/...` → verify rendered href is `https://linkedin.com/...`  
**Assertion:** Link href attribute includes protocol

```typescript
test('normalizes LinkedIn URL by adding https://', () => {
  const props = {
    ...mockProps,
    investor: {
      ...mockProps.investor,
      linkedin_url: 'linkedin.com/in/johndoe',
    },
  };
  
  render(<LongitudinalMatchPair {...props} />);
  
  const linkedinLink = screen.getByLabelText(/open.*linkedin/i);
  expect(linkedinLink).toHaveAttribute('href', 'https://linkedin.com/in/johndoe');
});
```

---

### 6. **Image onError swaps to placeholder**
**Purpose:** Graceful degradation for broken investor photos  
**Test:** Trigger img onError → verify 👤 emoji renders  
**Assertion:** Emoji visible (don't assume img disappears)

```typescript
test('shows placeholder emoji when investor photo fails to load', () => {
  const props = {
    ...mockProps,
    investor: {
      ...mockProps.investor,
      photo_url: 'https://broken-url.com/404.jpg',
    },
  };
  
  render(<LongitudinalMatchPair {...props} />);
  
  const img = screen.getByRole('img');
  
  // Trigger error
  fireEvent.error(img);
  
  // Verify placeholder renders (implementation may keep img or replace it)
  expect(screen.getByText('👤')).toBeInTheDocument();
});
```

---

### 7. **isAnalyzing shows "re-scoring…" without re-render explosion**
**Purpose:** Verify loading state doesn't cause infinite loops  
**Test:** Set isAnalyzing true → verify text changes + no excess renders  
**Assertion:** "re-scoring…" visible + render commits < 3

```typescript
import React, { Profiler } from "react";

test('shows re-scoring text when isAnalyzing without excessive re-renders', () => {
  const commits: number[] = [];
  const onRender = () => commits.push(1);

  const { rerender } = render(
    <Profiler id="pair" onRender={onRender}>
      <LongitudinalMatchPair {...mockProps} isAnalyzing={false} />
    </Profiler>
  );
  
  // Initial render
  expect(commits.length).toBe(1);

  // Trigger analyzing state
  rerender(
    <Profiler id="pair" onRender={onRender}>
      <LongitudinalMatchPair {...mockProps} isAnalyzing={true} />
    </Profiler>
  );

  expect(screen.getByText(/re-scoring/i)).toBeInTheDocument();
  expect(commits.length).toBeLessThanOrEqual(3); // Allow up to 3 commits
});
```

---

### 8. **Buttons disabled when IDs missing**
**Purpose:** Prevent ghost events and broken saves when data is incomplete  
**Test:** Render with null IDs → verify Save/Copy/View buttons disabled  
**Assertion:** All action buttons have disabled attribute

```typescript
test('disables action buttons when IDs are null or missing', () => {
  const props = {
    ...mockProps,
    startup: { ...mockProps.startup, id: null as any },
    investor: { ...mockProps.investor, id: null as any },
  };
  
  render(<LongitudinalMatchPair {...props} />);
  
  // All action buttons should be disabled
  expect(screen.getByRole('button', { name: /view investor/i })).toBeDisabled();
  expect(screen.getByRole('button', { name: /copy outreach/i })).toBeDisabled();
  expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
});

test('enables buttons when valid IDs are present', () => {
  render(<LongitudinalMatchPair {...mockProps} />);
  
  // All action buttons should be enabled (assuming mockProps has valid IDs)
  expect(screen.getByRole('button', { name: /view investor/i })).not.toBeDisabled();
  expect(screen.getByRole('button', { name: /copy outreach/i })).not.toBeDisabled();
  expect(screen.getByRole('button', { name: /save/i })).not.toBeDisabled();
});
```

---

## Telemetry Events (Funnel Tracking)

### Events Logged:
1. **`matchpair_viewed`**
   - `startup_id`, `investor_id`, `matchScore`, `index`, `batch_id`
   - Fired: On mount + currentIndex change
   
2. **`outreach_copied`**
   - `startup_id`, `investor_id`, `matchScore`, `has_linkedin`
   - Fired: Copy button click
   
3. **`investor_view_opened`**
   - `investor_id`
   - Fired: View Investor button click
   
4. **`match_saved`**
   - `startup_id`, `investor_id`
   - Fired: Save button click (when saving)
   
5. **`match_unsaved`**
   - `startup_id`, `investor_id`
   - Fired: Save button click (when removing)

### Implementation:
```typescript
// In MatchingEngine.tsx
const logEvent = (eventName: string, properties?: Record<string, any>) => {
  console.log(`📊 [Telemetry] ${eventName}`, properties);
  // TODO: Send to analytics service
  // analytics.track(eventName, properties);
};
```

---

## Data Sanitization (Production Guardrails)

### Implemented in MatchingEngine.tsx:

### 1. **ID Sanitization** ⚠️ CRITICAL FIX
```typescript
const sanitizeId = (id: any): string | null => {
  const s = String(id ?? "").trim();
  if (!s || s === "null" || s === "undefined") return null;
  return s;
};
```
**Why null instead of random IDs:**
- ❌ `temp-${Date.now()}-${Math.random()}` creates **unstable identities** across renders/sessions
- Breaks React list keys (UI jitter)
- Breaks save/unsave mapping (wrong item saved)
- Inflates telemetry (duplicate events)

**Stable render keys when IDs missing:**
```typescript
const renderKey = startupId && investorId
  ? `${startupId}:${investorId}`
  : `${startup?.website ?? "unknown"}:${investor?.linkedin_url ?? investor?.name ?? "unknown"}`;
```

#### 2. **Match Score Normalization**
```typescript
const sanitizeMatchScore = (score: any): number => {
  const num = Number(score);
  if (!Number.isFinite(num)) return 0;
  // If score is 0-1 float, convert to 0-100
  if (num > 0 && num <= 1) return Math.round(num * 100);
  // Clamp to 0-100 range
  return Math.max(0, Math.min(100, Math.round(num)));
};
```

#### 3. **Reasoning Array Normalization**
```typescript
const sanitizeReasoning = (reasoning: any): string[] => {
  if (!reasoning) return [];
  if (Array.isArray(reasoning)) 
    return reasoning.filter(r => typeof r === 'string' && r.trim());
  if (typeof reasoning === 'string') {
    try {
      const parsed = JSON.parse(reasoning);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return [reasoning.trim()]; // Blob string → array
    }
  }
  return [];
};
```

---

## Performance Optimizations

### 1. **Memoized Current Match**
```typescript
const currentMatch = useMemo(
  () => batchMatches[currentIndex], 
  [batchMatches, currentIndex]
);
```

### 2. **No Leaking Timers**
All setTimeout/setInterval calls are cleaned up in useEffect return functions.

### 3. **Virtualization** (Not Yet Needed)
Current implementation shows one match at a time, so virtualization not required. Add only if showing multiple matches simultaneously.

---

## Accessibility Checklist

✅ **Buttons have aria-labels** for screen readers  
✅ **Focus states visible** with `focus:ring-2` classes  
✅ **External links announce "opens in new tab"**  
✅ **Toasts use `role="status"` and `aria-live="polite"`**  
✅ **Icons marked `aria-hidden="true"`** (not interactive)  
✅ **Save button has `aria-pressed`** (toggle state)

---

## Action Disable Rules 🛡️

### When IDs Are Missing
All action buttons are **disabled** if required IDs are missing:

```typescript
// In LongitudinalMatchPair.tsx
const canSave = !!startupId && !!investorId;
const canCopy = !!startupId && !!investorId && !!startupName && !!invName;
const canViewInvestor = !!investorId;

// Buttons
<button disabled={!canViewInvestor || !onViewInvestor}>View investor</button>
<button disabled={!canCopy || !onCopyOutreach}>Copy outreach</button>
<button disabled={!canSave || !onToggleSave}>Save</button>
```

### Handler Validation
All handlers validate IDs before proceeding:

```typescript
const handleCopy = async () => {
  if (!startupId || !investorId) {
    console.warn('⚠️ Missing IDs — cannot copy outreach');
    return;
  }
  // ... proceed
};
```

**This prevents:**
- Ghost telemetry events
- Broken saves (wrong match persisted)
- Navigation to /investor/undefined
- Crash cascades from null reference errors

---

## Telemetry Double-Firing Prevention 📊

### Problem
If `currentMatch` object is in useEffect deps, it fires on every re-render:

```typescript
// ❌ BAD: Fires repeatedly
useEffect(() => {
  logEvent("matchpair_viewed", { match: currentMatch });
}, [currentMatch]); // Object identity changes every render
```

### Solution
Use **stable primitives** in dependency array:

```typescript
// ✅ GOOD: Only fires when actual values change
useEffect(() => {
  if (!startupId || !investorId) return;
  logEvent("matchpair_viewed", { startup_id: startupId, investor_id: investorId, matchScore: score });
}, [startupId, investorId, score]); // Primitives (strings/numbers)
```

**Key principles:**
- Use `startupId`, `investorId`, `score` — not `currentMatch`
- Always guard with `if (!id) return;` to prevent logging null IDs
- Avoid objects/arrays in deps unless `useMemo`'d

---

## Running Tests

```bash
# Unit tests (Jest + RTL)
npm test

# E2E tests (Playwright)
npm run test:e2e

# Coverage report
npm test -- --coverage
```

---

## Ship Checklist Summary ✅

### Critical Fixes Applied (Jan 28, 2026)

| Fix | Status | Impact |
|-----|--------|--------|
| **sanitizeId returns null** | ✅ | Prevents unstable IDs breaking React keys, saves, telemetry |
| **ID validation in handlers** | ✅ | Guards against null reference errors + broken navigation |
| **Button disable rules** | ✅ | Blocks ghost events when data incomplete |
| **Telemetry stable deps** | ✅ | Prevents double-firing on re-renders |
| **Test #7 fixed** | ✅ | Now uses React Profiler for render counting |
| **Test #6 fixed** | ✅ | No longer assumes img element removed on error |

### Next Steps (In Order)

1. ⏳ **Convert test templates to actual files**
   - `src/__tests__/LongitudinalMatchPair.test.tsx` (RTL - 8 tests)
   - `src/__tests__/MatchingEngine.batch.test.tsx` (RTL, mocked router)
   - `tests/e2e/matching-engine.spec.ts` (Playwright - happy path)

2. ⏳ **Connect analytics service**
   ```typescript
   // Replace console.log in logEvent()
   const logEvent = (eventName: string, properties?: Record<string, any>) => {
     analytics.track(eventName, properties); // Mixpanel/Amplitude
   };
   ```

3. ⏳ **Monitor funnel metrics**
   - View → Copy conversion rate
   - View → Save conversion rate
   - Copy → Save correlation
   - Elite score (85+) performance

---

## Next Steps

1. ✅ Data sanitization implemented
2. ✅ Telemetry hooks added
3. ✅ Accessibility improved
4. ✅ Performance optimized
5. ⏳ Write actual test files (use templates above)
6. ⏳ Connect telemetry to analytics service (Mixpanel/Amplitude)
7. ⏳ Monitor funnel metrics in production

---

*Last updated: January 28, 2026*
