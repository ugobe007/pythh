/**
 * PYTHH RESULTS PAGE — Contract-bound Reference Implementation
 * =============================================================
 * This page is constitutionally bound to pythh.contract.ts.
 * 
 * It renders ONLY from the PythhResponse contract.
 * It follows the canonical page order from PYTHH_ENGINEERING_CONTRACT.md:
 * 
 * 1. TOP 5 REVELATION SURFACE
 * 2. MISALIGNMENT SURFACE
 * 3. TRUST MIRROR
 * 4. CONVICTION SURFACE
 * 5. DESIRE SURFACE
 * 6. DIAGNOSTICS (hidden)
 * 
 * NOTE: This is a reference implementation showing how to wire
 * the contract to a page. The actual production page is
 * ResultsPageDoctrine.tsx which should be migrated to use
 * usePythhResults and the contract types.
 */

import { useSearchParams } from "react-router-dom";
import { usePythhResults } from "../hooks/usePythhResults";
import type {
  PythhTop5Match,
  PythhMisalignedInvestor,
  PythhTrustMirror,
  PythhConvictionSurface,
  PythhDesireSurface,
  PythhDiagnosticsSurface,
} from "../contracts/pythh.contract";

/* ============================================================================
 * SECTION COMPONENTS — Each bound to contract types
 * ========================================================================== */

function Top5Surface({ top5 }: { top5: PythhTop5Match[] }) {
  // TODO: Implement full Top5Surface per PYTHH_ENGINEERING_CONTRACT.md
  // This is a placeholder showing the contract binding
  return (
    <section className="mb-16">
      <h2>Your Top 5 Investor Matches</h2>
      {top5.map((match, i) => (
        <div key={match.investor_id} data-rank={i + 1}>
          <h3>{match.name}</h3>
          <p>Signal Score: {match.signal_score}</p>
          <p>Distance: {match.distance}</p>
          <p>{match.why_line}</p>
        </div>
      ))}
    </section>
  );
}

function MisalignmentSurface({ misaligned }: { misaligned: PythhMisalignedInvestor[] }) {
  // TODO: Implement full MisalignmentSurface per PYTHH_ENGINEERING_CONTRACT.md
  return (
    <section className="mb-16">
      <h2>You do NOT align with these investors right now</h2>
      {misaligned.map((inv) => (
        <div key={inv.investor_id}>
          <h3>{inv.name}</h3>
          <p>Fit: {inv.fit_score}%</p>
          <p>{inv.why_not_line}</p>
        </div>
      ))}
    </section>
  );
}

function TrustMirrorSurface({ trust }: { trust: PythhTrustMirror }) {
  // TODO: Implement full TrustMirrorSurface per PYTHH_ENGINEERING_CONTRACT.md
  return (
    <section className="mb-16">
      <h2>How capital currently reads you</h2>
      <ul>
        {trust.orientation_statements.map((stmt, i) => (
          <li key={i}>{stmt}</li>
        ))}
      </ul>
      <p>{trust.synthesis_sentence}</p>
    </section>
  );
}

function ConvictionSurface({ conviction }: { conviction: PythhConvictionSurface }) {
  // TODO: Implement full ConvictionSurface per PYTHH_ENGINEERING_CONTRACT.md
  return (
    <section className="mb-16">
      <h2>How to move closer to {conviction.investor_name}</h2>
      <p>Distance to flip: {conviction.distance_to_flip}%</p>
      <h3>Blocking signals:</h3>
      <ul>
        {conviction.blocking_signals.map((sig, i) => (
          <li key={i}>{sig}</li>
        ))}
      </ul>
      <h3>Leverage actions:</h3>
      <ul>
        {conviction.leverage_actions.map((act, i) => (
          <li key={i}>{act}</li>
        ))}
      </ul>
    </section>
  );
}

function DesireSurface({ desire }: { desire: PythhDesireSurface }) {
  // TODO: Implement full DesireSurface per PYTHH_ENGINEERING_CONTRACT.md
  return (
    <section className="mb-16">
      <h2>Your full investor map</h2>
      <p>{desire.more_aligned_count} more aligned investors</p>
      <p>{desire.more_misaligned_count} more misaligned investors</p>
      <p>{desire.new_matches_this_week} new this week</p>
      <p>{desire.warming_up_count} warming up</p>
      <button>Unlock your full investor map</button>
    </section>
  );
}

function DiagnosticsSurface({ diagnostics }: { diagnostics: PythhDiagnosticsSurface }) {
  // Hidden by default per contract
  return (
    <details className="mb-16">
      <summary>Diagnostics (Engine Room)</summary>
      <pre>{JSON.stringify(diagnostics, null, 2)}</pre>
    </details>
  );
}

/* ============================================================================
 * MAIN PAGE — Contract-bound entrypoint
 * ========================================================================== */

export function ResultsPageContract() {
  const [params] = useSearchParams();
  const url = params.get("url") || "";

  const { data, error, loading } = usePythhResults(url);

  // SECTION 0 — INVOCATION STATE
  if (!url) {
    return <div>Missing startup URL.</div>;
  }

  if (loading) {
    return (
      <div>
        <p>Analyzing capital alignment…</p>
        {/* No spinners without content per contract */}
      </div>
    );
  }

  if (error) {
    return <div>Unable to load results: {error}</div>;
  }

  if (!data) {
    return <div>No data returned.</div>;
  }

  // NOTE: Everything below renders ONLY from contract-typed data

  return (
    <div>
      {/* SECTION 1 — TOP 5 REVELATION SURFACE */}
      <Top5Surface top5={data.top5} />

      {/* SECTION 2 — MISALIGNMENT SURFACE */}
      <MisalignmentSurface misaligned={data.misaligned} />

      {/* SECTION 3 — TRUST MIRROR */}
      <TrustMirrorSurface trust={data.trust_mirror} />

      {/* SECTION 4 — CONVICTION SURFACE */}
      <ConvictionSurface conviction={data.conviction} />

      {/* SECTION 5 — DESIRE SURFACE */}
      <DesireSurface desire={data.desire} />

      {/* SECTION 6 — DIAGNOSTICS (hidden, optional) */}
      {data.diagnostics && (
        <DiagnosticsSurface diagnostics={data.diagnostics} />
      )}
    </div>
  );
}

export default ResultsPageContract;
