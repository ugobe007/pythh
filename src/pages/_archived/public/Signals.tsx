import React from "react";
import PageShell, { ContentContainer } from "../../components/layout/PageShell";
import TopBar, { TopBarBrand } from "../../components/layout/TopBar";
import { ArrowUp, ArrowDown, Minus, Flame, Snowflake } from "lucide-react";

/**
 * SIGNALS PAGE - "PRESSURE LEDGER"
 * 
 * Design Philosophy:
 * - Dark theme (near-black gradient bg)
 * - Green = improvement / heating
 * - Amber = warning / cooling
 * - Off-white text (#E6E6E6)
 * - No spinners - score increases pulse, verification upgrades glow
 */

// ═══════════════════════════════════════════════════════════════
// SAMPLE DATA (will be replaced with live data)
// ═══════════════════════════════════════════════════════════════

interface SignalRow {
  sector: string;
  state: 'heating' | 'stable' | 'cooling';
  duration: string;
  strength: number; // 0-100
  why: string;
}

const SAMPLE_SIGNALS: SignalRow[] = [
  { sector: 'AI Infrastructure', state: 'heating', duration: '12 days', strength: 87, why: 'a16z deploying 3× more capital than Q3' },
  { sector: 'Climate Tech', state: 'stable', duration: '28 days', strength: 52, why: 'Activity flat; no new fund announcements' },
  { sector: 'FinTech', state: 'cooling', duration: '6 days', strength: 34, why: 'Seed velocity down 40% MoM' },
  { sector: 'Developer Tools', state: 'heating', duration: '8 days', strength: 71, why: 'YC batch heavy on devtools; follow-on rising' },
  { sector: 'Healthcare AI', state: 'stable', duration: '15 days', strength: 58, why: 'Steady interest; regulatory clarity pending' },
  { sector: 'B2B SaaS', state: 'cooling', duration: '21 days', strength: 29, why: 'Multiples compressed; investors waiting' },
];

// ═══════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════

