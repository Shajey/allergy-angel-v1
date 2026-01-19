import type { ServiceLineId } from "./serviceLines";

export type UserRole = "Patient" | "Caregiver";

export type CaregiverRelationship = "Spouse" | "Child" | "Parent" | "Sibling" | "Other";

export interface SessionUser {
  id: string;
  displayName: string;
  role: UserRole;
}

export interface PatientProfile {
  id: string;
  fullName: string;
  dob?: string; // ISO date string
  memberId?: string;
  relationshipLabel?: string; // e.g., "Self", "Daughter", "Mother"
  serviceLineId: ServiceLineId;
  startDate?: string; // ISO date string
  isSelf?: boolean; // True if this patient profile represents the user themselves
}

export interface CaregiverProfile {
  id: string;
  displayName: string;
  relationship: CaregiverRelationship;
  patientIds: string[]; // IDs of patients this caregiver can manage
}

export interface SessionState {
  user: SessionUser;
  activePatientId: string;
  patients: PatientProfile[];
  caregiverProfile?: CaregiverProfile; // Present when user can act as caregiver
}
