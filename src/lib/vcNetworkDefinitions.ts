/**
 * VC network & performance definitions (literature-aligned).
 * Full prose + tables: docs/ONTOLOGY_REASONING_ROADMAP.md §4
 * Reference: Ke Shi, "Venture Capital: A Tale of Three Networks"
 * https://www.keshiecon.com/assets/files/Shi_vc_networks.pdf
 */

/** IPO or acquisition exit share; interchangeable with "exit rate" in that literature. */
export const VC_PERFORMANCE_EXIT_RATE = {
  id: 'vc_performance_exit_rate',
  summary:
    'Share of a VC firm’s portfolio companies that exit via IPO or acquisition; bounded [0,1]. Fund IRR is often unobserved; exit rate is the common empirical proxy.',
} as const;

/** Coinvestment adjacency: joint rounds / syndication counts between VC i and j. */
export const NETWORK_COINVESTMENT_G = {
  id: 'G',
  summary:
    'Undirected weighted edges g_ij = count of joint investments (same rounds). g_ii = 0. Variants: binary (ever coinvested), log(g_ij).',
} as const;

/** Professional overlap: shared employers across partners (VC–VC dyad). */
export const NETWORK_PROFESSIONAL_HP = {
  id: 'H_p',
  summary:
    'From partner employment history: counts of shared employers between firms i and j; potential tie strength, not necessarily direct coworkers.',
} as const;

/** Alumni overlap: shared schools across partners (VC–VC dyad). */
export const NETWORK_ALUMNI_HA = {
  id: 'H_a',
  summary:
    'From partner education: counts of shared institutions between firms i and j; same interpretation as professional overlap.',
} as const;

/** Standard centrality families used on G (and weighted variants). */
export const VC_CENTRALITY_KINDS = [
  'degree',
  'betweenness',
  'harmonic',
  'eigenvector',
  'alpha',
] as const;

export type VcCentralityKind = (typeof VC_CENTRALITY_KINDS)[number];

export const VC_CENTRALITY_HINT: Record<VcCentralityKind, string> = {
  degree: 'Count of distinct co-investor links (optionally weighted by g_ij).',
  betweenness: 'Share of shortest paths between other pairs that pass through this node.',
  harmonic: 'Inverse of average shortest-path length to reachable peers (closeness-related).',
  eigenvector: 'Influence via ties to influential nodes; λx = Gx.',
  alpha: 'x = δGx + ε; network feedback plus exogenous ε; nests eigenvector if ε = 0.',
};

/**
 * Literature note: gender/ethnicity from first/last names (conservative classifiers).
 * Not NLP on free text; see roadmap §4 before product use.
 */
export const PARTNER_NAME_DEMOGRAPHICS_NOTE =
  'Some papers impute gender/ethnicity from partner first/last names (e.g. LinkedIn) with conservative rules; bias/privacy review required for any product field.';

/** Where Shi-style objects may land in Pythh (directional; not all implemented). */
export const PYTHH_MAPPING_HINT = {
  exitPerformance: 'virtual_portfolio, exit fields, portfolio health views',
  coinvestmentG: 'startup_investor_matches, round syndicates, investor–investor edges',
  professionalAlumni: 'partner enrichment JSON → firm-pair or firm-level features',
  centrality: 'derived scores over investor–investor graph (batch / optional)',
} as const;
