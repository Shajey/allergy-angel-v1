import { Link, useLocation } from 'react-router-dom';
import { Home, CheckSquare, FileText, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useViewMode } from '@/context/ViewModeContext';

const navItems = [
  { path: '/today', label: 'Today', icon: Home },
  { path: '/tasks', label: 'Tasks', icon: CheckSquare },
  { path: '/documents', label: 'Documents', icon: FileText },
  { path: '/messages', label: 'Messages', icon: MessageSquare },
];

export default function BottomNav() {
  const location = useLocation();
  const { viewMode } = useViewMode();

  const isActive = (path: string) => location.pathname === path;

  // Role-based active styling
  const getActiveClass = () => {
    switch (viewMode) {
      case 'patient':
        return 'text-emerald-600';
      case 'caregiver':
        return 'text-blue-600';
      case 'clinician':
        return 'text-purple-600';
      case 'developer':
        return 'text-slate-600';
    }
  };

  const getActiveIconBg = () => {
    switch (viewMode) {
      case 'patient':
        return 'bg-emerald-100';
      case 'caregiver':
        return 'bg-blue-100';
      case 'clinician':
        return 'bg-purple-100';
      case 'developer':
        return 'bg-slate-100';
    }
  };

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-lg"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-stretch h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-1 min-w-[48px] min-h-[48px]',
                'transition-colors active:bg-gray-100',
                active ? getActiveClass() : 'text-gray-500'
              )}
            >
              <div className={cn(
                'p-1.5 rounded-lg transition-colors',
                active && getActiveIconBg()
              )}>
                <Icon className="h-5 w-5" />
              </div>
              <span className={cn(
                'text-[10px] font-medium',
                active ? '' : 'text-gray-500'
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
