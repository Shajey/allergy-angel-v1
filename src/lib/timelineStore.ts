import type { TimelineEvent } from "@/types/timeline";

const STORAGE_KEY_PREFIX = "vns.timeline";

/**
 * Get storage key for a specific patient.
 */
function getStorageKey(patientId: string): string {
  return `${STORAGE_KEY_PREFIX}.${patientId}`;
}

/**
 * Save events for a patient to localStorage.
 */
function saveEvents(patientId: string, events: TimelineEvent[]): void {
  try {
    localStorage.setItem(getStorageKey(patientId), JSON.stringify(events));
  } catch (error) {
    console.error("Error saving timeline events to localStorage:", error);
  }
}

/**
 * Get all events for a patient from localStorage.
 * Returns sorted newest first.
 */
export function getEvents(patientId: string): TimelineEvent[] {
  try {
    const stored = localStorage.getItem(getStorageKey(patientId));
    if (!stored) {
      // Seed if empty
      seedEventsIfEmpty(patientId);
      const seeded = localStorage.getItem(getStorageKey(patientId));
      if (seeded) {
        return JSON.parse(seeded) as TimelineEvent[];
      }
      return [];
    }
    const events = JSON.parse(stored) as TimelineEvent[];
    // Sort newest first
    return events.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (error) {
    console.error("Error reading timeline events from localStorage:", error);
    return [];
  }
}

/**
 * Add a new event for a patient.
 */
export function addEvent(
  event: Omit<TimelineEvent, "id" | "createdAt">
): TimelineEvent {
  const events = getEventsRaw(event.patientId);
  const newEvent: TimelineEvent = {
    ...event,
    id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
  };
  events.push(newEvent);
  saveEvents(event.patientId, events);
  
  // Dispatch event for UI updates
  window.dispatchEvent(new CustomEvent("timeline-changed"));
  
  return newEvent;
}

/**
 * Get events without seeding (internal use).
 */
function getEventsRaw(patientId: string): TimelineEvent[] {
  try {
    const stored = localStorage.getItem(getStorageKey(patientId));
    if (!stored) return [];
    return JSON.parse(stored) as TimelineEvent[];
  } catch {
    return [];
  }
}

/**
 * Seed events for a patient if they don't exist.
 */
export function seedEventsIfEmpty(patientId: string): void {
  const existing = getEventsRaw(patientId);
  if (existing.length > 0) return;

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  const seedEvents: TimelineEvent[] = [
    {
      id: `seed-${patientId}-1`,
      patientId,
      type: "DocumentUploaded",
      title: "Uploaded: Insurance Card",
      description: "Insurance card document was uploaded to the portal.",
      createdAt: new Date(now - 7 * day).toISOString(),
      link: "/documents",
    },
    {
      id: `seed-${patientId}-2`,
      patientId,
      type: "ChecklistItemMet",
      title: "Requirement met: Insurance Card",
      description: "The Insurance Card requirement has been fulfilled.",
      createdAt: new Date(now - 7 * day + 1000).toISOString(),
      link: "/care-plan",
    },
    {
      id: `seed-${patientId}-3`,
      patientId,
      type: "MessageSent",
      title: "Message sent: Welcome to VNS Health Portal",
      description: "A message was sent in the conversation thread.",
      createdAt: new Date(now - 5 * day).toISOString(),
      link: "/messages",
    },
    {
      id: `seed-${patientId}-4`,
      patientId,
      type: "DocRequestedFromVNS",
      title: "Requested from VNS: Plan of Care",
      description: "A request was sent to VNS Provider Services for this document.",
      createdAt: new Date(now - 3 * day).toISOString(),
      link: "/messages",
    },
    {
      id: `seed-${patientId}-5`,
      patientId,
      type: "DocumentStatusChanged",
      title: "Document status: Available",
      description: "A document status was updated to Available.",
      createdAt: new Date(now - 2 * day).toISOString(),
      link: "/documents",
    },
    {
      id: `seed-${patientId}-6`,
      patientId,
      type: "NotificationCreated",
      title: "Notification: Missing Required Documents",
      description: "A notification was created about missing documents.",
      createdAt: new Date(now - 1 * day).toISOString(),
      link: "/care-plan",
    },
  ];

  saveEvents(patientId, seedEvents);
}

// Convenience functions for adding specific event types

import { getSession } from "./sessionStore";

export function addDocumentUploadedEvent(
  patientId: string,
  documentTitle: string,
  docKey?: string
): TimelineEvent {
  const session = getSession();
  const role = session.user.role;
  const patient = session.patients.find((p) => p.id === patientId);
  
  let description: string;
  if (role === "Caregiver" && patient) {
    description = docKey
      ? `Caregiver uploaded "${documentTitle}" for ${patient.fullName}'s "${docKey}" requirement.`
      : `Caregiver uploaded "${documentTitle}" for ${patient.fullName}.`;
  } else {
    description = docKey
      ? `Document "${documentTitle}" was uploaded for requirement "${docKey}".`
      : `Document "${documentTitle}" was uploaded.`;
  }
  
  return addEvent({
    patientId,
    type: "DocumentUploaded",
    title: `Uploaded: ${documentTitle}`,
    description,
    link: "/documents",
    meta: { documentTitle, docKey, senderRole: role },
  });
}

export function addDocRequestedEvent(
  patientId: string,
  docKey: string
): TimelineEvent {
  const session = getSession();
  const role = session.user.role;
  const patient = session.patients.find((p) => p.id === patientId);
  
  let description: string;
  if (role === "Caregiver" && patient) {
    description = `Caregiver requested "${docKey}" from VNS Provider Services on behalf of ${patient.fullName}.`;
  } else {
    description = `Patient requested "${docKey}" from VNS Provider Services.`;
  }
  
  return addEvent({
    patientId,
    type: "DocRequestedFromVNS",
    title: `Requested from VNS: ${docKey}`,
    description,
    link: "/messages",
    meta: { docKey, senderRole: role },
  });
}

export function addMessageSentEvent(
  patientId: string,
  threadSubject: string,
  sender: string
): TimelineEvent {
  const session = getSession();
  const patient = session.patients.find((p) => p.id === patientId);
  
  let description: string;
  if (sender === "Caregiver" && patient) {
    description = `Caregiver sent a message in "${threadSubject}" for ${patient.fullName}.`;
  } else if (sender === "Patient") {
    description = `Patient sent a message in "${threadSubject}".`;
  } else {
    description = `${sender} sent a message in "${threadSubject}".`;
  }
  
  return addEvent({
    patientId,
    type: "MessageSent",
    title: `Message sent: ${threadSubject}`,
    description,
    link: "/messages",
    meta: { threadSubject, sender },
  });
}

export function addChecklistItemMetEvent(
  patientId: string,
  docKey: string
): TimelineEvent {
  return addEvent({
    patientId,
    type: "ChecklistItemMet",
    title: `Requirement met: ${docKey}`,
    description: `The "${docKey}" requirement has been fulfilled.`,
    link: "/care-plan",
    meta: { docKey },
  });
}

export function addDocumentStatusChangedEvent(
  patientId: string,
  documentTitle: string,
  newStatus: string
): TimelineEvent {
  return addEvent({
    patientId,
    type: "DocumentStatusChanged",
    title: `Document status: ${newStatus}`,
    description: `"${documentTitle}" status changed to ${newStatus}.`,
    link: "/documents",
    meta: { documentTitle, newStatus },
  });
}
