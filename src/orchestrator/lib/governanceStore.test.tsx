/**
 * Client governance queue — add semantics and persistence.
 */

import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import type { StoredProposalPayload } from "./investigationTypes";
import { GovernanceStoreProvider, useGovernanceStore } from "./governanceStore";

const STORAGE_KEY = "orch_governance_queue_v1";

function makePayload(signalId: string): StoredProposalPayload {
  return {
    signalId,
    research: { aliases: ["a"], classificationConfidence: 80 },
    classification: "new-entity",
    createdAt: 1,
    preview: { before: "before", after: "after" },
  };
}

function wrapper({ children }: { children: React.ReactNode }) {
  return <GovernanceStoreProvider>{children}</GovernanceStoreProvider>;
}

describe("useGovernanceStore", () => {
  beforeEach(() => {
    sessionStorage.removeItem(STORAGE_KEY);
  });

  it("add enqueues a pending item and persists to sessionStorage", () => {
    const { result } = renderHook(() => useGovernanceStore(), { wrapper });
    const payload = makePayload("sig-1");

    act(() => {
      result.current.add({
        id: "sig-1",
        signalId: "sig-1",
        entity: "Peanut",
        proposal: payload,
        proposalType: "unknown-entity:new-entity",
        before: payload.preview.before,
        after: payload.preview.after,
        confidence: 82,
        status: "pending",
        createdAt: Date.now(),
      });
    });

    expect(result.current.proposals).toHaveLength(1);
    expect(result.current.proposals[0].entity).toBe("Peanut");
    expect(result.current.proposals[0].before).toBe("before");
    const raw = sessionStorage.getItem(STORAGE_KEY);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!)).toHaveLength(1);
  });

  it("add replaces an existing pending row with the same id", () => {
    const { result } = renderHook(() => useGovernanceStore(), { wrapper });

    act(() => {
      result.current.add({
        id: "sig-1",
        signalId: "sig-1",
        entity: "First",
        proposal: makePayload("sig-1"),
        proposalType: "unknown-entity:new-entity",
        before: "b1",
        after: "a1",
        confidence: 50,
        status: "pending",
        createdAt: 100,
      });
    });

    act(() => {
      result.current.add({
        id: "sig-1",
        signalId: "sig-1",
        entity: "Second",
        proposal: makePayload("sig-1"),
        proposalType: "unknown-entity:alias",
        before: "b2",
        after: "a2",
        confidence: 90,
        status: "pending",
        createdAt: 200,
      });
    });

    expect(result.current.proposals).toHaveLength(1);
    expect(result.current.proposals[0].entity).toBe("Second");
    expect(result.current.proposals[0].confidence).toBe(90);
    expect(result.current.proposals[0].before).toBe("b2");
  });
});
