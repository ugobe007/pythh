import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  Sparkles, 
  Lock, 
  Loader2, 
  CheckCircle,
  Copy,
  Download,
  Share2,
  Zap
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import LogoDropdownMenu from '../components/LogoDropdownMenu';

interface ServiceTemplate {
  id: string;
  slug: string;
  name: string;
  description: string;
  tier_required: string;
  category: string;
  prompt_template: string;
  output_format: Record<string, any>;
  icon?: string;
}

interface StartupData {
  id: string;
  company_name: string;
  description: string;
  pitch: string;
  industry: string;
  stage: string;
  traction: string;
  team_background: string;
  ask_amount: number;
  location: string;
}

const ServiceDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  
  const [service, setService] = useState<ServiceTemplate | null>(null);
  const [startups, setStartups] = useState<StartupData[]>([]);
  const [selectedStartup, setSelectedStartup] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [userTier, setUserTier] = useState<string>('spark');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchServiceAndStartups();
  }, [slug]);

  const fetchServiceAndStartups = async () => {
    setLoading(true);
    try {
      // Fetch service template
      const { data: serviceData, error: serviceError } = await (supabase.from as any)('service_templates')
        .select('*')
        .eq('slug', slug || '')
        .eq('is_active', true)
        .single();

      if (serviceError) throw serviceError;
      setService(serviceData as ServiceTemplate);

      // Fetch user's startups (for demo, fetch recent startup_uploads)
      const { data: startupData, error: startupError } = await supabase
        .from('startup_uploads')
        .select('id, name, description, sectors, stage, traction, team_background, latest_funding_amount, location')
        .limit(20)
        .order('created_at', { ascending: false });

      if (startupError) throw startupError;
      // Map to expected format
      const mappedStartups = (startupData || []).map((s: any) => ({
        id: s.id,
        company_name: s.name,
        description: s.description,
        pitch: s.description,
        industry: s.sectors?.[0] || '',
        stage: s.stage,
        traction: s.traction,
        team_background: s.team_background,
        ask_amount: s.latest_funding_amount,
        location: s.location
      }));
      setStartups(mappedStartups);

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTierLevel = (tier: string): number => {
    const levels: Record<string, number> = { spark: 0, flame: 1, inferno: 2 };
    return levels[tier] || 0;
  };

  const canAccess = service ? getTierLevel(userTier) >= getTierLevel(service.tier_required) : false;

  const runAnalysis = async () => {
    if (!service || !selectedStartup) return;
    
    const startup = startups.find(s => s.id === selectedStartup);
    if (!startup) return;

    setAnalyzing(true);
    setResult(null);

    // Simulate AI analysis (in production, this would call OpenAI/Claude)
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Generate mock result based on service type
    const mockResults: Record<string, string> = {
      'pitch-analyzer': `# Pitch Deck Analysis for ${startup.company_name}

## Overall Score: 78/100 🔥

### Strengths
- **Clear Value Proposition**: ${startup.description?.slice(0, 100) || 'Good foundation'}...
- **Market Timing**: Strong alignment with current trends
- **Team Background**: ${startup.team_background || 'Experienced founding team'}

### Areas for Improvement

#### 1. Problem Statement (Score: 7/10)
Your problem statement is solid but could be more emotionally compelling. Try leading with a customer story.

**Suggested Rewrite:**
> "Every day, [target customer] struggles with [specific pain]. Last year alone, this cost businesses $X billion in lost productivity..."

#### 2. Market Size (Score: 6/10)
Your TAM/SAM/SOM breakdown needs work. VCs want to see:
- TAM: Total addressable market with credible source
- SAM: Your realistic serviceable market
- SOM: What you can capture in 3-5 years

#### 3. Competitive Moat (Score: 7/10)
You've identified competitors but haven't clearly articulated your unfair advantage.

### Action Items
1. ✅ Add customer testimonial on slide 3
2. ✅ Include revenue projections with assumptions
3. ✅ Highlight team's unique qualifications
4. ✅ Add clear call-to-action on final slide

### VC Readiness Score
Your pitch is **76% ready** for Series A conversations.`,

      'value-prop-sharpener': `# Value Proposition Analysis for ${startup.company_name}

## Current Value Prop
"${startup.description?.slice(0, 200) || 'Your startup description here'}..."

## Sharpened Value Propositions

### Option A: Problem-Focused
> "We eliminate [pain point] for [target customer], saving them [specific metric] while [key benefit]."

### Option B: Outcome-Focused  
> "[Target customer] use ${startup.company_name} to achieve [desired outcome] [X]% faster than traditional methods."

### Option C: Competitive-Focused
> "Unlike [competitor], ${startup.company_name} is the only solution that [unique capability]."

## Recommended Positioning
Based on your ${startup.industry || 'industry'} and ${startup.stage || 'stage'}, we recommend **Option A** because early-stage investors respond best to clear problem articulation.

## A/B Testing Suggestions
Test these headlines with your target audience:
1. "[Pain Point] is costing you $X. Here's the fix."
2. "How [competitor's customers] are switching to save [metric]"
3. "The [industry] tool that [specific outcome]"`,

      'vc-approach-playbook': `# VC Approach Playbook for ${startup.company_name}

## Your Ideal VC Profile
Based on your stage (${startup.stage || 'Pre-seed/Seed'}) and industry (${startup.industry || 'Tech'}):

### Tier 1: Perfect Fit (Reach out first)
These VCs have invested in similar companies and are actively looking:
1. **[VC Firm A]** - Recent investment in adjacent space
2. **[VC Firm B]** - Partner has background in ${startup.industry || 'your industry'}
3. **[VC Firm C]** - Sweet spot is $${(startup.ask_amount || 500000) / 1000}K rounds

### Warm Introduction Strategy
Your best paths to warm intros:
1. **LinkedIn 2nd Connections**: You have 3 mutual connections with target VCs
2. **Portfolio Company Route**: [Company X] in their portfolio might intro you
3. **Angel Investors**: Your early angels know 2 partners at target firms

### Email Templates

**Cold Email (35% open rate template):**
\`\`\`
Subject: ${startup.company_name} - [Specific metric that proves traction]

Hi [Partner Name],

[Mutual connection] suggested I reach out. ${startup.company_name} just hit [milestone], and we're raising to [specific goal].

Quick context: ${startup.description?.slice(0, 100) || 'Brief description'}

Would you have 15 minutes this week?

Best,
[Founder Name]
\`\`\`

### Meeting Prep Checklist
- [ ] Research partner's recent investments
- [ ] Prepare for "Why now?" question
- [ ] Have 3 customer stories ready
- [ ] Know your metrics cold (MoM growth, CAC, LTV)`,

      'pmf-analysis': `# Product-Market Fit Analysis for ${startup.company_name}

## PMF Score: 68/100 📊

### Sean Ellis Test Results (Estimated)
Based on your traction data, approximately **34%** of users would be "very disappointed" if your product disappeared. 

**Target: 40%+ for strong PMF**

### Leading Indicators
| Metric | Your Performance | Benchmark | Status |
|--------|-----------------|-----------|--------|
| User Retention (30-day) | ~45% | 40% | ✅ Good |
| NPS Score | Est. 32 | 40+ | ⚠️ Needs work |
| Organic Growth | ~20% | 30% | ⚠️ Below target |
| Feature Usage Depth | Medium | High | 📈 Improving |

### PMF Acceleration Recommendations

#### 1. Narrow Your Focus
You're trying to serve too many segments. Focus on ${startup.industry || 'your core'} users who show highest engagement.

#### 2. 10x One Feature
Your users love [feature X]. Double down on making it 10x better instead of adding new features.

#### 3. Customer Development
Interview your top 10 power users this week. Ask:
- "What would make you recommend us to a friend?"
- "What's the one thing that almost made you leave?"

### 90-Day PMF Roadmap
**Month 1:** Customer discovery + churn analysis
**Month 2:** Ship 2 high-impact improvements  
**Month 3:** Re-measure Sean Ellis score

### Warning Signs to Watch
- Churn rate increasing
- Support tickets about same issues
- Users not discovering key features`
    };

    // Use specific result or generic one
    const analysisResult = mockResults[slug || ''] || `# Analysis Complete for ${startup.company_name}

## Summary
Your startup shows strong potential in the ${startup.industry || 'technology'} sector.

## Key Insights
${startup.description || 'Based on the information provided, here are our recommendations...'}

## Next Steps
1. Review the detailed analysis above
2. Implement the suggested improvements
3. Re-run this analysis in 30 days to track progress

*Generated by [pyth] ai Services*`;

    setResult(analysisResult);
    setAnalyzing(false);

    // Save result to database and mark template as completed
    try {
      await (supabase.from as any)('service_results').insert({
        startup_id: selectedStartup,
        template_id: service.id,
        generated_content: { markdown: analysisResult },
        version: 1
      });

      // Mark template as completed for this startup
      const startupId = new URLSearchParams(window.location.search).get('startupId') || selectedStartup;
      if (startupId) {
        await (supabase.from as any)('template_completions').upsert({
          startup_id: startupId,
          template_slug: service.slug,
          completed_at: new Date().toISOString(),
          result_summary: analysisResult.slice(0, 200) // Store first 200 chars as summary
        }, {
          onConflict: 'startup_id,template_slug'
        });
      }
    } catch (error) {
      console.error('Error saving result:', error);
    }
  };

  const copyToClipboard = () => {
    if (result) {
      navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const downloadAsMarkdown = () => {
    if (result && service) {
      const blob = new Blob([result], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${service.slug}-analysis.md`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  if (!service) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Service Not Found</h1>
          <button
            onClick={() => navigate('/services')}
            className="text-cyan-500 hover:text-cyan-400"
          >
            Back to Services
          </button>
        </div>
      </div>
    );
  }

  const tierColors: Record<string, string> = {
    spark: 'bg-gray-600',
    flame: 'bg-gradient-to-r from-cyan-600 to-blue-600',
    inferno: 'bg-gradient-to-r from-red-500 to-purple-600'
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950">
      {/* Global Navigation */}
      <LogoDropdownMenu />

      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Service Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">{service.name}</h1>
              <p className="text-gray-400">{service.description}</p>
            </div>
          </div>
        </motion.div>

        {!canAccess ? (
          /* Locked State */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-800/50 rounded-2xl p-12 text-center border border-gray-700"
          >
            <div className="w-20 h-20 rounded-full bg-gray-700/50 flex items-center justify-center mx-auto mb-6">
              <Lock className="w-10 h-10 text-gray-500" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">
              Upgrade to {service.tier_required.charAt(0).toUpperCase() + service.tier_required.slice(1)} to Unlock
            </h2>
            <p className="text-gray-400 mb-8 max-w-md mx-auto">
              This premium service requires a {service.tier_required} subscription or higher.
              Upgrade now to access AI-powered analysis for your startup.
            </p>
            <button
              onClick={() => navigate('/get-matched')}
              className="px-8 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-cyan-500/25 transition-all"
            >
              View Pricing & Upgrade
            </button>
          </motion.div>
        ) : (
          /* Active Service */
          <div className="space-y-8">
            {/* Startup Selection */}
            {!result && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700"
              >
                <h3 className="text-lg font-semibold text-white mb-4">
                  1. Select Your Startup
                </h3>
                <select
                  value={selectedStartup}
                  onChange={(e) => setSelectedStartup(e.target.value)}
                  className="w-full bg-gray-700 text-white rounded-xl px-4 py-3 border border-gray-600 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
                >
                  <option value="">Choose a startup to analyze...</option>
                  {startups.map(startup => (
                    <option key={startup.id} value={startup.id}>
                      {startup.company_name} - {startup.industry || 'Tech'} ({startup.stage || 'Early Stage'})
                    </option>
                  ))}
                </select>
              </motion.div>
            )}

            {/* Run Analysis Button */}
            {!result && selectedStartup && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-center"
              >
                <button
                  onClick={runAnalysis}
                  disabled={analyzing}
                  className="px-12 py-4 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold text-lg rounded-xl hover:shadow-lg hover:shadow-cyan-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 mx-auto"
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5" />
                      Run AI Analysis
                    </>
                  )}
                </button>
                {analyzing && (
                  <p className="text-gray-400 mt-4 text-sm">
                    This usually takes 15-30 seconds...
                  </p>
                )}
              </motion.div>
            )}

            {/* Analysis Result */}
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                {/* Actions Bar */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-medium">Analysis Complete</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={copyToClipboard}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg flex items-center gap-2 transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                    <button
                      onClick={downloadAsMarkdown}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg flex items-center gap-2 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                    <button
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg flex items-center gap-2 transition-colors"
                    >
                      <Share2 className="w-4 h-4" />
                      Share
                    </button>
                  </div>
                </div>

                {/* Result Content */}
                <div className="bg-gray-800/50 rounded-2xl p-8 border border-gray-700">
                  <div className="prose prose-invert max-w-none">
                    <pre className="whitespace-pre-wrap text-gray-300 font-sans text-sm leading-relaxed">
                      {result}
                    </pre>
                  </div>
                </div>

                {/* Run Again */}
                <div className="text-center pt-4">
                  <button
                    onClick={() => {
                      setResult(null);
                      setSelectedStartup('');
                    }}
                    className="text-cyan-500 hover:text-cyan-400 font-medium"
                  >
                    ← Run Another Analysis
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ServiceDetailPage;
