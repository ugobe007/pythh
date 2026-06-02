import { useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";

/** Legacy path — OAuth now completes on /account (same as the old pythh.ai app). */
export default function AuthCallback() {
  const [, navigate] = useLocation();

  useEffect(() => {
    navigate(`/account${window.location.search || ""}`);
  }, [navigate]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-3"
      style={{ backgroundColor: "oklch(0.08 0.01 264)" }}
    >
      <Loader2 size={28} className="animate-spin" style={{ color: "#22d3ee" }} />
      <p className="text-sm" style={{ color: "oklch(0.65 0.01 264)" }}>Completing sign-in…</p>
    </div>
  );
}
