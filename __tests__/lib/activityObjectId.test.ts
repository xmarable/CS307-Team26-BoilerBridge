import { describe, it, expect } from "@jest/globals";
import { isValidActivityMongoId } from "@/lib/activityObjectId";

describe("isValidActivityMongoId (US15 deep links)", () => {
  it("accepts 24-char hex ObjectId strings", () => {
    expect(isValidActivityMongoId("507f1f77bcf86cd799439011")).toBe(true);
  });

  it("rejects mock itinerary ids", () => {
    expect(isValidActivityMongoId("mock-0")).toBe(false);
  });

  it("rejects undefined and empty", () => {
    expect(isValidActivityMongoId(undefined)).toBe(false);
    expect(isValidActivityMongoId("")).toBe(false);
  });
});
