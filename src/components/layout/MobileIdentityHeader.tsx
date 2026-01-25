import { useState } from 'react';
import { ChevronRight, User, Users, Stethoscope, Settings } from 'lucide-react';
import { useViewMode, type IdentityRole } from '@/context/ViewModeContext';
import { getSession, getCaregiverProfile } from '@/lib/sessionStore';
import MobilePatientSwitcher from './MobilePatientSwitcher';

interface MobileIdentityHeaderProps {
  onClose: () => void;
}

export default function MobileIdentityHeader({ onClose }: MobileIdentityHeaderProps) {
  const [showPatientSwitcher, setShowPatientSwitcher] = useState(false);
  const { viewMode, identityRole, isDeveloperEntry } = useViewMode();
  const session = getSession();
  const activePatient = session.patients.find((p) => p.id === session.activePatientId);
  const caregiverProfile = getCaregiverProfile();

  // Determine the effective role to display
  const displayRole: IdentityRole = isDeveloperEntry ? (viewMode as IdentityRole) : identityRole;

  // Get identity badge class
  const getIdentityBadgeClass = (role: IdentityRole) => {
    switch (role) {
      case 'patient':
        return 'bg-green-100 text-green-700';
      case 'caregiver':
        return 'bg-blue-100 text-blue-700';
      case 'clinician':
        return 'bg-purple-100 text-purple-700';
      case 'developer':
        return 'bg-slate-100 text-slate-700';
    }
  };

  const getIdentityIcon = (role: IdentityRole) => {
    switch (role) {
      case 'patient':
        return <User className="h-4 w-4" />;
      case 'caregiver':
        return <Users className="h-4 w-4" />;
      case 'clinician':
        return <Stethoscope className="h-4 w-4" />;
      case 'developer':
        return <Settings className="h-4 w-4" />;
    }
  };

  const getIdentityLabel = (role: IdentityRole) => {
    switch (role) {
      case 'patient':
        return 'Patient';
      case 'caregiver':
        return 'Caregiver';
      case 'clinician':
        return 'Clinician';
      case 'developer':
        return 'Developer';
    }
  };

  // Get the identity display name
  const getIdentityDisplayName = () => {
    switch (displayRole) {
      case 'patient':
        return activePatient?.fullName || 'Patient';
      case 'caregiver':
        return caregiverProfile?.displayName || session.user.displayName;
      case 'clinician':
        return 'Support Staff';
      case 'developer':
        return 'Developer';
    }
  };

  // Check if patient switching is available
  const canSwitchPatient = displayRole === 'caregiver' || displayRole === 'clinician' || isDeveloperEntry;

  return (
    <>
      <div className="px-4 py-4 border-b border-gray-200 bg-gray-50">
        {/* Identity Badge + Name */}
        <div className="flex items-center gap-2 mb-2">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium ${getIdentityBadgeClass(displayRole)}`}>
            {getIdentityIcon(displayRole)}
            {getIdentityLabel(displayRole)}
          </span>
        </div>
        <div className="text-lg font-semibold text-gray-900">
          {getIdentityDisplayName()}
        </div>

        {/* Viewing Patient indicator - for caregiver/clinician */}
        {(displayRole === 'caregiver' || displayRole === 'clinician') && activePatient && (
          <button
            onClick={() => setShowPatientSwitcher(true)}
            className="mt-3 w-full flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors min-h-[48px]"
          >
            <div className="text-left">
              <div className="text-xs text-gray-500">Viewing</div>
              <div className="text-sm font-medium text-gray-900">{activePatient.fullName}</div>
            </div>
            <ChevronRight className="h-5 w-5 text-gray-400" />
          </button>
        )}
      </div>

      {/* Patient Switcher Modal */}
      {canSwitchPatient && (
        <MobilePatientSwitcher
          open={showPatientSwitcher}
          onOpenChange={setShowPatientSwitcher}
          onPatientSelected={() => {
            setShowPatientSwitcher(false);
          }}
        />
      )}
    </>
  );
}
