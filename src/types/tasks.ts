export type TaskStatus = "Open" | "Done" | "Snoozed";

export type TaskSource = "Manual" | "CarePlan" | "Visits" | "System";

export type TaskPriority = "Low" | "Medium" | "High";

export interface Task {
  id: string;
  patientId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  source: TaskSource;
  priority: TaskPriority;
  dueAt?: string; // ISO date string
  createdAt: string; // ISO date string
  completedAt?: string; // ISO date string
  meta?: Record<string, any>; // Include completedByRole, etc.
  link?: string; // Route to related area
}

// Helper to get task status display color
// Using 700 text shades for better visual comfort
export function getTaskStatusColor(status: TaskStatus): string {
  switch (status) {
    case "Open":
      return "bg-blue-100 text-blue-700";
    case "Done":
      return "bg-green-100 text-green-700";
    case "Snoozed":
      return "bg-gray-100 text-gray-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

// Helper to get task priority display color
// Using 700 text shades for better visual comfort
export function getTaskPriorityColor(priority: TaskPriority): string {
  switch (priority) {
    case "High":
      return "bg-red-100 text-red-700";
    case "Medium":
      return "bg-yellow-100 text-yellow-700";
    case "Low":
      return "bg-green-100 text-green-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

// Helper to get task source display color
// Using 700 text shades for better visual comfort
export function getTaskSourceColor(source: TaskSource): string {
  switch (source) {
    case "Manual":
      return "bg-purple-100 text-purple-700";
    case "CarePlan":
      return "bg-blue-100 text-blue-700";
    case "Visits":
      return "bg-teal-100 text-teal-700";
    case "System":
      return "bg-gray-100 text-gray-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

// Helper to check if task is overdue
export function isTaskOverdue(task: Task): boolean {
  if (!task.dueAt || task.status === "Done") return false;
  return new Date(task.dueAt) < new Date();
}

// Helper to get due date label
export function getDueDateLabel(dueAt: string): string {
  const due = new Date(dueAt);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dueDate = new Date(due.getFullYear(), due.getMonth(), due.getDate());

  if (dueDate.getTime() === today.getTime()) {
    return "Due today";
  } else if (dueDate.getTime() === tomorrow.getTime()) {
    return "Due tomorrow";
  } else if (dueDate < today) {
    const days = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    return `Overdue by ${days} day${days === 1 ? "" : "s"}`;
  } else {
    return `Due ${due.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  }
}
