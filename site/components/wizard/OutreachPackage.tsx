/**
 * OUTREACH PACKAGE
 * Shows LLM-generated email drafts + investment memo for each top investor.
 * Founder copies and sends manually.
 */

import { useState } from 'react';
import { Check, ChevronDown, ChevronUp, Copy, ExternalLink, Mail, User } from 'lucide-react';

interface InvestorMatch {
  id: string;
  name: string;
  firm: string;
  title: string;
  match_score: number;
  why_you_match: string;
  linkedin_url?: string;
}

interface EmailDraft {
  investor_id: string;
  investor_name: string;
  investor_firm: string;
  investor_title?: string;
  investor_linkedin?: string;
  match_score: number;
  subject: string;
  body: string;
}

interface OutreachPackageProps {
  startupName: string;
  startupWebsite?: string | null;
  startupId?: string;
  investors: InvestorMatch[];
  emailDrafts: EmailDraft[];
  memoMarkdown: string | null;
  isProvisional: boolean;
  sectionId?: string;
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 70 ? '#34d399' : score >= 55 ? '#facc15' : '#fb923c';
  const r = 14;
  const circ = 2 * Math.PI * r;
  return (
    <svg className="w-9 h-9 -rotate-90" viewBox="0 0 36 36">
      <circle cx="18" cy="18" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
      <circle
        cx="18" cy="18" r={r}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={`${circ}`}
        strokeDashoffset={`${circ * (1 - score / 100)}`}
      />
      <text
        x="18" y="18"
        dominantBaseline="central"
        textAnchor="middle"
        style={{ fontSize: '8px', fill: color, fontFamily: 'monospace', transform: 'rotate(90deg)', transformOrigin: 'center' }}
      >
        {score}
      </text>
    </svg>
  );
}

function EmailCard({ draft, defaultExpanded = false }: { draft: EmailDraft; defaultExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [copiedSubject, setCopiedSubject] = useState(false);
  const [copiedBody, setCopiedBody] = useState(false);

  const copy = (text: string, setter: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}
    >
      {/* Investor header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <User className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.4)' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white leading-tight truncate">{draft.investor_name}</p>
          <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {draft.investor_title ? `${draft.investor_title} @ ` : ''}{draft.investor_firm}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <ScoreRing score={draft.match_score} />
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-zinc-600" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-600" />}
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {/* Subject line */}
          <div className="px-4 pt-3 pb-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-semibold tracking-wide uppercase" style={{ color: 'rgba(255,255,255,0.3)' }}>Subject</span>
              <button
                onClick={() => copy(draft.subject, setCopiedSubject)}
                className="flex items-center gap-1 text-[11px] transition"
                style={{ color: copiedSubject ? '#34d399' : 'rgba(255,255,255,0.3)' }}
              >
                {copiedSubject ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copiedSubject ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="text-sm text-white">{draft.subject}</p>
          </div>

          {/* Body */}
          <div className="px-4 pt-2 pb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-semibold tracking-wide uppercase" style={{ color: 'rgba(255,255,255,0.3)' }}>Email</span>
              <button
                onClick={() => copy(draft.body, setCopiedBody)}
                className="flex items-center gap-1 text-[11px] transition"
                style={{ color: copiedBody ? '#34d399' : 'rgba(255,255,255,0.3)' }}
              >
                {copiedBody ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copiedBody ? 'Copied' : 'Copy'}
              </button>
            </div>
            <pre
              className="text-xs leading-relaxed whitespace-pre-wrap font-sans"
              style={{ color: 'rgba(255,255,255,0.55)' }}
            >
              {draft.body}
            </pre>
          </div>

          {/* Actions */}
          <div
            className="px-4 py-3 flex gap-2"
            style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
          >
            {draft.investor_linkedin && (
              <a
                href={draft.investor_linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition"
                style={{ color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <ExternalLink className="w-3 h-3" /> LinkedIn
              </a>
            )}
            <button
              onClick={() => copy(`Subject: ${draft.subject}\n\n${draft.body}`, setCopiedBody)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition"
              style={{ background: 'rgba(52,211,153,0.08)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)' }}
            >
              <Mail className="w-3 h-3" />
              Copy full email
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MemoSection({ markdown }: { markdown: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.01)' }}
    >
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <span className="text-sm font-semibold text-white">Investment Memo</span>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition"
          style={{
            color: copied ? '#34d399' : 'rgba(255,255,255,0.4)',
            border: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copied' : 'Copy markdown'}
        </button>
      </div>
      <div className="px-4 py-4 max-h-80 overflow-y-auto">
        <pre className="text-xs leading-relaxed whitespace-pre-wrap font-sans" style={{ color: 'rgba(255,255,255,0.5)' }}>
          {markdown}
        </pre>
      </div>
    </div>
  );
}

export default function OutreachPackage({
  startupName,
  startupWebsite,
  startupId,
  investors,
  emailDrafts,
  memoMarkdown,
  isProvisional,
  sectionId = 'outreach-drafts',
}: OutreachPackageProps) {
  if (investors.length === 0) {
    return (
      <div
        className="rounded-xl p-6 text-center"
        style={{ border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}
      >
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
          No investor matches found yet. Complete the wizard to generate your outreach package.
        </p>
      </div>
    );
  }

  return (
    <div id={sectionId} className="space-y-6 scroll-mt-24">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <h3
            className="text-base font-bold text-white"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Step 1 · Your email drafts
          </h3>
          {isProvisional && (
            <span
              className="text-[11px] px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(250,204,21,0.1)', color: '#facc15', border: '1px solid rgba(250,204,21,0.2)' }}
            >
              Provisional
            </span>
          )}
        </div>
        <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
          {emailDrafts.length} drafts for{' '}
          <span className="font-semibold" style={{ color: 'rgba(255,255,255,0.75)' }}>{startupName}</span>
          {startupWebsite ? <> ({startupWebsite.replace(/^https?:\/\//, '')})</> : null}.
          Tap your top match → <span className="text-emerald-400">Copy full email</span> → send from Gmail/Outlook.
        </p>
      </div>

      {/* Email drafts */}
      <div className="space-y-2">
        {emailDrafts.map((draft, i) => (
          <EmailCard key={draft.investor_id} draft={draft} defaultExpanded={i === 0} />
        ))}
      </div>

      {memoMarkdown && (
        <>
          <p className="text-[10px] font-semibold tracking-widest pt-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
            STEP 2 · INVESTMENT MEMO (optional attachment)
          </p>
          <MemoSection markdown={memoMarkdown} />
        </>
      )}

      <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.35)' }}>
        Step 3: Track responses from your{' '}
        {startupId ? (
          <a href={`/activate?startup_id=${encodeURIComponent(startupId)}`} className="underline" style={{ color: '#22d3ee' }}>
            investor match list
          </a>
        ) : (
          <span>investor match list</span>
        )}
        {' '}· or automate outreach with Oracle below.
      </p>
    </div>
  );
}
