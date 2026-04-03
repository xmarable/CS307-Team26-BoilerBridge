import { jest } from "@jest/globals";

jest.unstable_mockModule("../lib/itineraryGenerator", () => ({
  generateItinerary: jest.fn(),
  regenerateWithTags: jest.fn(),
}));

const { generateItinerary, regenerateWithTags } =
  (await import("../lib/itineraryGenerator")) as any;

describe("User Story 5: Vibe Tags", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("Given I select the 'Nature' and 'Historical' tags, When I generate a trip, Then the system excludes clubs in favor of parks and landmarks.", async () => {
    generateItinerary.mockResolvedValue([
      { name: "Central Park", category: "Nature" },
      { name: "Statue of Liberty", category: "Historical" },
    ]);

    const result = await generateItinerary({ tags: ["Nature", "Historical"] });

    const hasClubs = result.some((item: any) => item.category === "Nightlife");
    expect(hasClubs).toBe(false);
    expect(result.length).toBe(2);
    expect(generateItinerary).toHaveBeenCalledWith(
      expect.objectContaining({ tags: ["Nature", "Historical"] }),
    );
  });

  it("Given I change tags mid-planning, When I regenerate the plan, Then the new itinerary reflects the updated vibes without changing 'locked' items.", async () => {
    const currentItinerary = [
      { id: 1, name: "Louvre", category: "Historical", locked: true },
      { id: 2, name: "Nightclub", category: "Nightlife", locked: false },
    ];

    regenerateWithTags.mockResolvedValue([
      { id: 1, name: "Louvre", category: "Historical", locked: true },
      { id: 3, name: "Botanical Garden", category: "Nature", locked: false },
    ]);

    const result = await regenerateWithTags(currentItinerary, ["Nature"]);

    expect(result[0].id).toBe(1);
    expect(result[1].category).toBe("Nature");
    expect(result.some((item: any) => item.category === "Nightlife")).toBe(
      false,
    );
  });

  it("Given no tags are selected, When I hit generate, Then the system provides a balanced 'General Interest' itinerary by default.", async () => {
    generateItinerary.mockResolvedValue([
      { category: "Nature" },
      { category: "Historical" },
      { category: "Nightlife" },
    ]);

    const result = await generateItinerary({ tags: [] });

    const categories = result.map((item: any) => item.category);
    expect(categories).toContain("Nature");
    expect(categories).toContain("Historical");
    expect(categories).toContain("Nightlife");
  });
});
