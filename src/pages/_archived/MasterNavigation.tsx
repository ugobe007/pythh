import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Home, Zap, Vote, Briefcase, TrendingUp, FileText, BookOpen, Settings,
  LayoutDashboard, Shield, ClipboardCheck, Rss, Upload, Users, Building2,
  Activity, Database, Sparkles, Search, BarChart3, Sliders, Map
} from 'lucide-react';
import LogoDropdownMenu from '../components/LogoDropdownMenu';

interface NavLink {
  path: string;
  label: string;
  icon: React.ElementType;
  description: string;
}

interface NavSection {
  title: string;
  links: NavLink[];
}

const publicPages: NavSection[] = [
  {
    title: 'Main',
    links: [
      { path: '/', label: 'Home', icon: Home, description: 'Landing page and overview' },
      { path: '/match', label: 'AI Matching', icon: Zap, description: 'Find startup-investor matches' },
      { path: '/vote', label: 'Vote', icon: Vote, description: 'Vote on startups anonymously' },
      { path: '/saved-matches', label: 'Saved Matches', icon: Sparkles, description: 'Your saved match results' },
    ]
  },
  {
    title: 'Discover',
    links: [
      { path: '/investors', label: 'Investors', icon: Briefcase, description: 'Browse all investors' },
      { path: '/dashboard', label: 'Startups', icon: Building2, description: 'Browse all startups' },
      { path: '/trending', label: 'Trending', icon: TrendingUp, description: 'Hot startups and trends' },
    ]
  },
  {
    title: 'Resources',
    links: [
      { path: '/strategies', label: 'Playbook', icon: BookOpen, description: 'Investment strategies guide' },
      { path: '/submit', label: 'Submit Startup', icon: FileText, description: 'Submit your startup for review' },
      { path: '/why', label: 'About', icon: Map, description: 'Why Pythh Exists' },
      { path: '/settings', label: 'Settings', icon: Settings, description: 'Account settings' },
    ]
  },
];

const adminPages: NavSection[] = [
  {
    title: 'Command Center',
    links: [
      { path: '/admin', label: 'Admin Home', icon: Shield, description: 'Admin dashboard overview' },
      { path: '/admin/control', label: 'Control Center', icon: Sliders, description: 'System controls and automation' },
      { path: '/admin/health', label: 'System Health', icon: Activity, description: 'Monitor system status' },
    ]
  },
  {
    title: 'Review & Approval',
    links: [
      { path: '/admin/review', label: 'AI Review Queue', icon: ClipboardCheck, description: 'Review pending startups' },
      { path: '/admin/god-scores', label: 'GOD Scores', icon: Sparkles, description: 'Manage startup scoring' },
    ]
  },
  {
    title: 'Discovery Pipeline',
    links: [
      { path: '/admin/rss-manager', label: 'RSS Sources', icon: Rss, description: 'Manage news sources' },
      { path: '/admin/discovered-startups', label: 'Discovered Startups', icon: Search, description: 'Scraped startups queue' },
      { path: '/admin/discovered-investors', label: 'Discovered Investors', icon: Users, description: 'Investor discovery' },
    ]
  },
  {
    title: 'Data Management',
    links: [
      { path: '/admin/bulk-upload', label: 'Bulk Upload', icon: Upload, description: 'Import data in bulk' },
      { path: '/admin/edit-startups', label: 'Edit Startups', icon: FileText, description: 'Edit startup records' },
      { path: '/admin/investor-enrichment', label: 'Investor Enrichment', icon: Users, description: 'Enrich investor data' },
    ]
  },
  {
    title: 'Technical',
    links: [
      { path: '/admin/ai-logs', label: 'AI Logs', icon: Database, description: 'View AI processing logs' },
      { path: '/admin/diagnostic', label: 'Diagnostics', icon: Activity, description: 'System diagnostics' },
      { path: '/admin/database-check', label: 'Database Check', icon: Database, description: 'Database health' },
    ]
  },
];

