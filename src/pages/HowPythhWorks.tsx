export default function HowPythhWorks() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Hero */}
      <div className="bg-gradient-to-b from-blue-900/20 to-transparent border-b border-white/10">
        <div className="max-w-4xl mx-auto px-6 py-16">
          <h1 className="text-5xl font-bold mb-4">How Pythh Works</h1>
          <p className="text-xl text-white/70 mb-8">
            We turn signals into alignment. Alignment into access. Access into outcomes.
          </p>
          <div className="text-white/60 leading-relaxed space-y-4">
            <p>
              Fundraising is not a networking problem.
              <br />
              It is an <span className="text-white font-semibold">alignment problem</span>.
            </p>
            <p>
              Capital moves when your startup's signals align with:
            </p>
            <ul className="ml-6 space-y-2">
              <li>• Investor motives</li>
              <li>• Portfolio strategy</li>
              <li>• Market timing</li>
              <li>• Risk appetite</li>
            </ul>
            <p className="pt-4 text-white/80 font-medium">
              Pythh exists to make alignment visible — and actionable.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12 space-y-16">
        {/* Section 1 — Signals Shape Outcomes */}
        <section>
          <h2 className="text-3xl font-bold mb-6">Signals shape outcomes</h2>
          <div className="space-y-4 text-white/70 leading-relaxed">
            <p>
              Founders don't raise money by pitching better.
              <br />
              They raise money by <span className="text-white">expressing the right signals at the right moment</span>.
            </p>
            
            <div className="grid md:grid-cols-2 gap-8 my-8">
              <div className="bg-white/5 rounded-lg border border-white/10 p-6">
                <h3 className="text-white font-semibold mb-3">Every startup emits signals</h3>
                <ul className="space-y-2 text-sm">
                  <li>• How fast you ship</li>
                  <li>• Who you hire</li>
                  <li>• How customers respond</li>
                  <li>• What your narrative implies</li>
                  <li>• Where momentum is forming</li>
                </ul>
              </div>
              
              <div className="bg-white/5 rounded-lg border border-white/10 p-6">
                <h3 className="text-white font-semibold mb-3">Every investor responds to signals</h3>
                <ul className="space-y-2 text-sm">
                  <li>• Thesis direction</li>
                  <li>• Category focus</li>
                  <li>• Deployment timing</li>
                  <li>• Portfolio gaps</li>
                  <li>• Risk tolerance</li>
                </ul>
              </div>
            </div>

            <p className="text-white/80 font-medium">
              Pythh tracks all three: startup signals, investor signals, market signals.
              <br />
              Then correlates them directly to fundraising probability.
            </p>
          </div>
        </section>

        {/* Section 2 — What We Measure */}
        <section>
          <h2 className="text-3xl font-bold mb-6">What we measure</h2>
          
          <div className="space-y-8">
            {/* Startup Signals */}
            <div>
              <h3 className="text-xl font-semibold text-blue-400 mb-3">Startup Signals</h3>
              <p className="text-white/70 mb-4">We track what predicts investor conviction:</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {['Product velocity', 'Traction shape', 'Customer proof', 'Team composition', 
                  'Technical depth', 'Narrative clarity', 'Execution tempo'].map((signal) => (
                  <div key={signal} className="px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded text-sm text-white/80">
                    {signal}
                  </div>
                ))}
              </div>
              <p className="text-white/60 text-sm mt-4">
                These signals determine: your effective stage, your investability profile, your likely objections, your readiness for each fund class.
              </p>
            </div>

            {/* Investor Signals */}
            <div>
              <h3 className="text-xl font-semibold text-green-400 mb-3">Investor Signals</h3>
              <p className="text-white/70 mb-4">We track what predicts investor behavior:</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {['Thesis evolution', 'Portfolio adjacency', 'Partner activity', 
                  'Check deployment cycles', 'Follow-on behavior', 'Co-investment networks'].map((signal) => (
                  <div key={signal} className="px-3 py-2 bg-green-500/10 border border-green-500/20 rounded text-sm text-white/80">
                    {signal}
                  </div>
                ))}
              </div>
              <p className="text-white/60 text-sm mt-4">
                These signals determine: who is structurally aligned, who is temporarily receptive, who will never engage, who is entering a timing window.
              </p>
            </div>

            {/* Market Signals */}
            <div>
              <h3 className="text-xl font-semibold text-purple-400 mb-3">Market Signals</h3>
              <p className="text-white/70 mb-4">We track what shapes capital movement:</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {['Category tailwinds', 'Narrative shifts', 'Regulatory pressure', 
                  'Talent flow', 'Capital rotation', 'Urgency formation'].map((signal) => (
                  <div key={signal} className="px-3 py-2 bg-purple-500/10 border border-purple-500/20 rounded text-sm text-white/80">
                    {signal}
                  </div>
                ))}
              </div>
              <p className="text-white/60 text-sm mt-4">
                These signals determine: when timing windows open, when valuation expands or compresses, when categories become fundable.
              </p>
            </div>
          </div>
        </section>

        {/* Section 3 — Alignment Engine */}
        <section>
          <h2 className="text-3xl font-bold mb-6">Matching is not enough. Alignment wins.</h2>
          <div className="space-y-6 text-white/70">
            <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-6">
              <p className="text-white/50 mb-2">Pythh does not say:</p>
              <p className="text-red-400 italic line-through">"These investors match you."</p>
            </div>

            <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-6">
              <p className="text-white/50 mb-3">Pythh says:</p>
              <ul className="space-y-2 text-green-400">
                <li>• "These investors favor your current signals."</li>
                <li>• "These investors are misaligned with your thesis."</li>
                <li>• "These investors will respond after these changes."</li>
              </ul>
            </div>

            <p className="pt-4">We match on four dimensions:</p>
            <div className="grid md:grid-cols-2 gap-4 mt-4">
              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <h4 className="text-white font-semibold mb-2">1. Thesis Alignment</h4>
                <p className="text-sm text-white/60">What they believe the future looks like.</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <h4 className="text-white font-semibold mb-2">2. Stage Alignment</h4>
                <p className="text-sm text-white/60">Where they deploy capital today — not historically.</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <h4 className="text-white font-semibold mb-2">3. Signal Alignment</h4>
                <p className="text-sm text-white/60">What they are currently responding to.</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <h4 className="text-white font-semibold mb-2">4. Timing Alignment</h4>
                <p className="text-sm text-white/60">Where they are in their deployment cycle.</p>
              </div>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-6 mt-6">
              <p className="text-white font-semibold mb-3">The result:</p>
              <ul className="space-y-2 text-white/80">
                <li>• Investors biased in your favor</li>
                <li>• Fewer wasted meetings</li>
                <li>• Higher conversion</li>
                <li>• Better outcomes</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 4 — Core Advantage */}
        <section>
          <h2 className="text-3xl font-bold mb-6">We translate signals into instructions</h2>
          <p className="text-white/70 mb-8">Pythh answers four questions every founder needs:</p>

          <div className="space-y-6">
            {/* Question 1 */}
            <div className="bg-white/5 rounded-lg border border-white/10 p-6">
              <h3 className="text-xl font-semibold text-blue-400 mb-3">1. How investors currently perceive you</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <p className="text-white/60 text-sm mb-2">We compute:</p>
                  <ul className="space-y-1 text-white/70 text-sm">
                    <li>• Your effective stage</li>
                    <li>• Your capital readiness</li>
                    <li>• Your risk profile</li>
                    <li>• Your narrative coherence</li>
                  </ul>
                </div>
                <div>
                  <p className="text-white/60 text-sm mb-2">You see:</p>
                  <ul className="space-y-1 text-white/70 text-sm">
                    <li>• Strengths</li>
                    <li>• Weaknesses</li>
                    <li>• Likely objections</li>
                    <li>• Conviction drivers</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Question 2 */}
            <div className="bg-white/5 rounded-lg border border-white/10 p-6">
              <h3 className="text-xl font-semibold text-green-400 mb-3">2. Who is aligned right now</h3>
              <p className="text-white/70 text-sm mb-3">You receive:</p>
              <ul className="space-y-1 text-white/70 text-sm mb-4">
                <li>• Investors structurally aligned</li>
                <li>• Investors timing-aligned</li>
                <li>• Investors to deprioritize</li>
                <li>• Warm intro vectors</li>
              </ul>
              <p className="text-white/60 text-sm">
                Each match includes: <span className="text-white/80">Why they align</span>, <span className="text-white/80">What they respond to</span>, <span className="text-white/80">What they will challenge</span>
              </p>
            </div>

            {/* Question 3 */}
            <div className="bg-white/5 rounded-lg border border-white/10 p-6">
              <h3 className="text-xl font-semibold text-purple-400 mb-3">3. What must change to improve your odds</h3>
              <p className="text-white/70 text-sm mb-3">Pythh identifies:</p>
              <ul className="space-y-1 text-white/70 text-sm mb-4">
                <li>• Blocking signals</li>
                <li>• Missing signals</li>
                <li>• Mispriced signals</li>
                <li>• Over-weighted signals</li>
              </ul>
              <p className="text-white/60 text-sm mb-3">And translates them into specific actions:</p>
              <div className="bg-black/30 rounded border border-white/5 p-4 space-y-2 text-sm">
                <p className="text-yellow-400/80">• "Your traction favors seed funds, not Series A yet."</p>
                <p className="text-yellow-400/80">• "Your hiring profile attracts infra investors, not SaaS VCs."</p>
                <p className="text-yellow-400/80">• "Your narrative signals platform, but your product signals tool."</p>
                <p className="text-yellow-400/80">• "You need customer proof before institutional partners engage."</p>
              </div>
              <p className="text-white font-medium mt-4 text-sm">This is probability shaping.</p>
            </div>

            {/* Question 4 */}
            <div className="bg-white/5 rounded-lg border border-white/10 p-6">
              <h3 className="text-xl font-semibold text-cyan-400 mb-3">4. How to adapt as signals change</h3>
              <p className="text-white/70 text-sm mb-3">
                Markets move. Theses rotate. Timing windows open and close.
              </p>
              <p className="text-white/70 text-sm mb-3">Pythh continuously updates:</p>
              <ul className="space-y-1 text-white/70 text-sm mb-4">
                <li>• Investor alignment</li>
                <li>• Timing readiness</li>
                <li>• Category momentum</li>
                <li>• Opportunity emergence</li>
              </ul>
              <p className="text-white/60 text-sm">
                You always know: <span className="text-white/80">Who to talk to now</span>, <span className="text-white/80">Who to wait on</span>, <span className="text-white/80">What to emphasize next</span>, <span className="text-white/80">What to build before raising</span>
              </p>
            </div>
          </div>
        </section>

        {/* Section 5 — Attenuation Layer */}
        <section>
          <h2 className="text-3xl font-bold mb-6">We help you shape your signals</h2>
          <div className="space-y-4 text-white/70">
            <p>
              Once alignment is visible, Pythh helps founders <span className="text-white font-semibold">attenuate their signals</span>:
            </p>
            
            <div className="bg-white/5 rounded-lg border border-white/10 p-6">
              <p className="text-white/60 text-sm mb-3">We guide:</p>
              <div className="grid md:grid-cols-2 gap-3">
                {['Narrative sharpening', 'Milestone sequencing', 'Hiring timing', 
                  'Positioning shifts', 'Traction framing', 'Target fund class selection'].map((action) => (
                  <div key={action} className="px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded text-sm text-white/80">
                    {action}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-lg border border-blue-500/20 p-8 text-center">
              <p className="text-lg text-white/80 mb-4">This is not optics.</p>
              <p className="text-2xl text-white font-bold mb-6">This is capital engineering.</p>
              
              <div className="space-y-2 text-white/70">
                <p>When signals align:</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                  <div className="text-white font-medium">Access improves</div>
                  <div className="text-white font-medium">Timing compresses</div>
                  <div className="text-white font-medium">Valuations strengthen</div>
                  <div className="text-white font-medium">Outcomes compound</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 6 — Closing */}
        <section className="text-center py-12">
          <h2 className="text-4xl font-bold mb-4">Alignment is the goal</h2>
          <p className="text-2xl text-white/70 mb-8">Capital follows alignment</p>
          
          <div className="inline-block">
            <a
              href="/demo"
              className="inline-block px-8 py-4 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition-colors text-lg"
            >
              Analyze My Signals
            </a>
            <p className="text-xs text-white/40 mt-3">No signup required. Public signals only.</p>
          </div>
        </section>
      </div>

      {/* Footer */}
      <div className="border-t border-white/10 bg-black/40">
        <div className="max-w-4xl mx-auto px-6 py-8 text-center text-white/40 text-sm">
          <p className="mb-2">Your signals determine your odds.</p>
          <p>Improve your signals. Improve your outcomes.</p>
        </div>
      </div>
    </div>
  );
}
