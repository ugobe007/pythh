import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { getAnonUserId } from "../lib/anonUser";

export type VoteType = "yes" | "no";

export interface VoteRow {
  id: string;
  user_id: string;
  vote: VoteType;
  created_at: string;
  metadata: any;
}

export interface Vote {
  id: string;
  startup_local_id: string; // derived from metadata.startup_local_id
  user_id: string;
  vote: VoteType;
  created_at: string;
}

export interface VoteCount {
  startup_local_id: string;
  yes_votes: number;
  no_votes: number;
  total_votes: number;
}

/**
 * Hook for managing votes with Supabase
 * SSOT table: public.votes
 * - user_id uuid NOT NULL
 * - vote text
 * - metadata jsonb (we store startup_local_id here)
 * - created_at timestamptz
 *
 * Uniqueness (recommended): unique index on (user_id, metadata->>'startup_local_id')
 */
export function useVotes(userId?: string | null) {
  const uid = userId ?? getAnonUserId();

  const [votes, setVotes] = useState<Vote[]>([]);
  const [voteCounts, setVoteCounts] = useState<Record<string, VoteCount>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hydrateVotes = (rows: VoteRow[]): Vote[] => {
    return (rows || [])
      .map((r) => {
        const startupLocalId = r?.metadata?.startup_local_id;
        if (!startupLocalId) return null;
        return {
          id: r.id,
          startup_local_id: String(startupLocalId),
          user_id: String(r.user_id),
          vote: r.vote,
          created_at: r.created_at,
        } as Vote;
      })
      .filter(Boolean) as Vote[];
  };

  // Fetch user's votes
  const fetchUserVotes = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from("votes")
        .select("id, user_id, vote, created_at, metadata")
        .eq("user_id", uid);

      if (error) throw error;

      const hydrated = hydrateVotes((data as any[]) || []);
      setVotes(hydrated);

      // Back-compat localStorage mirrors (optional)
      const yesVotes = hydrated.filter((v) => v.vote === "yes").map((v) => v.startup_local_id);
      localStorage.setItem("myYesVotes", JSON.stringify(yesVotes));

      const votedIds = hydrated.map((v) => v.startup_local_id);
      localStorage.setItem("votedStartups", JSON.stringify(votedIds));
    } catch (err: any) {
      console.error("Error fetching votes:", err);
      setError(err.message || String(err));

      // Fallback to localStorage
      const localYes = JSON.parse(localStorage.getItem("myYesVotes") || "[]");
      const fallback = (localYes as string[]).map((id) => ({
        id: `local_${id}`,
        startup_local_id: String(id),
        user_id: uid,
        vote: "yes" as const,
        created_at: new Date().toISOString(),
      }));
      setVotes(fallback);
    } finally {
      setIsLoading(false);
    }
  }, [uid]);

  // Fetch vote counts for all startups (grouped client-side)
  const fetchVoteCounts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("votes")
        .select("vote, metadata");

      if (error) throw error;

      const countsMap: Record<string, VoteCount> = {};
      ((data as any[]) || []).forEach((row: any) => {
        const startupLocalId = row?.metadata?.startup_local_id;
        if (!startupLocalId) return;

        const id = String(startupLocalId);
        if (!countsMap[id]) {
          countsMap[id] = { startup_local_id: id, yes_votes: 0, no_votes: 0, total_votes: 0 };
        }

        if (row.vote === "yes") countsMap[id].yes_votes++;
        else if (row.vote === "no") countsMap[id].no_votes++;
        countsMap[id].total_votes++;
      });

      setVoteCounts(countsMap);
    } catch (err: any) {
      console.error("Error fetching vote counts:", err);
    }
  }, []);

  // Cast a vote (single upsert, uses uniqueness index)
  const castVote = useCallback(
    async (startupId: string, voteType: VoteType) => {
      setError(null);

      try {
        const { error } = await supabase
          .from("votes")
          .upsert(
            {
              user_id: uid,
              vote: voteType,
              weight: 1.0,
              metadata: { startup_local_id: startupId },
            },
            { onConflict: "user_id,metadata->>startup_local_id" }
          );

        if (error) throw error;

        await Promise.all([fetchUserVotes(), fetchVoteCounts()]);
        return true;
      } catch (err: any) {
        console.error("Error casting vote:", err);
        setError(err.message || String(err));

        // localStorage fallback mirrors
        const votedStartups = JSON.parse(localStorage.getItem("votedStartups") || "[]");
        if (!votedStartups.includes(startupId)) {
          votedStartups.push(startupId);
          localStorage.setItem("votedStartups", JSON.stringify(votedStartups));
        }

        if (voteType === "yes") {
          const yesVotes = JSON.parse(localStorage.getItem("myYesVotes") || "[]");
          if (!yesVotes.includes(startupId)) {
            yesVotes.push(startupId);
            localStorage.setItem("myYesVotes", JSON.stringify(yesVotes));
          }
        }

        return false;
      }
    },
    [uid, fetchUserVotes, fetchVoteCounts]
  );

  // Remove a vote (delete by user_id + startup_local_id inside metadata)
  const removeVote = useCallback(
    async (startupId: string) => {
      setError(null);

      try {
        const { error } = await supabase
          .from("votes")
          .delete()
          .eq("user_id", uid)
          .contains("metadata", { startup_local_id: startupId });

        if (error) throw error;

        await Promise.all([fetchUserVotes(), fetchVoteCounts()]);
        return true;
      } catch (err: any) {
        console.error("Error removing vote:", err);
        setError(err.message || String(err));

        // localStorage fallback
        const yesVotes = JSON.parse(localStorage.getItem("myYesVotes") || "[]");
        const updated = yesVotes.filter((id: string) => id !== startupId);
        localStorage.setItem("myYesVotes", JSON.stringify(updated));

        return false;
      }
    },
    [uid, fetchUserVotes, fetchVoteCounts]
  );

  // Clear all votes for user
  const clearAllVotes = useCallback(async () => {
    setError(null);

    try {
      const { error } = await supabase.from("votes").delete().eq("user_id", uid);
      if (error) throw error;

      setVotes([]);
      localStorage.removeItem("myYesVotes");
      localStorage.removeItem("votedStartups");
      await fetchVoteCounts();
      return true;
    } catch (err: any) {
      console.error("Error clearing votes:", err);
      setError(err.message || String(err));
      return false;
    }
  }, [uid, fetchVoteCounts]);

  // Setup real-time subscription
  useEffect(() => {
    fetchUserVotes();
    fetchVoteCounts();

    const sub = supabase
      .channel("votes_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "votes" }, () => {
        fetchVoteCounts();
      })
      .subscribe();

    return () => {
      sub.unsubscribe();
    };
  }, [fetchUserVotes, fetchVoteCounts]);

  return {
    userId: uid,
    votes,
    voteCounts,
    isLoading,
    error,
    castVote,
    removeVote,
    clearAllVotes,
    getVoteForStartup: (startupId: string) => votes.find((v) => v.startup_local_id === startupId),
    hasVoted: (startupId: string) => {
      const v = votes.find((x) => x.startup_local_id === startupId);
      return v ? v.vote : null;
    },
    getYesVotes: () => votes.filter((v) => v.vote === "yes").map((v) => v.startup_local_id),
  };
}
