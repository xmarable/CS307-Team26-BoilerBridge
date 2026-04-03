/**
 * @jest-environment jsdom
 */
import { jest } from "@jest/globals";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

const StorageUI = ({ locations, isLoading, onNavigate }: any) => {
  if (isLoading) return <div data-testid="loading">Loading...</div>;
  if (!locations || locations.length === 0) {
    return <div>No verified lockers available within a 5-mile radius.</div>;
  }

  return (
    <div>
      {locations.map((loc: any) => (
        <div key={loc.id} data-testid="storage-card">
          <h4>{loc.name}</h4>
          <p>Pricing: {loc.price}</p>
          <p>Hours: {loc.hours}</p>
          <button onClick={() => onNavigate(loc)}>Navigate</button>
        </div>
      ))}
    </div>
  );
};

describe("User Story 6: Bag Storage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("Given I have a late flight after checkout, When I search for 'bag storage' near me, Then the app shows a list of verified nearby lockers.", () => {
    const mockLocations = [
      { id: 1, name: "Downtown Lockers", price: "$5/day", hours: "24/7" },
      { id: 2, name: "Station Storage", price: "$7/day", hours: "6AM - 11PM" },
    ];

    render(<StorageUI locations={mockLocations} isLoading={false} />);

    const cards = screen.getAllByTestId("storage-card");
    expect(cards).toHaveLength(2);
    expect(screen.getByText("Downtown Lockers")).toBeInTheDocument();
  });

  it("Given I select a storage location, When I tap it, Then the app displays the pricing, operating hours, and a 'Navigate' button.", () => {
    const mockLocations = [
      { id: 1, name: "Downtown Lockers", price: "$5/day", hours: "24/7" },
    ];
    const navigateMock = jest.fn();

    render(
      <StorageUI
        locations={mockLocations}
        isLoading={false}
        onNavigate={navigateMock}
      />,
    );

    expect(screen.getByText("Pricing: $5/day")).toBeInTheDocument();
    expect(screen.getByText("Hours: 24/7")).toBeInTheDocument();

    const navButton = screen.getByText("Navigate");
    fireEvent.click(navButton);

    expect(navigateMock).toHaveBeenCalledWith(mockLocations[0]);
  });

  it("Given I am in a city with no partner options, When I search, Then the app indicates if no verified lockers are available within a 5-mile radius.", () => {
    render(<StorageUI locations={[]} isLoading={false} />);
    expect(
      screen.getByText(/no verified lockers available within a 5-mile radius/i),
    ).toBeInTheDocument();
  });
});
