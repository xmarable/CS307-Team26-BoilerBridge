/** @jest-environment jsdom */
import { describe, it, expect, beforeEach } from "@jest/globals";
import {
  cacheGroupShell,
  readGroupShell,
  clearGroupShell,
} from "@/lib/offline/groupShellCache";

beforeEach(() => {
  window.localStorage.clear();
});

describe("groupShellCache", () => {
  it("roundtrips_group_payload", () => {
    const gid = "g-1";
    const payload = { groupID: gid, groupName: "Test" };
    cacheGroupShell(gid, payload);
    expect(readGroupShell(gid)).toEqual(payload);
    clearGroupShell(gid);
    expect(readGroupShell(gid)).toBeNull();
  });
});
