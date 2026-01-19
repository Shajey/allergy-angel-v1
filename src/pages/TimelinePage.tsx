import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PageShell, { PageShellContent } from '@/components/layout/PageShell';
import PageHeader from '@/components/layout/PageHeader';
import { useViewMode } from '@/context/ViewModeContext';
import { isClinician, getHeaderCopy, getCardClassName } from '@/lib/viewMode';
import { getSession } from '@/lib/sessionStore';
import { getEvents } from '@/lib/timelineStore';
import type { TimelineEvent, TimelineCategory, TimelineEventType } from '@/types/timeline';
import { getEventCategory } from '@/types/timeline';
import {
  FileText,
  MessageSquare,
  Bell,
  Clock,
  CheckCircle2,
  Send,
  AlertCircle,
  ArrowUpCircle,
} from 'lucide-react';

function TimelinePage() {
  const { viewMode } = useViewMode();
  const navigate = useNavigate();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [filter, setFilter] = useState<TimelineCategory>('all');
  const [session, setSession] = useState(getSession());

  // Load events
  useEffect(() => {
    const loadEvents = () => {
      const currentSession = getSession();
      setSession(currentSession);
      const patientEvents = getEvents(currentSession.activePatientId);
      setEvents(patientEvents);
    };

    loadEvents();

    // Listen for changes
    const handleChange = () => loadEvents();
    window.addEventListener('session-changed', handleChange);
    window.addEventListener('timeline-changed', handleChange);

    return () => {
      window.removeEventListener('session-changed', handleChange);
      window.removeEventListener('timeline-changed', handleChange);
    };
  }, []);

  const activePatient = session.patients.find((p) => p.id === session.activePatientId);

  // Filter events by category
  const filteredEvents =
    filter === 'all'
      ? events
      : events.filter((e) => getEventCategory(e.type) === filter);

  const handleEventClick = (event: TimelineEvent) => {
    if (event.link) {
      navigate(event.link);
    }
  };

  const getEventIcon = (type: TimelineEventType) => {
    switch (type) {
      case 'DocumentUploaded':
        return <ArrowUpCircle className="h-5 w-5 text-blue-600" />;
      case 'DocumentStatusChanged':
        return <FileText className="h-5 w-5 text-purple-600" />;
      case 'DocRequestedFromCareOS':
        return <Send className="h-5 w-5 text-orange-600" />;
      case 'MessageSent':
        return <MessageSquare className="h-5 w-5 text-green-600" />;
      case 'ChecklistItemMet':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'ChecklistItemMissing':
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      case 'NotificationCreated':
        return <Bell className="h-5 w-5 text-amber-600" />;
      default:
        return <Clock className="h-5 w-5 text-gray-600" />;
    }
  };

  const getEventBadge = (type: TimelineEventType) => {
    const category = getEventCategory(type);
    switch (category) {
      case 'documents':
        return (
          <span className="px-2 py-0.5 text-xs rounded bg-blue-100 text-blue-700">
            Documents
          </span>
        );
      case 'care-plan':
        return (
          <span className="px-2 py-0.5 text-xs rounded bg-purple-100 text-purple-700">
            Care Plan
          </span>
        );
      case 'messages':
        return (
          <span className="px-2 py-0.5 text-xs rounded bg-green-100 text-green-700">
            Messages
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-700">
            System
          </span>
        );
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  const _formatFullDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Group events by date
  const groupEventsByDate = (events: TimelineEvent[]) => {
    const groups: Record<string, TimelineEvent[]> = {};
    events.forEach((event) => {
      const date = new Date(event.createdAt).toLocaleDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(event);
    });
    return groups;
  };

  const groupedEvents = groupEventsByDate(filteredEvents);
  const dateKeys = Object.keys(groupedEvents);

  const getDateLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    }
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  };

  const filterButtons: { label: string; value: TimelineCategory }[] = [
    { label: 'All', value: 'all' },
    { label: 'Documents', value: 'documents' },
    { label: 'Care Plan', value: 'care-plan' },
    { label: 'Messages', value: 'messages' },
  ];

  const patientName = activePatient?.fullName || "patient";
  const _isClinicianMode = isClinician(viewMode);
  const headerCopy = getHeaderCopy("timeline", patientName, viewMode);
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
              Activity History
            </span>
            <h2 className="text-2xl font-bold text-gray-900 mt-1">Your Timeline</h2>
            <p className="text-sm text-gray-600 mt-1">
              Track all activity related to your care
            </p>
          </div>

          {/* Filter Buttons */}
          <div className="flex flex-wrap gap-2 mb-6">
            {filterButtons.map((btn) => (
              <Button
                key={btn.value}
                variant={filter === btn.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter(btn.value)}
              >
                {btn.label}
              </Button>
            ))}
          </div>
        </section>

        {/* Timeline */}
        <Card className={`shadow-sm hover:shadow-md transition-shadow duration-200 ${cardClass}`}>
          <CardHeader className="p-6">
            <div className="mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Audit Log</span>
            </div>
            <CardTitle className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Activity Feed
            </CardTitle>
          </CardHeader>
        <CardContent className="p-6 pt-0">
          {filteredEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <Clock className="h-12 w-12 mb-4 text-gray-300" />
              <p className="text-lg font-medium text-gray-900 mb-2">No activity yet</p>
              <p className="text-sm text-gray-500 max-w-sm">
                Your care activity will appear here as you interact with your care team.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {dateKeys.map((dateKey) => (
                <div key={dateKey}>
                  {/* Date Header */}
                  <div className="sticky top-0 bg-white py-2 mb-3">
                    <h3 className="text-sm font-semibold text-muted-foreground">
                      {getDateLabel(dateKey)}
                    </h3>
                  </div>

                  {/* Events for this date */}
                  <div className="space-y-3 relative">
                    {/* Timeline line */}
                    <div className="absolute left-[11px] top-3 bottom-3 w-0.5 bg-gray-200" />

                    {groupedEvents[dateKey].map((event) => (
                      <button
                        key={event.id}
                        onClick={() => handleEventClick(event)}
                        disabled={!event.link}
                        className={`relative flex gap-4 w-full text-left p-3 rounded-lg transition-colors ${
                          event.link
                            ? 'hover:bg-gray-50 cursor-pointer'
                            : 'cursor-default'
                        }`}
                      >
                        {/* Icon with background */}
                        <div className="flex-shrink-0 z-10 bg-white p-0.5">
                          <div className="p-1.5 rounded-full bg-gray-100">
                            {getEventIcon(event.type)}
                          </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h4 className="font-medium text-sm truncate">
                              {event.title}
                            </h4>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatTime(event.createdAt)}
                            </span>
                          </div>
                          {event.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                              {event.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2">
                            {getEventBadge(event.type)}
                            {event.link && (
                              <span className="text-xs text-blue-600">
                                Click to view
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      </PageShellContent>
    </PageShell>
  );
}

export default TimelinePage;
