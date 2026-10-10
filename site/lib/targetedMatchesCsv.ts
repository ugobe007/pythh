/**
 * Spreadsheet-friendly CSV for admin targeted-match results (top N ≤ 25).
 * Includes UTF-8 BOM so Excel opens encoding correctly.
 */

export type TargetedMatchCsvRow = {
  rank: number;
  investor_id: string | null;
  match_score: number;
  fit_rank: number;
  confidence_level: string | null;
  strategy: {
    why_you_match: string[];
    why_you_match_text: string;
    reasoning: string | null;
    investment_thesis: string | null;
  };
  contact: {
    email: string | null;
    email_type: string | null;
    email_status: string | null;
    email_source: string | null;
    hunter_confidence: number | null;
    hunter_position: string | null;
    person_name: string | null;
    zero_bounce_status: string | null;
    linkedin_url: string | null;
    twitter_url: string | null;
    website: string | null;
    contactable: boolean;
  };
  investor: {
    id: string | null;
    name: string | null;
    firm: string | null;
    type: string | null;
    sectors: string[];
    stage: string | string[] | null;
    check_size_min: number | null;
    check_size_max: number | null;
    investor_tier: string | null;
    total_investments: number | null;
    last_investment_date: string | null;
  };
};

export type TargetedMatchCsvStartup = {
  id: string;
  name: string | null;
  website: string | null;
  total_god_score: number | null;
  sectors: string[];
  stage: string | string[] | null;
};

function checkSizeLabel(min: number | null, max: number | null) {
  if (min == null && max == null) return "";
  const fmt = (n: number) =>
    n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M` : `$${Math.round(n / 1000)}k`;
  if (min != null && max != null) return `${fmt(min)}–${fmt(max)}`;
  if (min != null) return `${fmt(min)}+`;
  return `up to ${fmt(max!)}`;
}

export function csvEscape(value: string) {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function stageCell(stage: string | string[] | null | undefined) {
  if (Array.isArray(stage)) return stage.join("; ");
  return stage || "";
}

const HEADERS = [
  "startup_name",
  "startup_website",
  "startup_id",
  "startup_god_score",
  "startup_sectors",
  "startup_stage",
  "rank",
  "firm",
  "investor_name",
  "investor_id",
  "investor_type",
  "investor_tier",
  "match_score",
  "fit_rank",
  "confidence",
  "email",
  "person_name",
  "email_type",
  "email_status",
  "email_source",
  "hunter_confidence",
  "hunter_position",
  "zero_bounce",
  "contactable",
  "linkedin",
  "twitter",
  "website",
  "stage",
  "sectors",
  "check_size",
  "check_size_min",
  "check_size_max",
  "total_investments",
  "last_investment_date",
  "why_you_match",
  "reasoning",
  "investment_thesis",
] as const;

export function matchesToCsv(
  matches: TargetedMatchCsvRow[],
  startup?: TargetedMatchCsvStartup | null,
): string {
  const startupName = startup?.name || "";
  const startupWebsite = startup?.website || "";
  const startupId = startup?.id || "";
  const startupGod =
    startup?.total_god_score != null ? String(Math.round(Number(startup.total_god_score))) : "";
  const startupSectors = (startup?.sectors || []).join("; ");
  const startupStage = stageCell(startup?.stage);

  const lines = [HEADERS.join(",")];
  for (const m of matches) {
    const why =
      (m.strategy.why_you_match || []).filter(Boolean).join(" | ") ||
      m.strategy.why_you_match_text ||
      "";
    lines.push(
      [
        startupName,
        startupWebsite,
        startupId,
        startupGod,
        startupSectors,
        startupStage,
        m.rank,
        m.investor.firm || "",
        m.investor.name || "",
        m.investor_id || m.investor.id || "",
        m.investor.type || "",
        m.investor.investor_tier || "",
        m.match_score,
        m.fit_rank,
        m.confidence_level || "",
        m.contact.email || "",
        m.contact.person_name || "",
        m.contact.email_type || "",
        m.contact.email_status || "",
        m.contact.email_source || "",
        m.contact.hunter_confidence ?? "",
        m.contact.hunter_position || "",
        m.contact.zero_bounce_status || "",
        m.contact.contactable ? "yes" : "no",
        m.contact.linkedin_url || "",
        m.contact.twitter_url || "",
        m.contact.website || "",
        stageCell(m.investor.stage),
        (m.investor.sectors || []).join("; "),
        checkSizeLabel(m.investor.check_size_min, m.investor.check_size_max),
        m.investor.check_size_min ?? "",
        m.investor.check_size_max ?? "",
        m.investor.total_investments ?? "",
        m.investor.last_investment_date || "",
        why,
        m.strategy.reasoning || "",
        m.strategy.investment_thesis || "",
      ]
        .map((v) => csvEscape(String(v ?? "")))
        .join(","),
    );
  }
  // BOM + CRLF: Excel on Windows/Mac opens cleanly
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export function targetedMatchesCsvFilename(startup?: TargetedMatchCsvStartup | null) {
  const slug = (startup?.name || startup?.website || startup?.id || "matches")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  const stamp = new Date().toISOString().slice(0, 10);
  return `targeted-matches-${slug || "matches"}-${stamp}.csv`;
}

export function downloadTargetedMatchesCsv(
  matches: TargetedMatchCsvRow[],
  startup?: TargetedMatchCsvStartup | null,
) {
  if (typeof document === "undefined") return;
  const blob = new Blob([matchesToCsv(matches, startup)], {
    type: "text/csv;charset=utf-8",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = targetedMatchesCsvFilename(startup);
  a.click();
  URL.revokeObjectURL(a.href);
}
