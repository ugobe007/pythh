/**
 * PYTHH TOP NAV
 * =============
 * Consistent nav header across Pythh pages
 * Supabase dark theme styling
 */

import { Link, useLocation } from 'react-router-dom';

interface TopNavProps {
  showSignup?: boolean;
}

export default function PythhTopNav({ showSignup = true }: TopNavProps) {
  const location = useLocation();
  
  const isActive = (path: string) => location.pathname === path;
  
  const linkClass = (path: string) => 
    `text-sm transition-colors ${
      isActive(path) 
        ? 'text-white' 
        : 'text-zinc-500 hover:text-white'
    }`;

  return (
    <header className="w-full border-b border-zinc-800/50 bg-[#0a0a0a]">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2 group">
          <span className="text-white font-semibold group-hover:text-cyan-400 transition-colors">pythh.ai</span>
          <span className="text-zinc-600 text-xs tracking-widest uppercase">Signal Science</span>
        </Link>
        
        {/* Nav Links */}
        <nav className="flex items-center gap-6">
          <Link to="/signals" className={linkClass('/signals')}>Signals</Link>
          <Link to="/matches" className={linkClass('/matches')}>Matches</Link>
          <Link to="/signal-trends" className={linkClass('/signal-trends')}>Trends</Link>
          <Link to="/how-it-works" className={linkClass('/how-it-works')}>How it works</Link>
          {showSignup && (
            <Link 
              to="/signup" 
              className={`text-sm px-3 py-1.5 rounded-lg transition-all ${
                isActive('/signup') || location.pathname.startsWith('/signup/')
                  ? 'bg-cyan-500 text-white'
                  : 'bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20'
              }`}
            >
              Sign up
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
