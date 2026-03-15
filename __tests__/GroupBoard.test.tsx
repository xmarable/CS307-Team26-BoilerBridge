/** @jest-environment jsdom */
import { jest } from "@jest/globals";
import "@testing-library/jest-dom";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { GroupBoard } from "../components/GroupBoard";

// Mock the date-fns formatDistanceToNow to keep timestamps predictable
await jest.mock("date-fns", () => ({
  formatDistanceToNow: () => "just now",
}));

const mockAnnouncements = [
  {
    announcementID: "uuid-1",
    content: "Initial announcement",
    pinnedBy: "Leader A",
    timestamp: new Date().toISOString(),
  },
  {
    announcementID: "uuid-2",
    content: "Old update",
    pinnedBy: "Leader B",
    timestamp: new Date(Date.now() - 10000).toISOString(),
  },
];

describe("Group Board Acceptance Criteria", () => {
  beforeEach(() => {
    // cast to any to break the strict type chain for fetch mocking
    global.fetch = jest.fn() as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  /**
   * Acceptance Criteria:
   * Given a group leader pins a message, 
   * When I navigate to the Group Board, 
   * Then that message appears at the top of the board.
   */
  it("Given a group leader pins a message, When I navigate to the Group Board, Then that message appears at the top of the board", async () => {
    const newAnnouncement = {
      announcementID: "uuid-new",
      content: "IMPORTANT: Meeting at 5pm",
      pinnedBy: "Leader A",
      timestamp: new Date().toISOString(),
    };

    const mockedFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    (mockedFetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => newAnnouncement,
    });

    render(
      <GroupBoard 
        groupId="group-123" 
        initialAnnouncements={mockAnnouncements} 
        isLeader={true} 
      />
    );

    // [Action] Enter message and click pin
    const input = screen.getByPlaceholderText(/Pin an important update/i);
    const pinButton = screen.getByRole("button", { name: /^pin$/i });

    fireEvent.change(input, { target: { value: "IMPORTANT: Meeting at 5pm" } });
    fireEvent.click(pinButton);

    // [Assertion] Verify the new message appears at the top (index 0)
    await waitFor(() => {
      const allCards = screen.getAllByText(/IMPORTANT|announcement/);
      // The first element in the list must be the newly pinned message
      expect(allCards[0].textContent).toContain("IMPORTANT: Meeting at 5pm");
    });
  });

  /**
   * Acceptance Criteria:
   * Given there are multiple announcements, 
   * When I view the board, 
   * Then I can see exactly which leader pinned each update.
   */
  it("Given there are multiple announcements, When I view the board, Then I can see exactly which leader pinned each update", () => {
    // [Action] Render board with multiple announcements
    render(
      <GroupBoard 
        groupId="group-123" 
        initialAnnouncements={mockAnnouncements} 
        isLeader={false} 
      />
    );

    // [Assertion] Confirm metadata reveals specific leaders for each pin
    expect(screen.getByText("Leader A")).toBeInTheDocument();
    expect(screen.getByText("Leader B")).toBeInTheDocument();
  });

  /**
   * Acceptance Criteria:
   * Given an announcement is unpinned by a leader, 
   * When I refresh the board, 
   * Then the item is removed from the view for all members.
   */
  it("Given an announcement is unpinned by a leader, When I refresh the board, Then the item is removed from the view for all members", async () => {
    const mockedFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    (mockedFetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    render(
      <GroupBoard 
        groupId="group-123" 
        initialAnnouncements={mockAnnouncements} 
        isLeader={true} 
      />
    );

    // [Action] Leader unpins the first message
    const unpinButtons = screen.getAllByTitle(/Unpin Announcement/i);
    fireEvent.click(unpinButtons[0]);

    // [Assertion] Item is removed from the view
    await waitFor(() => {
      expect(screen.queryByText("Initial announcement")).not.toBeInTheDocument();
    });

    // Ensure state remains valid for other items
    expect(screen.getByText("Old update")).toBeInTheDocument();
  });
});