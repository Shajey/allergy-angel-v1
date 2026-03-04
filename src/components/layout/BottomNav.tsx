import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Search, History, User, Activity } from 'lucide-react';

const navItems = [
  { path: '/ask', label: 'Ask', icon: Search },
  { path: '/history', label: 'History', icon: History },
  { path: '/insights', label: 'Insights', icon: Activity },
  { path: '/profile', label: 'Profile', icon: User },
];

export default function BottomNav() {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-100">
      <div
        className="flex items-center justify-around py-2"
        style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex flex-col items-center justify-center gap-1 px-4 py-2 min-h-[44px] text-xs font-medium transition-colors',
                active ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'
              )}
              aria-label={item.label}
            >
              <Icon className="h-6 w-6" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
