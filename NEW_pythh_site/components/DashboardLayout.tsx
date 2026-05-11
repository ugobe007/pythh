import { Link } from "wouter";
import type { ReactNode } from "react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex" style={{ backgroundColor: "oklch(0.13 0.01 264)", color: "oklch(0.92 0.005 264)" }}>
      <aside
        className="w-52 shrink-0 border-r p-4 flex flex-col gap-2"
        style={{ borderColor: "oklch(0.22 0.01 264)", backgroundColor: "oklch(0.11 0.01 264)" }}
      >
        <span className="text-[10px] font-bold tracking-widest mb-2" style={{ color: "oklch(0.5 0.01 264)" }}>
          INTERNAL
        </span>
        <Link href="/admin" className="text-xs px-2 py-1.5 rounded hover:bg-white/5">
          Overview
        </Link>
        <Link href="/account" className="text-xs px-2 py-1.5 rounded hover:bg-white/5">
          Back to account
        </Link>
        <Link href="/" className="text-xs px-2 py-1.5 rounded hover:bg-white/5">
          Home
        </Link>
      </aside>
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
