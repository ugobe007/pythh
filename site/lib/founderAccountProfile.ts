/**
 * Account-page helpers — read a startup profile from the preview payload
 * without inventing team, description, or scores.
 */

export type AccountTeamMember = {
  name: string;
  role?: string;
  linkedin?: string;
};

export function readStartupDescription(startup: {
  tagline?: string | null;
  description?: string | null;
  extracted_data?: Record<string, unknown> | null;
} | null | undefined): string | null {
  if (!startup) return null;
  const ex = startup.extracted_data && typeof startup.extracted_data === 'object' ? startup.extracted_data : {};
  const candidates = [
    startup.description,
    startup.tagline,
    ex.description,
    ex.product_description,
    ex.value_proposition,
    typeof ex.pitch === 'string' ? ex.pitch : null,
  ];
  for (const value of candidates) {
    const text = String(value || '').trim();
    if (text) return text;
  }
  return null;
}

function asMember(raw: unknown): AccountTeamMember | null {
  if (typeof raw === 'string') {
    const name = raw.trim();
    return name ? { name } : null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const name = String(row.name || row.full_name || row.founder_name || '').trim();
  if (!name) return null;
  const role = String(row.role || row.title || row.position || '').trim() || undefined;
  const linkedin = String(row.linkedin_url || row.linkedin || '').trim() || undefined;
  return { name, role, linkedin };
}

export function readStartupTeam(extracted: unknown): AccountTeamMember[] {
  if (!extracted || typeof extracted !== 'object') return [];
  const ex = extracted as Record<string, unknown>;
  const buckets = [ex.founders, ex.founding_team, ex.team, ex.people, ex.team_members];
  const out: AccountTeamMember[] = [];
  const seen = new Set<string>();
  for (const bucket of buckets) {
    const list = Array.isArray(bucket) ? bucket : [];
    for (const item of list) {
      const member = asMember(item);
      if (!member) continue;
      const key = member.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(member);
    }
  }
  return out.slice(0, 8);
}

export function listSectors(sectors: unknown): string[] {
  if (Array.isArray(sectors)) {
    return sectors.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 6);
  }
  const text = String(sectors || '').trim();
  if (!text) return [];
  return text.split(/[,/|]/).map((part) => part.trim()).filter(Boolean).slice(0, 6);
}

export function truncateWhy(text: string | null | undefined, max = 140): string | null {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return null;
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trim()}…`;
}
