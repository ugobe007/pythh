import type { InvestorsResponse } from "../../types/investors";
import type { Mode } from "../../types/snapshot";
import { buildMockInvestors } from "./mock";

export async function fetchInvestors(input: { startupId?: string; startupUrl?: string; mode: Mode }): Promise<InvestorsResponse> {
  // V0 mock
  return buildMockInvestors(input.mode);

  // Later:
  // const res = await fetch("/api/investors/matches", { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(input) });
  // if (!res.ok) throw new Error("Failed to fetch investors");
  // return res.json();
}
