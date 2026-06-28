# startup_uploads Table Schema

Based on `supabase/migrations/create_investors_and_uploads.sql`:

## Current Columns

### Basic Info
- `name` (TEXT NOT NULL)
- `pitch` (TEXT)
- `description` (TEXT)
- `tagline` (TEXT)
- `website` (TEXT) ⚠️ **Currently used as general "link" field (can contain article URLs)**
- `linkedin` (TEXT)

### Upload Source
- `source_type` (TEXT NOT NULL) - 'url', 'deck', 'manual'
- `source_url` (TEXT) - "Website URL if extracted from URL" ⚠️ **Comment says "Website URL" but may contain article URLs**
- `deck_filename` (TEXT)

### Issue Identified

**Problem**: `website` field is being used as a general "link" field and can contain:
- Article URLs (pulse2.com/articles/..., tech.eu/...)
- Publisher URLs (techcrunch.com/...)
- Actual company domains (example.com)

**Impact**: 
- RSS feed discovery tries to discover feeds on publisher domains
- HN domain-first search queries publisher domains
- Domain validation logic fails

**Long-term Fix Needed**:
- `source_url` - where the startup was found (article URL, etc.)
- `company_domain` - canonical company domain (normalized, validated)
- Keep `website` for backward compatibility, but extract/normalize to `company_domain`

**Current Schema**:
```sql
website TEXT,  -- ⚠️ Mixed usage: can be article URL or company domain
source_url TEXT,  -- "Website URL if extracted from URL"
```

**Recommended Schema**:
```sql
website TEXT,  -- Backward compatibility (keep existing)
source_url TEXT,  -- Where startup was found (article URL, etc.)
company_domain TEXT,  -- NEW: Canonical, normalized company domain
```
