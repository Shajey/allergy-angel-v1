/**
 * Phase 10K – WhyDisclosure tests
 * Verifies: toggles aria-expanded and reveals content
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { WhyDisclosure } from "./WhyDisclosure.js";

describe("WhyDisclosure", () => {
  it("toggles aria-expanded and reveals content when clicked", async () => {
    const user = userEvent.setup();
    render(
      <WhyDisclosure title="Why?">
        <p>Evidence details here</p>
      </WhyDisclosure>
    );

    const button = screen.getByRole("button", { name: /why/i });
    expect(button).toHaveAttribute("aria-expanded", "false");

    const content = screen.getByText("Evidence details here");
    const contentContainer = content.closest("[role='region']");
    expect(contentContainer).toHaveClass("hidden");

    await user.click(button);

    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(contentContainer).not.toHaveClass("hidden");
  });

  it("shows summaryLines when provided", () => {
    render(
      <WhyDisclosure summaryLines={["Summary line 1"]}>
        <p>Details</p>
      </WhyDisclosure>
    );
    expect(screen.getByText("Summary line 1")).toBeInTheDocument();
  });
});
