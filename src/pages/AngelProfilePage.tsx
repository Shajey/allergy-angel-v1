/**
 * Phase 9C+ – Profile Page (wired to Supabase via GET/PATCH /api/profile)
 *
 * Data contract:
 *   GET  /api/profile → { profile: { known_allergies: string[], current_medications: {name,dosage?}[], supplements: string[], ... } }
 *   PATCH /api/profile → body: { known_allergies?, current_medications?, supplements? } → { profile: ... }
 *
 * Maps UI categories to Supabase columns:
 *   allergy    → known_allergies (text[])
 *   medication → current_medications (jsonb array of {name, dosage?})
 *   supplement → supplements (text[])
 */

import { useEffect, useState, useCallback } from 'react';
import { useProfileContext } from '../context/ProfileContext';

type ItemType = 'medication' | 'supplement' | 'allergy';

interface Medication {
  name: string;
  dosage?: string;
  displayName?: string;
}

type AllergyItem = string | { name: string; displayName?: string };
type SupplementItem = string | { name: string; displayName?: string };

interface ProfileData {
  known_allergies: AllergyItem[];
  current_medications: Medication[];
  supplements: SupplementItem[];
}

function getDisplayName(item: string | { name: string; displayName?: string }): string {
  return typeof item === 'string' ? item : (item.displayName ?? item.name);
}
function getCanonicalName(item: string | { name: string; displayName?: string }): string {
  return typeof item === 'string' ? item : item.name;
}

export default function AngelProfilePage() {
  const { selectedProfileId } = useProfileContext();
  const [type, setType] = useState<ItemType>('medication');
  const [value, setValue] = useState('');
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // ── Fetch profile on mount (scoped to selected profile) ─────────
  useEffect(() => {
    if (!selectedProfileId) return;
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/profile?profileId=${encodeURIComponent(selectedProfileId)}`);
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? `HTTP ${res.status}`);
        }
        const json = await res.json();
        if (!cancelled) {
          setProfile({
            known_allergies: json.profile.known_allergies ?? [],
            current_medications: json.profile.current_medications ?? [],
            supplements: json.profile.supplements ?? [],
          });
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? 'Failed to load profile');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [selectedProfileId]);

  // ── Save helper (PATCH to Supabase) ────────────────────────────
  const saveProfile = useCallback(async (updates: Partial<ProfileData>) => {
    if (!selectedProfileId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/profile?profileId=${encodeURIComponent(selectedProfileId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `Save failed (HTTP ${res.status})`);
      }
      const json = await res.json();
      setProfile({
        known_allergies: json.profile.known_allergies ?? [],
        current_medications: json.profile.current_medications ?? [],
        supplements: json.profile.supplements ?? [],
      });
    } catch (err: any) {
      setError(err?.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [selectedProfileId]);

  // ── Add item ───────────────────────────────────────────────────
  const handleAdd = async () => {
    const trimmed = value.trim();
    if (!trimmed || !profile) return;

    if (type === 'allergy') {
      if (profile.known_allergies.some((a) => getCanonicalName(a).toLowerCase() === trimmed.toLowerCase())) return;
      await saveProfile({ known_allergies: [...profile.known_allergies, trimmed] });
    } else if (type === 'medication') {
      if (profile.current_medications.some((m) => m.name.toLowerCase() === trimmed.toLowerCase())) return;
      await saveProfile({ current_medications: [...profile.current_medications, { name: trimmed }] });
    } else {
      if (profile.supplements.some((s) => getCanonicalName(s).toLowerCase() === trimmed.toLowerCase())) return;
      await saveProfile({ supplements: [...profile.supplements, trimmed] });
    }

    setValue('');
  };

  // ── Remove item ────────────────────────────────────────────────
  const handleRemove = async (t: ItemType, itemValue: string) => {
    if (!profile) return;

    if (t === 'allergy') {
      await saveProfile({
        known_allergies: profile.known_allergies.filter(
          (a) => getDisplayName(a).toLowerCase() !== itemValue.toLowerCase()
        ),
      });
    } else if (t === 'medication') {
      await saveProfile({
        current_medications: profile.current_medications.filter(
          (m) => (m.displayName ?? m.name).toLowerCase() !== itemValue.toLowerCase()
        ),
      });
    } else {
      await saveProfile({
        supplements: profile.supplements.filter(
          (s) => getDisplayName(s).toLowerCase() !== itemValue.toLowerCase()
        ),
      });
    }
  };

  // ── Build display lists ────────────────────────────────────────
  const grouped = profile
    ? {
        medication: profile.current_medications.map((m) =>
          (m.displayName ?? m.name) + (m.dosage ? ` (${m.dosage})` : '')
        ),
        supplement: profile.supplements.map(getDisplayName),
        allergy: profile.known_allergies.map(getDisplayName),
      }
    : { medication: [], supplement: [], allergy: [] };

  const canAdd = value.trim().length > 0 && !saving;

  // ── Render ─────────────────────────────────────────────────────
  if (!selectedProfileId) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <p className="text-sm text-gray-500">Select a profile to manage.</p>
      </div>
    );
  }
  if (loading) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <p className="text-sm text-gray-500">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 max-w-xl mx-auto">
      <h1 className="text-xl font-semibold text-gray-900">Profile</h1>
      <p className="text-sm text-gray-500 mt-0.5">
        Add what you take regularly to improve risk detection.
      </p>

      {error && (
        <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Add */}
      <div className="mt-6 aa-soft-card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ItemType)}
            className="rounded-2xl border border-gray-200 px-4 py-3 text-base text-gray-900 focus:border-gray-400 focus:outline-none"
          >
            <option value="medication">Medication</option>
            <option value="supplement">Supplement</option>
            <option value="allergy">Allergy</option>
          </select>

          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
            placeholder={type === 'allergy' ? 'e.g. peanuts' : 'e.g. metformin'}
            className="flex-1 rounded-2xl border border-gray-200 px-4 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none"
          />

          <button
            onClick={handleAdd}
            disabled={!canAdd}
            className={`rounded-2xl px-4 py-3 text-base font-semibold transition-colors ${
              canAdd
                ? 'bg-gray-900 text-white hover:bg-gray-800'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {saving ? 'Saving...' : 'Add'}
          </button>
        </div>
      </div>

      {/* Lists — distinct card clusters */}
      <div className="mt-6 flex flex-col gap-6">
        {(['medication', 'supplement', 'allergy'] as ItemType[]).map((t) => {
          const items = grouped[t];
          return (
            <div key={t} className="aa-soft-card p-6">
              <h2 className="text-base font-semibold text-gray-900 capitalize">{t}s</h2>
              {items.length === 0 ? (
                <p className="mt-4 text-sm text-gray-500">None added yet.</p>
              ) : (
                <ul className="mt-4 flex flex-col gap-4">
                  {items.map((display) => {
                    const rawName = t === 'medication'
                      ? display.replace(/\s*\(.*\)$/, '')
                      : display;
                    return (
                      <li
                        key={`${t}:${display}`}
                        className="flex items-center justify-between rounded-2xl border border-gray-100 bg-gray-50/50 px-4 py-3"
                      >
                        <div className="text-sm text-gray-900">{display}</div>
                        <button
                          onClick={() => handleRemove(t, rawName)}
                          disabled={saving}
                          className="text-sm text-slate-500 hover:text-slate-700 disabled:opacity-50 transition-colors"
                        >
                          Remove
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
