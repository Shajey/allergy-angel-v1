/**
 * Phase 10K – History detail Trust Layer tests
 * Verifies: Risk Badge + reasoning when verdict.riskLevel exists
 */
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ProfileProvider } from "../context/ProfileContext";
import HistoryCheckDetailPage from "./HistoryCheckDetailPage.jsx";

describe("HistoryCheckDetailPage", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("renders Risk Badge and reasoning when verdict.riskLevel exists", async () => {
    const mockCheck = {
      id: "check-123",
      profile_id: "profile-1",
      raw_text: "I ate pistachio ice cream",
      follow_up_questions: [],
      verdict: {
        riskLevel: "high",
        reasoning: "Pistachio matches your tree nut allergy.",
        matched: [{ rule: "allergy_match", details: { meal: "pistachio ice cream", allergen: "pistachio" } }],
      },
      created_at: "2025-01-15T12:00:00Z",
    };

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
      if (url.includes("/api/history/check-123")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ check: mockCheck, events: [] }),
        });
      }
      if (url.includes("/api/profile?") && url.includes("profileId=")) {
        return Promise.resolve({ ok: false, json: async () => ({}) });
      }
      if (url.includes("/api/trajectory")) {
        return Promise.resolve({ ok: false, json: async () => ({}) });
      }
      return Promise.resolve({ ok: false, json: async () => ({}) });
    });

    render(
      <MemoryRouter initialEntries={["/history/check-123"]}>
        <ProfileProvider>
          <Routes>
            <Route path="/history/:id" element={<HistoryCheckDetailPage />} />
          </Routes>
        </ProfileProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/high/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/pistachio matches your tree nut allergy/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /why/i })).toBeInTheDocument();
  });
});
