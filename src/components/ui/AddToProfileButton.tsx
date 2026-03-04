/**
 * Phase 19 – Add to Profile from Check Detail
 *
 * One-tap add medication/supplement to profile. Shows "+ Add to profile" when
 * not in profile, "✓ In your profile" when already added.
 */

import { useState } from "react";
import { Plus, Check } from "lucide-react";
import { useProfileContext } from "@/context/ProfileContext";
import { cn } from "@/lib/utils";

interface AddToProfileButtonProps {
  type: "medication" | "supplement";
  name: string;
  checkId: string;
  className?: string;
}

export function AddToProfileButton({
  type,
  name,
  checkId,
  className,
}: AddToProfileButtonProps) {
  const { selectedProfileId, refetch, isItemInProfile } = useProfileContext();
  const [state, setState] = useState<"idle" | "adding" | "added" | "error">("idle");

  const inProfile = isItemInProfile(type, name);

  if (!selectedProfileId) {
    return null;
  }

  if (inProfile) {
    return (
      <span
        className={cn(
          "text-sm text-emerald-600 flex items-center gap-1",
          className
        )}
      >
        <Check className="w-4 h-4 flex-shrink-0" aria-hidden />
        In your profile
      </span>
    );
  }

  const handleAdd = async () => {
    if (!selectedProfileId) return;
    setState("adding");
    try {
      const res = await fetch("/api/profile?action=add-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: selectedProfileId,
          type,
          name: name.trim(),
          source: "extracted",
          sourceCheckId: checkId,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to add");
      }

      setState("added");
      await refetch();
    } catch {
      setState("error");
    }
  };

  if (state === "adding") {
    return (
      <span className={cn("text-sm text-gray-400", className)}>Adding…</span>
    );
  }

  if (state === "added") {
    return (
      <span
        className={cn(
          "text-sm text-emerald-600 flex items-center gap-1",
          className
        )}
      >
        <Check className="w-4 h-4 flex-shrink-0" aria-hidden />
        Added!
      </span>
    );
  }

  if (state === "error") {
    return (
      <button
        type="button"
        onClick={handleAdd}
        className={cn(
          "text-sm text-red-600 hover:underline",
          className
        )}
      >
        Failed — Retry?
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleAdd}
      className={cn(
        "text-sm text-emerald-600 hover:text-emerald-800 hover:underline flex items-center gap-1",
        className
      )}
    >
      <Plus className="w-4 h-4 flex-shrink-0" aria-hidden />
      Add to profile
    </button>
  );
}
