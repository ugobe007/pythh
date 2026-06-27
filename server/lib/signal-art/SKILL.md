---
name: signal-art
description: Minimalist neon vector compositions for Pythh Signal Art. Automated raster via Google AI Studio (Gemini image). Avoid generic AI aesthetics.
---

# Signal Art — Digital Artist Skill

Act as a professional digital artist specializing in **minimalist vector art** and **neon color palettes**.

## Raster provider: Google AI Studio

Automated daily generation via **Gemini image models** (`gemini-2.5-flash-image` default).

| Env | Purpose |
|-----|---------|
| `GEMINI_API_KEY` | API key from [Google AI Studio](https://aistudio.google.com/api-keys) |
| `SIGNAL_ART_IMAGE_MODEL` | Optional override (e.g. `gemini-3.1-flash-image`) |
| `SIGNAL_ART_RASTER=0` | Skip raster; SVG fallback only |
| `SIGNAL_ART_STORAGE_BUCKET` | Supabase bucket (default `pythh-art`) |

**Note:** Image generation often requires **billing enabled** on the Google AI project — free tier image quota may be 0.

Outputs upload to Supabase Storage (`pythh-art` bucket) + local `public/art/{date}.png`.

## Before generating

Plan the composition in four layers:

| Layer | Role | Rules |
|-------|------|-------|
| **Background** | Depth and silence | Flat void, golden-ratio horizon, no grids |
| **Midground** | Market structure | Stroke-only arcs and ticks |
| **Foreground** | Focal subject | One beacon + one match tether |
| **Lighting** | Accent restraint | Single neon bloom on foreground |

## References (ai-artist skill)

| Topic | File |
|-------|------|
| LLM copy | `mcpmarket-me/skills/ai-artist/references/llm-prompting.md` |
| Image brief | `mcpmarket-me/skills/ai-artist/references/image-prompting.md` |
| Gemini prompts | `mcpmarket-me/skills/ai-artist/references/nano-banana.md` |

## Implementation modules

| Module | Path |
|--------|------|
| SVG (fallback) | `server/lib/pythhArtGenerator.js` |
| Image brief | `server/lib/signalArtPrompt.js` |
| Gemini raster | `server/lib/signalArtGemini.js` |
| Artist copy | `server/lib/signalArtCopy.js` |

## Pipeline

1. **Plan** — signals → geometry + lighting
2. **Brief** — narrative paragraph (Nano Banana style)
3. **Raster** — Gemini `generateContent` with `responseModalities: [IMAGE]`
4. **SVG** — deterministic fallback if raster fails
5. **Copy** — PYTHIA LLM JSON artist statement
6. **Store** — Supabase `pythh_art_editions` + Storage

## Negative prompt (always apply)

```
coordinate grid, node graph, text, watermark, photorealistic clutter, 3d render, stock illustration
```
