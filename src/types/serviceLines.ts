export type ServiceLineId = "CHHA" | "HomeCare" | "PrivateCare" | "BehavioralHealth";

export interface ServiceLine {
  id: ServiceLineId;
  name: string;
  description: string;
}

export type RequiredDocKey =
  | "Insurance Card"
  | "ID"
  | "Physician Order"
  | "Plan of Care"
  | "Consent"
  | "Visit Summary"
  | "Discharge Summary"
  | "Medication List"
  | "Assessment"
  | "Other";

export interface RequiredDocRule {
  key: RequiredDocKey;
  description: string;
  optional: boolean;
}

export type ServiceLineRequirements = Record<ServiceLineId, RequiredDocRule[]>;
