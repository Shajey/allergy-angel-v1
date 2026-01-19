export type MessageSender = "Patient" | "Caregiver" | "VNS";
export type ThreadStatus = "Open" | "Closed";

export interface Message {
  id: string;
  sender: MessageSender;
  body: string;
  createdAt: string; // ISO date string
}

export interface MessageThread {
  id: string;
  patientId: string;
  subject: string;
  participants: MessageSender[];
  messages: Message[];
  status: ThreadStatus;
  createdAt: string; // ISO date string
  // Track if this thread is for a document request
  requestedDocKey?: string;
}
