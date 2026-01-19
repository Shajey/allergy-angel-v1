export type DocumentType = 
  | "Visit Summary"
  | "Plan of Care"
  | "Lab Result"
  | "Billing"
  | "Other";

export type DocumentStatus = 
  | "Available"
  | "Pending"
  | "Processing"
  | "Rejected";

import type { RequiredDocKey } from "./serviceLines";

export interface DocumentRecord {
  id: string;
  title: string;
  type: DocumentType;
  date: string; // ISO date string
  status: DocumentStatus;
  source: string;
  fileName?: string;
  notes?: string;
  tags?: string[];
  patientId?: string; // Patient ID this document belongs to
  requiredDocKey?: RequiredDocKey; // Required document key if this satisfies a requirement
}
