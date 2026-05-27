import { ArrowRight } from "lucide-react";
import { BORDER, G, G_BORDER, MUTED } from "@/lib/designTokens";

const SIZES = {
  sm: "px-4 py-2 text-xs",
  md: "px-5 py-2.5 text-sm",
  lg: "px-6 py-3 text-sm",
} as const;

export default function StrokeButton({
  href,
  onClick,
  children,
  color = G,
  borderColor,
  size = "md",
  fullWidth = false,
  disabled = false,
  type = "link",
  showArrow = false,
  muted = false,
  className = "",
}: {
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
  color?: string;
  borderColor?: string;
  size?: keyof typeof SIZES;
  fullWidth?: boolean;
  disabled?: boolean;
  type?: "link" | "button";
  showArrow?: boolean;
  muted?: boolean;
  className?: string;
}) {
  const fg = muted ? MUTED : color;
  const border = borderColor ?? (muted ? BORDER : G_BORDER);
  const cls = `inline-flex items-center justify-center gap-2 rounded-lg font-semibold font-mono transition-all disabled:opacity-50 disabled:cursor-not-allowed ${SIZES[size]} ${fullWidth ? "w-full" : ""} ${className}`;

  const applyHover = (el: HTMLElement, enter: boolean) => {
    if (disabled) return;
    el.style.borderColor = enter ? fg : border;
    el.style.color = enter && !muted ? fg : fg;
    el.style.backgroundColor = "transparent";
  };

  const style = {
    backgroundColor: "transparent",
    color: fg,
    border: `1px solid ${border}`,
  };

  const content = (
    <>
      {children}
      {showArrow && <ArrowRight size={size === "sm" ? 12 : 14} />}
    </>
  );

  if (type === "button" || onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={cls}
        style={style}
        onMouseEnter={(e) => applyHover(e.currentTarget, true)}
        onMouseLeave={(e) => applyHover(e.currentTarget, false)}
      >
        {content}
      </button>
    );
  }

  return (
    <a
      href={href}
      className={cls}
      style={style}
      onMouseEnter={(e) => applyHover(e.currentTarget, true)}
      onMouseLeave={(e) => applyHover(e.currentTarget, false)}
    >
      {content}
    </a>
  );
}
