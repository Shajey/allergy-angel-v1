export type TimelineEventType =
  | "DocumentUploaded"
  | "DocumentStatusChanged"
  | "DocRequestedFromCareOS"
  | "MessageSent"
  | "ChecklistItemMet"
  | "ChecklistItemMissing"
  | "NotificationCreated"
  | "VisitUpdateRequested"
  | "TaskCompleted";

export interface TimelineEvent {
  id: string;
  patientId: string;
  type: TimelineEventType;
  title: string;
  description?: string;
  createdAt: string; // ISO date string
  meta?: Record<string, unknown>;
  link?: string; // Route like "/documents" or "/messages"
}

// Category for filtering
export type TimelineCategory = "all" | "documents" | "care-plan" | "messages" | "visits" | "tasks";

// Helper to get category from event type
export function getEventCategory(type: TimelineEventType): TimelineCategory {
  switch (type) {
    case "DocumentUploaded":
    case "DocumentStatusChanged":
      return "documents";
    case "DocRequestedFromCareOS":
    case "ChecklistItemMet":
    case "ChecklistItemMissing":
      return "care-plan";
    case "MessageSent":
      return "messages";
    case "VisitUpdateRequested":
      return "visits";
    case "TaskCompleted":
      return "tasks";
    case "NotificationCreated":
      return "all"; // Notifications span all categories
    default:
      return "all";
  }
}
