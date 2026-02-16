import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const FloatingNav: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showAdminMenu, setShowAdminMenu] = useState(false);

  const navItems = [
    { icon: '🐝', label: 'Sign Up', path: '/signup' },
    { icon: '🏠', label: 'Home', path: '/' },
    { icon: '🗳️', label: 'Vote', path: '/vote-demo' },
    { icon: '👤', label: 'Dashboard', path: '/dashboard' },
  ];

  const adminTools = [
    { icon: '👑', label: 'Admin Dashboard', path: '/admin/dashboard', color: 'from-cyan-500 to-blue-500' },
    { icon: '📋', label: 'Review Queue', path: '/admin/edit-startups', color: 'from-cyan-500 to-blue-500' },
    { icon: '✏️', label: 'Edit Startups', path: '/admin/edit-startups', color: 'from-purple-500 to-indigo-500' },
    { icon: '🚀', label: 'Bulk Import', path: '/admin/bulk-import', color: 'from-green-500 to-teal-500' },
    { icon: '⚙️', label: 'DB Setup', path: '/admin/setup', color: 'from-blue-500 to-indigo-500' },
    { icon: '🔍', label: 'Diagnostic', path: '/admin/diagnostic', color: 'from-purple-600 to-pink-600' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50">
      <div className="flex gap-3 items-center">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center gap-2 px-5 py-2 rounded-full font-semibold text-sm transition-all transform hover:scale-105 shadow-xl ${
              isActive(item.path)
                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white'
                : 'bg-gradient-to-r from-cyan-400 to-blue-400 text-white hover:from-cyan-500 hover:to-blue-500'
            }`}
          >
            <span className="text-lg">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}

        {/* Admin Menu */}
        {user?.isAdmin && (
          <div className="relative">
            <button
              onClick={() => setShowAdminMenu(!showAdminMenu)}
              className={`flex items-center gap-2 px-5 py-2 rounded-full font-semibold text-sm transition-all transform hover:scale-105 shadow-xl ${
                showAdminMenu
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white'
                  : 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:from-purple-600 hover:to-indigo-600'
              }`}
            >
              <span className="text-lg">👑</span>
              <span>ADMIN</span>
              <span className="text-xs">{showAdminMenu ? '▲' : '▼'}</span>
            </button>

            {/* Dropdown Menu */}
            {showAdminMenu && (
              <div className="absolute top-full mt-3 right-0 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border-2 border-purple-300 p-4 min-w-[280px]">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-purple-200">
                  <h3 className="text-purple-900 font-bold text-lg">🛠️ Admin Tools</h3>
                  <button
                    onClick={() => setShowAdminMenu(false)}
                    className="text-purple-600 hover:text-purple-900 font-bold text-xl leading-none"
                  >
                    ×
                  </button>
                </div>
                <div className="space-y-2">
                  {adminTools.map((tool) => (
                    <button
                      key={tool.path}
                      onClick={() => {
                        navigate(tool.path);
                        setShowAdminMenu(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all hover:scale-[1.02] shadow-md text-white bg-gradient-to-r ${tool.color}`}
                    >
                      <span className="text-xl">{tool.icon}</span>
                      <span>{tool.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
};

export default FloatingNav;