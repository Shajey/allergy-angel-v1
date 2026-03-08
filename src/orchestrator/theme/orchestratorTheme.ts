/**
 * Phase O1 – Orchestrator Theme
 * AA-Orchestrator-Precision: clinical, analytical, precise, quiet authority
 */

export const orchestratorTheme = {
  identity: "AA-Orchestrator-Precision",
  colors: {
    background: "#F8FAFC",
    surface: "#FFFFFF",
    primary: {
      main: "#0F172A",
      accentGradient: "linear-gradient(135deg, #FF9B9B 0%, #FFB382 100%)",
    },
    status: {
      emerging: "#EF4444",
      mostlySafe: "#10B981",
      investigate: "#F59E0B",
      insufficient: "#94A3B8",
    },
    border: "#E2E8F0",
  },
  typography: {
    fontPrimary: "Inter, system-ui, sans-serif",
    fontData: "JetBrains Mono, monospace",
    title: "22px",
    section: "18px",
    body: "14px",
    data: "13px",
  },
  radius: "12px",
  border: "1px solid #E2E8F0",
  shadow: "0 1px 3px rgba(0,0,0,0.06)",
} as const;

export type OrchestratorTheme = typeof orchestratorTheme;
