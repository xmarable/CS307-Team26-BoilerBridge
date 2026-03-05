/** @jest-environment jsdom */
import { jest } from "@jest/globals";
import "@testing-library/jest-dom";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const TripPage = (await import("@/app/trip/page")).default;

describe("TripPage", () => {
  beforeEach(() => {
    global.fetch = jest.fn<any>();

    Object.defineProperty(window, "location", {
      value: { href: "" },
      writable: true,
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
    window.location.href = ""; // reset location after each test to prevent cross-test contamination
  });

  it("renders the create trip form", () => {
    render(<TripPage />);

    // "Create Trip" exists in both h1 and button, so target the heading
    expect(
      screen.getByRole("heading", { name: "Create Trip" }),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("From City")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("To City")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create trip/i }),
    ).toBeInTheDocument();
  });

  it("shows a validation error if budget is invalid", async () => {
    const { container } = render(<TripPage />);

    // Fill required fields
    fireEvent.change(screen.getByPlaceholderText("From City"), {
      target: { value: "Chicago" },
    });
    fireEvent.change(screen.getByPlaceholderText("To City"), {
      target: { value: "NYC" },
    });
    fireEvent.change(screen.getByLabelText(/from date/i), {
      target: { value: "2026-03-05" },
    });
    fireEvent.change(screen.getByLabelText(/to date/i), {
      target: { value: "2026-03-10" },
    });

    // Invalid budget
    fireEvent.change(screen.getByPlaceholderText("Budget"), {
      target: { value: "0" },
    });

    // Submit the form directly (more reliable than clicking submit with native constraint validation)
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
      json: async () => ({ _id: "abc123" }),
    } as Response);

    render(<TripPage />);

    fireEvent.change(screen.getByPlaceholderText("From City"), {
      target: { value: "Chicago" },
    });
    fireEvent.change(screen.getByPlaceholderText("To City"), {
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
    fireEvent.change(screen.getByPlaceholderText("Budget"), {
      target: { value: "1200" },
    });

    fireEvent.click(screen.getByRole("button", { name: /create trip/i }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    const [url, options]: any = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("/api/trip");
    expect(options.method).toBe("POST");

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

    fireEvent.change(screen.getByPlaceholderText("From City"), {
      target: { value: "Chicago" },
    });
    fireEvent.change(screen.getByPlaceholderText("To City"), {
      target: { value: "NYC" },
    });
    fireEvent.change(screen.getByLabelText(/from date/i), {
      target: { value: "2026-03-05" },
    });
    fireEvent.change(screen.getByLabelText(/to date/i), {
      target: { value: "2026-03-10" },
    });
    fireEvent.change(screen.getByPlaceholderText("Budget"), {
      target: { value: "1200" },
    });

    fireEvent.click(screen.getByRole("button", { name: /create trip/i }));

    expect(await screen.findByText("Invalid input data")).toBeInTheDocument();
    expect(window.location.href).not.toBe("/alltrips");
  });
});
