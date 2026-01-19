import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import PageShell, { PageShellContent } from "@/components/layout/PageShell";
import PageHeader from "@/components/layout/PageHeader";
import { useViewMode } from "@/context/ViewModeContext";
import { getSession } from "@/lib/sessionStore";
import { getTopTasks, ensureAutoTasks, updateTask } from "@/lib/taskStore";
import { getUpcomingVisits } from "@/lib/visitStore";
import { getDocuments } from "@/lib/storage";
import { getNewClinicalDocumentsCount } from "@/data/clinicalDocuments";
import { getRequiredDocsForServiceLine } from "@/lib/serviceLines";
import { getEvents } from "@/lib/timelineStore";
import { addNotification } from "@/lib/notificationStore";
import { addEvent } from "@/lib/timelineStore";
import type { Task } from "@/types/tasks";
import type { Visit } from "@/types/visits";
import type { TimelineEvent } from "@/types/timeline";
import {
  getTaskSourceColor,
  getDueDateLabel,
  isTaskOverdue,
} from "@/types/tasks";
import {
  getVisitTypeColor,
  getVisitStatusColor,
  getVisitStatusLabel,
} from "@/types/visits";
import { showToast } from "@/lib/toast";

/**
 * Format date for display.
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format time for display.
 */
function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Format relative time (e.g., "2 hours ago").
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) {
    return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  } else {
    return formatDate(dateString);
  }
}

