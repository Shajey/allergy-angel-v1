import { describe, expect, it } from "vitest";
import {
  activityWorkspaceRoute,
  isResolvedOnlyDecision,
  orchestratorDraftTarget,
} from "./orchestratorDraftTarget";

describe("orchestratorDraftTarget", () => {
  it("ingestion candidate navigates to ingestion with candidateId", () => {
    const url = orchestratorDraftTarget({
      kind: "ingestion-candidate",
      candidateId: "c-1",
      name: "Foo",
    });
    expect(url).toContain("candidateId=c-1");
    expect(url).toContain("/orchestrator/ingestion");
  });

  it("unknown entity uses research URL", () => {
    const url = orchestratorDraftTarget({
      kind: "unknown-entity",
      entity: "X",
      entityType: "drug",
    });
    expect(url).toContain("/orchestrator/research");
  });
});

describe("isResolvedOnlyDecision", () => {
  it("treats dismiss as resolved-only", () => {
    expect(
      isResolvedOnlyDecision(
        { kind: "unknown-entity", entity: "a" },
        "dismiss"
      )
    ).toBe(true);
  });

  it("registry none is resolved-only", () => {
    expect(
      isResolvedOnlyDecision(
        { kind: "registry-entity", canonicalId: "drug:x" },
        "none"
      )
    ).toBe(true);
  });

  it("registry verify is not resolved-only", () => {
    expect(
      isResolvedOnlyDecision(
        { kind: "registry-entity", canonicalId: "drug:x" },
        "verify"
      )
    ).toBe(false);
  });
});

describe("activityWorkspaceRoute", () => {
  it("maps event types to routes", () => {
    expect(
      activityWorkspaceRoute({
        kind: "activity",
        title: "t",
        eventType: "research",
      })
    ).toBe("/orchestrator/research");
  });
});
