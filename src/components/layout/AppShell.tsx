import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import NotificationsPanel from './NotificationsPanel';
import MobileDrawer from './MobileDrawer';
import BottomNav from './BottomNav';


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
            aria-label="Go to Allergy Angel home"
          >
            Allergy Angel
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
              aria-label="Go to Allergy Angel home"
            >
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
              <NotificationsPanel />
              
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
