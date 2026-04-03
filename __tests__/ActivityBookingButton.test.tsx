/** @jest-environment jsdom */
import { jest } from "@jest/globals";
import "@testing-library/jest-dom";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ActivityBookingButton } from "@/components/ActivityBookingButton";

describe("US16: ActivityBookingButton", () => {
  const originalOpen = window.open;

  beforeEach(() => {
    window.open = jest.fn() as typeof window.open;
  });

  afterEach(() => {
    window.open = originalOpen;
  });

  it("renders nothing when bookingUrl is missing", () => {
    const { container } = render(<ActivityBookingButton />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when bookingUrl is empty", () => {
    const { container } = render(<ActivityBookingButton bookingUrl="" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows Book now and opens external URL after confirmation", async () => {
    render(
      <ActivityBookingButton bookingUrl="https://example.com/book" />,
    );

    fireEvent.click(screen.getByRole("button", { name: /book now/i }));

    expect(
      await screen.findByText(/leaving boilerbridge/i),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /continue to booking/i }),
    );

    expect(window.open).toHaveBeenCalledWith(
      "https://example.com/book",
      "_blank",
      "noopener,noreferrer",
    );
  });
});
