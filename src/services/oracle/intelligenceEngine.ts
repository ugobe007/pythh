// ============================================================================
// Pythh Oracle — Intelligence Engine
// ============================================================================
// The Oracle's brain. Takes founder DNA, GOD scores, wizard responses,
// and VC thesis profiles to generate:
//   1. VC alignment scores (how well you fit each top VC)
//   2. Founder DNA analysis (archetype classification + dimension scoring)
//   3. Non-obvious signal detection
//   4. Actionable predictions
//   5. Approach strategies per VC
//
// This is the proprietary layer that makes the Oracle valuable.
// It does NOT take sides. It is objective, helpful, instructive — but wise.
// ============================================================================

import { supabase } from '../../lib/supabase';
import {
  VC_THESIS_PROFILES,
  NON_OBVIOUS_SIGNALS,
  GOD_VC_MAPPINGS,
  scoreStartupVCAlignment,
  type VCThesisProfile,
  type FounderDNAProfile,
  type FounderArchetype,
  type NonObviousSignal,
} from './vcThesisKnowledge';

// Re-export for consumers
export type { FounderDNAProfile, FounderArchetype };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OracleAnalysis {
  founder_dna: FounderDNAProfile;
  vc_alignments: VCAlignmentResult[];
  predictions: OraclePrediction[];
  non_obvious_signals: DetectedSignal[];
  coaching_prompts: CoachingPrompt[];
  overall_readiness: {
    score: number;  // 0-100
    label: string;
    summary: string;
    top_actions: string[];
  };
}

export interface VCAlignmentResult {
  vc_id: string;
  vc_name: string;
  vc_short_name: string;
  alignment_score: number;
  strengths: string[];
  gaps: string[];
  approach_strategy: {
    best_paths: string[];
    timing: string;
    pitch_style: string;
    meeting_notes: string;
    decision_speed: string;
  };
  conviction_triggers_met: string[];
  deal_breakers_flagged: string[];
}

export interface OraclePrediction {
  type: string;
  title: string;
  body: string;
  confidence: number;
  signals: string[];
  actions: string[];
}

export interface DetectedSignal {
  signal_id: string;
  signal_name: string;
  detected: boolean;
  strength: number;  // 0-1
  evidence: string;
  impact: string;
}

export interface CoachingPrompt {
  category: 'founder_dna' | 'vc_alignment' | 'strategy' | 'execution' | 'narrative';
  question: string;
  why_it_matters: string;
  vc_relevance: string[];  // which VCs care about this
}

// ---------------------------------------------------------------------------
// FOUNDER DNA ANALYZER
// ---------------------------------------------------------------------------

