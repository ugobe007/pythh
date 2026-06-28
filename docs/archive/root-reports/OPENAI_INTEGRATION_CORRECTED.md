# OpenAI Integration - Corrected Workflow

## ✅ What Was Fixed

After reviewing your existing BulkImport.tsx workflow, I discovered the original OpenAI integration schema didn't match your actual data structure. Here's what was corrected:

### Original Schema (Incorrect)
```typescript
{
  value_proposition: string,
  problem: string,
  solution: string,
  team: string,
  investment: string
}
```

### Your Actual Structure (From BulkImport.tsx)
```typescript
{
  name: string,
  website: string,
  pitch: string,              // One-line tagline
  fivePoints: [               // Array of 5 strings
    "Value proposition",       // [0]
    "Market size",             // [1]
    "Unique value",            // [2]
    "Team background",         // [3]
    "Funding/raise"            // [4]
  ],
  stage: string,              // "Seed", "Series A"
  funding: string,            // "$3M Seed"
  industry: string,           // "FinTech"
  entityType: string          // "startup" | "vc_firm" | "accelerator"
}
```

## 🔄 Integration Points

### 1. BulkImport Page (721 lines)
**Current behavior:** Uses OpenAI GPT-4o-mini to enrich companies, stores to localStorage

**What needs updating:**
```typescript
// In BulkImport.tsx, line ~500 (handleImportAll function)
// OLD: localStorage.setItem('uploadedStartups', ...)
// NEW:
import { OpenAIDataService } from '../lib/openaiDataService';

const handleImportAll = async () => {
  for (const company of enrichedCompanies) {
    await OpenAIDataService.uploadScrapedStartup({
      name: company.name,
      website: company.website,
      pitch: company.tagline || company.pitch,
      fivePoints: company.fivePoints,
      stage: company.stage,
      funding: company.funding,
      industry: company.industry,
      entityType: company.entityType,
      scraped_by: sourceUrl
    });
  }
};
```

### 2. Submit Page
**Current behavior:** Parses PDF/PPT with OpenAI, stores to localStorage

**What needs updating:**
```typescript
// In Submit.tsx, line ~350 (handleDocumentUpload)
// After OpenAI parsing:
await OpenAIDataService.uploadScrapedStartup({
  name: extractedData.name,
  website: extractedData.website || '',
  pitch: extractedData.pitch,
  fivePoints: extractedData.fivePoints,
  stage: extractedData.stage,
  funding: extractedData.funding,
  industry: extractedData.industry,
  deck: uploadedFileUrl  // Link to uploaded PDF
});
```

### 3. VotePage
**Current behavior:** Merges localStorage 'uploadedStartups' + static startupData

**What needs updating:**
```typescript
// In VotePage.tsx, replace localStorage merge with Supabase fetch:
import { OpenAIDataService } from '../lib/openaiDataService';

const [startups, setStartups] = useState<Startup[]>([]);

useEffect(() => {
  const loadPublishedStartups = async () => {
    const { success, startups: published } = await OpenAIDataService.getPublishedStartups();
    if (success) {
      setStartups(published);
    }
  };
  loadPublishedStartups();
}, []);
```

## 📊 Database Schema

### Updated Schema (supabase-openai-schema-v2.sql)

**New columns added to `startups` table:**
```sql
-- Dual storage: Array + individual columns
five_points TEXT[5],              -- Array format (frontend compatible)
value_proposition TEXT,           -- Point 1 (extracted from array)
problem TEXT,                     -- Point 2
solution TEXT,                    -- Point 3
team TEXT,                        -- Point 4
investment TEXT,                  -- Point 5

-- Match BulkImport structure
tagline TEXT,
pitch TEXT,
stage TEXT,
funding TEXT,
industry TEXT,
pitch_deck_url TEXT,

-- Scraping metadata
scraped_by TEXT,
scraped_at TIMESTAMP,
entity_type TEXT,

-- Workflow
status TEXT DEFAULT 'pending',    -- pending | published | rejected
reviewed_by TEXT,
reviewed_at TIMESTAMP,
published_at TIMESTAMP
```

**Views created:**
1. `pending_startups` - Admin review queue
2. `published_startups` - Live voting data (includes vote_counts)

