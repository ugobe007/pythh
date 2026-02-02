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
      <div
        className="h-full flex items-center"
        style={{
          width: 210,
          background:
            "linear-gradient(90deg, rgba(255,255,255,0.00) 0%, rgba(255,255,255,0.03) 22%, rgba(255,255,255,0.06) 100%)",
          boxShadow: "inset 1px 0 0 rgba(255,255,255,0.06)",
        }}
      >
        <button
          onClick={onSubmit}
          disabled={isLoading || !value.trim()}
          className="h-full w-full text-[13px] font-semibold tracking-widest disabled:opacity-45 disabled:cursor-not-allowed"
          style={{
            background: isLoading
              ? "rgba(255,255,255,0.02)"
              : "linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.82) 100%)",
            color: "rgba(10,12,16,0.92)",
          }}
        >
          {isLoading ? "ANALYZING…" : "FIND SIGNALS →"}
        </button>
      </div>
    </div>
  );
}
