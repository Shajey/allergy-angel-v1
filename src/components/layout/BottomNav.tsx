import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Search, History, User } from 'lucide-react';

const navItems = [
  { path: '/ask', label: 'Ask', icon: Search },
  { path: '/history', label: 'History', icon: History },
  { path: '/profile', label: 'Profile', icon: User },
];

export default function BottomNav() {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200">
      <div
        className="flex items-center justify-around"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex flex-col items-center justify-center gap-1 py-2 px-3 min-w-[72px] min-h-[56px] text-xs font-medium transition-colors',
                isActive(item.path)
                  ? 'text-slate-900'
                  : 'text-gray-500 hover:text-gray-900'
              )}
              aria-label={item.label}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
