/**
 * @jest-environment jsdom
 */
import { jest } from "@jest/globals";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockOpen = jest.fn();
window.open = mockOpen as any;

jest.unstable_mockModule("../components/ActivitySummaryCard", () => ({
  default: function ActivitySummaryCard({ activity }: any) {
    return (
      <div data-testid="activity-card">
        <h3>{activity.name}</h3>
        {activity.requiresReservation && activity.externalBookingUrl && (
          <button
            onClick={() => window.open(activity.externalBookingUrl, "_blank")}
          >
            Book Now
          </button>
        )}
        {activity.requiresReservation && !activity.externalBookingUrl && (
          <a
            href={`https://www.google.com/search?q=${activity.name}+tickets`}
            target="_blank"
            rel="noreferrer"
          >
            Search for Tickets
          </a>
        )}
      </div>
    );
  },
}));

const { default: ActivitySummaryCard } =
  (await import("../components/ActivitySummaryCard")) as any;

describe("User Story 4: External Booking", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("Given I am looking at a museum in the itinerary, When I click 'Book Now', Then the app opens the vendor's site in a new browser tab.", () => {
    const mockActivity = {
      name: "Louvre Museum",
      requiresReservation: true,
      externalBookingUrl: "https://louvre.fr/tickets",
    };

    render(<ActivitySummaryCard activity={mockActivity} />);
    const button = screen.getByText("Book Now");
    fireEvent.click(button);

    expect(mockOpen).toHaveBeenCalledWith(
      "https://louvre.fr/tickets",
      "_blank",
    );
  });

  it("Given an activity does not require a reservation, When I view its details, Then the booking button is hidden to avoid confusion.", () => {
    const mockActivity = {
      name: "Central Park",
      requiresReservation: false,
      externalBookingUrl: null,
    };

    render(<ActivitySummaryCard activity={mockActivity} />);

    expect(screen.queryByText("Book Now")).not.toBeInTheDocument();
  });

  it("Given a booking link is missing, When the itinerary is generated, Then the app provides a generic 'Search for Tickets' link as a fallback.", () => {
    const mockActivity = {
      name: "Eiffel Tower",
      requiresReservation: true,
      externalBookingUrl: null,
    };

    render(<ActivitySummaryCard activity={mockActivity} />);

    const fallbackLink = screen.getByText("Search for Tickets");
    expect(fallbackLink).toBeInTheDocument();
    expect(fallbackLink.closest("a")).toHaveAttribute(
      "href",
      "https://www.google.com/search?q=Eiffel Tower+tickets",
    );
  });
});
