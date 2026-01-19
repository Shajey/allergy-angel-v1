import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Info, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getSession } from '@/lib/sessionStore';
import {
  getNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
} from '@/lib/notificationStore';
import type { Notification, NotificationType } from '@/types/notifications';

function NotificationsPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Load notifications
  useEffect(() => {
    const loadNotifications = () => {
      const session = getSession();
      const patientNotifications = getNotifications(session.activePatientId);
      setNotifications(patientNotifications);
      setUnreadCount(getUnreadCount(session.activePatientId));
    };

    loadNotifications();

    // Listen for changes
    const handleChange = () => loadNotifications();
    window.addEventListener('session-changed', handleChange);
    window.addEventListener('notifications-changed', handleChange);

    return () => {
      window.removeEventListener('session-changed', handleChange);
      window.removeEventListener('notifications-changed', handleChange);
    };
  }, []);

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markRead(notification.id);
    }
    if (notification.actionLink) {
      navigate(notification.actionLink);
      setIsOpen(false);
    }
  };

  const handleMarkAllRead = () => {
    const session = getSession();
    markAllRead(session.activePatientId);
  };

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case 'ActionRequired':
        return <AlertCircle className="h-5 w-5 text-amber-600" />;
      case 'Success':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'Info':
      default:
        return <Info className="h-5 w-5 text-blue-600" />;
    }
  };

  const getNotificationBgClass = (type: NotificationType, read: boolean) => {
    if (read) return 'bg-gray-50';
    
    switch (type) {
      case 'ActionRequired':
        return 'bg-amber-50';
      case 'Success':
        return 'bg-green-50';
      case 'Info':
      default:
        return 'bg-blue-50';
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
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5 text-gray-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-5 w-5 flex items-center justify-center text-xs font-bold text-white bg-red-500 rounded-full">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-[70vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
            <h3 className="font-semibold text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllRead}
                className="text-xs h-7"
              >
                <CheckCheck className="h-3 w-3 mr-1" />
                Mark all read
              </Button>
            )}
          </div>

          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Bell className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No notifications</p>
              </div>
            ) : (
              <div className="divide-y">
                {notifications.map((notification) => (
                  <button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`w-full text-left p-4 hover:bg-gray-100 transition-colors ${getNotificationBgClass(
                      notification.type,
                      notification.read
                    )}`}
                  >
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4
                            className={`text-sm font-medium truncate ${
                              notification.read ? 'text-gray-600' : 'text-gray-900'
                            }`}
                          >
                            {notification.title}
                          </h4>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatTime(notification.createdAt)}
                          </span>
                        </div>
                        <p
                          className={`text-sm mt-1 line-clamp-2 ${
                            notification.read ? 'text-gray-500' : 'text-gray-700'
                          }`}
                        >
                          {notification.message}
                        </p>
                        {notification.actionLink && (
                          <p className="text-xs text-blue-600 mt-2">Click to view</p>
                        )}
                      </div>
                      {!notification.read && (
                        <div className="flex-shrink-0">
                          <div className="h-2 w-2 bg-blue-600 rounded-full" />
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationsPanel;
