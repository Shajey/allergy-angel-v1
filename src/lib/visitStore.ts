import type { Visit, VisitType, VisitLocation } from "@/types/visits";
import { getAllClinicianNames } from "./mockPeople";

const STORAGE_KEY_PREFIX = "vns.visits";

/**
 * Get storage key for a specific patient.
 */
function getStorageKey(patientId: string): string {
  return `${STORAGE_KEY_PREFIX}.${patientId}`;
}

/**
 * Save visits for a patient to localStorage.
 */
function saveVisits(patientId: string, visits: Visit[]): void {
  try {
    localStorage.setItem(getStorageKey(patientId), JSON.stringify(visits));
  } catch (error) {
    console.error("Error saving visits to localStorage:", error);
  }
}

/**
 * Get visits for a patient from localStorage (without seeding).
 */
function getVisitsRaw(patientId: string): Visit[] {
  try {
    const stored = localStorage.getItem(getStorageKey(patientId));
    if (!stored) return [];
    return JSON.parse(stored) as Visit[];
  } catch {
    return [];
  }
}

/**
 * Get all visits for a patient from localStorage.
 * Seeds with mock data if storage is empty.
 */
export function getVisits(patientId: string): Visit[] {
  try {
    const stored = localStorage.getItem(getStorageKey(patientId));
    if (!stored) {
      // Seed if empty
      seedVisitsIfEmpty(patientId);
      const seeded = localStorage.getItem(getStorageKey(patientId));
      if (seeded) {
        return JSON.parse(seeded) as Visit[];
      }
      return [];
    }
    return JSON.parse(stored) as Visit[];
  } catch (error) {
    console.error("Error reading visits from localStorage:", error);
    return [];
  }
}

/**
 * Update a visit (for status changes like PendingChange).
 */
export function updateVisit(
  patientId: string,
  visitId: string,
  patch: Partial<Visit>
): Visit | null {
  const visits = getVisitsRaw(patientId);
  const index = visits.findIndex((v) => v.id === visitId);
  
  if (index === -1) return null;
  
  visits[index] = { ...visits[index], ...patch };
  saveVisits(patientId, visits);
  
  // Dispatch event for UI updates
  window.dispatchEvent(new CustomEvent("visits-changed"));
  
  return visits[index];
}

/**
 * Get a single visit by ID.
 */
export function getVisitById(patientId: string, visitId: string): Visit | undefined {
  const visits = getVisitsRaw(patientId);
  return visits.find((v) => v.id === visitId);
}

/**
 * Seed visits for a patient if they don't exist.
 * Creates 6-10 visits with mix of past and upcoming.
 */
