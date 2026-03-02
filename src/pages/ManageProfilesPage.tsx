/**
 * Phase 16 – Manage Profiles page
 *
 * List, add, edit, delete profiles. Set primary.
 */

import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useProfileContext } from "../context/ProfileContext";
import type { Profile } from "../context/ProfileContext";

export default function ManageProfilesPage() {
  const { profiles, selectedProfileId, setSelectedProfileId, refetch } = useProfileContext();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = useCallback(async () => {
    const name = newName.trim();
    if (!name || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const json = await res.json();
      setNewName("");
      setAdding(false);
      await refetch();
      setSelectedProfileId(json.profile?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add profile");
    } finally {
      setSaving(false);
    }
  }, [newName, saving, refetch, setSelectedProfileId]);

  const handleUpdate = useCallback(
    async (id: string, display_name?: string, is_primary?: boolean) => {
      if (saving) return;
      setSaving(true);
      setError(null);
      try {
        const url = new URL("/api/profile", window.location.origin);
        url.searchParams.set("id", id);
        const body: Record<string, unknown> = {};
        if (display_name !== undefined) body.display_name = display_name;
        if (is_primary !== undefined) body.is_primary = is_primary;

        const res = await fetch(url.toString(), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error ?? `HTTP ${res.status}`);
        }
        setEditingId(null);
        setEditName("");
        await refetch();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update");
      } finally {
        setSaving(false);
      }
    },
    [saving, refetch]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (saving || !window.confirm("Delete this profile? This cannot be undone.")) return;
      setSaving(true);
      setError(null);
      try {
        const url = new URL("/api/profile", window.location.origin);
        url.searchParams.set("id", id);
        const res = await fetch(url.toString(), { method: "DELETE" });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error ?? `HTTP ${res.status}`);
        }
        await refetch();
        if (selectedProfileId === id) {
          const remaining = profiles.filter((p) => p.id !== id);
          setSelectedProfileId(remaining[0]?.id ?? null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete");
      } finally {
        setSaving(false);
      }
    },
    [saving, profiles, selectedProfileId, refetch, setSelectedProfileId]
  );

  const startEdit = (p: Profile) => {
    setEditingId(p.id);
    setEditName(p.display_name);
  };

  return (
    <div className="p-6 max-w-xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Manage Profiles</h1>
        <Link
          to="/profile"
          className="text-sm text-emerald-600 hover:text-emerald-700"
        >
          Back to Profile
        </Link>
      </div>
      <p className="text-sm text-gray-500 mt-2">
        Each profile has its own allergies, medications, and check history.
      </p>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Add new */}
      <div className="mt-6 rounded-md border border-gray-200 bg-white p-4">
        {adding ? (
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Profile name"
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
                if (e.key === "Escape") setAdding(false);
              }}
            />
            <button
              onClick={handleAdd}
              disabled={!newName.trim() || saving}
              className="rounded-md px-4 py-2 text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              Add
            </button>
            <button
              onClick={() => { setAdding(false); setNewName(""); }}
              className="rounded-md px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
          >
            + Add new profile
          </button>
        )}
      </div>

      {/* List */}
      <ul className="mt-6 space-y-3">
        {profiles.map((p) => (
          <li
            key={p.id}
            className="rounded-md border border-gray-200 bg-white p-4 flex items-center justify-between gap-4"
          >
            {editingId === p.id ? (
              <div className="flex-1 flex gap-2">
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleUpdate(p.id, editName.trim());
                    if (e.key === "Escape") setEditingId(null);
                  }}
                />
                <button
                  onClick={() => handleUpdate(p.id, editName.trim())}
                  disabled={saving}
                  className="rounded-md px-3 py-2 text-sm bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="rounded-md px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <>
                <div className="min-w-0 flex-1">
                  <span className="font-medium">{p.display_name}</span>
                  {p.is_primary && (
                    <span className="ml-2 text-xs text-gray-500">(primary)</span>
                  )}
                  {selectedProfileId === p.id && (
                    <span className="ml-2 text-xs text-emerald-600">(active)</span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!p.is_primary && (
                    <button
                      onClick={() => handleUpdate(p.id, undefined, true)}
                      disabled={saving}
                      className="text-xs text-gray-600 hover:text-gray-900"
                    >
                      Set primary
                    </button>
                  )}
                  <button
                    onClick={() => startEdit(p)}
                    disabled={saving}
                    className="text-xs text-emerald-600 hover:text-emerald-700"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    disabled={saving || profiles.length <= 1}
                    className="text-xs text-red-600 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Delete
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
