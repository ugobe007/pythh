import re

with open('/home/ubuntu/pythh-redesign/client/src/pages/Activate.tsx', 'r') as f:
    content = f.read()

original_len = len(content)

# ─── 1. Add PythiaResult type after the type Step definition ─────────────────
old_type = 'type Step = "entry" | "scanning" | "results" | "pipeline";\n\ninterface MatchedInvestor {'
new_type = ('type Step = "entry" | "scanning" | "results" | "pipeline";\n\n'
            '// Return shape from pipeline.analyzeStartup\n'
            'interface PythiaResult {\n'
            '  summary: string;\n'
            '  matches: Array<{\n'
            '    id: number;\n'
            '    name: string;\n'
            '    firm: string;\n'
            '    sector: string[];\n'
            '    stage: string;\n'
            '    checkSize: string;\n'
            '    geo: string;\n'
            '    signalScore: number;\n'
            '    recentActivity: string;\n'
            '    matchScore: number;\n'
            '    reason: string;\n'
            '  }>;\n'
            '}\n\n'
            'interface MatchedInvestor {')
assert old_type in content, "FAIL: type Step not found"
content = content.replace(old_type, new_type, 1)

# ─── 2. Update ResultsStep signature ─────────────────────────────────────────
old_sig = ('function ResultsStep({ url, onActivate }: { url: string; onActivate: () => void }) {\n'
           '  const [expanded, setExpanded] = useState<number | null>(1);\n'
           '  const domain = url.replace(/https?:\\/\\//, "").replace(/\\/.*/, "");')
new_sig = ('function ResultsStep({\n'
           '  url,\n'
           '  onActivate,\n'
           '  investors: realInvestors,\n'
           '  summary: realSummary,\n'
           '}: {\n'
           '  url: string;\n'
           '  onActivate: () => void;\n'
           '  investors?: PythiaResult["matches"];\n'
           '  summary?: string;\n'
           '}) {\n'
           '  const [expanded, setExpanded] = useState<number | null>(1);\n'
           '  const domain = url.replace(/https?:\\/\\//, "").replace(/\\/.*/, "");\n\n'
           '  // Map real LLM matches to MatchedInvestor shape, falling back to MOCK data\n'
           '  const displayInvestors: MatchedInvestor[] = realInvestors && realInvestors.length > 0\n'
           '    ? realInvestors.map((m) => ({\n'
           '        id: m.id,\n'
           '        name: m.name,\n'
           '        firm: m.firm,\n'
           '        role: "",\n'
           '        sector: m.sector,\n'
           '        stage: m.stage,\n'
           '        checkSize: m.checkSize,\n'
           '        matchScore: m.matchScore,\n'
           '        signalScore: m.signalScore,\n'
           '        reason: m.reason,\n'
           '        recentActivity: m.recentActivity,\n'
           '        status: "matched" as const,\n'
           '        emailProfile: inferInvestorEmails(m.name, m.firm),\n'
           '      }))\n'
           '    : MOCK_INVESTORS;')
assert old_sig in content, "FAIL: ResultsStep sig not found"
content = content.replace(old_sig, new_sig, 1)

# ─── 3. Update the "PYTHIA found X high-signal investors" header ─────────────
old_header = 'PYTHIA found <span style={{ color: "oklch(0.696 0.17 162.48)" }}>6 high-signal investors</span> for {domain}'
new_header = 'PYTHIA found <span style={{ color: "oklch(0.696 0.17 162.48)" }}>{displayInvestors.length} high-signal investors</span> for {domain}'
assert old_header in content, "FAIL: PYTHIA found header not found"
content = content.replace(old_header, new_header, 1)

# ─── 4. Update the stats block ───────────────────────────────────────────────
old_stats = ('            { label: "INVESTORS MATCHED", value: "6", sub: "from 5,000+ analyzed", color: "emerald" },\n'
             '            { label: "AVG MATCH SCORE", value: "87", sub: "out of 100", color: "amber" },')
new_stats = ('            { label: "INVESTORS MATCHED", value: String(displayInvestors.length), sub: "from 5,000+ analyzed", color: "emerald" },\n'
             '            { label: "AVG MATCH SCORE", value: displayInvestors.length > 0 ? String(Math.round(displayInvestors.reduce((s, i) => s + i.matchScore, 0) / displayInvestors.length)) : "87", sub: "out of 100", color: "amber" },')
assert old_stats in content, "FAIL: stats block not found"
content = content.replace(old_stats, new_stats, 1)

# ─── 5. Update the PYTHIA insight paragraph ──────────────────────────────────
pattern = r'(<p className="text-sm leading-relaxed" style=\{\{ color: "oklch\(0\.65 0\.01 264\)" \}\}>\n              Your strongest angle is.*?</p>)'
match = re.search(pattern, content, re.DOTALL)
if match:
    old_para = match.group(0)
    new_para = ('            <p className="text-sm leading-relaxed" style={{ color: "oklch(0.65 0.01 264)" }}>\n'
                '              {realSummary || "Your strongest angle is strong \u2014 focus on your technical differentiation and thesis alignment with your top matches. I recommend starting outreach to all investors simultaneously \u2014 fund cycles won\'t wait."}\n'
                '            </p>')
    content = content.replace(old_para, new_para, 1)
    print("  OK insight paragraph updated")
