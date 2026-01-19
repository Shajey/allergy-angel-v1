export type VisitType =
  | "Nursing"
  | "PT"
  | "OT"
  | "Home Health Aide"
  | "Behavioral Health"
  | "Social Work";

export type VisitStatus =
  | "Scheduled"
  | "Completed"
  | "Cancelled"
  | "PendingChange";

export type VisitLocation = "Home" | "Telehealth";

export interface Visit {
  id: string;
  patientId: string;
  type: VisitType;
  clinicianName?: string; // String only - clinician persona out of scope
  startAt: string; // ISO date string
  endAt: string; // ISO date string
  status: VisitStatus;
  location: VisitLocation;
  notes?: string; // Read-only notes
}

// Helper to get visit type display color
// Using 700 text shades for better visual comfort
export function getVisitTypeColor(type: VisitType): string {
  switch (type) {
    case "Nursing":
      return "bg-blue-100 text-blue-700";
    case "PT":
      return "bg-green-100 text-green-700";
    case "OT":
      return "bg-purple-100 text-purple-700";
    case "Home Health Aide":
      return "bg-orange-100 text-orange-700";
    case "Behavioral Health":
      return "bg-pink-100 text-pink-700";
    case "Social Work":
      return "bg-teal-100 text-teal-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

// Helper to get visit status display color
// Using 700 text shades for better visual comfort
export function getVisitStatusColor(status: VisitStatus): string {
  switch (status) {
    case "Scheduled":
      return "bg-blue-100 text-blue-700";
    case "Completed":
      return "bg-green-100 text-green-700";
    case "Cancelled":
      return "bg-red-100 text-red-700";
    case "PendingChange":
      return "bg-yellow-100 text-yellow-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

// Helper to get status display label
export function getVisitStatusLabel(status: VisitStatus): string {
  switch (status) {
    case "PendingChange":
      return "Pending Change";
    default:
      return status;
  }
}
