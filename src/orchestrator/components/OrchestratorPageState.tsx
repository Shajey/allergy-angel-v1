/**
 * Phase O3.1 – Orchestrator Page State
 * Standardized loading, error, empty, and success states.
 */

import type { ReactNode } from "react";

export type PageState = "loading" | "empty" | "error" | "success";

interface OrchestratorPageStateProps {
  state: PageState;
  pageName: string;
  errorMessage?: string | null;
  emptyMessage?: string;
  onRetry?: () => void;
  children: ReactNode;
}

function ErrorPanel({
  pageName,
  message,
  onRetry,
}: {
  pageName: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-6">
      <h2 className="text-base font-semibold text-[#991B1B]">Unable to load {pageName} data</h2>
      <p className="mt-2 text-sm text-[#B91C1C]">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-lg bg-[#DC2626] px-4 py-2 text-sm font-medium text-white hover:bg-[#B91C1C]"
        >
          Retry
        </button>
      )}
      <p className="mt-3 text-xs text-[#94A3B8]">
        Check that migrations are applied and ADMIN_ENABLED=true if using admin features.
      </p>
    </div>
  );
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="rounded-lg border-2 border-dashed border-[#E2E8F0] bg-[#F8FAFC] p-6 text-center">
      <p className="text-sm text-[#64748B]">{message}</p>
    </div>
  );
}

function LoadingPanel({ pageName }: { pageName: string }) {
  return (
    <div className="rounded-lg border border-[#E2E8F0] bg-white p-6">
      <p className="text-sm text-[#64748B]">Loading {pageName}…</p>
    </div>
  );
}

export default function OrchestratorPageState({
  state,
  pageName,
  errorMessage,
  emptyMessage,
  onRetry,
  children,
}: OrchestratorPageStateProps) {
  if (state === "loading") {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <LoadingPanel pageName={pageName} />
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <ErrorPanel
          pageName={pageName}
          message={errorMessage ?? "An unexpected error occurred"}
          onRetry={onRetry}
        />
      </div>
    );
  }

  if (state === "empty") {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <EmptyPanel message={emptyMessage ?? `No ${pageName.toLowerCase()} data yet.`} />
      </div>
    );
  }

  return <>{children}</>;
}
