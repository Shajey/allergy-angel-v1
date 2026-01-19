import type { MessageThread, Message, MessageSender } from "@/types/messages";
import { getSession } from "./sessionStore";
import { PATIENTS } from "./mockPeople";

const STORAGE_KEY = "vns-messages";

// Mock message threads for seeding
const mockThreads: MessageThread[] = [
  {
    id: "thread-1",
    patientId: "patient-1",
    subject: "Welcome to CareOS",
    participants: ["Caregiver", "CareOS"],
    status: "Open",
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    messages: [
      {
        id: "msg-1",
        sender: "CareOS",
        body: "Welcome to CareOS! We're here to help you manage your care. Feel free to reach out if you have any questions about your care plan, documents, or services.",
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "msg-2",
        sender: "Caregiver",
        body: `Thank you! I have a question about the required documents for ${PATIENTS.CHILD_1.fullName}'s care plan. Where can I find the full list?`,
        createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "msg-3",
        sender: "CareOS",
        body: "You can find all required documents under the Care Plan section. Navigate to Care Plan from the main menu, and you'll see a checklist of all required documents with their current status. If any documents are missing, you can upload them directly from there.",
        createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000 + 3600000).toISOString(),
      },
    ],
  },
  {
    id: "thread-2",
    patientId: "patient-2",
    subject: "Scheduling Question",
    participants: ["Caregiver", "CareOS"],
    status: "Closed",
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    messages: [
      {
        id: "msg-4",
        sender: "Caregiver",
        body: `Hi, I need to reschedule ${PATIENTS.CHILD_2.fullName}'s next home visit. Is that possible?`,
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "msg-5",
        sender: "CareOS",
        body: "Of course! Please call our scheduling line or I can help you find an available time. What works best for you?",
        createdAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "msg-6",
        sender: "Caregiver",
        body: "I'll call the scheduling line. Thank you!",
        createdAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000 + 7200000).toISOString(),
      },
      {
        id: "msg-7",
        sender: "CareOS",
        body: "You're welcome! This thread is now closed. Feel free to start a new conversation if you need anything else.",
        createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
  },
];

/**
 * Save threads to localStorage.
 */
function saveThreads(threads: MessageThread[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(threads));
  } catch (error) {
    console.error("Error saving messages to localStorage:", error);
  }
}

/**
 * Get all threads from localStorage.
 * Seeds with mock data if storage is empty.
 */
function getAllThreads(): MessageThread[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      // First load - seed with mock data
      saveThreads(mockThreads);
      return mockThreads;
    }
    return JSON.parse(stored) as MessageThread[];
  } catch (error) {
    console.error("Error reading messages from localStorage:", error);
    return mockThreads;
  }
}

/**
 * Get threads for a specific patient.
 */
export function getThreads(patientId: string): MessageThread[] {
  const allThreads = getAllThreads();
  return allThreads
    .filter((t) => t.patientId === patientId)
    .sort((a, b) => {
      // Sort by most recent message
      const aLastMsg = a.messages[a.messages.length - 1];
      const bLastMsg = b.messages[b.messages.length - 1];
      const aTime = aLastMsg ? new Date(aLastMsg.createdAt).getTime() : new Date(a.createdAt).getTime();
      const bTime = bLastMsg ? new Date(bLastMsg.createdAt).getTime() : new Date(b.createdAt).getTime();
      return bTime - aTime;
    });
}

/**
 * Get a single thread by ID.
 */
export function getThreadById(threadId: string): MessageThread | undefined {
  const allThreads = getAllThreads();
  return allThreads.find((t) => t.id === threadId);
}

/**
 * Add a new thread.
 */
export function addThread(thread: Omit<MessageThread, "id" | "createdAt">): MessageThread {
  const allThreads = getAllThreads();
  const newThread: MessageThread = {
    ...thread,
    id: `thread-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  allThreads.push(newThread);
  saveThreads(allThreads);
  
  // Dispatch event for UI updates
  window.dispatchEvent(new CustomEvent("messages-changed"));
  
  return newThread;
}

/**
 * Add a message to an existing thread.
 */
export function addMessage(threadId: string, sender: MessageSender, body: string): Message | null {
  const allThreads = getAllThreads();
  const index = allThreads.findIndex((t) => t.id === threadId);
  
  if (index === -1) return null;
  
  const newMessage: Message = {
    id: `msg-${Date.now()}`,
    sender,
    body,
    createdAt: new Date().toISOString(),
  };
  
  allThreads[index].messages.push(newMessage);
  
  // Ensure participant is in list
  if (!allThreads[index].participants.includes(sender)) {
    allThreads[index].participants.push(sender);
  }
  
  saveThreads(allThreads);
  window.dispatchEvent(new CustomEvent("messages-changed"));
  
  return newMessage;
}

/**
 * Find a thread by requested document key.
 */
export function findThreadByDocKey(patientId: string, docKey: string): MessageThread | undefined {
  const allThreads = getAllThreads();
  return allThreads.find(
    (t) => t.patientId === patientId && t.requestedDocKey === docKey && t.status === "Open"
  );
}

/**
 * Create a document request thread.
 * Adjusts message content based on sender role.
 */
export function createDocumentRequestThread(
  patientId: string,
  documentName: string,
  senderRole: MessageSender
): MessageThread {
  const session = getSession();
  const patient = session.patients.find((p) => p.id === patientId);
  const patientName = patient?.fullName || "the patient";
  
  // Customize message based on role
  let messageBody: string;
  if (senderRole === "Caregiver") {
    messageBody = `Hello, I am the caregiver for ${patientName} and am requesting the "${documentName}" document for their care plan. Could you please provide this document or let me know what information is needed?`;
  } else {
    messageBody = `Hello, I am requesting the "${documentName}" document for my care plan. Could you please provide this document or let me know what information is needed?`;
  }
  
  return addThread({
    patientId,
    subject: `Request: ${documentName}`,
    participants: [senderRole, "CareOS"],
    status: "Open",
    requestedDocKey: documentName,
    messages: [
      {
        id: `msg-${Date.now()}`,
        sender: senderRole,
        body: messageBody,
        createdAt: new Date().toISOString(),
      },
    ],
  });
}

/**
 * Add CareOS acknowledgment message when a document is uploaded.
 */
export function addCareOSDocumentAcknowledgment(threadId: string, documentName: string): Message | null {
  const allThreads = getAllThreads();
  const index = allThreads.findIndex((t) => t.id === threadId);
  
  if (index === -1) return null;
  
  const ackMessage: Message = {
    id: `msg-${Date.now()}`,
    sender: "CareOS",
    body: `Thank you for uploading the "${documentName}" document. We have received it and it is now being processed. You will be notified once it has been reviewed and approved.`,
    createdAt: new Date().toISOString(),
  };
  
  allThreads[index].messages.push(ackMessage);
  allThreads[index].status = "Closed";
  
  saveThreads(allThreads);
  window.dispatchEvent(new CustomEvent("messages-changed"));
  
  return ackMessage;
}

/**
 * Close a thread.
 */
export function closeThread(threadId: string): void {
  const allThreads = getAllThreads();
  const index = allThreads.findIndex((t) => t.id === threadId);
  if (index !== -1) {
    allThreads[index].status = "Closed";
    saveThreads(allThreads);
    window.dispatchEvent(new CustomEvent("messages-changed"));
  }
}
