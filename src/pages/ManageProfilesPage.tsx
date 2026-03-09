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
    <div className="px-4 py-6 max-w-xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Manage Profiles</h1>
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
        <div className="mt-4 aa-soft-card border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Add new */}
      <div className="mt-6 aa-soft-card p-6">
        {adding ? (
          <div className="flex flex-col sm:flex-row gap-4">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Profile name"
              className="flex-1 rounded-2xl border border-gray-200 px-4 py-3 text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
                if (e.key === "Escape") setAdding(false);
              }}
            />
            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                disabled={!newName.trim() || saving}
                className="rounded-2xl px-4 py-3 text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Add
              </button>
              <button
                onClick={() => { setAdding(false); setNewName(""); }}
                className="rounded-2xl px-4 py-3 text-sm text-slate-500 hover:text-slate-700 hover:bg-gray-100"
              >
                Cancel
              </button>
            </div>
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
      <ul className="mt-6 flex flex-col gap-4">
        {profiles.map((p) => (
          <li
            key={p.id}
            className={`aa-soft-card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
              selectedProfileId === p.id ? "ring-2 ring-[#0F172A] ring-offset-2" : ""
            }`}
          >
            {editingId === p.id ? (
              <div className="flex-1 flex flex-col sm:flex-row gap-4">
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex-1 rounded-2xl border border-gray-200 px-4 py-3 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleUpdate(p.id, editName.trim());
                    if (e.key === "Escape") setEditingId(null);
                  }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleUpdate(p.id, editName.trim())}
                    disabled={saving}
                    className="rounded-2xl px-4 py-3 text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="rounded-2xl px-4 py-3 text-sm text-slate-500 hover:text-slate-700 hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="min-w-0 flex-1">
                  <span className="font-semibold text-gray-900">{p.display_name}</span>
                  {p.is_primary && (
                    <span className="ml-2 text-xs text-gray-500">(primary)</span>
                  )}
                  {selectedProfileId === p.id && (
                    <span className="ml-2 text-xs font-medium text-[#0F172A]">(active)</span>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {!p.is_primary && (
                    <button
                      onClick={() => handleUpdate(p.id, undefined, true)}
                      disabled={saving}
                      className="text-sm text-slate-500 hover:text-slate-700"
                    >
                      Set primary
                    </button>
                  )}
                  <button
                    onClick={() => startEdit(p)}
                    disabled={saving}
                    className="text-sm text-slate-600 hover:text-slate-800"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    disabled={saving || profiles.length <= 1}
                    className="text-sm text-slate-500 hover:text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
