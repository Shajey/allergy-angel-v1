import type { SessionState } from "@/types/session";
import { PATIENTS, CAREGIVERS, DEFAULT_USER } from "./mockPeople";

export const mockSession: SessionState = {
  user: {
    id: DEFAULT_USER.id,
    displayName: DEFAULT_USER.displayName,
    role: DEFAULT_USER.role,
  },
  activePatientId: PATIENTS.CHILD_1.id,
  patients: [
    {
      id: PATIENTS.CHILD_1.id,
      fullName: PATIENTS.CHILD_1.fullName,
      dob: PATIENTS.CHILD_1.dob,
      memberId: PATIENTS.CHILD_1.memberId,
      relationshipLabel: "Daughter",
      serviceLineId: "CHHA",
      startDate: "2024-01-01",
      isSelf: false,
    },
    {
      id: PATIENTS.CHILD_2.id,
      fullName: PATIENTS.CHILD_2.fullName,
      dob: PATIENTS.CHILD_2.dob,
      memberId: PATIENTS.CHILD_2.memberId,
      relationshipLabel: "Son",
      serviceLineId: "HomeCare",
      startDate: "2024-01-15",
      isSelf: false,
    },
    {
      id: PATIENTS.SELF.id,
      fullName: PATIENTS.SELF.fullName,
      dob: PATIENTS.SELF.dob,
      memberId: PATIENTS.SELF.memberId,
      relationshipLabel: "Self",
      serviceLineId: "BehavioralHealth",
      startDate: "2024-02-01",
      isSelf: true, // This is the user's own patient profile
    },
  ],
  caregiverProfile: {
    id: CAREGIVERS.PRIMARY.id,
    displayName: CAREGIVERS.PRIMARY.displayName,
    relationship: CAREGIVERS.PRIMARY.relationship,
    patientIds: [PATIENTS.CHILD_1.id, PATIENTS.CHILD_2.id], // Can manage Sofia and Lucas
  },
};