else:
    print("  FAIL insight paragraph not found via regex")

# ─── 6. Replace MOCK_INVESTORS.map with displayInvestors.map ─────────────────
old_map = '          {MOCK_INVESTORS.map((inv, i) => ('
new_map = '          {displayInvestors.map((inv, i) => ('
assert old_map in content, "FAIL: MOCK_INVESTORS.map not found"
content = content.replace(old_map, new_map, 1)

# ─── 7. Add pythiaResult state and analyzeStartup mutation ───────────────────
old_url_state = ('  const [step, setStep] = useState<Step>(prefilledInvestor ? "pipeline" : "entry");\n'
                 '  const [url, setUrl] = useState(() => sessionStorage.getItem("pythia_url") || "");')
new_url_state = ('  const [step, setStep] = useState<Step>(prefilledInvestor ? "pipeline" : "entry");\n'
                 '  const [url, setUrl] = useState(() => sessionStorage.getItem("pythia_url") || "");\n'
                 '  const [pythiaResult, setPythiaResult] = useState<PythiaResult | null>(null);\n\n'
                 '  // \u2500\u2500 PYTHIA analysis mutation \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n'
                 '  const analyzeStartup = trpc.pipeline.analyzeStartup.useMutation({\n'
                 '    onSuccess: (data) => {\n'
                 '      setPythiaResult(data);\n'
                 '    },\n'
                 '    onError: (err) => {\n'
                 '      console.error("[PYTHIA] Analysis failed:", err.message);\n'
                 '      // Graceful degradation \u2014 fall through to MOCK data in ResultsStep\n'
                 '    },\n'
                 '  });')
assert old_url_state in content, "FAIL: url state not found"
content = content.replace(old_url_state, new_url_state, 1)

# ─── 8. Update handleUrlSubmit to fire the mutation ──────────────────────────
old_submit = ('  const handleUrlSubmit = (submittedUrl: string, submittedEmail: string) => {\n'
              '    setUrl(submittedUrl);\n'
              '    sessionStorage.setItem("pythia_url", submittedUrl);\n'
              '    sessionStorage.setItem("pythia_email", submittedEmail);\n'
              '    setStep("scanning");\n'
              '  };')
new_submit = ('  const handleUrlSubmit = (submittedUrl: string, submittedEmail: string) => {\n'
              '    setUrl(submittedUrl);\n'
              '    setPythiaResult(null);  // reset previous result\n'
              '    sessionStorage.setItem("pythia_url", submittedUrl);\n'
              '    sessionStorage.setItem("pythia_email", submittedEmail);\n'
              '    // Fire the LLM mutation in parallel with the scanning animation\n'
              '    analyzeStartup.mutate({ url: submittedUrl, founderEmail: submittedEmail || undefined });\n'
              '    setStep("scanning");\n'
              '  };')
assert old_submit in content, "FAIL: handleUrlSubmit not found"
content = content.replace(old_submit, new_submit, 1)

# ─── 9. Pass pythiaResult to ResultsStep in JSX ──────────────────────────────
old_results_jsx = '      {step === "results" && <ResultsStep url={url} onActivate={handleActivatePipeline} />}'
new_results_jsx = '      {step === "results" && <ResultsStep url={url} onActivate={handleActivatePipeline} investors={pythiaResult?.matches} summary={pythiaResult?.summary} />}'
assert old_results_jsx in content, "FAIL: ResultsStep JSX not found"
content = content.replace(old_results_jsx, new_results_jsx, 1)

with open('/home/ubuntu/pythh-redesign/client/src/pages/Activate.tsx', 'w') as f:
    f.write(content)

print(f"\nFile updated: {original_len} -> {len(content)} chars")

# Verify
checks = [
    ('PythiaResult interface', 'interface PythiaResult {'),
    ('ResultsStep new sig', 'investors?: PythiaResult["matches"]'),
    ('displayInvestors in header', 'displayInvestors.length} high-signal investors'),
    ('displayInvestors.map', 'displayInvestors.map((inv, i) => ('),
    ('pythiaResult state', 'const [pythiaResult, setPythiaResult]'),
    ('analyzeStartup mutation', 'trpc.pipeline.analyzeStartup.useMutation'),
    ('mutation in handleUrlSubmit', 'analyzeStartup.mutate({ url: submittedUrl'),
    ('ResultsStep JSX with investors', 'investors={pythiaResult?.matches}'),
    ('realSummary in insight', 'realSummary ||'),
]
for name, needle in checks:
    found = needle in content
    print(f"  {'OK' if found else 'FAIL'} {name}")
