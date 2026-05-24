import { Helmet } from "react-helmet-async";
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import AdminToolsGrid from "@/components/AdminToolsGrid";
import { ADMIN_TOOLS } from "@/config/adminToolsRegistry";

export default function AdminToolsHubPage() {
  const [buildSha, setBuildSha] = useState<string | null>(null);
  useEffect(() => {
    const meta = document.querySelector('meta[name="pythh-build"]');
    setBuildSha(meta?.getAttribute("content") || null);
  }, []);

  return (
    <DashboardLayout>
      <Helmet><title>All Admin Tools — Pythh</title></Helmet>
      <div className="mb-6">
        <h1 className="text-xl font-bold">All Admin Tools</h1>
        <p className="text-xs mt-1" style={{ color: "oklch(0.45 0.01 264)" }}>
          {ADMIN_TOOLS.length} panels — scoring weights, matching, scrapers, outreach.
          {buildSha && <span style={{ color: "oklch(0.35 0.01 264)" }}> · build {buildSha.slice(0, 7)}</span>}
        </p>
      </div>
      <AdminToolsGrid />
    </DashboardLayout>
  );
}
