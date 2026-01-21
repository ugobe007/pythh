/**
 * IDENTITY HEADER — Results Spatial Contract
 * ===========================================
 * 
 * "You are here" coordinate. Not marketing.
 * 
 * MUST INCLUDE:
 * • Startup name + domain
 * • One posture label (Forming / Prime / Cooling)
 * • Confidence (Low/Med/High)
 * 
 * FORBIDDEN:
 * • Giant hero numbers
 * • Flashy gradients
 * • Product slogans
 * • "AI-powered"
 */

interface IdentityHeaderProps {
  startupName: string;
  domain: string;
  posture: "Forming" | "Prime" | "Cooling";
  confidence: "Low" | "Medium" | "High";
}

export function IdentityHeader({ startupName, domain, posture, confidence }: IdentityHeaderProps) {
  return (
    <header className="border-b border-neutral-800 pb-4 mb-6">
      <div className="flex items-center gap-2 text-lg">
        <span className="font-medium">{startupName}</span>
        <span className="text-neutral-600">·</span>
        <span className="text-neutral-400">{domain}</span>
      </div>
      <div className="flex items-center gap-4 text-sm text-neutral-500 mt-2">
        <span>Signal Posture: {posture}</span>
        <span>·</span>
        <span>Confidence: {confidence}</span>
      </div>
    </header>
  );
}
