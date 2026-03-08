/**
 * Phase 21c – Pending Proposal Panel
 *
 * Lists pending alias proposals with dismiss and export actions.
 */

interface Proposal {
  id: string;
  registry_type: string;
  canonical_id: string;
  proposed_alias: string;
  proposal_action: string;
  status: string;
  created_at: string;
}

interface PendingProposalPanelProps {
  proposals: Proposal[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onDismiss: (id: string) => Promise<void>;
  onExport: (ids: string[]) => Promise<void>;
  loading?: boolean;
}

export default function PendingProposalPanel({
  proposals,
  selectedIds,
  onToggleSelect,
  onDismiss,
  onExport,
  loading = false,
}: PendingProposalPanelProps) {
  const selected = Array.from(selectedIds);
  const canExport = selected.length > 0;

  const handleExport = async () => {
    if (!canExport) return;
    await onExport(selected);
  };

  if (proposals.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 text-center">
        <p className="text-sm text-gray-500">No pending alias proposals.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="px-4 py-3 bg-amber-50 border-b border-amber-100">
        <p className="text-sm font-medium text-amber-800">
          Draft alias proposals — not live. Export for PR Packager.
        </p>
      </div>
      <div className="divide-y divide-gray-100">
        {proposals.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
          >
            <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
              <input
                type="checkbox"
                checked={selectedIds.has(p.id)}
                onChange={() => onToggleSelect(p.id)}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-900 truncate">
                {p.proposal_action === "add-alias" ? "+" : "−"} {p.registry_type}/{p.canonical_id} → {p.proposed_alias}
              </span>
            </label>
            <button
              type="button"
              onClick={() => onDismiss(p.id)}
              disabled={loading}
              className="text-sm text-gray-500 hover:text-red-600 ml-2"
            >
              Dismiss
            </button>
          </div>
        ))}
      </div>
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
        <button
          type="button"
          onClick={handleExport}
          disabled={!canExport || loading}
          className="rounded-lg px-4 py-2 text-sm font-medium bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Export {selected.length > 0 ? `(${selected.length})` : ""} to JSON
        </button>
      </div>
    </div>
  );
}
