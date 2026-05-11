/**
 * PYTHIA Email Inference Engine
 * Generates ranked email variants for VC investors based on name + firm domain.
 *
 * Priority order (most → least common at VC firms):
 *   1. firstname@domain           — e.g. sarah@sequoiacap.com
 *   2. firstname.lastname@domain  — e.g. sarah.chen@sequoiacap.com
 *   3. firstinitial.lastname@domain — e.g. s.chen@sequoiacap.com
 *   4. lastname@domain            — e.g. chen@sequoiacap.com
 *   5. firstinitiallastname@domain — e.g. schen@sequoiacap.com  (some smaller funds)
 *
 * Fallbacks (used when personal email bounces or is unknown):
 *   Pitch-specific: pitches@, deals@, dealflow@, submissions@
 *   Generic:        info@, contact@, hello@
 */

export interface EmailVariant {
  address: string;
  pattern: string;
  confidence: "high" | "medium" | "low";
  type: "personal" | "pitch" | "generic";
}

export interface InvestorEmailProfile {
  investor: string;
  firm: string;
  domain: string;
  variants: EmailVariant[];
  primaryEmail: string;
  allEmails: string[];
}

// Known domain overrides for major VC firms
const FIRM_DOMAIN_MAP: Record<string, string> = {
  "Sequoia Capital": "sequoiacap.com",
  "Andreessen Horowitz": "a16z.com",
  "a16z": "a16z.com",
  "General Catalyst": "generalcatalyst.com",
  "Accel": "accel.com",
  "Benchmark": "benchmark.com",
  "Kleiner Perkins": "kleinerperkins.com",
  "Greylock": "greylock.com",
  "Index Ventures": "indexventures.com",
  "Lightspeed Venture Partners": "lsvp.com",
  "Lightspeed": "lsvp.com",
  "NEA": "nea.com",
  "GV": "gv.com",
  "Google Ventures": "gv.com",
  "Bessemer Venture Partners": "bvp.com",
  "Bessemer": "bvp.com",
  "First Round Capital": "firstround.com",
  "First Round": "firstround.com",
  "Founders Fund": "foundersfund.com",
  "Tiger Global": "tigerglobal.com",
  "Coatue": "coatue.com",
  "Theory Ventures": "theory.vc",
  "Conviction Partners": "conviction.com",
  "Union Square Ventures": "usv.com",
  "USV": "usv.com",
  "Spark Capital": "sparkcapital.com",
  "Insight Partners": "insightpartners.com",
  "Battery Ventures": "battery.com",
  "IVP": "ivp.com",
  "Institutional Venture Partners": "ivp.com",
  "Redpoint Ventures": "redpoint.com",
  "Redpoint": "redpoint.com",
  "Ribbit Capital": "ribbitcap.com",
  "Initialized Capital": "initialized.com",
  "Y Combinator": "ycombinator.com",
  "YC": "ycombinator.com",
  "Andreessen": "a16z.com",
};

/**
 * Infer the most likely domain for a VC firm.
 * Falls back to slugifying the firm name.
 */
export function inferFirmDomain(firmName: string): string {
  if (FIRM_DOMAIN_MAP[firmName]) return FIRM_DOMAIN_MAP[firmName];

  // Slugify: lowercase, remove common suffixes, replace spaces with nothing
  const slug = firmName
    .toLowerCase()
    .replace(/\b(capital|ventures?|partners?|management|fund|group|inc\.?|llc\.?|&)\b/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();

  return `${slug}.com`;
}

/**
 * Generate all email variants for an investor.
 */
export function generateEmailVariants(
  firstName: string,
  lastName: string,
  firmName: string,
  customDomain?: string
): InvestorEmailProfile {
  const domain = customDomain ?? inferFirmDomain(firmName);

  const fn = firstName.toLowerCase().replace(/[^a-z]/g, "");
  const ln = lastName.toLowerCase().replace(/[^a-z]/g, "");
  const fi = fn.charAt(0);

  const personalVariants: EmailVariant[] = [
    {
      address: `${fn}@${domain}`,
      pattern: "firstname@",
      confidence: "high",
      type: "personal",
    },
    {
      address: `${fn}.${ln}@${domain}`,
      pattern: "firstname.lastname@",
      confidence: "high",
      type: "personal",
    },
    {
      address: `${fi}.${ln}@${domain}`,
      pattern: "firstinitial.lastname@",
      confidence: "medium",
      type: "personal",
    },
    {
      address: `${ln}@${domain}`,
      pattern: "lastname@",
      confidence: "medium",
      type: "personal",
    },
    {
      address: `${fi}${ln}@${domain}`,
      pattern: "firstinitiallastname@",
      confidence: "low",
      type: "personal",
    },
  ];

  const pitchVariants: EmailVariant[] = [
    { address: `pitches@${domain}`, pattern: "pitches@", confidence: "medium", type: "pitch" },
    { address: `deals@${domain}`, pattern: "deals@", confidence: "medium", type: "pitch" },
    { address: `dealflow@${domain}`, pattern: "dealflow@", confidence: "low", type: "pitch" },
    { address: `submissions@${domain}`, pattern: "submissions@", confidence: "low", type: "pitch" },
  ];

  const genericVariants: EmailVariant[] = [
    { address: `info@${domain}`, pattern: "info@", confidence: "low", type: "generic" },
    { address: `contact@${domain}`, pattern: "contact@", confidence: "low", type: "generic" },
    { address: `hello@${domain}`, pattern: "hello@", confidence: "low", type: "generic" },
  ];

  const allVariants = [...personalVariants, ...pitchVariants, ...genericVariants];

  return {
    investor: `${firstName} ${lastName}`,
    firm: firmName,
    domain,
    variants: allVariants,
    primaryEmail: personalVariants[0].address,
    allEmails: allVariants.map((v) => v.address),
  };
}

/**
 * Parse a full name into first/last components.
 */
export function parseName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return {
    firstName: parts[0],
    lastName: parts[parts.length - 1],
  };
}

/**
 * Convenience: generate email profile from a full name string.
 */
export function inferInvestorEmails(
  fullName: string,
  firmName: string,
  customDomain?: string
): InvestorEmailProfile {
  const { firstName, lastName } = parseName(fullName);
  return generateEmailVariants(firstName, lastName, firmName, customDomain);
}

/**
 * Format a confidence badge label.
 */
export function confidenceLabel(confidence: EmailVariant["confidence"]): string {
  return { high: "Most likely", medium: "Likely", low: "Fallback" }[confidence];
}

/**
 * Get only the top personal variants (high + medium confidence).
 */
export function getPrimaryVariants(profile: InvestorEmailProfile): EmailVariant[] {
  return profile.variants.filter(
    (v) => v.type === "personal" && (v.confidence === "high" || v.confidence === "medium")
  );
}
