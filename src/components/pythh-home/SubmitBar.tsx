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
        className="h-full px-7 bg-transparent border border-cyan-500 text-cyan-400 font-semibold text-sm hover:bg-cyan-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 whitespace-nowrap"
      >
        {isLoading ? "Analyzing…" : "Find Signals →"}
      </button>
    </div>
  );
}
