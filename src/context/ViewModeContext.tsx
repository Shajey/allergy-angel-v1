import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

export type ViewMode = "patient" | "caregiver" | "clinician" | "developer";

const STORAGE_KEY = "vns-view-mode";

interface ViewModeContextType {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  hasSelectedPersona: boolean;
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
    const stored = localStorage.getItem(STORAGE_KEY);
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
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Silently fail
  }
}

/**
 * ViewModeProvider provides a lightweight view mode state that controls
 * how certain pages render (e.g., patient hero vs clinician hero).
 * This is a UI-only state and does not affect business logic or data fetching.
 * Persists selection to localStorage.
 */
export function ViewModeProvider({ children }: ViewModeProviderProps) {
  const storedMode = getStoredViewMode();
  const [viewMode, setViewModeState] = useState<ViewMode>(storedMode || "caregiver");
  const [hasSelectedPersona, setHasSelectedPersona] = useState<boolean>(storedMode !== null);

  const setViewMode = (mode: ViewMode) => {
    setViewModeState(mode);
    saveViewMode(mode);
    setHasSelectedPersona(true);
  };

  return (
    <ViewModeContext.Provider value={{ viewMode, setViewMode, hasSelectedPersona }}>
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
