/**
 * Phase 21c/O5 – Registry Entry Card
 *
 * Displays a single registry entry with expandable aliases.
 * Supports drafting add/remove alias proposals.
 * O5: Inspect in Graph link.
 */

import { useState } from "react";
import { Link } from "react-router-dom";

interface RegistryEntryCardProps {
  id: string;
  type: string;
  aliases: string[];
  entityClass?: string;
  source?: string;
  matchedOn?: string;
  onProposeAdd: (alias: string) => Promise<void>;
  onProposeRemove: (alias: string) => Promise<void>;
  /** Phase O3: Optional selection callback for Context Panel */
  onSelect?: () => void;
  isSelected?: boolean;
}

export default function RegistryEntryCard({
  id,
  type,
  aliases,
  entityClass,
  source = "static",
  matchedOn,
  onProposeAdd,
  onProposeRemove,
  onSelect,
  isSelected = false,
}: RegistryEntryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [addAlias, setAddAlias] = useState("");
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleProposeAdd = async () => {
    const trimmed = addAlias.trim();
    if (!trimmed) return;
    setAdding(true);
    setMessage(null);
    try {
      await onProposeAdd(trimmed);
      setAddAlias("");
      setMessage({ type: "success", text: "Draft alias proposal created" });
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to create proposal",
      });
    } finally {
      setAdding(false);
    }
  };

  const handleProposeRemove = async (alias: string) => {
    setRemoving(alias);
    setMessage(null);
    try {
      await onProposeRemove(alias);
      setMessage({ type: "success", text: "Draft remove-alias proposal created" });
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to create proposal",
      });
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${
        isSelected ? "ring-2 ring-[#0F172A] ring-offset-1 border-[#0F172A] bg-gray-50" : "border-gray-200 bg-white"
      }`}
    >
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => {
          setExpanded(!expanded);
          onSelect?.();
        }}
      >
        <div>
          <span className="font-medium text-gray-900">{id}</span>
          {entityClass && (
            <span className="ml-2 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
              {entityClass}
            </span>
          )}
          {matchedOn && (
            <span className="ml-2 text-xs text-blue-600">Matched on: {matchedOn}</span>
          )}
        </div>
        <span className="text-sm text-gray-500">
          {aliases.length} alias{aliases.length !== 1 ? "es" : ""} · Source: {source}
        </span>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
          <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
            <span><strong>Canonical ID:</strong> {id}</span>
            {entityClass && <span><strong>Class:</strong> {entityClass}</span>}
            <span><strong>Alias count:</strong> {aliases.length}</span>
            <span><strong>Source:</strong> {source}</span>
          </div>
          <Link
            to={`/orchestrator/graph?entity=${encodeURIComponent(id)}`}
            className="inline-block text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            View Graph →
          </Link>
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Aliases</p>
            <div className="flex flex-wrap gap-2">
              {aliases.map((a) => (
                <span
                  key={a}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-50 text-sm text-gray-700"
                >
                  {a}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleProposeRemove(a);
                    }}
                    disabled={removing === a}
                    className="text-red-600 hover:text-red-800 text-xs ml-1"
                    title="Draft remove-alias proposal"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Draft alias proposal</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={addAlias}
                onChange={(e) => setAddAlias(e.target.value)}
                placeholder="New alias..."
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                onKeyDown={(e) => e.key === "Enter" && handleProposeAdd()}
              />
              <button
                type="button"
                onClick={handleProposeAdd}
                disabled={adding || !addAlias.trim()}
                className="rounded-lg px-4 py-2 text-sm font-medium bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {adding ? "..." : "Propose"}
              </button>
            </div>
          </div>

          {message && (
            <p
              className={`text-sm ${
                message.type === "success" ? "text-green-600" : "text-red-600"
              }`}
            >
              {message.text}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
