import { useEffect, useMemo, useState } from 'react';
import type { ProfileItemType } from '@/types/spec';
import { addProfileItem, loadProfile, removeProfileItem } from '@/lib/profileStore';

export default function AngelProfilePage() {
  const [type, setType] = useState<ProfileItemType>('medication');
  const [value, setValue] = useState('');
  const [profile, setProfile] = useState(loadProfile());

  useEffect(() => {
    const onChange = () => setProfile(loadProfile());
    window.addEventListener('profile-changed', onChange);
    return () => window.removeEventListener('profile-changed', onChange);
  }, []);

  const grouped = useMemo(() => {
    return {
      medication: profile.items.filter((i) => i.type === 'medication'),
      supplement: profile.items.filter((i) => i.type === 'supplement'),
      allergy: profile.items.filter((i) => i.type === 'allergy'),
    };
  }, [profile.items]);

  const canAdd = value.trim().length > 0;

  const handleAdd = () => {
    if (!canAdd) return;
    const next = addProfileItem(type, value, 'manual');
    setProfile(next);
    setValue('');
  };

  const handleRemove = (t: ProfileItemType, normalizedValue: string) => {
    const next = removeProfileItem(t, normalizedValue);
    setProfile(next);
  };

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-xl font-semibold">Profile</h1>
      <p className="text-sm text-muted-foreground mt-2">
        Add what you take regularly to improve confidence.
      </p>

      {/* Add */}
      <div className="mt-6 rounded-md border border-gray-200 p-4 bg-white">
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ProfileItemType)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="medication">Medication</option>
            <option value="supplement">Supplement</option>
            <option value="allergy">Allergy</option>
          </select>

          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={type === 'allergy' ? 'e.g. peanuts' : 'e.g. metformin'}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />

          <button
            onClick={handleAdd}
            disabled={!canAdd}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              canAdd ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-gray-200 text-gray-500 cursor-not-allowed'
            }`}
          >
            Add
          </button>
        </div>
      </div>

      {/* Lists */}
      <div className="mt-6 space-y-6">
        {(['medication', 'supplement', 'allergy'] as ProfileItemType[]).map((t) => {
          const items = grouped[t];
          return (
            <div key={t}>
              <h2 className="text-sm font-semibold text-gray-900 capitalize">{t}s</h2>
              {items.length === 0 ? (
                <p className="mt-2 text-sm text-gray-500">None added yet.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {items.map((it) => (
                    <li
                      key={`${it.type}:${it.normalizedValue}`}
                      className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2"
                    >
                      <div className="text-sm text-gray-900">{it.value}</div>
                      <button
                        onClick={() => handleRemove(it.type, it.normalizedValue ?? it.value.toLowerCase())}
                        className="text-sm text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
