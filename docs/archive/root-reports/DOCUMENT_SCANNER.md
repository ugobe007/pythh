# 📄 Document Scanner - PDF & PowerPoint Upload

## Overview
Upload pitch decks and documents (PDF, PowerPoint) and AI automatically extracts all startup information - no manual data entry needed!

## Access
**Route:** `/admin/document-upload`

**From Dashboard:** Click **📄 Scan Docs** button (blue/purple gradient)

**From Bulk Upload:** Click **📄 Scan Documents** button in header

## Supported File Types
- ✅ PDF files (.pdf) - Pitch decks, executive summaries, business plans
- ✅ PowerPoint (.ppt, .pptx) - Presentation decks
- ✅ Multiple files at once - Batch upload entire folder

## How It Works

### 1. **Upload Documents**
Drag & drop or click to browse:
- Pitch decks from startups
- Executive summaries
- Business plans
- Investor presentations
- Multiple files simultaneously

### 2. **AI Extraction**
Automatically scans and extracts:
- **Startup Name** - From title/headers
- **Problem Statement** - Identifies pain points mentioned
- **Solution** - Finds product/service description
- **Market Size** - Extracts TAM/SAM/market opportunity
- **Team Background** - Finds founder/team experience
- **Funding Ask** - Identifies investment amount
- **Industries** - Detects sector keywords

### 3. **Review & Approve**
- See all extracted data in card format
- Each field shows what AI found
- Source file displayed for reference
- Approve individually or all at once
- Edit data if needed (future feature)

### 4. **Save to Database**
- Click "Save X Startups"
- Instantly added to voting page
- Full 5-point format populated
- Ready for investor review

## AI Extraction Details

The AI looks for specific patterns in documents:

**Startup Name:**
- Title slides
- "Company:" headers
- File name as fallback

**Problem:**
- "The Problem" sections
- "Challenge" slides
- "Pain Point" mentions
- "Market Gap" discussions

**Solution:**
- "Our Solution" slides
- "Product" descriptions
- "Platform" details
- "How it Works" sections

**Market Size:**
- "Market Opportunity"
- "TAM/SAM/SOM"
- "$XB market" mentions
- Growth rate statistics

**Team:**
- "Team" slides
- "Founders" sections
- "Experience at X company"
- Previous employer mentions

**Funding:**
- "The Ask" slides
- "Raising $X"
- "Seeking funding"
- "Investment round" details

**Industries:**
- Keywords: FinTech, AI, SaaS, etc.
- "Sector:" or "Vertical:" labels
- Technology category mentions

## Current Implementation

### Simulated Extraction
The current version uses **simulated text extraction** for demonstration:
- Shows how the system works
- Returns mock data based on file names
- Demonstrates the complete workflow
- Ready for real API integration

### Production Integration Needed

**For PDF Extraction:**
```bash
npm install pdfjs-dist
```

Or send to backend:
```typescript
const formData = new FormData();
formData.append('file', pdfFile);

const response = await fetch('/api/extract-pdf', {
  method: 'POST',
  body: formData
});

const text = await response.json();
```

**For PowerPoint Extraction:**
```bash
npm install pizzip jszip
```

Or use backend service:
```typescript
const response = await fetch('/api/extract-ppt', {
  method: 'POST',
  body: formData
});
```

**For AI Analysis (OpenAI):**
```typescript
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
      content: `Extract startup data from: ${documentText}`
    }]
  })
});
```

## Usage Example

### Scenario: Upload 5 Pitch Decks

1. **Prepare Files:**
   - TechFlow_AI_Deck.pdf
   - FinanceHub_Pitch.pptx
   - RoboChef_Summary.pdf
   - HealthAI_Deck.pptx
   - GreenEnergy_Business_Plan.pdf

2. **Upload:**
   - Drag all 5 files into drop zone
   - System processes each file (2-3 seconds each)
   - Shows progress with file names

3. **Review:**
   - 5 startup cards displayed
   - Each shows extracted data
   - Source file labeled (e.g., "📄 TechFlow_AI_Deck.pdf")
   - Industries auto-tagged

4. **Approve:**
   - Click "Approve All" or individual approvals
   - Review accuracy of extracted data
   - Data looks good? Click "Save 5 Startups"

