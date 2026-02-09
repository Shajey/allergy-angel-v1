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

type ItemType = 'medication' | 'supplement' | 'allergy';

interface Medication {
  name: string;
  dosage?: string;
}

interface ProfileData {
  known_allergies: string[];
  current_medications: Medication[];
  supplements: string[];
}

export default function AngelProfilePage() {
  const [type, setType] = useState<ItemType>('medication');
  const [value, setValue] = useState('');
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // ── Fetch profile on mount ─────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/profile');
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
  }, []);

  // ── Save helper (PATCH to Supabase) ────────────────────────────
  const saveProfile = useCallback(async (updates: Partial<ProfileData>) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/profile', {
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
  }, []);

  // ── Add item ───────────────────────────────────────────────────
  const handleAdd = async () => {
    const trimmed = value.trim();
    if (!trimmed || !profile) return;

    if (type === 'allergy') {
      if (profile.known_allergies.some((a) => a.toLowerCase() === trimmed.toLowerCase())) return;
      await saveProfile({ known_allergies: [...profile.known_allergies, trimmed] });
    } else if (type === 'medication') {
      if (profile.current_medications.some((m) => m.name.toLowerCase() === trimmed.toLowerCase())) return;
      await saveProfile({ current_medications: [...profile.current_medications, { name: trimmed }] });
    } else {
      if (profile.supplements.some((s) => s.toLowerCase() === trimmed.toLowerCase())) return;
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
          (a) => a.toLowerCase() !== itemValue.toLowerCase()
        ),
      });
    } else if (t === 'medication') {
      await saveProfile({
        current_medications: profile.current_medications.filter(
          (m) => m.name.toLowerCase() !== itemValue.toLowerCase()
        ),
      });
    } else {
      await saveProfile({
        supplements: profile.supplements.filter(
          (s) => s.toLowerCase() !== itemValue.toLowerCase()
        ),
      });
    }
  };

  // ── Build display lists ────────────────────────────────────────
  const grouped = profile
    ? {
        medication: profile.current_medications.map((m) => m.name + (m.dosage ? ` (${m.dosage})` : '')),
        supplement: profile.supplements,
        allergy: profile.known_allergies,
      }
    : { medication: [], supplement: [], allergy: [] };

  const canAdd = value.trim().length > 0 && !saving;

  // ── Render ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <p className="text-sm text-gray-500">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-xl font-semibold">Profile</h1>
      <p className="text-sm text-gray-500 mt-2">
        Add what you take regularly to improve risk detection.
      </p>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Add */}
      <div className="mt-6 rounded-md border border-gray-200 p-4 bg-white">
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ItemType)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
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
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />

          <button
            onClick={handleAdd}
            disabled={!canAdd}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              canAdd
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
            }`}
          >
            {saving ? 'Saving...' : 'Add'}
          </button>
        </div>
      </div>

      {/* Lists */}
      <div className="mt-6 space-y-6">
        {(['medication', 'supplement', 'allergy'] as ItemType[]).map((t) => {
          const items = grouped[t];
          return (
            <div key={t}>
              <h2 className="text-sm font-semibold text-gray-900 capitalize">{t}s</h2>
              {items.length === 0 ? (
                <p className="mt-2 text-sm text-gray-500">None added yet.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {items.map((display) => {
                    // For medications with dosage like "Zyrtec (10mg)", extract just the name for removal
                    const rawName = t === 'medication'
                      ? display.replace(/\s*\(.*\)$/, '')
                      : display;
                    return (
                      <li
                        key={`${t}:${display}`}
                        className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2"
                      >
                        <div className="text-sm text-gray-900">{display}</div>
                        <button
                          onClick={() => handleRemove(t, rawName)}
                          disabled={saving}
                          className="text-sm text-red-600 hover:underline disabled:opacity-50"
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
