import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import ContextSwitcher from './ContextSwitcher';
import NotificationsPanel from './NotificationsPanel';
import MobileDrawer from './MobileDrawer';
import BottomNav from './BottomNav';
import { useViewMode } from '@/context/ViewModeContext';

function AppShell() {
  const location = useLocation();
  const { viewMode } = useViewMode();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  // Role-based active nav styling (B2 spec)
  // Patient -> Green, Caregiver -> Blue, Clinician -> Purple
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

  const navLinks = [
    { path: '/today', label: 'Today' },
    { path: '/tasks', label: 'Tasks' },
    { path: '/care-plan', label: 'Care Plan' },
    { path: '/documents', label: 'Documents' },
    { path: '/messages', label: 'Messages' },
    { path: '/timeline', label: 'Timeline' },
    { path: '/visits', label: 'Visits' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header - hamburger LEFT, logo CENTER, bell RIGHT */}
      <header className="md:hidden bg-white border-b border-gray-200 shadow-sm relative z-50">
        <div className="flex items-center justify-between h-16 px-4">
          {/* Hamburger - LEFT */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6" />
          </button>

          {/* Logo - CENTER (absolutely positioned for true center) */}
          <Link
            to="/"
            className="absolute left-1/2 -translate-x-1/2 text-xl font-bold text-gray-900 hover:text-emerald-700 transition-colors"
            aria-label="Go to CareOS home"
          >
            CareOS
          </Link>

          {/* Notifications Bell - RIGHT */}
          <NotificationsPanel />
        </div>
      </header>

      {/* Desktop Header */}
      <header className="hidden md:block bg-white border-b border-gray-200 shadow-sm relative z-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link
              to="/"
              className="text-lg sm:text-xl font-bold text-gray-900 hover:text-emerald-700 transition-colors"
              aria-label="Go to CareOS home"
            >
              CareOS
            </Link>

            {/* Desktop Navigation */}
            <nav className="flex items-center gap-4 lg:gap-6">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`px-2 lg:px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive(link.path) ? activeClass : inactiveClass
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Right side actions */}
            <div className="flex items-center gap-2 sm:gap-4">
              <NotificationsPanel />
              <ContextSwitcher />
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      <MobileDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />

      {/* Main Content */}
      <main className="min-h-[calc(100vh-64px)] md:min-h-[calc(100vh-73px)]">
        <Outlet />
      </main>

      {/* Bottom Navigation - mobile only */}
      <BottomNav />
    </div>
  );
}

export default AppShell;
