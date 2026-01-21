/**
 * DISCOVERY MODULE
 * ================
 * The complete founder discovery experience.
 */

export { default as DiscoverySnapshot } from './DiscoverySnapshot';
export type { 
  AlignmentStatus, 
  SignalCard, 
  AlignmentDriver, 
  InvestorMatch, 
  ExampleCard,
  DiscoveryData 
} from './DiscoverySnapshot';

export { default as ReadingSignalsLoader } from './ReadingSignalsLoader';

// Founder Return Loop components (v1.1)
export { default as AlignmentTimeline } from './AlignmentTimeline';
export type { TimelineEvent } from './AlignmentTimeline';

export { default as WhatChangedPanel } from './WhatChangedPanel';
export type { AlignmentChange } from './WhatChangedPanel';

export {
  generateDiscoveryData,
  determineAlignmentStatus,
  generateSignalCards,
  generateStrengthens,
  generateWeakens,
  generateDrivers,
  generateExamples
} from './investorSignalService';
export type { StartupAnalysis } from './investorSignalService';
