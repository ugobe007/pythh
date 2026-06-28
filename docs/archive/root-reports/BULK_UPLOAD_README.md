# Bulk Upload System - Hot Honey

## Overview
Upload multiple startups at once using CSV files. AI automatically fills in missing data to save time!

## How to Access
1. Sign up/login with admin credentials
2. Go to Dashboard
3. Click "📊 Bulk Upload" button (only visible to admins)

## Admin Account Setup
To become an admin, manually add to your user profile in localStorage:
```javascript
// In browser console:
let profile = JSON.parse(localStorage.getItem('userProfile'));
profile.isAdmin = true;
// OR use admin email:
profile.email = 'admin@hotmoneyhoney.com';
localStorage.setItem('userProfile', JSON.stringify(profile));
```

## CSV Template Format

### Required Columns:
- **Startup Name** - Company name
- **Industries** - Comma-separated (ai, fintech, saas, robotics, etc.)

### Optional Columns (AI will generate if missing):
- **Tagline** - Short tagline
- **Pitch** - One-sentence pitch
- **Problem** - Problem statement (5-point #1)
- **Solution** - Solution description (5-point #2)
- **Market Size** - Market opportunity (5-point #3)
- **Team Companies** - Previous companies (5-point #4)
- **Investment Amount** - Raising amount (5-point #5)

### Example CSV:
```csv
Startup Name,Tagline,Pitch,Problem,Solution,Market Size,Team Companies,Investment Amount,Industries
TechFlow AI,AI for Everyone,Making AI accessible,"SMBs can't afford AI","Affordable no-code AI platform","$50B AI SaaS","Google, Microsoft","$2M Seed","ai,saas"
FinanceHub,Modern Banking,Democratizing finance,"Banks are slow","Mobile-first banking","$100B fintech","Goldman Sachs","$5M Series A","fintech"
RoboChef,,Kitchen automation,"Cooking takes time","","$10B automation","","$1M Pre-seed","robotics,consumer"
```

## Features

### 1. Drag & Drop Upload
- Accepts `.csv` and `.xlsx` files
- Visual drag-and-drop zone
- Automatic parsing

### 2. AI Auto-Completion
- Detects missing fields
- Generates intelligent content based on:
  - Startup name
  - Industry tags
  - Existing data
- Marks AI-generated fields with 🤖 badge

### 3. Preview & Approval
- Review all parsed startups
- See which fields are AI-generated
- Approve individual startups or all at once
- Color-coded status:
  - ✅ Green = Approved
  - ⚪ Gray = Pending

### 4. Batch Save
- Saves approved startups to localStorage
- Generates unique IDs
- Sets initial votes to 0
- Assigns Stage 1
- Adds timestamp

## Usage Flow

1. **Download Template**
   - Click "📥 Download Template" to get CSV template
   - Has example rows and proper column headers

2. **Fill CSV**
   - Add startup data
   - Leave fields blank if you don't have the data
   - AI will fill in gaps automatically

3. **Upload File**
   - Drag & drop or click to browse
   - System parses and processes with AI

4. **Review**
   - Check all startups
   - See AI-generated fields (marked with 🤖)
   - Approve startups you want to add

5. **Save**
   - Click "💾 Save X Startups"
   - Data saved to database
   - Ready to view on voting page

## Storage

Startups are saved to: `localStorage.uploadedStartups`

Format:
```javascript
{
  id: 1234567890,
  name: "Startup Name",
  tagline: "Tagline",
  pitch: "Pitch",
  description: "Pitch",
  marketSize: "$50B",
  unique: "Solution",
  raise: "$2M Seed",
  stage: 1,
  yesVotes: 0,
  noVotes: 0,
  hotness: 0,
  answersCount: 0,
  industries: ["ai", "saas"],
  fivePoints: ["Problem", "Solution", "Market", "Team", "Investment"],
  aiGenerated: ["problem", "solution"],
  uploadedAt: "2024-01-15T10:30:00.000Z"
}
```

## Industry Tags

Valid industries (comma-separated in CSV):
- `ai` - Artificial Intelligence
- `fintech` - Financial Technology
- `saas` - Software as a Service
- `deeptech` - Deep Technology
- `robotics` - Robotics
- `healthtech` - Health Technology
- `edtech` - Education Technology
- `cleantech` - Clean Technology
- `ecommerce` - E-Commerce
- `crypto` - Cryptocurrency
- `consumer` - Consumer Products
- `enterprise` - Enterprise Software

## AI Generation Logic

When fields are missing, AI generates:

- **Problem**: "Addresses key challenges in {industry}"
- **Solution**: "Innovative {industry} solution for modern businesses"
- **Market Size**: "$1B+ market opportunity"
- **Tagline**: "Next-gen {industry} platform"
- **Pitch**: "{Name} is transforming the {industry}"

> Note: In production, this would use OpenAI API for more sophisticated generation

## Future Enhancements

- [ ] OpenAI API integration for real AI generation
- [ ] Support for .xlsx (Excel) files with XLSX library
- [ ] Inline editing in preview table
- [ ] Validation rules (required fields, format checks)
- [ ] Import from Google Sheets
- [ ] Duplicate detection
- [ ] Error logging
- [ ] Export approved startups as CSV
- [ ] Image upload for logos
- [ ] Batch edit capabilities

## Testing

Test with the included `sample-upload.csv` file:
```bash
# File location
/Users/robertchristopher/hot-money-honey/sample-upload.csv
```

Contains 5 sample startups with varying levels of completeness to test AI generation.

## Troubleshooting

**"Admin Access Required" message:**
- Make sure you're logged in
- Check admin status in localStorage
- Email must be `admin@hotmoneyhoney.com` OR `isAdmin: true`

**CSV not parsing:**
- Check column names match template
- Ensure no extra commas in text fields
- Use double quotes for fields with commas
- Verify file encoding is UTF-8

**AI generation not working:**
- Check browser console for errors
- Verify startup has at least name + industry
- Clear localStorage and try again

**Startups not showing on vote page:**
- Currently saves to separate storage
- Need to merge with main startupData
- Future: integrate with backend API
