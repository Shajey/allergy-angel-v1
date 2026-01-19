import type {
  ServiceLine,
  ServiceLineId,
  RequiredDocRule,
  ServiceLineRequirements,
} from "@/types/serviceLines";

export const serviceLines: ServiceLine[] = [
  {
    id: "CHHA",
    name: "Certified Home Health Agency",
    description: "Skilled nursing, physical therapy, occupational therapy, and other home health services covered by Medicare/Medicaid.",
  },
  {
    id: "HomeCare",
    name: "Home Care",
    description: "Personal care, homemaking, and companion services to support daily living activities.",
  },
  {
    id: "PrivateCare",
    name: "Private Care",
    description: "Private-pay home care services including personal care, nursing, and specialized care.",
  },
  {
    id: "BehavioralHealth",
    name: "Behavioral Health",
    description: "Mental health services, counseling, and behavioral support provided in the home setting.",
  },
];

export const serviceLineRequirements: ServiceLineRequirements = {
  CHHA: [
    {
      key: "Insurance Card",
      description: "Copy of Medicare/Medicaid insurance card (front and back)",
      optional: false,
    },
    {
      key: "ID",
      description: "Government-issued photo identification",
      optional: false,
    },
    {
      key: "Physician Order",
      description: "Physician's order for home health services",
      optional: false,
    },
    {
      key: "Plan of Care",
      description: "Initial plan of care signed by physician",
      optional: false,
    },
    {
      key: "Consent",
      description: "Consent for treatment and services",
      optional: false,
    },
    {
      key: "Assessment",
      description: "Initial nursing assessment",
      optional: false,
    },
    {
      key: "Medication List",
      description: "Current medication list",
      optional: true,
    },
    {
      key: "Discharge Summary",
      description: "Hospital discharge summary (if applicable)",
      optional: true,
    },
  ],
  HomeCare: [
    {
      key: "Insurance Card",
      description: "Insurance card if services are covered",
      optional: true,
    },
    {
      key: "ID",
      description: "Government-issued photo identification",
      optional: false,
    },
    {
      key: "Consent",
      description: "Consent for home care services",
      optional: false,
    },
    {
      key: "Assessment",
      description: "Initial assessment and care plan",
      optional: false,
    },
    {
      key: "Medication List",
      description: "Current medication list",
      optional: true,
    },
    {
      key: "Visit Summary",
      description: "Recent visit summaries or care notes",
      optional: true,
    },
  ],
  PrivateCare: [
    {
      key: "ID",
      description: "Government-issued photo identification",
      optional: false,
    },
    {
      key: "Consent",
      description: "Consent for private care services",
      optional: false,
    },
    {
      key: "Assessment",
      description: "Initial assessment and care plan",
      optional: false,
    },
    {
      key: "Medication List",
      description: "Current medication list",
      optional: true,
    },
    {
      key: "Physician Order",
      description: "Physician's order or referral (if applicable)",
      optional: true,
    },
    {
      key: "Visit Summary",
      description: "Care visit summaries",
      optional: true,
    },
  ],
  BehavioralHealth: [
    {
      key: "Insurance Card",
      description: "Insurance card for behavioral health coverage",
      optional: false,
    },
    {
      key: "ID",
      description: "Government-issued photo identification",
      optional: false,
    },
    {
      key: "Consent",
      description: "Consent for behavioral health services",
      optional: false,
    },
    {
      key: "Assessment",
      description: "Initial behavioral health assessment",
      optional: false,
    },
    {
      key: "Physician Order",
      description: "Physician referral or order",
      optional: true,
    },
    {
      key: "Medication List",
      description: "Current psychiatric medications",
      optional: true,
    },
    {
      key: "Visit Summary",
      description: "Therapy session notes and summaries",
      optional: true,
    },
  ],
};

/**
 * Get service line by ID.
 */
export function getServiceLine(id: ServiceLineId): ServiceLine | undefined {
  return serviceLines.find((sl) => sl.id === id);
}

/**
 * Get required documents for a service line.
 */
export function getRequiredDocsForServiceLine(
  id: ServiceLineId
): RequiredDocRule[] {
  return serviceLineRequirements[id] || [];
}
