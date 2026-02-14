/**
 * Phase 10K – History detail Trust Layer tests
 * Verifies: Risk Badge + reasoning when verdict.riskLevel exists
 */
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
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

    (fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ check: mockCheck, events: [] }),
      })
      .mockResolvedValueOnce({ ok: false }); // profile fetch fails (optional)

    render(
      <MemoryRouter initialEntries={["/history/check-123"]}>
        <Routes>
          <Route path="/history/:id" element={<HistoryCheckDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/high/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/pistachio matches your tree nut allergy/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /why/i })).toBeInTheDocument();
  });
});
