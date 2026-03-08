/**
 * Phase O1 – Orchestrator Theme Provider
 * Wraps Orchestrator routes with AA-Orchestrator-Precision theme.
 * Does not affect AA consumer routes.
 */

import { createContext, useContext, type ReactNode } from "react";
import { orchestratorTheme, type OrchestratorTheme } from "./orchestratorTheme";

const OrchestratorThemeContext = createContext<OrchestratorTheme | null>(null);

export function OrchestratorThemeProvider({ children }: { children: ReactNode }) {
  return (
    <OrchestratorThemeContext.Provider value={orchestratorTheme}>
      <div
        className="orch-theme"
        style={{
          // Inject theme as CSS custom properties for components that need them
          ["--orch-bg" as string]: orchestratorTheme.colors.background,
          ["--orch-surface" as string]: orchestratorTheme.colors.surface,
          ["--orch-primary" as string]: orchestratorTheme.colors.primary.main,
          ["--orch-border" as string]: orchestratorTheme.colors.border,
          ["--orch-status-emerging" as string]: orchestratorTheme.colors.status.emerging,
          ["--orch-status-safe" as string]: orchestratorTheme.colors.status.mostlySafe,
          ["--orch-status-investigate" as string]: orchestratorTheme.colors.status.investigate,
          ["--orch-status-insufficient" as string]: orchestratorTheme.colors.status.insufficient,
          fontFamily: orchestratorTheme.typography.fontPrimary,
          backgroundColor: orchestratorTheme.colors.background,
          minHeight: "100%",
        }}
      >
        {children}
      </div>
    </OrchestratorThemeContext.Provider>
  );
}

export function useOrchestratorTheme(): OrchestratorTheme {
  const theme = useContext(OrchestratorThemeContext);
  if (!theme) {
    throw new Error("useOrchestratorTheme must be used within OrchestratorThemeProvider");
  }
  return theme;
}
