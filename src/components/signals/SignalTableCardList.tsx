import TableCardRow from "@/components/signals/TableCardRow";

export type SignalRow = {
  id: string;
  investorName: string;
  firmName: string;
  context: string;
  signalScore: number; // 0–10 (or whatever scale you currently have)
  signalDelta: number | null;
  fitTier: number; // 1–5
  updatedAt: string;
  isLocked: boolean;
  isPreviewUnlocked?: boolean;
};

export default function SignalTableCardList(props: {
  rows: SignalRow[];
  isLoading: boolean;
  emptyText: string;
}) {
  const { rows, isLoading, emptyText } = props;

  if (isLoading) {
    return (
      <div className="space-y-[10px]">
        {[0, 1, 2, 3, 4].map((i) => (
          <TableCardRow
            key={i}
            row={{
              id: String(i),
              investorName: "—",
              firmName: "—",
              context: "—",
              signalScore: 0,
              signalDelta: null,
              fitTier: 3,
              updatedAt: new Date().toISOString(),
              isLocked: true,
              isPreviewUnlocked: false,
            }}
            skeleton
          />
        ))}
      </div>
    );
  }

  if (!rows || rows.length === 0) {
    return <div className="text-[12.5px] text-white/45">{emptyText}</div>;
  }

  return (
    <div className="space-y-[10px]">
      {rows.map((r) => (
        <TableCardRow key={r.id} row={r} />
      ))}
    </div>
  );
}
