import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import PageShell, { PageShellContent } from "@/components/layout/PageShell";
import PageHeader from "@/components/layout/PageHeader";
import { useViewMode } from "@/context/ViewModeContext";
import { isClinician, getHeaderCopy, getCardClassName } from "@/lib/viewMode";
import { getSession } from "@/lib/sessionStore";
import {
  getTasks,
  addTask,
  updateTask,
  deleteTask,
  ensureAutoTasks,
} from "@/lib/taskStore";
import { addNotification } from "@/lib/notificationStore";
import { addEvent } from "@/lib/timelineStore";
import type { Task, TaskPriority } from "@/types/tasks";
import {
  getTaskStatusColor,
  getTaskSourceColor,
  getTaskPriorityColor,
  getDueDateLabel,
  isTaskOverdue,
} from "@/types/tasks";
import { showToast } from "@/lib/toast";

type FilterType = "all" | "open" | "done";

export default function TasksPage() {
  const { viewMode } = useViewMode();
  const navigate = useNavigate();
  const [session, setSession] = useState(getSession());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<FilterType>("all");
  const [isAddingTask, setIsAddingTask] = useState(false);

  // Add task form state
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>("Medium");

  /**
   * Load tasks for the active patient.
   */
  const loadTasks = () => {
    const currentSession = getSession();
    setSession(currentSession);

    const patientId = currentSession.activePatientId;

    // Ensure auto tasks are created
    ensureAutoTasks(patientId);

    // Load tasks
    const allTasks = getTasks(patientId);
    setTasks(allTasks);
  };

  useEffect(() => {
    loadTasks();

    // Listen for changes
    const handleChange = () => {
      loadTasks();
    };

    window.addEventListener("session-changed", handleChange);
    window.addEventListener("tasks-changed", handleChange);

    return () => {
      window.removeEventListener("session-changed", handleChange);
      window.removeEventListener("tasks-changed", handleChange);
    };
  }, []);

  /**
   * Handle task completion toggle.
   */
  const handleTaskToggle = (task: Task) => {
    if (task.status === "Done") {
      // Reopen task
      updateTask(task.patientId, task.id, {
        status: "Open",
        completedAt: undefined,
        meta: {
          ...task.meta,
          completedByRole: undefined,
        },
      });

      showToast(`"${task.title}" has been reopened.`, "success");
    } else {
      // Complete task
      const completedAt = new Date().toISOString();
      const role = session.user.role;

      updateTask(task.patientId, task.id, {
        status: "Done",
        completedAt,
        meta: {
          ...task.meta,
          completedByRole: role,
        },
      });

      // Create notification
      addNotification({
        patientId: task.patientId,
        title: "Task Completed",
        message: `"${task.title}" has been completed.`,
        type: "Success",
        actionLink: "/tasks",
      });

      // Create timeline event
      const patient = session.patients.find((p) => p.id === task.patientId);
      const patientName = patient?.fullName || "the patient";

      let description: string;
      if (role === "Caregiver" && patient) {
        description = `Caregiver completed task "${task.title}" for ${patientName}.`;
      } else {
        description = `Patient completed task "${task.title}".`;
      }

      addEvent({
        patientId: task.patientId,
        type: "TaskCompleted",
        title: `Task completed: ${task.title}`,
        description,
        link: "/tasks",
        meta: { taskId: task.id, completedByRole: role },
      });

      showToast(`"${task.title}" has been marked as done.`, "success");
    }

    loadTasks();
  };

  /**
   * Handle adding a new task.
   */
  const handleAddTask = () => {
    if (!newTaskTitle.trim()) {
      showToast("Task title is required.", "error");
      return;
    }

    const patientId = session.activePatientId;

    addTask({
      patientId,
      title: newTaskTitle.trim(),
      status: "Open",
      source: "Manual",
      priority: newTaskPriority,
      dueAt: newTaskDueDate ? new Date(newTaskDueDate).toISOString() : undefined,
    });

    showToast(`"${newTaskTitle}" has been added to your tasks.`, "success");

    // Reset form
    setNewTaskTitle("");
    setNewTaskDueDate("");
    setNewTaskPriority("Medium");
    setIsAddingTask(false);

    loadTasks();
  };

  /**
   * Handle deleting a task.
   */
  const handleDeleteTask = (task: Task) => {
    if (!confirm(`Are you sure you want to delete "${task.title}"?`)) {
      return;
    }

    deleteTask(task.patientId, task.id);

    showToast(`"${task.title}" has been removed.`, "success");

    loadTasks();
  };

  /**
   * Filter tasks based on selected filter.
   */
  const filteredTasks = tasks.filter((task) => {
    if (filter === "open") return task.status === "Open";
    if (filter === "done") return task.status === "Done";
    return true; // all
  });

  /**
   * Sort tasks: Open tasks by due date/priority, Done tasks by completion date.
   */
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    // Done tasks at the bottom, sorted by completion date (newest first)
    if (a.status === "Done" && b.status === "Done") {
      if (a.completedAt && b.completedAt) {
        return new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime();
      }
      return 0;
    }

    if (a.status === "Done") return 1;
    if (b.status === "Done") return -1;

    // Open tasks sorted by due date (ascending), then priority
    if (a.dueAt && b.dueAt) {
      const dateCompare = new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
      if (dateCompare !== 0) return dateCompare;
    } else if (a.dueAt) {
      return -1;
    } else if (b.dueAt) {
      return 1;
    }

    // Then by priority (High -> Medium -> Low)
    const priorityOrder = { High: 0, Medium: 1, Low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  const getFilterClass = (filterType: FilterType) =>
    `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
      filter === filterType
        ? "bg-blue-100 text-blue-700"
        : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
    }`;

  const activePatient = session.patients.find((p) => p.id === session.activePatientId);
  const patientName = activePatient?.fullName || "patient";
  const _isClinicianMode = isClinician(viewMode);
  const headerCopy = getHeaderCopy("tasks", patientName, viewMode);
  const cardClass = getCardClassName(viewMode);

  return (
    <PageShell>
      <PageHeader
        title={headerCopy.title}
        eyebrow={headerCopy.eyebrow}
        subtitle={headerCopy.subtitle}
        viewMode={viewMode}
      />

      <PageShellContent>
        {/* Section Header */}
        <section>
          <div className="mb-6">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Task Management
            </span>
            <h2 className="text-2xl font-bold text-gray-900 mt-1">Your Tasks</h2>
            <p className="text-sm text-gray-600 mt-1">
              Track and complete tasks related to your care plan
            </p>
          </div>
        </section>

        <Card className={`shadow-sm hover:shadow-md transition-shadow duration-200 ${cardClass}`}>
          <CardHeader className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Task Queue</span>
                <CardTitle className="text-xl font-semibold text-gray-900 mt-1">All Tasks</CardTitle>
              </div>
              <Button onClick={() => setIsAddingTask(!isAddingTask)}>
                {isAddingTask ? "Cancel" : "Add Task"}
              </Button>
            </div>

          {/* Filter Tabs */}
          <div className="flex gap-2 mt-6">
            <button
              className={getFilterClass("all")}
              onClick={() => setFilter("all")}
            >
              All ({tasks.length})
            </button>
            <button
              className={getFilterClass("open")}
              onClick={() => setFilter("open")}
            >
              Open ({tasks.filter((t) => t.status === "Open").length})
            </button>
            <button
              className={getFilterClass("done")}
              onClick={() => setFilter("done")}
            >
              Done ({tasks.filter((t) => t.status === "Done").length})
            </button>
          </div>
        </CardHeader>

        <CardContent>
          {/* Add Task Form */}
          {isAddingTask && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Add New Task
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="Enter task title"
                    className="w-full"
                  />
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Due Date (Optional)
                    </label>
                    <Input
                      type="date"
                      value={newTaskDueDate}
                      onChange={(e) => setNewTaskDueDate(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Priority
                    </label>
                    <Select
                      value={newTaskPriority}
                      onValueChange={(value) => setNewTaskPriority(value as TaskPriority)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Low">Low</SelectItem>
                        <SelectItem value="Medium">Medium</SelectItem>
                        <SelectItem value="High">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleAddTask}>Add Task</Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsAddingTask(false);
                      setNewTaskTitle("");
                      setNewTaskDueDate("");
                      setNewTaskPriority("Medium");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Tasks List */}
          {sortedTasks.length > 0 ? (
            <div className="space-y-2">
              {sortedTasks.map((task) => (
                <div
                  key={task.id}
                  className={`flex items-start gap-3 p-4 border rounded-lg hover:bg-gray-50 transition-colors ${
                    task.status === "Done" ? "opacity-60" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={task.status === "Done"}
                    onChange={() => handleTaskToggle(task)}
                    className="mt-1 w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span
                        className={`text-base font-medium ${
                          task.status === "Done"
                            ? "line-through text-gray-500"
                            : "text-gray-900"
                        }`}
                      >
                        {task.title}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${getTaskStatusColor(task.status)}`}
                      >
                        {task.status}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${getTaskSourceColor(task.source)}`}
                      >
                        {task.source}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${getTaskPriorityColor(task.priority)}`}
                      >
                        {task.priority}
                      </span>
                    </div>
                    {task.description && (
                      <p className="text-sm text-gray-600 mb-1">
                        {task.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      {task.dueAt && task.status !== "Done" && (
                        <span
                          className={
                            isTaskOverdue(task) ? "text-red-600 font-medium" : ""
                          }
                        >
                          {getDueDateLabel(task.dueAt)}
                        </span>
                      )}
                      {task.completedAt && (
                        <span>
                          Completed{" "}
                          {new Date(task.completedAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      )}
                      {task.meta?.completedByRole && (
                        <span>by {task.meta.completedByRole}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {task.link && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(task.link!)}
                      >
                        Go
                      </Button>
                    )}
                    {task.source === "Manual" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteTask(task)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <svg
                className="w-16 h-16 mb-4 text-gray-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              <p className="text-lg font-medium text-gray-900 mb-2">No tasks found</p>
              <p className="text-sm text-gray-500 max-w-sm">
                {filter === "all"
                  ? "You're all caught up! Add a new task or check back later for care team updates."
                  : `No ${filter} tasks at this time. Check other filters or add a new task.`}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      </PageShellContent>
    </PageShell>
  );
}
