// src/lib/profileStore.ts
import type { Profile, ProfileItem, ProfileItemType } from '@/types/spec';

const PROFILE_KEY = 'allergyangel_profile';

export function loadProfile(): Profile {
  const now = new Date().toISOString();
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return { items: [], updatedAt: now };
    const parsed = JSON.parse(raw) as Profile;
    if (!parsed?.items || !Array.isArray(parsed.items)) return { items: [], updatedAt: now };
    return { ...parsed, updatedAt: parsed.updatedAt ?? now };
  } catch {
    return { items: [], updatedAt: now };
  }
}

export function saveProfile(profile: Profile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  window.dispatchEvent(new Event('profile-changed'));
}

function normalizeValue(v: string): string {
  return v.trim().toLowerCase();
}

export function addProfileItem(type: ProfileItemType, value: string, source: ProfileItem['source'] = 'manual'): Profile {
  const profile = loadProfile();
  const now = new Date().toISOString();
  const normalizedValue = normalizeValue(value);
  if (!normalizedValue) return profile;

  const exists = profile.items.some(
    (it) => it.type === type && (it.normalizedValue ?? normalizeValue(it.value)) === normalizedValue
  );

  if (exists) return profile;

  const item: ProfileItem = {
    type,
    value: value.trim(),
    normalizedValue,
    source,
    confirmed: true,
    updatedAt: now,
  };

  const next: Profile = {
    items: [item, ...profile.items],
    updatedAt: now,
  };

  saveProfile(next);
  return next;
}

export function removeProfileItem(type: ProfileItemType, normalizedValue: string): Profile {
  const profile = loadProfile();
  const now = new Date().toISOString();

  const next: Profile = {
    items: profile.items.filter(
      (it) => !(it.type === type && (it.normalizedValue ?? normalizeValue(it.value)) === normalizedValue)
    ),
    updatedAt: now,
  };

  saveProfile(next);
  return next;
}
