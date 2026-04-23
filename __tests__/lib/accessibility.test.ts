import {
  matchesAccessibilityRequirements,
  parseAccessibilityRequirementsFromSearchParams,
} from "@/lib/travel/accessibility";

describe("accessibility matcher", () => {
  it("filters out candidates that do not meet strict requirements", () => {
    const requirements = {
      wheelchairAccessible: true,
      stepFree: false,
      accessibleRestroom: false,
      hearingAssistance: false,
      visualAssistance: false,
    };
    expect(
      matchesAccessibilityRequirements(
        { wheelchairAccessible: true },
        requirements,
      ),
    ).toBe(true);
    expect(
      matchesAccessibilityRequirements(
        { wheelchairAccessible: false },
        requirements,
      ),
    ).toBe(false);
  });

  it("treats unknown accessibility values as non-matching in strict mode", () => {
    const requirements = {
      wheelchairAccessible: true,
      stepFree: false,
      accessibleRestroom: true,
      hearingAssistance: false,
      visualAssistance: false,
    };
    expect(matchesAccessibilityRequirements({}, requirements)).toBe(false);
  });

  it("rejects invalid accessibility query values", () => {
    const params = new URLSearchParams({
      wheelchairAccessible: "maybe",
    });
    const parsed = parseAccessibilityRequirementsFromSearchParams(params);
    expect(parsed.ok).toBe(false);
  });
});

