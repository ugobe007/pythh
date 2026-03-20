/**
 * LP Target List — P5 Fundraise Pipeline
 * Add, edit, filter LPs. Target: 150 (50 FO, 20 FoF, 40 HNW, 20 Operators, 20 Corporate)
 */

import React, { useState, useEffect } from "react";
import {
  Plus,
  RefreshCw,
  Download,
  Upload,
  Search,
  ExternalLink,
  Mail,
  Building2,
  Filter,
  X,
  ChevronDown,
} from "lucide-react";
import { supabase } from "../lib/supabase";

const LP_TYPES = [
  { value: "family_office", label: "Family Office", target: 50 },
  { value: "fof", label: "Fund of Funds", target: 20 },
  { value: "hnw", label: "HNW / Angel", target: 40 },
  { value: "operator", label: "Operator / Founder", target: 20 },
  { value: "corporate", label: "Corporate", target: 20 },
] as const;

const STATUSES = [
  "not_contacted",
  "contacted",
  "meeting",
  "in_dd",
  "closed",
] as const;

const CONNECTIONS = ["warm", "cold", "event", "intro"] as const;

interface LPTarget {
  id: string;
  name: string;
  organization?: string | null;
  lp_type: string;
  location?: string | null;
  location_city?: string | null;
  check_size?: string | null;
  investment_focus?: string[] | null;
  connection?: string | null;
  status: string;
  email?: string | null;
  linkedin_url?: string | null;
  twitter_url?: string | null;
  notes?: string | null;
  source?: string | null;
  source_detail?: string | null;
  created_at?: string | null;
  contacted_at?: string | null;
}

interface PipelineStat {
  lp_type: string;
  total: number;
  target: number;
  not_contacted: number;
  contacted: number;
  meeting: number;
  in_dd: number;
  closed: number;
}

const defaultLP: Partial<LPTarget> = {
  name: "",
  organization: "",
  lp_type: "family_office",
  location: "",
  check_size: "",
  investment_focus: [],
  connection: "cold",
  status: "not_contacted",
  email: "",
  linkedin_url: "",
  notes: "",
  source: "",
  source_detail: "",
};

