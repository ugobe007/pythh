import React from "react";

export default function TopBar({
  status,
  subtitle,
}: {
  status: string;
  subtitle: string;
}) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="brand">
          <span className="brandMark">PYTHH</span>
          <span className="brandDot">•</span>
          <span className="brandSub">SIGNAL RADAR</span>
        </div>
        <div className="sub">{subtitle}</div>
      </div>

      <div className="topbar-right">
        <div className="badge">
          <span className="badgeLive" />
          <span className="badgeText">{status}</span>
        </div>
      </div>
    </header>
  );
}
