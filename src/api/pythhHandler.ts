import { Request, Response } from "express";
import {
  PythhResponse,
  assertPythhResponse,
} from "../contracts/pythh.contract";

/**
 * PYTHH HANDLER — Contract-bound /match or /results endpoint
 * ===========================================================
 * Single entrypoint for URL submissions.
 * MUST return a PythhResponse.
 * 
 * This handler is constitutionally bound to pythh.contract.ts.
 * Any deviation will cause a hard failure.
 */
export async function pythhHandler(req: Request, res: Response) {
  const url = String(req.query.url || "").trim();

  if (!url) {
    return res.status(400).json({
      error: "Missing url parameter",
    });
  }

  try {
    // 1) SCRAPE + EXTRACT
    const startup = await detectStartupIdentity(url);

    // 2) SIGNAL INGESTION
    const signals = await collectSignals(startup);

    // 3) MATCHING ENGINE
    const {
      top5,
      misaligned,
      trust_mirror,
      conviction,
      desire,
      diagnostics,
    } = await runMatchingEngine(startup, signals);

    // 4) INVOCATION STATE
    const invocation = {
      status: "complete" as const,
      message: "Capital alignment analysis complete.",
    };

    // 5) ASSEMBLE RESPONSE
    const response: PythhResponse = {
      startup,
      invocation,
      top5,
      misaligned,
      trust_mirror,
      conviction,
      desire,
      diagnostics, // optional
    };

    // 6) HARD CONTRACT ASSERTION
    assertPythhResponse(response, "Backend PythhResponse");

    // 7) RETURN
    return res.json(response);
  } catch (err) {
    console.error("Pythh handler error:", err);

    // HARD FAIL SAFE — partial rendering allowed, demo data forbidden
    const fallback: PythhResponse = {
      startup: {
        name: "Unknown",
        domain: url,
        detected_category: "Unknown",
        detected_stage: "Unknown",
        short_description: "Unable to extract startup identity.",
      },

      invocation: {
        status: "failed",
        message: "Unable to complete capital alignment analysis.",
      },

      top5: makeEmptyTop5(),

      misaligned: makeEmptyMisaligned(),

      trust_mirror: {
        orientation_statements: [
          "You are being read as early-stage.",
          "You are being read as category-ambiguous.",
          "You are being read as having limited external proof.",
          "You are being read as not yet legible to most funds.",
        ],
        synthesis_sentence:
          "This is why capital response has been inconsistent.",
      },

      conviction: {
        investor_name: "Unknown",
        distance_to_flip: 0,
        blocking_signals: [],
        leverage_actions: [],
        collateral_investors: [],
      },

      desire: {
        more_aligned_count: 0,
        more_misaligned_count: 0,
        new_matches_this_week: 0,
        warming_up_count: 0,
        cooling_off_count: 0,
        blurred_aligned: [],
      },
    };

    assertPythhResponse(fallback, "Fallback PythhResponse");

    return res.status(200).json(fallback);
  }
}

/* ============================================================================
 * Helper factories — enforce invariants
 * ========================================================================== */

function makeEmptyTop5() {
  return Array.from({ length: 5 }).map((_, i) => ({
    investor_id: `empty-${i}`,
    name: "No investor currently recognizes your narrative.",
    signal_score: 0,
    distance: "cold" as const,
    tags: [],
    why_line: "No alignment signals detected yet.",
    overlapping_signals: [],
    why_expanded: {
      causal_reasons: [],
      timing_context: "No timing context available.",
    },
    align_expanded: {
      leverage_actions: [],
      why_this_works: "No leverage actions available yet.",
      collateral_investors: [],
    },
  }));
}

function makeEmptyMisaligned() {
  return Array.from({ length: 5 }).map((_, i) => ({
    investor_id: `misaligned-${i}`,
    name: "Generalist Seed Fund",
    stage: "Seed",
    thesis: "Generalist",
    fit_score: 0,
    why_not_line: "No alignment signals detected.",
    missing_signals: [],
    distance: "orthogonal" as const,
  }));
}

/* ============================================================================
 * Placeholder engine functions — replace with real implementations
 * ========================================================================== */

async function detectStartupIdentity(url: string) {
  // TODO: Replace with real startup detection logic
  // This should call your existing startupResolver or enrichment pipeline
  return {
    name: "Detected Startup",
    domain: url,
    detected_category: "HealthTech",
    detected_stage: "Pre-seed",
    short_description: "AI-powered health infrastructure platform.",
  };
}

async function collectSignals(_startup: any) {
  // TODO: Replace with real signal collection
  // This should gather all signals needed for matching
  return {};
}

async function runMatchingEngine(_startup: any, _signals: any) {
  // TODO: Replace with real matching engine
  // This should call your existing matching service and transform to contract shape
  return {
    top5: makeEmptyTop5(),
    misaligned: makeEmptyMisaligned(),
    trust_mirror: {
      orientation_statements: [
        "You are being read as early-category infrastructure.",
        "You are being read as execution-heavy and product-forward.",
        "You are being read as having limited external proof.",
        "You are being read as having emerging portfolio adjacency.",
      ],
      synthesis_sentence:
        "This is why some funds are warming up while others are not responding.",
    },
    conviction: {
      investor_name: "US Seed Operator Fund",
      distance_to_flip: 8,
      blocking_signals: ["No benchmark", "No named customer"],
      leverage_actions: ["Publish a benchmark", "Ship a named pilot"],
      collateral_investors: ["Health Infra Partners", "Seed Stage Capital"],
    },
    desire: {
      more_aligned_count: 17,
      more_misaligned_count: 42,
      new_matches_this_week: 3,
      warming_up_count: 2,
      cooling_off_count: 1,
      blurred_aligned: [],
    },
    diagnostics: {
      raw_signals: {},
      convergence_scores: {},
      phase_change: {},
      internal_notes: [],
    },
  };
}