export default function TodayPage() {
  const { viewMode } = useViewMode();
  const [session, setSession] = useState(getSession());
  const [nextVisit, setNextVisit] = useState<Visit | null>(null);
  const [topTasks, setTopTasks] = useState<Task[]>([]);
  const [carePlanProgress, setCarePlanProgress] = useState({ met: 0, total: 0 });
  const [recentActivity, setRecentActivity] = useState<TimelineEvent[]>([]);
  const [newClinicalDocsCount, setNewClinicalDocsCount] = useState(0);

  /**
   * Load data for the active patient.
   */
  const loadData = () => {
    const currentSession = getSession();
    setSession(currentSession);

    const patientId = currentSession.activePatientId;
    const patient = currentSession.patients.find((p) => p.id === patientId);

    if (!patient) return;

    // Ensure auto tasks are created
    ensureAutoTasks(patientId);

    // Get next upcoming visit
    const upcomingVisits = getUpcomingVisits(patientId);
    setNextVisit(upcomingVisits.length > 0 ? upcomingVisits[0] : null);

    // Get top 5 tasks
    setTopTasks(getTopTasks(patientId, 5));

    // Calculate care plan progress
    const requiredDocs = getRequiredDocsForServiceLine(patient.serviceLineId);
    const patientDocs = getDocuments().filter((doc) => doc.patientId === patientId);
    
    const requiredCount = requiredDocs.filter((rule) => !rule.optional).length;
    const metCount = requiredDocs
      .filter((rule) => !rule.optional)
      .filter((rule) => {
        const matchingDocs = patientDocs.filter((doc) => doc.requiredDocKey === rule.key);
        return matchingDocs.some((doc) => doc.status === "Available");
      }).length;

    setCarePlanProgress({ met: metCount, total: requiredCount });

    // Get recent timeline events (top 3)
    const events = getEvents(patientId);
    setRecentActivity(events.slice(0, 3));

    // Get new clinical documents count
    setNewClinicalDocsCount(getNewClinicalDocumentsCount());
  };

  useEffect(() => {
    loadData();

    // Listen for changes
    const handleChange = () => {
      loadData();
    };

    window.addEventListener("session-changed", handleChange);
    window.addEventListener("tasks-changed", handleChange);
    window.addEventListener("visits-changed", handleChange);
    window.addEventListener("timeline-changed", handleChange);
    window.addEventListener("clinical-documents-changed", handleChange);

    return () => {
      window.removeEventListener("session-changed", handleChange);
      window.removeEventListener("tasks-changed", handleChange);
      window.removeEventListener("visits-changed", handleChange);
      window.removeEventListener("timeline-changed", handleChange);
      window.removeEventListener("clinical-documents-changed", handleChange);
    };
  }, []);

  /**
   * Handle task completion.
   */
  const handleTaskComplete = (task: Task) => {
    const completedAt = new Date().toISOString();
    const role = session.user.role;

    // Update task
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

    showToast({
      title: "Task Completed",
      description: `"${task.title}" has been marked as done.`,
      type: "success",
    });

    loadData();
  };

  const progressPercentage = carePlanProgress.total > 0
    ? Math.round((carePlanProgress.met / carePlanProgress.total) * 100)
    : 0;

  const activePatient = session.patients.find((p) => p.id === session.activePatientId);
  const patientName = activePatient?.fullName || "patient";

  // Get header copy from shared helper
  const isClinician = viewMode === "clinician";
  const headerSubtitle = isClinician
    ? `Operational overview for ${patientName}`
    : new Date().toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
  const headerBadge = isClinician ? "RN / PT / HHA" : undefined;

  return (
    <PageShell>
      {/* Hero Header - Today is the only page with hero mode */}
      <PageHeader
        title="Today"
        eyebrow="Dashboard"
        subtitle={headerSubtitle}
        badge={headerBadge}
        viewMode={viewMode}
        hero
      >
        {!isClinician && activePatient && (
          <div className="flex items-center gap-3 mt-4 pt-4 border-t border-blue-200/50">
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold text-sm">
              {activePatient.fullName.split(" ").map((n) => n[0]).join("")}
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-500 font-medium">
                Active Patient
              </p>
              <p className="text-base font-semibold text-gray-900">
                {activePatient.fullName}
              </p>
            </div>
          </div>
        )}
      </PageHeader>

      {/* Main Content */}
      <PageShellContent>
          {/* Quick Actions Section */}
          <section>
            <div className="mb-6">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Quick Actions
              </span>
              <h2 className="text-2xl font-bold text-gray-900 mt-1">
                What's Next
              </h2>
            </div>
            <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
              {/* Next Visit */}
              <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
                <CardHeader className="p-6 pb-4">
                  <CardTitle className="text-xl font-semibold flex items-center justify-between">
                    <span>Next Visit</span>
                    <Link to="/visits">
                      <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                        View All →
                      </Button>
                    </Link>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 pt-0 space-y-4">
                  {nextVisit ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-1 rounded-md text-xs font-medium ${getVisitTypeColor(nextVisit.type)}`}
                        >
                          {nextVisit.type}
                        </span>
                        <span
                          className={`px-2.5 py-1 rounded-md text-xs font-medium ${getVisitStatusColor(nextVisit.status)}`}
                        >
                          {getVisitStatusLabel(nextVisit.status)}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 space-y-2">
                        <div className="flex items-center gap-3">
                          <svg
                            className="w-5 h-5 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                          <span className="font-medium">
                            {formatDate(nextVisit.startAt)} at {formatTime(nextVisit.startAt)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          {nextVisit.location === "Telehealth" ? (
                            <>
                              <svg
                                className="w-5 h-5 text-blue-500"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                                />
                              </svg>
                              <span>Telehealth</span>
                            </>
                          ) : (
                            <>
                              <svg
                                className="w-5 h-5 text-green-500"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                                />
                              </svg>
                              <span>Home Visit</span>
                            </>
                          )}
                        </div>
                        {nextVisit.clinicianName && (
                          <div className="flex items-center gap-3">
                            <svg
                              className="w-5 h-5 text-gray-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                              />
                            </svg>
                            <span>{nextVisit.clinicianName}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <svg
                        className="w-12 h-12 mx-auto mb-3 text-gray-300"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      <p className="text-sm">No upcoming visits scheduled</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Top Tasks */}
              <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
                <CardHeader className="p-6 pb-4">
                  <CardTitle className="text-xl font-semibold flex items-center justify-between">
                    <span>Top Tasks</span>
                    <Link to="/tasks">
                      <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                        View All →
                      </Button>
                    </Link>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 pt-0 space-y-4">
                  {topTasks.length > 0 ? (
                    <div className="space-y-3">
                      {topTasks.map((task) => (
                        <div
                          key={task.id}
                          className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors border border-transparent hover:border-gray-200"
                        >
                          <input
                            type="checkbox"
                            checked={false}
                            onChange={() => handleTaskComplete(task)}
                            className="mt-0.5 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-gray-900">
                                {task.title}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-md text-xs font-medium ${getTaskSourceColor(task.source)}`}
                              >
                                {task.source}
                              </span>
                            </div>
                            {task.dueAt && (
                              <div
                                className={`text-xs mt-1 ${
                                  isTaskOverdue(task) ? "text-red-600 font-medium" : "text-gray-500"
                                }`}
                              >
                                {getDueDateLabel(task.dueAt)}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <svg
                        className="w-12 h-12 mx-auto mb-3 text-gray-300"
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
                      <p className="text-sm">No open tasks</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Progress & Activity Section */}
          <section>
            <div className="mb-6">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Overview
              </span>
              <h2 className="text-2xl font-bold text-gray-900 mt-1">
                Progress & Activity
              </h2>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
              {/* Clinical Documents */}
              <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
                <CardHeader className="p-6 pb-4">
                  <CardTitle className="text-xl font-semibold flex items-center justify-between">
                    <span>Clinical Documents</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 pt-0 space-y-4">
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-xl bg-purple-100 flex items-center justify-center">
                        <svg
                          className="w-7 h-7 text-purple-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                      </div>
                      <div>
                        {newClinicalDocsCount > 0 ? (
                          <>
                            <span className="text-3xl font-bold text-purple-600">
                              {newClinicalDocsCount}
                            </span>
                            <span className="text-lg font-medium text-gray-600 ml-2">
                              New
                            </span>
                          </>
                        ) : (
                          <span className="text-lg font-medium text-gray-600">
                            All reviewed
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-gray-500">
                      Care plans and assessments from your care team
                    </p>
                    <Link to="/documents?tab=clinical">
                      <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white">
                        View Clinical Documents
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
              {/* Care Plan Progress */}
              <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
                <CardHeader className="p-6 pb-4">
                  <CardTitle className="text-xl font-semibold flex items-center justify-between">
                    <span>Care Plan Progress</span>
                    <Link to="/care-plan">
                      <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                        View Plan →
                      </Button>
                    </Link>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 pt-0 space-y-4">
                  <div className="space-y-5">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-gray-700">
                          Required Documents
                        </span>
                        <span className="text-sm font-semibold text-gray-900">
                          {carePlanProgress.met} of {carePlanProgress.total}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                          style={{ width: `${progressPercentage}%` }}
                        />
                      </div>
                      <div className="mt-4 text-center">
                        <span className="text-3xl font-bold text-blue-600">
                          {progressPercentage}%
                        </span>
                        <span className="text-sm text-gray-500 ml-2">complete</span>
                      </div>
                    </div>
                    {progressPercentage < 100 && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <p className="text-sm text-amber-800">
                          {carePlanProgress.total - carePlanProgress.met} document
                          {carePlanProgress.total - carePlanProgress.met === 1 ? "" : "s"} still
                          needed to complete your care plan.
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Activity */}
              <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
                <CardHeader className="p-6 pb-4">
                  <CardTitle className="text-xl font-semibold flex items-center justify-between">
                    <span>Recent Activity</span>
                    <Link to="/timeline">
                      <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                        View Timeline →
                      </Button>
                    </Link>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 pt-0 space-y-4">
                  {recentActivity.length > 0 ? (
                    <div className="space-y-4">
                      {recentActivity.map((event) => (
                        <div key={event.id} className="flex items-start gap-4">
                          <div className="w-2.5 h-2.5 bg-blue-500 rounded-full mt-1.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900">
                              {event.title}
                            </div>
                            {event.description && (
                              <div className="text-sm text-gray-500 mt-1">
                                {event.description}
                              </div>
                            )}
                            <div className="text-xs text-gray-400 mt-1.5">
                              {formatRelativeTime(event.createdAt)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <svg
                        className="w-12 h-12 mx-auto mb-3 text-gray-300"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <p className="text-sm">No recent activity</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </section>
      </PageShellContent>
    </PageShell>
  );
}
