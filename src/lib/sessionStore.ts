import type { SessionState, CaregiverProfile, PatientProfile } from "@/types/session";
import { mockSession } from "./mockSession";
import type { ServiceLineId } from "@/types/serviceLines";

const STORAGE_KEY = "vns-session";

/**
 * Get session from localStorage.
 * Seeds with mock data if storage is empty.
 * Migrates existing sessions without serviceLineId.
 */
export function getSession(): SessionState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      // First load - seed with mock data
      saveSession(mockSession);
      return mockSession;
    }
    
    const session = JSON.parse(stored) as SessionState;
    
    // Migration: assign serviceLineId to patients that don't have it
    let needsMigration = false;
    const serviceLines: ServiceLineId[] = ["CHHA", "HomeCare", "PrivateCare", "BehavioralHealth"];
    
    const migratedPatients = session.patients.map((patient, index) => {
      if (!patient.serviceLineId) {
        needsMigration = true;
        // Assign service lines in round-robin fashion
        return {
          ...patient,
          serviceLineId: serviceLines[index % serviceLines.length] as ServiceLineId,
        };
      }
      return patient;
    });

    // Migration: add caregiverProfile if missing
    if (!session.caregiverProfile && mockSession.caregiverProfile) {
      needsMigration = true;
    }

    // Migration: add isSelf flag to patients
    const patientsWithSelf = migratedPatients.map((patient) => {
      if (patient.isSelf === undefined) {
        needsMigration = true;
        return {
          ...patient,
          isSelf: patient.relationshipLabel === "Self",
        };
      }
      return patient;
    });
    
    if (needsMigration) {
      const migratedSession: SessionState = {
        ...session,
        patients: patientsWithSelf,
        caregiverProfile: session.caregiverProfile || mockSession.caregiverProfile,
      };
      saveSession(migratedSession);
      return migratedSession;
    }
    
    return session;
  } catch (error) {
    console.error("Error reading session from localStorage:", error);
    return mockSession;
  }
}

/**
 * Save session to localStorage.
 */
export function saveSession(session: SessionState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch (error) {
    console.error("Error saving session to localStorage:", error);
  }
}

/**
 * Reset session (clears localStorage and returns to default).
 */
export function resetSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Error resetting session:", error);
  }
}

/**
 * Update active patient ID.
 */
export function setActivePatientId(patientId: string): void {
  const session = getSession();
  if (session.patients.some((p) => p.id === patientId)) {
    session.activePatientId = patientId;
    saveSession(session);
  }
}

/**
 * Update user role.
 * When switching to Patient role, auto-selects the "Self" patient.
 * When switching to Caregiver role, selects the first linked patient.
 */
export function setUserRole(role: "Patient" | "Caregiver"): void {
  const session = getSession();
  session.user.role = role;
  
  if (role === "Patient") {
    // Find the "Self" patient
    const selfPatient = session.patients.find((p) => p.isSelf);
    if (selfPatient) {
      session.activePatientId = selfPatient.id;
    }
  } else if (role === "Caregiver") {
    // Find a patient the caregiver can manage (not self)
    const caregiverPatients = getCaregiverPatients(session);
    if (caregiverPatients.length > 0) {
      // Only switch if current patient is not in caregiver's list
      const currentIsManaged = caregiverPatients.some((p) => p.id === session.activePatientId);
      if (!currentIsManaged) {
        session.activePatientId = caregiverPatients[0].id;
      }
    }
  }
  
  saveSession(session);
}

/**
 * Get the caregiver profile from the session.
 */
export function getCaregiverProfile(): CaregiverProfile | undefined {
  const session = getSession();
  return session.caregiverProfile;
}

/**
 * Get the "Self" patient (the user's own patient profile).
 */
export function getSelfPatient(): PatientProfile | undefined {
  const session = getSession();
  return session.patients.find((p) => p.isSelf);
}

/**
 * Get patients that the caregiver can manage.
 */
export function getCaregiverPatients(session?: SessionState): PatientProfile[] {
  const sess = session || getSession();
  if (!sess.caregiverProfile) return [];
  return sess.patients.filter(
    (p) => sess.caregiverProfile!.patientIds.includes(p.id)
  );
}

/**
 * Get patients available based on current role.
 * - Patient role: only self
 * - Caregiver role: only linked patients
 */
export function getAvailablePatients(): PatientProfile[] {
  const session = getSession();
  if (session.user.role === "Patient") {
    const selfPatient = session.patients.find((p) => p.isSelf);
    return selfPatient ? [selfPatient] : [];
  } else {
    return getCaregiverPatients(session);
  }
}

/**
 * Check if the current user can switch roles.
 * User can be caregiver only if caregiverProfile exists.
 */
export function canSwitchToRole(role: "Patient" | "Caregiver"): boolean {
  const session = getSession();
  if (role === "Patient") {
    return session.patients.some((p) => p.isSelf);
  } else {
    return !!session.caregiverProfile && session.caregiverProfile.patientIds.length > 0;
  }
}
