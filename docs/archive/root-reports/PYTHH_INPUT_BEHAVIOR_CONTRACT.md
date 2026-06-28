# PYTHH — INPUT BEHAVIOR CONTRACT v1.0

**The oracle responds only when consulted.**

---

## THE VIOLATION

The current async input behavior is **doctrine-breaking**:
- Parsing on keystroke
- Network calls on input change
- UI reaction before submit
- Validation during typing

This violates:
- **Agency** — "I didn't ask yet"
- **Ownership** — "It's reading me without permission"
- **Intentionality** — "The ritual hasn't started"
- **Control illusion** — "I'm not in control"
- **Destiny loop** — "I didn't invoke it"

It feels like:
> **"The machine is spying on me before I ask it to."**

Which is the opposite of empowerment.

---

## THE FIX — RULES (NON-NEGOTIABLE)

### 1. No parsing on keystroke.
**Absolutely forbidden.**

### 2. No network calls on input change.
**Ever.**

### 3. No UI reaction before Enter / Submit.
- No validation glow.
- No suggestions.
- No autocomplete.
- No previews.

### 4. Only one invocation trigger exists:
- → **Enter key**
- → **Submit button**

### 5. After invocation, UI transitions immediately.
- No spinner ritual.
- No waiting screen.

---

## WHY THIS MATTERS

**The act of pasting a URL is the ritual.**

If the system reacts before they commit:
- It **steals agency**
- It **breaks the magic**
- It makes the oracle feel **mechanical**
- It **kills the addiction loop**
- It **collapses wonderment**

---

## THE FOUNDER MUST FEEL:

✅ **"I chose to consult the oracle."**

NOT:

❌ **"The oracle is sniffing my clipboard."**

---

## IMPLEMENTATION REQUIREMENTS

### Before (VIOLATION):
```tsx
<input
  onChange={(e) => {
    validateURL(e.target.value); // ❌ FORBIDDEN
    fetchPreview(e.target.value); // ❌ FORBIDDEN
    setError(validate(e.target.value)); // ❌ FORBIDDEN
  }}
/>
```

### After (CORRECT):
```tsx
<input
  onKeyDown={(e) => {
    if (e.key === 'Enter') {
      handleSubmit(); // ✓ Only here
    }
  }}
/>
<button onClick={handleSubmit}>Submit</button> // ✓ Or here
```

### What to remove:
- ❌ `async` validation functions in input handlers
- ❌ `useEffect` that watches input value
- ❌ URL parsing on `onChange`
- ❌ Prefetch logic triggered by typing
- ❌ Debounced network calls
- ❌ Auto-scan on paste
- ❌ Clipboard listeners

### What to keep:
- ✓ Submit handler (Enter key or button click)
- ✓ Immediate transition to results (no spinner)
- ✓ Post-submit validation (if URL is invalid, show in results context)

---

## THE RITUAL SEQUENCE (CORRECT)

```
1. Founder pastes URL into field
   → Nothing happens (system is silent)

2. Founder presses Enter or clicks Submit
   → Ritual begins (invocation committed)

3. System transitions immediately to results
   → No loading screen, no "please wait"
   → Results page populates as data arrives

4. If URL is invalid
   → Show error in results context (not in input field)
   → Still preserve the ritual structure
```

---

## FORBIDDEN PATTERNS

❌ **"Validating URL..."** text during typing  
❌ **Green checkmark** when URL looks valid  
❌ **Red underline** before submit  
❌ **"Fetching data..."** spinner before submit  
❌ **Preview card** that appears while typing  
❌ **Suggested matches** dropdown  
❌ **"We found a startup at this URL"** before submit  

---

## WHY THIS IS NON-NEGOTIABLE

The oracle must be:
- **Invoked, not triggered**
- **Consulted, not watching**
- **Responsive to intent, not activity**

The founder must feel:
- **"I control when this starts"**
- **"The ritual begins when I say"**
- **"This responds to my will"**

NOT:
- **"It's reading my keystrokes"**
- **"It's guessing what I want"**
- **"It started before I was ready"**

---

## IMPLEMENTATION CHECKLIST

- [ ] Remove all `onChange` handlers that parse/validate URL
- [ ] Remove all `useEffect` watchers on input value
- [ ] Remove all async validation during typing
- [ ] Remove all prefetch/preview logic
- [ ] Remove all clipboard listeners
- [ ] Keep only `onKeyDown` (Enter) and `onClick` (Submit button)
- [ ] Move all validation into `handleSubmit` function
- [ ] Ensure immediate transition to results page on submit
- [ ] Error handling happens in results context, not input field
- [ ] Test: Type URL → Nothing happens until Enter/Submit

---

## RELATED CONTRACTS

- **PYTHH_CONSTITUTION.md** — Philosophy (agency, ownership)
- **PYTHH_DESTINY_ENGINE.md** — Addiction loop doctrine
- **PYTHH_FOUNDERS_OWNERSHIP_CONTRACT.md** — Emotional arc (agency moment)
- **PYTHH_ONSCREEN_SCRIPT.md** — Frontend execution
- **PYTHH_HOMEPAGE_SPATIAL_CONTRACT.md** — Invocation panel design

---

**This contract is FROZEN. Any input behavior that reacts before explicit submission is a doctrine violation.**

---

## THE PRINCIPLE

**Only the explicit act of submission invokes destiny.**