export function analyzeFounderDNA(
  wizardResponses: Record<string, Record<string, unknown>>,
): FounderDNAProfile {
  const dna: FounderDNAProfile = {
    primary_archetype: 'mission_driven',
    hypothesis_clarity: 5,
    motivation_score: 5,
    timing_awareness: 5,
    domain_depth: 5,
    technical_capability: 5,
    team_completeness: 5,
    trade_secret_risk: 0,
    early_traction_quality: 5,
    narrative_power: 5,
    network_leverage: 5,
    resilience_evidence: 5,
    cofounder_dynamics: 5,
  };

  // Analyze value proposition responses
  const vp = wizardResponses.value_proposition || {};
  if (vp.one_liner) {
    const words = String(vp.one_liner).split(' ').length;
    dna.narrative_power = words <= 15 ? 8 : words <= 25 ? 6 : 4;
  }
  if (vp.problem_statement && String(vp.problem_statement).length > 100) {
    dna.hypothesis_clarity = 7;
  }
  if (vp.why_now && String(vp.why_now).length > 50) {
    dna.timing_awareness = 7;
  }
  if (vp.differentiation && String(vp.differentiation).length > 80) {
    dna.hypothesis_clarity = Math.min(dna.hypothesis_clarity + 1, 10);
  }

  // Analyze fundraising strategy responses
  const fs = wizardResponses.fundraising_strategy || {};
  const conversations = fs.investor_conversations as string;
  if (conversations === '30+') {
    dna.network_leverage = 8;
    dna.resilience_evidence = 7;
  } else if (conversations === '15-30') {
    dna.network_leverage = 7;
    dna.resilience_evidence = 6;
  } else if (conversations === 'None yet') {
    dna.network_leverage = 3;
  }

  // Analyze investor alignment
  const ia = wizardResponses.investor_alignment || {};
  const sectors = (ia.sector_focus as string[]) || [];
  if (sectors.includes('AI/ML')) dna.primary_archetype = 'ai_native';
  if (sectors.includes('Healthcare') || sectors.includes('Biotech')) {
    if (dna.domain_depth > 6) dna.primary_archetype = 'research_commercializer';
  }

  // Analyze support materials
  const sm = wizardResponses.support_materials || {};
  const materials = (sm.materials_checklist as string[]) || [];
  dna.team_completeness = Math.min(5 + materials.length * 0.5, 10);
  if (materials.includes('Product Demo / Video')) dna.technical_capability += 1;
  if (materials.includes('Customer References')) dna.early_traction_quality += 1;
  if (materials.includes('Financial Model')) dna.hypothesis_clarity += 0.5;

  // Analyze signal boost
  const sb = wizardResponses.signal_boost || {};
  const visibility = sb.current_visibility as string;
  if (visibility?.includes('High')) {
    dna.network_leverage = Math.min(dna.network_leverage + 2, 10);
    dna.narrative_power = Math.min(dna.narrative_power + 1, 10);
  }
  if (sb.recent_wins && String(sb.recent_wins).length > 100) {
    dna.early_traction_quality = Math.min(dna.early_traction_quality + 1, 10);
    dna.resilience_evidence = Math.min(dna.resilience_evidence + 1, 10);
  }

  // Analyze founder DNA wizard (new step)
  const fd = wizardResponses.founder_dna || {};
  if (fd.archetype) dna.primary_archetype = fd.archetype as FounderArchetype;
  if (fd.secondary_archetype) dna.secondary_archetype = fd.secondary_archetype as FounderArchetype;
  if (fd.hypothesis) {
    const len = String(fd.hypothesis).length;
    dna.hypothesis_clarity = len > 200 ? 8 : len > 100 ? 7 : 5;
  }
  if (fd.motivation) {
    const text = String(fd.motivation).toLowerCase();
    if (text.includes('personal') || text.includes('experienced') || text.includes('suffered')) {
      dna.motivation_score = 9;
      if (!fd.archetype) dna.primary_archetype = 'mission_driven';
    } else if (text.includes('opportunity') || text.includes('market')) {
      dna.motivation_score = 7;
    }
  }
  if (fd.prior_company_type) {
    const type = String(fd.prior_company_type);
    if (type.includes('FAANG') || type.includes('Big Tech')) {
      dna.technical_capability = Math.min(dna.technical_capability + 2, 10);
      if (!fd.archetype) dna.primary_archetype = 'corporate_spinout';
    }
    if (type.includes('Unicorn') || type.includes('Hot startup')) {
      dna.network_leverage = Math.min(dna.network_leverage + 2, 10);
      if (!fd.archetype) dna.primary_archetype = 'hot_startup_alumni';
    }
    if (type.includes('Research') || type.includes('PhD')) {
      dna.domain_depth = Math.min(dna.domain_depth + 2, 10);
      if (!fd.archetype) dna.primary_archetype = 'research_commercializer';
    }
  }
  if (fd.cofounders_count) {
    const count = parseInt(String(fd.cofounders_count)) || 0;
    dna.cofounder_dynamics = count === 0 ? 4 : count === 1 ? 7 : count >= 2 ? 8 : 5;
  }
  if (fd.technical_founder === 'yes' || fd.technical_founder === true) {
    dna.technical_capability = Math.min(dna.technical_capability + 2, 10);
  }

  // Clamp all values
  for (const key of Object.keys(dna) as (keyof FounderDNAProfile)[]) {
    if (typeof dna[key] === 'number') {
      (dna as any)[key] = Math.max(0, Math.min(10, dna[key] as number));
    }
  }

  return dna;
}

// ---------------------------------------------------------------------------
// VC ALIGNMENT CALCULATOR
// ---------------------------------------------------------------------------

