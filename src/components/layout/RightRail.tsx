import React from "react";

export type RailBlock = {
  label: string;
  children: React.ReactNode;
};

export default function RightRail({ blocks }: { blocks: RailBlock[] }) {
  return (
    <aside className="pythh-panel">
      <div className="pythh-panel-inner">
        {blocks.map((b, i) => (
          <div 
            key={b.label} 
            style={{ 
              paddingBottom: i === blocks.length - 1 ? 0 : 14, 
              marginBottom: i === blocks.length - 1 ? 0 : 14, 
              borderBottom: i === blocks.length - 1 ? "none" : "1px solid rgba(255,255,255,.06)" 
            }}
          >
            <div className="pythh-section-label">{b.label}</div>
            <div style={{ marginTop: 10 }}>{b.children}</div>
          </div>
        ))}
      </div>
    </aside>
  );
}
