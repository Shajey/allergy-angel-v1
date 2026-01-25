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
  getCaregiverProfile,
} from '@/lib/sessionStore';
import { clearAllDocuments } from '@/lib/storage';
import type { SessionState, PatientProfile } from '@/types/session';
import { ChevronDown, User, Users, Settings, Stethoscope, Heart } from 'lucide-react';
import { useViewMode, type ViewMode, type IdentityRole } from '@/context/ViewModeContext';

function ContextSwitcher() {
  const [session, setSession] = useState<SessionState>(getSession());
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { viewMode, setViewMode, identityRole, isDeveloperEntry, isClinicianLoginAs } = useViewMode();

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
  const caregiverProfile = getCaregiverProfile();
  
  /**
   * Get the caregiver's relationship TO the active patient.
   * The relationshipLabel on the patient record indicates the patient's relation to caregiver
   * (e.g., "Daughter" means patient is caregiver's daughter).
   * We invert this for display: if patient is "Daughter", caregiver is "Parent".
   */
  const getCaregiverRelationshipToPatient = (patient: PatientProfile | undefined): string | null => {
    if (!patient || !caregiverProfile) return null;
    // The patient.relationshipLabel tells us what the patient IS to the caregiver
    // We need to describe what the caregiver IS to the patient
    const patientRelation = patient.relationshipLabel;
    if (!patientRelation || patientRelation === 'Self') return null;
    
    // Return the caregiver's relationship (stored in caregiverProfile.relationship)
    // This is more accurate than trying to invert the patient's label
    return caregiverProfile.relationship || null;
  };

  const handlePatientChange = (patientId: string) => {
    setActivePatientId(patientId);
    // Update state immediately
    const updatedSession = getSession();
    setSession(updatedSession);
    setIsOpen(false);
    // Trigger a custom event to notify other components
    window.dispatchEvent(new Event('session-changed'));
  };

  const _handleRoleChange = (role: 'Patient' | 'Caregiver') => {
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
      // Clear all role/mode storage to return to landing page
      localStorage.removeItem('vns-view-mode');
      localStorage.removeItem('vns-entry-mode');
      localStorage.removeItem('vns-identity-role');
      setSession(getSession());
      setIsOpen(false);
      window.dispatchEvent(new Event('session-changed'));
      window.location.href = '/'; // Redirect to landing page
    }
  };

  // Get identity role badge class based on identityRole (source of truth)
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
        return <User className="h-3 w-3" />;
      case 'caregiver':
        return <Users className="h-3 w-3" />;
      case 'clinician':
        return <Stethoscope className="h-3 w-3" />;
      case 'developer':
        return <Settings className="h-3 w-3" />;
    }
  };

  const getIdentityLabel = (role: IdentityRole) => {
    switch (role) {
      case 'patient':
        return 'Patient';
      case 'caregiver':
        return 'Caregiver';
      case 'clinician':
        return 'Clinician (Login As)';
      case 'developer':
        return 'Developer';
    }
  };

  // Deprecated: only used for legacy session.user.role
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
      case 'developer':
        return 'bg-slate-50 text-slate-700 ring-slate-200';
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
      case 'developer':
        return <Settings className="h-3 w-3" />;
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
      case 'developer':
        return 'Developer Mode';
    }
  };

  // Determine the effective role to display (for developer, show what they're viewing as)
  const displayRole: IdentityRole = isDeveloperEntry ? (viewMode as IdentityRole) : identityRole;
  
  // Get the identity display name (who is logged in)
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
  
  return (
    <div className="relative flex items-center gap-2" ref={dropdownRef}>
      {/* Role Indicator Pill - shows identityRole (or viewMode for developer) */}
      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ${getModeIndicatorStyles(displayRole)}`}>
        {getModeIcon(displayRole)}
        {getModeLabel(displayRole)}
      </span>
      <Button
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm"
      >
        <span className="text-xs sm:text-sm flex items-center gap-1 sm:gap-2 flex-wrap">
          {/* Identity badge + name - clear who is logged in */}
          <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-xs flex items-center gap-1 ${getIdentityBadgeClass(displayRole)}`}>
            {getIdentityIcon(displayRole)}
            <span className="hidden sm:inline">{getIdentityLabel(displayRole)}</span>
          </span>
          <span className="text-gray-700 font-medium truncate max-w-[120px] sm:max-w-none">
            {getIdentityDisplayName()}
          </span>
          {/* For caregiver/clinician, also show which patient chart is being viewed */}
          {(displayRole === 'caregiver' || displayRole === 'clinician') && activePatient && (
            <>
              <span className="text-gray-400 hidden sm:inline">→</span>
              <span className="text-gray-600 truncate max-w-[100px] sm:max-w-none">{activePatient.fullName}</span>
            </>
          )}
        </span>
        <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-80 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-[80vh] overflow-y-auto">
          <div className="p-2">
            
            {/* ============================================================
                SECTION 1: IDENTITY - Who am I logged in as?
                ============================================================ */}
            <div className="px-3 py-2 mb-2 border-b border-gray-200">
              <div className="text-xs text-muted-foreground mb-2">Your Identity</div>
              
              {/* Identity Badge + Name */}
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${getIdentityBadgeClass(displayRole)}`}>
                  {getIdentityIcon(displayRole)}
                  {getIdentityLabel(displayRole)}
                </span>
                {/* Show identity name based on role */}
                <span className="text-sm font-medium">
                  {displayRole === 'patient' 
                    ? activePatient?.fullName 
                    : displayRole === 'caregiver' 
                      ? (caregiverProfile?.displayName || session.user.displayName)
                      : displayRole === 'clinician'
                        ? 'Support Staff'
                        : 'Developer'}
                </span>
              </div>

              {/* CARE CONTEXT: Which patient chart am I viewing? */}
              {/* For patient identity, the context IS themselves */}
              {/* For caregiver/clinician, show the active patient separately */}
              {(displayRole === 'caregiver' || displayRole === 'clinician') && activePatient && (
                <div className="bg-gray-50 rounded px-2 py-1.5 mt-2">
                  <div className="text-xs text-muted-foreground">Viewing Patient</div>
                  <div className="text-sm font-medium text-gray-900">{activePatient.fullName}</div>
                </div>
              )}

              {/* Caregiver: Show relationship to current patient */}
              {displayRole === 'caregiver' && activePatient && getCaregiverRelationshipToPatient(activePatient) && (
                <div className="text-xs text-blue-600 mt-1.5 flex items-center gap-1">
                  <Heart className="h-3 w-3" />
                  Relationship: {getCaregiverRelationshipToPatient(activePatient)} of {activePatient.fullName.split(' ')[0]}
                </div>
              )}

              {/* Clinician login-as hint */}
              {(isClinicianLoginAs || (isDeveloperEntry && viewMode === 'clinician')) && (
                <p className="text-xs text-purple-600 mt-1.5">
                  Viewing portal as patient for support/troubleshooting
                </p>
              )}
            </div>

            {/* ============================================================
                SECTION 2: DEVELOPER ROLE SIMULATION (only for developer)
                ============================================================ */}
            {isDeveloperEntry && (
              <div className="mb-2">
                <div className="px-3 py-1 text-xs font-semibold text-muted-foreground">
                  Simulating Role
                </div>
                <div className="flex gap-1 px-2 mb-2">
                  <button
                    onClick={() => handleViewModeChange('patient')}
                    disabled={!canSwitchToRole('Patient')}
                    className={`flex-1 flex items-center justify-center gap-1 px-2 py-2 text-xs rounded transition-colors min-h-[44px] ${
                      getViewModeButtonClass('patient')
                    } ${!canSwitchToRole('Patient') ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <User className="h-3 w-3" />
                    Patient
                  </button>
                  <button
                    onClick={() => handleViewModeChange('caregiver')}
                    disabled={!canSwitchToRole('Caregiver')}
                    className={`flex-1 flex items-center justify-center gap-1 px-2 py-2 text-xs rounded transition-colors min-h-[44px] ${
                      getViewModeButtonClass('caregiver')
                    } ${!canSwitchToRole('Caregiver') ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <Users className="h-3 w-3" />
                    Caregiver
                  </button>
                  <button
                    onClick={() => handleViewModeChange('clinician')}
                    className={`flex-1 flex items-center justify-center gap-1 px-2 py-2 text-xs rounded transition-colors min-h-[44px] ${
                      getViewModeButtonClass('clinician')
                    }`}
                  >
                    <Stethoscope className="h-3 w-3" />
                    Clinician
                  </button>
                </div>
              </div>
            )}

            {/* ============================================================
                SECTION 3: PATIENT SELECTION (Caregiver/Clinician only)
                Patient identity should NOT see this - they only view self
                ============================================================ */}
            {(identityRole === 'caregiver' || identityRole === 'clinician' || 
              (isDeveloperEntry && (viewMode === 'caregiver' || viewMode === 'clinician'))) && (
              <div className="mb-2 border-t border-gray-200 pt-2">
                <div className="px-3 py-1 text-xs font-semibold text-muted-foreground">
                  {displayRole === 'clinician' ? 'Select Patient' : 'Patients You Manage'}
                </div>
                {getAvailablePatients(displayRole).map((patient) => (
                  <button
                    key={patient.id}
                    onClick={() => handlePatientChange(patient.id)}
                    className={`w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 min-h-[48px] flex items-center ${
                      patient.id === session.activePatientId ? 'bg-blue-50 font-medium' : ''
                    }`}
                  >
                    {/* Show patient name only - relationship context is shown in identity section */}
                    <span>{patient.fullName}</span>
                  </button>
                ))}
              </div>
            )}

            {/* ============================================================
                SECTION 4: CARE TEAM (Patient identity only)
                Show caregivers who help this patient
                ============================================================ */}
            {displayRole === 'patient' && caregiverProfile && (
              <div className="mb-2 border-t border-gray-200 pt-2">
                <div className="px-3 py-1 text-xs font-semibold text-muted-foreground">
                  Your Care Team
                </div>
                <div className="px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-600" />
                    <span>{caregiverProfile.displayName}</span>
                    <span className="text-xs text-muted-foreground">— {caregiverProfile.relationship}</span>
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================
                SECTION 5: ACTIONS
                ============================================================ */}
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
