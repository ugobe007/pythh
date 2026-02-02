import { supabase } from "./supabase";
import { logActivity } from "./activityLogger";
import startupData from "../data/startupData";
import { getAnonUserId } from "./anonUser";

export type VoteType = "yes" | "no";

export interface Vote {
  id?: string;
  startup_id: string;       // local startup id (startupData.id)
  user_id: string;          // uuid string (anon or auth)
  vote: VoteType;           // SSOT: votes.vote
  created_at?: string;      // SSOT: votes.created_at
}

const LOCAL_VOTES_KEY = "user_votes";

/**
 * Save vote to both localStorage (cache) and Supabase (persistence)
 * SSOT: votes.vote, votes.user_id (uuid), votes.created_at, votes.metadata
 * Uniqueness: via index on (user_id, metadata->>'startup_local_id')
 */
export async function saveVote(
  startupId: string,
  voteType: VoteType,
  userId: string | null = null
): Promise<{ success: boolean; error?: string }> {
  try {
    const uid = userId ?? getAnonUserId();

    // 1) localStorage optimistic write
    const localVotes = getLocalVotes();
    const existingVoteIndex = localVotes.findIndex((v) => v.startup_id === startupId);

    const newVote: Vote = {
      startup_id: startupId,
      user_id: uid,
      vote: voteType,
      created_at: new Date().toISOString(),
    };

    if (existingVoteIndex >= 0) localVotes[existingVoteIndex] = newVote;
    else localVotes.push(newVote);

    localStorage.setItem(LOCAL_VOTES_KEY, JSON.stringify(localVotes));

    // 2) Supabase upsert (unique per user + startup_local_id expression)
    const { data, error } = await supabase
      .from("votes")
      .upsert(
        {
          user_id: uid,
          vote: voteType,
          weight: 1.0,
          metadata: { startup_local_id: startupId },
        },
        { onConflict: "user_id,metadata->>startup_local_id" }
      )
      .select("id, vote, created_at, metadata, user_id");

    if (error) {
      console.warn("⚠️ Supabase vote upsert failed (local only):", error.message);
      return { success: true };
    }

    // 3) Log activity (best-effort)
    try {
      const startup = startupData.find((s) => s.id.toString() === startupId);
      await logActivity({
        eventType: "user_voted",
        startupId,
        startupName: startup?.name,
        userId: uid,
        voteType,
        metadata: { startupName: startup?.name || "Unknown Startup" },
      });
    } catch {
      // ignore
    }

    return { success: true };
  } catch (error: any) {
    console.error("❌ Error saving vote:", error);
    return { success: false, error: error.message };
  }
}

export function getLocalVotes(): Vote[] {
  try {
    const votes = localStorage.getItem(LOCAL_VOTES_KEY);
    return votes ? JSON.parse(votes) : [];
  } catch {
    return [];
  }
}

export function hasVoted(startupId: string): VoteType | null {
  const votes = getLocalVotes();
  const v = votes.find((x) => x.startup_id === startupId);
  return v ? v.vote : null;
}

export function getYesVotes(): string[] {
  const votes = getLocalVotes();
  return votes.filter((v) => v.vote === "yes").map((v) => v.startup_id);
}

export async function syncVotesFromSupabase(userId: string): Promise<void> {
  try {
    const { data, error } = await supabase
      .from("votes")
      .select("id, vote, created_at, metadata, user_id")
      .eq("user_id", userId);

    if (error || !data?.length) return;

    const supabaseVotes: Vote[] = data
      .map((row: any) => {
        const startupLocalId = row?.metadata?.startup_local_id;
        if (!startupLocalId) return null;
        return {
          id: row.id,
          startup_id: String(startupLocalId),
          user_id: String(row.user_id),
          vote: row.vote as VoteType,
          created_at: row.created_at,
        };
      })
      .filter(Boolean);

    const localVotes = getLocalVotes();
    const merged = [...supabaseVotes];

    localVotes.forEach((lv) => {
      if (!supabaseVotes.find((sv) => sv.startup_id === lv.startup_id)) merged.push(lv);
    });

    localStorage.setItem(LOCAL_VOTES_KEY, JSON.stringify(merged));
  } catch {
    // ignore
  }
}

export async function getVoteCounts(startupId: string): Promise<{ yes: number; no: number }> {
  try {
    const { data, error } = await supabase
      .from("votes")
      .select("vote, metadata")
      .contains("metadata", { startup_local_id: startupId });

    if (error || !data) return { yes: 0, no: 0 };

    const yes = data.filter((r: any) => r.vote === "yes").length;
    const no = data.filter((r: any) => r.vote === "no").length;
    return { yes, no };
  } catch {
    return { yes: 0, no: 0 };
  }
}
