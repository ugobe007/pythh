/**
 * Compact disclosure of news/site enrichment stored in startup_uploads.extracted_data.
 * Supporting context for GOD + Signal Scores — not a second headline score.
 */

import { useMemo } from 'react';

export interface ExtractedDataInsightsShape {
  ontology_inference?: {
    signal_classes?: Array<{
      signal_class: string;
      best_certainty?: number;
      snippet?: string;
      meaning?: string | null;
    }>;
    inferred_strategic_needs?: string[];
    evidence_snippets?: Array<{ signal_class: string; text: string; certainty?: number }>;
  } | null;
  market_signals?: {
    primarySignal?: string | null;
    primaryCategory?: string | null;
    primaryMeaning?: string | null;
    signals?: Array<{
      signal: string;
      category?: string;
      meaning?: string;
      score?: number;
      snippet?: string | null;
    }>;
  } | null;
  enrichment_confidence?: {
    max_narrative_score?: number;
    funding_corroboration?: boolean | null;
    ontology_fundraising_signal?: boolean;
    computed_at?: string;
  } | null;
}

function formatSignalClass(s: string): string {
  return s.replace(/_signal$/i, '').replace(/_/g, ' ');
}

function hasInsightContent(data: ExtractedDataInsightsShape | null | undefined): boolean {
  if (!data || typeof data !== 'object') return false;
  const ont = data.ontology_inference?.signal_classes?.length ?? 0;
  const needs = data.ontology_inference?.inferred_strategic_needs?.length ?? 0;
  const ms = data.market_signals?.signals?.length ?? 0;
  const prim = data.market_signals?.primarySignal && data.market_signals.primarySignal !== 'unclassified_signal';
  return ont > 0 || needs > 0 || ms > 0 || !!prim;
}

export interface EnrichmentInsightsAccordionProps {
  extractedData: ExtractedDataInsightsShape | null | undefined;
  defaultOpen?: boolean;
}

export function EnrichmentInsightsAccordion({
  extractedData,
  defaultOpen = false,
}: EnrichmentInsightsAccordionProps) {
  const rich = useMemo(() => hasInsightContent(extractedData ?? null), [extractedData]);

  const ontologyRows = extractedData?.ontology_inference?.signal_classes?.slice(0, 6) ?? [];
  const needs = extractedData?.ontology_inference?.inferred_strategic_needs?.slice(0, 8) ?? [];
  const marketList = extractedData?.market_signals?.signals?.slice(0, 6) ?? [];
  const primary = extractedData?.market_signals?.primarySignal;
  const primaryMeaning = extractedData?.market_signals?.primaryMeaning;
  const conf = extractedData?.enrichment_confidence;

  return (
    <div className="mb-8 border border-white/10 rounded-lg overflow-hidden">
      <details className="group" open={defaultOpen}>
        <summary className="cursor-pointer list-none px-6 py-4 flex items-center justify-between gap-4 bg-white/[0.03] hover:bg-white/[0.05] transition [&::-webkit-details-marker]:hidden">
          <div>
            <h2 className="text-lg font-semibold text-white inline">What we inferred</h2>
            <p className="text-xs text-white/50 mt-0.5">
              From your site and public signals — supports GOD &amp; timing scores
            </p>
          </div>
          <span className="text-cyan-400/80 text-sm shrink-0 group-open:rotate-180 transition-transform duration-200 inline-block">
            ▼
          </span>
        </summary>
        <div className="px-6 pb-6 pt-0 border-t border-white/5 space-y-5">
          {!rich && (
            <p className="text-sm text-white/60 leading-relaxed">
              Limited enrichment on file. Add or verify your company website, complete a fresh analysis, and ensure
              scores are recalculated so GOD and signal scores reflect the latest crawl.
            </p>
          )}

          {primary && primary !== 'unclassified_signal' && (
            <div>
              <div className="text-xs text-white/50 uppercase tracking-wider mb-2">Primary market signal</div>
              <div className="text-cyan-300 font-medium">{formatSignalClass(primary)}</div>
              {primaryMeaning && (
                <p className="text-sm text-white/70 mt-1">{primaryMeaning}</p>
              )}
            </div>
          )}

          {marketList.length > 0 && (
            <div>
              <div className="text-xs text-white/50 uppercase tracking-wider mb-2">Signal highlights</div>
              <ul className="space-y-2">
                {marketList.map((s, i) => (
                  <li key={`${s.signal}-${i}`} className="text-sm border-l border-cyan-500/30 pl-3">
                    <span className="text-white/90 font-medium">{formatSignalClass(s.signal)}</span>
                    {typeof s.score === 'number' && (
                      <span className="text-white/40 ml-2">({s.score.toFixed(2)})</span>
                    )}
                    {s.meaning && <p className="text-white/60 text-xs mt-0.5">{s.meaning}</p>}
                    {s.snippet && (
                      <p className="text-white/45 text-xs mt-1 italic line-clamp-2">&ldquo;{s.snippet}&rdquo;</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {ontologyRows.length > 0 && (
            <div>
              <div className="text-xs text-white/50 uppercase tracking-wider mb-2">Ontology classes</div>
              <ul className="space-y-2">
                {ontologyRows.map((row, i) => (
                  <li key={`${row.signal_class}-${i}`} className="text-sm border-l border-emerald-500/30 pl-3">
                    <span className="text-white/90">{formatSignalClass(row.signal_class)}</span>
                    {typeof row.best_certainty === 'number' && (
                      <span className="text-emerald-400/90 text-xs ml-2">
                        {Math.round(row.best_certainty * 100)}% confidence
                      </span>
                    )}
                    {row.meaning && <p className="text-white/55 text-xs mt-0.5">{row.meaning}</p>}
                    {row.snippet && !row.meaning && (
                      <p className="text-white/45 text-xs mt-1 line-clamp-2">{row.snippet}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {needs.length > 0 && (
            <div>
              <div className="text-xs text-white/50 uppercase tracking-wider mb-2">Strategic needs (inferred)</div>
              <div className="flex flex-wrap gap-2">
                {needs.map((n) => (
                  <span
                    key={n}
                    className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-xs text-white/80"
                  >
                    {n}
                  </span>
                ))}
              </div>
            </div>
          )}

          {conf && (conf.max_narrative_score != null || conf.computed_at) && (
            <div className="text-xs text-white/40 pt-2 border-t border-white/5">
              {conf.max_narrative_score != null && (
                <span className="mr-4">Narrative strength: {Math.round((conf.max_narrative_score as number) * 1000) / 1000}</span>
              )}
              {conf.computed_at && <span>Updated {new Date(conf.computed_at).toLocaleString()}</span>}
            </div>
          )}

          <p className="text-[11px] text-white/35 leading-relaxed">
            Model-derived signals are indicative, not audited financials. GOD and signal scores incorporate this layer
            when enrichment has run and scores have been recalculated.
          </p>
        </div>
      </details>
    </div>
  );
}
