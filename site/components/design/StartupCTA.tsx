import { ArrowRight } from "lucide-react";
import { VIOLET, VIOLET_BORDER, VIOLET_HOVER } from "@/lib/designTokens";

const SIZES = {
  sm: "px-5 py-2 text-sm",
  md: "px-6 py-3 text-sm",
  lg: "px-7 py-3 text-sm",
} as const;

function applyHover(el: HTMLElement, enter: boolean) {
  if (enter) {
    el.style.borderColor = VIOLET;
    el.style.color = VIOLET_HOVER;
    el.style.backgroundColor = "oklch(0.55 0.2 280 / 0.12)";
  } else {
    el.style.borderColor = VIOLET_BORDER;
    el.style.color = VIOLET;
    el.style.backgroundColor = "transparent";
  }
}

export default function StartupCTA({
  href = "/activate",
  children,
  className = "",
  size = "md",
  fullWidth = false,
  type = "link",
  onClick,
  showArrow = false,
  arrowSize,
}: {
  href?: string;
  children: React.ReactNode;
  className?: string;
  size?: keyof typeof SIZES;
  fullWidth?: boolean;
  type?: "link" | "button" | "submit";
  onClick?: () => void;
  showArrow?: boolean;
  arrowSize?: number;
}) {
  const cls = `inline-flex items-center justify-center gap-2 rounded-lg font-semibold font-mono transition-all ${SIZES[size]} ${fullWidth ? "w-full" : ""} ${className}`;
  const style = {
    backgroundColor: "transparent",
    border: `1px solid ${VIOLET_BORDER}`,
    color: VIOLET,
  };
  const iconSize = arrowSize ?? (size === "sm" ? 12 : size === "lg" ? 16 : 14);
  const content = (
    <>
      {children}
      {showArrow && <ArrowRight size={iconSize} />}
    </>
  );

  if (type === "submit" || type === "button") {
    return (
      <button
        type={type === "submit" ? "submit" : "button"}
        onClick={onClick}
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
