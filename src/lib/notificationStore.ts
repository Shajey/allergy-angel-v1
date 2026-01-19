import type { Notification } from "@/types/notifications";

const STORAGE_KEY = "vns-notifications";

// Mock notifications for seeding
const mockNotifications: Notification[] = [
  {
    id: "notif-1",
    patientId: "patient-1",
    title: "Missing Required Documents",
    message: "Some required documents for your care plan are missing. Please upload them at your earliest convenience.",
    type: "ActionRequired",
    read: false,
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
    actionLink: "/care-plan",
  },
  {
    id: "notif-2",
    patientId: "patient-1",
    title: "Welcome to CareOS",
    message: "Your patient portal is now active. You can view documents, track your care plan, and message your care team.",
    type: "Info",
    read: true,
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
  },
  {
    id: "notif-3",
    patientId: "patient-2",
    title: "Care Plan Updated",
    message: "Your care plan has been updated by your care team.",
    type: "Info",
    read: false,
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
    actionLink: "/care-plan",
  },
];

/**
 * Save notifications to localStorage.
 */
function saveNotifications(notifications: Notification[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
  } catch (error) {
    console.error("Error saving notifications to localStorage:", error);
  }
}

/**
 * Get all notifications from localStorage.
 * Seeds with mock data if storage is empty.
 */
export function getAllNotifications(): Notification[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      // First load - seed with mock data
      saveNotifications(mockNotifications);
      return mockNotifications;
    }
    return JSON.parse(stored) as Notification[];
  } catch (error) {
    console.error("Error reading notifications from localStorage:", error);
    return mockNotifications;
  }
}

/**
 * Get notifications for a specific patient.
 */
export function getNotifications(patientId: string): Notification[] {
  const allNotifications = getAllNotifications();
  return allNotifications
    .filter((n) => n.patientId === patientId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Get unread notification count for a patient.
 */
export function getUnreadCount(patientId: string): number {
  const notifications = getNotifications(patientId);
  return notifications.filter((n) => !n.read).length;
}

/**
 * Add a new notification.
 */
export function addNotification(notification: Omit<Notification, "id" | "createdAt" | "read">): Notification {
  const allNotifications = getAllNotifications();
  const newNotification: Notification = {
    ...notification,
    id: `notif-${Date.now()}`,
    read: false,
    createdAt: new Date().toISOString(),
  };
  allNotifications.push(newNotification);
  saveNotifications(allNotifications);
  
  // Dispatch event for UI updates
  window.dispatchEvent(new CustomEvent("notifications-changed"));
  
  return newNotification;
}

/**
 * Mark a notification as read.
 */
export function markRead(notificationId: string): void {
  const allNotifications = getAllNotifications();
  const index = allNotifications.findIndex((n) => n.id === notificationId);
  if (index !== -1) {
    allNotifications[index].read = true;
    saveNotifications(allNotifications);
    window.dispatchEvent(new CustomEvent("notifications-changed"));
  }
}

/**
 * Mark all notifications as read for a patient.
 */
export function markAllRead(patientId: string): void {
  const allNotifications = getAllNotifications();
  let changed = false;
  allNotifications.forEach((n) => {
    if (n.patientId === patientId && !n.read) {
      n.read = true;
      changed = true;
    }
  });
  if (changed) {
    saveNotifications(allNotifications);
    window.dispatchEvent(new CustomEvent("notifications-changed"));
  }
}

/**
 * Create a notification for a document request.
 */
export function createDocumentRequestNotification(
  patientId: string,
  documentName: string
): Notification {
  return addNotification({
    patientId,
    title: "Document Requested",
    message: `You requested "${documentName}" from CareOS Team.`,
    type: "Info",
    actionLink: "/messages",
  });
}

/**
 * Create a success notification for document receipt.
 */
export function createDocumentReceivedNotification(
  patientId: string,
  documentName: string
): Notification {
  return addNotification({
    patientId,
    title: "Document Received",
    message: `CareOS Team has received your "${documentName}" document.`,
    type: "Success",
  });
}
