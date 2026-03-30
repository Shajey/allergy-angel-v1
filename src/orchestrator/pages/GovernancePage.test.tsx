/**
 * Governance page — O6.11 / O7 queue, actions, promotion path.
 */

import type { ReactElement } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { GovernanceStoreProvider } from "../lib/governanceStore";
import { InvestigationStoreProvider } from "../context/InvestigationStoreContext";
import { OrchestratorSelectionProvider } from "../context/OrchestratorSelectionContext";
import GovernancePage from "./GovernancePage";

const mockPushEvent = vi.fn();

vi.mock("../lib/activityStore", () => ({
  useActivityStore: () => ({
    events: [],
    pushEvent: mockPushEvent,
    clearEvents: vi.fn(),
  }),
  ActivityStoreProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ACTIVITY_ICONOGRAPHY: {} as Record<string, { icon: string; color: string; category: string }>,
}));

function renderGovernance(ui: ReactElement) {
  return render(
    <MemoryRouter>
      <OrchestratorSelectionProvider>
        <GovernanceStoreProvider>
          <InvestigationStoreProvider>{ui}</InvestigationStoreProvider>
        </GovernanceStoreProvider>
      </OrchestratorSelectionProvider>
    </MemoryRouter>
  );
}

describe("GovernancePage", () => {
  /** Unique keys per test case to avoid sessionStorage races when the full suite runs in parallel workers. */
  let testIso = 0;
  beforeEach(() => {
    testIso += 1;
    vi.stubGlobal("fetch", vi.fn());
    mockPushEvent.mockClear();
    sessionStorage.removeItem("orch_governance_queue_v1");
    sessionStorage.removeItem("orch_investigation_v2");
  });

  const aliasProposal = {
    id: "11111111-1111-1111-1111-111111111111",
    registry_type: "drug",
    canonical_id: "warfarin",
    proposed_alias: "coumadin",
    proposal_action: "add-alias",
    status: "pending",
    created_at: "2025-01-01T00:00:00Z",
  };

  it("integration: shows Signals queue from session when API returns no proposals", async () => {
    const signalKey = `ue:peanut-int-${testIso}`;
    const clientRow = {
      id: signalKey,
      signalId: signalKey,
      entity: "Peanut",
      proposal: {
        signalId: signalKey,
        research: { aliases: [], classificationConfidence: 88 },
        classification: "new-entity",
        createdAt: 1,
        preview: { before: "No registry entry yet.", after: "Suggested direction: new entity." },
      },
      proposalType: "unknown-entity:new-entity",
      before: "No registry entry yet.",
      after: "Suggested direction: new entity.",
      confidence: 88,
      status: "pending",
      createdAt: Date.now(),
    };
    sessionStorage.setItem("orch_governance_queue_v1", JSON.stringify([clientRow]));

    (fetch as ReturnType<typeof vi.fn>).mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : String(input);
      if (url.includes("alias-proposals")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ meta: { count: 0 }, proposals: [] }),
        });
      }
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    });

    renderGovernance(<GovernancePage />);

    await waitFor(() => {
      expect(screen.getByTestId("governance-signal-review-desk")).toBeInTheDocument();
    });

    expect(screen.getAllByText("Peanut").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Proposal preview/i)).toBeInTheDocument();
    expect(screen.queryByText(/Registry is up to date/i)).not.toBeInTheDocument();
    expect(screen.getByTestId("governance-action-bar")).toBeInTheDocument();
    expect(screen.getByTestId("governance-impact-line")).toHaveTextContent(/Impact:/);
  });

  it("registry-backed row: Approve & Promote calls export and shows flash on success", async () => {
    const user = userEvent.setup();
    (fetch as ReturnType<typeof vi.fn>).mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : String(input);
      if (url.includes("alias-proposals") && (!init || init.method == null)) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ meta: { count: 1 }, proposals: [aliasProposal] }),
        });
      }
      if (url.includes("alias-proposal-export") && init?.method === "POST") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ meta: { exportType: "alias-proposals" }, changes: [] }),
        });
      }
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    });

    renderGovernance(<GovernancePage />);

    await waitFor(() => {
      expect(screen.getByTestId("proposal-review-root")).toBeInTheDocument();
    });

    const approve = screen.getByTestId("governance-approve-promote");
    await user.click(approve);

    await waitFor(() => {
      expect(screen.getByTestId("governance-api-flash")).toBeInTheDocument();
    });
    expect(mockPushEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "registry_promotion",
        metadata: expect.objectContaining({ proposalId: aliasProposal.id }),
      })
    );
  });

  it("registry-backed: promotion failure keeps error visible and does not show success flash", async () => {
    const user = userEvent.setup();
    (fetch as ReturnType<typeof vi.fn>).mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : String(input);
      if (url.includes("alias-proposals") && (!init || init.method == null)) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ meta: { count: 1 }, proposals: [aliasProposal] }),
        });
      }
      if (url.includes("alias-proposal-export") && init?.method === "POST") {
        return Promise.resolve({
          ok: false,
          status: 400,
          json: async () => ({ error: "No pending proposals found for given IDs" }),
        });
      }
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    });

    renderGovernance(<GovernancePage />);

    await waitFor(() => {
      expect(screen.getByTestId("governance-approve-promote")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("governance-approve-promote"));

    await waitFor(() => {
      expect(screen.getByTestId("governance-action-error")).toHaveTextContent(/Promotion failed/i);
    });
    expect(screen.queryByTestId("governance-api-flash")).not.toBeInTheDocument();
  });

  it("local Signals item: approve removes from pending queue and resolves investigation", async () => {
    const user = userEvent.setup();
    const signalKey = `ue:peanut-approve-${testIso}`;
    const clientRow = {
      id: signalKey,
      signalId: signalKey,
      entity: "Peanut",
      proposal: {
        signalId: signalKey,
        research: { aliases: [], classificationConfidence: 88 },
        classification: "new-entity",
        createdAt: 1,
        preview: { before: "a", after: "b" },
      },
      proposalType: "unknown-entity:new-entity",
      before: "a",
      after: "b",
      confidence: 88,
      status: "pending",
      createdAt: Date.now(),
    };
    sessionStorage.setItem("orch_governance_queue_v1", JSON.stringify([clientRow]));
    sessionStorage.setItem(
      "orch_investigation_v2",
      JSON.stringify({
        [signalKey]: {
          signalId: signalKey,
          status: "pending_governance",
          manualSelection: "new_entity",
          result: { aliases: [], classificationConfidence: 88 },
          proposalPreview: { before: "a", after: "b" },
          proposalPayload: {
            signalId: signalKey,
            research: {},
            classification: "new_entity",
            createdAt: 1,
            preview: { before: "a", after: "b" },
          },
          lastUpdatedAt: Date.now(),
        },
      })
    );

    (fetch as ReturnType<typeof vi.fn>).mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : String(input);
      if (url.includes("alias-proposals")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ meta: { count: 0 }, proposals: [] }),
        });
      }
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    });

    renderGovernance(<GovernancePage />);

    await waitFor(() => {
      expect(screen.getByTestId("governance-approve-promote")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("governance-approve-promote"));

    await waitFor(() => {
      expect(screen.getByTestId("governance-action-success")).toBeInTheDocument();
    });

    const stored = JSON.parse(sessionStorage.getItem("orch_governance_queue_v1") ?? "[]");
    expect(stored.find((r: { id: string }) => r.id === signalKey).status).toBe("approved");

    const inv = JSON.parse(sessionStorage.getItem("orch_investigation_v2") ?? "{}");
    expect(inv[signalKey].status).toBe("governance_approved");

    expect(mockPushEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "registry_promotion",
        metadata: expect.objectContaining({ signalId: signalKey }),
      })
    );
  });

  it("local Signals item: reject closes investigation and logs event", async () => {
    const user = userEvent.setup();
    const signalKey = `ue:reject-${testIso}`;
    const clientRow = {
      id: signalKey,
      signalId: signalKey,
      entity: "X",
      proposal: {
        signalId: signalKey,
        research: { aliases: [], classificationConfidence: 50 },
        classification: "new-entity",
        createdAt: 1,
        preview: { before: "a", after: "b" },
      },
      proposalType: "unknown-entity:new-entity",
      before: "a",
      after: "b",
      confidence: 50,
      status: "pending",
      createdAt: Date.now(),
    };
    sessionStorage.setItem("orch_governance_queue_v1", JSON.stringify([clientRow]));
    sessionStorage.setItem(
      "orch_investigation_v2",
      JSON.stringify({
        [signalKey]: {
          signalId: signalKey,
          status: "pending_governance",
          manualSelection: "new_entity",
          result: { aliases: [], classificationConfidence: 50 },
          proposalPreview: { before: "a", after: "b" },
          proposalPayload: {
            signalId: signalKey,
            research: {},
            classification: "new_entity",
            createdAt: 1,
            preview: { before: "a", after: "b" },
          },
          lastUpdatedAt: Date.now(),
        },
      })
    );

    (fetch as ReturnType<typeof vi.fn>).mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : String(input);
      if (url.includes("alias-proposals")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ meta: { count: 0 }, proposals: [] }),
        });
      }
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    });

    renderGovernance(<GovernancePage />);

    await waitFor(() => {
      expect(screen.getByTestId("governance-reject-close")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("governance-reject-close"));

    await waitFor(() => {
      expect(screen.getByTestId("governance-reject-success")).toBeInTheDocument();
    });

    const stored = JSON.parse(sessionStorage.getItem("orch_governance_queue_v1") ?? "[]");
    expect(stored.find((r: { id: string }) => r.id === signalKey).status).toBe("rejected");

    const inv = JSON.parse(sessionStorage.getItem("orch_investigation_v2") ?? "{}");
    expect(inv[signalKey].status).toBe("governance_rejected");

    expect(mockPushEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "governance_rejected",
      })
    );
  });

  it("rehydrates governance queue from investigation when queue storage was empty", async () => {
    const signalKey = `ue:rehydrate-${testIso}`;
    sessionStorage.setItem(
      "orch_investigation_v2",
      JSON.stringify({
        [signalKey]: {
          signalId: signalKey,
          status: "pending_governance",
          manualSelection: "new_entity",
          result: { aliases: [], classificationConfidence: 88 },
          proposalPreview: { before: "a", after: "b" },
          proposalPayload: {
            signalId: signalKey,
            research: {},
            classification: "new_entity",
            createdAt: 1,
            preview: { before: "a", after: "b" },
          },
          lastUpdatedAt: Date.now(),
        },
      })
    );

    (fetch as ReturnType<typeof vi.fn>).mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : String(input);
      if (url.includes("alias-proposals")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ meta: { count: 0 }, proposals: [] }),
        });
      }
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    });

    renderGovernance(<GovernancePage />);

    await waitFor(() => {
      expect(screen.getByTestId("governance-signal-review-desk")).toBeInTheDocument();
    });
    expect(screen.queryByText(/Registry is up to date/i)).not.toBeInTheDocument();
  });

  it("empty state copy when no pending work", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : String(input);
      if (url.includes("alias-proposals")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ meta: { count: 0 }, proposals: [] }),
        });
      }
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    });

    renderGovernance(<GovernancePage />);

    await waitFor(() => {
      expect(
        screen.getByText(/Registry is up to date\. No pending proposals require action\./i)
      ).toBeInTheDocument();
    });
  });

  it("registry reject calls dismiss endpoint", async () => {
    const user = userEvent.setup();
    const dismiss = vi.fn();
    (fetch as ReturnType<typeof vi.fn>).mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : String(input);
      if (url.includes("alias-proposals") && (!init || init.method == null)) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ meta: { count: 1 }, proposals: [aliasProposal] }),
        });
      }
      if (url.includes("alias-proposal-dismiss") && init?.method === "POST") {
        dismiss(JSON.parse(init.body as string));
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        });
      }
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    });

    renderGovernance(<GovernancePage />);

    await waitFor(() => {
      expect(screen.getByTestId("governance-reject-close")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("governance-reject-close"));

    await waitFor(() => {
      expect(dismiss).toHaveBeenCalledWith({ proposalId: aliasProposal.id });
    });
  });
});
