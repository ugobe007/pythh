/**
 * AdminNavBar - Streamlined navigation bar for admin panels
 * Only shows WORKING routes - Jan 2026 cleanup
 */

import { Link, useLocation } from 'react-router-dom';
import { Home, Settings, BarChart3, Activity, ArrowLeft, Sparkles, Database, Cpu, ClipboardCheck, Briefcase, Users, Radio } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface AdminNavBarProps {
  showBack?: boolean;
  currentPage?: string;
}

export default function AdminNavBar({ showBack = true, currentPage }: AdminNavBarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <nav className="fixed top-0 left-0 right-0 bg-gray-900/95 backdrop-blur-xl border-b border-white/10 z-50">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-center gap-1.5 text-sm flex-wrap">
        {showBack && (
          <>
            <button 
              onClick={() => navigate(-1)} 
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back</span>
            </button>
            <span className="text-gray-600">|</span>
          </>
        )}
        <Link 
          to="/" 
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-all"
          title="Return to site (you stay logged in)"
        >
          <Home className="w-4 h-4" />
          <span className="hidden sm:inline">Home</span>
        </Link>
        <span className="text-gray-600">|</span>
        <Link 
          to="/admin" 
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-all ${
            location.pathname === '/admin'
              ? 'bg-orange-500/20 text-orange-300 font-semibold' 
              : 'bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Dashboard</span>
        </Link>
        <span className="text-gray-600">|</span>
        <Link 
          to="/admin/review-queue" 
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-all ${
            isActive('/admin/review-queue')
              ? 'bg-yellow-500/20 text-yellow-300 font-semibold' 
              : 'bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400/80 hover:text-yellow-300'
          }`}
        >
          <ClipboardCheck className="w-4 h-4" />
          <span>Review</span>
        </Link>
        <span className="text-gray-600">|</span>
        <Link 
          to="/admin/god-scores" 
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-all ${
            isActive('/admin/god-scores') || isActive('/admin/god-settings')
              ? 'bg-amber-500/20 text-amber-300 font-semibold' 
              : 'bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>GOD Scores</span>
        </Link>
        <span className="text-gray-600">|</span>
        <Link 
          to="/admin/edit-startups" 
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-all ${
            isActive('/admin/edit-startups') || isActive('/admin/discovered-startups')
              ? 'bg-cyan-500/20 text-cyan-300 font-semibold' 
              : 'bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Data</span>
        </Link>
        <span className="text-gray-600">|</span>
        <Link 
          to="/admin/health" 
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-all ${
            isActive('/admin/health') 
              ? 'bg-green-500/20 text-green-300 font-semibold' 
              : 'bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Health</span>
        </Link>
        <span className="text-gray-600">|</span>
        <Link 
          to="/admin/ai-intelligence" 
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-all ${
            isActive('/admin/ai-intelligence')
              ? 'bg-purple-500/20 text-purple-300 font-semibold' 
              : 'bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white'
          }`}
        >
          <Cpu className="w-4 h-4" />
          <span>AI/ML</span>
        </Link>
        <span className="text-gray-600">|</span>
        <Link 
          to="/admin/signal-feed" 
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-all ${
            isActive('/admin/signal-feed')
              ? 'bg-amber-500/20 text-amber-300 font-semibold' 
              : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400/80 hover:text-amber-300'
          }`}
        >
          <Radio className="w-4 h-4" />
          <span>Signals</span>
        </Link>
        <span className="text-gray-600">|</span>
        <Link 
          to="/admin/portfolio" 
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-all ${
            isActive('/admin/portfolio')
              ? 'bg-orange-500/20 text-orange-300 font-semibold' 
              : 'bg-orange-500/10 hover:bg-orange-500/20 text-orange-400/80 hover:text-orange-300'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          <span>Portfolio</span>
        </Link>
        <span className="text-gray-600">|</span>
        <Link 
          to="/admin/lp-targets" 
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-all ${
            isActive('/admin/lp-targets')
              ? 'bg-amber-500/20 text-amber-300 font-semibold' 
              : 'bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>LP Targets</span>
        </Link>
      </div>
    </nav>
  );
}




