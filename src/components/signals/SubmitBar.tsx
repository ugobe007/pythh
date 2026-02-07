import { useCallback, useMemo, useState } from "react";

export default function SubmitBar(props: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  isLoading?: boolean;
}) {
  const { value, onChange, onSubmit, isLoading } = props;

  const [isFocused, setIsFocused] = useState(false);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") onSubmit();
    },
    [onSubmit]
  );

  const frameShadow = useMemo(() => {
    if (isLoading) {
      return "0 0 0 1px rgba(34,211,238,0.25), 0 0 20px rgba(34,211,238,0.12)";
    }
    if (isFocused) {
      return "0 0 0 1px rgba(34,211,238,0.22), 0 0 18px rgba(34,211,238,0.10)";
    }
    return "0 0 0 1px rgba(255,255,255,0.06)";
  }, [isFocused, isLoading]);

  return (
    <div
      className="w-full h-[44px] flex items-center overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.03)",
        boxShadow: frameShadow,
      }}
    >
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder="https://yourstartup.com"
        className="h-full flex-1 bg-transparent outline-none px-4 text-[14px] text-white placeholder:text-white/30"
        disabled={isLoading}
      />

      {/* Right-side gradient action zone */}
      <button
        onClick={onSubmit}
        disabled={isLoading || !value.trim()}
        className="h-full px-7 bg-transparent border border-cyan-500 text-cyan-400 font-semibold text-sm hover:bg-cyan-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all whitespace-nowrap"
      >
        {isLoading ? "Analyzing…" : "Find Signals →"}
      </button>
    </div>
  );
}
