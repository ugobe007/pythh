import React, { useState, useEffect, useRef } from 'react';
import { X, Brain, Zap, TrendingUp, Target, Sparkles, CheckCircle2, ArrowRight, Play, Rocket, Briefcase, Flame, DollarSign, Users, MapPin, Building2 } from 'lucide-react';
import { PYTHH_ICON_GLYPH } from '@/lib/brandAssets';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

// Color palette: purple, light blue/violet, slate blue, flame orange, blue/cyan
const COLOR_PALETTE = [
  'from-purple-500 to-violet-500',      // Purple
  'from-violet-400 to-purple-400',      // Light violet
  'from-blue-400 to-cyan-400',          // Light blue
  'from-slate-500 to-blue-500',         // Slate blue
  'from-orange-500 to-amber-500',       // Flame orange
  'from-cyan-500 to-blue-500',          // Blue/cyan
  'from-purple-600 to-violet-600',      // Dark purple
  'from-blue-500 to-indigo-500',        // Blue to indigo
  'from-violet-500 to-purple-500',      // Violet to purple
  'from-cyan-400 to-blue-400',          // Cyan to blue
  'from-slate-600 to-blue-600',         // Dark slate blue
  'from-orange-400 to-amber-400',       // Light flame orange
  'from-purple-400 to-violet-400',      // Light purple
  'from-blue-300 to-cyan-300',          // Very light blue
  'from-indigo-500 to-purple-500',      // Indigo to purple
  'from-amber-500 to-orange-500',       // Amber to orange
  'from-violet-300 to-purple-300',      // Very light violet
];

// [pyth] ai gradient colors for buttons
const HOT_MATCH_GRADIENTS = [
  'from-cyan-400 via-blue-400 to-purple-400',  // Cyan → Blue → Purple
  'from-orange-400 via-amber-400 to-orange-500', // Flame gradient
  'from-blue-500 via-cyan-500 to-blue-400',    // Blue → Cyan
  'from-purple-500 via-violet-500 to-purple-400', // Purple → Violet
  'from-cyan-300 via-blue-300 to-purple-300',  // Light gradient
];

// 15+ Algorithms that contribute to GOD Score
const ALGORITHMS = [
  { name: 'Y Combinator Framework', score: 92, color: COLOR_PALETTE[4] }, // Flame orange
  { name: 'Sequoia Capital Criteria', score: 88, color: COLOR_PALETTE[3] }, // Slate blue - FIXED
  { name: 'First Round Capital', score: 85, color: COLOR_PALETTE[5] }, // Blue/cyan
  { name: 'a16z Scoring Model', score: 90, color: COLOR_PALETTE[0] }, // Purple
  { name: 'Benchmark Evaluation', score: 87, color: COLOR_PALETTE[1] }, // Light violet
  { name: 'Greylock Methodology', score: 89, color: COLOR_PALETTE[2] }, // Light blue
  { name: 'Accel Framework', score: 86, color: COLOR_PALETTE[6] }, // Dark purple
  { name: 'Lightspeed Analysis', score: 91, color: COLOR_PALETTE[4] }, // Flame orange
  { name: 'Bessemer Evaluation', score: 84, color: COLOR_PALETTE[5] }, // Blue/cyan
  { name: 'Founders Fund Thesis', score: 93, color: COLOR_PALETTE[0] }, // Purple
  { name: 'Khosla Ventures Model', score: 82, color: COLOR_PALETTE[1] }, // Light violet
  { name: 'NEA Framework', score: 88, color: COLOR_PALETTE[3] }, // Slate blue
  { name: 'Spark Capital Model', score: 86, color: COLOR_PALETTE[7] }, // Blue to indigo
  { name: 'Felicis Methodology', score: 90, color: COLOR_PALETTE[8] }, // Violet to purple
  { name: 'Craft Ventures Framework', score: 87, color: COLOR_PALETTE[9] }, // Cyan to blue
  { name: 'Initialized Capital', score: 89, color: COLOR_PALETTE[10] }, // Dark slate blue
  { name: 'Pear VC Model', score: 85, color: COLOR_PALETTE[11] }, // Light flame orange
];

