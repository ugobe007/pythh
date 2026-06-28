# 🔥 VC SCRAPER QUICK GUIDE

## What It Does
Scrapes VC firm lists from websites like Dealroom, TechCrunch, Forbes Midas List, etc. and adds them to your database automatically.

## How to Use

### 1. **Run the Scraper**
```bash
node scrape-vc-list.js <url>
```

### 2. **Examples**

**Dealroom Top VCs:**
```bash
node scrape-vc-list.js https://dealroom.net/blog/top-venture-capital-firms
```

**TechCrunch Top VCs:**
```bash
node scrape-vc-list.js https://techcrunch.com/lists/top-vcs-2024/
```

**Forbes Midas List:**
```bash
node scrape-vc-list.js https://www.forbes.com/midas-list/
```

**CB Insights Top 100:**
```bash
node scrape-vc-list.js https://www.cbinsights.com/research/best-venture-capital-firms/
```

## How It Works

1. **Scrapes** the webpage you provide
2. **Extracts** text content from the page
3. **Uses OpenAI** to identify VC firm names
4. **Saves** to your database (skips duplicates)
5. **Reports** how many were added

## Output Example
```
═══════════════════════════════════════════════════════════
🔥 VC LIST SCRAPER - Hot Match
═══════════════════════════════════════════════════════════

🔍 Scraping VC list from: https://dealroom.net/blog/top-venture-capital-firms

📄 Page loaded, analyzing content...

🧠 Using OpenAI to extract VC firm names...

✅ Found 50 VC firms

💾 Saving 50 VCs to database...

✅ Sequoia Capital - Added
✅ Andreessen Horowitz - Added
✅ Accel - Added
⏭️  First Round Capital - Already exists
...

═══════════════════════════════════════════════════════════
📊 RESULTS:
   ✅ Added: 47
   ⏭️  Skipped: 3
   📈 Total: 50
═══════════════════════════════════════════════════════════

✅ Done!
```

## Best Sources for VC Lists

### Top Tier Lists (100+ VCs each):
- **Dealroom**: https://dealroom.net/blog/top-venture-capital-firms
- **CB Insights Top 100**: https://www.cbinsights.com/research/best-venture-capital-firms/
- **TechCrunch Top VCs**: https://techcrunch.com/lists/top-vcs-2024/
- **Forbes Midas List**: https://www.forbes.com/midas-list/

### Specialized Lists:
- **AI/ML VCs**: https://airtable.com/shrV2fXPriYFWvXPm/tblCOkb2c3b4UjbHe
- **Crypto VCs**: https://cryptovalley.swiss/crypto-venture-capital-firms/
- **European VCs**: https://dealroom.net/blog/top-european-venture-capital-firms
- **YC Top Companies**: https://www.ycombinator.com/topcompanies

### Accelerator Portfolios:
- **Y Combinator**: https://www.ycombinator.com/companies
- **Techstars**: https://www.techstars.com/portfolio
- **500 Startups**: https://500.co/companies

## Tips

1. **Run multiple sources** - Different lists have different VCs
2. **Check duplicates** - Script automatically skips existing VCs
3. **Review data** - Go to `/investors` to see all added VCs
4. **Enrich later** - Use `enrich-investor-data.ts` to add more details

## Troubleshooting

**"Cannot find module 'node-fetch'"**
```bash
npm install node-fetch cheerio
```

**"No VC firms found"**
- The page might not be a list format
- Try a different URL
- OpenAI might not recognize the content

**"Already exists" for all VCs**
- ✅ Good! You already have them
- Try a different source list

## Next Steps After Scraping

1. **View your VCs**: Navigate to `/investors`
2. **Enrich data**: Run `node enrich-investor-data.ts` to add sectors, check sizes, etc.
3. **Generate matches**: Go to `/matching-engine` to match startups with VCs

---

**Pro Tip**: Scrape 3-4 different sources to build a comprehensive VC database of 200-500 firms!
