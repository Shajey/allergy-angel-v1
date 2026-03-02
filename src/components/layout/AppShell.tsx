import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import NotificationsPanel from './NotificationsPanel';
import MobileDrawer from './MobileDrawer';
import ProfileSwitcher from './ProfileSwitcher';
import BottomNav from './BottomNav';
import VigilanceBanner from './VigilanceBanner';


function AppShell() {
  const location = useLocation();

  const [drawerOpen, setDrawerOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;



  const activeClass = 'bg-slate-100 text-slate-900';
  const inactiveClass = 'text-gray-600 hover:text-gray-900 hover:bg-gray-100';
  

  const navLinks = [
    { path: '/ask', label: 'Ask' },
    { path: '/profile', label: 'Profile' },
    { path: '/history', label: 'History' },
    { path: '/insights', label: 'Insights' },
  ];
  

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header - Phase 18.3: Two-line layout to avoid truncation */}
      <header className="md:hidden bg-white border-b border-gray-200 shadow-sm relative z-50">
        {/* Row 1: Hamburger | Logo | Notifications */}
        <div className="flex items-center justify-between h-14 px-4">
          <button
            onClick={() => setDrawerOpen(true)}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors -ml-2"
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6" />
          </button>

          <Link
            to="/"
            className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 text-lg font-bold text-gray-900 hover:text-emerald-700 transition-colors"
            aria-label="Go to Allergy Angel home"
          >
            <img src="/icons/icon.svg" alt="" className="h-7 w-7 flex-shrink-0" aria-hidden />
            Allergy Angel
          </Link>

          <div className="min-w-[44px] flex justify-end">
            <NotificationsPanel />
          </div>
        </div>
        {/* Row 2: Profile switcher full-width */}
        <div className="px-4 pb-2">
          <ProfileSwitcher variant="full-width" />
        </div>
      </header>

      {/* Desktop Header */}
      <header className="hidden md:block bg-white border-b border-gray-200 shadow-sm relative z-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link
              to="/"
              className="flex items-center gap-2 text-lg sm:text-xl font-bold text-gray-900 hover:text-emerald-700 transition-colors"
              aria-label="Go to Allergy Angel home"
            >
              <img src="/icons/icon.svg" alt="" className="h-8 w-8 flex-shrink-0" aria-hidden />
              Allergy Angel
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
              <ProfileSwitcher />
              <NotificationsPanel />
              
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      <MobileDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />

      <VigilanceBanner />

      {/* Main Content - mobile header is ~2 rows, desktop single row */}
      <main className="min-h-[calc(100vh-120px)] md:min-h-[calc(100vh-73px)]">
        <Outlet />
      </main>

      {/* Bottom Navigation - mobile only */}
      <BottomNav />
    </div>
  );
}

export default AppShell;
