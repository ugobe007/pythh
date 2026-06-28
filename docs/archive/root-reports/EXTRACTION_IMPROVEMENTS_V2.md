# 🔧 Extraction Improvements V2

## New Patterns Added

### 1. "Our investment in CompanyName"
- Pattern: `/(?:our\s+)?investment\s+in\s+([A-Z][a-zA-Z0-9]+)/i`
- Example: "Our investment in JOON" → "JOON" ✅

### 2. "according to CompanyName's"
- Pattern: `/(?:according\s+to|from|by)\s+([A-Z][a-zA-Z0-9]+)'s/i`
- Example: "according to Mercor's" → "Mercor" ✅

### 3. "CompanyName CEO"
- Pattern: `/([A-Z][a-zA-Z0-9]+)(?:'s)?\s+(?:CEO|CTO|CFO|COO|founder|co-founder)/i`
- Example: "Sandbar CEO Mina" → "Sandbar" ✅

### 4. "X firm CompanyName" (FIXED!)
- Pattern: `/(?:firm|startup|company|platform)\s+([A-Z][a-zA-Z0-9]+)/i`
- Example: "Fintech firm Marquis" → "Marquis" ✅ (not "Fintech")

### 5. "with CompanyName" (in funding context)
- Pattern: `/(?:with|from|by)\s+([A-Z][a-zA-Z0-9]+)(?:\s+(?:raises|secures|...))/i`
- Extracts company name when followed by funding verbs

## Garbage Filtering

Added to generic words list:
- "Much", "SLC", "Zork Golden", "Team Culture", "Investor Updates"
- "Launches", "European", "Software", "Tin Can"
- "Fintech", "Tech", "AI", "ML", "SaaS" (when standalone)

## Cleanup Steps

1. Remove possessive forms: "Nvidia's" → "Nvidia"
2. Remove leading verbs: "build Givefront" → "Givefront"
3. Remove trailing verbs: "Marquis alerts" → "Marquis"
4. Remove trailing punctuation
5. Reject generic words
6. Reject numbers: "100+" → rejected

## Expected Results

- Should extract: JOON, Mercor, Sandbar, Marquis, EvodiaBio, Blykalla
- Should reject: Much, SLC, Zork Golden, Team Culture, Investor Updates, Launches, European, Software, Tin Can

## Test

Run the orchestrator again - should see more real company names extracted!


