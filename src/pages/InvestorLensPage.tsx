/**
 * INVESTOR LENS PAGE
 * ==================
 * Deep-dive into how a specific investor decides.
 * 
 * This is the crown jewel — showing founders:
 * - What signals this investor responds to
 * - Why they're aligned with this investor
 * - How founders typically reach this investor
 * - Best timing and preparation
 */

import { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import BrandMark from '../components/BrandMark';
import { 
  InvestorLensPanel,
  generateInvestorLensData,
  type InvestorLensData,
  type InvestorData,
  type StartupContext
} from '../components/investor';

export default function InvestorLensPage() {
  const { id: investorId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const startupId = searchParams.get('startup');
  const returnUrl = searchParams.get('return') || '/discovery';
  
  // States
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lensData, setLensData] = useState<InvestorLensData | null>(null);
  const [isTracking, setIsTracking] = useState(false);

  // Fetch investor and startup data
  useEffect(() => {
    if (!investorId) {
      setError('No investor specified');
      setIsLoading(false);
      return;
    }

    async function fetchData() {
      try {
        // Fetch investor data
        const { data: investor, error: investorError } = await supabase
          .from('investors')
          .select('*')
          .eq('id', investorId!)
          .single();

        if (investorError || !investor) {
          setError('Investor not found');
          setIsLoading(false);
          return;
        }

        // Build investor data object
        const investorData: InvestorData = {
          id: investor.id,
          name: investor.name,
          firm: investor.firm || undefined,
          title: investor.title || undefined,
          sectors: investor.sectors || [],
          stage: Array.isArray(investor.stage) ? investor.stage[0] : (investor.stage || 'Seed'),
          check_size_min: investor.check_size_min || undefined,
          check_size_max: investor.check_size_max || undefined,
          investment_thesis: investor.investment_thesis || undefined,
        };

        // Fetch startup context if provided
        let startupContext: StartupContext = {
          sectors: [],
          stage: 'seed',
          total_god_score: 50,
        };

        if (startupId) {
          const { data: startup } = await supabase
            .from('startup_uploads')
            .select('*')
            .eq('id', startupId)
            .single();

          if (startup) {
            startupContext = {
              sectors: startup.sectors || [],
              stage: String(startup.stage || 'seed'),
              total_god_score: startup.total_god_score ?? undefined,
              team_score: startup.team_score ?? undefined,
              traction_score: startup.traction_score ?? undefined,
              market_score: startup.market_score ?? undefined,
              product_score: startup.product_score ?? undefined,
            };
          }
        }

        // Generate lens data
        const data = generateInvestorLensData(investorData, startupContext);
        setLensData(data);
        setIsLoading(false);
      } catch (err) {
        console.error('Error fetching investor lens data:', err);
        setError('Failed to load investor data');
        setIsLoading(false);
      }
    }

    fetchData();
  }, [investorId, startupId]);

  // Handle tracking
  const handleTrackAlignment = () => {
    setIsTracking(true);
    // TODO: Implement actual tracking (save to watchlist/preferences)
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading investor lens...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !lensData) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-gray-400 mb-4">{error || 'Something went wrong'}</p>
          <Link 
            to={returnUrl} 
            className="text-amber-400 hover:text-amber-300 transition-colors"
          >
            ← Go back
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Background subtle gradient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-amber-500/3 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0a0a0a]/80 backdrop-blur-sm border-b border-gray-800/50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BrandMark />
            <span className="text-gray-600">/</span>
            <span className="text-gray-400 text-sm">Investor Lens</span>
          </div>
          
          <Link
            to={returnUrl}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to alignment
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 max-w-4xl mx-auto px-6 py-12">
        <InvestorLensPanel 
          data={lensData}
          startupId={startupId || undefined}
          onTrackAlignment={handleTrackAlignment}
          isTracking={isTracking}
        />
      </main>

      {/* Footer */}
      <footer className="relative z-10 max-w-4xl mx-auto px-6 py-8 border-t border-gray-800/50">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <p>Pythh — Investor signals that matter</p>
          <div className="flex items-center gap-4">
            <Link to="/how-it-works" className="hover:text-gray-400 transition-colors">
              How it works
            </Link>
            <Link to="/pricing" className="hover:text-gray-400 transition-colors">
              Pricing
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