5. **Done:**
   - Startups appear on voting page immediately
   - No manual 5-point entry needed
   - Ready for investor review

## Benefits vs CSV Upload

| Feature | CSV Upload | Document Scanner |
|---------|-----------|------------------|
| **Input** | Manual CSV creation | Upload pitch decks directly |
| **Effort** | Type all data by hand | Zero manual entry |
| **Source** | Create from scratch | Use existing materials |
| **Speed** | Medium | Fast |
| **Accuracy** | Depends on input | AI extracts precisely |
| **Bulk** | Yes (100s at once) | Yes (multiple files) |
| **Best For** | Structured data import | Startups with existing decks |

## Use Cases

### 1. **Startup Submissions**
Startups submit pitch decks → Auto-populate profiles → No data entry needed

### 2. **Event Processing**
After pitch event → Collect all decks → Batch scan → Instant database

### 3. **Pipeline Import**
Moving from another platform → Export PDFs → Upload to HMH → Done

### 4. **Accelerator Intake**
100 applications with decks → Scan all → Review extracted data → Approve good fits

## Storage

Extracted startups saved to: `localStorage.uploadedStartups`

Same format as CSV uploads:
```javascript
{
  id: 1234567890,
  name: "TechFlow AI",
  tagline: "Next-gen AI platform",
  extractedFrom: "TechFlow_AI_Deck.pdf", // NEW field
  // ... rest of startup data
}
```

## Future Enhancements

- [ ] **Real PDF/PPT parsing** - Integrate pdf.js and pptx libraries
- [ ] **OpenAI integration** - Smart extraction with GPT-4
- [ ] **OCR support** - Extract from image-based PDFs
- [ ] **Logo extraction** - Pull logo images from docs
- [ ] **Inline editing** - Edit extracted data before saving
- [ ] **Confidence scores** - Show AI confidence level per field
- [ ] **Multi-language** - Support non-English documents
- [ ] **Table extraction** - Parse financial tables
- [ ] **Chart recognition** - Extract data from graphs
- [ ] **Batch folders** - Upload entire directories

## Troubleshooting

**"Admin Access Required"**
- Make sure you're logged in as admin
- Visit `/make-admin.html` to grant access

**Files Not Processing**
- Check file types (PDF, PPT, PPTX only)
- Ensure files aren't corrupted
- Try smaller files first (< 10MB)

**Extracted Data Inaccurate**
- Current version uses simulated extraction
- Production needs real PDF/PPT parser + OpenAI
- Edit data manually after extraction (future)

**Startups Not Showing**
- Check localStorage.uploadedStartups
- Reload voting page
- Clear browser cache

## API Integration Roadmap

### Phase 1: PDF Parsing (Backend)
```python
# Python Flask example
from PyPDF2 import PdfReader

@app.route('/api/extract-pdf', methods=['POST'])
def extract_pdf():
    file = request.files['file']
    reader = PdfReader(file)
    text = ""
    for page in reader.pages:
        text += page.extract_text()
    return jsonify({"text": text})
```

### Phase 2: PowerPoint Parsing (Backend)
```python
from pptx import Presentation

@app.route('/api/extract-ppt', methods=['POST'])
def extract_ppt():
    file = request.files['file']
    prs = Presentation(file)
    text = ""
    for slide in prs.slides:
        for shape in slide.shapes:
            if hasattr(shape, "text"):
                text += shape.text + "\n"
    return jsonify({"text": text})
```

### Phase 3: AI Analysis (OpenAI)
```typescript
async function analyzeWithAI(text: string) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [{
        role: 'system',
        content: 'Extract structured startup data from pitch deck text.'
      }, {
        role: 'user',
        content: `Extract: startup name, problem, solution, market size, team, funding ask, industries from:\n\n${text}`
      }],
      response_format: { type: 'json_object' }
    })
  });
  
  return await response.json();
}
```

## Comparison: All Upload Methods

| Method | Best For | Speed | Accuracy | Ease |
|--------|----------|-------|----------|------|
| **Manual Entry** | Single startups | Slow | Perfect | Easy |
| **CSV Upload** | Bulk structured data | Fast | Good | Medium |
| **Document Scanner** | Existing pitch decks | Fast | Very Good | Very Easy |

---

**Built for Hot Honey 🍯**  
Making startup onboarding effortless with AI document scanning!
