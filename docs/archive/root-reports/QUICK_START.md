# 🚀 Bulk Upload System - Quick Start Guide

## What Was Built

A complete bulk upload system that allows admins to upload multiple startups at once using CSV files, with AI automatically filling in missing data.

## Key Features

✅ **Drag & Drop Upload** - Easy file upload interface  
✅ **CSV Parsing** - Automatic extraction of startup data  
✅ **AI Auto-Completion** - Fills in missing 5-point data  
✅ **Preview & Approval** - Review before saving  
✅ **Batch Save** - Add multiple startups at once  
✅ **Admin Protection** - Only admins can access  
✅ **Template Download** - CSV template with examples  

## How to Use

### Step 1: Set Up Admin Access

In browser console (F12):
```javascript
// Method 1: Use admin email
let profile = JSON.parse(localStorage.getItem('userProfile'));
profile.email = 'admin@hotmoneyhoney.com';
localStorage.setItem('userProfile', JSON.stringify(profile));

// Method 2: Set admin flag
let profile = JSON.parse(localStorage.getItem('userProfile'));
profile.isAdmin = true;
localStorage.setItem('userProfile', JSON.stringify(profile));

// Reload page
location.reload();
```

### Step 2: Access Bulk Upload

1. Go to Dashboard (`/dashboard`)
2. Look for **📊 Bulk Upload** button (pink/red gradient)
3. Click to open bulk upload page

### Step 3: Download Template

- Click **📥 Download Template** button
- Opens CSV with proper columns and examples
- Or use the included `sample-upload.csv` file

### Step 4: Fill Your CSV

**Required columns:**
- Startup Name
- Industries (comma-separated: ai, fintech, saas, etc.)

**Optional columns** (AI fills if missing):
- Tagline
- Pitch
- Problem
- Solution
- Market Size
- Team Companies
- Investment Amount

**Example:**
```csv
Startup Name,Tagline,Pitch,Problem,Solution,Market Size,Team Companies,Investment Amount,Industries
TechFlow AI,AI for Everyone,Making AI accessible,"SMBs can't afford AI","No-code AI platform","$50B","Google","$2M Seed","ai,saas"
```

### Step 5: Upload & Process

1. **Drag & drop** CSV file or click to browse
2. System automatically:
   - Parses all rows
   - Detects missing fields
   - Generates AI content for gaps
   - Shows progress count

### Step 6: Review

- See all parsed startups in preview
- **🤖 AI badges** show which fields were auto-generated
- Green = Approved, Gray = Pending
- Click **✓ Approved** to toggle individual startups
- Or click **✅ Approve All** to approve everything

### Step 7: Save

- Click **💾 Save X Startups** button
- Only approved startups are saved
- Success message shows count
- Startups now appear on voting page!

## Test It Out

Use the included test file: `sample-upload.csv`

Contains 5 startups with varying completeness:
1. **TechFlow AI** - Complete data
2. **FinanceHub** - Complete data
3. **RoboChef** - Missing tagline, solution, team, investment (AI fills)
4. **HealthAI** - Missing problem (AI fills)
5. **GreenEnergy Solutions** - Complete data

## What Happens to Uploaded Startups?

They are:
- ✅ Saved to `localStorage.uploadedStartups`
- ✅ Merged with voting page startups
- ✅ Visible on `/vote` page immediately
- ✅ Filterable by industry preferences
- ✅ Votable like any other startup

## File Structure

```
src/
  pages/
    BulkUpload.tsx         # Main bulk upload page (NEW)
  components/
    VotePage.tsx           # Updated to show uploaded startups
    Dashboard.tsx          # Added admin bulk upload button
  App.tsx                  # Added /admin/bulk-upload route

sample-upload.csv          # Test file with 5 startups (NEW)
BULK_UPLOAD_README.md      # Detailed documentation (NEW)
QUICK_START.md            # This file (NEW)
```

## Page Routes

- `/admin/bulk-upload` - Bulk upload interface (admin only)
- `/dashboard` - Dashboard with bulk upload button
- `/vote` - Voting page (shows uploaded startups)

## Features in Detail

### 1. Admin Protection
- Checks `userProfile.email === 'admin@hotmoneyhoney.com'` OR `userProfile.isAdmin === true`
- Shows lock screen if not admin
- "Go Home" button for non-admins

### 2. File Upload
- Accepts `.csv` and `.xlsx` files
- Drag & drop zone with visual feedback
- File input fallback (click to browse)
- Shows processing progress

### 3. CSV Parsing
- Splits CSV into rows and columns
- Maps column headers to startup fields
- Handles quoted strings and commas
- Robust error handling

### 4. AI Generation (Simulated)
- Detects empty fields
- Generates based on name + industry
- Creates contextual placeholder text
- Marks generated fields for transparency
- **Note:** Uses simulated AI (ready for OpenAI API integration)

### 5. Preview Interface
- Card-based layout for each startup
- Shows all key fields
- Visual badges for AI-generated content
- Approve/Reject per startup
- Shows industry tags
- Approval count in save button

### 6. Batch Save
- Filters to only approved startups
- Generates unique IDs (timestamp-based)
- Sets proper defaults:
  - yesVotes: 0, noVotes: 0
  - stage: 1, hotness: 0
  - answersCount: 0
- Adds uploadedAt timestamp
- Saves to localStorage
- Success confirmation

## Future Integration Points

### OpenAI API Integration
Replace the `generateMissingData` function in `BulkUpload.tsx`:

```typescript
const generateMissingData = async (startup: any): Promise<ParsedStartup> => {
  // Call OpenAI API
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [{
        role: 'user',
        content: `Generate missing startup data for: ${startup.name} in ${startup.industries}`
      }]
    })
  });
  
  // Parse and return
};
```

### Backend API Integration
Replace localStorage with API calls:

```typescript
const saveAllApproved = async () => {
  const approved = parsedStartups.filter(s => s.status === 'approved');
  
  // POST to backend
  await fetch('/api/startups/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(approved)
  });
};
```

### Excel (.xlsx) Support
Add XLSX library:

```bash
npm install xlsx
```

Update file handler:
```typescript
import * as XLSX from 'xlsx';

const handleFile = async (file: File) => {
  if (fileName.endsWith('.xlsx')) {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet);
    // Process data...
  }
};
```

## Troubleshooting

**Can't see Bulk Upload button?**
- Make sure you're on `/dashboard`
- Verify admin status in localStorage
- Check browser console for errors

**Upload not working?**
- Check CSV format matches template
- Ensure UTF-8 encoding
- Look for extra commas or quotes
- Try the `sample-upload.csv` test file

**Startups not showing on vote page?**
- Clear browser cache
- Check localStorage.uploadedStartups
- Reload the vote page
- Look for console errors

**AI generation seems random?**
- Currently uses simulated placeholders
- Real OpenAI integration needed for smart generation
- Generated text is contextual to industry

## Next Steps

1. **Test with sample file** - Use `sample-upload.csv`
2. **Create your own CSV** - Download template, fill with real data
3. **Upload & review** - See AI generation in action
4. **Approve & save** - Add startups to database
5. **Vote on them** - Go to `/vote` and see your uploads!

## Support

Questions? Check:
- `BULK_UPLOAD_README.md` - Detailed docs
- Browser console - Error messages
- localStorage inspector - Data verification

---

**Built for Hot Honey 🍯**  
Making startup data entry fast and easy with AI assistance!
