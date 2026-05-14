# Ontology & portfolio reasoning (Growthsphere-style)

**Purpose:** Pillars that feed match scoring and UI copy: **(1)** canonical sector / primary label, **(2)** **portfolio vs candidate** sector overlap, **(3)** **user-scoped investment assumptions**, **(4)** **VC network & performance** definitions aligned with published empirical VC-network literature (see §4).

**Related:** [ENRICHMENT_STAGES.md](./ENRICHMENT_STAGES.md), [ENRICHMENT_SCRIPTS_REFERENCE.md](./ENRICHMENT_SCRIPTS_REFERENCE.md).

### Verb tense and narrative aspect (signal ontology)

Press and memo copy often mix **simple past** (a closed deal: *funded … last year*) with **present analytic** (a standing thesis: *is betting that …*) and **future** (*will be a similar investment*). That mix is strategically different from a single-tense headline.

- **Data:** `lib/signalOntology.js` exports `VERB_TENSE_ASPECT` and `VERB_TENSE_MAP` (regex → `completed_past` \| `present_analytic` \| `present_progressive` \| `present_perfect` \| `future_projection`).
- **Parse output:** `lib/signalParser.js` adds `verb_tense: [{ aspect, weight, meaning }]` on each signal object (deduped by aspect, highest weight kept).
- **Inference:** When tense aspects combine with financing language, `inferred_meanings` may include `investor_narrative_past_deal_and_present_thesis` or `investor_narrative_past_present_future_arc`.
- **Multi-clause split:** `MULTI_SIGNAL_TRIGGERS` includes causal `, so it…` / `last year, so` patterns so `parseMultiSignal` can separate clauses when each carries its own actions.

This layer is orthogonal to **`TIME_MAP`** (calendar / proximity phrases): tense tags describe the **grammar of the verb**, not only “when” adverbs.

---

## 1. Sector tightening

- **Canonical map:** `server/lib/sectorTaxonomy.js` (`normalizeSectors`, `getCanonicalSector`).
- **Primary (app):** `lib/sectorPrimary.js` — `getPrimarySector` uses the **first** array slot (JS 0-index), canonicalized; align DB data with `npm run normalize:sectors`.
- **Primary (SQL):** `startup_uploads.sectors[1]` — matches `portfolio_health` and `candidate_portfolio_sector_overlap`.

Run sector normalization **after** entity labels are stable so you do not rewrite rows that are still junk.

---

## 2. Portfolio–sector overlap

- **Migration:** `supabase/migrations/20260411120000_portfolio_sector_overlap_and_deal_prefs.sql` defines `public.candidate_portfolio_sector_overlap(p_candidate_id uuid)`.
- Returns JSON: `candidate_primary`, `active_holdings`, `counts` (`same_primary`, `shared_sector`, `new_sector`, `unknown`), and `holdings[]` with per-row `overlap`.
- **Semantics:** `same_primary` &gt; `shared_sector` (PostgreSQL `&&` on `text[]`) &gt; `new_sector`. Unknown if either side has no sectors.

---

## 3. User-scoped assumptions

- **Table:** `public.user_deal_preferences` (`user_id` → `profiles.id`, `investment_assumptions` JSONB, `updated_at`).
- **Suggested JSON keys (optional, evolve freely):** `preferred_stages`, `check_size_usd`, `geo_focus`, `thesis_tags`, `overlap_preference` (`same_primary` | `diversified`). Consumers merge with product defaults.

---

## 4. VC network & performance (literature definitions)

