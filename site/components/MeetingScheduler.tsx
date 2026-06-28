/**
 * Post-send meeting proposal UI (handoff §6.4).
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { CalendarClock, Loader2 } from "lucide-react";

type Props = {
  runId: string;
  emailId: number;
  investorName: string;
  investorFirm: string;
};

export default function MeetingScheduler({ runId, emailId, investorName, investorFirm }: Props) {
  const utils = trpc.useUtils();
  const { data: meetings, isLoading } = trpc.outreach.listMeetingsForEmail.useQuery(
    { runId, emailId },
    { refetchInterval: 30_000 },
  );

  const propose = trpc.outreach.proposeMeeting.useMutation({
    onSuccess: () => {
      toast.success("Meeting slots proposed", { description: "We emailed suggested times when Resend is configured." });
      void utils.outreach.listMeetingsForEmail.invalidate({ runId, emailId });
    },
    onError: (e) => toast.error(e.message),
  });

  const confirm = trpc.outreach.confirmMeeting.useMutation({
    onSuccess: () => {
      toast.success("Meeting confirmed");
      void utils.outreach.listMeetingsForEmail.invalidate({ runId, emailId });
    },
    onError: (e) => toast.error(e.message),
  });

  const decline = trpc.outreach.declineMeeting.useMutation({
    onSuccess: () => {
      toast.message("Marked as declined");
      void utils.outreach.listMeetingsForEmail.invalidate({ runId, emailId });
    },
    onError: (e) => toast.error(e.message),
  });

  const latest = meetings?.[0];
  const [slotPick, setSlotPick] = useState(0);

  return (
    <div className="mt-4 rounded-lg border p-3 space-y-2" style={{ borderColor: "oklch(0.25 0.01 264)", backgroundColor: "oklch(0.14 0.01 264)" }}>
      <div className="flex items-center gap-2 text-xs font-bold tracking-widest" style={{ color: "oklch(0.55 0.01 264)" }}>
        <CalendarClock size={14} />
        MEETING FOLLOW-UP
      </div>
      <p className="text-xs" style={{ color: "oklch(0.65 0.01 264)" }}>
        {investorName} · {investorFirm}
      </p>
      {!latest && (
        <button
          type="button"
          disabled={propose.isPending}
          onClick={() => propose.mutate({ runId, emailId })}
          className="text-xs font-semibold px-3 py-2 rounded-md border transition-colors disabled:opacity-50"
          style={{ borderColor: "oklch(0.696 0.17 162.48 / 0.4)", color: "oklch(0.696 0.17 162.48)" }}
        >
          {propose.isPending ? (
            <>
              <Loader2 className="inline animate-spin mr-1" size={12} />
              Scheduling…
            </>
          ) : (
            "Propose 3 meeting slots"
          )}
        </button>
      )}
      {isLoading && <p className="text-xs opacity-60">Loading meeting state…</p>}
      {latest && (
        <div className="text-xs space-y-2" style={{ color: "oklch(0.75 0.01 264)" }}>
          <p>
            Status: <strong>{latest.status}</strong>
          </p>
          {latest.status === "proposed" && Array.isArray(latest.proposedTimes) && latest.proposedTimes.length > 0 && (
            <div className="space-y-1">
              <label className="block text-[10px] uppercase tracking-wider opacity-70">Pick a slot</label>
              <select
                className="w-full rounded border bg-transparent px-2 py-1 text-xs"
                style={{ borderColor: "oklch(0.25 0.01 264)" }}
                value={slotPick}
                onChange={(e) => setSlotPick(Number(e.target.value))}
              >
                {latest.proposedTimes.map((t: { label?: string; startMs?: number }, i: number) => (
                  <option key={i} value={i}>
                    {t.label || `Slot ${i + 1}`}
                  </option>
                ))}
              </select>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  disabled={confirm.isPending}
                  onClick={() => confirm.mutate({ meetingId: latest.id, slotIndex: slotPick })}
                  className="px-2 py-1 rounded text-[11px] font-semibold"
                  style={{ backgroundColor: "oklch(0.696 0.17 162.48)", color: "oklch(0.1 0.01 162)" }}
                >
                  Confirm slot
                </button>
                <button
                  type="button"
                  disabled={decline.isPending}
                  onClick={() => decline.mutate({ meetingId: latest.id })}
                  className="px-2 py-1 rounded text-[11px] border"
                  style={{ borderColor: "oklch(0.35 0.01 264)", color: "oklch(0.55 0.01 264)" }}
                >
                  Decline
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
