/**
 * Centralized mock people data for the CareOS Portal POC.
 * All demo names are fictional and culturally diverse.
 * 
 * Usage: Import names from this file instead of hardcoding in components.
 */

// ============================================================================
// PATIENTS
// ============================================================================

export const PATIENTS = {
  /** Primary patient (child) - managed by caregiver */
  CHILD_1: {
    id: "patient-1",
    fullName: "Sofia Martinez",
    dob: "2010-05-15",
    memberId: "M123456789",
  },
  /** Secondary patient (child) - managed by caregiver */
  CHILD_2: {
    id: "patient-2",
    fullName: "Lucas Martinez",
    dob: "2012-08-22",
    memberId: "A987654321",
  },
  /** Self patient - when user is also a patient */
  SELF: {
    id: "patient-3",
    fullName: "Elena Rodriguez",
    dob: "1985-03-10",
    memberId: "S456789123",
  },
} as const;

// ============================================================================
// CAREGIVERS
// ============================================================================

export const CAREGIVERS = {
  /** Primary caregiver (the logged-in user when in caregiver mode) */
  PRIMARY: {
    id: "caregiver-1",
    displayName: "Elena Rodriguez",
    relationship: "Parent",
  },
} as const;

// ============================================================================
// CLINICIANS
// ============================================================================

export const CLINICIANS = {
  /** Registered Nurse - primary care coordinator */
  RN_SARAH: "Sarah Johnson, RN",
  /** Physical Therapist */
  PT_MICHAEL: "Michael Chen, PT",
  /** Occupational Therapist */
  OT_EMILY: "Emily Patel, OT",
  /** Home Health Aide */
  HHA_JAMES: "James Williams, HHA",
  /** Physician */
  DR_PRIYA: "Dr. Priya Shah",
  /** Licensed Clinical Social Worker */
  LCSW_MARIA: "Maria Garcia, LCSW",
} as const;

/**
 * Get an array of all clinician names for use in seeding.
 */
export function getAllClinicianNames(): string[] {
  return [
    CLINICIANS.RN_SARAH,
    CLINICIANS.PT_MICHAEL,
    CLINICIANS.OT_EMILY,
    CLINICIANS.HHA_JAMES,
    CLINICIANS.DR_PRIYA,
    CLINICIANS.LCSW_MARIA,
  ];
}

// ============================================================================
// CARE TEAM MEMBERS (for clinical documents)
// ============================================================================

export const CARE_TEAM = {
  /** Care Manager RN for PCSP documents */
  CARE_MANAGER_RN: "Maria Santos, RN",
  /** PT for visit summaries */
  PT_JAMES: "James Chen, PT",
} as const;

// ============================================================================
// DEFAULT USER (for display purposes)
// ============================================================================

export const DEFAULT_USER = {
  id: "user-1",
  displayName: "Elena Rodriguez",
  role: "Caregiver" as const,
} as const;
