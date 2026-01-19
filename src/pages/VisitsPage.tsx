import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import PageShell, { PageShellContent } from "@/components/layout/PageShell";
import PageHeader from "@/components/layout/PageHeader";
import { useViewMode } from "@/context/ViewModeContext";
import { isClinician, getHeaderCopy, getCardClassName } from "@/lib/viewMode";
import { getSession } from "@/lib/sessionStore";
import {
  getUpcomingVisits,
  getPastVisits,
  getVisitsForDate,
  getDatesWithVisits,
  seedVisitsIfEmpty,
} from "@/lib/visitStore";
import type { Visit } from "@/types/visits";
import {
  getVisitTypeColor,
  getVisitStatusColor,
  getVisitStatusLabel,
} from "@/types/visits";
import VisitDetailModal from "@/components/visits/VisitDetailModal";

type TabType = "upcoming" | "past" | "calendar";

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
 * Get days in a month.
 */
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Get first day of month (0 = Sunday).
 */
function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

/**
 * Visit card component.
 */
function VisitCard({
  visit,
  onViewDetails,
}: {
  visit: Visit;
  onViewDetails: () => void;
}) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span
                className={`px-2 py-1 rounded text-xs font-medium ${getVisitTypeColor(visit.type)}`}
              >
                {visit.type}
              </span>
              <span
                className={`px-2 py-1 rounded text-xs font-medium ${getVisitStatusColor(visit.status)}`}
              >
                {getVisitStatusLabel(visit.status)}
              </span>
            </div>
            <div className="text-sm text-gray-600 space-y-1">
              <div className="flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-gray-400"
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
                <span>
                  {formatDate(visit.startAt)} at {formatTime(visit.startAt)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {visit.location === "Telehealth" ? (
                  <>
                    <svg
                      className="w-4 h-4 text-blue-500"
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
                      className="w-4 h-4 text-green-500"
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
              {visit.clinicianName && (
                <div className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-gray-400"
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
                  <span>{visit.clinicianName}</span>
                </div>
              )}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onViewDetails}>
            View Details
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Calendar component.
 */
function Calendar({
  patientId,
  onDateSelect,
  selectedDate,
}: {
  patientId: string;
  onDateSelect: (date: Date) => void;
  selectedDate: Date | null;
}) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const datesWithVisits = useMemo(
    () => getDatesWithVisits(patientId, year, month),
    [patientId, year, month]
  );

  const monthName = currentDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      today.getFullYear() === year &&
      today.getMonth() === month &&
      today.getDate() === day
    );
  };

  const isSelected = (day: number) => {
    if (!selectedDate) return false;
    return (
      selectedDate.getFullYear() === year &&
      selectedDate.getMonth() === month &&
      selectedDate.getDate() === day
    );
  };

  // Create calendar grid
  const calendarDays: (number | null)[] = [];
  // Add empty cells for days before the first day of month
  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(null);
  }
  // Add days of month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  return (
    <div className="bg-white rounded-lg border p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Button variant="outline" size="sm" onClick={prevMonth}>
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold">{monthName}</span>
          <Button variant="ghost" size="sm" onClick={goToToday}>
            Today
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={nextMonth}>
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </Button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div
            key={day}
            className="text-center text-xs font-medium text-gray-500 py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day, index) => (
          <div
            key={index}
            className={`
              aspect-square flex flex-col items-center justify-center text-sm rounded-lg cursor-pointer
              ${day === null ? "" : "hover:bg-gray-100"}
              ${isToday(day!) ? "border-2 border-blue-500" : ""}
              ${isSelected(day!) ? "bg-blue-500 text-white hover:bg-blue-600" : ""}
            `}
            onClick={() => day && onDateSelect(new Date(year, month, day))}
          >
            {day && (
              <>
                <span>{day}</span>
                {datesWithVisits.has(day) && !isSelected(day) && (
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-0.5" />
                )}
                {datesWithVisits.has(day) && isSelected(day) && (
                  <span className="w-1.5 h-1.5 bg-white rounded-full mt-0.5" />
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 bg-blue-500 rounded-full" />
          <span>Has visits</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-4 h-4 border-2 border-blue-500 rounded" />
          <span>Today</span>
        </div>
      </div>
    </div>
  );
}

export default function VisitsPage() {
  const { viewMode } = useViewMode();
  const [activeTab, setActiveTab] = useState<TabType>("upcoming");
  const [patientId, setPatientId] = useState<string>("");
  const [upcomingVisits, setUpcomingVisits] = useState<Visit[]>([]);
  const [pastVisits, setPastVisits] = useState<Visit[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedDateVisits, setSelectedDateVisits] = useState<Visit[]>([]);
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  /**
   * Load visits for the active patient.
   */
  const loadVisits = () => {
    const session = getSession();
    const currentPatientId = session.activePatientId;

    if (currentPatientId !== patientId) {
      setPatientId(currentPatientId);
    }

    // Ensure visits are seeded
    seedVisitsIfEmpty(currentPatientId);

    // Load visits
    setUpcomingVisits(getUpcomingVisits(currentPatientId));
    setPastVisits(getPastVisits(currentPatientId));

    // Update selected date visits if a date is selected
    if (selectedDate) {
      setSelectedDateVisits(getVisitsForDate(currentPatientId, selectedDate));
    }
  };

  useEffect(() => {
    loadVisits();

    // Listen for session changes
    const handleSessionChange = () => {
      loadVisits();
    };

    // Listen for visit changes
    const handleVisitsChange = () => {
      loadVisits();
    };

    window.addEventListener("session-changed", handleSessionChange);
    window.addEventListener("visits-changed", handleVisitsChange);

    return () => {
      window.removeEventListener("session-changed", handleSessionChange);
      window.removeEventListener("visits-changed", handleVisitsChange);
    };
  }, []);

  // Update patient-specific data when patientId changes
  useEffect(() => {
    if (patientId) {
      seedVisitsIfEmpty(patientId);
      setUpcomingVisits(getUpcomingVisits(patientId));
      setPastVisits(getPastVisits(patientId));
    }
  }, [patientId]);

  // Handle date selection in calendar
  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    const session = getSession();
    setSelectedDateVisits(getVisitsForDate(session.activePatientId, date));
  };

  // Handle view details
  const handleViewDetails = (visit: Visit) => {
    setSelectedVisit(visit);
    setIsModalOpen(true);
  };

  // Handle visit updated
  const handleVisitUpdated = () => {
    loadVisits();
  };

  // Tab button styles
  const getTabClass = (tab: TabType) =>
    `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
      activeTab === tab
        ? "bg-blue-100 text-blue-700"
        : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
    }`;

  // Get active patient name for header
  const session = getSession();
  const activePatient = session.patients.find((p) => p.id === session.activePatientId);
  const patientName = activePatient?.fullName || "patient";
  const _isClinicianMode = isClinician(viewMode);
  const headerCopy = getHeaderCopy("visits", patientName, viewMode);
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
              Encounter Schedule
            </span>
            <h2 className="text-2xl font-bold text-gray-900 mt-1">Your Visits</h2>
            <p className="text-sm text-gray-600 mt-1">
              View and manage your scheduled appointments with your care team
            </p>
          </div>
        </section>

        <Card className={`shadow-sm hover:shadow-md transition-shadow duration-200 ${cardClass}`}>
          <CardHeader className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Schedule</span>
                <CardTitle className="text-xl font-semibold text-gray-900 mt-1">Scheduled Visits</CardTitle>
              </div>
              <div className="flex gap-2">
                <button
                  className={getTabClass("upcoming")}
                  onClick={() => setActiveTab("upcoming")}
                >
                  Upcoming
                </button>
                <button
                  className={getTabClass("past")}
                  onClick={() => setActiveTab("past")}
                >
                  Past
                </button>
                <button
                  className={getTabClass("calendar")}
                  onClick={() => setActiveTab("calendar")}
                >
                  Calendar
                </button>
              </div>
            </div>
          </CardHeader>
        <CardContent className="p-6 pt-0">
          {/* Upcoming Tab */}
          {activeTab === "upcoming" && (
            <div className="space-y-4">
              {upcomingVisits.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                  <svg
                    className="w-12 h-12 mb-4 text-gray-300"
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
                  <p className="text-lg font-medium text-gray-900 mb-2">No upcoming visits</p>
                  <p className="text-sm text-gray-500 max-w-sm">
                    Your care team will schedule visits as part of your care plan.
                  </p>
                </div>
              ) : (
                upcomingVisits.map((visit) => (
                  <VisitCard
                    key={visit.id}
                    visit={visit}
                    onViewDetails={() => handleViewDetails(visit)}
                  />
                ))
              )}
            </div>
          )}

          {/* Past Tab */}
          {activeTab === "past" && (
            <div className="space-y-4">
              {pastVisits.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                  <svg
                    className="w-12 h-12 mb-4 text-gray-300"
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
                  <p className="text-lg font-medium text-gray-900 mb-2">No past visits</p>
                  <p className="text-sm text-gray-500 max-w-sm">
                    Your visit history will appear here after your first appointment.
                  </p>
                </div>
              ) : (
                pastVisits.map((visit) => (
                  <VisitCard
                    key={visit.id}
                    visit={visit}
                    onViewDetails={() => handleViewDetails(visit)}
                  />
                ))
              )}
            </div>
          )}

          {/* Calendar Tab */}
          {activeTab === "calendar" && (
            <div className="grid md:grid-cols-2 gap-6">
              <Calendar
                patientId={patientId}
                onDateSelect={handleDateSelect}
                selectedDate={selectedDate}
              />
              <div>
                <h3 className="text-lg font-semibold mb-4">
                  {selectedDate
                    ? selectedDate.toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "Select a date"}
                </h3>
                {selectedDate ? (
                  selectedDateVisits.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                      <p>No visits scheduled for this date.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {selectedDateVisits.map((visit) => (
                        <VisitCard
                          key={visit.id}
                          visit={visit}
                          onViewDetails={() => handleViewDetails(visit)}
                        />
                      ))}
                    </div>
                  )
                ) : (
                  <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                    <p>Click on a date to see visits.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

        {/* Visit Detail Modal */}
        <VisitDetailModal
          visit={selectedVisit}
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
          onVisitUpdated={handleVisitUpdated}
        />
      </PageShellContent>
    </PageShell>
  );
}