function NavCard({ link }: { link: NavLink }) {
  const Icon = link.icon;
  
  return (
    <Link
      to={link.path}
      className="group block p-4 bg-[#454545] hover:bg-[#505050] rounded-xl border border-[#6E6E6E] hover:border-[#FF5A09] transition-all"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 bg-[#393939] rounded-lg group-hover:bg-[#FF5A09] transition-colors">
          <Icon size={20} className="text-[#FF9900] group-hover:text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white group-hover:text-[#FF9900] transition-colors">
            {link.label}
          </h3>
          <p className="text-sm text-[#B0B0B0] mt-1 line-clamp-2">
            {link.description}
          </p>
          <p className="text-xs text-[#6E6E6E] mt-2 font-mono">
            {link.path}
          </p>
        </div>
      </div>
    </Link>
  );
}

export default function MasterNavigation() {
  return (
    <div className="min-h-screen bg-[#2d2d2d]">
      {/* Global Navigation */}
      <LogoDropdownMenu />
      
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">
            🗺️ Master Navigation
          </h1>
          <p className="text-[#B0B0B0] text-lg max-w-2xl mx-auto">
            Complete directory of all [pyth] ai pages. Click any card to navigate directly.
          </p>
        </div>

        {/* Public Pages */}
        <div className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-1 w-8 bg-gradient-to-r from-[#FF5A09] to-[#FF9900] rounded-full" />
            <h2 className="text-2xl font-bold text-white">Public Pages</h2>
          </div>
          
          <div className="space-y-8">
            {publicPages.map((section) => (
              <div key={section.title}>
                <h3 className="text-lg font-semibold text-[#FF9900] mb-4 uppercase tracking-wide">
                  {section.title}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {section.links.map((link) => (
                    <NavCard key={link.path} link={link} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Admin Pages */}
        <div>
          <div className="flex items-center gap-3 mb-6">
            <div className="h-1 w-8 bg-gradient-to-r from-[#F3843E] to-[#FF5A09] rounded-full" />
            <h2 className="text-2xl font-bold text-white">Admin Pages</h2>
            <span className="px-2 py-1 bg-[#FF5A09] text-white text-xs font-bold rounded">
              ADMIN
            </span>
          </div>
          
          <div className="space-y-8">
            {adminPages.map((section) => (
              <div key={section.title}>
                <h3 className="text-lg font-semibold text-[#F3843E] mb-4 uppercase tracking-wide">
                  {section.title}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {section.links.map((link) => (
                    <NavCard key={link.path} link={link} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="mt-16 p-6 bg-[#393939] rounded-2xl border border-[#6E6E6E]">
          <h3 className="text-lg font-semibold text-white mb-4">Page Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="p-4 bg-[#454545] rounded-xl">
              <div className="text-3xl font-bold text-[#FF9900]">
                {publicPages.reduce((acc, s) => acc + s.links.length, 0)}
              </div>
              <div className="text-[#B0B0B0] text-sm">Public Pages</div>
            </div>
            <div className="p-4 bg-[#454545] rounded-xl">
              <div className="text-3xl font-bold text-[#F3843E]">
                {adminPages.reduce((acc, s) => acc + s.links.length, 0)}
              </div>
              <div className="text-[#B0B0B0] text-sm">Admin Pages</div>
            </div>
            <div className="p-4 bg-[#454545] rounded-xl">
              <div className="text-3xl font-bold text-[#FF5A09]">
                {publicPages.length + adminPages.length}
              </div>
              <div className="text-[#B0B0B0] text-sm">Sections</div>
            </div>
            <div className="p-4 bg-[#454545] rounded-xl">
              <div className="text-3xl font-bold text-white">
                {publicPages.reduce((acc, s) => acc + s.links.length, 0) + adminPages.reduce((acc, s) => acc + s.links.length, 0)}
              </div>
              <div className="text-[#B0B0B0] text-sm">Total Pages</div>
            </div>
          </div>
        </div>

        {/* Footer note */}
        <div className="mt-8 text-center text-[#6E6E6E] text-sm">
          <p>[pyth] ai Navigation Directory • Updated December 2025</p>
        </div>
      </div>
    </div>
  );
}
