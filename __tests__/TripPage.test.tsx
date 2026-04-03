/** @jest-environment jsdom */

process.env.MONGODB_URI = process.env.TEST_MONGODB_URI; // Use the test database for these tests

import { jest } from "@jest/globals";
import "@testing-library/jest-dom";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// 1. Mock next-auth/react - Data MUST be inside the factory to avoid undefined errors in ESM
await jest.unstable_mockModule("next-auth/react", () => ({
  useSession: jest.fn(() => ({
    data: { user: { userId: "test-user-id", name: "Xavy" } },
    status: "authenticated",
  })),
}));

// 2. Mock next/navigation - Added useParams to prevent SyntaxError since the component now uses it
await jest.unstable_mockModule("next/navigation", () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
  })),
  useParams: jest.fn(() => ({
    groupId: "15105263-6166-40c8-977a-a3575375bc58", // mock the group context for the test
  })),
}));

// 3. Mock Navbar as a named export
await jest.unstable_mockModule("@/components/Navbar", () => ({
  Navbar: () => <nav data-testid="mock-navbar" />,
}));

// 4. Force registration of mocks before importing the component
await import("next-auth/react");
await import("next/navigation");
await import("@/components/Navbar");

// 5. Dynamic import of the component
// logic: ensured this path matches your actual file structure to avoid import failures
const TripPage = (await import("@/app/dashboard/trip/page")).default;

describe("TripPage", () => {
  // Now, inside your tests, you can even re-mock the return value if needed:
  // (useSession as jest.Mock).mockReturnValue({ data: null, status: "loading" });

  beforeEach(() => {
    global.fetch = jest.fn<any>();
    Object.defineProperty(window, "location", {
      value: { href: "" },
      writable: true,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("renders the create trip form", () => {
    // This will now use the mock version of useSession that is 100% defined
    render(<TripPage />);

    expect(
      screen.getByRole("heading", { name: "Create Trip" }),
    ).toBeInTheDocument();

    expect(screen.getByPlaceholderText("e.g. Chicago")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("e.g. Miami")).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /create trip/i }),
    ).toBeInTheDocument();
  });

  it("shows a validation error if budget is invalid", async () => {
    const { container } = render(<TripPage />);

    // Fill required fields
    fireEvent.change(screen.getByPlaceholderText("e.g. Chicago"), {
      target: { value: "Chicago" },
    });
    fireEvent.change(screen.getByPlaceholderText("e.g. Miami"), {
      target: { value: "NYC" },
    });
    fireEvent.change(screen.getByLabelText(/from date/i), {
      target: { value: "2026-03-05" },
    });
    fireEvent.change(screen.getByLabelText(/to date/i), {
      target: { value: "2026-03-10" },
    });

    // Invalid budget
    fireEvent.change(screen.getByPlaceholderText("e.g. 500"), {
      target: { value: "0" },
    });

    // Submit the form directly
    const formEl = container.querySelector("form");
    expect(formEl).toBeTruthy();
    fireEvent.submit(formEl!);

    expect(
      await screen.findByText("Budget must be a positive number."),
    ).toBeInTheDocument();

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("calls POST /api/trip and redirects on success", async () => {
    (global.fetch as jest.Mock<any>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tripID: "abc12345-abcd-abcd-abcd-abc123456789" }),
    } as Response);

    render(<TripPage />);

    fireEvent.change(screen.getByPlaceholderText("e.g. Chicago"), {
      target: { value: "Chicago" },
    });
    fireEvent.change(screen.getByPlaceholderText("e.g. Miami"), {
      target: { value: "NYC" },
    });
    fireEvent.change(screen.getByLabelText(/from date/i), {
      target: { value: "2026-03-05" },
    });
    fireEvent.change(screen.getByLabelText(/to date/i), {
      target: { value: "2026-03-10" },
    });
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "flight" },
    });
    fireEvent.change(screen.getByPlaceholderText("e.g. 500"), {
      target: { value: "1200" },
    });

    fireEvent.click(screen.getByRole("button", { name: /create trip/i }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    const [url, options]: any = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("/api/trip");
    expect(options.method).toBe("POST");

    // verification: ensure the groupId from useParams is passed in the payload
    const body = JSON.parse(options.body);
    expect(body.groupId).toBe("15105263-6166-40c8-977a-a3575375bc58");

    await waitFor(() => {
      expect(window.location.href).toBe("/alltrips");
    });
  });

  it("shows API error message when POST fails", async () => {
    (global.fetch as jest.Mock<any>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Invalid input data" }),
    } as Response);

    render(<TripPage />);

    fireEvent.change(screen.getByPlaceholderText("e.g. Chicago"), {
      target: { value: "Chicago" },
    });
    fireEvent.change(screen.getByPlaceholderText("e.g. Miami"), {
      target: { value: "NYC" },
    });
    fireEvent.change(screen.getByLabelText(/from date/i), {
      target: { value: "2026-03-05" },
    });
    fireEvent.change(screen.getByLabelText(/to date/i), {
      target: { value: "2026-03-10" },
    });
    fireEvent.change(screen.getByPlaceholderText("e.g. 500"), {
      target: { value: "1200" },
    });

    fireEvent.click(screen.getByRole("button", { name: /create trip/i }));

    expect(await screen.findByText("Invalid input data")).toBeInTheDocument();
    expect(window.location.href).not.toBe("/alltrips");
  });
});
