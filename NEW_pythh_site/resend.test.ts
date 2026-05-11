/**
 * Validates that RESEND_API_KEY is set and accepted by the Resend API.
 * Calls GET /domains (a read-only endpoint) — no emails are sent.
 */
import { describe, it, expect } from "vitest";

describe("Resend API key", () => {
  it("should be set in the environment", () => {
    expect(process.env.RESEND_API_KEY, "RESEND_API_KEY must be set").toBeTruthy();
  });

  it("should be accepted by the Resend API (GET /domains)", async () => {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      console.warn("Skipping Resend API call — key not set");
      return;
    }
    try {
      const resp = await fetch("https://api.resend.com/domains", {
        headers: { Authorization: `Bearer ${key}` },
      });
      // 200 = valid key, 401 = invalid key
      expect(resp.status, `Resend responded with ${resp.status} — check your API key`).toBe(200);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("fetch failed") || msg.includes("ENOTFOUND") || msg.includes("getaddrinfo")) {
        console.warn("Skipping Resend live API check — network unavailable");
        return;
      }
      throw e;
    }
  });
});
