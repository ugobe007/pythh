import { describe, expect, it } from "vitest";
import { buildSupabaseOAuthRedirectUrl, isOAuthHandoffActive } from "./lib/supabaseOAuth";

describe("OAuth redirect URL", () => {
  it("targets /account with next param (not bare server callback)", () => {
    const url = buildSupabaseOAuthRedirectUrl("/admin/matching");
    expect(url).toMatch(/\/account\?next=/);
    expect(url).toContain(encodeURIComponent("/admin/matching"));
    expect(url).not.toMatch(/\/api\/auth\/supabase\/callback$/);
  });
});

describe("OAuth handoff flag", () => {
  it("expires after TTL", () => {
    sessionStorage.setItem("pythh_oauth_handoff", String(Date.now() - 130_000));
    expect(isOAuthHandoffActive()).toBe(false);
  });

  it("is active when recently set", () => {
    sessionStorage.setItem("pythh_oauth_handoff", String(Date.now()));
    expect(isOAuthHandoffActive()).toBe(true);
    sessionStorage.removeItem("pythh_oauth_handoff");
  });
});
