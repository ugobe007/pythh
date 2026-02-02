import React, { useMemo, useState } from "react";
import type { InvestorMatch, StartupSignal } from "../../types/results.types";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] text-white/60">{children}</div>;
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none
                 focus:border-white/20"
    />
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none
                 focus:border-white/20"
    />
  );
}

function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = "", ...rest } = props;
  return (
    <button
      {...rest}
      className={
        "rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 hover:bg-white/8 " +
        className
      }
    />
  );
}

function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = "", ...rest } = props;
  return (
    <button
      {...rest}
      className={
        "rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/15 " +
        className
      }
    />
  );
}

function extractFirmName(subtitle: string | undefined): string | null {
  if (!subtitle) return null;
  // Extract firm name from subtitle (e.g., "Partner @ Sequoia Capital" → "sequoiacapital")
  const match = subtitle.match(/@\s*([^,]+)/);
  if (!match) return null;
  return match[1].trim().toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
}

function generateEmailSuggestions(investorName: string, subtitle: string | undefined): string[] {
  const firmName = extractFirmName(subtitle);
  if (!firmName) return [];
  
  const extensions = ['com', 'net', 'io', 'co', 'ai'];
  return extensions.map(ext => `info@${firmName}.${ext}`);
}

function buildEmailDraft(args: {
  founderName: string;
  startupName: string;
  investorName: string;
  investorSubtitle: string | undefined;
  why: string;
  signalSummary: string;
  ask: string;
}) {
  const { founderName, startupName, investorName, investorSubtitle, why, signalSummary, ask } = args;
  
  const emailSuggestions = generateEmailSuggestions(investorName, investorSubtitle);
  const toField = emailSuggestions.length > 0 ? emailSuggestions.slice(0, 2).join(' or ') : '[investor email]';

  return `To: ${toField}
Subject: ${startupName} — quick intro request

Hi ${investorName},

I'm ${founderName}, founder of ${startupName}. We're reaching out because ${why}.

Signal snapshot: ${signalSummary}

If it's a fit, would you be open to a quick ${ask} this week? If not, I'd still value 1–2 minutes of guidance on who you think is the right investor profile.

Thanks,
${founderName}

---
Sent via pythh.com — AI-powered investor matching`;
}

