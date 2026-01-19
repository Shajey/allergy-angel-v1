import { Link, useLocation } from 'react-router-dom';
import { Outlet } from 'react-router-dom';
import ContextSwitcher from './ContextSwitcher';
import NotificationsPanel from './NotificationsPanel';

function AppShell() {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm relative z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/today" className="text-xl font-bold text-gray-900">
              VNS Health Portal
            </Link>
            <div className="flex items-center gap-6">
              <nav className="flex gap-6">
                <Link
                  to="/today"
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/today')
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  Today
                </Link>
                <Link
                  to="/tasks"
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/tasks')
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  Tasks
                </Link>
                <Link
                  to="/care-plan"
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/care-plan')
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  Care Plan
                </Link>
                <Link
                  to="/documents"
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/documents')
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  Documents
                </Link>
                <Link
                  to="/messages"
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/messages')
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  Messages
                </Link>
                <Link
                  to="/timeline"
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/timeline')
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  Timeline
                </Link>
                <Link
                  to="/visits"
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/visits')
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  Visits
                </Link>
              </nav>
              <div className="flex items-center gap-2">
                <NotificationsPanel />
                <ContextSwitcher />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="min-h-[calc(100vh-73px)]">
        <Outlet />
      </main>
    </div>
  );
}

export default AppShell;
