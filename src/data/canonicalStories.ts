/**
 * CANONICAL ALIGNMENT STORIES
 * ===========================
 * Hand-curated examples of how startups align with investors.
 * These are the archetypes - the patterns that teach founders how the game is played.
 * 
 * v1.1 — Added story evolution (current status, trend, durability, chapters)
 *        This is the moat: longitudinal intelligence about capital paths.
 */

import type { AlignmentStory } from '../components/gallery/AlignmentStoryCard';

export const CANONICAL_STORIES: AlignmentStory[] = [
  // TYPE 1 — TECHNICAL BREAKOUT
  {
    id: 'canonical-001',
    stage: 'seed',
    industry: 'infrastructure',
    geography: 'bay-area',
    archetype: 'technical-breakout',
    alignment_state_before: 'forming',
    alignment_state_after: 'active',
    signals_present: ['Technical credibility', 'Open-source traction', 'Founder velocity', 'Deep technical background'],
    signals_added: ['Open-source adoption'],
    startup_type_label: 'Seed-stage infrastructure startup',
    what_changed_text: 'Open-sourced core infrastructure library, gained 2,000 GitHub stars in first month, attracted contributions from engineers at hyperscalers.',
    result_text: 'Entered active monitoring by multiple infrastructure-focused seed funds within 45 days.',
    typical_investors: ['Infra seed funds', 'Deep-tech specialists', 'Operator-led micro-funds'],
    investor_names: [],
    entry_paths: ['Open-source community visibility', 'Technical blog posts', 'Conference talks'],
    signal_timeline: [
      { month: 1, event: 'Technical credibility established via founder background' },
      { month: 2, event: 'Core library shipped with documentation' },
      { month: 3, event: 'Open-sourced core infra library' },
      { month: 4, event: 'Crossed 2,000 GitHub stars, hyperscaler engineers contributing' }
    ],
    investor_reactions: [
      { type: 'Infra seed funds', action: 'began monitoring after open-source traction emerged' },
      { type: 'Deep-tech specialists', action: 'reached out after seeing hyperscaler contributions' },
      { type: 'Operator angels', action: 'made warm intros after technical blog posts gained traction' }
    ],
    timing_context: 'Open-source adoption accelerated after a technical blog post was featured on Hacker News.',
    tempo_class: 'fast',
    is_canonical: true,
    view_count: 0,
    bookmark_count: 0,
    
    // Evolution data (Sprint 2)
    current_alignment_state: 'converted',
    alignment_trend: 'stable',
    months_since_alignment: 8,
    last_investor_reaction: 'Closed seed round with lead from infra-focused fund',
    path_durability: 'high',
    chapters: [
      { chapter_number: 1, chapter_title: 'Open-source launch', chapter_summary: 'Library open-sourced, initial stars', alignment_state_at_chapter: 'forming', time_delta_months: 0 },
      { chapter_number: 2, chapter_title: 'Hyperscaler validation', chapter_summary: 'Engineers from major clouds contributing', alignment_state_at_chapter: 'active', time_delta_months: 2 },
      { chapter_number: 3, chapter_title: 'Seed closed', chapter_summary: 'Raised $4M seed from infra specialist', alignment_state_at_chapter: 'converted', time_delta_months: 6 }
    ]
  },

  // TYPE 2 — DESIGN PARTNER PATH
  {
    id: 'canonical-002',
    stage: 'seed',
    industry: 'robotics',
    geography: 'bay-area',
    archetype: 'design-partner-path',
    alignment_state_before: 'limited',
    alignment_state_after: 'forming',
    signals_present: ['Design partners', 'Founder velocity', 'Technical credibility'],
    signals_added: ['First OEM pilot'],
    startup_type_label: 'Robotics startup with hardware component',
    what_changed_text: 'Signed first OEM pilot agreement with Fortune 500 manufacturer, including joint development commitment and letter of intent for production order.',
    result_text: 'Entered deep-tech fund monitoring lists, received first inbound from hardware-focused investor.',
    typical_investors: ['Deep-tech funds', 'Hardware specialists', 'Industrial-focused VCs'],
    investor_names: [],
    entry_paths: ['Design partner referral', 'Industry conference demo', 'Operator network intro'],
    signal_timeline: [
      { month: 1, event: 'Technical prototype demonstrated' },
      { month: 3, event: 'Design partner discussions initiated with 3 OEMs' },
      { month: 5, event: 'Signed first OEM pilot agreement' },
      { month: 6, event: 'Joint development commitment formalized' }
    ],
    investor_reactions: [
      { type: 'Deep-tech funds', action: 'added to watchlist after OEM pilot announced' },
      { type: 'Hardware specialists', action: 'requested intro after seeing LOI' },
      { type: 'Industrial VCs', action: 'began due diligence process' }
    ],
    timing_context: 'Design partners matter more than revenue at this stage. OEM commitment validated market fit.',
    tempo_class: 'steady',
    is_canonical: true,
    view_count: 0,
    bookmark_count: 0,
    
    // Evolution data (Sprint 2)
    current_alignment_state: 'active',
    alignment_trend: 'improving',
    months_since_alignment: 4,
    last_investor_reaction: 'Second OEM pilot signed, moved to active DD with two funds',
    path_durability: 'moderate',
    chapters: [
      { chapter_number: 1, chapter_title: 'First OEM pilot', chapter_summary: 'Fortune 500 pilot signed', alignment_state_at_chapter: 'forming', time_delta_months: 0 },
      { chapter_number: 2, chapter_title: 'Second validation', chapter_summary: 'Additional OEM pilot confirmed market fit', alignment_state_at_chapter: 'active', time_delta_months: 4 }
    ]
  },

  // TYPE 3 — FOUNDER NETWORK PATH
  {
    id: 'canonical-003',
    stage: 'pre-seed',
    industry: 'fintech',
    geography: 'nyc',
    archetype: 'founder-network-path',
    alignment_state_before: 'limited',
    alignment_state_after: 'active',
    signals_present: ['Founder network', 'Regulatory prep', 'Domain expertise'],
    signals_added: ['Operator intro'],
    startup_type_label: 'Fintech founder with banking background',
    what_changed_text: 'Former VP of Payments at major bank made warm intro to two fintech-focused seed funds, vouching for regulatory understanding and market knowledge.',
    result_text: 'Direct outreach from both funds within one week. Moved to partner meeting within 14 days.',
    typical_investors: ['Fintech-focused seed funds', 'Operator-led funds', 'Banking-sector angels'],
    investor_names: [],
    entry_paths: ['Operator referral', 'Former colleague intro', 'Industry advisor network'],
    signal_timeline: [
      { month: 1, event: 'Domain expertise established via founder background' },
      { month: 2, event: 'Regulatory prep work completed' },
      { month: 2, event: 'Advisor intro from domain operator' },
      { month: 3, event: 'Partner meetings at two seed funds' }
    ],
    investor_reactions: [
      { type: 'Fintech seed funds', action: 'responded immediately to operator intro' },
      { type: 'Operator-led funds', action: 'prioritized based on referral quality' }
    ],
    timing_context: 'Operator networks are powerful entry paths in regulated industries where trust and expertise matter.',
    tempo_class: 'fast',
    is_canonical: true,
    view_count: 0,
    bookmark_count: 0,
    
    // Evolution data (Sprint 2)
    current_alignment_state: 'converted',
    alignment_trend: 'stable',
    months_since_alignment: 5,
    last_investor_reaction: 'Closed pre-seed, now building toward seed',
    path_durability: 'high',
    chapters: [
      { chapter_number: 1, chapter_title: 'Operator intro', chapter_summary: 'Warm intro from industry operator', alignment_state_at_chapter: 'active', time_delta_months: 0 },
      { chapter_number: 2, chapter_title: 'Pre-seed closed', chapter_summary: 'Raised from fintech-focused fund', alignment_state_at_chapter: 'converted', time_delta_months: 3 }
    ]
  },

  // TYPE 4 — TIMING FAILURE (VERY IMPORTANT — teaches what NOT to do)
  {
    id: 'canonical-004',
    stage: 'seed',
    industry: 'ai',
    geography: 'remote',
    archetype: 'timing-failure',
    alignment_state_before: 'forming',
    alignment_state_after: 'limited',
    signals_present: ['Product velocity', 'Technical credibility'],
    signals_added: [],
    startup_type_label: 'AI tools startup',
    what_changed_text: 'Reached out to investors before completing technical validation. Demo failed during partner meeting due to unresolved edge cases.',
    result_text: 'Screening dropped, alignment weakened. Fund passed and noted "too early" for 6-month follow-up.',
    typical_investors: ['AI-focused funds', 'Enterprise software VCs'],
    investor_names: [],
    entry_paths: ['Cold outreach', 'Premature pitch'],
    signal_timeline: [
      { month: 1, event: 'Product velocity present' },
      { month: 2, event: 'Premature outreach to investors' },
      { month: 2, event: 'Demo failed during partner meeting' },
      { month: 3, event: 'Fund passed, 6-month hold period' }
    ],
    investor_reactions: [
      { type: 'AI-focused funds', action: 'passed after demo failure, added 6-month hold' },
      { type: 'Enterprise VCs', action: 'declined meeting after hearing about failed demo' }
    ],
    timing_context: 'Timing matters more than enthusiasm. Premature outreach can create lasting negative signals.',
    tempo_class: 'fast',
    is_canonical: true,
    view_count: 0,
    bookmark_count: 0,
    
    // Evolution data (Sprint 2) — THIS IS A WARNING STORY
    current_alignment_state: 'fading',
    alignment_trend: 'stable',
    months_since_alignment: 7,
    last_investor_reaction: 'Still in 6-month hold period, working to rebuild',
    path_durability: 'fragile',
    chapters: [
      { chapter_number: 1, chapter_title: 'Premature pitch', chapter_summary: 'Pitched before product was ready', alignment_state_at_chapter: 'forming', time_delta_months: 0 },
      { chapter_number: 2, chapter_title: 'Demo failure', chapter_summary: 'Failed demo, 6-month hold imposed', alignment_state_at_chapter: 'limited', time_delta_months: 1 },
      { chapter_number: 3, chapter_title: 'Rebuilding', chapter_summary: 'Working on product, waiting out hold period', alignment_state_at_chapter: 'fading', time_delta_months: 7 }
    ]
  },

  // TYPE 5 — ENTERPRISE TRACTION
  {
    id: 'canonical-005',
    stage: 'seed',
    industry: 'enterprise',
    geography: 'bay-area',
    archetype: 'enterprise-traction',
    alignment_state_before: 'forming',
    alignment_state_after: 'active',
    signals_present: ['Sales motion', 'Enterprise pipeline', 'Founder credibility'],
    signals_added: ['First enterprise contract'],
    startup_type_label: 'Enterprise SaaS startup',
    what_changed_text: 'Closed first $100K+ enterprise contract with 3-year commitment. Customer agreed to serve as reference and co-develop case study.',
    result_text: 'Became visible to enterprise-focused seed funds. Three inbounds within 30 days of announcing customer.',
    typical_investors: ['Enterprise seed funds', 'B2B software specialists', 'Former operator funds'],
    investor_names: [],
    entry_paths: ['Customer reference call', 'Case study publication', 'Enterprise network'],
    signal_timeline: [
      { month: 1, event: 'Founder credibility from enterprise background' },
      { month: 3, event: 'Enterprise pipeline built with 5 qualified opportunities' },
      { month: 4, event: 'First $100K+ contract closed' },
      { month: 5, event: 'Customer reference and case study completed' }
    ],
    investor_reactions: [
      { type: 'Enterprise seed funds', action: 'requested customer reference call' },
      { type: 'B2B specialists', action: 'moved to partner meeting after case study' }
    ],
    timing_context: 'Enterprise contract with reference customer is strong validation signal.',
    tempo_class: 'steady',
    is_canonical: true,
    view_count: 0,
    bookmark_count: 0,
    
    // Evolution data (Sprint 2)
    current_alignment_state: 'converted',
    alignment_trend: 'stable',
    months_since_alignment: 6,
    last_investor_reaction: 'Closed $5M seed round',
    path_durability: 'high',
    chapters: [
      { chapter_number: 1, chapter_title: 'First enterprise deal', chapter_summary: '$100K+ contract with reference', alignment_state_at_chapter: 'active', time_delta_months: 0 },
      { chapter_number: 2, chapter_title: 'Pipeline expanded', chapter_summary: 'Three more enterprise deals in pipeline', alignment_state_at_chapter: 'active', time_delta_months: 2 },
      { chapter_number: 3, chapter_title: 'Seed closed', chapter_summary: 'Raised from enterprise-focused fund', alignment_state_at_chapter: 'converted', time_delta_months: 4 }
    ]
  },

  // TYPE 6 — CONSUMER VIRAL GROWTH
  {
    id: 'canonical-006',
    stage: 'seed',
    industry: 'consumer',
    geography: 'nyc',
    archetype: 'viral-growth',
    alignment_state_before: 'limited',
    alignment_state_after: 'active',
    signals_present: ['Viral mechanics', 'User engagement', 'Product-led growth'],
    signals_added: ['TikTok virality'],
    startup_type_label: 'Consumer social app',
    what_changed_text: 'Organic TikTok video drove 50K downloads in one weekend. Retention metrics showed 40% D7 retention without paid marketing.',
    result_text: 'Three consumer-focused funds reached out within 48 hours. Entered competitive process.',
    typical_investors: ['Consumer seed funds', 'Social app specialists', 'Growth-focused VCs'],
    investor_names: [],
    entry_paths: ['Viral moment', 'App store ranking', 'User-generated content'],
    signal_timeline: [
      { month: 1, event: 'Product-led growth mechanics in place' },
      { month: 2, event: 'User engagement metrics improving' },
      { month: 3, event: 'Organic TikTok video went viral' },
      { month: 3, event: '50K downloads, 40% D7 retention' }
    ],
    investor_reactions: [
      { type: 'Consumer funds', action: 'reached out within 48 hours of viral moment' },
      { type: 'Social specialists', action: 'requested metrics call same day' }
    ],
    timing_context: 'Viral moments create urgency. Retention metrics validate that growth is sustainable.',
    tempo_class: 'fast',
    is_canonical: true,
    view_count: 0,
    bookmark_count: 0,
    
    // Evolution data (Sprint 2) — FRAGILE PATH WARNING
    current_alignment_state: 'fading',
    alignment_trend: 'fading',
    months_since_alignment: 5,
    last_investor_reaction: 'Retention dropped after initial spike, investors paused',
    path_durability: 'fragile',
    chapters: [
      { chapter_number: 1, chapter_title: 'Viral moment', chapter_summary: '50K downloads, strong D7 retention', alignment_state_at_chapter: 'active', time_delta_months: 0 },
      { chapter_number: 2, chapter_title: 'Retention challenge', chapter_summary: 'D30 retention fell below 15%, investors noticed', alignment_state_at_chapter: 'fading', time_delta_months: 3 },
      { chapter_number: 3, chapter_title: 'Rebuilding retention', chapter_summary: 'Product iteration, metrics stabilizing', alignment_state_at_chapter: 'fading', time_delta_months: 5 }
    ]
  },

  // TYPE 7 — HEALTHCARE REGULATORY MILESTONE
  {
    id: 'canonical-007',
    stage: 'seed',
    industry: 'healthcare',
    geography: 'bay-area',
    archetype: 'regulatory-milestone',
    alignment_state_before: 'forming',
    alignment_state_after: 'active',
    signals_present: ['Clinical credibility', 'Regulatory expertise', 'KOL relationships'],
    signals_added: ['FDA pre-submission meeting'],
    startup_type_label: 'Digital health therapeutic',
    what_changed_text: 'Completed successful FDA pre-submission meeting with clear pathway to De Novo authorization. Agency feedback was favorable with minor protocol adjustments.',
    result_text: 'Healthcare-focused funds that previously passed re-engaged. Two term sheets within 60 days.',
    typical_investors: ['Healthcare seed funds', 'Digital health specialists', 'Biotech-adjacent VCs'],
    investor_names: [],
    entry_paths: ['KOL introduction', 'Clinical advisor network', 'Regulatory consultant referral'],
    signal_timeline: [
      { month: 1, event: 'Clinical credibility established via advisor network' },
      { month: 3, event: 'Regulatory strategy developed with FDA consultants' },
      { month: 5, event: 'FDA pre-submission meeting completed' },
      { month: 6, event: 'Clear regulatory pathway established' }
    ],
    investor_reactions: [
      { type: 'Healthcare funds', action: 're-engaged after FDA meeting results' },
      { type: 'Digital health specialists', action: 'moved to term sheet discussions' }
    ],
    timing_context: 'In healthcare, regulatory clarity de-risks the investment. FDA pre-sub meetings are major milestones.',
    tempo_class: 'slow',
    is_canonical: true,
    view_count: 0,
    bookmark_count: 0,
    
    // Evolution data (Sprint 2)
    current_alignment_state: 'active',
    alignment_trend: 'stable',
    months_since_alignment: 3,
    last_investor_reaction: 'In final diligence, expecting close within 30 days',
    path_durability: 'high',
    chapters: [
      { chapter_number: 1, chapter_title: 'FDA pre-sub', chapter_summary: 'Successful pre-submission meeting', alignment_state_at_chapter: 'active', time_delta_months: 0 },
      { chapter_number: 2, chapter_title: 'Term sheets', chapter_summary: 'Two competitive term sheets received', alignment_state_at_chapter: 'active', time_delta_months: 2 }
    ]
  },

  // TYPE 8 — CLIMATE IMPACT
  {
    id: 'canonical-008',
    stage: 'seed',
    industry: 'climate',
    geography: 'europe',
    archetype: 'climate-impact',
    alignment_state_before: 'forming',
    alignment_state_after: 'active',
    signals_present: ['Technical credibility', 'Impact metrics', 'Pilot deployments'],
    signals_added: ['Carbon credit revenue'],
    startup_type_label: 'Climate tech startup with hardware',
    what_changed_text: 'First pilot deployment generated verified carbon credits with third-party validation. Revenue from credits covered 30% of pilot costs.',
    result_text: 'Climate-focused funds moved from monitoring to active engagement. Entered due diligence with two funds.',
    typical_investors: ['Climate tech funds', 'Impact-focused VCs', 'Corporate climate ventures'],
    investor_names: [],
    entry_paths: ['Climate conference demo', 'Impact report publication', 'Corporate sustainability intro'],
    signal_timeline: [
      { month: 1, event: 'Technical credibility established' },
      { month: 3, event: 'First pilot deployment completed' },
      { month: 4, event: 'Carbon credits generated with third-party validation' },
      { month: 5, event: 'Credit revenue demonstrated' }
    ],
    investor_reactions: [
      { type: 'Climate tech funds', action: 'moved from monitoring to active engagement' },
      { type: 'Impact VCs', action: 'requested detailed impact metrics' }
    ],
    timing_context: 'Verified carbon credits with revenue demonstrates both impact and commercial viability.',
    tempo_class: 'steady',
    is_canonical: true,
    view_count: 0,
    bookmark_count: 0,
    
    // Evolution data (Sprint 2)
    current_alignment_state: 'converted',
    alignment_trend: 'stable',
    months_since_alignment: 7,
    last_investor_reaction: 'Closed seed with climate specialist fund',
    path_durability: 'moderate',
    chapters: [
      { chapter_number: 1, chapter_title: 'Carbon validation', chapter_summary: 'First verified carbon credits', alignment_state_at_chapter: 'active', time_delta_months: 0 },
      { chapter_number: 2, chapter_title: 'Scale pilot', chapter_summary: 'Larger deployment, more credits', alignment_state_at_chapter: 'active', time_delta_months: 3 },
      { chapter_number: 3, chapter_title: 'Seed closed', chapter_summary: 'Climate specialist fund led', alignment_state_at_chapter: 'converted', time_delta_months: 6 }
    ]
  },

  // TYPE 9 — DEVTOOLS ADOPTION
  {
    id: 'canonical-009',
    stage: 'seed',
    industry: 'devtools',
    geography: 'remote',
    archetype: 'devtools-adoption',
    alignment_state_before: 'limited',
    alignment_state_after: 'forming',
    signals_present: ['Technical credibility', 'Developer community', 'Usage metrics'],
    signals_added: ['Production usage at known company'],
    startup_type_label: 'Developer tools startup',
    what_changed_text: 'Engineering team at well-known tech company adopted tool in production, shared positive feedback on Twitter, became informal advocates.',
    result_text: 'Devtools-focused funds began tracking. Two requests for intro calls within one month.',
    typical_investors: ['Devtools specialists', 'Developer-first VCs', 'Technical founder funds'],
    investor_names: [],
    entry_paths: ['Twitter developer advocacy', 'Hacker News visibility', 'Open-source community'],
    signal_timeline: [
      { month: 1, event: 'Technical credibility from founder background' },
      { month: 2, event: 'Developer community starting to form' },
      { month: 3, event: 'Production adoption at known tech company' },
      { month: 4, event: 'Organic advocacy on Twitter' }
    ],
    investor_reactions: [
      { type: 'Devtools specialists', action: 'began tracking after Twitter visibility' },
      { type: 'Developer-first VCs', action: 'requested intro after production usage confirmed' }
    ],
    timing_context: 'Production usage at known company is strong signal. Organic advocacy creates momentum.',
    tempo_class: 'fast',
    is_canonical: true,
    view_count: 0,
    bookmark_count: 0,
    
    // Evolution data (Sprint 2)
    current_alignment_state: 'active',
    alignment_trend: 'improving',
    months_since_alignment: 4,
    last_investor_reaction: 'Two funds moved to partner meetings',
    path_durability: 'moderate',
    chapters: [
      { chapter_number: 1, chapter_title: 'Production adoption', chapter_summary: 'Known tech company in production', alignment_state_at_chapter: 'forming', time_delta_months: 0 },
      { chapter_number: 2, chapter_title: 'Community growth', chapter_summary: 'Developer advocacy expanding', alignment_state_at_chapter: 'active', time_delta_months: 3 }
    ]
  },

  // TYPE 10 — PRE-SEED SIGNAL BUILD
  {
    id: 'canonical-010',
    stage: 'pre-seed',
    industry: 'ai',
    geography: 'bay-area',
    archetype: 'signal-build',
    alignment_state_before: 'limited',
    alignment_state_after: 'forming',
    signals_present: ['Founder credibility', 'Technical depth', 'Market timing'],
    signals_added: ['Waitlist growth'],
    startup_type_label: 'Pre-seed AI startup building in stealth',
    what_changed_text: 'Landing page with demo video generated 3,000 waitlist signups in two weeks. 40% of signups were from target ICP companies.',
    result_text: 'Pre-seed funds that typically avoid stealth companies expressed interest based on waitlist quality.',
    typical_investors: ['Pre-seed specialists', 'AI-focused angels', 'Stealth-friendly funds'],
    investor_names: [],
    entry_paths: ['Product Hunt launch', 'Demo video sharing', 'Founder network referral'],
    signal_timeline: [
      { month: 1, event: 'Founder credibility established' },
      { month: 2, event: 'Landing page with demo video launched' },
      { month: 2, event: '3,000 waitlist signups in two weeks' },
      { month: 3, event: '40% ICP conversion validated' }
    ],
    investor_reactions: [
      { type: 'Pre-seed specialists', action: 'expressed interest based on waitlist quality' },
      { type: 'AI-focused angels', action: 'requested demo access' }
    ],
    timing_context: 'At pre-seed, signal quality matters more than quantity. ICP conversion rate is key metric.',
    tempo_class: 'fast',
    is_canonical: true,
    view_count: 0,
    bookmark_count: 0,
    
    // Evolution data (Sprint 2)
    current_alignment_state: 'converted',
    alignment_trend: 'stable',
    months_since_alignment: 6,
    last_investor_reaction: 'Closed pre-seed, building toward launch',
    path_durability: 'moderate',
    chapters: [
      { chapter_number: 1, chapter_title: 'Waitlist launch', chapter_summary: '3K signups with 40% ICP', alignment_state_at_chapter: 'forming', time_delta_months: 0 },
      { chapter_number: 2, chapter_title: 'Pre-seed closed', chapter_summary: 'Raised from AI-focused angels', alignment_state_at_chapter: 'converted', time_delta_months: 4 }
    ]
  },

  // TYPE 11 — FOUNDER BACKGROUND BREAKOUT
  {
    id: 'canonical-011',
    stage: 'pre-seed',
    industry: 'enterprise',
    geography: 'bay-area',
    archetype: 'founder-background',
    alignment_state_before: 'limited',
    alignment_state_after: 'active',
    signals_present: ['Founder credibility', 'Domain expertise', 'Network'],
    signals_added: ['Previous exit'],
    startup_type_label: 'Second-time founder from successful exit',
    what_changed_text: 'Previous company acquisition by Fortune 500 closed. Founder announced new venture with clear thesis and assembled strong initial team.',
    result_text: 'Inbound interest from 8 funds within first week of announcement. Pre-seed round oversubscribed.',
    typical_investors: ['Multi-stage funds', 'Repeat founder backers', 'Enterprise-focused VCs'],
    investor_names: [],
    entry_paths: ['Announcement timing', 'Previous investor relationships', 'Network activation'],
    signal_timeline: [
      { month: 1, event: 'Previous acquisition closed' },
      { month: 1, event: 'New venture announced with clear thesis' },
      { month: 2, event: 'Strong initial team assembled' },
      { month: 2, event: 'Pre-seed round closed, oversubscribed' }
    ],
    investor_reactions: [
      { type: 'Multi-stage funds', action: 'proactively reached out for pre-seed allocation' },
      { type: 'Previous backers', action: 'committed immediately to new venture' }
    ],
    timing_context: 'Second-time founders with exits have accelerated fundraising. Signal is founder track record.',
    tempo_class: 'fast',
    is_canonical: true,
    view_count: 0,
    bookmark_count: 0,
    
    // Evolution data (Sprint 2)
    current_alignment_state: 'converted',
    alignment_trend: 'stable',
    months_since_alignment: 4,
    last_investor_reaction: 'Pre-seed closed, strong seed interest already',
    path_durability: 'high',
    chapters: [
      { chapter_number: 1, chapter_title: 'Exit announcement', chapter_summary: 'Acquisition closed, new venture announced', alignment_state_at_chapter: 'active', time_delta_months: 0 },
      { chapter_number: 2, chapter_title: 'Oversubscribed round', chapter_summary: 'Pre-seed 3x oversubscribed', alignment_state_at_chapter: 'converted', time_delta_months: 1 }
    ]
  },

  // TYPE 12 — PIVOT RECOVERY
  {
    id: 'canonical-012',
    stage: 'seed',
    industry: 'fintech',
    geography: 'nyc',
    archetype: 'pivot-recovery',
    alignment_state_before: 'limited',
    alignment_state_after: 'forming',
    signals_present: ['Founder resilience', 'Market learning', 'New traction'],
    signals_added: ['Pivot with early validation'],
    startup_type_label: 'Fintech startup post-pivot',
    what_changed_text: 'Pivoted from B2C to B2B after 8 months of struggle. New enterprise product signed 3 pilots within 6 weeks of launch.',
    result_text: 'Investors who previously passed re-engaged. One investor cited "impressive pivot execution" as reason for new interest.',
    typical_investors: ['Pivot-friendly VCs', 'Fintech specialists', 'Enterprise-focused funds'],
    investor_names: [],
    entry_paths: ['Transparent founder update', 'New traction metrics', 'Investor re-engagement'],
    signal_timeline: [
      { month: 1, event: 'B2C model struggling' },
      { month: 8, event: 'Decision to pivot to B2B' },
      { month: 10, event: 'New B2B product launched' },
      { month: 11, event: '3 enterprise pilots signed' }
    ],
    investor_reactions: [
      { type: 'Previous investors who passed', action: 're-engaged based on pivot execution' },
      { type: 'Fintech specialists', action: 'interested in B2B positioning' }
    ],
    timing_context: 'Pivot execution quality matters. Fast validation of new direction creates positive signal.',
    tempo_class: 'steady',
    is_canonical: true,
    view_count: 0,
    bookmark_count: 0,
    
    // Evolution data (Sprint 2)
    current_alignment_state: 'active',
    alignment_trend: 'improving',
    months_since_alignment: 3,
    last_investor_reaction: 'Two funds in active diligence',
    path_durability: 'moderate',
    chapters: [
      { chapter_number: 1, chapter_title: 'Pivot executed', chapter_summary: 'B2B pivot with 3 pilots', alignment_state_at_chapter: 'forming', time_delta_months: 0 },
      { chapter_number: 2, chapter_title: 'Validation growing', chapter_summary: 'Pilots converting to contracts', alignment_state_at_chapter: 'active', time_delta_months: 3 }
    ]
  }
];

