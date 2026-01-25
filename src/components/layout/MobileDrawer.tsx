import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X, Calendar, CheckSquare, FileText, MessageSquare, ClipboardList, Clock, Stethoscope, Settings, RotateCcw } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useViewMode } from '@/context/ViewModeContext';
import MobileIdentityHeader from './MobileIdentityHeader';
import { clearAllDocuments } from '@/lib/storage';
import { resetSession } from '@/lib/sessionStore';

interface MobileDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const navLinks = [
  { path: '/today', label: 'Today', icon: Calendar },
  { path: '/tasks', label: 'Tasks', icon: CheckSquare },
  { path: '/care-plan', label: 'Care Plan', icon: ClipboardList },
  { path: '/documents', label: 'Documents', icon: FileText },
  { path: '/messages', label: 'Messages', icon: MessageSquare },
  { path: '/timeline', label: 'Timeline', icon: Clock },
  { path: '/visits', label: 'Visits', icon: Stethoscope },
];

export default function MobileDrawer({ open, onOpenChange }: MobileDrawerProps) {
  const location = useLocation();
  const { viewMode } = useViewMode();

  const isActive = (path: string) => location.pathname === path;

  // Role-based active nav styling
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

  const handleResetDemo = () => {
    if (confirm('Are you sure you want to reset all demo data? This will clear all documents and session data.')) {
      clearAllDocuments();
      resetSession();
      localStorage.removeItem('vns-view-mode');
      localStorage.removeItem('vns-entry-mode');
      localStorage.removeItem('vns-identity-role');
      window.dispatchEvent(new Event('session-changed'));
      window.location.href = '/';
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/* Backdrop overlay */}
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-50 bg-black/50',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0'
          )}
        />
        {/* Drawer content - slides in from left */}
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
          {/* Header with close button */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <DialogPrimitive.Title className="text-lg font-semibold text-gray-900">
              Menu
            </DialogPrimitive.Title>
            <DialogPrimitive.Close className="p-2 -mr-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 min-w-[44px] min-h-[44px] flex items-center justify-center">
              <X className="h-5 w-5" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>

          {/* Identity Header */}
          <MobileIdentityHeader onClose={() => onOpenChange(false)} />

          {/* Navigation Links */}
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

          {/* Footer actions */}
          <div className="border-t border-gray-200 px-3 py-4 space-y-1" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
            <Link
              to="/profile"
              onClick={() => onOpenChange(false)}
              className="flex items-center gap-3 px-3 py-3 rounded-lg text-base font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 min-h-[48px]"
            >
              <Settings className="h-5 w-5 flex-shrink-0" />
              Settings
            </Link>
            <button
              onClick={handleResetDemo}
              className="flex items-center gap-3 w-full px-3 py-3 rounded-lg text-base font-medium text-red-600 hover:bg-red-50 min-h-[48px]"
            >
              <RotateCcw className="h-5 w-5 flex-shrink-0" />
              Reset Demo
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