function StatePill({ state }: { state: SignalRow['state'] }) {
  const config = {
    heating: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', icon: Flame, label: 'Heating' },
    stable: { bg: 'bg-[#8f8f8f]/15', text: 'text-[#c0c0c0]', icon: Minus, label: 'Stable' },
    cooling: { bg: 'bg-amber-500/15', text: 'text-amber-400', icon: Snowflake, label: 'Cooling' },
  };
  const { bg, text, icon: Icon, label } = config[state];
  
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${bg} ${text}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

function StrengthLine({ strength, state }: { strength: number; state: SignalRow['state'] }) {
  const color = state === 'heating' ? 'bg-emerald-500' : state === 'cooling' ? 'bg-amber-500' : 'bg-[#5f5f5f]';
  
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-[#2e2e2e] rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${strength}%` }}
        />
      </div>
      <span className="text-xs text-[#8f8f8f] font-mono w-8">{strength}</span>
    </div>
  );
}

function DirectionArrow({ state }: { state: SignalRow['state'] }) {
  if (state === 'heating') return <ArrowUp className="w-4 h-4 text-emerald-400" />;
  if (state === 'cooling') return <ArrowDown className="w-4 h-4 text-amber-400" />;
  return <Minus className="w-4 h-4 text-[#5f5f5f]" />;
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function Signals() {
  return (
    <PageShell variant="standard">
      <TopBar 
        leftContent={<TopBarBrand />}
        rightLinks={[
          { to: "/", label: "Home" },
          { to: "/live", label: "Live" },
          { to: "/discover", label: "Find Investors" },
        ]}
      />

      <ContentContainer>
        <div className="py-12 max-w-4xl mx-auto space-y-8">
          
          {/* ═══════════════════════════════════════════════════════════════
              HEADER — Pressure Ledger
          ═══════════════════════════════════════════════════════════════ */}
          <header>
            <h1 className="text-3xl md:text-4xl font-bold text-[#E6E6E6] mb-2">
              Pressure Ledger
            </h1>
            <p className="text-[#8f8f8f] text-sm max-w-xl">
              Real-time investor attention by sector. Heating = capital deploying. Cooling = wait.
            </p>
          </header>
          {/* ═══════════════════════════════════════════════════════════════
              SIGNAL GRID — The Pressure Ledger table
          ═══════════════════════════════════════════════════════════════ */}
          <section className="bg-[#1a1a1a] rounded-xl border border-[#2e2e2e] overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-[#2e2e2e] bg-[#151515]">
              <div className="col-span-3 text-xs font-medium text-[#5f5f5f] uppercase tracking-wider">Signal</div>
              <div className="col-span-2 text-xs font-medium text-[#5f5f5f] uppercase tracking-wider">State</div>
              <div className="col-span-1 text-xs font-medium text-[#5f5f5f] uppercase tracking-wider text-center">Dir</div>
              <div className="col-span-2 text-xs font-medium text-[#5f5f5f] uppercase tracking-wider">Duration</div>
              <div className="col-span-4 text-xs font-medium text-[#5f5f5f] uppercase tracking-wider">Why it matters</div>
            </div>
            
            {/* Table Body */}
            <div className="divide-y divide-[#2e2e2e]">
              {SAMPLE_SIGNALS.map((signal, idx) => (
                <div 
                  key={signal.sector}
                  className="grid grid-cols-12 gap-4 px-5 py-4 hover:bg-[#232323] transition-colors"
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  {/* Sector + Strength */}
                  <div className="col-span-3">
                    <div className="text-[#E6E6E6] font-medium text-sm mb-1">{signal.sector}</div>
                    <StrengthLine strength={signal.strength} state={signal.state} />
                  </div>
                  
                  {/* State Pill */}
                  <div className="col-span-2 flex items-center">
                    <StatePill state={signal.state} />
                  </div>
                  
                  {/* Direction Arrow */}
                  <div className="col-span-1 flex items-center justify-center">
                    <DirectionArrow state={signal.state} />
                  </div>
                  
                  {/* Duration */}
                  <div className="col-span-2 flex items-center">
                    <span className="text-[#8f8f8f] text-sm font-mono">{signal.duration}</span>
                  </div>
                  
                  {/* Why it matters */}
                  <div className="col-span-4 flex items-center">
                    <span className="text-[#8f8f8f] text-sm">{signal.why}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ═══════════════════════════════════════════════════════════════
              LEGEND — Signal interpretation
          ═══════════════════════════════════════════════════════════════ */}
          <section className="flex flex-wrap items-center gap-6 px-4 py-4 bg-[#151515] rounded-lg border border-[#2e2e2e]">
            <div className="text-xs text-[#5f5f5f] uppercase tracking-wider mr-2">Legend:</div>
            
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500/30 border border-emerald-500/50" />
              <span className="text-xs text-[#8f8f8f]">
                <span className="text-emerald-400 font-medium">Heating</span> = Capital actively deploying
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#5f5f5f]/30 border border-[#5f5f5f]/50" />
              <span className="text-xs text-[#8f8f8f]">
                <span className="text-[#c0c0c0] font-medium">Stable</span> = Normal activity
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500/30 border border-amber-500/50" />
              <span className="text-xs text-[#8f8f8f]">
                <span className="text-amber-400 font-medium">Cooling</span> = Investors pulling back
              </span>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════════════════════
              CTA — Get personalized signals
          ═══════════════════════════════════════════════════════════════ */}
          <section className="flex items-center justify-between px-5 py-4 bg-[#1a1a1a] rounded-lg border border-[#2e2e2e]">
            <div>
              <div className="text-[#E6E6E6] font-medium text-sm">Want signals for your specific sector?</div>
              <div className="text-[#5f5f5f] text-xs mt-0.5">Get personalized pressure readings based on your startup.</div>
            </div>
            <a 
              href="/discover" 
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Find my investors →
            </a>
          </section>

        </div>
      </ContentContainer>
    </PageShell>
  );
}