**Reference:** Ke Shi, *Venture Capital: A Tale of Three Networks* (working paper, Caltech), [Shi_vc_networks.pdf](https://www.keshiecon.com/assets/files/Shi_vc_networks.pdf). These definitions align **research language** with eventual product metrics; only a subset may be implemented in-app as data allows.

**Code hints (IDE):** `src/lib/vcNetworkDefinitions.ts` — short strings and `VcCentralityKind` for tooltips or future metrics.

### Performance

| Term | Definition |
|------|-------------|
| **VC performance / exit rate** | Share of a VC firm’s portfolio companies that **exit via IPO or acquisition**. Used interchangeably with “exit rate”; bounded in \([0,1]\). Fund-level IRR is ideal but often **unobserved**; exit rate is the **published proxy** in that line of work. |

### Network adjacencies (who connects to whom)

| Symbol | Name | Construction (Shi-style) |
|--------|------|---------------------------|
| **\(G\)** | **Coinvestment network** | For VC pair \((i,j)\), \(g_{ij}\) = **count of joint investments** (same funding rounds / syndication). **Undirected**; **no self-loops** (\(g_{ii}=0\)). Empirical variants: **binary** (ever coinvested), **log(\(g_{ij}\))** for intensity. |
| **\(H^p\)** | **Professional (historical) network** | From partner **employment history** (e.g. LinkedIn): \(h^p_{ij}\) counts **shared employers** across partners of firm \(i\) and firm \(j\) (pairwise overlaps aggregated to the **VC–VC** dyad). Interpreted as **potential** professional tie strength, not necessarily direct co-worker relationships. |
| **\(H^a\)** | **Alumni network** | From partner **education**: \(h^a_{ij}\) counts **shared schools** across partners of \(i\) and \(j\), aggregated to the VC–VC dyad. Same “potential tie” interpretation as \(H^p\). |

### Centrality (position in \(G\); standard graph concepts)

| Concept | Meaning (short) |
|---------|-------------------|
| **Degree** | Number of distinct co-investor links (optionally **weighted** by \(g_{ij}\)). |
| **Betweenness** | How often a VC lies on **shortest paths** between others — “bridge” role. |
| **Harmonic** | Related to **closeness**: inverse of average shortest-path length to other reachable nodes. |
| **Eigenvector** | Influence from being tied to **high-centrality** peers; principal eigenvector of \(G\) (\(\lambda x = Gx\)). |
| **Alpha centrality** | Generalization: \(x = \delta G x + \varepsilon\) — network feedback plus **exogenous** influence \(\varepsilon\); nests eigenvector when \(\varepsilon = 0\). |

### Partner names → demographics (not “NLP on thesis text”)

In that literature, **gender and ethnicity** are sometimes **imputed from first and last names** (e.g. from LinkedIn), with **conservative** rules (ambiguous cases resolved toward **male** / **non-Asian** in Shi’s description). That is **name classification**, not sentence tokenization or topic modeling. Use only as **methodological context** if we ever store similar fields; privacy and bias review apply.

### Directional map to Pythh data (when we implement)

| Literature object | Possible product home |
|-------------------|------------------------|
| Exit / performance | `virtual_portfolio`, exit fields, portfolio health / MOIC-style views |
| Coinvestment \(G\) | Edges from **shared deals**: `startup_investor_matches`, round-level syndicates, investor–investor pairs |
| \(H^p\), \(H^a\) | Partner-level enrichment (employment + education graph) → roll up to firm pair or firm features |
| Centrality | **Derived** scores or batch jobs over an investor–investor graph — optional layer above raw edges |

---

## First three commands to run (in order)

Use this order when bringing a branch or DB up to date for **ontology + enrichment + portfolio reasoning**:

1. **Apply Supabase migrations** (includes entity gate, overlap RPC, `user_deal_preferences`), e.g. from repo root:

   ```bash
   npx supabase db push
   ```

   Or run the SQL files in the Supabase SQL editor if you do not use the CLI.

2. **Entity resolution gate (persist labels)** — classifies startups/investors before heavy RSS:

   ```bash
   npm run entity-gate:execute
   ```

   Prefer a dry run first if you want to inspect volume: `npm run entity-gate`.

3. **Normalize sectors** — preview, then apply so primary sectors line up with the taxonomy:

   ```bash
   node scripts/normalize-sectors.js --dry-run
   npm run normalize:sectors
   ```

**Next (optional, daily-style pipeline):** run tightening with the gate and RSS junk skip:

```bash
npm run startup:tighten -- --run-entity-gate --rss-gate-exclude-junk
```

---

## Quick SQL check (after migrations)

```sql
SELECT public.candidate_portfolio_sector_overlap('<startup_uploads.uuid>'::uuid);
```
