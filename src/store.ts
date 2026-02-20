// src/store.ts

import { StartupComponent, StoreState } from './types';
import { Startup } from './lib/database.types';
import { adaptStartupForComponent } from './utils/startupAdapters';
import { create } from 'zustand';
import { persist, StateStorage } from 'zustand/middleware';
import { getStartupUploads } from './lib/investorService';
import { supabase } from './lib/supabase';
import startupData from './data/startupData';

// Function to load approved startups from Supabase with pagination
export async function loadApprovedStartups(limit: number = 50, offset: number = 0): Promise<StartupComponent[]> {
  try {
    // Get total count first to calculate random offset
    const { count } = await supabase
      .from('startup_uploads')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved');
    
    // Use random offset if not specified (offset=0 means "random")
    const totalStartups = count || 500;
    const randomOffset = offset === 0 ? Math.floor(Math.random() * Math.max(0, totalStartups - limit)) : offset;
    
    console.log('\n' + '='.repeat(80));
    console.log(`📊 FETCHING STARTUPS FROM SUPABASE`);
    console.log(`   Query: startup_uploads WHERE status='approved'`);
    console.log(`   Total available: ${totalStartups}, Random offset: ${randomOffset}, Limit: ${limit}`);
    console.log('='.repeat(80));
    
    // Load approved ones with randomized pagination
    const { data, error } = await supabase
      .from('startup_uploads')
      .select('*')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .range(randomOffset, randomOffset + limit - 1);
    
    // SSOT: Supabase is the single source of truth - no fallback to static data
    if (error) {
      console.error('❌ SUPABASE ERROR:', error.message);
      console.error('💡 SSOT: All data must come from Supabase. Please check database connection.');
      return []; // Return empty array - let UI handle empty state
    }
    
    if (!data || data.length === 0) {
      console.warn('⚠️ SUPABASE RETURNED EMPTY - startup_uploads table has 0 approved startups');
      console.warn('💡 SSOT: No fallback data. Please populate startup_uploads table in Supabase.');
      return []; // Return empty array - let UI handle empty state
    }

    console.log('✅ SUCCESS: Loaded ' + data.length + ' startups FROM SUPABASE');
    console.log('📊 Startup IDs are UUIDs:', data.length > 0);
    
    // 🔥 DEBUG: Check raw data from database
    if (data && data.length > 0) {
      console.log('🔥 FIRST STARTUP FROM DB:', data[0].name, 'GOD SCORE:', data[0].total_god_score);
      console.log('🔥 RAW UPLOAD OBJECT:', {
        id: data[0].id,
        name: data[0].name,
        status: data[0].status,
        total_god_score: data[0].total_god_score,
        typeof_score: typeof data[0].total_god_score
      });
    }
    console.log('='.repeat(80) + '\n');

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
      
      // DEBUG: Log first 3 startups with detailed info INCLUDING GOD SCORES
      if (index < 3) {
        console.log(`\n📦 Startup #${index + 1}: ${startupWithVotes.name}`);
        console.log(`   🎯 GOD SCORES FROM DATABASE:`);
        console.log(`      total_god_score: ${upload.total_god_score} → ${startupWithVotes.total_god_score}`);
        console.log(`      team_score: ${upload.team_score}`);
        console.log(`      traction_score: ${upload.traction_score}`);
        console.log(`      market_score: ${upload.market_score}`);
        console.log(`      product_score: ${upload.product_score}`);
        console.log(`      vision_score: ${upload.vision_score}`);
        const extractedData = (upload.extracted_data as any) || {};
        console.log(`   extracted_data keys:`, Object.keys(extractedData));
        console.log(`   fivePoints (${startupWithVotes.fivePoints?.length || 0} items):`, startupWithVotes.fivePoints);
        console.log(`   industries:`, startupWithVotes.industries);
      }
      
      return startupWithVotes;
    });
    
    return converted;
  } catch (err) {
    console.error('💥 Failed to load approved startups, using local data:', err);
    // Fall back to local data on exception - cast to StartupComponent[]
    const start = offset;
    const end = offset + limit;
    return startupData.slice(start, end) as unknown as StartupComponent[];
  }
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
        // SSOT: Only load from Supabase — no local data mixing
        const approvedStartups = await loadApprovedStartups();
        if (approvedStartups.length > 0) {
          set({ startups: approvedStartups });
        } else {
          console.warn('loadStartupsFromDatabase: DB returned 0 startups — keeping existing state');
        }
      },
    }),
    {
      name: 'hot-money-honey-store',
    }
  )
);

