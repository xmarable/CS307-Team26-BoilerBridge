import { describe, it, expect } from "@jest/globals";
import fs from "node:fs";
import path from "node:path";

const swPath = path.join(process.cwd(), "public", "sw-itinerary.js");

describe("public/sw-itinerary.js", () => {
  it("handles_navigation_and_static_and_api", () => {
    const src = fs.readFileSync(swPath, "utf8");
    expect(src).toContain('req.mode === "navigate"');
    expect(src).toContain('req.destination === "document"');
    expect(src).toContain('pathname.startsWith("/_next/static/")');
    expect(src).toContain("navNetworkFirst");
    expect(src).toContain("staticCacheFirst");
    expect(src).toContain("apiNetworkFirst");
    expect(src).toContain("/api/trip");
    expect(src).toContain("\\/api\\/groups");
    expect(src).toContain("skipWaiting");
    expect(src).toContain("clients.claim");
    expect(src).toContain("Save for Offline");
    expect(src).toContain("offlinePathname");
  });

  it("removes_legacy_trip_only_cache_name", () => {
    const src = fs.readFileSync(swPath, "utf8");
    expect(src).toContain("bb-sw-trip-get-v1");
  });
});
