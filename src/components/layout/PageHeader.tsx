import React from "react";

export default function PageHeader({
  kicker,
  title,
  subtitle,
  right,
}: {
  kicker: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <header className="pythh-header">
      <div>
        <div className="pythh-kicker">{kicker}</div>
        <h1 className="pythh-title">{title}</h1>
        {subtitle ? <div className="pythh-subtitle">{subtitle}</div> : null}
      </div>

      {right ? <div className="pythh-actions">{right}</div> : null}
    </header>
  );
}
