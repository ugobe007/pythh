/**
 * Pythh Canonical Verification Types v1.0.0
 * 
 * These types define the founder action → verification → scoring pipeline.
 * Every type is locked and stable across code/UI/analytics.
 */

// ============================================================================
// ACTION EVENTS (founder updates, fast lane)
// ============================================================================

export type ActionType =
  | 'product_release'
  | 'customer_closed'
  | 'revenue_change'
  | 'hiring'
  | 'press'
  | 'partnership'
  | 'fundraising'
  | 'investor_meeting'
  | 'other';

export type ImpactGuess = 'low' | 'medium' | 'high';

export type ActionStatus = 
  | 'pending'
  | 'provisional_applied'
  | 'verified'
  | 'rejected'
  | 'needs_info';

export interface ActionFields {
  mrrDeltaUsd?: number;          // +/- MRR change
  arrDeltaUsd?: number;          // +/- ARR change
  customerName?: string;         // customer or partner name
  seats?: number;                // hires or contract seats
  url?: string;                  // press link, release link, etc.
  repo?: string;                 // github repo
  amount?: number;               // generic amount
  currency?: string;             // currency code
}

export interface ActionEvent {
  id: string;                    // uuid
  startupId: string;             // uuid
  actorUserId: string;           // uuid

  type: ActionType;
  title: string;                 // short summary
  details?: string;              // optional longform description
  occurredAt: string;            // ISO (when it happened)
  submittedAt: string;           // ISO (when user filed it)

  impactGuess: ImpactGuess;

  // Optional structured fields (for scoring)
  fields?: ActionFields;

  // Evidence requirements computed at intake
  verificationPlan: VerificationPlan;

  // Current state
  status: ActionStatus;

  // Computed + audit trail
  provisionalDeltaId?: string;   // uuid ref to score_deltas
  verifiedDeltaId?: string;      // uuid ref to score_deltas
}

// ============================================================================
// EVIDENCE ARTIFACTS (proof objects)
// ============================================================================

export type EvidenceType =
  | 'oauth_connector'
  | 'webhook_event'
  | 'document_upload'
  | 'screenshot'
  | 'email_proof'
  | 'public_link'
  | 'bank_transaction'
  | 'manual_review_note';

export type VerificationTier = 
  | 'unverified'
  | 'soft_verified'
  | 'verified'
  | 'trusted';

export interface EvidenceRef {
  url?: string;
  fileKey?: string;              // storage key (S3/Supabase)
  provider?: string;             // stripe, ga4, github, plaid...
  providerEventId?: string;      // webhook event ID
  hash?: string;                 // content hash for dedupe
}

export interface EvidenceExtracted {
  flags?: string[];              // e.g. ['missing_required_connector', 'inconsistent_claims']
  amounts?: { 
    usd?: number; 
    currency?: string;
  };
  dates?: { 
    occurredAt?: string;
  };
  entities?: { 
    customer?: string; 
    product?: string;
  };
}

export interface EvidenceArtifact {
  id: string;                    // uuid
  startupId: string;             // uuid
  actionId?: string;             // uuid (optional link to action)
  type: EvidenceType;

  // What the evidence points to
  ref: EvidenceRef;

  // Machine-read extraction
  extracted?: EvidenceExtracted;

  // Trust metadata
  tier: VerificationTier;
  confidence: number;            // 0..1 (is this artifact valid?)
  createdAt: string;             // ISO
}

// ============================================================================
// VERIFICATION PLAN + STATE (the gate)
// ============================================================================

export type ConnectorProvider = 
  | 'stripe'
  | 'ga4'
  | 'github'
  | 'plaid'
  | 'hubspot'
  | 'linear'
  | 'notion';

export type DocumentType = 
  | 'invoice'
  | 'contract'
  | 'offer_letter'
  | 'press_pdf'
  | 'term_sheet'
  | 'bank_statement';

export type LinkType = 
  | 'press'
  | 'release_notes'
  | 'producthunt'
  | 'linkedin'
  | 'twitter';

export type ReviewLevel = 'light' | 'standard';

export type VerificationRequirement =
  | { kind: 'connect'; provider: ConnectorProvider }
  | { kind: 'upload'; doc: DocumentType }
  | { kind: 'link'; urlType: LinkType }
  | { kind: 'review'; level: ReviewLevel };

export interface VerificationPlan {
  // Computed from action type + magnitude + plan tier
  requirements: VerificationRequirement[];
  // How much verification is needed for full scoring
  targetVerification: number;    // 0..1 (e.g., 0.85)
  // Deadline before provisional lift decays or reverts
  verificationWindowDays: number;// e.g., 14
}

export interface VerificationState {
  actionId: string;              // uuid
  currentVerification: number;   // 0..1
  tier: VerificationTier;
  satisfied: boolean;

  missing: VerificationRequirement[];
  matchedEvidenceIds: string[];
  notes?: string;

  updatedAt: string;             // ISO
}

// ============================================================================
// SCORE SNAPSHOTS + DELTAS (auditable scoring)
// ============================================================================

export interface FeatureSnapshot {
  featureId: string;
  value: number;                 // raw value
  norm: number;                  // normalized 0..1
  weight: number;                // feature weight
  confidence: number;            // 0..1
  verification: number;          // 0..1 (from tier)
  freshness: number;             // 0..1 (time decay)
  contribution: number;          // final contribution
  updatedAt: string;             // ISO
}

