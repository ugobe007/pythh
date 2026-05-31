import { describe, it, expect } from "vitest";
import {
  buildInvestorProfilesMarkdown,
  sanitizeExportFilename,
} from "./lib/investorProfilesExport";

describe("investorProfilesExport", () => {
  it("sanitizes filenames", () => {
    expect(sanitizeExportFilename("Acme Robotics Inc.")).toBe("Acme_Robotics_Inc_top_investor_matches");
  });

  it("builds markdown with all investor profile sections", () => {
    const md = buildInvestorProfilesMarkdown({
      startupName: "Acme Robotics",
      startupUrl: "https://acme.ai",
      godScore: 72,
      investors: [
        {
          rank: 1,
          name: "Sarah Chen",
          firm: "Sequoia Capital",
          role: "Partner",
          sectors: ["AI/ML"],
          stage: "Series A",
          checkSize: "$5M–$15M",
          matchScore: 94,
          signalScore: 85,
          isSuperMatch: true,
          whyYouMatchTags: ["✦ SUPER MATCH — sector fit"],
          reason: "Strong thesis alignment on AI infrastructure.",
          investmentThesis: "Backs technical founders in AI infra.",
        },
      ],
    });

    expect(md).toContain("# PYTHIA Investor Match Report");
    expect(md).toContain("**Startup:** Acme Robotics");
    expect(md).toContain("## #1 — Sarah Chen");
    expect(md).toContain("### Match signals");
    expect(md).toContain("### PYTHIA reasoning");
    expect(md).toContain("### Investment thesis");
    expect(md).toContain("Super match");
  });
});
