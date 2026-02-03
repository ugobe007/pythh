export default function AboutPythh() {
  return (
    <div
      className="pt-5"
      style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)" }}
    >
      <div className="text-[12px] tracking-[0.22em] text-white/55">
        ABOUT PYTHH
      </div>

      <div className="mt-3 max-w-[720px] text-[13px] leading-[1.6] text-white/55">
        PYTHH is signal science for fundraising. We track investor movement (Signal),
        measure market position (GOD), and model investor optics (VC++) so founders can
        time outreach correctly.
      </div>

      <div className="mt-4 flex items-center gap-6 text-[12.5px]">
        <a className="text-cyan-200/80 hover:text-cyan-100 transition-colors" href="/signals">
          How signals work →
        </a>
        <a className="text-cyan-200/80 hover:text-cyan-100 transition-colors" href="/signal-matches">
          See live radar →
        </a>
      </div>
    </div>
  );
}
