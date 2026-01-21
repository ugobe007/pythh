/**
 * BACKGROUND INTELLIGENCE — Front Page Contract
 * ==============================================
 * 
 * Visual only. No text. No UI chrome.
 * Subtle motion layer that suggests intelligence without explaining it.
 */

export function BackgroundIntelligence() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Subtle gradient motion layer */}
      <div className="absolute inset-0 bg-gradient-to-br from-neutral-900 via-neutral-950 to-black opacity-80" />
    </div>
  );
}
