# 🤖 AI Document Scanner Setup

## Overview

Hot Honey now uses **real AI-powered document scanning** to extract startup information from pitch decks!

## Features

✅ **Real PDF Parsing** - Uses PDF.js to extract actual text from PDFs  
✅ **OpenAI GPT-4 Analysis** - AI creates clever, punchy 1-liners (max 300 chars)  
✅ **Smart Fallback** - Keyword detection if API key not configured  
✅ **Auto-fills Form** - Extracts: name, problem, solution, team, funding, industry, stage  

## Setup Instructions

### 1. Get OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign up or log in
3. Navigate to **API Keys** section
4. Click **Create new secret key**
5. Copy your API key (starts with `sk-`)

### 2. Add API Key to Environment

Edit `.env` file in the project root:

```bash
VITE_OPENAI_API_KEY=sk-your-actual-api-key-here
```

⚠️ **Important**: 
- Replace `your-openai-api-key-here` with your actual API key
- Never commit your `.env` file to Git (already in `.gitignore`)
- This exposes the API key in browser - for MVP/demo only

### 3. Restart Development Server

```bash
npm run dev
```

## How It Works

### With OpenAI API Key ✨

1. **Upload PDF** → PDF.js extracts all text from document
2. **AI Analysis** → GPT-4 reads content and creates compelling 1-liners
3. **Form Auto-fill** → Extracted data populates empty form fields
4. **Review & Edit** → User can modify AI-generated content

**Example for "DogBox" dog hydration startup:**
- AI reads actual presentation content
- Understands it's about dog hydration
- Creates relevant problem/solution statements
- Detects it's Pet Tech industry

### Without API Key (Fallback) 🔍

1. **Upload PDF** → PDF.js extracts text
2. **Keyword Detection** → Scans for industry keywords (dog, health, finance, etc.)
3. **Template Content** → Uses predefined templates per industry
4. **Form Auto-fill** → Generic but relevant content

## Supported File Types

| Format | Status | Notes |
|--------|--------|-------|
| PDF (.pdf) | ✅ Fully Supported | Best results with OpenAI |
| PowerPoint (.pptx) | ⚠️ Limited | Browser parsing complex, use PDF |
| PowerPoint (.ppt) | ⚠️ Limited | Browser parsing complex, use PDF |

**Recommendation**: Export pitch decks to PDF for best AI parsing results.

## Cost Considerations

**OpenAI API Pricing** (as of 2025):
- GPT-4o-mini: ~$0.15 per 1M input tokens, ~$0.60 per 1M output tokens
- Average pitch deck: ~2,000 tokens input + ~500 tokens output = **~$0.001 per scan**
- 1,000 scans ≈ $1.00

💡 **Very affordable for MVP/demo usage!**

## Security Notes

⚠️ **Client-Side API Key Exposure**

This implementation uses the API key in the browser (client-side). This is acceptable for:
- ✅ MVP/Demo/Prototype
- ✅ Internal tools
- ✅ Hackathon projects

For production, you should:
- ❌ Never expose API keys in client code
- ✅ Create a backend API endpoint
- ✅ Keep API key server-side
- ✅ Add rate limiting and authentication

### Production Architecture

```
Frontend → Backend API Endpoint → OpenAI API
                ↓
         Rate Limiting
         Authentication
         API Key (secure)
```

## Testing

1. **With API Key**: Upload a PDF pitch deck, should get contextual content
2. **Without API Key**: Upload PDF, should get keyword-based content
3. **PowerPoint**: Shows message about PDF being better

## Troubleshooting

### "OpenAI API key not configured"
- Check `.env` file has `VITE_OPENAI_API_KEY`
- Restart dev server after adding key
- Key should start with `sk-`

### "OpenAI API error: 401"
- Invalid API key
- Check key is correct and active
- Verify billing is set up on OpenAI account

### "Error scanning document"
- Check browser console for details
- PDF might be corrupted or encrypted
- Try exporting to a new PDF

### "Falls back to keyword detection"
- API key might be invalid
- OpenAI API might be down
- Network connection issue

## Example Output

**Input**: DogBox pitch deck PDF about dog hydration monitoring

**AI Output** (with API key):
```
Name: DogBox
Industry: Pet Tech
Value Prop: Smart hydration monitoring that keeps your dog healthy and happy
Problem: Dog owners can't track their pet's water intake, leading to dehydration and health issues
Solution: IoT-enabled water bowl with mobile app that monitors hydration and sends alerts
Team: Veterinarians and IoT engineers with 10+ years in pet health technology
Funding: $1.2M Pre-Seed from pet-focused VCs
```

**Keyword Output** (without API key):
```
Name: DogBox
Industry: Pet Tech
Value Prop: Revolutionary solution for pet care and wellness
Problem: Pet owners struggle with providing consistent care and monitoring their pets' health needs
Solution: Smart technology platform that helps pet owners track health...
```

## Next Steps

For production deployment:
1. Create backend API endpoint for document processing
2. Move OpenAI API key to server environment
3. Add user authentication
4. Implement rate limiting (e.g., 10 uploads per user per day)
5. Add usage analytics

---

🔥 **Hot Honey** - Making startup submissions smarter with AI!
