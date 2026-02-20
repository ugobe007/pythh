import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Sparkles, Save, RotateCcw, AlertTriangle, CheckCircle, 
  TrendingUp, TrendingDown, ArrowRight, RefreshCw, Settings,
  Brain, Info, BarChart3, Eye, CheckCircle2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { API_BASE } from '../lib/apiConfig';
import LogoDropdownMenu from '../components/LogoDropdownMenu';

interface GODWeights {
  team: number;
  traction: number;
  market: number;
  product: number;
  vision: number;
  ecosystem: number;
  grit: number;
  problemValidation: number;
}

interface WeightHistory {
  id: string;
  changed_at: string;
  changed_by: string;
  old_weights: GODWeights;
  new_weights: GODWeights;
  reason?: string;
}

const DEFAULT_WEIGHTS: GODWeights = {
  team: 3.0,
  traction: 3.0,
  market: 2.0,
  product: 2.0,
  vision: 2.0,
  ecosystem: 1.5,
  grit: 1.5,
  problemValidation: 2.0
};

interface MLRecommendation {
  id: string;
  title: string;
  description: string;
  current_value: any;
  proposed_value: any;      // mapped from recommended_weights
  expected_impact: string;
  confidence_score?: number;
  recommendation_type?: string;
  priority?: string;
  created_at?: string;
}

interface ImpactPrediction {
  avgScoreChange: number;
  highScoreCountChange: number;
  trend: 'up' | 'down' | 'neutral';
  affectedComponents: string[];
}