// GOD Score Dimensions
const GOD_DIMENSIONS = [
  { name: 'Team', value: 92, weight: 3.0, color: COLOR_PALETTE[5] }, // Blue/cyan
  { name: 'Traction', value: 88, weight: 3.0, color: COLOR_PALETTE[4] }, // Flame orange
  { name: 'Market', value: 91, weight: 2.0, color: COLOR_PALETTE[0] }, // Purple
  { name: 'Product', value: 89, weight: 2.0, color: COLOR_PALETTE[2] }, // Light blue
  { name: 'Vision', value: 87, weight: 2.0, color: COLOR_PALETTE[1] }, // Light violet
  { name: 'Ecosystem', value: 85, weight: 1.5, color: COLOR_PALETTE[3] }, // Slate blue
  { name: 'Grit', value: 90, weight: 1.5, color: COLOR_PALETTE[4] }, // Flame orange
  { name: 'Problem Validation', value: 86, weight: 2.0, color: COLOR_PALETTE[6] }, // Dark purple
];

type AnimationPhase = 'idle' | 'brain-pulse' | 'matching-engine' | 'algorithms-running' | 'dimensions-calculating' | 'final-score' | 'match-found';

// Different startup/investor matches to rotate through
interface DemoMatch {
  startup: {
    name: string;
    description: string;
    funding: string;
    users: string;
    location: string;
    growth: string;
    tags: string[];
  };
  investor: {
    name: string;
    type: string;
    description: string;
    aum: string;
    exits: string;
    checkSize: string;
    location: string;
    tags: string[];
  };
  score: number;
}

