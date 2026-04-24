import { jest } from "@jest/globals";

const leanMock = jest.fn(async () => []);
const selectMock = jest.fn(() => ({ lean: leanMock }));
const findMock = jest.fn(() => ({ select: selectMock }));

await jest.unstable_mockModule("@/models/Activity", () => ({
  default: {
    find: findMock,
  },
}));

const { filterProposedEventsByAccessibility } = await import(
  "@/lib/itinerary/filterProposedByAccessibility"
);

describe("filterProposedEventsByAccessibility", () => {
  beforeEach(() => {
    findMock.mockClear();
    selectMock.mockClear();
    leanMock.mockClear();
  });

  it("keeps rows with unknown accessibility metadata", async () => {
    const proposed = [
      {
        title: "Museum A",
        startTime: new Date("2026-04-02T10:00:00Z"),
        endTime: new Date("2026-04-02T12:00:00Z"),
        eventType: "activity",
      },
      {
        title: "Museum B",
        startTime: new Date("2026-04-03T10:00:00Z"),
        endTime: new Date("2026-04-03T12:00:00Z"),
        eventType: "activity",
      },
    ];
    const linkRows = [{ linkedPlaceId: "place-a" }, { linkedPlaceId: "place-b" }];
    const requirements = {
      wheelchairAccessible: true,
      stepFree: false,
      accessibleRestroom: false,
      hearingAssistance: false,
      visualAssistance: false,
    };

    const out = await filterProposedEventsByAccessibility(
      proposed,
      linkRows,
      requirements,
    );

    expect(out.proposed).toHaveLength(2);
    expect(out.linkRows).toHaveLength(2);
    expect(out.removedCount).toBe(0);
  });
});

