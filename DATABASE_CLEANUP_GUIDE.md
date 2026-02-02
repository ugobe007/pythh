# Database Cleanup Guide

## Problem

The `startup_uploads` and `investors` tables contain **junk data** from RSS scraping:
- News article headlines (e.g., "Company Announces $50M Round")  
- Sentence fragments (e.g., "I've", "Over the last", "by X")
- Financial notation in names (e.g., "Startup $42M")
- Tech giant names out of context (e.g., "Nvidia", "Google")

This pollutes the **LiveMatchingStrip** component and match generation.

## Solution

The `scripts/cleanup-database.js` script identifies and removes junk entries.

### Detection Patterns

1. **Possessives/Contractions**: `I've`, `he's`, `it's`, `they're`
2. **News Patterns**: `by X`, `CEO`, `founder of`  
3. **Sentence Fragments**: `Over the last`, `According to`
4. **Tech Giants (exact)**: `Nvidia`, `Google`, `Amazon`
5. **Financial Notation**: `$42`, `€25M`, `£100M`
6. **Action Verb Suffixes**: `Company Announces`, `Startup Raises`
7. **Article Prefixes**: `a sta# Database Cleanup Guide

## Problem

The `startup_uploads` and `investors` table# 
## Problem

The `start`ba
The `stacri- News article headlines (e.g., "Company Announces $50M Round")  
- Sentence fragmenju- Sentence fragments (e.g., "I've", "Over the last", "by X")
- Fin- Financial notation in names (e.g., "Startup $42M")
- Techut- Tech giant names out of context (e.g., "Nvidia", --
This pollutes the **LiveMatchingStrip** component and matceco
## Solution

The `scripts/cleanup-database.js` script identifies and 
##
The `scriFro
### Detection Patterns

1. **Possessives/Contractions**: `I've`, `he's`, `i (0
1. **Possessives/Con`"C2. **News Patterns**: `by X`, `CEO`, `founder of`  
3. **Sentenceon3. **Sentence Fragments**: `Over the last`, `Accor` 4. **Tech Giants (exact)**: `Nvidia`, `Google 28, 2026
