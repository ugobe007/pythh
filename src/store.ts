// src/store.ts

import { StartupComponent, StoreState } from './types';
import { Startup } from './lib/database.types';
import { adaptStartupForComponent } from './utils/startupAdapters';
import { create } from 'zustand';
import { persist, StateStorage } from 'zustand/middleware';
import { getStartupUploads } from './lib/investorService';
import { supabase } from './lib/supabase';
import startupData from './data/startupData';

// ── Single-flight guard: prevents duplicate concurrent fetches ───────────────
let startupsInFlight: Promise<StartupComponent[]> | null = null;
let startupsLoadedAt: number | null = null;
const STARTUP_CACHE_MS = 60_000; // 1 minute

// Session-stable random offset — picked once per tab, reused for the cache window
function getSessionOffset(total: number, limit: number): number {
  const key = 'startup_offset_seed';
  const cached = sessionStorage.getItem(key);
  if (cached !== null) return Number(cached);
  const offset = Math.floor(Math.random() * Math.max(0, total - limit));
  sessionStorage.setItem(key, String(offset));
  return offset;
}

// Function to load approved startups from Supabase with pagination
export async function loadApprovedStartups(limit: number = 50, offset: number = 0): Promise<StartupComponent[]> {
  // Single-flight: if a fetch is already running, wait for it
  if (startupsInFlight) {
    return startupsInFlight;
  }

  // Cache: if loaded recently, skip the network entirely
  if (startupsLoadedAt && Date.now() - startupsLoadedAt < STARTUP_CACHE_MS) {
    return []; // caller checks store state directly; returning [] skips the set()
  }

  startupsInFlight = (async (): Promise<StartupComponent[]> => {
  try {
    // Get total count first to calculate stable session offset
    const { count } = await supabase
      .from('startup_uploads')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved');
    
    const totalStartups = count || 500;
    // Use session-stable offset so repeated calls don't re-scramble results
    const resolvedOffset = offset === 0 ? getSessionOffset(totalStartups, limit) : offset;
    
    if (import.meta.env.DEV) {
      console.log(`[store] loadApprovedStartups: total=${totalStartups} offset=${resolvedOffset} limit=${limit}`);
    }
    
    // Load approved startups with stable pagination
    const { data, error } = await supabase
      .from('startup_uploads')
      .select('*')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .range(resolvedOffset, resolvedOffset + limit - 1);
    
    if (error) {
      console.error('[store] Supabase error:', error.message);
      return [];
    }
    
    if (!data || data.length === 0) {
      console.warn('[store] startup_uploads returned 0 approved rows');
      return [];
    }

    if (import.meta.env.DEV) {
      console.log(`[store] loaded ${data.length} startups, first: ${data[0].name}`);
    }

    // Convert database Startup to component format using adapter
    const converted = data.map((upload: Startup, index: number) => {
      // Use adapter to convert database type to component type
      const componentStartup = adaptStartupForComponent(upload);
      
      // Add vote data if available (not in database schema yet)
      const yesVotes = (upload as any).yes_votes || 0;
      const noVotes = (upload as any).no_votes || 0;
      const totalVotes = yesVotes + noVotes;
      let calculatedHotness = componentStartup.hotness;
      if (!calculatedHotness && totalVotes > 0) {
        const voteRatio = yesVotes / totalVotes;
        calculatedHotness = voteRatio * 10; // 0-10 scale
      }
      
      // Merge vote data into component startup
      const startupWithVotes: StartupComponent = {
        ...componentStartup,
        yesVotes,
        noVotes,
        hotness: calculatedHotness || componentStartup.hotness,
      };
      
      return startupWithVotes;
    });
    
    startupsLoadedAt = Date.now();
    return converted;
  } catch (err) {
    console.error('[store] Failed to load approved startups:', err);
    return [];
  } finally {
    startupsInFlight = null;
  }
  })();

  return startupsInFlight;
}

export const useStore = create<StoreState>()(
  persist<StoreState>(
  (set, get) => ({
      unvote: (startup: StartupComponent) => {
        const state = get();
        // Remove from portfolio
        const newPortfolio = state.portfolio.filter((s: StartupComponent) => s.id !== startup.id);
        // Decrement yesVotes in startups
        const updatedStartups = state.startups.map((s: StartupComponent) =>
          s.id === startup.id ? { ...s, yesVotes: Math.max((s.yesVotes || 1) - 1, 0) } : s
        );
        set({
          startups: updatedStartups,
          portfolio: newPortfolio,
        });
      },
      startups: startupData.map((s, idx) => ({
        ...s,
        id: idx,
        yesVotes: 0,
      })) as unknown as StartupComponent[],
      currentIndex: 0,
      portfolio: [],
      voteYes: (startup: StartupComponent) => {
        const state = get();
        console.log('voteYes called for:', startup.name, 'Current portfolio:', state.portfolio);
        const updatedStartups = [...state.startups];
        const index = updatedStartups.findIndex(s => s.id === startup.id);
        let updatedStartup = startup;
        if (index !== -1) {
          updatedStartups[index].yesVotes = (updatedStartups[index].yesVotes || 0) + 1;
          updatedStartup = { ...updatedStartups[index] };
        }
        // Only add to portfolio if not already present
        const alreadyInPortfolio = state.portfolio.some((s: StartupComponent) => s.id === updatedStartup.id);
        const newPortfolio = alreadyInPortfolio
          ? state.portfolio.map((s: StartupComponent) => s.id === updatedStartup.id ? updatedStartup : s)
          : [...state.portfolio, updatedStartup];
        
        console.log('New portfolio will be:', newPortfolio);
        
        // Save YES votes to localStorage for Dashboard
        const myYesVotes = JSON.parse(localStorage.getItem('myYesVotes') || '[]');
        const startupIdStr = updatedStartup.id.toString();
        if (!myYesVotes.includes(startupIdStr)) {
          myYesVotes.push(startupIdStr);
          localStorage.setItem('myYesVotes', JSON.stringify(myYesVotes));
        }
        
        // Also save to votedStartups
        const votedStartups = JSON.parse(localStorage.getItem('votedStartups') || '[]');
        if (!votedStartups.includes(startupIdStr)) {
          votedStartups.push(startupIdStr);
          localStorage.setItem('votedStartups', JSON.stringify(votedStartups));
        }
        
        set({
          startups: updatedStartups,
          portfolio: newPortfolio,
          currentIndex: state.currentIndex + 1,
        });
      },
      voteNo: () => {
        set((state) => ({
          currentIndex: state.currentIndex + 1,
        }));
      },
      rateStartup: (index: number, rating: number) => {
        set((state) => {
          const updated = [...state.portfolio];
          if (updated[index]) {
            updated[index].rating = rating;
          }
          return { portfolio: updated };
        });
      },
      resetVoting: () => {
        set((state) => ({
          currentIndex: 0,
        }));
      },
      loadStartupsFromDatabase: async () => {
        const approvedStartups = await loadApprovedStartups();
        if (approvedStartups.length > 0) {
          set({ startups: approvedStartups });
        }
      },
    }),
    {
      name: 'hot-money-honey-store',
    }
  )
);

