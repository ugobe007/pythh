module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ════════════════════════════════════════════════════════════════
        // 🔥 HOT HONEY - BLACK & GOLD ELEGANCE PALETTE
        // ════════════════════════════════════════════════════════════════
        
        // ── PRIMARY: Flame Orange (70% - Headlines, CTAs, Main Actions) ──
        'hh-fire': '#FF5A09',         // Primary flame orange (main brand color)
        'hh-fire-light': '#FF7840',   // Hover states
        'hh-fire-dark': '#E54D00',    // Pressed states
        'hh-coral': '#F3843E',        // Secondary warm accent
        'hh-amber': '#FF9900',        // Highlights, badges
        'hh-honey': '#FFB402',        // Subtle warmth
        
        // ── SECONDARY: Cyan/Blue (30% - Data, Badges, Secondary Info) ──
        'hh-cyan': '#06B6D4',         // Primary cyan (cyan-500)
        'hh-cyan-light': '#22D3EE',   // Cyan-400
        'hh-cyan-dark': '#0891B2',    // Cyan-600
        'hh-teal': '#14B8A6',         // Teal-500
        
        // ── Legacy Gold (maps to amber) ──
        'hh-gold': '#FF9900',         // Maps to amber for compatibility
        'hh-gold-light': '#FFB84D',   // Light amber
        'hh-gold-dark': '#E68A00',    // Dark amber
        
        // ── Backgrounds: Dark & Neutral ──
        'hh-navy': '#0F172A',         // Slate-900
        'hh-navy-light': '#1E293B',   // Slate-800
        'hh-navy-dark': '#020617',    // Slate-950
        'hh-charcoal': '#393939',     // Charcoal backgrounds
        'hh-charcoal-light': '#454545',
        'hh-charcoal-dark': '#2d2d2d',
        
        // ── NEUTRALS: Clean Whites & Grays ──
        'hh-white': '#FFFFFF',        // Pure white backgrounds
        'hh-gray': '#E5E5E5',         // Borders, secondary backgrounds
        'hh-gray-dark': '#CCCCCC',    // Muted elements
        'hh-black': '#000000',        // Text, maximum contrast
        'hh-charcoal': '#1A1A1A',     // Near-black backgrounds
        
        // ── ACCENT: Purple & Green (Glistening) ──
        'hh-purple': '#8B5CF6',       // Premium features, special
        'hh-purple-light': '#A78BFA', // Purple hover
        'hh-purple-dark': '#7C3AED',  // Purple pressed
        'hh-green': '#10B981',        // Glistening green, success
        'hh-green-light': '#34D399',  // Green hover, highlights
        'hh-green-dark': '#059669',   // Green pressed
        'hh-emerald': '#00D9A5',      // Bright glistening accent
        
        // ── SEMANTIC: Status Colors ──
        'hh-success': '#22C55E',      // Success states (green-500)
        'hh-warning': '#FF9900',      // Warning (amber/fire)
        'hh-error': '#EF4444',        // Error states (red-500)
        'hh-info': '#06B6D4',         // Info states (cyan)
        
        // ════════════════════════════════════════════════════════════════
        // 🎨 LEGACY: Hot Money Spectrum (Keep for compatibility)
        // ════════════════════════════════════════════════════════════════
        'hot-yellow': '#FEF301',
        'hot-turbo': '#FFE102',
        'hot-supernova': '#fccc04',
        'hot-selective': '#FFB402',
        'hot-golden': '#f7c20e',
        'hot-amber': '#f4a404',
        'hot-pizazz': '#f99006',
        'hot-coral': '#f97a1e',
        'hot-fire': '#f87004',
        'hot-california': '#fb9f05',
        'hot-rust': '#ae3e07',
        'hot-burnt': '#9a3604',
        'hot-gold': '#d99205',
        
        // ── Legacy Cool Colors ──
        'cool-bondi': '#04a3b2',
        'cool-robin': '#04cccc',
        'cool-cerulean': '#04829c',
        'cool-navy': '#04204f',
        'cool-sapphire': '#042962',
        'cool-sky': '#00aaff',
        'cool-bright': '#008cff',
        'cool-electric': '#001eff',
        'cool-deep': '#0700d9',
        'cool-purple': '#4700d6',
        'cool-burgundy': '#540405',
      },
      keyframes: {
        'pulse-subtle': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.92' },
        },
        'ticker': {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        'pulse-subtle': 'pulse-subtle 2s ease-in-out infinite',
        'ticker': 'ticker 60s linear infinite',
      },
    },
  },
  plugins: [],
}
