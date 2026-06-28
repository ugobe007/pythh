---
name: signal-art
description: Registered Pythh art direction — digital abstract layered compositions from live market signals. Gemini raster via Google AI Studio.
---

# Signal Art — Registered Art Direction

**Signal Art** is the official visual language for Pythh daily art (`/art`). PYTHH interprets live startup signals into **digital abstract compositions** — multiple coordinated signal layers with seed-randomized layout.

| Field | Value |
|-------|-------|
| **ID** | `signal-art` |
| **Style** | Digital abstract art, layered, signal-driven |
| **Primary output** | Gemini raster (Google AI Studio) |
| **Fallback** | Deterministic SVG with abstract signal layers |
| **Registry** | `server/lib/signalArtDirection.js` |

## Creative rules

1. **Not charts** — signals become abstract motifs (arcs, filaments, washes, blooms), never literal dashboards.
2. **Layered depth** — each live signal maps to a translucent plane; layers stack back → front in coordinated fashion.
3. **Seed-randomized** — layout mode, rotation, scale, and placement vary per edition but are deterministic from `edition_date` seed.
4. **PYTHH interpretation** — narrative explains how today's market was read before rendering.

## Layout modes (seed-picked)

| Mode | Description |
|------|-------------|
| `orbital` | Motifs orbit a central void |
| `stacked` | Translucent planes front to back |
| `fractured` | Asymmetric shards at rule-of-thirds |
| `radial` | Concentric rings from focal point |
| `diagonal` | Layers sheared on diagonal axis |
| `depth_stack` | Deep parallax with foreground overlay |

## Signal → motif mapping

| Signal type | Abstract motif |
|-------------|----------------|
| Leading dimension | Dominant motif (arc, lattice, pulse) |
| Signal dimensions | Secondary overlapping planes |
| Funding moves | Parallel thrust ribbons |
| Top match | Tension filament bridge |
| Sector | Chromatic wash plane |
| GOD score / focal startup | Intensity bloom node |
| Coverage | Void density field |

## Env vars

| Env | Purpose |
|-----|---------|
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/api-keys) |
| `SIGNAL_ART_IMAGE_MODEL` | e.g. `gemini-3.1-flash-image` |
| `SIGNAL_ART_RASTER=0` | SVG-only mode |
| `SIGNAL_ART_STORAGE_BUCKET` | Supabase bucket (default `pythh-art`) |

## Pipeline

1. **Extract** — newsletter → signal snapshot
2. **Plan** — geometry, palette, tension, lighting
3. **Interpret** — `interpretSignalLayers()` → layered motifs + layout mode
4. **Brief** — narrative for Gemini (layer list + PYTHH interpretation)
5. **Raster** — Gemini image generation → Supabase Storage
6. **SVG** — fallback with abstract signal layer shapes
7. **Copy** — PYTHIA artist statement (LLM + template fallback)
8. **Store** — `pythh_art_editions`

## Modules

| Module | Path |
|--------|------|
| **Registry** | `server/lib/signalArtDirection.js` |
| Orchestrator | `server/lib/pythhArtGenerator.js` |
| Image brief | `server/lib/signalArtPrompt.js` |
| Gemini raster | `server/lib/signalArtGemini.js` |
| Artist copy | `server/lib/signalArtCopy.js` |
| CLI | `scripts/generate-pythh-art.mjs` |
| Page | `site/pages/Art.tsx` |

## Negative prompt (always apply)

```
coordinate grid, node graph, text, watermark, literal charts, dashboard UI,
photorealistic clutter, 3d render, stock illustration, generic AI art
```
