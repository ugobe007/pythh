import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  CheckCircle, Lock, ArrowRight, ArrowLeft, TrendingUp, 
  FileText, Target, Users2, BarChart3, Sparkles, AlertCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import LogoDropdownMenu from '../components/LogoDropdownMenu';

interface TemplateStep {
  id: string;
  step_number: number;
  slug: string;
  name: string;
  description: string;
  category: string;
  tier_required: string;
  estimated_time: string;
  is_completed: boolean;
  god_score_impact: string[]; // GOD score components this template improves
}

interface StartupData {
  id: string;
  name: string;
  total_god_score: number;
  traction_score: number;
  team_score: number;
  market_score: number;
  product_score: number;
  vision_score: number;
}

interface GODRecommendation {
  component: string;
  current_score: number;
  target_score: number;
  priority: 'high' | 'medium' | 'low';
  template_slugs: string[]; // Templates that help improve this component
  recommendation: string;
}

export default function TemplateSequentialFlow() {
  const { startupId } = useParams<{ startupId: string }>();
  const navigate = useNavigate();
  
  const [startup, setStartup] = useState<StartupData | null>(null);
  const [steps, setSteps] = useState<TemplateStep[]>([]);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [godRecommendations, setGodRecommendations] = useState<GODRecommendation[]>([]);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);

  useEffect(() => {
    if (startupId) {
      loadData();
    }
  }, [startupId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load startup with GOD scores
      const { data: startupData, error: startupError } = await supabase
        .from('startup_uploads')
        .select('id, name, total_god_score, traction_score, team_score, market_score, product_score, vision_score')
        .eq('id', startupId)
        .single();

      if (startupError) throw startupError;
      setStartup(startupData);

      // Load templates ordered by step_number
      const { data: templatesData, error: templatesError } = await supabase
        .from('service_templates')
        .select('*')
        .eq('is_active', true)
        .order('step_number', { ascending: true });

      if (templatesError) throw templatesError;

      // Load completed templates for this startup
      const { data: completedData, error: completedError } = await supabase
        .from('template_completions')
        .select('template_slug')
        .eq('startup_id', startupId);

      const completed = completedData?.map(c => c.template_slug) || [];
      setCompletedSteps(completed);

      // Map templates to steps
      const mappedSteps: TemplateStep[] = (templatesData || []).map((t: any) => ({
        id: t.id,
        step_number: t.step_number || 999,
        slug: t.slug,
        name: t.name,
        description: t.description,
        category: t.category,
        tier_required: t.tier_required,
        estimated_time: t.estimated_time || '5-10 min',
        is_completed: completed.includes(t.slug),
        god_score_impact: t.god_score_impact || []
      }));

      // Sort by step_number and ensure sequential order
      mappedSteps.sort((a, b) => a.step_number - b.step_number);
      setSteps(mappedSteps);

      // Generate GOD score recommendations
      if (startupData) {
        generateGODRecommendations(startupData, mappedSteps);
      }

    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateGODRecommendations = (startup: StartupData, templates: TemplateStep[]) => {
    const recommendations: GODRecommendation[] = [];
    
    // Traction recommendations
    if (startup.traction_score < 40) {
      recommendations.push({
        component: 'Traction',
        current_score: startup.traction_score || 0,
        target_score: 50,
        priority: 'high',
        template_slugs: templates.filter(t => 
          t.category === 'traction' || t.god_score_impact.includes('traction')
        ).map(t => t.slug),
        recommendation: 'Your traction score is below target. Complete traction improvement templates to show VCs your growth metrics.'
      });
    }

    // Team recommendations
    if ((startup.team_score || 0) < 40) {
      recommendations.push({
        component: 'Team',
        current_score: startup.team_score || 0,
        target_score: 50,
        priority: 'high',
        template_slugs: templates.filter(t => 
          t.category === 'team' || t.god_score_impact.includes('team')
        ).map(t => t.slug),
        recommendation: 'Team composition needs strengthening. Complete team gap analysis templates to identify missing roles.'
      });
    }

    // Product recommendations
    if ((startup.product_score || 0) < 40) {
      recommendations.push({
        component: 'Product',
        current_score: startup.product_score || 0,
        target_score: 50,
        priority: 'medium',
        template_slugs: templates.filter(t => 
          t.category === 'pmf' || t.god_score_impact.includes('product')
        ).map(t => t.slug),
        recommendation: 'Product-market fit needs validation. Complete PMF analysis templates to strengthen your product story.'
      });
    }

    // Market recommendations
    if ((startup.market_score || 0) < 40) {
      recommendations.push({
        component: 'Market',
        current_score: startup.market_score || 0,
        target_score: 50,
        priority: 'medium',
        template_slugs: templates.filter(t => 
          t.category === 'strategy' || t.god_score_impact.includes('market')
        ).map(t => t.slug),
        recommendation: 'Market positioning could be stronger. Complete strategy templates to refine your market thesis.'
      });
    }

    setGodRecommendations(recommendations);
  };

  const handleStepComplete = async (stepSlug: string) => {
    try {
      // Mark as completed
      await supabase.from('template_completions').insert({
        startup_id: startupId,
        template_slug: stepSlug,
        completed_at: new Date().toISOString()
      });

      setCompletedSteps([...completedSteps, stepSlug]);
      
      // Move to next step
      const currentStepData = steps.find(s => s.slug === stepSlug);
      if (currentStepData && currentStepData.step_number < steps.length) {
        setCurrentStep(currentStepData.step_number + 1);
      }

      // Reload startup data to get updated GOD scores
      await loadData();
    } catch (error) {
      console.error('Error marking step complete:', error);
    }
  };

  const getNextIncompleteStep = () => {
    return steps.find(s => !s.is_completed) || steps[0];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a1140] via-[#2d1b69] to-[#4a2a8f] flex items-center justify-center">
        <div className="text-white text-2xl">Loading...</div>
      </div>
    );
  }

  if (!startup) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a1140] via-[#2d1b69] to-[#4a2a8f] flex items-center justify-center">
        <div className="text-center text-white">
          <h1 className="text-2xl font-bold mb-4">Startup Not Found</h1>
          <Link to="/services" className="text-cyan-500 hover:text-cyan-400">Back to Services</Link>
        </div>
      </div>
    );
  }

  const nextStep = getNextIncompleteStep();
  const progress = steps.length > 0 ? (completedSteps.length / steps.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1140] via-[#2d1b69] to-[#4a2a8f]">
      <LogoDropdownMenu />

      <div className="container mx-auto px-4 py-8 pt-24 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            Fundraising Toolkit for <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">{startup.name}</span>
          </h1>
          <p className="text-gray-300">Complete templates in order to improve your GOD score and fundraising readiness</p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8 bg-gray-800/50 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white font-semibold">Overall Progress</span>
            <span className="text-cyan-400 font-bold">{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-3 mb-4">
            <div 
              className="bg-gradient-to-r from-orange-500 to-amber-500 h-3 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-sm text-gray-400">
            <span>{completedSteps.length} of {steps.length} templates completed</span>
            <span className="text-white font-semibold">GOD Score: <span className="text-cyan-400">{startup.total_god_score || 0}/100</span></span>
          </div>
        </div>

        {/* GOD Score Recommendations */}
        {godRecommendations.length > 0 && (
          <div className="mb-8 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-xl p-6 border border-yellow-500/30">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="w-5 h-5 text-yellow-400" />
              <h2 className="text-xl font-bold text-white">Priority Improvements Based on Your GOD Score</h2>
            </div>
            <div className="space-y-4">
              {godRecommendations.map((rec, idx) => (
                <div key={idx} className="bg-black/30 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="text-white font-semibold">{rec.component} Score: {rec.current_score}/100</h3>
                      <p className="text-gray-300 text-sm">{rec.recommendation}</p>
                    </div>
                    <div className="text-right">
                      <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                        rec.priority === 'high' ? 'bg-red-500/30 text-red-400' :
                        rec.priority === 'medium' ? 'bg-yellow-500/30 text-yellow-400' :
                        'bg-blue-500/30 text-blue-400'
                      }`}>
                        {rec.priority.toUpperCase()} PRIORITY
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {rec.template_slugs.map(slug => {
                      const template = steps.find(s => s.slug === slug);
                      return template ? (
                        <Link
                          key={slug}
                          to={`/services/${slug}?startupId=${startupId}`}
                          className="px-3 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 rounded-lg text-sm transition-colors"
                        >
                          {template.name}
                        </Link>
                      ) : null;
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Current Step Highlight */}
        {nextStep && (
          <div className="mb-8 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-xl p-6 border border-cyan-500/30">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 flex items-center justify-center text-black font-bold">
                    {nextStep.step_number}
                  </div>
                  <h2 className="text-2xl font-bold text-white">Next: {nextStep.name}</h2>
                </div>
                <p className="text-gray-300 mb-4">{nextStep.description}</p>
                <div className="flex items-center gap-4 text-sm text-gray-400">
                  <span>⏱️ {nextStep.estimated_time}</span>
                  {nextStep.god_score_impact.length > 0 && (
                    <span>🎯 Improves: {nextStep.god_score_impact.join(', ')}</span>
                  )}
                </div>
              </div>
              <Link
                to={`/services/${nextStep.slug}?startupId=${startupId}`}
                className="px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-black font-bold rounded-xl hover:shadow-lg hover:shadow-orange-500/40 transition-all flex items-center gap-2"
              >
                Start Step {nextStep.step_number}
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        )}

        {/* All Steps List */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-white mb-4">All Templates</h2>
          {steps.map((step, idx) => (
            <div
              key={step.id}
              className={`bg-gray-800/50 rounded-xl p-6 border transition-all ${
                step.is_completed 
                  ? 'border-green-500/30 bg-green-500/5' 
                  : step.step_number === currentStep
                  ? 'border-cyan-500/50 bg-cyan-500/10'
                  : 'border-gray-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold ${
                    step.is_completed
                      ? 'bg-green-500 text-white'
                      : 'bg-gradient-to-r from-orange-500 to-amber-500 text-black'
                  }`}>
                    {step.is_completed ? <CheckCircle className="w-6 h-6" /> : step.step_number}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-1">{step.name}</h3>
                    <p className="text-gray-300 text-sm">{step.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                      <span>⏱️ {step.estimated_time}</span>
                      {step.god_score_impact.length > 0 && (
                        <span>🎯 {step.god_score_impact.join(', ')}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {step.is_completed ? (
                    <div className="flex items-center gap-2 text-green-400">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-medium">Completed</span>
                    </div>
                  ) : (
                    <Link
                      to={`/services/${step.slug}?startupId=${startupId}`}
                      className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all flex items-center gap-2"
                    >
                      {step.step_number <= currentStep ? 'Start' : 'Locked'}
                      {step.step_number <= currentStep && <ArrowRight className="w-4 h-4" />}
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

