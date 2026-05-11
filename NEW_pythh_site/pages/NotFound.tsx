import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8" style={{ background: "oklch(0.13 0.01 264)", color: "oklch(0.9 0.005 264)" }}>
      <h1 className="text-2xl font-bold">404</h1>
      <p className="text-sm opacity-70">This page does not exist.</p>
      <Link href="/" className="text-emerald-400 underline text-sm">
        Back home
      </Link>
    </div>
  );
}
