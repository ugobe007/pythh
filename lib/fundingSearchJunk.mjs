/**
 * Hunt-queue filters for paid OpenAI/Gemini funding search.
 * Suffix regex alone still lets public companies and job-board rows through.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { evaluateStartupNameForPipeline } = require('./startupNameGate.js');

/** Postgres `!~*` fragment + JS suffix test (legacy hunt-queue noise). */
export const JUNK_NAME_SUFFIX_RE =
  '(Capital|Ventures|Partners|Fund|Bank|Exchange|Studio|Investments|International|Democrats|Brands|Tennessee|Carolina|University|Calculator|Wordle|Locker|Cameron|Development|Sports|Party|Globe|More|Owner|Management|Travel|Pitch|Forge|Foundation|Avenue|Street|Music|Theft|Password|HarmonyOS|Susquehanna|Rules|Lab|Weeks|Better|Always|Markers|Max|Bucket|Live|Revier|Heidelberg|Corporation|Holdings|Universal)$';

export const JUNK_NAME_JS_RE = new RegExp(JUNK_NAME_SUFFIX_RE, 'i');

export const JUNK_WEBSITE_RE =
  /(techcrunch|forbes|bloomberg|medium|substack|youtube|linkedin|wikipedia|crunchbase|pulse2|ventureburn|pehub|finsmes|thefintechtimes|agfundernews|venturefizz|mattermark|instagram)/i;

/**
 * Exact names that passed the suffix regex and wasted OpenAI/Gemini calls
 * (public companies, shader-language tokens, pageant brands, person rows).
 */
export const EXACT_NON_STARTUP_SEARCH_NAMES = new Set([
  'tim hortons',
  'teladoc',
  'pagerduty',
  'malwarebytes',
  'miss universe',
  'spir-v',
  'spirv',
  'glsl',
  'brent kovar',
  'gavin potenza',
  'senior',
  'olin corporation',
  'dogecoin',
  'formulary financial',
  'setting boundaries',
]);

export function isJunkStartupName(name, website, extra = {}) {
  const n = String(name || '').trim();
  const w = String(website || '').trim();
  if (!n || n.length < 3) return true;
  if (EXACT_NON_STARTUP_SEARCH_NAMES.has(n.toLowerCase())) return true;
  if (JUNK_NAME_JS_RE.test(n)) return true;
  if (!w || JUNK_WEBSITE_RE.test(w)) return true;
  if (String(extra.entityGate || extra.entity_gate || '').toLowerCase() === 'junk') return true;
  const gate = evaluateStartupNameForPipeline(n);
  return !gate.ok;
}
