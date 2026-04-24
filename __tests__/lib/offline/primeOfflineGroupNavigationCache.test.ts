/** @jest-environment jsdom */
import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import {
  OFFLINE_NAV_CACHE_NAME,
  offlineGroupPageUrl,
  primeOfflineGroupNavigationCache,
  clearOfflineGroupNavigationCache,
} from "@/lib/offline/primeOfflineGroupNavigationCache";

describe("primeOfflineGroupNavigationCache", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    if (typeof globalThis.Request === "undefined") {
      globalThis.Request = class RequestPolyfill {
        readonly url: string;
        constructor(input: string | URL) {
          this.url = typeof input === "string" ? input : (input as URL).href;
        }
      } as unknown as typeof Request;
    }
  });

  afterEach(() => {
    try {
      Reflect.deleteProperty(globalThis, "caches");
    } catch {
      /* ignore */
    }
    try {
      Reflect.deleteProperty(globalThis, "fetch");
    } catch {
      /* ignore */
    }
  });

  it("builds_stable_group_dashboard_url", () => {
    expect(offlineGroupPageUrl("https://app.example", "ab-cd-12")).toBe(
      "https://app.example/dashboard/groups/ab-cd-12",
    );
  });

  it("puts_navigation_response_when_fetch_returns_200", async () => {
    const put = jest.fn().mockResolvedValue(undefined);
    const cachesOpen = jest.fn().mockResolvedValue({
      put,
      keys: jest.fn().mockResolvedValue([]),
    });
    Object.defineProperty(globalThis, "caches", {
      value: { open: cachesOpen },
      configurable: true,
    });
    const cloneBody = { ok: true, status: 200, type: "basic" };
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      type: "basic",
      clone: () => cloneBody,
    });
    Object.defineProperty(globalThis, "fetch", {
      value: fetchMock,
      configurable: true,
    });

    const ok = await primeOfflineGroupNavigationCache("group-uuid-1");
    expect(cachesOpen).toHaveBeenCalledWith(OFFLINE_NAV_CACHE_NAME);
    expect(ok).toBe(true);
    expect(put).toHaveBeenCalledTimes(1);
    const req = put.mock.calls[0][0] as Request;
    expect(req.url).toContain("/dashboard/groups/group-uuid-1");
  });

  it("clear_deletes_cache_entries_for_group_path", async () => {
    const del = jest.fn().mockResolvedValue(undefined);
    const entry = { url: "http://localhost/dashboard/groups/g99" };
    Object.defineProperty(globalThis, "caches", {
      value: {
        open: jest.fn().mockResolvedValue({
          keys: jest.fn().mockResolvedValue([entry]),
          delete: del,
        }),
      },
      configurable: true,
    });

    await clearOfflineGroupNavigationCache("g99");
    expect(del).toHaveBeenCalledWith(entry);
  });
});
