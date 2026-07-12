# Product Hunt gallery — pythh.ai

Captured at **1270×760** viewport, **2× retina** (2540×1520 PNG).  
Regenerate: `npm run gallery:product-hunt`

## Upload order (recommended)

| # | File | PH caption (optional) |
|---|------|------------------------|
| 1 | `01-home-hero.png` | Drop your URL — ranked investor matches in ~30 seconds |
| 2 | `07-matches.png` | Live match list with GOD score, fit %, and investor signals |
| 3 | `03-portfolio-oracle.png` | Public Oracle portfolio — 70% verified funded rate |
| 4 | `02-platform-engine.png` | 3.6M+ matches across 7,800 investors and 41K startups |
| 5 | `05-investor-rankings.png` | Investor rankings by deployment velocity and thesis fit |
| 6 | `06-methodology-god.png` | GOD score — Team, Traction, Market, Product, Vision |

Skip `04-explore-rankings.png` unless you want a 7th image (startup discovery grid).

## Product Hunt specs

- Format: PNG or JPG
- Ratio: 16:9 (these are 1270×760 logical, 2540×1520 actual)
- Max 8 images; lead with **hero + matches** (founder outcome first)

## Local capture

```bash
npm run dev   # in another terminal
node scripts/capture-product-hunt-gallery.mjs --base=http://localhost:5173
```
