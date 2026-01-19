export type NotificationType = "Info" | "ActionRequired" | "Success";

export interface Notification {
  id: string;
  patientId: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  createdAt: string; // ISO date string
  actionLink?: string;
}
