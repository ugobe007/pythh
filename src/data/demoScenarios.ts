// Demo Scenarios - Deterministic payloads for /demo page
// Each scenario is a curated "oh shit" moment

export interface DemoScenario {
  id: string;
  name: string;
  startup: {
    name: string;
    url: string;
    description: string;
  };
  triad: {
    position: {
      badge: 'Invisible' | 'Emerging' | 'Aligned' | 'Hot' | 'Crowded';
      score: number;
      observers_7d: number;
      momentum: 'Watch' | 'Warming' | 'Surge' | 'Breakout';
      comparable_tier: string;
    };
    flow: {
      state: 'Quiet' | 'Forming' | 'Concentrating' | 'Surging' | 'Saturated';
      score: number;
      active_investors: { visible: number; total: number };
      latest_signal_age: string;
      crowd_density: 'Low' | 'Medium' | 'High';
    };
    trajectory: {
      direction: 'Outbound' | 'Stable' | 'Incoming' | 'Strongly Incoming';
      speed: 'Slow' | 'Moderate' | 'Fast';
      forecast_window: string;
      outreach_probability: number;
    };
    alignment: {
      score: number;
      level: 'Low' | 'Medium' | 'High';
      next_best_move: string;
      impact: string[];
    };
    confidence: 'Low' | 'Medium' | 'High';
    last_updated: string;
  };
  drivers: {
    position: string[];
    flow: string[];
    trajectory: string[];
  };
  convergence: {
    visible_investors: Array<{
      name: string;
      logo: string;
      signal_score: number;
      state: 'warming' | 'surge' | 'breakout';
      evidence: string;
      signal_age: string;
    }>;
    hidden_count: number;
  };
}

