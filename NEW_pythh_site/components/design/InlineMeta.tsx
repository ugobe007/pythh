import { DIM, MUTED, SEPARATOR } from "@/lib/designTokens";

export interface InlineMetaItem {
  text: string;
  color?: string;
}

export default function InlineMeta({ items }: { items: InlineMetaItem[] }) {
  const visible = items.filter((i) => i.text);
  return (
    <p className="text-xs font-mono leading-relaxed" style={{ color: DIM }}>
      {visible.map((item, i) => (
        <span key={i}>
          {i > 0 && <span style={{ color: SEPARATOR }}> · </span>}
          <span style={{ color: item.color ?? MUTED }}>{item.text}</span>
        </span>
      ))}
    </p>
  );
}
