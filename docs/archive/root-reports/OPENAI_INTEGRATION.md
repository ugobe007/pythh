# OpenAI → Supabase Integration Guide

## Overview
This system allows OpenAI to scrape startup data from URLs and 3rd-party sources, upload to Supabase for admin review, and publish to the Hot Money Honey site.

## 5-Point Data Format

OpenAI is trained to extract these 5 key data points:

1. **Value Proposition** - What value does this startup provide?
2. **Problem** - What problem are they solving?
3. **Solution** - How do they solve it?
4. **Team** - Team background and former employers
5. **Investment** - Funding raised or needed

## Workflow

```
OpenAI Scrapes URL
      ↓
Upload to Supabase (status: pending)
      ↓
Admin Reviews Data
      ↓
Approve/Edit/Reject
      ↓
Publish to Site (status: published)
      ↓
Users Vote on Startups
```

## Setup

### 1. Run Database Schema

In Supabase SQL Editor, run:
```bash
/supabase-openai-schema.sql
```

This adds:
- 5 data columns (value_proposition, problem, solution, team, investment)
- Status workflow (pending → approved → published)
- Review metadata (reviewed_by, reviewed_at)
- Admin views (pending_startups, published_startups)

### 2. Use OpenAI Data Service

```typescript
import { OpenAIDataService } from './lib/openaiDataService';

// After OpenAI scrapes a website
const scrapedData = {
  name: "TechStartup Inc",
  website: "https://techstartup.com",
  value_proposition: "We make enterprise software simple",
  problem: "Enterprise tools are too complex",
  solution: "AI-powered interface that simplifies workflows",
  team: "Former employees of Google, Microsoft, and Meta",
  investment: "Raised $5M Series A from Sequoia Capital",
  scraped_by: "https://techcrunch.com/techstartup-funding",
};

// Upload to Supabase
await OpenAIDataService.uploadScrapedStartup(scrapedData);
```

## API Methods

### Upload Data
```typescript
// Single startup
await OpenAIDataService.uploadScrapedStartup(data);

// Bulk upload
await OpenAIDataService.uploadBulkStartups([data1, data2, data3]);
```

### Admin Review
```typescript
// Get pending startups
const { startups } = await OpenAIDataService.getPendingStartups();

// Approve startup
await OpenAIDataService.approveStartup(startupId, 'admin@example.com');

// Edit startup data
await OpenAIDataService.updateStartup(startupId, {
  value_proposition: "Updated value prop",
  team: "Added more team info"
});

// Reject startup
await OpenAIDataService.rejectStartup(startupId, 'admin@example.com');
```

### Publish
```typescript
// Publish to live site
await OpenAIDataService.publishStartup(startupId);

// Get all published startups
const { startups } = await OpenAIDataService.getPublishedStartups();
```

## Database Tables

### startups
Main table with all startup data
- **status**: `pending` | `approved` | `rejected` | `published`
- **validated**: boolean (ready for site)

### pending_startups (view)
Admin queue showing startups awaiting review

### published_startups (view)
Public view of approved startups visible on site

### votes
User votes on published startups

### vote_counts (view)
Aggregated vote counts per startup

## Integration with OpenAI

### Example: Scraping TechCrunch

```typescript
import OpenAI from 'openai';
import { OpenAIDataService } from './lib/openaiDataService';

const openai = new OpenAI({
  apiKey: process.env.VITE_OPENAI_API_KEY,
});

async function scrapeAndUpload(url: string) {
  // 1. Use OpenAI to extract data
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{
      role: "system",
      content: `Extract startup data in this format:
      1. Value Proposition: What value does this provide?
      2. Problem: What problem are they solving?
      3. Solution: How do they solve it?
      4. Team: Team background and former employers
      5. Investment: Funding raised or needed
      
      Return as JSON with keys: name, website, value_proposition, problem, solution, team, investment`
    }, {
      role: "user",
      content: `Extract data from: ${url}`
    }],
  });

  const data = JSON.parse(response.choices[0].message.content);
  
  // 2. Upload to Supabase
  const result = await OpenAIDataService.uploadScrapedStartup({
    ...data,
    scraped_by: url,
  });
  
  console.log('Uploaded:', result);
}

// Scrape multiple sources
await scrapeAndUpload('https://techcrunch.com/article1');
await scrapeAndUpload('https://venturebeat.com/article2');
```

## Admin Review UI (TODO)

Create an admin page at `/admin` to:
- View pending startups
- Edit data fields
- Approve/reject submissions
- Publish to site

Example component structure:
```typescript
function AdminReviewQueue() {
  const [pending, setPending] = useState([]);
  
  useEffect(() => {
    OpenAIDataService.getPendingStartups()
      .then(result => setPending(result.startups));
  }, []);
  
  const handleApprove = async (id) => {
    await OpenAIDataService.approveStartup(id, 'admin@hotmoney.com');
    await OpenAIDataService.publishStartup(id);
    // Refresh list
  };
  
  return (
    <div>
      {pending.map(startup => (
        <StartupReviewCard 
          startup={startup}
          onApprove={() => handleApprove(startup.id)}
          onEdit={(updates) => OpenAIDataService.updateStartup(startup.id, updates)}
          onReject={() => OpenAIDataService.rejectStartup(startup.id, 'admin')}
        />
      ))}
    </div>
  );
}
```

## Next Steps

1. ✅ Database schema updated
2. ✅ TypeScript types defined
3. ✅ OpenAI data service created
4. ⏳ Integrate with your existing OpenAI scraping code
5. ⏳ Build admin review UI
6. ⏳ Connect published startups to voting pages

## Files Created

- `supabase-openai-schema.sql` - Database schema update
- `src/lib/openaiDataService.ts` - Upload and review API
- `src/lib/supabase.ts` - Updated TypeScript types
- `OPENAI_INTEGRATION.md` - This guide
