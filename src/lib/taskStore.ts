import type { Task } from "@/types/tasks";
import { getSession } from "./sessionStore";
import { getDocuments } from "./storage";
import { getRequiredDocsForServiceLine } from "./serviceLines";
import { getUpcomingVisits } from "./visitStore";

const STORAGE_KEY_PREFIX = "vns.tasks";

/**
 * Get storage key for a specific patient.
 */
function getStorageKey(patientId: string): string {
  return `${STORAGE_KEY_PREFIX}.${patientId}`;
}

/**
 * Save tasks for a patient to localStorage.
 */
function saveTasks(patientId: string, tasks: Task[]): void {
  try {
    localStorage.setItem(getStorageKey(patientId), JSON.stringify(tasks));
  } catch (error) {
    console.error("Error saving tasks to localStorage:", error);
  }
}

/**
 * Get tasks for a patient from localStorage (without seeding).
 */
function getTasksRaw(patientId: string): Task[] {
  try {
    const stored = localStorage.getItem(getStorageKey(patientId));
    if (!stored) return [];
    return JSON.parse(stored) as Task[];
  } catch {
    return [];
  }
}

/**
 * Get all tasks for a patient from localStorage.
 * Seeds with mock data if storage is empty.
 */
export function getTasks(patientId: string): Task[] {
  try {
    const stored = localStorage.getItem(getStorageKey(patientId));
    if (!stored) {
      // Seed if empty
      seedTasksIfEmpty(patientId);
      const seeded = localStorage.getItem(getStorageKey(patientId));
      if (seeded) {
        return JSON.parse(seeded) as Task[];
      }
      return [];
    }
    return JSON.parse(stored) as Task[];
  } catch (error) {
    console.error("Error reading tasks from localStorage:", error);
    return [];
  }
}

/**
 * Add a new task.
 */