// ============================================
// PATH DURABILITY STATS BY ARCHETYPE
// ============================================
// These are the computed stats for each archetype path
// Based on story outcomes tracked over time
export const PATH_DURABILITY_BY_ARCHETYPE: Record<string, {
  durability: 'high' | 'moderate' | 'fragile';
  sustainRate3m: number;
  sustainRate6m: number;
  convertRate: number;
  fadedRate: number;
  insight: string;
}> = {
  'technical-breakout': {
    durability: 'high',
    sustainRate3m: 85,
    sustainRate6m: 72,
    convertRate: 65,
    fadedRate: 12,
    insight: 'Open-source traction creates lasting visibility. Investors track GitHub activity continuously.'
  },
  'design-partner-path': {
    durability: 'moderate',
    sustainRate3m: 70,
    sustainRate6m: 55,
    convertRate: 48,
    fadedRate: 22,
    insight: 'Design partner relationships can stall. Conversion to paid contract is key milestone.'
  },
  'founder-network-path': {
    durability: 'high',
    sustainRate3m: 88,
    sustainRate6m: 78,
    convertRate: 72,
    fadedRate: 8,
    insight: 'Strong network intros create persistent interest. Relationship-driven investors stay engaged.'
  },
  'timing-failure': {
    durability: 'fragile',
    sustainRate3m: 25,
    sustainRate6m: 15,
    convertRate: 10,
    fadedRate: 68,
    insight: 'Premature outreach creates lasting negative signals. Recovery requires significant new traction.'
  },
  'enterprise-traction': {
    durability: 'high',
    sustainRate3m: 82,
    sustainRate6m: 74,
    convertRate: 68,
    fadedRate: 10,
    insight: 'Enterprise contracts create durable signals. Reference customers validate repeatedly.'
  },
  'viral-growth': {
    durability: 'fragile',
    sustainRate3m: 45,
    sustainRate6m: 28,
    convertRate: 32,
    fadedRate: 48,
    insight: 'Viral moments fade quickly. Retention metrics determine if attention converts to investment.'
  },
  'regulatory-milestone': {
    durability: 'high',
    sustainRate3m: 90,
    sustainRate6m: 85,
    convertRate: 75,
    fadedRate: 5,
    insight: 'Regulatory milestones create permanent de-risking. Investors track FDA/EMA progress closely.'
  },
  'climate-impact': {
    durability: 'moderate',
    sustainRate3m: 72,
    sustainRate6m: 60,
    convertRate: 52,
    fadedRate: 18,
    insight: 'Climate investors are patient but need verified metrics. Carbon credit revenue is key signal.'
  },
  'devtools-adoption': {
    durability: 'moderate',
    sustainRate3m: 68,
    sustainRate6m: 52,
    convertRate: 45,
    fadedRate: 25,
    insight: 'Developer advocacy compounds but requires sustained community effort.'
  },
  'signal-build': {
    durability: 'moderate',
    sustainRate3m: 65,
    sustainRate6m: 48,
    convertRate: 55,
    fadedRate: 20,
    insight: 'Pre-seed signals need to convert to product traction. Waitlist quality matters more than size.'
  },
  'founder-background': {
    durability: 'high',
    sustainRate3m: 92,
    sustainRate6m: 88,
    convertRate: 85,
    fadedRate: 4,
    insight: 'Second-time founder signal is permanent. Previous exit creates lasting investor confidence.'
  },
  'pivot-recovery': {
    durability: 'moderate',
    sustainRate3m: 58,
    sustainRate6m: 45,
    convertRate: 42,
    fadedRate: 32,
    insight: 'Pivot recovery depends on execution speed. Fast validation of new direction is critical.'
  }
};