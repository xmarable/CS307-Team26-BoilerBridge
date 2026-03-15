/** @jest-environment jsdom */
import { jest } from "@jest/globals";

// 1. Mock the navigation and date-fns modules before any imports
jest.unstable_mockModule("next/navigation", () => ({
  __esModule: true,
  useRouter: () => ({
    push: jest.fn(),
  }),
  useParams: () => ({ groupId: "group-123" }),
}));

jest.unstable_mockModule("date-fns", () => ({
  __esModule: true,
  formatDistanceToNow: () => "just now",
}));

// 2. Dynamic imports to ensure mocks are applied correctly
const { GroupBoard } = await import("../components/GroupBoard");

// 3. Standard library imports
import "@testing-library/jest-dom";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

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
    // Cast to any to bypass strict fetch typing in tests
    global.fetch = jest.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve([]),
      } as Response),
    ) as any;
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
      status: 201,
      json: async () => newAnnouncement,
    } as Response);

    render(
      <GroupBoard
        groupId="group-123"
        initialAnnouncements={mockAnnouncements}
        isLeader={true}
      />,
    );

    const input = screen.getByPlaceholderText(/Pin an important update/i);
    const pinButton = screen.getByRole("button", { name: /^pin$/i });

    fireEvent.change(input, { target: { value: "IMPORTANT: Meeting at 5pm" } });
    fireEvent.click(pinButton);

    // [Assertion] Verify the new message appears at the top (index 0)
    await waitFor(() => {
      const allCards = screen.getAllByText(/IMPORTANT|announcement/);
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
    render(
      <GroupBoard
        groupId="group-123"
        initialAnnouncements={mockAnnouncements}
        isLeader={false}
      />,
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
      status: 200,
      json: async () => ({ success: true }),
    } as Response);

    render(
      <GroupBoard
        groupId="group-123"
        initialAnnouncements={mockAnnouncements}
        isLeader={true}
      />,
    );

    // [Action] Leader unpins the first message
    const unpinButtons = screen.getAllByTitle(/Unpin Announcement/i);
    fireEvent.click(unpinButtons[0]);

    // [Assertion] Item is removed from the view
    await waitFor(() => {
      expect(
        screen.queryByText("Initial announcement"),
      ).not.toBeInTheDocument();
    });

    // Ensure other items remain
    expect(screen.getByText("Old update")).toBeInTheDocument();
  });
});