export default function LPTargetsPage() {
  const [targets, setTargets] = useState<LPTarget[]>([]);
  const [stats, setStats] = useState<PipelineStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editing, setEditing] = useState<LPTarget | null>(null);
  const [form, setForm] = useState<Partial<LPTarget>>(defaultLP);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [targetsRes, statsRes] = await Promise.all([
        supabase.from("lp_targets").select("*").order("created_at", { ascending: false }),
        supabase.rpc("get_lp_pipeline_stats"),
      ]);
      if (targetsRes.error) throw targetsRes.error;
      if (statsRes.error) throw statsRes.error;
      setTargets((targetsRes.data ?? []) as LPTarget[]);
      setStats((statsRes.data ?? []) as PipelineStat[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = targets.filter((t) => {
    const matchSearch =
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.organization ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (t.notes ?? "").toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === "all" || t.lp_type === filterType;
    const matchStatus = filterStatus === "all" || t.status === filterStatus;
    return matchSearch && matchType && matchStatus;
  });

  const openAdd = () => {
    setForm({ ...defaultLP });
    setShowAddModal(true);
  };

  const openEdit = (t: LPTarget) => {
    setForm({
      ...t,
      investment_focus: t.investment_focus ?? [],
    });
    setEditing(t);
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditing(null);
    setForm(defaultLP);
  };

  const save = async () => {
    if (!form.name?.trim()) {
      setError("Name is required");
      return;
    }
    try {
      setSaving(true);
      setError(null);
      const row = {
        name: form.name.trim(),
        organization: form.organization?.trim() || null,
        lp_type: form.lp_type || "family_office",
        location: form.location?.trim() || null,
        location_city: form.location_city?.trim() || null,
        check_size: form.check_size?.trim() || null,
        investment_focus: Array.isArray(form.investment_focus)
          ? form.investment_focus.filter(Boolean)
          : [],
        connection: form.connection || null,
        status: form.status || "not_contacted",
        email: form.email?.trim() || null,
        linkedin_url: form.linkedin_url?.trim() || null,
        twitter_url: form.twitter_url?.trim() || null,
        notes: form.notes?.trim() || null,
        source: form.source?.trim() || null,
        source_detail: form.source_detail?.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (editing) {
        const { error: err } = await supabase
          .from("lp_targets")
          .update(row)
          .eq("id", editing.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from("lp_targets").insert(row);
        if (err) throw err;
      }
      closeModal();
      loadData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const deleteLP = async (id: string) => {
    if (!confirm("Delete this LP?")) return;
    try {
      const { error: err } = await supabase.from("lp_targets").delete().eq("id", id);
      if (err) throw err;
      loadData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    }
  };

  const exportCSV = () => {
    const headers = [
      "Name",
      "Organization",
      "LP Type",
      "Location",
      "Check Size",
      "Investment Focus",
      "Connection",
      "Status",
      "Email",
      "LinkedIn",
      "Notes",
      "Source",
    ];
    const rows = filtered.map((t) => [
      t.name,
      t.organization ?? "",
      t.lp_type,
      t.location ?? t.location_city ?? "",
      t.check_size ?? "",
      (t.investment_focus ?? []).join("; "),
      t.connection ?? "",
      t.status,
      t.email ?? "",
      t.linkedin_url ?? "",
      (t.notes ?? "").replace(/"/g, '""'),
      t.source ?? "",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lp-targets-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const handleImport = async () => {
    if (!importFile) return;
    const text = await importFile.text();
    const lines = text.split("\n").filter(Boolean);
    if (lines.length < 2) {
      setError("CSV must have header + at least one row");
      return;
    }
    const headers = lines[0].toLowerCase().split(",").map((h) => h.trim().replace(/"/g, ""));
    const rows = lines.slice(1).map((line) => {
      const values: string[] = [];
      let cur = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') inQuotes = !inQuotes;
        else if ((c === "," && !inQuotes) || c === "\r") {
          values.push(cur.trim());
          cur = "";
        } else cur += c;
      }
      values.push(cur.trim());
      return values;
    });

    const idx = (name: string) => headers.findIndex((h) => h.includes(name));
    const get = (row: string[], names: string[]) => {
      for (const n of names) {
        const i = idx(n);
        if (i >= 0 && row[i]) return row[i].replace(/^"|"$/g, "").trim();
      }
      return "";
    };

    const lpTypeMap: Record<string, string> = {
      "family office": "family_office",
      "fof": "fof",
      "fund of funds": "fof",
      "hnw": "hnw",
      "angel": "hnw",
      "operator": "operator",
      "founder": "operator",
      "corporate": "corporate",
    };

    const inserts = rows.map((row) => {
      const rawType = get(row, ["lp type", "lptype", "type"]).toLowerCase();
      const lp_type = lpTypeMap[rawType] || "family_office";
      const statusRaw = get(row, ["status"]).toLowerCase();
      const status = STATUSES.includes(statusRaw as (typeof STATUSES)[number])
        ? statusRaw
        : "not_contacted";
      const connRaw = get(row, ["connection"]).toLowerCase();
      const connection = CONNECTIONS.includes(connRaw as (typeof CONNECTIONS)[number])
        ? connRaw
        : null;
      const focus = get(row, ["investment focus", "focus"]);
      return {
        name: get(row, ["name", "person"]) || "Unknown",
        organization: get(row, ["organization", "org", "fund"]) || null,
        lp_type,
        location: get(row, ["location", "city"]) || null,
        check_size: get(row, ["check size", "checksize"]) || null,
        investment_focus: focus ? focus.split(/[;,]/).map((s) => s.trim()).filter(Boolean) : [],
        connection,
        status,
        email: get(row, ["email"]) || null,
        linkedin_url: get(row, ["linkedin", "linkedin_url"]) || null,
        notes: get(row, ["notes", "background"]) || null,
        source: get(row, ["source"]) || null,
      };
    });

    try {
      setSaving(true);
      const { error: err } = await supabase.from("lp_targets").insert(inserts);
      if (err) throw err;
      setImportFile(null);
      loadData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setSaving(false);
    }
  };

  const totalTarget = 150;
  const totalActual = targets.length;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
              LP Target List
            </h1>
            <p className="text-slate-400 text-sm mt-0.5">
              Fundraise pipeline • Target 150 LPs
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              onClick={openAdd}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium text-sm"
            >
              <Plus className="w-4 h-4" />
              Add LP
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Pipeline stats */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
          <div className="col-span-2 md:col-span-1 bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="text-2xl font-bold text-white">{totalActual}</div>
            <div className="text-xs text-slate-400">Total / 150</div>
            <div className="mt-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full"
                style={{ width: `${Math.min(100, (totalActual / totalTarget) * 100)}%` }}
              />
            </div>
          </div>
          {stats.map((s) => (
            <div
              key={s.lp_type}
              className="bg-slate-800/50 border border-slate-700 rounded-xl p-3"
            >
              <div className="text-xs text-slate-400 uppercase tracking-wide">
                {LP_TYPES.find((t) => t.value === s.lp_type)?.label ?? s.lp_type}
              </div>
              <div className="text-lg font-bold text-white">
                {Number(s.total)} / {s.target}
              </div>
              <div className="flex gap-1 mt-1 text-[10px] text-slate-500">
                <span>{Number(s.not_contacted)} nc</span>
                <span>{Number(s.contacted)} ct</span>
                <span>{Number(s.meeting)} mt</span>
                <span>{Number(s.closed)} ✓</span>
              </div>
            </div>
          ))}
        </div>

        {/* Filters & search */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search name, org, notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500/50"
          >
            <option value="all">All types</option>
            {LP_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500/50"
          >
            <option value="all">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              const template =
                "Name,Organization,LP Type,Location,Check Size,Investment Focus,Connection,Status,Email,LinkedIn,Notes,Source\n" +
                "Jane Doe,Acme Family Office,Family Office,NYC,$500k,VC; AI,cold,not_contacted,jane@acme.com,,,LinkedIn";
              const blob = new Blob([template], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "lp-targets-template.csv";
              a.click();
            }}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm"
          >
            <Download className="w-4 h-4" />
            Template
          </button>
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm cursor-pointer">
              <Upload className="w-4 h-4" />
              Import CSV
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setImportFile(f);
                }}
              />
            </label>
            {importFile && (
              <>
                <span className="text-slate-400 text-sm truncate max-w-[120px]">
                  {importFile.name}
                </span>
                <button
                  onClick={handleImport}
                  disabled={saving}
                  className="px-3 py-1 bg-amber-600 hover:bg-amber-500 rounded text-sm"
                >
                  {saving ? "..." : "Import"}
                </button>
                <button onClick={() => setImportFile(null)} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="bg-slate-800/30 border border-slate-700 rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mx-auto mb-2" />
              <p className="text-slate-400">Loading...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 mb-2">No LPs yet</p>
              <p className="text-slate-500 text-sm mb-4">
                Add from LinkedIn, conferences, PitchBook, or import CSV
              </p>
              <button
                onClick={openAdd}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 rounded-lg font-medium"
              >
                Add first LP
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-800/50">
                    <th className="text-left py-3 px-4 font-medium text-slate-300">Name</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-300">Organization</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-300">Type</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-300">Check</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-300">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-300">Connection</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-300">Contact</th>
                    <th className="w-24 py-3 px-4" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => (
                    <tr
                      key={t.id}
                      className="border-b border-slate-800 hover:bg-slate-800/30"
                    >
                      <td className="py-3 px-4">
                        <span className="font-medium text-white">{t.name}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-400">{t.organization ?? "—"}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-slate-700 text-slate-300 text-xs">
                          {LP_TYPES.find((x) => x.value === t.lp_type)?.label ?? t.lp_type}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400">{t.check_size ?? "—"}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-xs ${
                            t.status === "closed"
                              ? "bg-green-500/20 text-green-400"
                              : t.status === "meeting" || t.status === "in_dd"
                                ? "bg-amber-500/20 text-amber-400"
                                : t.status === "contacted"
                                  ? "bg-blue-500/20 text-blue-400"
                                  : "bg-slate-600 text-slate-400"
                          }`}
                        >
                          {t.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400">{t.connection ?? "—"}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {t.linkedin_url && (
                            <a
                              href={t.linkedin_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-amber-400 hover:text-amber-300"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                          {t.email && (
                            <a
                              href={`mailto:${t.email}`}
                              className="text-slate-400 hover:text-white"
                            >
                              <Mail className="w-4 h-4" />
                            </a>
                          )}
                          {!t.email && !t.linkedin_url && "—"}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEdit(t)}
                            className="px-2 py-1 text-slate-400 hover:text-amber-400 text-xs"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteLP(t.id)}
                            className="px-2 py-1 text-slate-400 hover:text-red-400 text-xs"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Sources reference */}
        <div className="mt-6 p-4 bg-slate-800/30 border border-slate-700 rounded-xl">
          <h3 className="text-sm font-medium text-slate-300 mb-2">Where to find LPs</h3>
          <p className="text-slate-500 text-xs">
            LinkedIn (Family Office Principal, FoF, Capital Partner), SuperReturn, Milken, SALT,
            PitchBook, Crunchbase, AngelList, LinkedIn Sales Navigator
          </p>
        </div>
      </div>

      {/* Add / Edit modal */}
      {(showAddModal || editing) && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="font-bold text-lg">
                {editing ? "Edit LP" : "Add LP"}
              </h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Name *</label>
                <input
                  type="text"
                  value={form.name ?? ""}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Person"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Organization</label>
                <input
                  type="text"
                  value={form.organization ?? ""}
                  onChange={(e) => setForm({ ...form, organization: e.target.value })}
                  placeholder="Fund / Family Office"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">LP Type</label>
                  <select
                    value={form.lp_type ?? "family_office"}
                    onChange={(e) => setForm({ ...form, lp_type: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-amber-500/50"
                  >
                    {LP_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Check Size</label>
                  <input
                    type="text"
                    value={form.check_size ?? ""}
                    onChange={(e) => setForm({ ...form, check_size: e.target.value })}
                    placeholder="$250k, $500k, $1M"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Status</label>
                  <select
                    value={form.status ?? "not_contacted"}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-amber-500/50"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Connection</label>
                  <select
                    value={form.connection ?? "cold"}
                    onChange={(e) => setForm({ ...form, connection: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-amber-500/50"
                  >
                    <option value="">—</option>
                    {CONNECTIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Location</label>
                <input
                  type="text"
                  value={form.location ?? form.location_city ?? ""}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="City"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Investment Focus</label>
                <input
                  type="text"
                  value={(form.investment_focus ?? []).join(", ")}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      investment_focus: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                    })
                  }
                  placeholder="VC, AI, Data, Fintech"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Email</label>
                <input
                  type="email"
                  value={form.email ?? ""}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="Contact"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">LinkedIn URL</label>
                <input
                  type="url"
                  value={form.linkedin_url ?? ""}
                  onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })}
                  placeholder="https://linkedin.com/in/..."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Source</label>
                <input
                  type="text"
                  value={form.source ?? ""}
                  onChange={(e) => setForm({ ...form, source: e.target.value })}
                  placeholder="LinkedIn, SuperReturn, PitchBook"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Notes</label>
                <textarea
                  value={form.notes ?? ""}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Background"
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50 resize-none"
                />
              </div>
            </div>
            <div className="p-4 border-t border-slate-700 flex justify-end gap-2">
              <button
                onClick={closeModal}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 rounded-lg font-medium text-sm"
              >
                {saving ? "Saving..." : editing ? "Save" : "Add LP"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
