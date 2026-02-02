import React from "react";

export type Column<T> = {
  key: string;
  header: string;
  width?: string; // e.g. "32%", "180px"
  render: (row: T) => React.ReactNode;
  sortable?: boolean;
};

export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  selectedKey,
  empty,
  sortKey,
  sortDir,
  onSort,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  selectedKey?: string | null;
  empty?: React.ReactNode;
  sortKey?: string;
  sortDir?: "asc" | "desc";
  onSort?: (key: string) => void;
}) {
  return (
    <div className="pythh-panel-v2" style={{ overflow: "hidden" }}>
      {/* Header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: columns.map((c) => c.width ?? "1fr").join(" "),
          gap: 0,
          padding: "12px 14px",
          borderBottom: "1px solid rgba(255,255,255,.06)",
          background: "rgba(6,7,10,.4)",
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: ".5px",
          color: "rgba(255,255,255,.45)",
        }}
      >
        {columns.map((c) => (
          <div
            key={c.key}
            onClick={c.sortable && onSort ? () => onSort(c.key) : undefined}
            style={{
              cursor: c.sortable && onSort ? "pointer" : "default",
              userSelect: c.sortable ? "none" : "auto",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            {c.header}
            {sortKey === c.key && (
              <span style={{ opacity: 0.7 }}>{sortDir === "asc" ? "↑" : "↓"}</span>
            )}
          </div>
        ))}
      </div>

      {/* Rows */}
      {rows.length === 0 ? (
        <div style={{ padding: 16, color: "rgba(255,255,255,.5)" }}>{empty ?? "No rows."}</div>
      ) : (
        rows.map((r) => {
          const k = rowKey(r);
          const selected = selectedKey && selectedKey === k;
          return (
            <div
              key={k}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
              className={selected ? "selected" : ""}
              style={{
                cursor: onRowClick ? "pointer" : "default",
                display: "grid",
                gridTemplateColumns: columns.map((c) => c.width ?? "1fr").join(" "),
                padding: "12px 14px",
                borderBottom: "1px solid rgba(255,255,255,.04)",
                background: selected ? "rgba(96,165,250,.04)" : "transparent",
                position: "relative",
                transition: "background 0.1s ease",
              }}
              onMouseEnter={(e) => {
                if (!selected) e.currentTarget.style.background = "rgba(255,255,255,.02)";
              }}
              onMouseLeave={(e) => {
                if (!selected) e.currentTarget.style.background = "transparent";
              }}
            >
              {/* Left rail for selected row */}
              {selected && (
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 2,
                    background: "rgba(96,165,250,.65)",
                    boxShadow: "0 0 8px rgba(96,165,250,.3)",
                  }}
                />
              )}
              {columns.map((c) => (
                <div key={c.key} style={{ color: "rgba(255,255,255,.72)", fontSize: 13 }}>
                  {c.render(r)}
                </div>
              ))}
            </div>
          );
        })
      )}
    </div>
  );
}