export function addTask(task: Omit<Task, "id" | "createdAt"> & { id?: string }): Task {
  const tasks = getTasksRaw(task.patientId);
  const newTask: Task = {
    ...task,
    id: task.id || `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
  };
  tasks.push(newTask);
  saveTasks(task.patientId, tasks);
  
  // Dispatch event for UI updates
  window.dispatchEvent(new CustomEvent("tasks-changed"));
  
  return newTask;
}

/**
 * Update a task (for status changes, etc.).
 */
export function updateTask(
  patientId: string,
  taskId: string,
  patch: Partial<Task>
): Task | null {
  const tasks = getTasksRaw(patientId);
  const index = tasks.findIndex((t) => t.id === taskId);
  
  if (index === -1) return null;
  
  tasks[index] = { ...tasks[index], ...patch };
  saveTasks(patientId, tasks);
  
  // Dispatch event for UI updates
  window.dispatchEvent(new CustomEvent("tasks-changed"));
  
  return tasks[index];
}

/**
 * Delete a task.
 */
export function deleteTask(patientId: string, taskId: string): boolean {
  const tasks = getTasksRaw(patientId);
  const filtered = tasks.filter((t) => t.id !== taskId);
  
  if (filtered.length === tasks.length) return false;
  
  saveTasks(patientId, filtered);
  window.dispatchEvent(new CustomEvent("tasks-changed"));
  
  return true;
}

/**
 * Get a single task by ID.
 */
export function getTaskById(patientId: string, taskId: string): Task | undefined {
  const tasks = getTasksRaw(patientId);
  return tasks.find((t) => t.id === taskId);
}

/**
 * Seed tasks for a patient if they don't exist.
 * Creates 5-7 tasks with mix due today/soon.
 */
export function seedTasksIfEmpty(patientId: string): void {
  const existing = getTasksRaw(patientId);
  if (existing.length > 0) return;

  const now = new Date();
  const day = 24 * 60 * 60 * 1000;

  const seedTasks: Task[] = [
    {
      id: `seed-${patientId}-1`,
      patientId,
      title: "Review medication schedule",
      description: "Review your current medication schedule and update any changes with your care team.",
      status: "Open",
      source: "Manual",
      priority: "Medium",
      dueAt: new Date(now.getTime()).toISOString(), // Due today
      createdAt: new Date(now.getTime() - 2 * day).toISOString(),
      link: "/care-plan",
    },
    {
      id: `seed-${patientId}-2`,
      patientId,
      title: "Confirm next visit time",
      description: "Confirm the time and location for your upcoming nursing visit.",
      status: "Open",
      source: "Visits",
      priority: "High",
      dueAt: new Date(now.getTime() + 1 * day).toISOString(), // Due tomorrow
      createdAt: new Date(now.getTime() - 1 * day).toISOString(),
      link: "/visits",
    },
    {
      id: `seed-${patientId}-3`,
      patientId,
      title: "Complete care plan survey",
      description: "Fill out the monthly care plan satisfaction survey.",
      status: "Open",
      source: "CarePlan",
      priority: "Low",
      dueAt: new Date(now.getTime() + 5 * day).toISOString(),
      createdAt: new Date(now.getTime() - 3 * day).toISOString(),
      link: "/care-plan",
    },
    {
      id: `seed-${patientId}-4`,
      patientId,
      title: "Schedule follow-up appointment",
      description: "Contact your primary care physician to schedule a follow-up appointment.",
      status: "Open",
      source: "Manual",
      priority: "Medium",
      dueAt: new Date(now.getTime() + 3 * day).toISOString(),
      createdAt: new Date(now.getTime() - 4 * day).toISOString(),
    },
    {
      id: `seed-${patientId}-5`,
      patientId,
      title: "Prepare questions for nurse visit",
      description: "Write down any questions or concerns for your next nursing visit.",
      status: "Open",
      source: "Manual",
      priority: "Low",
      dueAt: new Date(now.getTime() + 2 * day).toISOString(),
      createdAt: new Date(now.getTime() - 1 * day).toISOString(),
      link: "/visits",
    },
  ];

  saveTasks(patientId, seedTasks);
}

/**
 * Ensure auto-generated tasks exist for a patient.
 * Creates/updates tasks based on:
 * A) Missing care plan items
 * B) Upcoming visits in next 7 days
 */
export function ensureAutoTasks(patientId: string): void {
  const session = getSession();
  const patient = session.patients.find((p) => p.id === patientId);
  if (!patient) return;

  const tasks = getTasksRaw(patientId);
  let updated = false;

  // A) Missing care plan items => task: "Upload: <doc name>"
  const requiredDocs = getRequiredDocsForServiceLine(patient.serviceLineId);
  const patientDocs = getDocuments().filter((doc) => doc.patientId === patientId);

  requiredDocs.forEach((rule) => {
    if (rule.optional) return; // Skip optional docs

    const matchingDocs = patientDocs.filter((doc) => doc.requiredDocKey === rule.key);
    const hasAvailableDoc = matchingDocs.some((doc) => doc.status === "Available");

    const autoTaskId = `auto.careplan.${rule.key}`;
    const existingTaskIndex = tasks.findIndex((t) => t.id === autoTaskId);

    if (!hasAvailableDoc) {
      // Create or ensure task exists
      if (existingTaskIndex === -1) {
        // Create new task
        const now = new Date();
        const dueInDays = 7; // Due in 7 days
        tasks.push({
          id: autoTaskId,
          patientId,
          title: `Upload: ${rule.key}`,
          description: rule.description,
          status: "Open",
          source: "CarePlan",
          priority: "High",
          dueAt: new Date(now.getTime() + dueInDays * 24 * 60 * 60 * 1000).toISOString(),
          createdAt: new Date().toISOString(),
          link: "/care-plan",
          meta: { docKey: rule.key },
        });
        updated = true;
      } else if (tasks[existingTaskIndex].status === "Done") {
        // Reopen if it was marked done but doc is still missing
        tasks[existingTaskIndex].status = "Open";
        updated = true;
      }
    } else {
      // Mark task as done if doc is now available
      if (existingTaskIndex !== -1 && tasks[existingTaskIndex].status !== "Done") {
        tasks[existingTaskIndex].status = "Done";
        tasks[existingTaskIndex].completedAt = new Date().toISOString();
        tasks[existingTaskIndex].meta = {
          ...tasks[existingTaskIndex].meta,
          autoCompleted: true,
        };
        updated = true;
      }
    }
  });

  // B) Upcoming visits in next 7 days => task: "Confirm visit details"
  const upcomingVisits = getUpcomingVisits(patientId);
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  upcomingVisits.forEach((visit) => {
    const visitDate = new Date(visit.startAt);
    if (visitDate > sevenDaysFromNow) return; // Only visits in next 7 days

    const autoTaskId = `auto.visit.${visit.id}`;
    const existingTaskIndex = tasks.findIndex((t) => t.id === autoTaskId);

    // Only create task for scheduled visits (not cancelled or pending change)
    if (visit.status === "Scheduled") {
      if (existingTaskIndex === -1) {
        // Create new task
        const visitDateStr = visitDate.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
        tasks.push({
          id: autoTaskId,
          patientId,
          title: `Confirm ${visit.type} visit on ${visitDateStr}`,
          description: `Confirm details for your ${visit.type} visit scheduled for ${visitDateStr}.`,
          status: "Open",
          source: "Visits",
          priority: "Medium",
          dueAt: new Date(visitDate.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(), // Due 1 day before visit
          createdAt: new Date().toISOString(),
          link: "/visits",
          meta: { visitId: visit.id },
        });
        updated = true;
      }
    } else {
      // Remove or mark done if visit is cancelled/changed
      if (existingTaskIndex !== -1 && tasks[existingTaskIndex].status === "Open") {
        tasks[existingTaskIndex].status = "Done";
        tasks[existingTaskIndex].completedAt = new Date().toISOString();
        tasks[existingTaskIndex].meta = {
          ...tasks[existingTaskIndex].meta,
          autoCompleted: true,
        };
        updated = true;
      }
    }
  });

  if (updated) {
    saveTasks(patientId, tasks);
    window.dispatchEvent(new CustomEvent("tasks-changed"));
  }
}

/**
 * Get open tasks for a patient (sorted by due date then priority).
 */
export function getOpenTasks(patientId: string): Task[] {
  const tasks = getTasks(patientId);
  return tasks
    .filter((t) => t.status === "Open")
    .sort((a, b) => {
      // Sort by due date first (ascending), then priority
      if (a.dueAt && b.dueAt) {
        const dateCompare = new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
        if (dateCompare !== 0) return dateCompare;
      } else if (a.dueAt) {
        return -1; // Tasks with due date come first
      } else if (b.dueAt) {
        return 1;
      }

      // Then by priority (High -> Medium -> Low)
      const priorityOrder = { High: 0, Medium: 1, Low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
}

/**
 * Get top priority tasks (up to limit).
 */
export function getTopTasks(patientId: string, limit: number = 5): Task[] {
  const openTasks = getOpenTasks(patientId);
  return openTasks.slice(0, limit);
}

/**
 * Get done tasks for a patient (sorted by completion date descending).
 */
export function getDoneTasks(patientId: string): Task[] {
  const tasks = getTasks(patientId);
  return tasks
    .filter((t) => t.status === "Done")
    .sort((a, b) => {
      if (a.completedAt && b.completedAt) {
        return new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime();
      }
      return 0;
    });
}
