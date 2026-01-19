import type { DocumentRecord } from "@/types/documents";
import { mockDocuments } from "./mockDocuments";
import { getSession } from "./sessionStore";

const STORAGE_KEY = "vns-documents";

/**
 * Save documents to localStorage.
 */
export function saveDocuments(docs: DocumentRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
  } catch (error) {
    console.error("Error saving documents to localStorage:", error);
  }
}

/**
 * Get all documents from localStorage.
 * Seeds with mock data if storage is empty.
 * Migrates existing documents without patientId to activePatientId.
 */
export function getDocuments(): DocumentRecord[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    let docs: DocumentRecord[];
    
    if (!stored) {
      // First load - seed with mock data
      const session = getSession();
      docs = mockDocuments.map((doc) => ({
        ...doc,
        patientId: session.activePatientId,
      }));
      saveDocuments(docs);
      return docs;
    }
    
    docs = JSON.parse(stored) as DocumentRecord[];
    
    // Migration: assign patientId to documents that don't have it
    const session = getSession();
    let needsMigration = false;
    const migratedDocs = docs.map((doc) => {
      if (!doc.patientId) {
        needsMigration = true;
        return { ...doc, patientId: session.activePatientId };
      }
      return doc;
    });
    
    if (needsMigration) {
      saveDocuments(migratedDocs);
      return migratedDocs;
    }
    
    return docs;
  } catch (error) {
    console.error("Error reading documents from localStorage:", error);
    const session = getSession();
    return mockDocuments.map((doc) => ({
      ...doc,
      patientId: session.activePatientId,
    }));
  }
}

/**
 * Get a single document by ID.
 */
export function getDocumentById(id: string): DocumentRecord | undefined {
  const docs = getDocuments();
  return docs.find((doc) => doc.id === id);
}

/**
 * Add a new document.
 */
export function addDocument(doc: DocumentRecord): void {
  const docs = getDocuments();
  docs.push(doc);
  saveDocuments(docs);
}

/**
 * Update an existing document.
 */
export function updateDocument(id: string, updates: Partial<DocumentRecord>): void {
  const docs = getDocuments();
  const index = docs.findIndex((doc) => doc.id === id);
  if (index !== -1) {
    docs[index] = { ...docs[index], ...updates };
    saveDocuments(docs);
  }
}

/**
 * Delete a document by ID.
 */
export function deleteDocument(id: string): void {
  const docs = getDocuments();
  const filtered = docs.filter((doc) => doc.id !== id);
  saveDocuments(filtered);
}

/**
 * Clear all documents from localStorage.
 */
export function clearAllDocuments(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Error clearing documents from localStorage:", error);
  }
}