const DEMO_MATCHES: DemoMatch[] = [
  {
    startup: {
      name: 'FinAI',
      description: 'AI-powered personal finance assistant that helps users manage expenses, invest smarter, and achieve financial goals through machine learning.',
      funding: '$5.2M',
      users: '45K+',
      location: 'San Francisco',
      growth: '300%',
      tags: ['Series A', 'FinTech', 'AI/ML', 'B2C']
    },
    investor: {
      name: 'TechGrowth Ventures',
      type: 'Early-stage VC fund',
      description: 'Leading seed and Series A investor focused on AI, FinTech, and enterprise software. Backed 150+ companies with $2B+ in exits.',
      aum: '$500M',
      exits: '22',
      checkSize: '$1M - $5M',
      location: 'Silicon Valley & NYC',
      tags: ['Seed - Series A', 'FinTech', 'AI/ML', 'Enterprise']
    },
    score: 89
  },
  {
    startup: {
      name: 'HealthStack',
      description: 'API-first healthcare infrastructure platform that enables developers to build compliant health apps faster. Powers telehealth and remote monitoring solutions.',
      funding: '$8.5M',
      users: '120+',
      location: 'Boston',
      growth: '450%',
      tags: ['Series A', 'HealthTech', 'API', 'B2B']
    },
    investor: {
      name: 'MedTech Capital',
      type: 'Healthcare-focused VC',
      description: 'Specialized healthcare technology investor with deep expertise in digital health, medical devices, and health IT. Portfolio includes 80+ health companies.',
      aum: '$750M',
      exits: '18',
      checkSize: '$2M - $8M',
      location: 'Boston & SF',
      tags: ['Series A - B', 'HealthTech', 'Digital Health', 'B2B']
    },
    score: 92
  },
  {
    startup: {
      name: 'GreenLogistics',
      description: 'Carbon-neutral last-mile delivery platform using electric vehicles and AI routing. Serving e-commerce and enterprise clients across major cities.',
      funding: '$12M',
      users: '250+',
      location: 'Seattle',
      growth: '280%',
      tags: ['Series A', 'CleanTech', 'Logistics', 'B2B']
    },
    investor: {
      name: 'Climate Ventures',
      type: 'Climate tech fund',
      description: 'Dedicated to funding climate solutions at scale. Invests in clean energy, sustainable transportation, and circular economy startups.',
      aum: '$1.2B',
      exits: '15',
      checkSize: '$3M - $10M',
      location: 'Seattle & Bay Area',
      tags: ['Series A - B', 'CleanTech', 'Climate', 'B2B']
    },
    score: 94
  },
  {
    startup: {
      name: 'DevToolsX',
      description: '10x developer productivity platform with AI-powered code completion, debugging, and collaboration tools. Used by 500+ engineering teams.',
      funding: '$4.8M',
      users: '15K+',
      location: 'Remote',
      growth: '520%',
      tags: ['Seed', 'DevTools', 'AI', 'B2B']
    },
    investor: {
      name: 'Developer Capital',
      type: 'Developer tools VC',
      description: 'Invests exclusively in developer tools, infrastructure, and platforms that make engineering teams more productive. Portfolio includes popular open source projects.',
      aum: '$400M',
      exits: '12',
      checkSize: '$500K - $3M',
      location: 'Global',
      tags: ['Seed - A', 'DevTools', 'Infrastructure', 'Open Source']
    },
    score: 91
  },
  {
    startup: {
      name: 'EduMatch',
      description: 'AI-powered career matching platform connecting students with mentors, internships, and job opportunities based on skills and interests.',
      funding: '$3.2M',
      users: '85K+',
      location: 'New York',
      growth: '380%',
      tags: ['Seed', 'EdTech', 'AI', 'B2C']
    },
    investor: {
      name: 'Future of Work Fund',
      type: 'EdTech & HR tech VC',
      description: 'Focuses on the future of work, education technology, and platforms that help people learn and advance their careers. Strong portfolio in skills-based learning.',
      aum: '$350M',
      exits: '10',
      checkSize: '$1M - $4M',
      location: 'NYC & Austin',
      tags: ['Seed - A', 'EdTech', 'HR Tech', 'B2C']
    },
    score: 87
  },
  {
    startup: {
      name: 'SecureCloud',
      description: 'Enterprise-grade cloud security platform with zero-trust architecture. Protects multi-cloud environments for Fortune 500 companies.',
      funding: '$15M',
      users: '80+',
      location: 'Austin',
      growth: '250%',
      tags: ['Series B', 'Cybersecurity', 'Enterprise', 'B2B']
    },
    investor: {
      name: 'Security Ventures',
      type: 'Cybersecurity-focused VC',
      description: 'Leading investor in cybersecurity and enterprise security solutions. Portfolio includes multiple unicorns and successful exits in the security space.',
      aum: '$900M',
      exits: '25',
      checkSize: '$5M - $15M',
      location: 'Austin & DC',
      tags: ['Series A - C', 'Cybersecurity', 'Enterprise', 'SaaS']
    },
    score: 93
  }
];

