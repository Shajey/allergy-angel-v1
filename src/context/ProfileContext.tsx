/**
 * Phase 16 – Multi-profile foundation
 * Phase 21b – isItemInProfile uses canonical matching via entity resolver
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
import {
  preloadAliasMap,
  resolveEntitySync,
} from "@/lib/entityResolver";

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
  /** Phase 19: Check if medication/supplement/allergy is already in profile */
  isItemInProfile: (
    type: "medication" | "supplement" | "allergy",
    name: string
  ) => boolean;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfileId, setSelectedProfileIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aliasMap, setAliasMap] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    preloadAliasMap()
      .then(setAliasMap)
      .catch(() => {});
  }, []);

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

  const isItemInProfile = useCallback(
    (type: "medication" | "supplement" | "allergy", name: string): boolean => {
      const profile = selectedProfile ?? profiles[0];
      if (!profile) return false;

      const map = aliasMap ?? {};
      const { canonical: inputCanonical } = resolveEntitySync(name, map);
      const inputNorm = name.toLowerCase().trim();

      const getProfileCanonical = (item: string | { name?: string; displayName?: string }) => {
        const raw = typeof item === "string" ? item : String(item?.name ?? "");
        const { canonical } = resolveEntitySync(raw, map);
        return canonical;
      };

      switch (type) {
        case "medication": {
          const meds = (profile.current_medications ?? []) as { name?: string; displayName?: string }[];
          return meds.some((m) => {
            const medCanon = getProfileCanonical(m);
            const medRaw = String(m?.name ?? "").toLowerCase().trim();
            return medCanon === inputCanonical || medRaw === inputNorm;
          });
        }
        case "supplement": {
          const supps = (profile.supplements ?? []) as (string | { name: string; displayName?: string })[];
          return supps.some((s) => {
            const suppCanon = getProfileCanonical(s);
            const suppRaw = (typeof s === "string" ? s : s?.name ?? "").toLowerCase().trim();
            return suppCanon === inputCanonical || suppRaw === inputNorm;
          });
        }
        case "allergy": {
          const allergies = (profile.known_allergies ?? []) as (string | { name: string; displayName?: string })[];
          return allergies.some((a) => {
            const aCanon = getProfileCanonical(a);
            const aRaw = (typeof a === "string" ? a : a?.name ?? "").toLowerCase().trim();
            return aCanon === inputCanonical || aRaw === inputNorm;
          });
        }
        default:
          return false;
      }
    },
    [selectedProfile, profiles, aliasMap]
  );

  const value: ProfileContextValue = useMemo(
    () => ({
      profiles,
      selectedProfileId,
      setSelectedProfileId,
      selectedProfile,
      loading,
      error,
      refetch,
      isItemInProfile,
    }),
    [
      profiles,
      selectedProfileId,
      setSelectedProfileId,
      selectedProfile,
      loading,
      error,
      refetch,
      isItemInProfile,
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