export function calculateVCAlignments(
  godScores: { team_score: number; traction_score: number; market_score: number; product_score: number; vision_score: number },
  founderDNA: FounderDNAProfile,
): VCAlignmentResult[] {
  return VC_THESIS_PROFILES.map((vc) => {
    const result = scoreStartupVCAlignment(godScores, founderDNA, vc.id);

    // Check conviction triggers
    const triggers_met: string[] = [];
    if (godScores.traction_score > 70) triggers_met.push('Strong traction signals');
    if (founderDNA.technical_capability > 7) triggers_met.push('Deep technical capability');
    if (founderDNA.hypothesis_clarity > 7) triggers_met.push('Clear, defensible hypothesis');
    if (founderDNA.narrative_power > 7) triggers_met.push('Compelling narrative');
    if (founderDNA.timing_awareness > 7) triggers_met.push('Strong why-now understanding');

    // Check deal breakers
    const deal_breakers: string[] = [];
    if (founderDNA.technical_capability < 4 && vc.founder_signals.technical_depth > 0.8) {
      deal_breakers.push(`${vc.shortName} requires strong technical depth — yours is below threshold`);
    }
    if (godScores.market_score < 30 && vc.founder_signals.market_timing_sense > 0.8) {
      deal_breakers.push(`Market narrative too weak for ${vc.shortName}`);
    }
    if (founderDNA.cofounder_dynamics < 4 && vc.id === 'yc') {
      deal_breakers.push('YC strongly prefers co-founding teams');
    }

    return {
      vc_id: vc.id,
      vc_name: vc.name,
      vc_short_name: vc.shortName,
      alignment_score: result.alignment_score,
      strengths: result.strengths,
      gaps: result.gaps,
      approach_strategy: {
        best_paths: vc.approach_intel.best_intro_paths,
        timing: vc.approach_intel.timing_notes,
        pitch_style: vc.approach_intel.pitch_format_preference,
        meeting_notes: vc.approach_intel.meeting_style,
        decision_speed: vc.approach_intel.decision_speed,
      },
      conviction_triggers_met: triggers_met,
      deal_breakers_flagged: deal_breakers,
    };
  }).sort((a, b) => b.alignment_score - a.alignment_score);
}

// ---------------------------------------------------------------------------
// NON-OBVIOUS SIGNAL DETECTOR
// ---------------------------------------------------------------------------

export function detectNonObviousSignals(
  founderDNA: FounderDNAProfile,
  wizardResponses: Record<string, Record<string, unknown>>,
): DetectedSignal[] {
  return NON_OBVIOUS_SIGNALS.map((signal) => {
    let detected = false;
    let strength = 0;
    let evidence = 'Not enough data to assess';

    switch (signal.id) {
      case 'customer_quality_signal': {
        const sm = wizardResponses.support_materials || {};
        const traction = String(sm.traction_proof || '');
        if (traction.length > 50) {
          detected = true;
          strength = traction.toLowerCase().match(/enterprise|fortune|brand|hospital|university|government/g)?.length ? 0.9 : 0.5;
          evidence = strength > 0.7
            ? 'Your early customers appear to be notable organizations — strong quality signal'
            : 'You have traction proof, but customer quality is unclear';
        }
        break;
      }
      case 'trade_secret_advantage': {
        if (founderDNA.trade_secret_risk > 3) {
          detected = true;
          strength = Math.min(founderDNA.trade_secret_risk / 10, 1);
          evidence = 'Your background suggests deep institutional knowledge from prior work — this is both an advantage and a risk to manage';
        } else if (founderDNA.domain_depth > 7) {
          detected = true;
          strength = 0.6;
          evidence = 'Deep domain expertise suggests proprietary knowledge advantage';
        }
        break;
      }
      case 'market_contradiction_signal': {
        const vp = wizardResponses.value_proposition || {};
        const problem = String(vp.problem_statement || '').toLowerCase();
        if (problem.match(/no one|nobody|refuse|ignore|incentive|legacy|broken/)) {
          detected = true;
          strength = 0.8;
          evidence = 'Your problem description suggests a market where incumbents are structurally unable to solve it';
        }
        break;
      }
      case 'founder_narrative_evolution': {
        if (founderDNA.narrative_power > 7) {
          detected = true;
          strength = founderDNA.narrative_power / 10;
          evidence = 'Your narrative clarity is strong — suggests iterative refinement through real conversations';
        }
        break;
      }
      case 'talent_magnet_signal': {
        if (founderDNA.team_completeness > 7 && founderDNA.cofounder_dynamics > 7) {
          detected = true;
          strength = 0.8;
          evidence = 'Strong team completeness and co-founder dynamics suggest you attract top talent';
        }
        break;
      }
      case 'corporate_cant_do_signal': {
        if (founderDNA.primary_archetype === 'corporate_spinout') {
          detected = true;
          strength = 0.85;
          evidence = 'As a corporate spinout, you likely identified a problem your former employer is structurally unable to solve';
        }
        break;
      }
      case 'usage_pattern_signal': {
        const sb = wizardResponses.signal_boost || {};
        const wins = String(sb.recent_wins || '').toLowerCase();
        if (wins.match(/surprise|unexpected|organic|viral|word.?of.?mouth/)) {
          detected = true;
          strength = 0.7;
          evidence = 'Evidence of unexpected user behavior — a classic non-obvious PMF signal';
        }
        break;
      }
      case 'founder_time_in_wilderness': {
        if (founderDNA.domain_depth > 7 && founderDNA.resilience_evidence > 6) {
          detected = true;
          strength = 0.7;
          evidence = 'Deep domain experience + resilience markers suggest an extended immersion period before the insight';
        }
        break;
      }
      case 'regulatory_wave_signal': {
        const vp = wizardResponses.value_proposition || {};
        const whyNow = String(vp.why_now || '').toLowerCase();
        if (whyNow.match(/regulat|complian|mandate|policy|law|legislation|gdpr|sec |fda/)) {
          detected = true;
          strength = 0.85;
          evidence = 'Your timing thesis includes regulatory tailwinds — one of the strongest non-obvious market signals';
        }
        break;
      }
      case 'cofounder_complementarity': {
        if (founderDNA.cofounder_dynamics > 7) {
          detected = true;
          strength = founderDNA.cofounder_dynamics / 10;
          evidence = 'Strong co-founder dynamics suggest complementary skills';
        } else if (founderDNA.cofounder_dynamics < 4) {
          detected = true;
          strength = 0.3;
          evidence = 'Co-founder dynamics are weak — a significant risk signal for VCs';
        }
        break;
      }
    }

    return {
      signal_id: signal.id,
      signal_name: signal.name,
      detected,
      strength,
      evidence,
      impact: signal.description,
    };
  });
}

