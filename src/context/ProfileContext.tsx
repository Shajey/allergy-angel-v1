/**
 * Phase 16 – Multi-profile foundation
 *
 * Provides selected profile state and list of profiles.
 * Persists selected profile ID to localStorage (allergyangel_selected_profile).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "allergyangel_selected_profile";

export interface Profile {
  id: string;
  display_name: string;
  known_allergies: string[];
  current_medications: unknown[];
  supplements: string[];
  is_primary?: boolean;
  created_at: string;
  updated_at?: string;
}

interface ProfileContextValue {
  profiles: Profile[];
  selectedProfileId: string | null;
  setSelectedProfileId: (id: string | null) => void;
  selectedProfile: Profile | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfileId, setSelectedProfileIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/profile?action=list");
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const json = await res.json();
      const list = json.profiles ?? [];
      setProfiles(list);

      // Restore from localStorage or pick primary
      const stored = localStorage.getItem(STORAGE_KEY);
      const storedId = stored?.trim() || null;
      const validStored = storedId && list.some((p: Profile) => p.id === storedId);
      const primary = list.find((p: Profile) => p.is_primary);
      const fallback = primary?.id ?? list[0]?.id ?? null;

      const nextId = validStored ? storedId : fallback;
      setSelectedProfileIdState(nextId);
      if (nextId) {
        localStorage.setItem(STORAGE_KEY, nextId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load profiles");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const setSelectedProfileId = useCallback((id: string | null) => {
    setSelectedProfileIdState(id);
    if (id) {
      localStorage.setItem(STORAGE_KEY, id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const selectedProfile = useMemo(() => {
    if (!selectedProfileId) return null;
    return profiles.find((p) => p.id === selectedProfileId) ?? null;
  }, [profiles, selectedProfileId]);

  const value: ProfileContextValue = useMemo(
    () => ({
      profiles,
      selectedProfileId,
      setSelectedProfileId,
      selectedProfile,
      loading,
      error,
      refetch,
    }),
    [
      profiles,
      selectedProfileId,
      setSelectedProfileId,
      selectedProfile,
      loading,
      error,
      refetch,
    ]
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfileContext(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error("useProfileContext must be used within ProfileProvider");
  }
  return ctx;
}