export default function GODScoreDemo({ isOpen, onClose }: Props) {
  const [phase, setPhase] = useState<AnimationPhase>('idle');
  const [currentAlgorithm, setCurrentAlgorithm] = useState(0);
  const [algorithmsComplete, setAlgorithmsComplete] = useState<Set<number>>(new Set());
  const [dimensionsComplete, setDimensionsComplete] = useState<Set<number>>(new Set());
  const [finalScore, setFinalScore] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [brainPulse, setBrainPulse] = useState(0);
  const [matchConnection, setMatchConnection] = useState(false);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [matchUsageCount, setMatchUsageCount] = useState<Map<number, number>>(new Map());
  const scoreSectionRef = useRef<HTMLDivElement>(null);

  const currentMatch = DEMO_MATCHES[currentMatchIndex];

  useEffect(() => {
    if (!isOpen) {
      reset();
      return;
    }
  }, [isOpen]);

  const reset = () => {
    setPhase('idle');
    setCurrentAlgorithm(0);
    setAlgorithmsComplete(new Set());
    setDimensionsComplete(new Set());
    setFinalScore(0);
    setIsPlaying(false);
    setBrainPulse(0);
    setMatchConnection(false);
    // Don't rotate match on reset - let startDemo handle it
  };

  // Get next available match (one that hasn't been used 2x yet)
  const getNextMatch = () => {
    // Find matches that have been used less than 2x
    const availableMatches = DEMO_MATCHES.map((_, idx) => idx).filter(idx => {
      const usageCount = matchUsageCount.get(idx) || 0;
      return usageCount < 2;
    });

    if (availableMatches.length === 0) {
      // All matches used 2x, reset and start from beginning
      setMatchUsageCount(new Map());
      return 0;
    }

    // Pick a random available match (or cycle through)
    const randomIndex = availableMatches[Math.floor(Math.random() * availableMatches.length)];
    
    // Increment usage count
    setMatchUsageCount(prev => {
      const newCounts = new Map(prev);
      const currentCount = newCounts.get(randomIndex) || 0;
      newCounts.set(randomIndex, currentCount + 1);
      return newCounts;
    });

    return randomIndex;
  };

  const scrollToScore = () => {
    setTimeout(() => {
      scoreSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 500);
  };

  const startDemo = () => {
    // Reset phase state but keep match rotation
    setPhase('idle');
    setCurrentAlgorithm(0);
    setAlgorithmsComplete(new Set());
    setDimensionsComplete(new Set());
    setFinalScore(0);
    setBrainPulse(0);
    setMatchConnection(false);
    
    // Get next available match
    const nextMatchIdx = getNextMatch();
    const selectedMatch = DEMO_MATCHES[nextMatchIdx];
    setCurrentMatchIndex(nextMatchIdx);
    
    setIsPlaying(true);
    setPhase('brain-pulse');
    
    // Phase 1: Brain pulse animation
    setTimeout(() => {
      setPhase('matching-engine');
    }, 2000);

    // Phase 2: Show mini Matching Engine
    setTimeout(() => {
      setMatchConnection(true);
      setTimeout(() => {
        setPhase('algorithms-running');
      }, 2000);
    }, 2000);

    // Phase 3: Run algorithms sequentially
    let algoIndex = 0;
    const algoInterval = setInterval(() => {
      setCurrentAlgorithm(algoIndex);
      setAlgorithmsComplete(prev => new Set([...prev, algoIndex]));
      
      algoIndex++;
      if (algoIndex >= ALGORITHMS.length) {
        clearInterval(algoInterval);
        setTimeout(() => {
          setPhase('dimensions-calculating');
        }, 500);
      }
    }, 300);

    // Phase 4: Calculate GOD dimensions
    setTimeout(() => {
      let dimIndex = 0;
      const dimInterval = setInterval(() => {
        setDimensionsComplete(prev => new Set([...prev, dimIndex]));
        dimIndex++;
        if (dimIndex >= GOD_DIMENSIONS.length) {
          clearInterval(dimInterval);
          setTimeout(() => {
            setPhase('final-score');
            // Animate final score counting up to selected match's score
            const targetScore = selectedMatch.score;
            let score = 0;
            const scoreInterval = setInterval(() => {
              score += 2;
              if (score >= targetScore) {
                score = targetScore;
                clearInterval(scoreInterval);
                setTimeout(() => {
                  setPhase('match-found');
                  scrollToScore(); // Scroll to score section
                }, 1000);
              }
              setFinalScore(score);
            }, 30);
          }, 500);
        }
      }, 400);
    }, ALGORITHMS.length * 300 + 4000);
  };

  // Brain pulse animation
  useEffect(() => {
    if (phase === 'brain-pulse' || phase === 'matching-engine' || phase === 'algorithms-running') {
      const interval = setInterval(() => {
        setBrainPulse(prev => (prev + 1) % 4);
      }, 500);
      return () => clearInterval(interval);
    }
  }, [phase]);

  if (!isOpen) return null;
  
  const calculatedGODScore = GOD_DIMENSIONS.reduce((sum, dim, idx) => {
    if (dimensionsComplete.has(idx)) {
      return sum + (dim.value * dim.weight);
    }
    return sum;
  }, 0) / GOD_DIMENSIONS.reduce((sum, dim, idx) => {
    if (dimensionsComplete.has(idx)) {
      return sum + dim.weight;
    }
    return sum;
  }, 0);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md">
      {/* Backdrop */}
      <div 
        className="absolute inset-0"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-6xl max-h-[90vh] overflow-y-auto overflow-x-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-cyan-500/30 shadow-2xl">
        
        {/* Animated background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-cyan-500/5 to-purple-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-50 p-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 transition-all"
        >
          <X className="w-5 h-5 text-white" />
        </button>

        {/* Content */}
        <div className="relative z-10 p-8">
          
          {/* Header */}
          <div className="text-center mb-8">
            <h2 className="text-4xl md:text-5xl font-black mb-4">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400">
                How [pyth] ai Works
              </span>
            </h2>
            <p className="text-xl text-gray-400">
              Watch our <span className="text-cyan-400 font-bold">15+ proprietary algorithms</span> calculate the perfect match
            </p>
          </div>

          {/* Brain Animation Section with Cards on Each Side */}
          <div className="flex flex-col items-center mb-12">
            <div className="relative mb-8 w-full">
              {/* Mini Matching Engine - Cards on each side of brain */}
              {(phase === 'matching-engine' || phase === 'algorithms-running') && (
                <div className="mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="flex items-center justify-center gap-8 max-w-5xl mx-auto">
                    {/* Startup Card - Left Side */}
                    <div className="flex-1 max-w-sm p-5 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl border border-blue-500/30 animate-in fade-in slide-in-from-left-4">
                      <div className="flex items-center gap-2 text-blue-400 text-xs mb-3">
                        <Rocket className="w-4 h-4" />
                        <span className="font-bold uppercase">STARTUP</span>
                      </div>
                      <h3 className="text-xl font-bold text-white mb-2">{currentMatch.startup.name}</h3>
                      <p className="text-gray-300 text-sm mb-4 leading-relaxed">
                        {currentMatch.startup.description}
                      </p>
                      
                      {/* Stats */}
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center gap-2 text-gray-400 text-xs">
                          <DollarSign className="w-3.5 h-3.5 text-green-400" />
                          <span><span className="text-white font-semibold">{currentMatch.startup.funding}</span> raised</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-400 text-xs">
                          <Users className="w-3.5 h-3.5 text-blue-400" />
                          <span><span className="text-white font-semibold">{currentMatch.startup.users}</span> active users</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-400 text-xs">
                          <MapPin className="w-3.5 h-3.5 text-purple-400" />
                          <span><span className="text-white font-semibold">{currentMatch.startup.location}</span></span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-400 text-xs">
                          <TrendingUp className="w-3.5 h-3.5 text-orange-400" />
                          <span><span className="text-white font-semibold">{currentMatch.startup.growth}</span> YoY growth</span>
                        </div>
                      </div>

                      {/* Tags */}
                      <div className="flex flex-wrap gap-2">
                        {currentMatch.startup.tags.map((tag, idx) => (
                          <span key={idx} className={`px-3 py-1 rounded-full text-xs font-medium border ${
                            idx % 4 === 0 ? 'bg-blue-500/30 text-blue-300 border-blue-500/50' :
                            idx % 4 === 1 ? 'bg-purple-500/30 text-purple-300 border-purple-500/50' :
                            idx % 4 === 2 ? 'bg-cyan-500/30 text-cyan-300 border-cyan-500/50' :
                            'bg-violet-500/30 text-violet-300 border-violet-500/50'
                          }`}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Brain in Center */}
                    <div className="relative flex-shrink-0">
                      {/* Connection lines */}
                      {matchConnection && (
                        <>
                          <div className="absolute top-1/2 -left-8 w-8 h-0.5 bg-gradient-to-r from-blue-500 to-cyan-500 animate-pulse" />
                          <div className="absolute top-1/2 -right-8 w-8 h-0.5 bg-gradient-to-l from-purple-500 to-violet-500 animate-pulse" />
                        </>
                      )}
                      
                      <div className="relative">
                        <img 
                          src={PYTHH_ICON_GLYPH} 
                          alt=""
                          className={`w-32 h-32 md:w-40 md:h-40 object-contain transition-all duration-500 ${
                            phase === 'brain-pulse' || phase === 'matching-engine' || phase === 'algorithms-running'
                              ? 'filter drop-shadow-[0_0_30px_rgba(6,182,212,0.8)]'
                              : ''
                          }`}
                          style={{
                            animation: phase === 'brain-pulse' || phase === 'matching-engine' || phase === 'algorithms-running' 
                              ? `pulse-glow ${1 + brainPulse * 0.2}s ease-in-out infinite` 
                              : 'none'
                          }}
                        />
                        
                        {/* Pulsing rings */}
                        {(phase === 'brain-pulse' || phase === 'matching-engine' || phase === 'algorithms-running') && (
                          <>
                            <div className={`absolute inset-0 rounded-full border-4 border-cyan-400/30 ${brainPulse === 0 ? 'animate-ping' : 'opacity-0'}`} />
                            <div className={`absolute inset-0 rounded-full border-4 border-purple-400/30 ${brainPulse === 1 ? 'animate-ping' : 'opacity-0'}`} style={{ animationDelay: '0.25s' }} />
                            <div className={`absolute inset-0 rounded-full border-4 border-blue-400/30 ${brainPulse === 2 ? 'animate-ping' : 'opacity-0'}`} style={{ animationDelay: '0.5s' }} />
                          </>
                        )}
                      </div>
                    </div>

                    {/* VC Card - Right Side */}
                    <div className="flex-1 max-w-sm p-5 bg-gradient-to-br from-purple-500/20 to-violet-500/20 rounded-xl border border-purple-500/30 animate-in fade-in slide-in-from-right-4">
                      <div className="flex items-center gap-2 text-purple-400 text-xs mb-3">
                        <Briefcase className="w-4 h-4" />
                        <span className="font-bold uppercase">INVESTOR</span>
                      </div>
                      <h3 className="text-xl font-bold text-white mb-1">{currentMatch.investor.name}</h3>
                      <p className="text-gray-400 text-sm mb-1">{currentMatch.investor.type}</p>
                      
                      {/* Investment Focus */}
                      <div className="mb-4">
                        <p className="text-gray-300 text-sm mb-3 leading-relaxed">
                          {currentMatch.investor.description}
                        </p>
                      </div>

                      {/* Stats */}
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center gap-2 text-gray-400 text-xs">
                          <Building2 className="w-3.5 h-3.5 text-purple-400" />
                          <span><span className="text-white font-semibold">{currentMatch.investor.aum}</span> AUM</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-400 text-xs">
                          <TrendingUp className="w-3.5 h-3.5 text-green-400" />
                          <span><span className="text-white font-semibold">{currentMatch.investor.exits}</span> portfolio exits</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-400 text-xs">
                          <DollarSign className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Check size: <span className="text-white font-semibold">{currentMatch.investor.checkSize}</span></span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-400 text-xs">
                          <MapPin className="w-3.5 h-3.5 text-orange-400" />
                          <span><span className="text-white font-semibold">{currentMatch.investor.location}</span></span>
                        </div>
                      </div>

                      {/* Tags */}
                      <div className="flex flex-wrap gap-2">
                        {currentMatch.investor.tags.map((tag, idx) => (
                          <span key={idx} className={`px-3 py-1 rounded-full text-xs font-medium border ${
                            idx % 4 === 0 ? 'bg-purple-500/30 text-purple-300 border-purple-500/50' :
                            idx % 4 === 1 ? 'bg-violet-500/30 text-violet-300 border-violet-500/50' :
                            idx % 4 === 2 ? 'bg-indigo-500/30 text-indigo-300 border-indigo-500/50' :
                            'bg-blue-500/30 text-blue-300 border-blue-500/50'
                          }`}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Brain image (standalone when cards not showing) */}
              {phase !== 'matching-engine' && phase !== 'algorithms-running' && (
                <div className="flex justify-center">
                  <div className={`relative transition-all duration-500 ${
                    phase === 'brain-pulse'
                      ? 'scale-110' 
                      : 'scale-100'
                  }`}>
                    <img 
                      src={PYTHH_ICON_GLYPH} 
                      alt=""
                      className={`w-48 h-48 md:w-64 md:h-64 object-contain transition-all duration-500 ${
                        phase === 'brain-pulse'
                          ? 'filter drop-shadow-[0_0_30px_rgba(6,182,212,0.8)]'
                          : ''
                      }`}
                      style={{
                        animation: phase === 'brain-pulse'
                          ? `pulse-glow ${1 + brainPulse * 0.2}s ease-in-out infinite` 
                          : 'none'
                      }}
                    />
                    
                    {/* Pulsing rings */}
                    {phase === 'brain-pulse' && (
                      <>
                        <div className={`absolute inset-0 rounded-full border-4 border-cyan-400/30 ${brainPulse === 0 ? 'animate-ping' : 'opacity-0'}`} />
                        <div className={`absolute inset-0 rounded-full border-4 border-purple-400/30 ${brainPulse === 1 ? 'animate-ping' : 'opacity-0'}`} style={{ animationDelay: '0.25s' }} />
                        <div className={`absolute inset-0 rounded-full border-4 border-blue-400/30 ${brainPulse === 2 ? 'animate-ping' : 'opacity-0'}`} style={{ animationDelay: '0.5s' }} />
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Status text */}
              <div className="text-center mt-4">
                {phase === 'idle' && (
                  <p className="text-gray-500 text-lg">Ready to calculate...</p>
                )}
                {phase === 'brain-pulse' && (
                  <p className="text-cyan-400 text-lg font-semibold animate-pulse">Initializing AI Brain...</p>
                )}
                {phase === 'matching-engine' && (
                  <p className="text-blue-400 text-lg font-semibold">Analyzing startup and investor profiles...</p>
                )}
                {phase === 'algorithms-running' && (
                  <p className="text-purple-400 text-lg font-semibold">
                    Running {currentAlgorithm + 1} of {ALGORITHMS.length} algorithms...
                  </p>
                )}
                {phase === 'dimensions-calculating' && (
                  <p className="text-violet-400 text-lg font-semibold">Calculating GOD Score dimensions...</p>
                )}
                {phase === 'final-score' && (
                  <p className="text-green-400 text-lg font-semibold">Finalizing match score...</p>
                )}
                {phase === 'match-found' && (
                  <p className="text-yellow-400 text-lg font-semibold">✨ Perfect Match Found! ✨</p>
                )}
              </div>
            </div>
          </div>

          {/* Algorithms Grid */}
          {phase !== 'idle' && phase !== 'brain-pulse' && phase !== 'matching-engine' && (
            <div className="mb-12">
              <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                <Zap className="w-6 h-6 text-yellow-400" />
                Running 15+ Proprietary Algorithms
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-h-64 overflow-y-auto">
                {ALGORITHMS.map((algo, idx) => {
                  const isComplete = algorithmsComplete.has(idx);
                  const isRunning = idx === currentAlgorithm && phase === 'algorithms-running';
                  
                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border transition-all duration-300 ${
                        isComplete
                          ? `bg-gradient-to-br ${algo.color} border-transparent text-white`
                          : isRunning
                          ? 'bg-slate-800 border-cyan-500/50 text-cyan-400'
                          : 'bg-slate-800/50 border-white/10 text-gray-500'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold">{algo.name}</span>
                        {isComplete && (
                          <CheckCircle2 className="w-4 h-4" />
                        )}
                      </div>
                      {isComplete && (
                        <div className="text-lg font-bold">{algo.score}%</div>
                      )}
                      {isRunning && (
                        <div className="h-1 bg-cyan-500/30 rounded-full overflow-hidden">
                          <div className="h-full bg-cyan-500 animate-pulse" style={{ width: '60%' }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* GOD Score Dimensions - Scroll target */}
          <div ref={scoreSectionRef} className="mb-12">
            {(phase === 'dimensions-calculating' || phase === 'final-score' || phase === 'match-found') ? (
              <>
                <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                  <Brain className="w-6 h-6 text-purple-400" />
                  GOD Score Calculation
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {GOD_DIMENSIONS.map((dim, idx) => {
                    const isComplete = dimensionsComplete.has(idx);
                    
                    return (
                      <div
                        key={idx}
                        className={`p-4 rounded-xl border transition-all duration-500 ${
                          isComplete
                            ? `bg-gradient-to-br ${dim.color} border-transparent text-white`
                            : 'bg-slate-800/50 border-white/10 text-gray-500'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-bold">{dim.name}</span>
                          {isComplete && <CheckCircle2 className="w-4 h-4" />}
                        </div>
                        {isComplete ? (
                          <>
                            <div className="text-2xl font-black mb-1">{dim.value}</div>
                            <div className="text-xs opacity-80">Weight: {dim.weight}x</div>
                            <div className="text-xs opacity-60">Contribution: {(dim.value * dim.weight).toFixed(1)}</div>
                          </>
                        ) : (
                          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-purple-500 to-cyan-500 w-0 animate-pulse" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Calculated Score Display */}
                {(phase === 'final-score' || phase === 'match-found') && (
                  <div className="mt-8 text-center">
                    <div className="inline-flex flex-col items-center gap-4 px-12 py-8 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 rounded-2xl">
                      <div className="text-sm text-gray-400 uppercase tracking-wider">Final GOD Score</div>
                      <div className="text-6xl md:text-7xl font-black bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                        {phase === 'final-score' ? finalScore.toFixed(0) : currentMatch.score}
                      </div>
                      <div className="flex items-center gap-2 text-cyan-400">
                        <Sparkles className="w-5 h-5" />
                        <span className="text-lg font-semibold">Perfect Match!</span>
                        <Sparkles className="w-5 h-5" />
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </div>

          {/* Match Result */}
          {phase === 'match-found' && (
            <div className="mt-8 p-6 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-2xl animate-in fade-in slide-in-from-bottom-4">
              <div className="flex items-center gap-3 mb-4">
                <Target className="w-6 h-6 text-green-400" />
                <h3 className="text-2xl font-bold text-white">Perfect Match Identified</h3>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="p-4 bg-slate-800/50 rounded-xl">
                  <div className="text-sm text-gray-400 mb-2">Startup</div>
                  <div className="text-xl font-bold text-white">{currentMatch.startup.name}</div>
                  <div className="text-gray-400">{currentMatch.startup.tags[0]} • {currentMatch.startup.funding} raised</div>
                </div>
                <div className="p-4 bg-slate-800/50 rounded-xl">
                  <div className="text-sm text-gray-400 mb-2">Investor</div>
                  <div className="text-xl font-bold text-white">{currentMatch.investor.name}</div>
                  <div className="text-gray-400">Focus: {currentMatch.investor.tags.slice(0, 2).join(', ')}</div>
                </div>
              </div>
              <div className="mt-4 text-center text-gray-400 text-sm">
                Match score calculated in <span className="text-cyan-400 font-bold">&lt;2 seconds</span> using 15+ algorithms and 8 GOD dimensions
              </div>
            </div>
          )}

          {/* Controls with Gradient Buttons */}
          <div className="mt-8 flex items-center justify-center gap-4">
            {phase === 'idle' ? (
              <button
                onClick={startDemo}
                className={`flex items-center gap-2 px-8 py-4 bg-gradient-to-r ${HOT_MATCH_GRADIENTS[0]} text-white font-bold rounded-xl transition-all shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:scale-105 active:scale-95`}
              >
                <Play className="w-5 h-5" />
                Start Demo
              </button>
            ) : (
              <button
                onClick={startDemo}
                className={`flex items-center gap-2 px-8 py-4 bg-gradient-to-r ${HOT_MATCH_GRADIENTS[1]} text-white font-bold rounded-xl transition-all shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 hover:scale-105 active:scale-95`}
              >
                <Play className="w-5 h-5" />
                New Match Demo
              </button>
            )}
            <button
              onClick={onClose}
              className={`flex items-center gap-2 px-8 py-4 bg-gradient-to-r ${HOT_MATCH_GRADIENTS[2]} text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:scale-105 active:scale-95`}
            >
              Try It Yourself
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Custom animations */}
      <style>{`
        @keyframes pulse-glow {
          0%, 100% {
            filter: drop-shadow(0 0 20px rgba(6, 182, 212, 0.5));
            transform: scale(1);
          }
          50% {
            filter: drop-shadow(0 0 40px rgba(6, 182, 212, 1));
            transform: scale(1.05);
          }
        }
      `}</style>
    </div>
  );
}