// ---------------------------------------------------------------------------
// PREDICTION ENGINE
// ---------------------------------------------------------------------------

export function generatePredictions(
  founderDNA: FounderDNAProfile,
  godScores: { team_score: number; traction_score: number; market_score: number; product_score: number; vision_score: number },
  signalScore: number,
  vcAlignments: VCAlignmentResult[],
): OraclePrediction[] {
  const predictions: OraclePrediction[] = [];
  const totalGOD = godScores.team_score + godScores.traction_score + godScores.market_score + godScores.product_score + godScores.vision_score;
  const avgGOD = totalGOD / 5;
  const topVCScore = vcAlignments[0]?.alignment_score || 0;

  // Fundraise probability
  const fundProb = Math.min(
    ((avgGOD / 100) * 0.3 + (signalScore / 10) * 0.2 + (topVCScore / 100) * 0.2 +
      (founderDNA.narrative_power / 10) * 0.15 + (founderDNA.early_traction_quality / 10) * 0.15),
    1,
  );
  predictions.push({
    type: 'fundraise_probability',
    title: `Fundraise Probability: ${Math.round(fundProb * 100)}%`,
    body: fundProb > 0.7
      ? 'Strong signals across the board. Your combination of GOD scores, signal strength, and VC alignment puts you in a favorable position to close a round.'
      : fundProb > 0.4
      ? 'Moderate signals. You have foundation but gaps remain. Focus on the signal actions below to strengthen your position before approaching investors.'
      : 'Signals need significant work. The Oracle recommends completing all wizard steps and action items before active fundraising. Build evidence first.',
    confidence: 0.65,
    signals: [
      `GOD Score average: ${avgGOD.toFixed(0)}/100`,
      `Signal Score: ${signalScore}/10`,
      `Top VC alignment: ${topVCScore}%`,
      `Narrative power: ${founderDNA.narrative_power}/10`,
    ],
    actions: fundProb > 0.7
      ? ['Begin targeted outreach to top-aligned VCs', 'Prepare warm intro requests']
      : ['Complete all Oracle wizard steps', 'Address critical signal actions first'],
  });

  // Time to close estimate
  const timeEstimate = founderDNA.network_leverage > 7 && avgGOD > 65 ? '2-4 months' :
    avgGOD > 50 ? '4-6 months' : '6-12 months';
  predictions.push({
    type: 'time_to_close',
    title: `Estimated Time to Close: ${timeEstimate}`,
    body: `Based on your current signal strength, GOD scores, and network leverage, the Oracle estimates ${timeEstimate} from first serious outreach to term sheet. This assumes you actively work on signal actions.`,
    confidence: 0.5,
    signals: [
      `Network leverage: ${founderDNA.network_leverage}/10`,
      `GOD avg: ${avgGOD.toFixed(0)}/100`,
      `Active investor conversations needed: ${founderDNA.network_leverage > 7 ? '10-15' : '20-40'}`,
    ],
    actions: [
      'Build a target list of 50+ aligned investors',
      'Secure 3-5 warm intros to start momentum',
      'Perfect your narrative before outreach begins',
    ],
  });

  // Founder-market fit assessment
  const fmfScore = (founderDNA.domain_depth * 0.3 + founderDNA.motivation_score * 0.3 +
    founderDNA.hypothesis_clarity * 0.2 + founderDNA.timing_awareness * 0.2) / 10;
  predictions.push({
    type: 'founder_market_fit',
    title: `Founder-Market Fit: ${fmfScore > 0.7 ? 'Strong' : fmfScore > 0.5 ? 'Moderate' : 'Needs Work'}`,
    body: fmfScore > 0.7
      ? 'The Oracle detects strong founder-market fit. Your domain expertise, motivation, and hypothesis clarity align well. This is one of the most important signals investors evaluate.'
      : 'Founder-market fit could be stronger. VCs want to understand WHY you are the right person to solve this particular problem. Deepen the connection between your experience and the market.',
    confidence: 0.7,
    signals: [
      `Domain depth: ${founderDNA.domain_depth}/10`,
      `Motivation clarity: ${founderDNA.motivation_score}/10`,
      `Hypothesis strength: ${founderDNA.hypothesis_clarity}/10`,
    ],
    actions: fmfScore > 0.7
      ? ['Highlight founder-market fit prominently in your pitch deck']
      : ['Document specific experiences that led to your insight', 'Strengthen your "why me" narrative'],
  });

  // Narrative gap detection
  if (founderDNA.narrative_power < 6) {
    predictions.push({
      type: 'narrative_gap',
      title: 'Narrative Gap Detected',
      body: 'Your story needs work. The Oracle detects that your pitch narrative is not yet sharp enough to cut through investor noise. A weak narrative is the #1 reason good startups fail to fundraise. This is fixable.',
      confidence: 0.8,
      signals: [
        `Narrative power: ${founderDNA.narrative_power}/10`,
        'YC, Sequoia, and a16z all weight narrative clarity heavily',
      ],
      actions: [
        'Rewrite your one-liner until it is under 15 words',
        'Practice your pitch with 5 people who will give honest feedback',
        'Record yourself and listen back — cut every unnecessary word',
      ],
    });
  }

  // Team gap warning  
  if (founderDNA.team_completeness < 5 || founderDNA.cofounder_dynamics < 5) {
    predictions.push({
      type: 'team_gap',
      title: 'Team Gap Warning',
      body: 'The Oracle flags a team completeness concern. Most VCs — especially YC, Benchmark, and Sequoia — heavily weight founding team quality. A solo technical founder or a team without complementary skills faces an uphill battle.',
      confidence: 0.75,
      signals: [
        `Team completeness: ${founderDNA.team_completeness}/10`,
        `Co-founder dynamics: ${founderDNA.cofounder_dynamics}/10`,
      ],
      actions: [
        'Identify and recruit a complementary co-founder',
        'If solo, build an advisory board that covers your blind spots',
        'Document why your current team structure is the right one for this stage',
      ],
    });
  }

  return predictions;
}

