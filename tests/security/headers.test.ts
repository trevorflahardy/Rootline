import { describe, it, expect } from "vitest";
import nextConfig from "../../next.config";

// Loads headers() from next.config.ts and validates all security headers are present
// with correct values — no running server required.

async function getSecurityHeaders(): Promise<Record<string, string>> {
  const rules = await nextConfig.headers!();
  const catchAll = rules.find((r) => r.source === "/(.*)" || r.source === "/:path*");
  expect(catchAll, "Catch-all header rule must exist").toBeDefined();
  return Object.fromEntries(catchAll!.headers.map((h) => [h.key, h.value]));
}

describe("Security headers config", () => {
  it("sets X-Frame-Options to DENY", async () => {
    const h = await getSecurityHeaders();
    expect(h["X-Frame-Options"]).toBe("DENY");
  });

  it("sets X-Content-Type-Options to nosniff", async () => {
    const h = await getSecurityHeaders();
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
  });

  it("sets Referrer-Policy to strict-origin-when-cross-origin", async () => {
    const h = await getSecurityHeaders();
    expect(h["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
  });

  it("sets Permissions-Policy restricting camera, microphone, geolocation, payment, usb", async () => {
    const h = await getSecurityHeaders();
    const policy = h["Permissions-Policy"] ?? "";
    expect(policy).toContain("camera=()");
    expect(policy).toContain("microphone=()");
    expect(policy).toContain("geolocation=()");
    expect(policy).toContain("payment=()");
    expect(policy).toContain("usb=()");
  });

  it("sets Strict-Transport-Security with max-age >= 1 year and includeSubDomains", async () => {
    const h = await getSecurityHeaders();
    const hsts = h["Strict-Transport-Security"] ?? "";
    const match = hsts.match(/max-age=(\d+)/);
    expect(match, "HSTS must include max-age").toBeTruthy();
    const maxAge = parseInt(match![1], 10);
    expect(maxAge).toBeGreaterThanOrEqual(31536000); // 1 year minimum
    expect(hsts).toContain("includeSubDomains");
  });

  it("sets Cross-Origin-Opener-Policy", async () => {
    const h = await getSecurityHeaders();
    expect(h["Cross-Origin-Opener-Policy"]).toBeDefined();
    expect(["same-origin", "same-origin-allow-popups", "unsafe-none"]).toContain(
      h["Cross-Origin-Opener-Policy"]
    );
  });

  it("sets Cross-Origin-Resource-Policy", async () => {
    const h = await getSecurityHeaders();
    expect(h["Cross-Origin-Resource-Policy"]).toBeDefined();
    expect(["same-origin", "same-site", "cross-origin"]).toContain(
      h["Cross-Origin-Resource-Policy"]
    );
  });

  it("does not expose server software via X-Powered-By (Next.js removes this by default)", async () => {
    // Next.js removes X-Powered-By automatically — verify we haven't re-added it
    const h = await getSecurityHeaders();
    expect(h["X-Powered-By"]).toBeUndefined();
  });

  it("has at least 7 security headers defined", async () => {
    const h = await getSecurityHeaders();
    expect(Object.keys(h).length).toBeGreaterThanOrEqual(7);
  });
});
