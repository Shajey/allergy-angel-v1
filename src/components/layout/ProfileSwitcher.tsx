/**
 * Phase 16 – Profile switcher dropdown in header
 * Phase 18.3 – full-width variant for mobile, truncate long names
 *
 * Shows "Checking for: [name] ▼" and "Manage Profiles" link.
 */

import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { useProfileContext } from "../../context/ProfileContext";

interface ProfileSwitcherProps {
  /** full-width: full-width button for mobile header row 2 */
  variant?: "default" | "full-width";
}

export default function ProfileSwitcher({ variant = "default" }: ProfileSwitcherProps) {
  const { profiles, selectedProfile, setSelectedProfileId, loading } = useProfileContext();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  if (loading || !selectedProfile) {
    return (
      <div className="text-sm text-gray-500 px-2 py-1">
        {loading ? "Loading…" : "No profile"}
      </div>
    );
  }

  const displayName = selectedProfile.display_name || "Profile";

  const isFullWidth = variant === "full-width";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 min-h-[40px] rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 active:bg-gray-200 transition-colors ${
          isFullWidth ? "w-full justify-between" : "min-w-[44px]"
        }`}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Checking for: ${displayName}. Switch profile`}
      >
        <span className={`truncate ${isFullWidth ? "flex-1 text-left" : "max-w-[100px] sm:max-w-[140px]"}`}>
          Checking for: {displayName}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0" />
      </button>

      {open && (
        <div
          className={`absolute top-full mt-1 min-w-[180px] max-w-[min(90vw,280px)] rounded-md border border-gray-200 bg-white py-1 shadow-lg z-50 ${
            isFullWidth ? "left-0 right-0 w-full" : "right-0"
          }`}
          role="listbox"
        >
          {profiles.map((p) => (
            <button
              key={p.id}
              type="button"
              role="option"
              aria-selected={p.id === selectedProfile.id}
              onClick={() => {
                setSelectedProfileId(p.id);
                setOpen(false);
              }}
              className={`w-full min-h-[44px] px-3 py-2.5 text-left text-sm hover:bg-gray-50 active:bg-gray-100 flex items-center justify-between gap-2 ${
                p.id === selectedProfile.id ? "bg-emerald-50 text-emerald-800 font-semibold ring-1 ring-inset ring-emerald-200" : ""
              }`}
            >
              <span className="truncate max-w-[200px]">{p.display_name}</span>
              {p.is_primary && (
                <span className="shrink-0 text-xs text-gray-500">(primary)</span>
              )}
            </button>
          ))}
          <div className="border-t border-gray-100 mt-1 pt-1">
            <Link
              to="/manage-profiles"
              className="block min-h-[44px] px-3 py-2.5 text-sm text-emerald-600 hover:bg-emerald-50 active:bg-emerald-100"
              onClick={() => setOpen(false)}
            >
              Manage Profiles
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
