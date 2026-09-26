import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const G = "oklch(0.696 0.17 162.48)";

function daysLeft(expiresAt: string | null) {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

export default function ScoutCouponCard() {
  const utils = trpc.useUtils();
  const { data: access, isLoading } = trpc.scoutCoupons.status.useQuery(undefined, { retry: false });
  const [code, setCode] = useState("");
  const autoTried = useRef(false);

  const redeem = trpc.scoutCoupons.redeem.useMutation({
    onSuccess: async (result) => {
      await utils.scoutCoupons.status.invalidate();
      if (result?.active) {
        toast.success(result.summary || "Scout access is on.");
      } else if (result?.summary) {
        toast.message(result.summary);
      }
      const url = new URL(window.location.href);
      if (url.searchParams.has("coupon")) {
        url.searchParams.delete("coupon");
        window.history.replaceState({}, "", url.pathname + url.search);
      }
    },
    onError: (err) => {
      toast.error(err.message || "Could not redeem that code.");
    },
  });

  useEffect(() => {
    if (autoTried.current || isLoading || access?.active) return;
    const preset = new URLSearchParams(window.location.search).get("coupon");
    if (!preset) return;
    autoTried.current = true;
    setCode(preset);
    redeem.mutate({ code: preset });
  }, [access?.active, isLoading, redeem]);

  const remainingDays = daysLeft(access?.expiresAt || null);

  return (
    <section
      className="rounded-2xl p-5 border"
      style={{ backgroundColor: "oklch(0.13 0.01 264)", borderColor: "oklch(0.22 0.01 264)" }}
    >
      <div className="text-[10px] font-bold tracking-widest mb-2" style={{ color: G }}>
        SCOUT CODE
      </div>
      {isLoading ? (
        <p className="text-sm" style={{ color: "oklch(0.5 0.01 264)" }}>Checking access…</p>
      ) : access?.active ? (
        <div>
          <p className="text-sm font-semibold" style={{ color: "oklch(0.97 0.005 264)" }}>
            {access.summary || "Scout access is on."}
          </p>
          <p className="text-xs mt-1" style={{ color: "oklch(0.5 0.01 264)" }}>
            {access.code ? `Code ${access.code}` : "Access code"}
            {access.matchLimit != null ? ` · ${access.matchesUsed} of ${access.matchLimit} matches used` : ""}
            {remainingDays != null ? ` · ${remainingDays} day${remainingDays === 1 ? "" : "s"} left` : ""}
          </p>
        </div>
      ) : (
        <form
          className="flex flex-col sm:flex-row gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const next = code.trim();
            if (!next) return;
            redeem.mutate({ code: next });
          }}
        >
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="Enter a Scout code"
            autoComplete="off"
            className="flex-1 rounded-lg px-3 text-sm"
            style={{
              minHeight: 42,
              backgroundColor: "oklch(0.1 0.01 264)",
              border: "1px solid oklch(0.22 0.01 264)",
              color: "oklch(0.97 0.005 264)",
            }}
          />
          <button
            type="submit"
            disabled={redeem.isPending || !code.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold disabled:opacity-50"
            style={{ minHeight: 42, backgroundColor: G, color: "oklch(0.1 0.02 162.48)" }}
          >
            {redeem.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Redeem
          </button>
        </form>
      )}
      {!access?.active && access?.summary ? (
        <p className="text-xs mt-2" style={{ color: "oklch(0.65 0.12 70)" }}>{access.summary}</p>
      ) : null}
      {!access?.active ? (
        <p className="text-xs mt-2" style={{ color: "oklch(0.45 0.01 264)" }}>
          A code turns on Scout — outreach, investor email, the deck outline, and term sheets — for a set number of matches, a set number of days, or both.
        </p>
      ) : null}
    </section>
  );
}
