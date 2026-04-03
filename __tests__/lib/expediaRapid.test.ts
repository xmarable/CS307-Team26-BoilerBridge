import { describe, expect, it } from "@jest/globals";
import {
  buildExpediaHotelSearchUrl,
  pickFirstExpediaUrl,
} from "@/lib/travel/expediaRapid";

describe("expediaRapid helpers", () => {
  it("buildExpediaHotelSearchUrl encodes destination", () => {
    const url = buildExpediaHotelSearchUrl("Miami, FL");
    expect(url).toContain("https://www.expedia.com/Hotel-Search");
    expect(url).toContain("destination=");
    expect(decodeURIComponent(url)).toMatch(/Miami/);
  });

  it("pickFirstExpediaUrl finds nested expedia https URL", () => {
    const url = pickFirstExpediaUrl({
      nested: { items: ["https://www.expedia.com/foo-bar"] },
    });
    expect(url).toBe("https://www.expedia.com/foo-bar");
  });
});
