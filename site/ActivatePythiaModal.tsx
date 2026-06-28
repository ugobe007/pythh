/**
 * ActivatePythiaModal
 *
 * Full-screen modal that walks the user through the PYTHIA outreach activation flow:
 *   Step 1 — Materials: upload an existing deck or let PYTHIA generate one
 *   Step 2 — Deck Editor: visual slide editor (title + content per slide, add/remove/reorder)
 *   Step 3 — Email Pitch: per-investor email drafts, review/approve/auto-send, copy-paste
 */
import { useState, useRef, useCallback, useEffect } from "react";
import {
  X,
  Upload,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  GripVertical,
  Send,
  Copy,
  Check,
  Mail,
  Loader2,
  ArrowRight,
  FileText,
  Eye,
  Edit3,
  FileDown,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import MeetingScheduler from "@/components/MeetingScheduler";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Slide {
  id: string;
  title: string;
  content: string;
  notes?: string;
}

interface InvestorForEmail {
  name: string;
  firm: string;
  sector: string;
  matchReason?: string;
  email?: string;
}

interface EmailDraft {
  id: number;
  investorName: string;
  investorFirm: string;
  toEmail: string | null;
  subject: string;
  body: string;
  status: "draft" | "approved" | "sent";
  sentAt: number | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  runId: string;
  startupUrl: string;
  startupSummary?: string;
  investors: InvestorForEmail[];
}

// ─── Colour tokens (matching the Obsidian Terminal theme) ─────────────────────
const C = {
  bg: "oklch(0.13 0.01 264)",
  surface: "oklch(0.16 0.01 264)",
  border: "oklch(0.25 0.01 264)",
  borderFocus: "oklch(0.696 0.17 162.48 / 0.5)",
  text: "oklch(0.94 0.005 264)",
  muted: "oklch(0.65 0.01 264)",
  dim: "oklch(0.4 0.01 264)",
  emerald: "oklch(0.696 0.17 162.48)",
  emeraldDim: "oklch(0.696 0.17 162.48 / 0.12)",
  emeraldBorder: "oklch(0.696 0.17 162.48 / 0.3)",
  amber: "oklch(0.769 0.188 70.08)",
  amberDim: "oklch(0.769 0.188 70.08 / 0.12)",
};

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ step, total }: { step: number; total: number }) {
  const labels = ["Materials", "Deck Editor", "Email Pitch"];
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold transition-all duration-200"
            style={{
              backgroundColor: i < step ? C.emerald : i === step ? C.emeraldDim : "transparent",
              border: `1px solid ${i <= step ? C.emerald : C.border}`,
              color: i < step ? "oklch(0.1 0.01 162)" : i === step ? C.emerald : C.dim,
            }}
          >
            {i < step ? <Check size={10} /> : i + 1}
          </div>
          <span className="text-xs font-medium hidden sm:block" style={{ color: i === step ? C.text : C.dim }}>
            {labels[i]}
          </span>
          {i < total - 1 && (
            <div className="w-8 h-px mx-1" style={{ backgroundColor: i < step ? C.emerald : C.border }} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Step 1: Materials ────────────────────────────────────────────────────────

function MaterialsStep({
  onGenerate,
  onUpload,
  isGenerating,
}: {
  onGenerate: () => void;
  onUpload: (file: File) => void;
  isGenerating: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) onUpload(file);
    },
    [onUpload]
  );

  return (
    <div className="flex flex-col items-center justify-center flex-1 px-6 py-12 max-w-2xl mx-auto w-full">
      {/* PYTHIA avatar + question */}
      <div className="flex flex-col items-center mb-10 text-center">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center mb-4 font-bold text-lg"
          style={{ backgroundColor: C.emeraldDim, border: `1px solid ${C.emeraldBorder}`, color: C.emerald }}
        >
          Ψ
        </div>
        <h2 className="text-xl font-bold mb-2" style={{ color: C.text }}>
          Do you have a pitch deck or materials to upload?
        </h2>
        <p className="text-sm" style={{ color: C.muted }}>
          Upload your existing deck and I'll personalise the outreach, or I'll build a full deck for you from scratch.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
        {/* Upload card */}
        <div
          className="rounded-xl border-2 border-dashed p-6 flex flex-col items-center gap-3 cursor-pointer transition-all duration-200"
          style={{
            borderColor: dragOver ? C.emerald : C.border,
            backgroundColor: dragOver ? C.emeraldDim : C.surface,
          }}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <Upload size={28} style={{ color: C.emerald }} />
          <div className="text-center">
            <p className="text-sm font-semibold" style={{ color: C.text }}>Upload my deck</p>
            <p className="text-xs mt-1" style={{ color: C.muted }}>PDF, PPTX, or DOCX · up to 16 MB</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.pptx,.docx,.ppt,.doc"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); }}
          />
        </div>

        {/* Generate card */}
        <button
          onClick={onGenerate}
          disabled={isGenerating}
          className="rounded-xl border p-6 flex flex-col items-center gap-3 transition-all duration-200 disabled:opacity-60"
          style={{ borderColor: C.emeraldBorder, backgroundColor: C.emeraldDim }}
          onMouseEnter={(e) => !isGenerating && ((e.currentTarget as HTMLElement).style.backgroundColor = "oklch(0.696 0.17 162.48 / 0.18)")}
          onMouseLeave={(e) => !isGenerating && ((e.currentTarget as HTMLElement).style.backgroundColor = C.emeraldDim)}
        >
          {isGenerating ? (
            <Loader2 size={28} className="animate-spin" style={{ color: C.emerald }} />
          ) : (
            <Sparkles size={28} style={{ color: C.emerald }} />
          )}
          <div className="text-center">
            <p className="text-sm font-semibold" style={{ color: C.text }}>
              {isGenerating ? "PYTHIA is building your deck…" : "Build my deck with PYTHIA"}
            </p>
            <p className="text-xs mt-1" style={{ color: C.muted }}>
              {isGenerating ? "This takes about 15 seconds" : "AI-generated 10-slide pitch deck"}
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}

// ─── Step 2: Deck Editor ──────────────────────────────────────────────────────

function DeckEditor({
  slides,
  onChange,
  onApprove,
  isSaving,
  deckId,
  startupUrl,
}: {
  slides: Slide[];
  onChange: (slides: Slide[]) => void;
  onApprove: () => void;
  isSaving: boolean;
  deckId: number | null;
  startupUrl: string;
}) {
  const exportDeckPdf = trpc.outreach.exportDeckPdf.useMutation();
  const [activeIdx, setActiveIdx] = useState(0);
  const [previewMode, setPreviewMode] = useState(false);

  const active = slides[activeIdx] ?? slides[0];

  const updateSlide = (idx: number, patch: Partial<Slide>) => {
    const next = slides.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    onChange(next);
  };

  const addSlide = () => {
    const newSlide: Slide = {
      id: `slide-${Date.now()}`,
      title: "New Slide",
      content: "",
    };
    const next = [...slides, newSlide];
    onChange(next);
    setActiveIdx(next.length - 1);
  };

  const removeSlide = (idx: number) => {
    if (slides.length <= 1) return;
    const next = slides.filter((_, i) => i !== idx);
    onChange(next);
    setActiveIdx(Math.min(activeIdx, next.length - 1));
  };

  const moveSlide = (from: number, to: number) => {
    if (to < 0 || to >= slides.length) return;
    const next = [...slides];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
    setActiveIdx(to);
  };

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Sidebar — slide list */}
      <div
        className="w-48 flex-shrink-0 border-r flex flex-col overflow-y-auto"
        style={{ borderColor: C.border, backgroundColor: C.bg }}
      >
        <div className="p-3 border-b flex items-center justify-between" style={{ borderColor: C.border }}>
          <span className="text-xs font-semibold tracking-widest" style={{ color: C.muted }}>
            SLIDES ({slides.length})
          </span>
          <button
            onClick={addSlide}
            className="p-1 rounded transition-colors"
            style={{ color: C.emerald }}
            title="Add slide"
          >
            <Plus size={14} />
          </button>
        </div>
        <div className="flex-1 p-2 space-y-1">
          {slides.map((s, i) => (
            <div
              key={s.id}
              className="group relative rounded-lg p-2 cursor-pointer transition-all duration-150"
              style={{
                backgroundColor: i === activeIdx ? C.emeraldDim : "transparent",
                border: `1px solid ${i === activeIdx ? C.emeraldBorder : "transparent"}`,
              }}
              onClick={() => setActiveIdx(i)}
            >
              <div className="flex items-start gap-1.5">
                <GripVertical size={12} className="mt-0.5 flex-shrink-0 opacity-40" style={{ color: C.muted }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono" style={{ color: C.dim }}>{i + 1}</p>
                  <p className="text-xs font-medium truncate" style={{ color: i === activeIdx ? C.emerald : C.text }}>
                    {s.title || "Untitled"}
                  </p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); removeSlide(i); }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded transition-opacity"
                  style={{ color: C.dim }}
                >
                  <Trash2 size={10} />
                </button>
              </div>
              {/* Move up/down */}
              <div className="opacity-0 group-hover:opacity-100 flex gap-1 mt-1 justify-end">
                <button onClick={(e) => { e.stopPropagation(); moveSlide(i, i - 1); }} className="text-xs" style={{ color: C.dim }} disabled={i === 0}>↑</button>
                <button onClick={(e) => { e.stopPropagation(); moveSlide(i, i + 1); }} className="text-xs" style={{ color: C.dim }} disabled={i === slides.length - 1}>↓</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main editor area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: C.border }}>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPreviewMode(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
              style={{
                backgroundColor: !previewMode ? C.emeraldDim : "transparent",
                color: !previewMode ? C.emerald : C.muted,
                border: `1px solid ${!previewMode ? C.emeraldBorder : "transparent"}`,
              }}
            >
              <Edit3 size={12} /> Edit
            </button>
            <button
              onClick={() => setPreviewMode(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
              style={{
                backgroundColor: previewMode ? C.emeraldDim : "transparent",
                color: previewMode ? C.emerald : C.muted,
                border: `1px solid ${previewMode ? C.emeraldBorder : "transparent"}`,
              }}
            >
              <Eye size={12} /> Preview
            </button>
          </div>
          <div className="flex items-center gap-2">
            {/* Export PDF button */}
            <button
              onClick={async () => {
                if (!deckId) { toast.error("Save the deck first before exporting."); return; }
                try {
                  const result = await exportDeckPdf.mutateAsync({
                    deckId,
                    startupName: startupUrl.replace(/^https?:\/\//i, "").split("/")[0] || "Startup",
                  });
                  const bytes = Uint8Array.from(atob(result.base64), (c) => c.charCodeAt(0));
                  const blob = new Blob([bytes], { type: "application/pdf" });
                  const blobUrl = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = blobUrl;
                  a.download = result.filename;
                  a.click();
                  URL.revokeObjectURL(blobUrl);
                  toast.success("PDF downloaded!");
                } catch {
                  toast.error("Failed to generate PDF. Please try again.");
                }
              }}
              disabled={exportDeckPdf.isPending || !deckId}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
              style={{
                backgroundColor: C.emeraldDim,
                color: exportDeckPdf.isPending ? C.dim : C.emerald,
                border: `1px solid ${C.emeraldBorder}`,
                opacity: !deckId ? 0.5 : 1,
                cursor: !deckId ? "not-allowed" : "pointer",
              }}
              title="Export pitch deck as PDF"
            >
              {exportDeckPdf.isPending ? <Loader2 size={12} className="animate-spin" /> : <FileDown size={12} />}
              {exportDeckPdf.isPending ? "Generating…" : "Export PDF"}
            </button>
            <span className="text-xs" style={{ color: C.dim }}>
              Slide {activeIdx + 1} of {slides.length}
            </span>
            <button onClick={() => setActiveIdx(Math.max(0, activeIdx - 1))} disabled={activeIdx === 0} style={{ color: C.muted }}>
              <ChevronLeft size={16} />
            </button>
            <button onClick={() => setActiveIdx(Math.min(slides.length - 1, activeIdx + 1))} disabled={activeIdx === slides.length - 1} style={{ color: C.muted }}>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Editor / Preview pane */}
        <div className="flex-1 overflow-y-auto p-6">
          {previewMode ? (
            /* Slide preview */
            <div
              className="max-w-2xl mx-auto rounded-xl p-10 min-h-64 flex flex-col"
              style={{ backgroundColor: C.surface, border: `1px solid ${C.border}` }}
            >
              <h2 className="text-2xl font-bold mb-6" style={{ color: C.emerald }}>
                {active?.title || "Untitled"}
              </h2>
              <div className="flex-1">
                {(active?.content || "").split("\n").map((line, i) => (
                  <p key={i} className="text-sm mb-2 leading-relaxed" style={{ color: line.startsWith("•") || line.startsWith("-") ? C.text : C.muted }}>
                    {line}
                  </p>
                ))}
              </div>
              {active?.notes && (
                <div className="mt-6 pt-4 border-t" style={{ borderColor: C.border }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: C.dim }}>SPEAKER NOTES</p>
                  <p className="text-xs" style={{ color: C.dim }}>{active.notes}</p>
                </div>
              )}
            </div>
          ) : (
            /* Edit form */
            <div className="max-w-2xl mx-auto space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5 tracking-widest" style={{ color: C.muted }}>
                  SLIDE TITLE
                </label>
                <input
                  className="w-full rounded-lg px-4 py-3 text-sm font-semibold outline-none transition-colors"
                  style={{
                    backgroundColor: C.surface,
                    border: `1px solid ${C.border}`,
                    color: C.text,
                  }}
                  value={active?.title || ""}
                  onChange={(e) => updateSlide(activeIdx, { title: e.target.value })}
                  placeholder="Slide title…"
                  onFocus={(e) => (e.currentTarget.style.borderColor = C.emerald)}
                  onBlur={(e) => (e.currentTarget.style.borderColor = C.border)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 tracking-widest" style={{ color: C.muted }}>
                  CONTENT
                </label>
                <textarea
                  className="w-full rounded-lg px-4 py-3 text-sm outline-none transition-colors resize-none"
                  style={{
                    backgroundColor: C.surface,
                    border: `1px solid ${C.border}`,
                    color: C.text,
                    minHeight: "160px",
                    lineHeight: "1.6",
                  }}
                  value={active?.content || ""}
                  onChange={(e) => updateSlide(activeIdx, { content: e.target.value })}
                  placeholder="• Key point one&#10;• Key point two&#10;• Key point three"
                  onFocus={(e) => (e.currentTarget.style.borderColor = C.emerald)}
                  onBlur={(e) => (e.currentTarget.style.borderColor = C.border)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 tracking-widest" style={{ color: C.muted }}>
                  SPEAKER NOTES <span className="font-normal normal-case" style={{ color: C.dim }}>(optional)</span>
                </label>
                <textarea
                  className="w-full rounded-lg px-4 py-3 text-sm outline-none transition-colors resize-none"
                  style={{
                    backgroundColor: C.surface,
                    border: `1px solid ${C.border}`,
                    color: C.muted,
                    minHeight: "80px",
                  }}
                  value={active?.notes || ""}
                  onChange={(e) => updateSlide(activeIdx, { notes: e.target.value || undefined })}
                  placeholder="Notes for this slide…"
                  onFocus={(e) => (e.currentTarget.style.borderColor = C.emerald)}
                  onBlur={(e) => (e.currentTarget.style.borderColor = C.border)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer CTA */}
        <div className="px-6 py-4 border-t flex items-center justify-between" style={{ borderColor: C.border }}>
          <p className="text-xs" style={{ color: C.dim }}>
            {isSaving ? "Saving…" : "Changes auto-saved"}
          </p>
          <button
            onClick={onApprove}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-all duration-200"
            style={{ backgroundColor: C.emerald, color: "oklch(0.1 0.01 162)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "oklch(0.75 0.17 162.48)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = C.emerald; }}
          >
            Approve Deck & Build Emails
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150"
      style={{
        backgroundColor: copied ? C.emeraldDim : "transparent",
        border: `1px solid ${copied ? C.emeraldBorder : C.border}`,
        color: copied ? C.emerald : C.muted,
      }}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

// ─── Step 3: Email Pitch ──────────────────────────────────────────────────────

function EmailPitchStep({
  runId,
  emails,
  onApprove,
  onSend,
  onUpdate,
  isSending,
  sendingId,
  fromName,
  replyTo,
  onFromNameChange,
  onReplyToChange,
}: {
  runId: string;
  emails: EmailDraft[];
  onApprove: (id: number) => void;
  onSend: (id: number) => void;
  onUpdate: (id: number, patch: { subject?: string; body?: string; toEmail?: string }) => void;
  isSending: boolean;
  sendingId: number | null;
  fromName: string;
  replyTo: string;
  onFromNameChange: (v: string) => void;
  onReplyToChange: (v: string) => void;
}) {
  const [activeId, setActiveId] = useState<number | null>(emails[0]?.id ?? null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editEmail, setEditEmail] = useState("");

  const active = emails.find((e) => e.id === activeId) ?? emails[0];

  const startEdit = (email: EmailDraft) => {
    setEditingId(email.id);
    setEditSubject(email.subject);
    setEditBody(email.body);
    setEditEmail(email.toEmail ?? "");
  };

  const saveEdit = () => {
    if (!editingId) return;
    onUpdate(editingId, { subject: editSubject, body: editBody, toEmail: editEmail || undefined });
    setEditingId(null);
  };

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Investor list sidebar */}
      <div
        className="w-52 flex-shrink-0 border-r flex flex-col overflow-y-auto"
        style={{ borderColor: C.border, backgroundColor: C.bg }}
      >
        <div className="p-3 border-b" style={{ borderColor: C.border }}>
          <span className="text-xs font-semibold tracking-widest" style={{ color: C.muted }}>
            INVESTORS ({emails.length})
          </span>
        </div>
        <div className="flex-1 p-2 space-y-1">
          {emails.map((e) => (
            <button
              key={e.id}
              className="w-full text-left rounded-lg p-2.5 transition-all duration-150"
              style={{
                backgroundColor: e.id === activeId ? C.emeraldDim : "transparent",
                border: `1px solid ${e.id === activeId ? C.emeraldBorder : "transparent"}`,
              }}
              onClick={() => setActiveId(e.id)}
            >
              <p className="text-xs font-semibold truncate" style={{ color: e.id === activeId ? C.emerald : C.text }}>
                {e.investorName}
              </p>
              <p className="text-xs truncate" style={{ color: C.dim }}>{e.investorFirm}</p>
              <div className="mt-1.5 flex items-center gap-1">
                <span
                  className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                  style={{
                    backgroundColor: e.status === "sent" ? C.emeraldDim : e.status === "approved" ? C.amberDim : "oklch(0.2 0.01 264)",
                    color: e.status === "sent" ? C.emerald : e.status === "approved" ? C.amber : C.dim,
                  }}
                >
                  {e.status}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Email detail */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {active ? (
          <>
            {/* Sender settings */}
            <div className="px-5 py-3 border-b" style={{ borderColor: C.border, backgroundColor: C.surface }}>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold tracking-widest" style={{ color: C.muted }}>FROM</label>
                  <input
                    className="text-xs rounded px-2 py-1 outline-none"
                    style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, width: "160px" }}
                    value={fromName}
                    onChange={(e) => onFromNameChange(e.target.value)}
                    placeholder="Your name"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold tracking-widest" style={{ color: C.muted }}>REPLY-TO</label>
                  <input
                    className="text-xs rounded px-2 py-1 outline-none"
                    style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, width: "200px" }}
                    value={replyTo}
                    onChange={(e) => onReplyToChange(e.target.value)}
                    placeholder="your@email.com"
                  />
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {editingId === active.id ? (
                /* Edit mode */
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1 tracking-widest" style={{ color: C.muted }}>TO</label>
                    <input
                      className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                      style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, color: C.text }}
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      placeholder="investor@firm.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1 tracking-widest" style={{ color: C.muted }}>SUBJECT</label>
                    <input
                      className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                      style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, color: C.text }}
                      value={editSubject}
                      onChange={(e) => setEditSubject(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1 tracking-widest" style={{ color: C.muted }}>BODY</label>
                    <textarea
                      className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
                      style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, color: C.text, minHeight: "240px" }}
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={saveEdit}
                      className="px-4 py-2 rounded-lg text-sm font-semibold"
                      style={{ backgroundColor: C.emerald, color: "oklch(0.1 0.01 162)" }}
                    >
                      Save changes
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-4 py-2 rounded-lg text-sm"
                      style={{ color: C.muted, border: `1px solid ${C.border}` }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* View mode */
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="text-xs font-semibold tracking-widest mb-1" style={{ color: C.muted }}>TO</p>
                      <p className="text-sm" style={{ color: active.toEmail ? C.text : C.dim }}>
                        {active.toEmail || "No email address — add one to send"}
                      </p>
                    </div>
                    <button
                      onClick={() => startEdit(active)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium"
                      style={{ border: `1px solid ${C.border}`, color: C.muted }}
                    >
                      <Edit3 size={12} /> Edit
                    </button>
                  </div>
                  <div className="mb-4">
                    <p className="text-xs font-semibold tracking-widest mb-1" style={{ color: C.muted }}>SUBJECT</p>
                    <p className="text-sm font-medium" style={{ color: C.text }}>{active.subject}</p>
                  </div>
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold tracking-widest" style={{ color: C.muted }}>BODY</p>
                      <CopyButton text={`Subject: ${active.subject}\n\n${active.body}`} />
                    </div>
                    <div
                      className="rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap"
                      style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, color: C.text }}
                    >
                      {active.body}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Action footer */}
            {editingId !== active.id && (
              <div className="px-5 py-4 border-t flex items-center gap-3 flex-wrap" style={{ borderColor: C.border }}>
                {active.status === "sent" ? (
                  <div className="w-full space-y-3">
                    <div className="flex items-center gap-2 text-sm" style={{ color: C.emerald }}>
                      <Check size={16} />
                      Sent {active.sentAt ? new Date(active.sentAt).toLocaleDateString() : ""}
                    </div>
                    <MeetingScheduler
                      runId={runId}
                      emailId={active.id}
                      investorName={active.investorName}
                      investorFirm={active.investorFirm}
                    />
                  </div>
                ) : (
                  <>
                    {active.status === "draft" && (
                      <button
                        onClick={() => onApprove(active.id)}
                        className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                        style={{ border: `1px solid ${C.amber}`, color: C.amber, backgroundColor: C.amberDim }}
                      >
                        Approve
                      </button>
                    )}
                    <button
                      onClick={() => onSend(active.id)}
                      disabled={isSending || !active.toEmail}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
                      style={{ backgroundColor: C.emerald, color: "oklch(0.1 0.01 162)" }}
                    >
                      {isSending && sendingId === active.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Send size={14} />
                      )}
                      Send via PYTHIA
                    </button>
                    {!active.toEmail && (
                      <p className="text-xs" style={{ color: C.dim }}>Add a recipient email to send</p>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm" style={{ color: C.dim }}>Select an investor to view their email</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export default function ActivatePythiaModal({
  open,
  onClose,
  runId,
  startupUrl,
  startupSummary,
  investors,
}: Props) {
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [deckId, setDeckId] = useState<number | null>(null);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [emails, setEmails] = useState<EmailDraft[]>([]);
  const [fromName, setFromName] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [sendingId, setSendingId] = useState<number | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // ── tRPC utils (must be at top level, not inside callbacks) ──
  const utils = trpc.useUtils();
  // ── tRPC mutations ──
  const exportDeckPdf = trpc.outreach.exportDeckPdf.useMutation();
  const generateDeck = trpc.outreach.generateDeck.useMutation();
  const uploadDeck = trpc.outreach.uploadDeck.useMutation();
  const updateDeck = trpc.outreach.updateDeck.useMutation();
  const generateEmailPitch = trpc.outreach.generateEmailPitch.useMutation();
  const updateEmail = trpc.outreach.updateEmail.useMutation();
  const approveEmail = trpc.outreach.approveEmail.useMutation();
  const sendEmail = trpc.outreach.sendEmail.useMutation();

  // ── Load existing outreach status on open ──
  const { data: status } = trpc.outreach.getOutreachStatus.useQuery(
    { runId },
    { enabled: open, refetchOnWindowFocus: false }
  );

  useEffect(() => {
    if (!status) return;
    if (status.deck) {
      setDeckId(status.deck.id);
      setSlides(status.deck.slides);
      if (status.emails.length > 0) {
        setEmails(status.emails as EmailDraft[]);
        setStep(2);
      } else {
        setStep(1);
      }
    }
  }, [status]);

  // ── Step 1: Generate deck ──
  const handleGenerate = async () => {
    try {
      const result = await generateDeck.mutateAsync({ runId, startupUrl, startupSummary });
      setDeckId(result.deckId);
      setSlides(result.slides);
      setStep(1);
    } catch {
      toast.error("PYTHIA couldn't generate the deck. Please try again.");
    }
  };

  // ── Step 1: Upload deck ──
  const handleUpload = async (file: File) => {
    if (file.size > 16 * 1024 * 1024) {
      toast.error("File too large — maximum 16 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = (e.target?.result as string).split(",")[1];
      try {
        const result = await uploadDeck.mutateAsync({
          runId,
          startupUrl,
          fileName: file.name,
          fileBase64: base64,
          mimeType: file.type,
        });
        setDeckId(result.deckId);
        setSlides(result.slides);
        setStep(1);
        toast.success("Deck uploaded — edit the slides below");
      } catch {
        toast.error("Upload failed. Please try again.");
      }
    };
    reader.readAsDataURL(file);
  };

  // ── Step 2: Auto-save slides with debounce ──
  const handleSlidesChange = (newSlides: Slide[]) => {
    setSlides(newSlides);
    if (!deckId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setIsSaving(true);
    saveTimerRef.current = setTimeout(async () => {
      try {
        await updateDeck.mutateAsync({ deckId, slides: newSlides });
      } finally {
        setIsSaving(false);
      }
    }, 800);
  };

  // ── Step 2: Approve deck → generate emails ──
  const handleApproveDeck = async () => {
    if (deckId) {
      await updateDeck.mutateAsync({ deckId, slides, status: "approved" });
    }
    // Generate email pitches for all investors
    try {
      await generateEmailPitch.mutateAsync({
        runId,
        startupUrl,
        startupSummary,
        investors: investors.map((inv) => ({
          name: inv.name,
          firm: inv.firm,
          sector: inv.sector,
          matchReason: inv.matchReason,
          email: inv.email,
        })),
      });
      // Reload emails
      const fresh = await utils.outreach.getOutreachStatus.fetch({ runId });
      setEmails((fresh?.emails ?? []) as EmailDraft[]);
      setStep(2);
    } catch {
      toast.error("Couldn't generate email pitches. Please try again.");
    }
  };

  // ── Step 3: Approve email ──
  const handleApproveEmail = async (id: number) => {
    await approveEmail.mutateAsync({ emailId: id });
    setEmails((prev) => prev.map((e) => (e.id === id ? { ...e, status: "approved" } : e)));
  };

  // ── Step 3: Send email ──
  const handleSendEmail = async (id: number) => {
    setSendingId(id);
    try {
      await sendEmail.mutateAsync({ emailId: id, runId, fromName: fromName || undefined, replyTo: replyTo || undefined });
      setEmails((prev) => prev.map((e) => (e.id === id ? { ...e, status: "sent", sentAt: Date.now() } : e)));
      toast.success("Email sent via PYTHIA");
    } catch (err: any) {
      toast.error(err?.message?.includes("Resend") ? "Email delivery failed — check your Resend API key" : "Send failed. Please try again.");
    } finally {
      setSendingId(null);
    }
  };

  // ── Step 3: Update email ──
  const handleUpdateEmail = async (id: number, patch: { subject?: string; body?: string; toEmail?: string }) => {
    await updateEmail.mutateAsync({ emailId: id, ...patch });
    setEmails((prev) =>
      prev.map((e) =>
        e.id === id
          ? { ...e, subject: patch.subject ?? e.subject, body: patch.body ?? e.body, toEmail: patch.toEmail ?? e.toEmail }
          : e
      )
    );
  };

  if (!open) return null;

  const isGenerating = generateDeck.isPending || uploadDeck.isPending;
  const isGeneratingEmails = generateEmailPitch.isPending;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ backgroundColor: C.bg }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0"
        style={{ borderColor: C.border, backgroundColor: C.surface }}
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
              style={{ backgroundColor: C.emeraldDim, border: `1px solid ${C.emeraldBorder}`, color: C.emerald }}
            >
              Ψ
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: C.text }}>PYTHIA Outreach</p>
              <p className="text-xs" style={{ color: C.dim }}>
                {startupUrl.replace(/https?:\/\//, "").replace(/\/.*/, "")}
              </p>
            </div>
          </div>
          <div className="hidden sm:block">
            <StepIndicator step={step} total={3} />
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg transition-colors"
          style={{ color: C.muted }}
          onMouseEnter={(e) => (e.currentTarget.style.color = C.text)}
          onMouseLeave={(e) => (e.currentTarget.style.color = C.muted)}
        >
          <X size={18} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {step === 0 && (
          <MaterialsStep
            onGenerate={handleGenerate}
            onUpload={handleUpload}
            isGenerating={isGenerating}
          />
        )}
        {step === 1 && (
          <DeckEditor
            slides={slides}
            onChange={handleSlidesChange}
            onApprove={handleApproveDeck}
            isSaving={isSaving || isGeneratingEmails}
            deckId={deckId}
            startupUrl={startupUrl}
          />
        )}
        {step === 2 && (
          isGeneratingEmails ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <Loader2 size={32} className="animate-spin" style={{ color: C.emerald }} />
              <p className="text-sm" style={{ color: C.muted }}>PYTHIA is writing personalised emails for each investor…</p>
            </div>
          ) : (
            <EmailPitchStep
              runId={runId}
              emails={emails}
              onApprove={handleApproveEmail}
              onSend={handleSendEmail}
              onUpdate={handleUpdateEmail}
              isSending={sendEmail.isPending}
              sendingId={sendingId}
              fromName={fromName}
              replyTo={replyTo}
              onFromNameChange={setFromName}
              onReplyToChange={setReplyTo}
            />
          )
        )}
      </div>
    </div>
  );
}
