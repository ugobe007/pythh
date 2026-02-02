/**
 * PAGE SHELL — Pythh Design Schema (Global)
 * ==========================================
 * Every page uses this shell to ensure consistent:
 * - Background (cinematic gradient + vignette)
 * - Container widths
 * - Padding system
 * - Typography scale
 * 
 * Usage:
 *   <PageShell variant="standard" | "dense">
 *     <YourContent />
 *   </PageShell>
 */

import { ReactNode } from 'react';

interface PageShellProps {
  children: ReactNode;
  /**
   * standard = max-w-6xl (founder surfaces: /, /matches, /live, /signals)
   * dense = max-w-7xl (instrument mode: /app/*)
   */
  variant?: 'standard' | 'dense';
  className?: string;
}

export default function PageShell({ 
  children, 
  variant = 'standard',
  className = '' 
}: PageShellProps) {
  const maxWidth = variant === 'dense' ? 'max-w-7xl' : 'max-w-6xl';
  
  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Multi-layer animated glows */}
      <div className="fixed bottom-0 right-0 w-[1000px] h-[1000px] bg-teal-500/10 rounded-full blur-[140px] pointer-events-none animate-pulse" style={{ animationDuration: '4s' }} />
      <div className="fixed bottom-20 right-20 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none animate-pulse" style={{ animationDuration: '3s', animationDelay: '1s' }} />
      <div className="fixed top-1/4 right-1/4 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[80px] pointer-events-none animate-pulse" style={{ animationDuration: '5s', animationDelay: '2s' }} />
      
      {/* Subtle top vignette */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,transparent_0%,rgba(0,0,0,0.4)_100%)] pointer-events-none" />
      
      {/* Grid pattern */}
      <div className="fixed inset-0 opacity-[0.02] pointer-events-none" style={{
        backgroundImage: `linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)`,
        backgroundSize: '60px 60px'
      }} />
      
      {/* Content */}
      <div className={`relative z-10 ${className}`}>
        {children}
      </div>
    </div>
  );
}

/**
 * CONTENT CONTAINER
 * Standard max-width wrapper for page content
 */
interface ContentContainerProps {
  children: ReactNode;
  variant?: 'standard' | 'dense';
  className?: string;
}

export function ContentContainer({ 
  children, 
  variant = 'standard',
  className = '' 
}: ContentContainerProps) {
  const maxWidth = variant === 'dense' ? 'max-w-7xl' : 'max-w-6xl';
  
  return (
    <div className={`${maxWidth} mx-auto px-6 ${className}`}>
      {children}
    </div>
  );
}

/**
 * GLASS PANEL
 * Standard panel with backdrop blur
 */
interface GlassPanelProps {
  children: ReactNode;
  className?: string;
}

export function GlassPanel({ children, className = '' }: GlassPanelProps) {
  return (
    <div className={`rounded-2xl bg-white/5 border border-white/10 backdrop-blur ${className}`}>
      {children}
    </div>
  );
}

/**
 * ROW CARD
 * Standard card for list items (like match rows)
 */
interface RowCardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function RowCard({ children, className = '', onClick }: RowCardProps) {
  const interactive = onClick ? 'cursor-pointer hover:bg-white/[0.05] transition-colors' : '';
  
  return (
    <div 
      className={`rounded-2xl bg-white/[0.03] border-2 border-white/30 ${interactive} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