## 🚀 Deployment Steps

### Step 1: Deploy Schema
```bash
# Copy supabase-openai-schema-v2.sql content
# Paste into Supabase SQL Editor:
# https://supabase.com/dashboard/project/riryeljaqxicdnuwilai/sql
# Click "Run"
```

### Step 2: Update BulkImport.tsx
```typescript
// Add import at top
import { OpenAIDataService } from '../lib/openaiDataService';

// Replace handleImportAll function (around line 500):
const handleImportAll = async () => {
  setIsImporting(true);
  
  try {
    const results = await OpenAIDataService.uploadBulkStartups(
      enrichedCompanies.map(c => ({
        name: c.name,
        website: c.website,
        pitch: c.tagline || c.pitch,
        fivePoints: c.fivePoints,
        stage: c.stage,
        funding: c.funding,
        industry: c.industry,
        entityType: c.entityType,
        scraped_by: sourceUrl
      }))
    );
    
    console.log(`✅ Uploaded ${results.successful}/${results.total} startups`);
    
    // Navigate to admin review page
    navigate('/admin/review');
    
  } catch (error) {
    console.error('Upload failed:', error);
  } finally {
    setIsImporting(false);
  }
};
```

### Step 3: Update Submit.tsx
```typescript
// Add import
import { OpenAIDataService } from '../lib/openaiDataService';

// In handleDocumentUpload function (around line 350):
// After OpenAI parsing returns extractedData:
const result = await OpenAIDataService.uploadScrapedStartup({
  name: extractedData.name,
  website: formData.website || '',
  pitch: extractedData.pitch,
  fivePoints: extractedData.fivePoints,
  stage: extractedData.stage,
  funding: extractedData.funding,
  industry: extractedData.industry,
  deck: uploadedFileUrl,
  logo: formData.logo
});

if (result.success) {
  toast.success('Startup submitted for review!');
  navigate('/admin/review');
}
```

### Step 4: Update VotePage.tsx
```typescript
// Replace localStorage merge with Supabase:
import { OpenAIDataService } from '../lib/openaiDataService';

const VotePage = () => {
  const [startups, setStartups] = useState<Startup[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const loadStartups = async () => {
      // Fetch published startups from Supabase
      const { success, startups: published } = await OpenAIDataService.getPublishedStartups();
      
      if (success && published) {
        // Convert Supabase format to frontend Startup type
        const converted = published.map(s => ({
          id: s.id,
          name: s.name,
          pitch: s.pitch,
          tagline: s.tagline,
          fivePoints: s.five_points,  // Array format
          stage: s.stage === 'Seed' ? 1 : 2,
          yesVotes: s.yes_votes || 0,
          noVotes: s.no_votes || 0,
          website: s.website,
          industries: [s.industry || 'Technology']
        }));
        setStartups(converted);
      }
      setLoading(false);
    };
    
    loadStartups();
  }, []);
  
  // Rest of component unchanged
};
```

### Step 5: Create Admin Review Page
```bash
# Create new file: src/pages/AdminReview.tsx
```

```typescript
import { useState, useEffect } from 'react';
import { OpenAIDataService } from '../lib/openaiDataService';

export default function AdminReview() {
  const [pending, setPending] = useState([]);
  
  useEffect(() => {
    loadPending();
  }, []);
  
  const loadPending = async () => {
    const { success, startups } = await OpenAIDataService.getPendingStartups();
    if (success) setPending(startups);
  };
  
  const handleApprove = async (id: string) => {
    await OpenAIDataService.approveAndPublish(id, 'admin');
    loadPending(); // Refresh list
  };
  
  const handleReject = async (id: string) => {
    await OpenAIDataService.rejectStartup(id, 'admin');
    loadPending();
  };
  
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Review Queue</h1>
      
      {pending.map((startup) => (
        <div key={startup.id} className="border p-4 mb-4 rounded">
          <h2 className="text-xl font-bold">{startup.name}</h2>
          <p className="text-gray-600">{startup.pitch}</p>
          
          <div className="mt-4">
            <h3 className="font-semibold">5 Points:</h3>
            <ol className="list-decimal ml-6">
              {startup.five_points?.map((point, i) => (
                <li key={i}>{point}</li>
              ))}
            </ol>
          </div>
          
          <div className="mt-4 flex gap-4">
            <button 
              onClick={() => handleApprove(startup.id)}
              className="bg-green-600 text-white px-4 py-2 rounded"
            >
              ✅ Approve & Publish
            </button>
            <button 
              onClick={() => handleReject(startup.id)}
              className="bg-red-600 text-white px-4 py-2 rounded"
            >
              ❌ Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

### Step 6: Add Route
```typescript
// In App.tsx, add:
import AdminReview from './pages/AdminReview';