export function seedVisitsIfEmpty(patientId: string): void {
  const existing = getVisitsRaw(patientId);
  if (existing.length > 0) return;

  const now = new Date();
  const day = 24 * 60 * 60 * 1000;
  const hour = 60 * 60 * 1000;

  // Clinician names from centralized mock data
  const clinicians = getAllClinicianNames();

  const _visitTypes: VisitType[] = [
    "Nursing",
    "PT",
    "OT",
    "Home Health Aide",
    "Behavioral Health",
    "Social Work",
  ];

  const _locations: VisitLocation[] = ["Home", "Telehealth"];

  const seedVisits: Visit[] = [
    // Past visits - completed
    {
      id: `visit-${patientId}-1`,
      patientId,
      type: "Nursing",
      clinicianName: clinicians[0],
      startAt: new Date(now.getTime() - 7 * day + 9 * hour).toISOString(),
      endAt: new Date(now.getTime() - 7 * day + 10 * hour).toISOString(),
      status: "Completed",
      location: "Home",
      notes: "Routine assessment completed. Vitals stable. Medication adherence reviewed.",
    },
    {
      id: `visit-${patientId}-2`,
      patientId,
      type: "PT",
      clinicianName: clinicians[1],
      startAt: new Date(now.getTime() - 5 * day + 14 * hour).toISOString(),
      endAt: new Date(now.getTime() - 5 * day + 15 * hour).toISOString(),
      status: "Completed",
      location: "Home",
      notes: "Physical therapy session. Gait training and balance exercises completed.",
    },
    {
      id: `visit-${patientId}-3`,
      patientId,
      type: "Home Health Aide",
      clinicianName: clinicians[3],
      startAt: new Date(now.getTime() - 3 * day + 10 * hour).toISOString(),
      endAt: new Date(now.getTime() - 3 * day + 12 * hour).toISOString(),
      status: "Completed",
      location: "Home",
      notes: "Personal care assistance provided. Light housekeeping completed.",
    },
    // Upcoming visits - scheduled
    {
      id: `visit-${patientId}-4`,
      patientId,
      type: "Nursing",
      clinicianName: clinicians[0],
      startAt: new Date(now.getTime() + 2 * day + 9 * hour).toISOString(),
      endAt: new Date(now.getTime() + 2 * day + 10 * hour).toISOString(),
      status: "Scheduled",
      location: "Home",
      notes: "Weekly nursing visit - vital signs and medication review.",
    },
    {
      id: `visit-${patientId}-5`,
      patientId,
      type: "Behavioral Health",
      clinicianName: clinicians[4],
      startAt: new Date(now.getTime() + 4 * day + 11 * hour).toISOString(),
      endAt: new Date(now.getTime() + 4 * day + 12 * hour).toISOString(),
      status: "Scheduled",
      location: "Telehealth",
      notes: "Behavioral health check-in via telehealth.",
    },
    {
      id: `visit-${patientId}-6`,
      patientId,
      type: "OT",
      clinicianName: clinicians[2],
      startAt: new Date(now.getTime() + 6 * day + 13 * hour).toISOString(),
      endAt: new Date(now.getTime() + 6 * day + 14 * hour).toISOString(),
      status: "Scheduled",
      location: "Home",
      notes: "Occupational therapy - ADL assessment and home safety evaluation.",
    },
    {
      id: `visit-${patientId}-7`,
      patientId,
      type: "Home Health Aide",
      clinicianName: clinicians[3],
      startAt: new Date(now.getTime() + 8 * day + 10 * hour).toISOString(),
      endAt: new Date(now.getTime() + 8 * day + 12 * hour).toISOString(),
      status: "Scheduled",
      location: "Home",
    },
    {
      id: `visit-${patientId}-8`,
      patientId,
      type: "Social Work",
      clinicianName: clinicians[5],
      startAt: new Date(now.getTime() + 10 * day + 15 * hour).toISOString(),
      endAt: new Date(now.getTime() + 10 * day + 16 * hour).toISOString(),
      status: "Scheduled",
      location: "Telehealth",
      notes: "Care coordination and resource planning session.",
    },
  ];

  saveVisits(patientId, seedVisits);
}

/**
 * Get upcoming visits for a patient (sorted ascending by start date).
 */
export function getUpcomingVisits(patientId: string): Visit[] {
  const visits = getVisits(patientId);
  const now = new Date();
  return visits
    .filter((v) => new Date(v.startAt) >= now && v.status !== "Completed")
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
}

/**
 * Get past visits for a patient (sorted descending by start date).
 */
export function getPastVisits(patientId: string): Visit[] {
  const visits = getVisits(patientId);
  const now = new Date();
  return visits
    .filter((v) => new Date(v.startAt) < now || v.status === "Completed")
    .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());
}

/**
 * Get visits for a specific date.
 */
export function getVisitsForDate(patientId: string, date: Date): Visit[] {
  const visits = getVisits(patientId);
  const dateStart = new Date(date);
  dateStart.setHours(0, 0, 0, 0);
  const dateEnd = new Date(date);
  dateEnd.setHours(23, 59, 59, 999);
  
  return visits.filter((v) => {
    const visitDate = new Date(v.startAt);
    return visitDate >= dateStart && visitDate <= dateEnd;
  });
}

/**
 * Get visits for a specific month.
 */
export function getVisitsForMonth(patientId: string, year: number, month: number): Visit[] {
  const visits = getVisits(patientId);
  return visits.filter((v) => {
    const visitDate = new Date(v.startAt);
    return visitDate.getFullYear() === year && visitDate.getMonth() === month;
  });
}

/**
 * Get dates with visits in a specific month (for calendar highlighting).
 */
export function getDatesWithVisits(patientId: string, year: number, month: number): Set<number> {
  const visits = getVisitsForMonth(patientId, year, month);
  const dates = new Set<number>();
  visits.forEach((v) => {
    const visitDate = new Date(v.startAt);
    dates.add(visitDate.getDate());
  });
  return dates;
}
