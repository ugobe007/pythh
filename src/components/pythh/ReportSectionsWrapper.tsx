/**
 * ReportSectionsWrapper - Fetches match scores and renders report sections
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { dedupeInvestorMatchesByFirm } from '@/lib/dedupeInvestorMatchesByFirm';
import { FocusAreas, MeetingSuccessForecast, NextSteps, BottomCTA } from './ReportSections';
import type { StartupContext } from '@/lib/pythh-types';

interface ReportSectionsWrapperProps {
  context: StartupContext;
  startupId: string;
  totalMatches: number;
}

export default function ReportSectionsWrapper({
  context,
  startupId,
  totalMatches,
}: ReportSectionsWrapperProps) {
  const [topMatchScores, setTopMatchScores] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTopMatchScores() {
      try {
        // Top 5 unique firms by match score (aligns with readiness match list)
        const { data, error } = await supabase
          .from('startup_investor_matches')
          .select(`
            match_score,
            investors ( id, name, firm )
          `)
          .eq('startup_id', startupId)
          .order('match_score', { ascending: false })
          .limit(40);

        if (error) throw error;

        const rows = (data || []).map((row: { match_score: number; investors: unknown }) => ({
          match_score: row.match_score,
          investors: row.investors,
        }));
        const deduped = dedupeInvestorMatchesByFirm(rows, 5);
        const scores = deduped
          .map(m => m.match_score)
          .filter((score): score is number => score !== null && score !== undefined)
          .map(score => (typeof score === 'number' ? score : parseFloat(String(score))));

        setTopMatchScores(scores);
      } catch (err) {
        console.error('Error fetching match scores:', err);
        // Fallback: use empty array, component will handle gracefully
        setTopMatchScores([]);
      } finally {
        setLoading(false);
      }
    }

    fetchTopMatchScores();
  }, [startupId]);

  if (loading) {
    return null; // Don't show sections while loading match scores
  }

  return (
    <>
      <FocusAreas context={context} />
      <MeetingSuccessForecast
        context={context}
        topMatchScores={topMatchScores}
        totalMatches={totalMatches}
      />
      <NextSteps
        context={context}
        totalMatches={totalMatches}
        startupId={startupId}
      />
      <BottomCTA startupId={startupId} />
    </>
  );
}
