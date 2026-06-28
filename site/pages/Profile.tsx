/**
 * Founder profile — prefill data for PYTHIA (handoff §6.5).
 */
import { Helmet } from "react-helmet-async";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Loader2 } from "lucide-react";

export default function ProfilePage() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const { data, isLoading, refetch } = trpc.profile.get.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
  });

  const [companyName, setCompanyName] = useState("");
  const [companyUrl, setCompanyUrl] = useState("");
  const [stage, setStage] = useState("");
  const [sector, setSector] = useState("");
  const [askAmount, setAskAmount] = useState("");
  const [bio, setBio] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      window.location.href = getLoginUrl();
    }
  }, [authLoading, isAuthenticated]);

  useEffect(() => {
    if (!data) return;
    setCompanyName(data.companyName ?? "");
    setCompanyUrl(data.companyUrl ?? "");
    setStage(data.stage ?? "");
    setSector(data.sector ?? "");
    setAskAmount(data.askAmount ?? "");
    setBio(data.bio ?? "");
    setLinkedinUrl(data.linkedinUrl ?? "");
  }, [data]);

  const upsert = trpc.profile.upsert.useMutation({
    onSuccess: () => void refetch(),
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    upsert.mutate({
      companyName: companyName || undefined,
      companyUrl: companyUrl || undefined,
      stage: stage || undefined,
      sector: sector || undefined,
      askAmount: askAmount || undefined,
      bio: bio || undefined,
      linkedinUrl: linkedinUrl || undefined,
    });
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center gap-2" style={{ backgroundColor: "oklch(0.13 0.01 264)", color: "oklch(0.7 0.01 264)" }}>
        <Loader2 className="animate-spin" size={20} />
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-10 max-w-xl mx-auto" style={{ backgroundColor: "oklch(0.13 0.01 264)", color: "oklch(0.92 0.005 264)" }}>
      <Helmet>
        <title>Founder profile — Pythh.ai</title>
        <meta name="description" content="Company and fundraising details for PYTHIA." />
      </Helmet>
      <Link href="/account" className="text-xs text-emerald-400 mb-6 inline-block">
        ← Account
      </Link>
      <h1 className="text-2xl font-bold mb-2">Founder profile</h1>
      <p className="text-sm opacity-70 mb-6">Used to pre-fill PYTHIA runs and outreach context.</p>
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block text-xs font-semibold tracking-wide opacity-70">
          Company name
          <input
            className="mt-1 w-full rounded border px-3 py-2 text-sm bg-transparent"
            style={{ borderColor: "oklch(0.25 0.01 264)" }}
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
          />
        </label>
        <label className="block text-xs font-semibold tracking-wide opacity-70">
          Company URL
          <input
            className="mt-1 w-full rounded border px-3 py-2 text-sm bg-transparent"
            style={{ borderColor: "oklch(0.25 0.01 264)" }}
            value={companyUrl}
            onChange={(e) => setCompanyUrl(e.target.value)}
          />
        </label>
        <label className="block text-xs font-semibold tracking-wide opacity-70">
          Stage
          <input
            className="mt-1 w-full rounded border px-3 py-2 text-sm bg-transparent"
            style={{ borderColor: "oklch(0.25 0.01 264)" }}
            value={stage}
            onChange={(e) => setStage(e.target.value)}
            placeholder="Seed, Series A…"
          />
        </label>
        <label className="block text-xs font-semibold tracking-wide opacity-70">
          Sector
          <input
            className="mt-1 w-full rounded border px-3 py-2 text-sm bg-transparent"
            style={{ borderColor: "oklch(0.25 0.01 264)" }}
            value={sector}
            onChange={(e) => setSector(e.target.value)}
          />
        </label>
        <label className="block text-xs font-semibold tracking-wide opacity-70">
          Ask amount
          <input
            className="mt-1 w-full rounded border px-3 py-2 text-sm bg-transparent"
            style={{ borderColor: "oklch(0.25 0.01 264)" }}
            value={askAmount}
            onChange={(e) => setAskAmount(e.target.value)}
            placeholder="$2M seed"
          />
        </label>
        <label className="block text-xs font-semibold tracking-wide opacity-70">
          Bio
          <textarea
            className="mt-1 w-full rounded border px-3 py-2 text-sm bg-transparent min-h-[100px]"
            style={{ borderColor: "oklch(0.25 0.01 264)" }}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        </label>
        <label className="block text-xs font-semibold tracking-wide opacity-70">
          LinkedIn URL
          <input
            className="mt-1 w-full rounded border px-3 py-2 text-sm bg-transparent"
            style={{ borderColor: "oklch(0.25 0.01 264)" }}
            value={linkedinUrl}
            onChange={(e) => setLinkedinUrl(e.target.value)}
          />
        </label>
        <button
          type="submit"
          disabled={upsert.isPending}
          className="px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ backgroundColor: "oklch(0.696 0.17 162.48)", color: "oklch(0.1 0.01 162)" }}
        >
          {upsert.isPending ? "Saving…" : "Save profile"}
        </button>
      </form>
    </div>
  );
}
