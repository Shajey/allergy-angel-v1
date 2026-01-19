import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  getSession,
  setActivePatientId,
  setUserRole,
  resetSession,
  getAvailablePatients,
  canSwitchToRole,
} from '@/lib/sessionStore';
import { clearAllDocuments } from '@/lib/storage';
import type { SessionState } from '@/types/session';
import { ChevronDown, User, Users, Settings, Stethoscope } from 'lucide-react';
import { useViewMode, type ViewMode } from '@/context/ViewModeContext';

function ContextSwitcher() {
  const [session, setSession] = useState<SessionState>(getSession());
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { viewMode, setViewMode } = useViewMode();

  // Update session when localStorage changes
  useEffect(() => {
    const handleStorageChange = () => {
      setSession(getSession());
    };
    window.addEventListener('storage', handleStorageChange);
    // Also check on focus in case of same-tab updates
    window.addEventListener('focus', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleStorageChange);
    };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const activePatient = session.patients.find((p) => p.id === session.activePatientId);

  const handlePatientChange = (patientId: string) => {
    setActivePatientId(patientId);
    // Update state immediately
    const updatedSession = getSession();
    setSession(updatedSession);
    setIsOpen(false);
    // Trigger a custom event to notify other components
    window.dispatchEvent(new Event('session-changed'));
  };

  const handleRoleChange = (role: 'Patient' | 'Caregiver') => {
    setUserRole(role);
    // Update state immediately
    const updatedSession = getSession();
    setSession(updatedSession);
    // Also update view mode to match role
    setViewMode(role.toLowerCase() as ViewMode);
    setIsOpen(false);
    window.dispatchEvent(new Event('session-changed'));
  };

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    // If switching to patient or caregiver, also update the session role
    if (mode === 'patient' && canSwitchToRole('Patient')) {
      setUserRole('Patient');
      const updatedSession = getSession();
      setSession(updatedSession);
      window.dispatchEvent(new Event('session-changed'));
    } else if (mode === 'caregiver' && canSwitchToRole('Caregiver')) {
      setUserRole('Caregiver');
      const updatedSession = getSession();
      setSession(updatedSession);
      window.dispatchEvent(new Event('session-changed'));
    }
    // Clinician mode is UI-only, doesn't change session role
    setIsOpen(false);
  };

  const handleResetDemo = () => {
    if (confirm('Are you sure you want to reset all demo data? This will clear all documents and session data.')) {
      clearAllDocuments();
      resetSession();
      setSession(getSession());
      setIsOpen(false);
      window.dispatchEvent(new Event('session-changed'));
      window.location.reload(); // Reload to reset state
    }
  };

  const getRoleBadgeClass = (role: string) => {
    return role === 'Caregiver'
      ? 'bg-blue-100 text-blue-700'
      : 'bg-green-100 text-green-700';
  };

  const getRoleIcon = (role: string) => {
    return role === 'Caregiver' ? <Users className="h-3 w-3" /> : <User className="h-3 w-3" />;
  };

  const getViewModeButtonClass = (mode: ViewMode) => {
    const isActive = viewMode === mode;
    if (mode === 'clinician') {
      // Use subtle purple tones (50/100 bg, 700 text) to match other personas' comfort level
      return isActive
        ? 'bg-purple-100 text-purple-700 font-medium'
        : 'bg-gray-100 text-gray-600 hover:bg-gray-200';
    }
    if (mode === 'patient') {
      return isActive
        ? 'bg-green-100 text-green-700 font-medium'
        : 'bg-gray-100 text-gray-600 hover:bg-gray-200';
    }
    // caregiver
    return isActive
      ? 'bg-blue-100 text-blue-700 font-medium'
      : 'bg-gray-100 text-gray-600 hover:bg-gray-200';
  };

  // Get mode indicator styles
  // All personas use consistent 50 bg, 700 text, 200 ring pattern for visual comfort
  const getModeIndicatorStyles = (mode: ViewMode) => {
    switch (mode) {
      case 'clinician':
        return 'bg-purple-50 text-purple-700 ring-purple-200';
      case 'patient':
        return 'bg-green-50 text-green-700 ring-green-200';
      case 'caregiver':
        return 'bg-blue-50 text-blue-700 ring-blue-200';
    }
  };

  const getModeIcon = (mode: ViewMode) => {
    switch (mode) {
      case 'clinician':
        return <Stethoscope className="h-3 w-3" />;
      case 'patient':
        return <User className="h-3 w-3" />;
      case 'caregiver':
        return <Users className="h-3 w-3" />;
    }
  };

  const getModeLabel = (mode: ViewMode) => {
    switch (mode) {
      case 'clinician':
        return 'Clinician View';
      case 'patient':
        return 'Patient View';
      case 'caregiver':
        return 'Caregiver View';
    }
  };

  return (
    <div className="relative flex items-center gap-2" ref={dropdownRef}>
      {/* View Mode Indicator - always visible for all modes */}
      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ${getModeIndicatorStyles(viewMode)}`}>
        {getModeIcon(viewMode)}
        {getModeLabel(viewMode)}
      </span>
      <Button
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2"
      >
        <span className="text-sm flex items-center gap-2">
          <span className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${
            viewMode === 'clinician' ? 'bg-purple-50 text-purple-700' : getRoleBadgeClass(session.user.role)
          }`}>
            {viewMode === 'clinician' ? <Stethoscope className="h-3 w-3" /> : getRoleIcon(session.user.role)}
            {viewMode === 'clinician' ? 'Clinician' : session.user.role}
          </span>
          {viewMode !== 'clinician' && session.user.role === 'Caregiver' && (
            <span className="text-muted-foreground">for</span>
          )}
          {activePatient?.fullName || 'No Patient'}
        </span>
        <ChevronDown className="h-4 w-4" />
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-md shadow-lg z-50">
          <div className="p-2">
            {/* Current Context Display */}
            <div className="px-3 py-2 mb-2 border-b border-gray-200">
              <div className="text-xs text-muted-foreground mb-1">Current Context</div>
              <div className="text-sm font-medium">
                <span className={`px-2 py-1 rounded text-xs mr-2 ${getRoleBadgeClass(session.user.role)}`}>
                  {session.user.role}
                </span>
                {activePatient?.fullName}
              </div>
            </div>

            {/* Switch View Mode */}
            <div className="mb-2">
              <div className="px-3 py-1 text-xs font-semibold text-muted-foreground">
                Viewing As
              </div>
              <div className="flex gap-1 px-2 mb-2">
                <button
                  onClick={() => handleViewModeChange('patient')}
                  disabled={!canSwitchToRole('Patient')}
                  className={`flex-1 flex items-center justify-center gap-1 px-2 py-2 text-xs rounded transition-colors ${
                    getViewModeButtonClass('patient')
                  } ${!canSwitchToRole('Patient') ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <User className="h-3 w-3" />
                  Patient
                </button>
                <button
                  onClick={() => handleViewModeChange('caregiver')}
                  disabled={!canSwitchToRole('Caregiver')}
                  className={`flex-1 flex items-center justify-center gap-1 px-2 py-2 text-xs rounded transition-colors ${
                    getViewModeButtonClass('caregiver')
                  } ${!canSwitchToRole('Caregiver') ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Users className="h-3 w-3" />
                  Caregiver
                </button>
                <button
                  onClick={() => handleViewModeChange('clinician')}
                  className={`flex-1 flex items-center justify-center gap-1 px-2 py-2 text-xs rounded transition-colors ${
                    getViewModeButtonClass('clinician')
                  }`}
                >
                  <Stethoscope className="h-3 w-3" />
                  Clinician
                </button>
              </div>
            </div>

            {/* Switch Patient - Only show for Caregiver or if multiple options */}
            {session.user.role === 'Caregiver' && (
              <div className="mb-2 border-t border-gray-200 pt-2">
                <div className="px-3 py-1 text-xs font-semibold text-muted-foreground">
                  Managing Patient
                </div>
                {getAvailablePatients().map((patient) => (
                  <button
                    key={patient.id}
                    onClick={() => handlePatientChange(patient.id)}
                    className={`w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 ${
                      patient.id === session.activePatientId ? 'bg-blue-50 font-medium' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{patient.fullName}</span>
                      {patient.relationshipLabel && (
                        <span className="text-xs text-muted-foreground">
                          {patient.relationshipLabel}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Profile Link */}
            <div className="border-t border-gray-200 pt-2">
              <Link
                to="/profile"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100"
              >
                <Settings className="h-4 w-4" />
                View Profile
              </Link>
            </div>

            {/* Reset Demo Data */}
            <div className="border-t border-gray-200 pt-2">
              <button
                onClick={handleResetDemo}
                className="w-full text-left px-3 py-2 text-sm text-red-600 rounded hover:bg-red-50"
              >
                Reset Demo Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ContextSwitcher;
