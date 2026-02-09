import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X, History, Search, User, Activity, RotateCcw } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface MobileDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const navLinks = [
  { path: '/ask', label: 'Ask', icon: Search },
  { path: '/profile', label: 'Profile', icon: User },
  { path: '/history', label: 'History', icon: History },
  { path: '/insights', label: 'Insights', icon: Activity },
];

export default function MobileDrawer({ open, onOpenChange }: MobileDrawerProps) {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  const activeClass = 'bg-slate-100 text-slate-900';
  const inactiveClass = 'text-gray-600 hover:text-gray-900 hover:bg-gray-100';

  const handleResetLocal = () => {
    if (confirm('Reset local app data? This clears saved profile/history in this browser.')) {
      // Keep this minimal for now. Later we’ll target specific keys.
      localStorage.clear();
      window.location.href = '/ask';
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-50 bg-black/50',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0'
          )}
        />

        <DialogPrimitive.Content
          className={cn(
            'fixed left-0 top-0 z-50 h-full w-[80vw] max-w-[384px] bg-white shadow-xl',
            'flex flex-col',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left',
            'duration-200'
          )}
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <DialogPrimitive.Title className="text-lg font-semibold text-gray-900">
              Allergy Angel
            </DialogPrimitive.Title>
            <DialogPrimitive.Close className="p-2 -mr-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 min-w-[44px] min-h-[44px] flex items-center justify-center">
              <X className="h-5 w-5" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-4">
            <div className="space-y-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    onClick={() => onOpenChange(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-3 rounded-lg text-base font-medium transition-colors min-h-[48px]',
                      isActive(link.path) ? activeClass : inactiveClass
                    )}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </nav>

          <div
            className="border-t border-gray-200 px-3 py-4"
            style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
          >
            <button
              onClick={handleResetLocal}
              className="flex items-center gap-3 w-full px-3 py-3 rounded-lg text-base font-medium text-red-600 hover:bg-red-50 min-h-[48px]"
            >
              <RotateCcw className="h-5 w-5 flex-shrink-0" />
              Reset local data
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
