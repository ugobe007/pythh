import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";

const G = "oklch(0.696 0.17 162.48)";

function limitText(matchLimit: number | null, durationDays: number | null) {
  const parts: string[] = [];
  if (matchLimit != null) parts.push(`${matchLimit} match${matchLimit === 1 ? "" : "es"}`);
  if (durationDays != null) parts.push(`${durationDays} day${durationDays === 1 ? "" : "s"}`);
  return parts.join(" or ");
}

export default function ScoutCouponsPage() {
  const utils = trpc.useUtils();
  const list = trpc.scoutCoupons.list.useQuery(undefined, { retry: false });
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [matchLimit, setMatchLimit] = useState("");
  const [durationDays, setDurationDays] = useState("14");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [redeemBy, setRedeemBy] = useState("");

  const create = trpc.scoutCoupons.create.useMutation({
    onSuccess: async (row) => {
      await utils.scoutCoupons.list.invalidate();
      setCode("");
      setLabel("");
      const link = `${window.location.origin}${row?.sharePath || ""}`;
      if (row?.sharePath) await navigator.clipboard.writeText(link).catch(() => {});
      toast.success(row?.code ? `${row.code} copied as a share link.` : "Code created.");
    },
    onError: (err) => toast.error(err.message || "Could not create that code."),
  });

  const setActive = trpc.scoutCoupons.setActive.useMutation({
    onSuccess: () => utils.scoutCoupons.list.invalidate(),
    onError: (err) => toast.error(err.message || "Could not update that code."),
  });

  const field = {
    backgroundColor: "oklch(0.1 0.01 264)",
    border: "1px solid oklch(0.22 0.01 264)",
    color: "oklch(0.97 0.005 264)",
    borderRadius: 8,
    minHeight: 40,
    padding: "0 10px",
    width: "100%",
    fontSize: 13,
  } as const;

  return (
    <DashboardLayout>
      <Helmet>
        <title>Scout codes — Pythh admin</title>
      </Helmet>
      <div style={{ maxWidth: 880 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: G, marginBottom: 8 }}>
          SCOUT
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 8px" }}>Access codes</h1>
        <p style={{ fontSize: 13, color: "oklch(0.55 0.01 264)", marginTop: 0, maxWidth: 640 }}>
          Share a link with a founder. Scout stays on until the match count or the time window runs out. Pausing a code stops new redemptions. Founders who already redeemed keep access until their own limit.
        </p>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate({
              code: code.trim() || undefined,
              label: label.trim() || undefined,
              matchLimit: matchLimit.trim() ? Number(matchLimit) : null,
              durationDays: durationDays.trim() ? Number(durationDays) : null,
              maxRedemptions: maxRedemptions.trim() ? Number(maxRedemptions) : null,
              redeemBy: redeemBy || null,
            });
          }}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 10,
            padding: 16,
            borderRadius: 12,
            background: "oklch(0.15 0.01 264)",
            border: "1px solid oklch(0.22 0.01 264)",
            marginBottom: 20,
          }}
        >
          <label style={{ fontSize: 11, color: "oklch(0.55 0.01 264)" }}>
            Code
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Auto" style={{ ...field, marginTop: 4 }} />
          </label>
          <label style={{ fontSize: 11, color: "oklch(0.55 0.01 264)" }}>
            Label
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="YC office hours" style={{ ...field, marginTop: 4 }} />
          </label>
          <label style={{ fontSize: 11, color: "oklch(0.55 0.01 264)" }}>
            Matches
            <input value={matchLimit} onChange={(e) => setMatchLimit(e.target.value)} inputMode="numeric" placeholder="10" style={{ ...field, marginTop: 4 }} />
          </label>
          <label style={{ fontSize: 11, color: "oklch(0.55 0.01 264)" }}>
            Days
            <input value={durationDays} onChange={(e) => setDurationDays(e.target.value)} inputMode="numeric" placeholder="14" style={{ ...field, marginTop: 4 }} />
          </label>
          <label style={{ fontSize: 11, color: "oklch(0.55 0.01 264)" }}>
            Max founders
            <input value={maxRedemptions} onChange={(e) => setMaxRedemptions(e.target.value)} inputMode="numeric" placeholder="Unlimited" style={{ ...field, marginTop: 4 }} />
          </label>
          <label style={{ fontSize: 11, color: "oklch(0.55 0.01 264)" }}>
            Redeem by
            <input type="date" value={redeemBy} onChange={(e) => setRedeemBy(e.target.value)} style={{ ...field, marginTop: 4 }} />
          </label>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button
              type="submit"
              disabled={create.isPending}
              style={{
                minHeight: 40,
                width: "100%",
                borderRadius: 8,
                border: "none",
                background: G,
                color: "oklch(0.1 0.02 162)",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {create.isPending ? "Creating…" : "Create code"}
            </button>
          </div>
        </form>

        {list.isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : list.error ? (
          <p style={{ color: "oklch(0.7 0.15 25)", fontSize: 13 }}>{list.error.message}</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ color: "oklch(0.45 0.01 264)", textAlign: "left" }}>
                  <th style={{ padding: "8px 6px" }}>Code</th>
                  <th style={{ padding: "8px 6px" }}>Limit</th>
                  <th style={{ padding: "8px 6px" }}>Claimed</th>
                  <th style={{ padding: "8px 6px" }} />
                </tr>
              </thead>
              <tbody>
                {(list.data || []).map((row) => (
                  <tr key={row.id} style={{ borderTop: "1px solid oklch(0.2 0.01 264)" }}>
                    <td style={{ padding: "10px 6px" }}>
                      <div style={{ fontFamily: "monospace", fontWeight: 700 }}>{row.code}</div>
                      <div style={{ fontSize: 11, color: "oklch(0.45 0.01 264)" }}>
                        {row.label || "Untitled"}
                        {row.active ? "" : " · paused"}
                      </div>
                    </td>
                    <td style={{ padding: "10px 6px", color: "oklch(0.75 0.01 264)" }}>
                      {limitText(row.matchLimit, row.durationDays)}
                    </td>
                    <td style={{ padding: "10px 6px" }}>
                      {row.redemptionCount}
                      {row.maxRedemptions != null ? ` / ${row.maxRedemptions}` : ""}
                    </td>
                    <td style={{ padding: "10px 6px", textAlign: "right" }}>
                      <button
                        type="button"
                        onClick={() => {
                          const link = `${window.location.origin}${row.sharePath}`;
                          void navigator.clipboard.writeText(link);
                          toast.success("Share link copied.");
                        }}
                        style={{ marginRight: 8, background: "none", border: "none", color: G, cursor: "pointer" }}
                      >
                        Copy link
                      </button>
                      <button
                        type="button"
                        onClick={() => setActive.mutate({ id: row.id, active: !row.active })}
                        style={{ background: "none", border: "none", color: "oklch(0.7 0.01 264)", cursor: "pointer" }}
                      >
                        {row.active ? "Pause" : "Resume"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!list.data?.length ? (
              <p style={{ fontSize: 13, color: "oklch(0.45 0.01 264)" }}>No codes yet.</p>
            ) : null}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
