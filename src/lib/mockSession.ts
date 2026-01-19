import type { SessionState } from "@/types/session";

export const mockSession: SessionState = {
  user: {
    id: "user-1",
    displayName: "Shajey R.",
    role: "Caregiver",
  },
  activePatientId: "patient-1",
  patients: [
    {
      id: "patient-1",
      fullName: "Maya R.",
      dob: "2010-05-15",
      memberId: "M123456789",
      relationshipLabel: "Daughter",
      serviceLineId: "CHHA",
      startDate: "2024-01-01",
      isSelf: false,
    },
    {
      id: "patient-2",
      fullName: "Azalea R.",
      dob: "2012-08-22",
      memberId: "A987654321",
      relationshipLabel: "Daughter",
      serviceLineId: "HomeCare",
      startDate: "2024-01-15",
      isSelf: false,
    },
    {
      id: "patient-3",
      fullName: "Shajey R.",
      dob: "1985-03-10",
      memberId: "S456789123",
      relationshipLabel: "Self",
      serviceLineId: "BehavioralHealth",
      startDate: "2024-02-01",
      isSelf: true, // This is the user's own patient profile
    },
  ],
  caregiverProfile: {
    id: "caregiver-1",
    displayName: "Shajey R.",
    relationship: "Parent",
    patientIds: ["patient-1", "patient-2"], // Can manage Maya and Azalea
  },
};
