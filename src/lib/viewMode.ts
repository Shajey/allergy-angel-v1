import type { ViewMode } from "@/context/ViewModeContext";

/**
 * Check if the current view mode is clinician.
 */
export function isClinician(viewMode: ViewMode): boolean {
  return viewMode === "clinician";
}

/**
 * Page keys for header copy lookup.
 */
export type PageKey =
  | "today"
  | "tasks"
  | "carePlan"
  | "documents"
  | "messages"
  | "timeline"
  | "visits"
  | "profile";

interface HeaderCopy {
  eyebrow: string;
  title: string;
  subtitle: string;
}

/**
 * Get header copy based on page key and patient name.
 * Eyebrow labels are consistent page category labels.
 * Subtitles provide context (may differ slightly for clinician for operational clarity).
 */
export function getHeaderCopy(
  pageKey: PageKey,
  patientName: string,
  viewMode: ViewMode
): HeaderCopy {
  const isClinicianMode = isClinician(viewMode);

  // Titles - page names
  const titles: Record<PageKey, string> = {
    today: "Today",
    tasks: "Tasks",
    carePlan: "Care Plan",
    documents: "Documents",
    messages: "Messages",
    timeline: "Timeline",
    visits: "Visits",
    profile: "Profile",
  };

  // Eyebrows - consistent category labels (same for all view modes, color changes)
  const eyebrows: Record<PageKey, string> = {
    today: "Dashboard",
    tasks: "Tasks",
    carePlan: "Care Plan",
    documents: "Documents",
    messages: "Communications",
    timeline: "Timeline",
    visits: "Visits",
    profile: "Profile",
  };

  // Subtitles - short descriptive lines
  const subtitles: Record<PageKey, (name: string, isClinician: boolean) => string> = {
    today: (name, isClinician) => isClinician
      ? `Operational overview for ${name}`
      : new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
    tasks: (name, isClinician) => isClinician
      ? `Care coordination tasks for ${name}`
      : `Managing tasks for ${name}`,
    carePlan: (name, isClinician) => isClinician
      ? `Plan of care and requirements for ${name}`
      : `Required documents and care plan for ${name}`,
    documents: (name, isClinician) => isClinician
      ? `Clinical and administrative documents for ${name}`
      : "View and manage uploaded documents",
    messages: (name, isClinician) => isClinician
      ? `Secure communication log for ${name}`
      : `Communicate with VNS Provider Services`,
    timeline: (name, isClinician) => isClinician
      ? `Audit-style activity feed for ${name}`
      : `Recent activity for ${name}`,
    visits: (name, isClinician) => isClinician
      ? `Encounter schedule for ${name}`
      : "View and manage scheduled visits",
    profile: () => "Your account information and settings",
  };

  return {
    title: titles[pageKey],
    eyebrow: eyebrows[pageKey],
    subtitle: subtitles[pageKey](patientName, isClinicianMode),
  };
}

/**
 * Get card className for clinician mode styling.
 */
export function getCardClassName(viewMode: ViewMode): string {
  if (isClinician(viewMode)) {
    return "shadow-sm hover:shadow-md transition-shadow duration-200";
  }
  return "";
}