export interface ScoreSnapshot {
  id: string;                    // uuid
  startupId: string;             // uuid
  asOf: string;                  // ISO timestamp
  features: Record<string, FeatureSnapshot>;
  totalSignal: number;           // sum of contributions
  totalGod: number;              // GOD score
  createdAt: string;             // ISO
}

export interface TopMover {
  featureId: string;
  delta: number;
  reasons: DeltaReason[];
  evidenceRefs?: string[];       // evidence artifact IDs
}

export type DeltaReason =
  | 'new_feature_added'
  | 'feature_removed'
  | 'signal_strength_changed'
  | 'confidence_changed'
  | 'verification_changed'
  | 'freshness_changed'
  | 'weight_changed';

export interface BlockingFactor {
  id: BlockerId;
  severity: 'hard' | 'soft';
  message: string;
  fixPath: string;
}

export interface ScoreDeltaRef {
  id: string;                    // uuid
  startupId: string;             // uuid
  prevSnapshotId: string;
  nextSnapshotId: string;

  deltaSignal: number;
  deltaGod: number;

  topMovers: TopMover[];
  blockers: BlockingFactor[];

  createdAt: string;             // ISO
}

// ============================================================================
// CANONICAL BLOCKING FACTORS (locked IDs)
// ============================================================================

export type BlockerId =
  | 'identity_not_verified'
  | 'evidence_insufficient'
  | 'recency_gap'
  | 'inconsistency_detected'
  | 'missing_required_connectors';

export const BLOCKER_CONFIG: Record<BlockerId, {
  severity: 'hard' | 'soft';
  defaultMessage: string;
  fixPath: string;
}> = {
  identity_not_verified: {
    severity: 'hard',
    message: 'Founder identity not verified',
    fixPath: '/settings/verification',
    defaultMessage: 'Verify your identity to unlock full scoring'
  },
  evidence_insufficient: {
    severity: 'soft',
    message: 'Evidence insufficient for claimed lift',
    fixPath: '/evidence',
    defaultMessage: 'Upload proof to verify your action'
  },
  recency_gap: {
    severity: 'soft',
    message: 'Data is stale',
    fixPath: '/actions/new',
    defaultMessage: 'Report recent activity to refresh your score'
  },
  inconsistency_detected: {
    severity: 'hard',
    message: 'Inconsistent claims detected',
    fixPath: '/evidence/resolve',
    defaultMessage: 'Resolve conflicting data to continue'
  },
  missing_required_connectors: {
    severity: 'soft',
    message: 'Required connectors not connected',
    fixPath: '/settings/connectors',
    defaultMessage: 'Connect required integrations for auto-verification'
  }
};

// ============================================================================
// CONNECTED SOURCES (OAuth integrations)
// ============================================================================

export type ConnectorStatus = 
  | 'connected'
  | 'pending'
  | 'error'
  | 'expired'
  | 'not_connected';

export interface ConnectedSource {
  id: string;                    // uuid
  startupId: string;             // uuid
  provider: ConnectorProvider;
  status: ConnectorStatus;
  lastSyncAt?: string;           // ISO
  expiresAt?: string;            // ISO (for OAuth tokens)
  scopes?: string[];             // OAuth scopes
  metadata?: Record<string, any>;
  createdAt: string;             // ISO
}

// ============================================================================
// GOD SCORE ADJUSTMENT RULES
// ============================================================================

/**
 * GOD adjustment formula (only trusts verified movement):
 * GOD += α·ΔSignalVerified + β·ΔTractionVerified + γ·ΔInvestorIntentVerified - penalties
 * 
 * Where:
 * - α = 0.25 (signal weight)
 * - β = 0.35 (traction weight - highest because revenue/customers)
 * - γ = 0.20 (investor intent weight)
 * - penalties = 0.5 * count of active hard blockers
 */
export const GOD_ADJUSTMENT_WEIGHTS = {
  signal: 0.25,
  traction: 0.35,
  investorIntent: 0.20,
  penaltyPerBlocker: 0.5
};

/**
 * Provisional lift caps (anti-gaming):
 * - verification_provisional = min(0.35, currentVerification)
 * - This means founder actions can never exceed 35% impact until verified
 */
export const PROVISIONAL_CAPS = {
  maxVerificationMultiplier: 0.35,
  defaultWindowDays: 14
};

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface SubmitActionRequest {
  startupId: string;
  type: ActionType;
  title: string;
  details?: string;
  occurredAt: string;
  impactGuess: ImpactGuess;
  fields?: ActionFields;
}

export interface SubmitActionResponse {
  action: ActionEvent;
  snapshot: {
    signalScore: number;
    deltaTotal: number;
  };
  nextSteps: {
    message: string;
    requirements: VerificationRequirement[];
    deadline?: string;
  };
}

export interface ScorecardData {
  signalScore: number;
  godScore: number;
  delta: {
    signal: number;
    god: number;
    direction: 'up' | 'down' | 'flat';
  };
  confidence: number;
  verification: number;
  freshness: number;
  lastUpdated: string;

  topMovers: Array<{
    featureId: string;
    label: string;
    delta: number;
    reasons: DeltaReason[];
  }>;

  blockers: BlockingFactor[];

  connectedSources: Array<{
    provider: ConnectorProvider;
    status: ConnectorStatus;
  }>;

  pendingActions: number;
  verifiedActions: number;
}

export interface EvidenceCenterData {
  connectedSources: ConnectedSource[];
  pendingEvidence: EvidenceArtifact[];
  conflicts: Array<{
    id: string;
    type: 'revenue_mismatch' | 'date_mismatch' | 'entity_mismatch';
    message: string;
    actionId?: string;
  }>;
}
