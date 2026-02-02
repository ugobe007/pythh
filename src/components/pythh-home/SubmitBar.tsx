import { useCallback } from "react";

export default function SubmitBar(props: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  isLoading?: boolean;
}) {
  const { value, onChange, onSubmit, isLoading } = props;

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && value.trim()) onSubmit();
    },
    [onSubmit, value]
  );

  const isArmed = !!value.trim() && !isLoading;

  return (
    <div
      className="w-full h-[52px] flex items-center"
      style={{
        background: "rgba(255,255,255,0.03)",
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)",
      }}
    >
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="https://yourstartup.com"
        className="h-full flex-1 bg-transparent outline-none px-5 text-[14px] text-white placeholder:text-white/30"
        disabled={isLoading}
      />

      <button
        onClick={onSubmit}
        disabled={isLoading || !value.trim()}
        className="h-full px-7 text-[13px] font-semibold tracking-[0.18em] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
        style={{
          background: isArmed
            ? "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.05))"
            : "rgba(255,255,255,0.04)",
          boxShadow: isArmed
            ? "inset 0 0 0 1px rgba(255,255,255,0.14), 0 0 22px rgba(34,211,238,0.22)"
            : "inset 0 0 0 1px rgba(255,255,255,0.08)",
        }}
      >
        {isLoading ? "ANALYZING…" : "FIND SIGNALS →"}
      </button>
    </div>
  );
}
