import AdminToolsGrid from "../components/admin/AdminToolsGrid";

export default function AdminToolsHubPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
          Admin Tools
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Full console — GOD weights, signal scores, matching logic, scrapers, and more.
        </p>
      </div>
      <AdminToolsGrid />
    </div>
  );
}
