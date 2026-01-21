/**
 * INVESTOR MODULE
 * ===============
 * The moat layer - investor decision intelligence.
 */

export { default as InvestorLensPanel } from './InvestorLensPanel';
export type { 
  InvestorFingerprint, 
  InvestorSignal, 
  AlignmentExplanation,
  InvestorLensData 
} from './InvestorLensPanel';

export {
  generateInvestorFingerprint,
  generateAlignmentExplanation,
  generateInvestorLensData,
  checkAlignment
} from './investorFingerprintService';
export type { InvestorData, StartupContext } from './investorFingerprintService';
