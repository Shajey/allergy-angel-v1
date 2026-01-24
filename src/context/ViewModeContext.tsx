import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

export type ViewMode = "patient" | "caregiver" | "clinician" | "developer";

/**
 * IdentityRole represents the user's identity - how they entered the portal.
 * This is the source of truth for role labels and permissions.
 * - "patient" = viewing own care data, no patient switching
 * - "caregiver" = managing family members, can switch between managed patients
 * - "clinician" = Phase 1 "login as patient" mode for support/troubleshooting
 * - "developer" = can freely switch roles using the "Viewing As" control
 */
export type IdentityRole = "patient" | "caregiver" | "clinician" | "developer";

// Legacy alias for backward compatibility
export type EntryMode = IdentityRole;

const VIEW_MODE_STORAGE_KEY = "vns-view-mode";
const IDENTITY_ROLE_STORAGE_KEY = "vns-identity-role";

interface ViewModeContextType {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  /** The user's identity role - source of truth for labels */
  identityRole: IdentityRole;
  setIdentityRole: (role: IdentityRole) => void;
  /** @deprecated Use identityRole instead */
  entryMode: IdentityRole;
  /** @deprecated Use setIdentityRole instead */
  setEntryMode: (mode: IdentityRole) => void;
  hasSelectedPersona: boolean;
  /** True only when user entered as developer - allows role switching */
  isDeveloperEntry: boolean;
  /** True when identityRole is clinician (Phase 1 login-as mode) */
  isClinicianLoginAs: boolean;
}

const ViewModeContext = createContext<ViewModeContextType | undefined>(undefined);

interface ViewModeProviderProps {
  children: ReactNode;
}

/**
 * Get stored view mode from localStorage.
 */
function getStoredViewMode(): ViewMode | null {
  try {
    const stored = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    if (stored && ["patient", "caregiver", "clinician", "developer"].includes(stored)) {
      return stored as ViewMode;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Save view mode to localStorage.
 */
function saveViewMode(mode: ViewMode): void {
  try {
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
  } catch {
    // Silently fail
  }
}

/**
 * Get stored identity role from localStorage.
 */
function getStoredIdentityRole(): IdentityRole | null {
  try {
    // Check new key first, then fall back to legacy key
    let stored = localStorage.getItem(IDENTITY_ROLE_STORAGE_KEY);
    if (!stored) {
      stored = localStorage.getItem("vns-entry-mode"); // Legacy key
    }
    if (stored && ["patient", "caregiver", "clinician", "developer"].includes(stored)) {
      return stored as IdentityRole;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Save identity role to localStorage.
 */
function saveIdentityRole(role: IdentityRole): void {
  try {
    localStorage.setItem(IDENTITY_ROLE_STORAGE_KEY, role);
    // Also save to legacy key for compatibility
    localStorage.setItem("vns-entry-mode", role);
  } catch {
    // Silently fail
  }
}

/**
 * ViewModeProvider provides identity role and view mode state.
 * 
 * - identityRole: The user's identity (how they logged in) - source of truth for labels
 * - viewMode: The current view perspective (only changeable by developers)
 * 
 * Rules:
 * - If identityRole !== "developer", role switching is LOCKED
 * - If identityRole === "developer", user can freely switch viewMode
 * - If identityRole === "clinician", they are in "login as patient" mode
 */
export function ViewModeProvider({ children }: ViewModeProviderProps) {
  const storedViewMode = getStoredViewMode();
  const storedIdentityRole = getStoredIdentityRole();
  
  const [viewMode, setViewModeState] = useState<ViewMode>(storedViewMode || "caregiver");
  const [identityRole, setIdentityRoleState] = useState<IdentityRole>(storedIdentityRole || "caregiver");
  const [hasSelectedPersona, setHasSelectedPersona] = useState<boolean>(storedViewMode !== null);

  const setViewMode = (mode: ViewMode) => {
    setViewModeState(mode);
    saveViewMode(mode);
    setHasSelectedPersona(true);
  };

  const setIdentityRole = (role: IdentityRole) => {
    setIdentityRoleState(role);
    saveIdentityRole(role);
  };

  const isDeveloperEntry = identityRole === "developer";
  const isClinicianLoginAs = identityRole === "clinician";

  return (
    <ViewModeContext.Provider value={{ 
      viewMode, 
      setViewMode, 
      identityRole,
      setIdentityRole,
      // Legacy aliases
      entryMode: identityRole, 
      setEntryMode: setIdentityRole, 
      hasSelectedPersona,
      isDeveloperEntry,
      isClinicianLoginAs
    }}>
      {children}
    </ViewModeContext.Provider>
  );
}

/**
 * Hook to access the current view mode and setter.
 */
export function useViewMode(): ViewModeContextType {
  const context = useContext(ViewModeContext);
  if (context === undefined) {
    throw new Error("useViewMode must be used within a ViewModeProvider");
  }
  return context;
}