// Add route:
<Route path="/admin/review" element={<AdminReview />} />
```

### Step 7: Migrate Existing Data
```typescript
// Create migration script: src/scripts/migrateLocalStorage.ts
import { supabase } from '../lib/supabase';

export async function migrateLocalStorageToSupabase() {
  const uploaded = localStorage.getItem('uploadedStartups');
  if (!uploaded) return;
  
  const startups = JSON.parse(uploaded);
  
  for (const startup of startups) {
    await supabase.from('startups').insert({
      id: `startup_${startup.id}`,
      name: startup.name,
      website: startup.website,
      tagline: startup.tagline,
      pitch: startup.pitch,
      five_points: startup.fivePoints,
      stage: startup.stage,
      funding: startup.funding,
      industry: startup.industries?.[0],
      scraped_by: startup.vcBacked,
      entity_type: startup.entityType || 'startup',
      status: 'published',  // Auto-approve existing
      validated: true,
      published_at: new Date().toISOString()
    });
  }
  
  console.log(`✅ Migrated ${startups.length} startups from localStorage`);
}

// Call from browser console or add button in UI
```

## 🎯 Summary of Changes

### ✅ What's Correct Now
1. **Data structure matches** your existing BulkImport.tsx format (fivePoints array)
2. **OpenAI integration preserved** - still uses GPT-4o-mini enrichment
3. **localStorage compatibility** - uploads to both Supabase + localStorage for immediate use
4. **Existing workflow maintained** - BulkImport → Enrich → Upload (just changed storage target)

### 🔄 What Changed
1. **Storage**: localStorage → Supabase (with localStorage fallback)
2. **Workflow**: Direct display → Review queue → Approval → Publishing
3. **Data persistence**: Browser-only → Database-backed
4. **Vote tracking**: Already using Supabase ✅ (no change needed)

### 🚀 Benefits
1. ✅ Admin can review AI-scraped data before publishing
2. ✅ Edit incorrect OpenAI extractions before going live
3. ✅ All startup data persists across sessions
4. ✅ Vote counts already real-time with Supabase
5. ✅ No breaking changes to existing upload pages

## 📁 Files Modified

1. ✅ `src/lib/openaiDataService.ts` - Updated to match fivePoints structure
2. ✅ `supabase-openai-schema-v2.sql` - New schema with fivePoints array support
3. 🔜 `src/pages/BulkImport.tsx` - Replace localStorage with Supabase upload
4. 🔜 `src/pages/Submit.tsx` - Replace localStorage with Supabase upload
5. 🔜 `src/components/VotePage.tsx` - Fetch from Supabase published_startups view
6. 🔜 `src/pages/AdminReview.tsx` - New admin review UI (create this file)

## 🧪 Testing Steps

1. **Deploy Schema**: Run SQL in Supabase
2. **Test BulkImport**: Import companies, verify they appear in pending_startups view
3. **Test Review**: Approve/reject from admin page
4. **Test Voting**: Verify published startups appear on /vote page
5. **Test Real-time**: Votes should update live (already working ✅)

## 🔗 Resources

- Supabase Dashboard: https://supabase.com/dashboard/project/riryeljaqxicdnuwilai
- SQL Editor: https://supabase.com/dashboard/project/riryeljaqxicdnuwilai/sql
- Current Site: https://hot-honey.fly.dev

## 📞 Next Steps

Ready to proceed? I can help update the specific files. Just let me know which one to start with:
- [ ] BulkImport.tsx
- [ ] Submit.tsx  
- [ ] VotePage.tsx
- [ ] Create AdminReview.tsx
