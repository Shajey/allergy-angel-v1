/**
 * Phase 10K – Insights feed Trust Layer tests
 * Verifies: WhyDisclosure and evidence line when insight.evidence exists
 */
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ProfileProvider } from "../context/ProfileContext";
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

    const mockProfile = {
      id: "profile-1",
      display_name: "Test",
      known_allergies: [] as string[],
      current_medications: [] as unknown[],
      supplements: [] as string[],
      is_primary: true,
      created_at: "2025-01-01T00:00:00Z",
    };

    (fetch as ReturnType<typeof vi.fn>).mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : String(input);
      if (url.includes("/api/knowledge/aliases")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({}),
        });
      }
      if (url.includes("/api/profile?action=list")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ profiles: [mockProfile] }),
        });
      }
      if (url.includes("/api/insights/feed")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            profileId: "profile-1",
            windowHours: 48,
            analyzedChecks: 5,
            insights: mockInsights,
          }),
        });
      }
      return Promise.resolve({ ok: false, json: async () => ({}) });
    });

    render(
      <MemoryRouter>
        <ProfileProvider>
          <InsightsPage />
        </ProfileProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /why/i })).toBeInTheDocument();
    });

    expect(screen.getAllByText(/2\/3 hit\/exposure/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/lift 1\.5x/).length).toBeGreaterThan(0);
  });
});
