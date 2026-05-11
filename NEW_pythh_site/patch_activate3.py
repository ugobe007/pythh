"""
Patch Activate.tsx to:
1. Import ActivatePythiaModal
2. Add pythiaModalOpen state to main Activate function
3. Replace the existing "Run Pipeline with PYTHIA" button with "Activate PYTHIA" button
4. Render ActivatePythiaModal below ResultsStep
"""
import re

path = "/home/ubuntu/pythh-redesign/client/src/pages/Activate.tsx"
with open(path, "r") as f:
    src = f.read()

original = src

# ── 1. Add ActivatePythiaModal import after the last existing import ──────────
old_import = 'import PythiaRadarFeed from "@/components/PythiaRadarFeed";'
new_import = (
    'import PythiaRadarFeed from "@/components/PythiaRadarFeed";\n'
    'import ActivatePythiaModal from "@/components/ActivatePythiaModal";'
)
if old_import in src:
    src = src.replace(old_import, new_import, 1)
    print("✓ Added ActivatePythiaModal import")
else:
    print("✗ Could not find PythiaRadarFeed import")

# ── 2. Add pythiaModalOpen state after runId state ────────────────────────────
old_state = "  const [runId, setRunId] = useState<string>(() => crypto.randomUUID());"
new_state = (
    "  const [runId, setRunId] = useState<string>(() => crypto.randomUUID());\n"
    "  const [pythiaModalOpen, setPythiaModalOpen] = useState(false);"
)
if old_state in src:
    src = src.replace(old_state, new_state, 1)
    print("✓ Added pythiaModalOpen state")
else:
    print("✗ Could not find runId state line")

# ── 3. Replace "Run Pipeline with PYTHIA" button text with "Activate PYTHIA" ──
# The button currently calls onActivate (which goes to the pipeline step).
# We change it to open the modal instead.
old_button_text = "            Run Pipeline with PYTHIA"
new_button_text = "            Activate PYTHIA"
if old_button_text in src:
    src = src.replace(old_button_text, new_button_text, 1)
    print("✓ Updated button label to 'Activate PYTHIA'")
else:
    print("✗ Could not find button text 'Run Pipeline with PYTHIA'")

# ── 4. Change the button's onClick from onActivate to the modal open ──────────
# The button is in ResultsStep header. We need to change the prop passed.
# The ResultsStep receives onActivate; we'll change the call site in the main
# Activate function to pass setPythiaModalOpen(true) instead of handleActivatePipeline.
old_activate_prop = "onActivate={handleActivatePipeline}"
new_activate_prop = "onActivate={() => setPythiaModalOpen(true)}"
if old_activate_prop in src:
    src = src.replace(old_activate_prop, new_activate_prop, 1)
    print("✓ Changed onActivate to open modal")
else:
    print("✗ Could not find onActivate={handleActivatePipeline}")

# ── 5. Add ActivatePythiaModal below the ResultsStep render ───────────────────
# Find the line that renders ResultsStep and add the modal after it
old_results_render = (
    "      {step === \"results\" && <ResultsStep url={url} onActivate={() => setPythiaModalOpen(true)}"
    " investors={pythiaResult?.matches} summary={pythiaResult?.summary} runId={runId} />}"
)

# Build the replacement that includes the modal
new_results_render = (
    "      {step === \"results\" && <ResultsStep url={url} onActivate={() => setPythiaModalOpen(true)}"
    " investors={pythiaResult?.matches} summary={pythiaResult?.summary} runId={runId} />}\n"
    "      {step === \"results\" && pythiaModalOpen && (\n"
    "        <ActivatePythiaModal\n"
    "          open={pythiaModalOpen}\n"
    "          onClose={() => setPythiaModalOpen(false)}\n"
    "          runId={runId}\n"
    "          startupUrl={url}\n"
    "          startupSummary={pythiaResult?.summary}\n"
    "          investors={(pythiaResult?.matches ?? []).map((m) => ({\n"
    "            name: m.name,\n"
    "            firm: m.firm,\n"
    "            sector: Array.isArray(m.sector) ? m.sector[0] ?? \"\" : (m.sector ?? \"\"),\n"
    "            matchReason: m.reason,\n"
    "          }))}\n"
    "        />\n"
    "      )}"
)

if old_results_render in src:
    src = src.replace(old_results_render, new_results_render, 1)
    print("✓ Added ActivatePythiaModal render")
else:
    # Try to find it with a search
    idx = src.find('step === "results" && <ResultsStep')
    if idx >= 0:
        line_start = src.rfind("\n", 0, idx) + 1
        line_end = src.find("\n", idx)
        found_line = src[line_start:line_end]
        print(f"✗ Could not match ResultsStep render. Found line:\n  {found_line!r}")
    else:
        print("✗ Could not find ResultsStep render at all")

if src == original:
    print("\n⚠ No changes were made!")
else:
    with open(path, "w") as f:
        f.write(src)
    print(f"\n✓ Wrote {path}")
