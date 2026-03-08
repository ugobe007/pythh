/**
 * ReportSectionsWrapper - Fetches match scores and renders report sections
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
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
        // Fetch top 5 match scores
        const { data, error } = await supabase
          .from('startup_investor_matches')
          .select('match_score')
          .eq('startup_id', startupId)
          .order('match_score', { ascending: false })
          .limit(5);

        if (error) throw error;

        const scores = (data || [])
          .map(m => m.match_score)
          .filter((score): score is number => score !== null && score !== undefined)
          .map(score => typeof score === 'number' ? score : parseFloat(score));

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
