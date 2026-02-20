import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import AdminNavBar from './AdminNavBar';
import DbHealthBanner from './DbHealthBanner';

/**
 * AdminRouteWrapper - Clean wrapper for admin routes
 * Uses AdminNavBar as the global navigation for all admin pages
 */
export function AdminRouteWrapper() {
  const location = useLocation();
  
  // Get current page name from path
  const getPageName = () => {
    const path = location.pathname.split('/').pop() || 'control';
    const pageNames: Record<string, string> = {
      'control': 'Control Center',
      'actions': 'Quick Actions',
      'pipeline': 'Pipeline Monitor',
      'health': 'System Health',
      'analytics': 'Analytics',
      'review': 'Review Queue',
      'review-queue': 'Review Queue',
      'discovered-startups': 'RSS Discoveries',
      'discovered-investors': 'Investors',
      'rss-manager': 'RSS Manager',
      'edit-startups': 'Edit Startups',
      'god-scores': 'GOD Scores',
      'ai-logs': 'AI Logs',
      'bulk-import': 'Bulk Import',
      'instructions': 'Instructions',
      'dashboard': 'Dashboard',
      'ml-dashboard': 'ML Dashboard',
      'ai-intelligence': 'AI Intelligence',
      'diagnostic': 'Diagnostic',
      'database-check': 'Database Check',
    };
    return pageNames[path] || path.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  return (
    <div className="min-h-screen bg-[#121212]">
      <DbHealthBanner />
      <AdminNavBar currentPage={getPageName()} />
      <main className="w-full pt-14">
        <Outlet />
      </main>
    </div>
  );
}

export default AdminRouteWrapper;
