---
name: signal-art
description: Minimalist neon vector compositions for Pythh Signal Art. Break every edition into background, midground, foreground, and lighting before drawing. Avoid generic AI aesthetics.
---

# Signal Art — Digital Artist Skill

Act as a professional digital artist specializing in **minimalist vector art** and **neon color palettes**.

When creating an illustration, **break down the composition into foreground, background, and lighting before generating**. Avoid generic AI aesthetics — over-rendering, unnatural lighting, grid spam, node graphs.

## Before generating

Plan the composition in four layers:

| Layer | Role | Rules |
|-------|------|-------|
| **Background** | Depth and silence | Flat void, golden-ratio horizon, no grids |
| **Midground** | Market structure | Stroke-only arcs and ticks — signal strength, funding flow |
| **Foreground** | Focal subject | One beacon + one match tether — line art only |
| **Lighting** | Accent restraint | Single neon bloom on foreground; style from signal data |

## References

Load for detailed guidance (ai-artist skill):

| Topic | File | Description |
|-------|------|-------------|
| LLM | `mcpmarket-me/skills/ai-artist/references/llm-prompting.md` | System prompts, CoT, JSON output |
| Image | `mcpmarket-me/skills/ai-artist/references/image-prompting.md` | Style keywords, lighting, negatives |
| Nano Banana | `mcpmarket-me/skills/ai-artist/references/nano-banana.md` | Narrative briefs, hex colors |
| Advanced | `mcpmarket-me/skills/ai-artist/references/advanced-techniques.md` | Chaining, refinement loops |
| Domain Index | `mcpmarket-me/skills/ai-artist/references/domain-patterns.md` | Universal patterns |

Implementation modules:

| Module | Path | Role |
|--------|------|------|
| SVG generator | `server/lib/pythhArtGenerator.js` | Deterministic vector execution |
| Image brief | `server/lib/signalArtPrompt.js` | Narrative prompt + lighting pick |
| Artist copy | `server/lib/signalArtCopy.js` | LLM CoT copy with template fallback |

## Pipeline (prompt chaining)

1. **Plan** — `planComposition()` maps signals → geometry + lighting style
2. **Brief** — `buildImageBrief()` writes narrative paragraph (Nano Banana style) + negative prompt
3. **Draw** — SVG layers: background → midground → foreground → lighting filter
4. **Copy** — `generateArtCopy()` LLM with step-by-step CoT, JSON `{ process, philosophy, introspection }`

## Lighting vocabulary (from image-prompting)

| Signal condition | Style |
|------------------|-------|
| Leading ≥ 75% | Neon glow |
| Funding ≥ 8 | Golden hour |
| Low activity | Blue hour |
| High GOD variance | Split light |
| Moderate tension | Rim / back light |

## Negative prompt (always apply)

```
coordinate grid, node graph, spider web, filled blob cluster,
omnidirectional glow, over-rendered blur, 3d render, watermark,
text overlay, stock illustration, generic AI art
```

## Anti-patterns

- Vague instructions ("make it better")
- Conflicting constraints (photorealistic + flat vector)
- Over-prompting with redundant keywords
- Ignoring model-specific strengths (use narrative for copy, JSON for structure)
- More than ~12 visible stroke elements in SVG

## Signal → form mapping

- Leading signal % → arc sweep + beacon height
- Coverage → horizon placement (negative space)
- Funding count → parallel streak count (cap 6)
- Match score → tether line angle
- GOD variance → rule-of-thirds offset + split lighting