export default function IntroStrategyModal(props: {
  open: boolean;
  onClose: () => void;
  match: InvestorMatch;
  startup: StartupSignal;
  toolkitHref?: string; // e.g. "/toolkit"
}) {
  const { open, onClose, match, startup, toolkitHref = "/toolkit" } = props;

  const [founderName, setFounderName] = useState("");
  const [founderEmail, setFounderEmail] = useState("");
  const [ask, setAsk] = useState("15-min conversation");
  const [notes, setNotes] = useState("");

  const signalSummary = useMemo(() => {
    return `${startup.industry}, ${startup.stageLabel}, signal ${startup.signalScore.toFixed(1)}/${startup.signalMax} (${startup.heat}, ${startup.velocityLabel})`;
  }, [startup]);

  const draft = useMemo(() => {
    return buildEmailDraft({
      founderName: founderName || "[Your name]",
      startupName: startup.name,
      investorName: match.name,
      investorSubtitle: match.subtitle,
      why: match.why || "your focus aligns with our market and stage",
      signalSummary,
      ask: ask || "15-min conversation",
    });
  }, [founderName, match.name, match.subtitle, match.why, startup.name, signalSummary, ask]);

  const portfolio = match.portfolioCompanies || [];
  const hasIntroPathList = portfolio.length > 0;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative w-full max-w-3xl my-8 rounded-2xl border border-white/10 bg-[#0b0b10] shadow-2xl max-h-[90vh] flex flex-col">
        <div className="p-4 md:p-5 border-b border-white/10 flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <div className="text-base md:text-lg font-semibold text-white">
              Intro Strategy: {match.name}
            </div>
            <div className="mt-1 text-xs md:text-sm text-white/65">
              Not a mystery. Choose a path that keeps you credible — and improves your odds.
            </div>
          </div>
          <Button onClick={onClose} aria-label="Close">Close</Button>
        </div>

        <div className="p-4 md:p-5 grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto">
          {/* Left: Inputs + paths */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm font-semibold text-white">Your details</div>
              <div className="mt-3 grid grid-cols-1 gap-3">
                <div>
                  <FieldLabel>Your name</FieldLabel>
                  <Input value={founderName} onChange={(e) => setFounderName(e.target.value)} placeholder="Jane Founder" />
                </div>
                <div>
                  <FieldLabel>Your email</FieldLabel>
                  <Input value={founderEmail} onChange={(e) => setFounderEmail(e.target.value)} placeholder="jane@startup.com" />
                </div>
                <div>
                  <FieldLabel>Ask</FieldLabel>
                  <Input value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="15-min conversation" />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm font-semibold text-white">Best paths to connect</div>

              <div className="mt-3 space-y-3">
                {/* Path 1: draft intro */}
                <div className="rounded-xl border border-white/10 bg-white/4 p-3">
                  <div className="text-sm font-medium text-white">1) Direct email (safe + transparent)</div>
                  <div className="mt-1 text-xs text-white/65">
                    Clean cold email to common firm patterns (info@firm.com/net/io/co/ai). Includes pythh attribution so investors know the source. No "begging energy" — just clear signal + specific ask.
                  </div>
                </div>

                {/* Path 2: warm intro via portfolio founders */}
                <div className="rounded-xl border border-white/10 bg-white/4 p-3">
                  <div className="text-sm font-medium text-white">
                    2) Warm intro via portfolio founders
                  </div>
                  <div className="mt-1 text-xs text-white/65">
                    We suggest founders to ask *portfolio founders* for a forward — short, respectful, no "begging energy".
                  </div>

                  <div className="mt-2">
                    {hasIntroPathList ? (
                      <div className="text-xs text-white/70">
                        Companies found ({portfolio.length}):
                        <ul className="mt-2 space-y-1">
                          {portfolio.slice(0, 6).map((c) => (
                            <li key={c.name} className="flex items-center justify-between gap-2">
                              <span className="truncate text-white/80">{c.name}</span>
                              <span className="shrink-0 text-[11px] text-white/50">
                                {c.linkedin ? "LinkedIn" : c.website ? "Website" : "—"}
                              </span>
                            </li>
                          ))}
                        </ul>
                        {portfolio.length > 6 && (
                          <div className="mt-2 text-[11px] text-white/50">
                            +{portfolio.length - 6} more (scroll list in full version)
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-white/60">
                        No portfolio list found yet. Use this anyway:
                        <ul className="mt-2 list-disc pl-5 space-y-1 text-white/70">
                          <li>Search investor's public portfolio page</li>
                          <li>Pick 2–3 founders and ask for a forward</li>
                          <li>Keep it 5 lines, include 1 proof point</li>
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                {/* Path 3: social discovery */}
                <div className="rounded-xl border border-white/10 bg-white/4 p-3">
                  <div className="text-sm font-medium text-white">3) Social discovery (X / LinkedIn)</div>
                  <div className="mt-1 text-xs text-white/65 space-y-2">
                    <div>
                      VCs prefer "discovering" founders through social media. Post intellectual/technical content, mention their firm + name in context of solving hard problems.
                    </div>
                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2">
                      <div className="text-[11px] font-medium text-emerald-300">✅ DO:</div>
                      <ul className="mt-1 list-disc pl-4 text-[11px] text-white/75 space-y-0.5">
                        <li>Share unique technical/market insights</li>
                        <li>Mention VCs when discussing hard problems you're solving</li>
                        <li>Show IQ + creativity in your approach</li>
                      </ul>
                    </div>
                    <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-2">
                      <div className="text-[11px] font-medium text-red-300">❌ DON'T:</div>
                      <ul className="mt-1 list-disc pl-4 text-[11px] text-white/75 space-y-0.5">
                        <li>Share PR announcements or marketing posts (tacky)</li>
                        <li>"Look at me!" promotional content (2-year-old tantrum energy)</li>
                        <li>Tag investors in self-promotional posts</li>
                      </ul>
                    </div>
                    <div className="text-[11px] text-white/60 italic">
                      Partners appreciate founders solving important problems in unique ways — not those begging for attention.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm font-semibold text-white">Improve your odds (signals)</div>
              <div className="mt-2 text-xs text-white/70 space-y-2">
                <div>
                  Top funds optimize for:
                  <ul className="mt-1 list-disc pl-5 space-y-1">
                    <li><span className="text-white/85">Market</span>: size + inevitability</li>
                    <li><span className="text-white/85">People</span>: ability to execute + unique approach</li>
                    <li><span className="text-white/85">Product</span>: defensibility + value</li>
                  </ul>
                </div>
                <div className="text-white/65">
                  Your GOD scores reflect this — improving signals is the fastest way to raise your meeting probability.
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <a
                    href={toolkitHref}
                    className="text-xs px-3 py-2 rounded-xl border border-white/10 bg-white/6 hover:bg-white/10 text-white/85"
                  >
                    Open Founder Toolkit
                  </a>
                  <span className="text-[11px] text-white/50 self-center">
                    Suggested: PR wins, new customers, key hires, product milestones
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Draft + contact data */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-white">Draft email</div>
                <div className="text-[11px] text-white/60">Copy/paste</div>
              </div>
              <Textarea value={draft} readOnly rows={14} />
              <div className="mt-2 space-y-1">
                <div className="text-[11px] text-white/60">
                  <span className="text-white/75 font-medium">Email patterns:</span> Try common firm addresses (info@firm.com, .net, .io, .co, .ai)
                </div>
                <div className="text-[11px] text-white/60">
                  <span className="text-white/75 font-medium">Tip:</span> Keep it short. One proof point. One specific ask. No "please please please" energy.
                </div>
                <div className="text-[11px] text-emerald-400/60">
                  <span className="text-emerald-400/75 font-medium">pythh attribution:</span> Investors see where the intro came from — adds transparency.
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm font-semibold text-white">Investor contact (best-effort)</div>
              <div className="mt-2 text-xs text-white/70 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-white/60">Email</span>
                  <span className="text-white/85">{match.contact?.email || "—"}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-white/60">Website</span>
                  <span className="text-white/85">{match.contact?.website || "—"}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-white/60">LinkedIn</span>
                  <span className="text-white/85">{match.contact?.linkedin || "—"}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-white/60">Social</span>
                  <span className="text-white/85">{match.contact?.twitter || "—"}</span>
                </div>
              </div>

              <div className="mt-3 rounded-xl border border-white/10 bg-white/4 p-3">
                <div className="text-xs text-white/75 font-medium">Personal notes</div>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  placeholder="Add: their thesis, a relevant proof point, a mutual person to ask, etc."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button onClick={onClose}>Cancel</Button>
              <PrimaryButton onClick={onClose}>Done</PrimaryButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