export default function GODSettingsPage() {
  const navigate = useNavigate();
  const [weights, setWeights] = useState<GODWeights>(DEFAULT_WEIGHTS);
  const [originalWeights, setOriginalWeights] = useState<GODWeights>(DEFAULT_WEIGHTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<WeightHistory[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [mlRecommendations, setMlRecommendations] = useState<MLRecommendation[]>([]);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [impactPrediction, setImpactPrediction] = useState<ImpactPrediction | null>(null);
  const [showMLRecommendations, setShowMLRecommendations] = useState(false);
  const [showDeviations, setShowDeviations] = useState(false);
  const [deviations, setDeviations] = useState<any[]>([]);
  const [trainingStatus, setTrainingStatus] = useState<'idle' | 'running' | 'complete'>('idle');

  useEffect(() => {
    loadWeights();
    loadHistory();
    loadMLRecommendations();
    
    // Check if we came from deviation alert
    if (location.state?.showDeviations && location.state?.deviations) {
      setShowDeviations(true);
      setDeviations(location.state.deviations);
      setShowMLRecommendations(true); // Auto-show ML recommendations when coming from deviations
    }
  }, [location.state]);

  // Calculate impact prediction when weights change
  useEffect(() => {
    if (hasChanges) {
      calculateImpactPrediction();
    } else {
      setImpactPrediction(null);
    }
  }, [weights, hasChanges]);

  const loadWeights = async () => {
    setLoading(true);
    try {
      // Try to load from database (algorithm_weight_history or config table)
      // For now, use localStorage with fallback to defaults
      const savedWeights = localStorage.getItem('god_algorithm_weights');
      if (savedWeights) {
        const parsed = JSON.parse(savedWeights);
        setWeights(parsed);
        setOriginalWeights(parsed);
      } else {
        setWeights(DEFAULT_WEIGHTS);
        setOriginalWeights(DEFAULT_WEIGHTS);
      }
    } catch (error) {
      console.error('Error loading weights:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      // Load from algorithm_weight_history table if it exists
      const { data, error } = await supabase
        .from('algorithm_weight_history')
        .select('*')
        .order('applied_at', { ascending: false })
        .limit(20);

      if (!error && data) {
        setHistory(data.map((h: any) => ({
          id: h.id,
          changed_at: h.applied_at,
          changed_by: h.applied_by || 'system',
          old_weights: h.weight_updates?.[0]?.old_weight || DEFAULT_WEIGHTS,
          new_weights: h.weight_updates?.[0]?.new_weight || DEFAULT_WEIGHTS,
          reason: h.reason
        })));
      }
    } catch (error) {
      console.error('Error loading history:', error);
    }
  };

  const [refreshingRecommendations, setRefreshingRecommendations] = useState(false);

  const loadMLRecommendations = async () => {
    setRefreshingRecommendations(true);
    try {
      console.log('🔍 Loading ML recommendations...');
      // Load ALL pending recommendations (not filtering by type since run-ml-training.js creates 'weight_change')
      const { data, error } = await supabase
        .from('ml_recommendations')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('❌ Error loading ML recommendations:', error);
        alert(`⚠️ Error loading recommendations: ${error.message}`);
        return;
      }

      console.log(`✅ Loaded ${data?.length || 0} ML recommendations:`, data);
      
      if (data && data.length > 0) {
        const mappedRecs = data.map((rec: any) => ({
          id: rec.id,
          // Generate title from recommendation_type since no title column exists
          title: rec.recommendation_type === 'component_weight_adjustment'
            ? 'Component Weight Adjustment'
            : rec.recommendation_type?.replace(/_/g, ' ')?.replace(/\b\w/g, (c: string) => c.toUpperCase()) || 'Algorithm Optimization',
          // Generate description from reasoning array
          description: Array.isArray(rec.reasoning) ? rec.reasoning.slice(0, 2).join(' ') : (rec.description || ''),
          current_value: rec.current_weights,          // correct column: current_weights
          proposed_value: rec.recommended_weights,     // correct column: recommended_weights
          expected_impact: rec.expected_improvement != null
            ? `+${Number(rec.expected_improvement).toFixed(1)}% expected improvement`
            : 'Estimated improvement to match quality',
          confidence_score: rec.confidence,            // correct column: confidence
          recommendation_type: rec.recommendation_type,
          priority: rec.confidence >= 0.9 ? 'high' : rec.confidence >= 0.7 ? 'medium' : 'low',
          created_at: rec.created_at
        }));
        setMlRecommendations(mappedRecs);
        setShowMLRecommendations(true); // Auto-show when recommendations are found
        console.log(`✅ Found ${mappedRecs.length} ML recommendation(s)`);
      } else {
        console.log('ℹ️ No ML recommendations found in database');
        setMlRecommendations([]);
        setShowMLRecommendations(false);
      }
    } catch (error: any) {
      console.error('❌ Error loading ML recommendations:', error);
      alert(`❌ Error: ${error.message}`);
    } finally {
      setRefreshingRecommendations(false);
    }
  };

  const runMLTraining = async () => {
    console.log('🚀 runMLTraining called, API_BASE:', API_BASE);
    
    if (!confirm('Run ML Training?\n\nThis will analyze match data and deviations to generate optimization recommendations.\n\nTraining runs in the background and may take a few minutes.')) {
      console.log('❌ User cancelled ML training');
      return;
    }

    console.log('✅ User confirmed, starting ML training...');
    
    try {
      setTrainingStatus('running');
      
      // First check if server is running
      try {
        console.log(`🔍 Checking server health at: ${API_BASE}/api/health`);
        const healthCheck = await fetch(`${API_BASE}/api/health`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000) // 5 second timeout
        }).catch((healthFetchError) => {
          console.error('❌ Health check fetch error:', healthFetchError);
          throw new Error(`Cannot connect to server at ${API_BASE}.\n\nError: ${healthFetchError.message}\n\nPlease check:\n1. Server is running: curl ${API_BASE}/api/health\n2. CORS is enabled in server/index.js\n3. Server is accessible from browser`);
        });
        
        if (!healthCheck.ok) {
          const healthText = await healthCheck.text();
          throw new Error(`Server returned status ${healthCheck.status}: ${healthText}`);
        }
        
        const healthData = await healthCheck.json();
        console.log('✅ Server health check passed:', healthData);
      } catch (healthError: any) {
        console.error('❌ Health check failed:', healthError);
        throw healthError;
      }
      
      console.log(`🔍 Calling ML training API: ${API_BASE}/api/ml/training/run`);
      console.log(`📍 Current URL: ${window.location.href}`);
      console.log(`🌐 API Base: ${API_BASE}`);
      
      // Test with a simple fetch first to see what error we get
      try {
        const testResponse = await fetch(`${API_BASE}/api/health`, {
          method: 'GET',
          mode: 'cors',
        });
        console.log('✅ Health check from browser:', await testResponse.json());
      } catch (testError: any) {
        console.error('❌ Health check failed from browser:', testError);
        throw new Error(`Cannot connect to server from browser.\n\nServer URL: ${API_BASE}\n\nError: ${testError.message}\n\nPossible causes:\n1. CORS not properly configured\n2. Browser blocking the request\n3. Network/firewall issue\n\nTry: curl ${API_BASE}/api/health (if this works, it's a browser/CORS issue)`);
      }
      
      const response = await fetch(`${API_BASE}/api/ml/training/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        mode: 'cors',
        signal: AbortSignal.timeout(30000) // 30 second timeout for the request
      }).catch((fetchError) => {
        console.error('❌ Fetch error details:', fetchError);
        console.error('❌ Error name:', fetchError.name);
        console.error('❌ Error message:', fetchError.message);
        console.error('❌ Error stack:', fetchError.stack);
        // Network error or CORS issue
        if (fetchError.name === 'TypeError' || fetchError.message.includes('fetch') || fetchError.message.includes('Load failed')) {
          throw new Error(`Network/CORS error: Cannot connect to ${API_BASE}.\n\nThis usually means:\n1. CORS is blocking the request\n2. Browser security is blocking it\n3. Server is not accessible\n\nTest with: curl ${API_BASE}/api/health`);
        }
        throw fetchError;
      });

      console.log(`📡 Response status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        let errorMessage = `Server returned status ${response.status}`;
        let errorDetails = '';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
          errorDetails = errorData.details ? `\n\nDetails: ${errorData.details}` : '';
          console.error('❌ Server error response:', errorData);
        } catch (parseError) {
          // If response isn't JSON, try to get text
          try {
            const text = await response.text();
            errorDetails = text ? `\n\nResponse: ${text.substring(0, 200)}` : '';
            console.error('❌ Server error response (non-JSON):', text);
          } catch {
            errorMessage = response.statusText || errorMessage;
          }
        }
        throw new Error(`${errorMessage}${errorDetails}`);
      }

      const result = await response.json();
      console.log('✅ ML training response:', result);
      
      alert(`✅ ML Training Started!\n\n${result.message || 'Training is running in the background.'}\n\nWhat happens next:\n1. Training analyzes match outcomes and deviations\n2. Extracts success patterns\n3. Generates optimization recommendations\n4. Recommendations will appear here when ready\n\n💡 Tip: Click "Refresh Recommendations" in a few minutes to see the results.`);
      
      setTrainingStatus('complete');
      
      // Refresh recommendations after a delay to check for new ones
      setTimeout(() => {
        loadMLRecommendations();
      }, 5000); // Wait 5 seconds before checking
      
    } catch (error: any) {
      console.error('Error running ML training:', error);
      setTrainingStatus('idle');
      
      let errorMessage = error.message || 'Unknown error occurred';
      
      // Check if it's a network/connection error
      if (error.name === 'AbortError' || error.message.includes('fetch') || error.message.includes('Failed to fetch') || errorMessage.includes('Load failed') || errorMessage.includes('network') || errorMessage.includes('Cannot connect')) {
        errorMessage = `⚠️ Server Not Running\n\nThe API server at ${API_BASE} is not responding.\n\nPlease start the server first:\n\n  1. Open a new terminal\n  2. Run: cd server && node index.js\n  3. Wait for: "✅ Server is running on http://localhost:3002"\n  4. Then try again\n\nAlternatively, run training manually:\n  node run-ml-training.js`;
      }
      
      alert(`❌ Failed to start ML training\n\n${errorMessage}`);
    }
  };

  const acceptMLRecommendation = async (rec: MLRecommendation) => {
    if (!confirm(`Accept this ML recommendation?\n\n${rec.title}\n\n${rec.description}\n\nExpected Impact: ${rec.expected_impact}\n\nThis will update the GOD algorithm weights automatically.`)) {
      return;
    }

    try {
      // First check if server is reachable
      try {
        const healthCheck = await fetch(`${API_BASE}/api/health`, { 
          method: 'GET',
          signal: AbortSignal.timeout(5000) // 5 second timeout
        });
        if (!healthCheck.ok) {
          throw new Error(`Server health check failed: ${healthCheck.status} ${healthCheck.statusText}`);
        }
      } catch (healthError: any) {
        if (healthError.name === 'AbortError' || healthError.message.includes('Failed to fetch') || healthError.message.includes('Load failed')) {
          throw new Error(`Cannot connect to server at ${API_BASE}.\n\nPlease ensure the backend server is running:\n  cd server && node index.js\n\nIf the server is running, check:\n  1. Server is on port 3002\n  2. CORS is enabled\n  3. No firewall blocking the connection`);
        }
        throw healthError;
      }
      
      const response = await fetch(`${API_BASE}/api/ml/recommendations/${rec.id}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'admin' // TODO: Get from auth context
        }),
        signal: AbortSignal.timeout(30000) // 30 second timeout for the actual request
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: `HTTP ${response.status}: ${response.statusText}` }));
        throw new Error(error.message || error.error || 'Failed to apply recommendation');
      }

      // If recommendation has proposed_value with weights, apply them to the UI
      if (rec.proposed_value && typeof rec.proposed_value === 'object') {
        const newWeights = { ...weights };
        let hasChanges = false;
        
        Object.keys(rec.proposed_value).forEach((key) => {
          if (key in DEFAULT_WEIGHTS && rec.proposed_value[key] !== undefined) {
            newWeights[key as keyof GODWeights] = rec.proposed_value[key];
            hasChanges = true;
          }
        });

        if (hasChanges) {
          setWeights(newWeights);
          setHasChanges(JSON.stringify(newWeights) !== JSON.stringify(originalWeights));
          // Save to localStorage immediately
          localStorage.setItem('god_algorithm_weights', JSON.stringify(newWeights));
        }
      }

      // Reload recommendations to update status
      await loadMLRecommendations();
      await loadWeights(); // Reload weights to reflect changes
      await loadHistory(); // Reload history to show the change

      alert('✅ ML Recommendation accepted! Algorithm weights have been updated.');
    } catch (error: any) {
      console.error('Error accepting recommendation:', error);
      alert(`❌ Failed to accept recommendation: ${error.message}`);
    }
  };

  const calculateImpactPrediction = async () => {
    try {
      // Get sample startups to predict impact
      const { data: startups } = await supabase
        .from('startup_uploads')
        .select('team_score, traction_score, market_score, product_score, vision_score, total_god_score')
        .eq('status', 'approved')
        .not('total_god_score', 'is', null)
        .limit(100);

      if (!startups || startups.length === 0) {
        setImpactPrediction({
          avgScoreChange: 0,
          highScoreCountChange: 0,
          trend: 'neutral',
          affectedComponents: []
        });
        return;
      }

      // Calculate average score change
      let totalChange = 0;
      let highScoreIncrease = 0;
      const affectedComponents: string[] = [];

      startups.forEach((startup: any) => {
        // Calculate old score
        const oldScore = (startup.team_score * originalWeights.team +
                         startup.traction_score * originalWeights.traction +
                         startup.market_score * originalWeights.market +
                         startup.product_score * originalWeights.product +
                         startup.vision_score * originalWeights.vision) / 
                        (originalWeights.team + originalWeights.traction + originalWeights.market + 
                         originalWeights.product + originalWeights.vision) * 10;

        // Calculate new score
        const newScore = (startup.team_score * weights.team +
                         startup.traction_score * weights.traction +
                         startup.market_score * weights.market +
                         startup.product_score * weights.product +
                         startup.vision_score * weights.vision) / 
                        (weights.team + weights.traction + weights.market + 
                         weights.product + weights.vision) * 10;

        const change = newScore - oldScore;
        totalChange += change;

        if (newScore >= 80 && oldScore < 80) {
          highScoreIncrease++;
        }
      });

      const avgChange = totalChange / startups.length;
      
      // Determine which components changed
      Object.keys(weights).forEach(key => {
        if (weights[key as keyof GODWeights] !== originalWeights[key as keyof GODWeights]) {
          affectedComponents.push(key);
        }
      });

      setImpactPrediction({
        avgScoreChange: avgChange,
        highScoreCountChange: highScoreIncrease,
        trend: avgChange > 0.5 ? 'up' : avgChange < -0.5 ? 'down' : 'neutral',
        affectedComponents
      });
    } catch (error) {
      console.error('Error calculating impact:', error);
    }
  };

  const updateWeight = (component: keyof GODWeights, value: number) => {
    const newWeights = { ...weights, [component]: Math.max(0, Math.min(10, value)) };
    setWeights(newWeights);
    setHasChanges(JSON.stringify(newWeights) !== JSON.stringify(originalWeights));
  };

  const saveWeights = async () => {
    // Show confirmation modal with impact prediction
    setShowConfirmation(true);
  };

  const confirmSaveWeights = async () => {
    setShowConfirmation(false);
    setSaving(true);
    
    try {
      // Save to Supabase first (algorithm_weight_history table)
      const { error: dbError } = await supabase
        .from('algorithm_weight_history')
        .insert({
          applied_at: new Date().toISOString(),
          applied_by: 'admin',
          weight_updates: [{
            component: 'all',
            old_weight: originalWeights,
            new_weight: weights,
            reason: `Manual adjustment via GOD Settings page. Expected impact: ${impactPrediction?.trend === 'up' ? 'Scores trending UP' : impactPrediction?.trend === 'down' ? 'Scores trending DOWN' : 'Minimal change'}`
          }],
          reason: `Manual weight adjustment - ${impactPrediction?.affectedComponents.join(', ')} modified`
        });

      // Always save to localStorage as primary storage
      localStorage.setItem('god_algorithm_weights', JSON.stringify(weights));
      localStorage.setItem('god_weights_last_updated', new Date().toISOString());
      localStorage.setItem('god_weights_last_change', JSON.stringify({
        timestamp: new Date().toISOString(),
        old_weights: originalWeights,
        new_weights: weights,
        impact: impactPrediction
      }));

      setOriginalWeights(weights);
      setHasChanges(false);
      setImpactPrediction(null);
      
      const message = dbError 
        ? '✅ GOD Algorithm weights saved to local storage! (Database history unavailable)'
        : '✅ GOD Algorithm weights saved successfully! Changes will be applied to new score calculations.';
      
      alert(message);
      
      await loadHistory();
    } catch (error: any) {
      console.error('Error saving weights:', error);
      // Fallback to localStorage if everything fails
      localStorage.setItem('god_algorithm_weights', JSON.stringify(weights));
      localStorage.setItem('god_weights_last_updated', new Date().toISOString());
      setOriginalWeights(weights);
      setHasChanges(false);
      alert('✅ GOD Algorithm weights saved to local storage!');
    } finally {
      setSaving(false);
    }
  };

  const resetWeights = () => {
    if (confirm('Reset all weights to defaults? This will discard your changes.')) {
      setWeights(DEFAULT_WEIGHTS);
      setHasChanges(JSON.stringify(DEFAULT_WEIGHTS) !== JSON.stringify(originalWeights));
    }
  };

  const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);

  const WeightSlider = ({ 
    label, 
    component, 
    value, 
    description 
  }: { 
    label: string; 
    component: keyof GODWeights; 
    value: number;
    description: string;
  }) => (
    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white mb-1">{label}</h3>
          <p className="text-sm text-slate-400">{description}</p>
        </div>
        <div className="text-2xl font-bold bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
          {value.toFixed(1)}
        </div>
      </div>
      
      <input
        type="range"
        min="0"
        max="10"
        step="0.1"
        value={value}
        onChange={(e) => updateWeight(component, parseFloat(e.target.value))}
        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
      />
      
      <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
        <span>0</span>
        <span className="text-orange-400 font-semibold">Weight: {value.toFixed(1)}</span>
        <span>10</span>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0f0729] via-[#1a0f3a] to-[#2d1558] flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-orange-400 animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Loading GOD settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0729] via-[#1a0f3a] to-[#2d1558] text-white">
      <LogoDropdownMenu />
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent mb-2 flex items-center gap-3">
                GOD Algorithm Settings
              </h1>
              <p className="text-slate-400">Adjust component weights to fine-tune startup scoring</p>
            </div>
            
            <div className="flex items-center gap-3">
              {hasChanges && (
                <div className="flex items-center gap-2 px-3 py-1 bg-yellow-500/20 border border-yellow-500/30 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm text-yellow-400">Unsaved changes</span>
                </div>
              )}
              
              <button
                onClick={resetWeights}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </button>
              
              <button
                onClick={saveWeights}
                disabled={saving || !hasChanges}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-black font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Weights
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Total Weight Indicator */}
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-slate-400 mb-1">Total Weight</div>
                <div className="text-2xl font-bold text-white">{totalWeight.toFixed(1)}</div>
              </div>
              <div className={`px-4 py-2 rounded-lg ${
                totalWeight >= 17 && totalWeight <= 18 
                  ? 'bg-green-500/20 border border-green-500/30' 
                  : 'bg-yellow-500/20 border border-yellow-500/30'
              }`}>
                <div className="text-sm text-slate-400 mb-1">Status</div>
                <div className={`text-sm font-semibold ${
                  totalWeight >= 17 && totalWeight <= 18 ? 'text-green-400' : 'text-yellow-400'
                }`}>
                  {totalWeight >= 17 && totalWeight <= 18 ? '✅ Balanced' : '⚠️ Review recommended'}
                </div>
              </div>
            </div>
          </div>

          {/* Impact Prediction Banner */}
          {hasChanges && impactPrediction && (
            <div className={`mb-4 rounded-xl p-4 border-2 ${
              impactPrediction.trend === 'up' 
                ? 'bg-green-500/10 border-green-500/30' 
                : impactPrediction.trend === 'down'
                ? 'bg-red-500/10 border-red-500/30'
                : 'bg-blue-500/10 border-blue-500/30'
            }`}>
              <div className="flex items-start gap-3">
                {impactPrediction.trend === 'up' ? (
                  <TrendingUp className="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" />
                ) : impactPrediction.trend === 'down' ? (
                  <TrendingDown className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <BarChart3 className="w-6 h-6 text-blue-400 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <h3 className={`font-bold text-lg mb-2 ${
                    impactPrediction.trend === 'up' ? 'text-green-400' :
                    impactPrediction.trend === 'down' ? 'text-red-400' : 'text-blue-400'
                  }`}>
                    Predicted Impact: {impactPrediction.trend === 'up' ? 'Scores Trending UP ↑' :
                                     impactPrediction.trend === 'down' ? 'Scores Trending DOWN ↓' : 
                                     'Minimal Change →'}
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-400">Avg Score Change:</span>
                      <span className={`ml-2 font-semibold ${
                        impactPrediction.avgScoreChange > 0 ? 'text-green-400' :
                        impactPrediction.avgScoreChange < 0 ? 'text-red-400' : 'text-slate-300'
                      }`}>
                        {impactPrediction.avgScoreChange > 0 ? '+' : ''}
                        {impactPrediction.avgScoreChange.toFixed(1)} points
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">High Scores (80+):</span>
                      <span className={`ml-2 font-semibold ${
                        impactPrediction.highScoreCountChange > 0 ? 'text-green-400' : 'text-slate-300'
                      }`}>
                        {impactPrediction.highScoreCountChange > 0 ? '+' : ''}
                        {impactPrediction.highScoreCountChange} startups
                      </span>
                    </div>
                  </div>
                  {impactPrediction.affectedComponents.length > 0 && (
                    <div className="mt-2 text-xs text-slate-400">
                      Modified components: <span className="text-slate-300 font-medium">{impactPrediction.affectedComponents.join(', ')}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Deviations Alert Section - Always show if deviations exist */}
          {showDeviations && deviations.length > 0 && (
            <div className="mb-6 bg-orange-500/10 border-2 border-orange-500/50 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-6 h-6 text-orange-400" />
                  <div>
                    <h3 className="font-bold text-white text-lg">⚠️ Score Deviations Detected</h3>
                    <p className="text-sm text-slate-400 mt-1">
                      {deviations.length} startup(s) with significant score changes (≥10 points)
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-4 mb-4 border border-slate-700">
                <div className="flex items-start gap-3 mb-4">
                  <Info className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-white mb-2">What are GOD Score Deviations?</h4>
                    <p className="text-sm text-slate-300 mb-3">
                      Deviations are startups whose GOD scores changed significantly (≥10 points) recently. This could indicate:
                    </p>
                    <ul className="text-sm text-slate-400 space-y-1 list-disc list-inside mb-3">
                      <li><strong>Algorithm weight changes</strong> - Recent adjustments to GOD algorithm weights affecting all startups</li>
                      <li><strong>Data quality issues</strong> - Missing or incorrect data that was recently corrected</li>
                      <li><strong>Startup profile updates</strong> - New information added (funding, traction, team) affecting scoring</li>
                      <li><strong>Scoring logic updates</strong> - Changes to how scores are calculated</li>
                    </ul>
                  </div>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto mb-4">
                  <div className="text-xs text-slate-400 mb-2 font-semibold">Recent Deviations:</div>
                  {deviations.slice(0, 5).map((dev: any) => (
                    <div key={dev.startupId} className="flex items-center justify-between text-sm bg-slate-900/50 rounded p-2">
                      <span className="text-white font-medium">{dev.startupName}</span>
                      <span className={`font-bold ${
                        dev.change > 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {dev.change > 0 ? '+' : ''}{dev.change.toFixed(1)} ({dev.oldScore.toFixed(0)} → {dev.newScore.toFixed(0)})
                      </span>
                    </div>
                  ))}
                </div>
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3 mt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Brain className="w-4 h-4 text-purple-400" />
                    <span className="font-semibold text-white text-sm">💡 How to Fix Deviations:</span>
                  </div>
                  <ol className="text-sm text-slate-300 space-y-1 list-decimal list-inside">
                    <li>Generate ML recommendations by running ML training (button below)</li>
                    <li>Review and accept ML agent recommendations when they appear</li>
                    <li>Adjust algorithm weights manually if needed (use sliders below)</li>
                    <li>Verify data quality - ensure startup profiles have complete information</li>
                  </ol>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={runMLTraining}
                  disabled={trainingStatus === 'running'}
                  className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {trainingStatus === 'running' ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Running Training...
                    </>
                  ) : (
                    <>
                      <Brain className="w-4 h-4" />
                      Run ML Training Now
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ML Recommendations Panel - Prominently Displayed - ALWAYS VISIBLE */}
          <div className="mb-6 bg-gradient-to-r from-purple-500/20 via-pink-500/20 to-purple-500/20 border-2 border-purple-500/50 rounded-xl p-6 shadow-lg shadow-purple-500/20">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Brain className="w-6 h-6 text-purple-400" />
                <div>
                  <h3 className="font-bold text-white text-lg">🤖 ML Agent Recommendations</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Review and accept ML-generated fixes before making manual adjustments
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-purple-500/30 rounded-full text-xs font-semibold text-purple-200">
                  {mlRecommendations.length} Pending
                </span>
                {mlRecommendations.length > 0 && (
                  <button
                    onClick={() => setShowMLRecommendations(!showMLRecommendations)}
                    className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1 px-3 py-1 bg-purple-500/20 rounded-lg border border-purple-500/30"
                  >
                    <Eye className="w-4 h-4" />
                    {showMLRecommendations ? 'Hide' : 'Show'}
                  </button>
                )}
              </div>
            </div>
            {mlRecommendations.length === 0 ? (
              <div className="bg-slate-900/80 rounded-lg p-6 border-2 border-purple-500/30">
                <div className="text-center mb-4">
                  <Brain className="w-12 h-12 text-purple-400 mx-auto mb-3 opacity-50" />
                  <h4 className="font-semibold text-white mb-2">No ML Recommendations Yet</h4>
                  <p className="text-sm text-slate-400 mb-4">
                    ML recommendations will appear here once the ML agent analyzes your match data and generates optimization suggestions.
                  </p>
                </div>
                
                {showDeviations && deviations.length > 0 && (
                  <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 mb-4">
                    <div className="flex items-start gap-2 mb-2">
                      <AlertTriangle className="w-5 h-5 text-orange-400 mt-0.5" />
                      <div>
                        <p className="text-sm text-orange-300 font-semibold mb-1">
                          ⚠️ Deviations Detected: {deviations.length} startup(s) with score changes
                        </p>
                        <p className="text-xs text-slate-300">
                          Run ML training to analyze these deviations and generate data-driven recommendations for fixing them.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-col items-center gap-3">
                  <button
                    onClick={runMLTraining}
                    disabled={trainingStatus === 'running'}
                    className="w-full px-4 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {trainingStatus === 'running' ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Running ML Training...
                      </>
                    ) : (
                      <>
                        <Brain className="w-4 h-4" />
                        Run ML Training Now
                      </>
                    )}
                  </button>
                  <div className="flex items-center gap-2 w-full">
                    <button
                      onClick={loadMLRecommendations}
                      disabled={refreshingRecommendations}
                      className="flex-1 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-lg text-purple-400 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <RefreshCw className={`w-4 h-4 ${refreshingRecommendations ? 'animate-spin' : ''}`} />
                      {refreshingRecommendations ? 'Refreshing...' : 'Refresh Recommendations'}
                    </button>
                  </div>
                  {showDeviations && deviations.length > 0 && (
                    <p className="text-xs text-slate-400 text-center mt-2">
                      💡 <strong>Tip:</strong> Click "Run ML Training Now" above to analyze {deviations.length} deviation(s) and generate recommendations. Then refresh to see results.
                    </p>
                  )}
                </div>
              </div>
            ) : showMLRecommendations && (
                <div className="space-y-4">
                  {mlRecommendations.map((rec) => (
                    <div key={rec.id} className="bg-slate-900/80 rounded-lg p-4 border-2 border-purple-500/30 shadow-lg">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-bold text-white text-base">{rec.title}</h4>
                            {rec.priority && (
                              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                rec.priority === 'high' ? 'bg-red-500/30 text-red-400 border border-red-500/50' :
                                rec.priority === 'medium' ? 'bg-yellow-500/30 text-yellow-400 border border-yellow-500/50' :
                                'bg-blue-500/30 text-blue-400 border border-blue-500/50'
                              }`}>
                                {rec.priority.toUpperCase()}
                              </span>
                            )}
                            {rec.confidence_score && (
                              <span className="px-2 py-0.5 bg-purple-500/30 rounded text-xs text-purple-300 border border-purple-500/50">
                                {(rec.confidence_score * 100).toFixed(0)}% Confidence
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-300 mb-3">{rec.description}</p>
                          
                          {/* Show current vs proposed values */}
                          {rec.current_value && rec.proposed_value && (
                            <div className="bg-slate-800/50 rounded-lg p-3 mb-3 border border-slate-700">
                              <div className="grid grid-cols-2 gap-4 text-xs">
                                <div>
                                  <div className="text-slate-400 mb-1">Current Weights:</div>
                                  <div className="text-slate-200 font-mono">
                                    {Object.entries(rec.current_value).map(([key, val]: [string, any]) => (
                                      <div key={key} className="flex justify-between">
                                        <span className="text-slate-400">{key}:</span>
                                        <span className="text-white">{val}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-slate-400 mb-1">Proposed Weights:</div>
                                  <div className="text-slate-200 font-mono">
                                    {Object.entries(rec.proposed_value).map(([key, val]: [string, any]) => (
                                      <div key={key} className="flex justify-between">
                                        <span className="text-slate-400">{key}:</span>
                                        <span className="text-green-400 font-semibold">{val}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                          
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-slate-400">Expected Impact:</span>
                            <span className="text-green-400 font-semibold">{rec.expected_impact}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-700">
                        <button
                          onClick={() => acceptMLRecommendation(rec)}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold rounded-lg transition-all shadow-lg shadow-green-500/30"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Accept & Apply Recommendation
                        </button>
                        <button
                          onClick={() => {
                            if (rec.proposed_value && typeof rec.proposed_value === 'object') {
                              const newWeights = { ...weights, ...rec.proposed_value };
                              setWeights(newWeights);
                              setHasChanges(true);
                              alert('✅ Recommendation loaded into sliders. Review and click "Save Weights" to apply.');
                            }
                          }}
                          className="px-4 py-2.5 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-lg text-purple-400 transition-colors text-sm font-medium"
                        >
                          Preview in Sliders
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <button
                      onClick={() => navigate('/admin/ai-intelligence')}
                      className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-2 px-4 py-2 bg-purple-500/10 rounded-lg border border-purple-500/30"
                    >
                      View All ML Recommendations <ArrowRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => navigate('/admin/industry-rankings')}
                      className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-2 px-4 py-2 bg-blue-500/10 rounded-lg border border-blue-500/30"
                    >
                      Industry Rankings <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
        </div>

        {/* Weight Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <WeightSlider
            label="Team"
            component="team"
            value={weights.team}
            description="Founder experience, technical cofounder, domain expertise"
          />
          
          <WeightSlider
            label="Traction"
            component="traction"
            value={weights.traction}
            description="Revenue, users, growth rate, retention metrics"
          />
          
          <WeightSlider
            label="Market"
            component="market"
            value={weights.market}
            description="TAM size, market growth, problem importance"
          />
          
          <WeightSlider
            label="Product"
            component="product"
            value={weights.product}
            description="Demo, launch status, IP, defensibility"
          />
          
          <WeightSlider
            label="Vision"
            component="vision"
            value={weights.vision}
            description="Clarity, ambition, long-term potential"
          />
          
          <WeightSlider
            label="Ecosystem"
            component="ecosystem"
            value={weights.ecosystem}
            description="Investors, advisors, strategic partnerships"
          />
          
          <WeightSlider
            label="Grit"
            component="grit"
            value={weights.grit}
            description="Persistence, pivots, customer obsession"
          />
          
          <WeightSlider
            label="Problem Validation"
            component="problemValidation"
            value={weights.problemValidation}
            description="Customer validation, willingness to pay, demand signals"
          />
        </div>

        {/* Weight History */}
        {history.length > 0 && (
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5 text-orange-400" />
              Recent Changes
            </h3>
            <div className="space-y-3">
              {history.slice(0, 5).map((change) => (
                <div key={change.id} className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm text-slate-400">
                      {new Date(change.changed_at).toLocaleString()}
                    </div>
                    <div className="text-sm text-slate-400">by {change.changed_by}</div>
                  </div>
                  {change.reason && (
                    <div className="text-sm text-slate-300 mb-2">{change.reason}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Confirmation Modal */}
        {showConfirmation && impactPrediction && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowConfirmation(false)}>
            <div className="bg-slate-800 rounded-2xl p-6 max-w-lg mx-4 border border-slate-700" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="w-6 h-6 text-yellow-400" />
                <h3 className="text-xl font-bold text-white">Confirm Weight Changes</h3>
              </div>
              
              <div className="mb-4 space-y-3">
                <p className="text-slate-300">
                  You're about to modify the GOD Algorithm weights. This will affect how all startups are scored.
                </p>
                
                <div className={`p-4 rounded-lg border-2 ${
                  impactPrediction.trend === 'up' 
                    ? 'bg-green-500/10 border-green-500/30' 
                    : impactPrediction.trend === 'down'
                    ? 'bg-red-500/10 border-red-500/30'
                    : 'bg-blue-500/10 border-blue-500/30'
                }`}>
                  <div className="font-semibold text-white mb-2">Expected Impact:</div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Average Score Change:</span>
                      <span className={`font-semibold ${
                        impactPrediction.avgScoreChange > 0 ? 'text-green-400' :
                        impactPrediction.avgScoreChange < 0 ? 'text-red-400' : 'text-slate-300'
                      }`}>
                        {impactPrediction.avgScoreChange > 0 ? '+' : ''}
                        {impactPrediction.avgScoreChange.toFixed(1)} points
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Trend:</span>
                      <span className={`font-semibold ${
                        impactPrediction.trend === 'up' ? 'text-green-400' :
                        impactPrediction.trend === 'down' ? 'text-red-400' : 'text-blue-400'
                      }`}>
                        {impactPrediction.trend === 'up' ? '↑ Trending UP' :
                         impactPrediction.trend === 'down' ? '↓ Trending DOWN' : '→ Neutral'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">New High Scores (80+):</span>
                      <span className="font-semibold text-green-400">
                        +{impactPrediction.highScoreCountChange} startups
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-xs text-slate-400 bg-slate-900/50 p-3 rounded">
                  <Info className="w-4 h-4 inline mr-1" />
                  Changes will be applied to new score calculations. Existing scores remain unchanged until recalculated.
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowConfirmation(false)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmSaveWeights}
                  className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-black font-semibold rounded-lg transition-all"
                >
                  Confirm & Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Implementation Proof Section */}
        <div className="mt-8 bg-green-500/10 border border-green-500/30 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-white mb-2">Changes Implementation</h4>
              <p className="text-sm text-slate-300 mb-3">
                Weight changes are saved to localStorage and database. To see the impact:
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-slate-300">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span>Weights are stored in: <code className="bg-slate-900 px-2 py-1 rounded">localStorage.god_algorithm_weights</code></span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span>History tracked in: <code className="bg-slate-900 px-2 py-1 rounded">algorithm_weight_history</code> table</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span>Recalculate scores: Run queue processor to apply new weights</span>
                </div>
              </div>
              <div className="flex gap-3 mt-4 flex-wrap">
                <button
                  onClick={() => navigate('/admin/god-scores')}
                  className="flex items-center gap-2 text-sm px-4 py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 rounded-lg text-green-400 transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  View Current GOD Scores
                </button>
                <button
                  onClick={() => navigate('/admin/industry-rankings')}
                  className="flex items-center gap-2 text-sm px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 rounded-lg text-blue-400 transition-colors"
                >
                  <BarChart3 className="w-4 h-4" />
                  Industry Rankings
                </button>
                <button
                  onClick={() => navigate('/admin/matching-engine')}
                  className="flex items-center gap-2 text-sm px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 rounded-lg text-cyan-400 transition-colors"
                >
                  <BarChart3 className="w-4 h-4" />
                  Check Match Quality
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-4 bg-blue-500/10 border border-blue-500/30 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-400 mt-0.5" />
            <div>
              <h4 className="font-semibold text-white mb-2">How GOD Scoring Works</h4>
              <p className="text-sm text-slate-300 mb-3">
                Each component is scored 0-10, then multiplied by its weight. The total score is normalized to 0-100.
                Adjusting weights changes how much each factor influences the final GOD score. Higher weights = more emphasis.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