// ---------------------------------------------------------------------------
// COACHING PROMPT GENERATOR
// ---------------------------------------------------------------------------

export function generateCoachingPrompts(
  founderDNA: FounderDNAProfile,
  vcAlignments: VCAlignmentResult[],
): CoachingPrompt[] {
  const prompts: CoachingPrompt[] = [];
  const topVCs = vcAlignments.slice(0, 3);
  const topVCNames = topVCs.map((v) => v.vc_short_name);

  // Always ask the fundamental questions
  prompts.push({
    category: 'founder_dna',
    question: 'If your startup failed tomorrow, what would you do next? Would you start something in the same space?',
    why_it_matters: 'This reveals founder-market commitment. Investors want founders who will persist because the problem matters to them, not just because the startup is their current venture.',
    vc_relevance: ['All VCs'],
  });

  prompts.push({
    category: 'founder_dna',
    question: 'What is the uncomfortable truth about your market that you know but most investors do not?',
    why_it_matters: 'This is the Thiel question. The best startups are built on insights that are non-consensus AND right. Your answer reveals the depth of your market understanding.',
    vc_relevance: ['Founders Fund', 'Benchmark', 'a16z'],
  });

  // DNA-specific coaching
  if (founderDNA.primary_archetype === 'corporate_spinout') {
    prompts.push({
      category: 'founder_dna',
      question: 'What did your former employer see but structurally could not act on? What institutional constraints prevented them from solving this?',
      why_it_matters: 'Corporate spinout founders have unique insight into why big companies fail at innovation. Articulating the STRUCTURAL reason (not just "they were slow") signals deep understanding.',
      vc_relevance: ['Sequoia', 'a16z', 'Benchmark'],
    });
  }

  if (founderDNA.primary_archetype === 'hot_startup_alumni') {
    prompts.push({
      category: 'founder_dna',
      question: 'What operating playbooks from your former company will you apply here, and which will you deliberately NOT replicate?',
      why_it_matters: 'Hot startup alumni carry battle-tested playbooks. But investors also want to know you are not just pattern-matching. Show you know what transfers and what does not.',
      vc_relevance: ['YC', 'a16z', 'Founders Fund'],
    });
  }

  if (founderDNA.technical_capability < 5) {
    prompts.push({
      category: 'founder_dna',
      question: 'How will you evaluate technical talent and make architecture decisions without deep technical expertise?',
      why_it_matters: 'Non-technical founders face a specific risk: dependency on hired engineers without the ability to validate their decisions. Having a plan for this signals maturity.',
      vc_relevance: ['YC', 'Founders Fund'],
    });
  }

  // Strategy coaching based on VC alignment
  if (topVCs.length > 0) {
    const topVC = topVCs[0];
    if (topVC.gaps.length > 0) {
      prompts.push({
        category: 'vc_alignment',
        question: `Your #1 aligned VC (${topVC.vc_short_name}) has this gap in your profile: "${topVC.gaps[0]}". How will you address this before approaching them?`,
        why_it_matters: 'The Oracle identifies specific gaps that could prevent a deal. Addressing them proactively shows investor readiness and strategic thinking.',
        vc_relevance: [topVC.vc_short_name],
      });
    }
  }

  // Narrative coaching
  if (founderDNA.narrative_power < 7) {
    prompts.push({
      category: 'narrative',
      question: 'Explain what your company does to a smart 12-year-old. No jargon, no buzzwords. Just clarity.',
      why_it_matters: 'If you cannot explain it simply, investors will not remember it. The best pitches are understood in one sentence by anyone.',
      vc_relevance: topVCNames,
    });
  }

  // Execution coaching
  prompts.push({
    category: 'execution',
    question: 'What is the single most important metric for your business right now, and what are you doing THIS WEEK to move it?',
    why_it_matters: 'Focus is the scarcest resource at early stage. Knowing your ONE metric and acting on it this week signals execution velocity.',
    vc_relevance: ['YC', 'Sequoia'],
  });

  // Strategy coaching
  prompts.push({
    category: 'strategy',
    question: 'If you could only pitch 3 investors, who would they be and why? What is your ask for each?',
    why_it_matters: 'Targeted fundraising dramatically outperforms spray-and-pray. Knowing which 3 investors matter most signals strategic thinking about capital as a partnership, not just money.',
    vc_relevance: topVCNames,
  });

  return prompts;
}

