import { Link, useLocation } from 'react-router-dom';
import { Outlet } from 'react-router-dom';
import ContextSwitcher from './ContextSwitcher';
import NotificationsPanel from './NotificationsPanel';
import { useViewMode } from '@/context/ViewModeContext';

function AppShell() {
  const location = useLocation();
  const { viewMode } = useViewMode();

  const isActive = (path: string) => location.pathname === path;

  // Role-based active nav styling (B2 spec)
  // Patient → Green, Caregiver → Blue, Clinician → Purple
  const getActiveNavClass = (): string => {
    switch (viewMode) {
      case 'patient':
        return 'bg-emerald-100 text-emerald-700';
      case 'caregiver':
        return 'bg-blue-100 text-blue-700';
      case 'clinician':
        return 'bg-purple-100 text-purple-700';
      case 'developer':
        return 'bg-slate-100 text-slate-700';
    }
  };

  const activeClass = getActiveNavClass();
  const inactiveClass = 'text-gray-600 hover:text-gray-900 hover:bg-gray-100';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm relative z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link 
              to="/" 
              className="text-xl font-bold text-gray-900 hover:text-emerald-700 transition-colors"
              aria-label="Go to CareOS home"
            >
              CareOS
            </Link>
            <div className="flex items-center gap-6">
              <nav className="flex gap-6">
                <Link
                  to="/today"
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/today') ? activeClass : inactiveClass
                  }`}
                >
                  Today
                </Link>
                <Link
                  to="/tasks"
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/tasks') ? activeClass : inactiveClass
                  }`}
                >
                  Tasks
                </Link>
                <Link
                  to="/care-plan"
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/care-plan') ? activeClass : inactiveClass
                  }`}
                >
                  Care Plan
                </Link>
                <Link
                  to="/documents"
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/documents') ? activeClass : inactiveClass
                  }`}
                >
                  Documents
                </Link>
                <Link
                  to="/messages"
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/messages') ? activeClass : inactiveClass
                  }`}
                >
                  Messages
                </Link>
                <Link
                  to="/timeline"
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/timeline') ? activeClass : inactiveClass
                  }`}
                >
                  Timeline
                </Link>
                <Link
                  to="/visits"
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/visits') ? activeClass : inactiveClass
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