export const demoScenarios: Record<string, DemoScenario> = {
  breakout: {
    id: 'breakout',
    name: 'Breakout (Strongly Incoming)',
    startup: {
      name: 'autoops.ai',
      url: 'autoops.ai',
      description: 'AI-powered DevOps automation',
    },
    triad: {
      position: {
        badge: 'Hot',
        score: 0.78,
        observers_7d: 35,
        momentum: 'Breakout',
        comparable_tier: 'Top 5% (Series A Infrastructure)',
      },
      flow: {
        state: 'Surging',
        score: 0.68,
        active_investors: { visible: 5, total: 189 },
        latest_signal_age: '4 hours ago',
        crowd_density: 'Medium',
      },
      trajectory: {
        direction: 'Strongly Incoming',
        speed: 'Fast',
        forecast_window: '7-14 days',
        outreach_probability: 73,
      },
      alignment: {
        score: 0.71,
        level: 'High',
        next_best_move: 'Publish technical proof to deepen alignment with incoming capital',
        impact: ['Alignment +8-12%', 'Direction confidence ↑', 'Forecast window expands'],
      },
      confidence: 'High',
      last_updated: '2 hours ago',
    },
    drivers: {
      position: ['GOD Score: 77 (p92)', 'Momentum: Breakout', 'Flow Alignment: 0.71'],
      flow: ['Accel ratio: 1.6x', 'Signal 24h: p92', 'Signal quality: 0.68'],
      trajectory: ['Slope 24h: +18%', 'Phase change: p96', 'Decay: Stable'],
    },
    convergence: {
      visible_investors: [
        {
          name: 'Speedinvest',
          logo: '🚀',
          signal_score: 87,
          state: 'surge',
          evidence: 'Viewed 3 portfolio-adjacent startups',
          signal_age: '4h ago',
        },
        {
          name: 'Accel',
          logo: '⚡',
          signal_score: 82,
          state: 'surge',
          evidence: 'Partner viewed company 2x',
          signal_age: '6h ago',
        },
        {
          name: 'Index Ventures',
          logo: '📊',
          signal_score: 79,
          state: 'warming',
          evidence: 'Searched "DevOps automation"',
          signal_age: '8h ago',
        },
        {
          name: 'Notion Capital',
          logo: '📝',
          signal_score: 76,
          state: 'warming',
          evidence: 'Browsed 2 comparable startups',
          signal_age: '12h ago',
        },
        {
          name: 'Point Nine',
          logo: '🎯',
          signal_score: 74,
          state: 'warming',
          evidence: 'High portfolio overlap (67%)',
          signal_age: '18h ago',
        },
      ],
      hidden_count: 184,
    },
  },

  forming: {
    id: 'forming',
    name: 'Forming (Incoming)',
    startup: {
      name: 'vanta.com',
      url: 'vanta.com',
      description: 'Automated compliance platform',
    },
    triad: {
      position: {
        badge: 'Aligned',
        score: 0.58,
        observers_7d: 18,
        momentum: 'Warming',
        comparable_tier: 'Top 25% (Series A Security)',
      },
      flow: {
        state: 'Forming',
        score: 0.42,
        active_investors: { visible: 3, total: 67 },
        latest_signal_age: '6 hours ago',
        crowd_density: 'Low',
      },
      trajectory: {
        direction: 'Incoming',
        speed: 'Moderate',
        forecast_window: '14-21 days',
        outreach_probability: 48,
      },
      alignment: {
        score: 0.62,
        level: 'Medium',
        next_best_move: 'Reposition narrative toward AI security to shift into denser capital flow',
        impact: ['Alignment +12-18%', 'Flow density ↑', 'Trajectory speed ↑'],
      },
      confidence: 'Medium',
      last_updated: '3 hours ago',
    },
    drivers: {
      position: ['GOD Score: 68 (p78)', 'Momentum: Warming', 'Flow Alignment: 0.62'],
      flow: ['Accel ratio: 1.2x', 'Signal 24h: p68', 'Signal quality: 0.55'],
      trajectory: ['Slope 24h: +8%', 'Phase change: p72', 'Decay: Slight'],
    },
    convergence: {
      visible_investors: [
        {
          name: 'Sequoia',
          logo: '🌲',
          signal_score: 84,
          state: 'warming',
          evidence: 'Viewed 2 security startups',
          signal_age: '6h ago',
        },
        {
          name: 'Greylock',
          logo: '🔒',
          signal_score: 78,
          state: 'warming',
          evidence: 'Searched "compliance automation"',
          signal_age: '9h ago',
        },
        {
          name: 'Craft Ventures',
          logo: '🛠️',
          signal_score: 72,
          state: 'warming',
          evidence: 'High portfolio overlap (58%)',
          signal_age: '14h ago',
        },
      ],
      hidden_count: 64,
    },
  },

  quiet: {
    id: 'quiet',
    name: 'Quiet (Stable)',
    startup: {
      name: 'example-startup.io',
      url: 'example-startup.io',
      description: 'B2B SaaS platform',
    },
    triad: {
      position: {
        badge: 'Emerging',
        score: 0.38,
        observers_7d: 7,
        momentum: 'Watch',
        comparable_tier: 'Top 45% (Seed SaaS)',
      },
      flow: {
        state: 'Quiet',
        score: 0.18,
        active_investors: { visible: 1, total: 22 },
        latest_signal_age: '18 hours ago',
        crowd_density: 'Low',
      },
      trajectory: {
        direction: 'Stable',
        speed: 'Slow',
        forecast_window: '30+ days',
        outreach_probability: 18,
      },
      alignment: {
        score: 0.44,
        level: 'Medium',
        next_best_move: 'Improve technical proof to increase alignment with capital flow',
        impact: ['Alignment +9-15%', 'Position score ↑', 'Signal quality ↑'],
      },
      confidence: 'Low',
      last_updated: '5 hours ago',
    },
    drivers: {
      position: ['GOD Score: 58 (p52)', 'Momentum: Watch', 'Flow Alignment: 0.44'],
      flow: ['Accel ratio: 0.9x', 'Signal 24h: p38', 'Signal quality: 0.42'],
      trajectory: ['Slope 24h: -2%', 'Phase change: p45', 'Decay: Moderate'],
    },
    convergence: {
      visible_investors: [
        {
          name: 'Anonymous Angel',
          logo: '👤',
          signal_score: 64,
          state: 'warming',
          evidence: 'Browsed similar startup',
          signal_age: '18h ago',
        },
      ],
      hidden_count: 21,
    },
  },

  crowded: {
    id: 'crowded',
    name: 'Crowded (Saturated)',
    startup: {
      name: 'ramp.com',
      url: 'ramp.com',
      description: 'Corporate card and spend management',
    },
    triad: {
      position: {
        badge: 'Crowded',
        score: 0.86,
        observers_7d: 52,
        momentum: 'Breakout',
        comparable_tier: 'Top 2% (Growth Fintech)',
      },
      flow: {
        state: 'Saturated',
        score: 0.82,
        active_investors: { visible: 8, total: 312 },
        latest_signal_age: '2 hours ago',
        crowd_density: 'High',
      },
      trajectory: {
        direction: 'Strongly Incoming',
        speed: 'Fast',
        forecast_window: '3-7 days',
        outreach_probability: 89,
      },
      alignment: {
        score: 0.78,
        level: 'High',
        next_best_move: 'Competition is high — precision positioning matters now',
        impact: ['Differentiation ↑', 'Niche clarity ↑', 'Evidence superiority ↑'],
      },
      confidence: 'High',
      last_updated: '1 hour ago',
    },
    drivers: {
      position: ['GOD Score: 88 (p98)', 'Momentum: Breakout', 'Flow Alignment: 0.78'],
      flow: ['Accel ratio: 2.1x', 'Signal 24h: p96', 'Signal quality: 0.76'],
      trajectory: ['Slope 24h: +28%', 'Phase change: p99', 'Decay: Minimal'],
    },
    convergence: {
      visible_investors: [
        {
          name: 'Stripe Capital',
          logo: '💳',
          signal_score: 94,
          state: 'breakout',
          evidence: 'Partner viewed 4x in 48h',
          signal_age: '2h ago',
        },
        {
          name: 'Ribbit Capital',
          logo: '🐸',
          signal_score: 91,
          state: 'surge',
          evidence: 'High portfolio overlap (82%)',
          signal_age: '3h ago',
        },
        {
          name: 'Coatue',
          logo: '🏔️',
          signal_score: 89,
          state: 'surge',
          evidence: 'Searched "spend management" 3x',
          signal_age: '4h ago',
        },
        {
          name: 'Tiger Global',
          logo: '🐯',
          signal_score: 87,
          state: 'surge',
          evidence: 'Viewed 5 comparable startups',
          signal_age: '5h ago',
        },
        {
          name: 'Insight Partners',
          logo: '💡',
          signal_score: 85,
          state: 'surge',
          evidence: 'Partner viewed 2x',
          signal_age: '6h ago',
        },
        {
          name: 'General Catalyst',
          logo: '⚗️',
          signal_score: 83,
          state: 'warming',
          evidence: 'Forum mention',
          signal_age: '8h ago',
        },
        {
          name: 'Bain Capital',
          logo: '📈',
          signal_score: 81,
          state: 'warming',
          evidence: 'News article engagement',
          signal_age: '10h ago',
        },
        {
          name: 'Bessemer',
          logo: '🏛️',
          signal_score: 79,
          state: 'warming',
          evidence: 'Portfolio overlap (71%)',
          signal_age: '12h ago',
        },
      ],
      hidden_count: 304,
    },
  },
};

export const defaultScenario = demoScenarios.breakout;
