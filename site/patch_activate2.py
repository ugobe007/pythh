"""Apply FeedbackWidget wiring edits to Activate.tsx."""
with open('/home/ubuntu/pythh-redesign/client/src/pages/Activate.tsx', 'r') as f:
    content = f.read()

original_len = len(content)

# 1. Add FeedbackWidget import after emailInference import
old1 = 'import { inferInvestorEmails, getPrimaryVariants, confidenceLabel, type InvestorEmailProfile } from "@/lib/emailInference";'
new1 = old1 + '\nimport FeedbackWidget from "@/components/FeedbackWidget";'
assert old1 in content, "FAIL: emailInference import not found"
content = content.replace(old1, new1, 1)
print("  OK FeedbackWidget import added")

# 2. Add runId prop to ResultsStep signature
old2 = '''function ResultsStep({
  url,
  onActivate,
  investors: realInvestors,
  summary: realSummary,
}: {
  url: string;
  onActivate: () => void;
  investors?: PythiaResult["matches"];
  summary?: string;
})'''
new2 = '''function ResultsStep({
  url,
  onActivate,
  investors: realInvestors,
  summary: realSummary,
  runId,
}: {
  url: string;
  onActivate: () => void;
  investors?: PythiaResult["matches"];
  summary?: string;
  runId: string;
})'''
assert old2 in content, "FAIL: ResultsStep signature not found"
content = content.replace(old2, new2, 1)
print("  OK ResultsStep signature updated with runId prop")

# 3. Insert FeedbackWidget after the summary paragraph, inside the insight div
old3 = '''            <p className="text-sm leading-relaxed" style={{ color: "oklch(0.65 0.01 264)" }}>
              {realSummary || "Your strongest angle is strong \u2014 focus on your technical differentiation and thesis alignment with your top matches. I recommend starting outreach to all investors simultaneously \u2014 fund cycles won't wait."}
            </p>
          </div>
        </div>'''
new3 = '''            <p className="text-sm leading-relaxed" style={{ color: "oklch(0.65 0.01 264)" }}>
              {realSummary || "Your strongest angle is strong \u2014 focus on your technical differentiation and thesis alignment with your top matches. I recommend starting outreach to all investors simultaneously \u2014 fund cycles won't wait."}
            </p>
            <FeedbackWidget runId={runId} ready={true} />
          </div>
        </div>'''
assert old3 in content, "FAIL: summary paragraph closing not found"
content = content.replace(old3, new3, 1)
print("  OK FeedbackWidget inserted in summary section")

# 4. Add runId state after pythiaResult state
old4 = '  const [pythiaResult, setPythiaResult] = useState<PythiaResult | null>(null);'
new4 = ('  const [pythiaResult, setPythiaResult] = useState<PythiaResult | null>(null);\n'
        '  // Stable UUID per analysis run \u2014 generated once per URL submission\n'
        '  const [runId, setRunId] = useState<string>(() => crypto.randomUUID());')
assert old4 in content, "FAIL: pythiaResult useState not found"
content = content.replace(old4, new4, 1)
print("  OK runId state added")

# 5. Reset runId on each new URL submission
old5 = ('    setUrl(submittedUrl);\n'
        '    setPythiaResult(null);  // reset previous result')
new5 = ('    setUrl(submittedUrl);\n'
        '    setPythiaResult(null);  // reset previous result\n'
        '    setRunId(crypto.randomUUID());  // new run = new feedback slot')
assert old5 in content, "FAIL: handleUrlSubmit body not found"
content = content.replace(old5, new5, 1)
print("  OK runId reset in handleUrlSubmit")

# 6. Pass runId to ResultsStep JSX call
old6 = '      {step === "results" && <ResultsStep url={url} onActivate={handleActivatePipeline} investors={pythiaResult?.matches} summary={pythiaResult?.summary} />}'
new6 = '      {step === "results" && <ResultsStep url={url} onActivate={handleActivatePipeline} investors={pythiaResult?.matches} summary={pythiaResult?.summary} runId={runId} />}'
assert old6 in content, "FAIL: ResultsStep JSX call not found"
content = content.replace(old6, new6, 1)
print("  OK runId passed to ResultsStep in JSX")

with open('/home/ubuntu/pythh-redesign/client/src/pages/Activate.tsx', 'w') as f:
    f.write(content)

print(f"File updated: {original_len} -> {len(content)} chars")
