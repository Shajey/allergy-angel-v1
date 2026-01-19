/**
 * Clinical Documents data model and seed data.
 * These are documents from the care team (PCSP, HRA, Visit Summaries, etc.)
 */

export type ClinicalDocumentType =
  | "PCSP"
  | "HRA"
  | "VisitSummary"
  | "CarePlanAddendum"
  | "Other";

export type ClinicalDocumentStatus =
  | "New"
  | "Reviewed"
  | "RequiresAction"
  | "Completed";

export type AuthorRole = "Care Manager RN" | "RN" | "PT";

export interface ClinicalDocument {
  id: string;
  type: ClinicalDocumentType;
  title: string;
  status: ClinicalDocumentStatus;
  authorOrg: "VNS Health Plan";
  authorRole: AuthorRole;
  createdAt: string; // ISO date
  relatedEpisode?: string;
  summary: { label: string; value: string }[];
  qa: { question: string; answer: string }[];
  pdfUrl?: string;
  reviewedAt?: string | null;
  openedAt?: string | null;
}

/**
 * Get the status badge color classes for a clinical document status.
 */
export function getClinicalStatusBadgeClass(status: ClinicalDocumentStatus): string {
  switch (status) {
    case "New":
      return "bg-blue-100 text-blue-700";
    case "Reviewed":
      return "bg-green-100 text-green-700";
    case "RequiresAction":
      return "bg-amber-100 text-amber-700";
    case "Completed":
      return "bg-gray-100 text-gray-600";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

/**
 * Get the document type badge color classes.
 */
export function getClinicalTypeBadgeClass(type: ClinicalDocumentType): string {
  switch (type) {
    case "PCSP":
      return "bg-purple-100 text-purple-700";
    case "HRA":
      return "bg-indigo-100 text-indigo-700";
    case "VisitSummary":
      return "bg-teal-100 text-teal-700";
    case "CarePlanAddendum":
      return "bg-orange-100 text-orange-700";
    case "Other":
      return "bg-gray-100 text-gray-600";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

/**
 * Get human-readable document type label.
 */
export function getClinicalTypeLabel(type: ClinicalDocumentType): string {
  switch (type) {
    case "PCSP":
      return "PCSP";
    case "HRA":
      return "HRA";
    case "VisitSummary":
      return "Visit Summary";
    case "CarePlanAddendum":
      return "Care Plan Addendum";
    case "Other":
      return "Other";
    default:
      return type;
  }
}

/**
 * Seed data for clinical documents.
 */
export const clinicalDocuments: ClinicalDocument[] = [
  {
    id: "cdoc-001",
    type: "PCSP",
    title: "Person-Centered Service Plan - January 2026",
    status: "New",
    authorOrg: "VNS Health Plan",
    authorRole: "Care Manager RN",
    createdAt: "2026-01-15T10:30:00Z",
    relatedEpisode: "EP-2026-001",
    summary: [
      { label: "Effective Date", value: "January 15, 2026" },
      { label: "Review Date", value: "July 15, 2026" },
      { label: "Primary Goal", value: "Improve mobility and reduce fall risk" },
      { label: "Care Coordinator", value: "Maria Santos, RN" },
    ],
    qa: [
      {
        question: "What are my main health goals?",
        answer:
          "Your main goals are to improve mobility through physical therapy, manage diabetes with diet and medication, and reduce fall risk through home safety modifications.",
      },
      {
        question: "How often will I receive home visits?",
        answer:
          "You will receive PT visits 2x weekly for the first month, then 1x weekly. RN visits will occur monthly to monitor your diabetes management.",
      },
      {
        question: "Who do I contact if I have questions?",
        answer:
          "Your Care Manager, Maria Santos RN, can be reached through the secure messaging feature in this portal or by calling 1-800-VNS-CARE.",
      },
    ],
    pdfUrl: "/sample/pcsp.pdf",
    reviewedAt: null,
    openedAt: null,
  },
  {
    id: "cdoc-002",
    type: "HRA",
    title: "Health Risk Assessment - Annual Review",
    status: "Reviewed",
    authorOrg: "VNS Health Plan",
    authorRole: "RN",
    createdAt: "2026-01-10T14:00:00Z",
    relatedEpisode: "EP-2026-001",
    summary: [
      { label: "Assessment Date", value: "January 10, 2026" },
      { label: "Risk Level", value: "Moderate" },
      { label: "Key Conditions", value: "Type 2 Diabetes, Hypertension" },
      { label: "Fall Risk Score", value: "6/10 (Elevated)" },
    ],
    qa: [
      {
        question: "What does my risk level mean?",
        answer:
          "A moderate risk level indicates you have some chronic conditions that require ongoing management. With proper care coordination, these can be well-controlled.",
      },
      {
        question: "Why is my fall risk elevated?",
        answer:
          "Your fall risk is elevated due to a combination of factors including recent balance issues, medication side effects, and some home safety concerns. We've included PT in your care plan to address this.",
      },
    ],
    pdfUrl: "/sample/hra.pdf",
    reviewedAt: "2026-01-12T09:15:00Z",
    openedAt: "2026-01-11T16:30:00Z",
  },
  {
    id: "cdoc-003",
    type: "VisitSummary",
    title: "Home Visit Summary - January 17, 2026",
    status: "New",
    authorOrg: "VNS Health Plan",
    authorRole: "PT",
    createdAt: "2026-01-17T16:45:00Z",
    relatedEpisode: "EP-2026-001",
    summary: [
      { label: "Visit Date", value: "January 17, 2026" },
      { label: "Visit Type", value: "Physical Therapy - Initial Eval" },
      { label: "Duration", value: "60 minutes" },
      { label: "Clinician", value: "James Chen, PT" },
    ],
    qa: [
      {
        question: "What was accomplished during this visit?",
        answer:
          "James conducted an initial evaluation including gait assessment, balance testing, and home safety review. He identified three areas in the home that need grab bars installed.",
      },
      {
        question: "What exercises were recommended?",
        answer:
          "You were given a set of seated leg strengthening exercises and standing balance exercises to be done daily. A printed handout was left during the visit.",
      },
      {
        question: "When is the next visit?",
        answer:
          "Your next PT visit is scheduled for January 20, 2026 at 2:00 PM. James will bring resistance bands to progress your exercises.",
      },
    ],
    reviewedAt: null,
    openedAt: null,
  },
];

const STORAGE_KEY = "vns-clinical-documents";

/**
 * Get all clinical documents from localStorage.
 * Seeds with initial data if storage is empty.
 */
export function getClinicalDocuments(): ClinicalDocument[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      // First load - seed with initial data
      saveClinicalDocuments(clinicalDocuments);
      return [...clinicalDocuments];
    }
    return JSON.parse(stored) as ClinicalDocument[];
  } catch (error) {
    console.error("Error reading clinical documents from localStorage:", error);
    return [...clinicalDocuments];
  }
}

/**
 * Save clinical documents to localStorage.
 */
export function saveClinicalDocuments(docs: ClinicalDocument[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
    // Dispatch event so other components can react to changes
    window.dispatchEvent(new CustomEvent("clinical-documents-changed"));
  } catch (error) {
    console.error("Error saving clinical documents to localStorage:", error);
  }
}

/**
 * Update a single clinical document.
 */
export function updateClinicalDocument(
  id: string,
  updates: Partial<ClinicalDocument>
): void {
  const docs = getClinicalDocuments();
  const index = docs.findIndex((doc) => doc.id === id);
  if (index !== -1) {
    docs[index] = { ...docs[index], ...updates };
    saveClinicalDocuments(docs);
  }
}

/**
 * Get count of new (unreviewed) clinical documents.
 */
export function getNewClinicalDocumentsCount(): number {
  const docs = getClinicalDocuments();
  return docs.filter((doc) => doc.reviewedAt === null).length;
}

/**
 * Mark a clinical document as opened.
 */
export function markClinicalDocumentOpened(id: string): void {
  const docs = getClinicalDocuments();
  const doc = docs.find((d) => d.id === id);
  if (doc && !doc.openedAt) {
    updateClinicalDocument(id, { openedAt: new Date().toISOString() });
  }
}

/**
 * Mark a clinical document as reviewed.
 */
export function markClinicalDocumentReviewed(id: string): void {
  updateClinicalDocument(id, {
    reviewedAt: new Date().toISOString(),
    status: "Reviewed",
  });
}
