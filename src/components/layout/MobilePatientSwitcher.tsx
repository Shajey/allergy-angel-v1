import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X, Check, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useViewMode, type IdentityRole } from '@/context/ViewModeContext';
import { getSession, setActivePatientId, getAvailablePatients } from '@/lib/sessionStore';

interface MobilePatientSwitcherProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPatientSelected?: () => void;
}

export default function MobilePatientSwitcher({ open, onOpenChange, onPatientSelected }: MobilePatientSwitcherProps) {
  const { viewMode, identityRole, isDeveloperEntry } = useViewMode();
  const session = getSession();

  // Determine the effective role to display
  const displayRole: IdentityRole = isDeveloperEntry ? (viewMode as IdentityRole) : identityRole;

  // Get available patients for the current role
  const patients = getAvailablePatients(displayRole);

  const handlePatientChange = (patientId: string) => {
    setActivePatientId(patientId);
    window.dispatchEvent(new Event('session-changed'));
    onPatientSelected?.();
    onOpenChange(false);
  };

  // Role-based active indicator styling
  const getActiveIndicatorClass = () => {
    switch (displayRole) {
      case 'patient':
        return 'bg-emerald-100 border-emerald-500 text-emerald-700';
      case 'caregiver':
        return 'bg-blue-100 border-blue-500 text-blue-700';
      case 'clinician':
        return 'bg-purple-100 border-purple-500 text-purple-700';
      case 'developer':
        return 'bg-slate-100 border-slate-500 text-slate-700';
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/* Backdrop overlay */}
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-[60] bg-black/50',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0'
          )}
        />
        {/* Bottom sheet content */}
        <DialogPrimitive.Content
          className={cn(
            'fixed left-0 right-0 bottom-0 z-[60] bg-white rounded-t-2xl shadow-xl',
            'max-h-[80vh] flex flex-col',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
            'duration-200'
          )}
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {/* Handle bar */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-4 pb-3 border-b border-gray-200">
            <DialogPrimitive.Title className="text-lg font-semibold text-gray-900">
              {displayRole === 'clinician' ? 'Select Patient' : 'Switch Patient'}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close className="p-2 -mr-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 min-w-[44px] min-h-[44px] flex items-center justify-center">
              <X className="h-5 w-5" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>

          {/* Patient list */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="space-y-2">
              {patients.map((patient) => {
                const isActive = patient.id === session.activePatientId;
                return (
                  <button
                    key={patient.id}
                    onClick={() => handlePatientChange(patient.id)}
                    className={cn(
                      'w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-colors min-h-[64px]',
                      isActive
                        ? getActiveIndicatorClass()
                        : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    )}
                  >
                    <div className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                      isActive ? 'bg-white/50' : 'bg-gray-100'
                    )}>
                      <User className="h-5 w-5" />
                    </div>
                    <div className="flex-1 text-left">
                      <div className={cn(
                        'font-medium',
                        isActive ? '' : 'text-gray-900'
                      )}>
                        {patient.fullName}
                      </div>
                      {patient.relationshipLabel && patient.relationshipLabel !== 'Self' && (
                        <div className={cn(
                          'text-sm',
                          isActive ? 'opacity-75' : 'text-gray-500'
                        )}>
                          {patient.relationshipLabel}
                        </div>
                      )}
                    </div>
                    {isActive && (
                      <Check className="h-5 w-5 flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