// ---------------------------------------------------------------------------
// FULL ORACLE ANALYSIS — The Master Function
// ---------------------------------------------------------------------------

export async function runOracleAnalysis(
  startupId: string,
  wizardResponses: Record<string, Record<string, unknown>>,
): Promise<OracleAnalysis> {
  // 1. Get GOD scores
  const { data: startup } = await supabase
    .from('startup_uploads')
    .select('total_god_score, team_score, traction_score, market_score, product_score, vision_score')
    .eq('id', startupId)
    .single();

  const godScores = {
    team_score: startup?.team_score || 50,
    traction_score: startup?.traction_score || 50,
    market_score: startup?.market_score || 50,
    product_score: startup?.product_score || 50,
    vision_score: startup?.vision_score || 50,
  };

  // 2. Get signal score
  const { data: signals } = await supabase
    .from('startup_signal_scores')
    .select('signals_total')
    .eq('startup_id', startupId)
    .single();
  const signalScore = signals?.signals_total || 5.0;

  // 3. Analyze founder DNA
  const founderDNA = analyzeFounderDNA(wizardResponses);

  // 4. Calculate VC alignments
  const vcAlignments = calculateVCAlignments(godScores, founderDNA);

  // 5. Detect non-obvious signals
  const nonObviousSignals = detectNonObviousSignals(founderDNA, wizardResponses);

  // 6. Generate predictions
  const predictions = generatePredictions(founderDNA, godScores, signalScore, vcAlignments);

  // 7. Generate coaching prompts
  const coachingPrompts = generateCoachingPrompts(founderDNA, vcAlignments);

  // 8. Calculate overall readiness
  const avgGOD = (godScores.team_score + godScores.traction_score + godScores.market_score + godScores.product_score + godScores.vision_score) / 5;
  const topAlignment = vcAlignments[0]?.alignment_score || 0;
  const dnaComposite = (founderDNA.hypothesis_clarity + founderDNA.motivation_score + founderDNA.timing_awareness +
    founderDNA.domain_depth + founderDNA.technical_capability + founderDNA.narrative_power) / 6;

  const readinessScore = Math.round(avgGOD * 0.3 + (signalScore / 10) * 100 * 0.2 + topAlignment * 0.25 + (dnaComposite / 10) * 100 * 0.25);
  const readinessLabel = readinessScore > 75 ? 'Investor Ready' : readinessScore > 55 ? 'Getting Close' : readinessScore > 35 ? 'Building Foundation' : 'Early Stage';

  // 9. Persist results
  await Promise.all([
    // Save founder DNA
    supabase.from('oracle_founder_dna').upsert({
      startup_id: startupId,
      primary_archetype: founderDNA.primary_archetype,
      secondary_archetype: founderDNA.secondary_archetype || null,
      hypothesis_clarity: founderDNA.hypothesis_clarity,
      motivation_score: founderDNA.motivation_score,
      timing_awareness: founderDNA.timing_awareness,
      domain_depth: founderDNA.domain_depth,
      technical_capability: founderDNA.technical_capability,
      team_completeness: founderDNA.team_completeness,
      trade_secret_risk: founderDNA.trade_secret_risk,
      early_traction_quality: founderDNA.early_traction_quality,
      narrative_power: founderDNA.narrative_power,
      network_leverage: founderDNA.network_leverage,
      resilience_evidence: founderDNA.resilience_evidence,
      cofounder_dynamics: founderDNA.cofounder_dynamics,
      hypothesis_text: String(wizardResponses.value_proposition?.problem_statement || ''),
      motivation_text: String(wizardResponses.founder_dna?.motivation || ''),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'startup_id' }),

    // Save top VC alignments
    ...vcAlignments.slice(0, 6).map((va) =>
      supabase.from('oracle_vc_alignment').upsert({
        startup_id: startupId,
        vc_profile_id: va.vc_id,
        alignment_score: va.alignment_score,
        strengths: va.strengths,
        gaps: va.gaps,
        approach_strategy: va.approach_strategy,
        conviction_triggers_met: va.conviction_triggers_met,
        deal_breakers_flagged: va.deal_breakers_flagged,
        calculated_at: new Date().toISOString(),
      }, { onConflict: 'startup_id,vc_profile_id' }),
    ),

    // Save predictions
    ...predictions.map((p) =>
      supabase.from('oracle_predictions').insert({
        startup_id: startupId,
        prediction_type: p.type,
        title: p.title,
        body: p.body,
        confidence: p.confidence,
        contributing_signals: p.signals,
        recommended_actions: p.actions,
      }),
    ),
  ]);

  return {
    founder_dna: founderDNA,
    vc_alignments: vcAlignments,
    predictions,
    non_obvious_signals: nonObviousSignals,
    coaching_prompts: coachingPrompts,
    overall_readiness: {
      score: readinessScore,
      label: readinessLabel,
      summary: `Your overall fundraising readiness is ${readinessLabel} (${readinessScore}/100). ${
        readinessScore > 55
          ? 'The Oracle recommends beginning targeted investor outreach.'
          : 'Focus on completing wizard steps and signal actions before active fundraising.'
      }`,
      top_actions: predictions.flatMap((p) => p.actions).slice(0, 5),
    },
  };
}
