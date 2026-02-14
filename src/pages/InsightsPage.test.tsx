/**
 * Phase 10K – Insights feed Trust Layer tests
 * Verifies: WhyDisclosure and evidence line when insight.evidence exists
 */
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import InsightsPage from "./InsightsPage.jsx";

describe("InsightsPage", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("renders WhyDisclosure and shows evidence line when insight.evidence exists", async () => {
    const mockInsights = [
      {
        type: "trigger_symptom",
        label: "Headache after ibuprofen",
        description: "Headache appears after taking ibuprofen in 2 checks.",
        supportingEvents: ["check-1", "check-2"],
        supportingEventCount: 2,
        priorityHints: {},
        score: 75,
        whyIncluded: [],
        evidence: { exposures: 3, hits: 2, lift: 1.5 },
        fingerprint: "fp-123",
      },
    ];

    (fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ profile: { id: "profile-1" } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          profileId: "profile-1",
          windowHours: 48,
          analyzedChecks: 5,
          insights: mockInsights,
        }),
      });

    render(
      <MemoryRouter>
        <InsightsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /why/i })).toBeInTheDocument();
    });

    expect(screen.getAllByText(/2\/3 hit\/exposure/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/lift 1\.5x/).length).toBeGreaterThan(0);
  });
});
