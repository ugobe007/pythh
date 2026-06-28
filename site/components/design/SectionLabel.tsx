import { G } from "@/lib/designTokens";

export default function SectionLabel({
  children,
  color = G,
  className = "",
}: {
  children: React.ReactNode;
  color?: string;
  className?: string;
}) {
  return (
    <p
      className={`text-[10px] font-mono uppercase tracking-widest ${className}`}
      style={{ color }}
    >
      {children}
    </p>
  );
}
