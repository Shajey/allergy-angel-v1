/**
 * Phase O1 – Orchestrator Shell Render Tests
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { OrchestratorThemeProvider } from "./theme/OrchestratorThemeProvider";
import OrchestratorShell from "./layout/OrchestratorShell";
import ResearchWorkspacePage from "./pages/ResearchWorkspacePage";

describe("OrchestratorShell", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
  });

  it("renders Command Bar when navigating to orchestrator route", () => {
    render(
      <MemoryRouter initialEntries={["/orchestrator/research"]}>
        <OrchestratorThemeProvider>
          <Routes>
            <Route path="orchestrator" element={<OrchestratorShell />}>
              <Route path="research" element={<ResearchWorkspacePage />} />
            </Route>
          </Routes>
        </OrchestratorThemeProvider>
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: /AA.*Orchestrator/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Radar$/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Registry$/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Research$/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Ingestion$/ })).toBeInTheDocument();
  });

  it("renders Research page content inside shell", () => {
    render(
      <MemoryRouter initialEntries={["/orchestrator/research"]}>
        <OrchestratorThemeProvider>
          <Routes>
            <Route path="orchestrator" element={<OrchestratorShell />}>
              <Route path="research" element={<ResearchWorkspacePage />} />
            </Route>
          </Routes>
        </OrchestratorThemeProvider>
      </MemoryRouter>
    );

    expect(screen.getByText(/No research target selected/)).toBeInTheDocument();
  });
});
