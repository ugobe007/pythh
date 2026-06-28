import { G, DIM, MUTED, SEPARATOR, TEXT } from "@/lib/designTokens";

export interface FilterTabOption<T extends string> {
  id: T;
  label: string;
  count?: number;
}

export default function FilterTabs<T extends string>({
  label,
  value,
  onChange,
  options,
  labelWidth = "w-14",
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: Array<FilterTabOption<T>>;
  labelWidth?: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span
        className={`text-[10px] font-mono uppercase tracking-widest shrink-0 ${labelWidth}`}
        style={{ color: DIM }}
      >
        {label}
      </span>
      {options.map((opt, i) => {
        const active = value === opt.id;
        return (
          <span key={String(opt.id)} className="inline-flex items-baseline gap-x-3">
            {i > 0 && <span style={{ color: SEPARATOR }}>|</span>}
            <button
              type="button"
              onClick={() => onChange(opt.id)}
              className="text-sm font-medium transition-colors bg-transparent border-0 p-0 cursor-pointer"
              style={{
                color: active ? TEXT : MUTED,
                textDecoration: active ? "underline" : "none",
                textUnderlineOffset: "4px",
                textDecorationColor: active ? G : "transparent",
              }}
            >
              {opt.label}
              {opt.count != null && (
                <span className="font-mono text-xs ml-1" style={{ color: DIM }}>
                  {opt.count}
                </span>
              )}
            </button>
          </span>
        );
      })}
    </div>
  );
}
