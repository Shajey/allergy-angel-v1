import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import PageShell, { PageShellContent } from '@/components/layout/PageShell';
import PageHeader from '@/components/layout/PageHeader';
import { useViewMode } from '@/context/ViewModeContext';
import { getHeaderCopy } from '@/lib/viewMode';
import { getSession, getCaregiverProfile, getSelfPatient, getCaregiverPatients } from '@/lib/sessionStore';
import { getServiceLine } from '@/lib/serviceLines';
import type { SessionState, PatientProfile } from '@/types/session';
import { User, Users, Calendar, Hash, Stethoscope, Info } from 'lucide-react';

function ProfilePage() {
  const { viewMode, identityRole, isDeveloperEntry, isClinicianLoginAs } = useViewMode();
  const [session, setSession] = useState<SessionState>(getSession());

  useEffect(() => {
    const loadSession = () => {
      setSession(getSession());
    };

    loadSession();

    const handleSessionChange = () => {
      loadSession();
    };
    window.addEventListener('session-changed', handleSessionChange);

    return () => {
      window.removeEventListener('session-changed', handleSessionChange);
    };
  }, []);

  const activePatient = session.patients.find((p) => p.id === session.activePatientId);
  const selfPatient = getSelfPatient();
  const caregiverProfile = getCaregiverProfile();
  const caregiverPatients = getCaregiverPatients();
  const patientName = activePatient?.fullName || "patient";
  const headerCopy = getHeaderCopy("profile", patientName, viewMode);

  // Use identityRole for badge styling
  const getIdentityBadgeClass = () => {
    switch (identityRole) {
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

  const getIdentityLabel = () => {
    switch (identityRole) {
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

  // Legacy function for session.user.role
  const getRoleBadgeClass = (role: string) => {
    return role === 'Caregiver'
      ? 'bg-blue-100 text-blue-700'
      : 'bg-green-100 text-green-700';
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const PatientInfoCard = ({ patient, title }: { patient: PatientProfile; title: string }) => {
    const serviceLine = getServiceLine(patient.serviceLineId);
    
    return (
      <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="p-6">
          <CardTitle className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <User className="h-5 w-5" />
            {title}
          </CardTitle>
          <CardDescription>{patient.fullName}</CardDescription>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Calendar className="h-4 w-4" />
                  Date of Birth
                </div>
                <p className="font-medium">{formatDate(patient.dob)}</p>
              </div>
              <div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Hash className="h-4 w-4" />
                  Member ID
                </div>
                <p className="font-medium">{patient.memberId || 'N/A'}</p>
              </div>
            </div>
            
            {serviceLine && (
              <div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Stethoscope className="h-4 w-4" />
                  Service Line
                </div>
                <p className="font-medium">{serviceLine.name}</p>
                <p className="text-sm text-muted-foreground">{serviceLine.description}</p>
              </div>
            )}
            
            {patient.startDate && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">Service Start Date</div>
                <p className="font-medium">{formatDate(patient.startDate)}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <PageShell>
      <PageHeader
        title={headerCopy.title}
        eyebrow={headerCopy.eyebrow}
        subtitle={headerCopy.subtitle}
        viewMode={viewMode}
      />

      <PageShellContent className="max-w-4xl">
        {/* Clinician Login-As Banner */}
        {isClinicianLoginAs && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 flex items-start gap-3 mb-6">
            <Info className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-purple-900">
                Clinician Login-As Mode
              </p>
              <p className="text-sm text-purple-700 mt-1">
                You are viewing the portal as the patient to help with support and troubleshooting.
                This is the patient's view of their care information.
              </p>
            </div>
          </div>
        )}

        {/* Section Header */}
        <section>
          <div className="mb-6">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Account Settings
            </span>
            <h2 className="text-2xl font-bold text-gray-900 mt-1">Your Profile</h2>
            <p className="text-sm text-gray-600 mt-1">
              View your account information and care settings
            </p>
          </div>
        </section>

        {/* Current User Card - Use identityRole as source of truth */}
        <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
          <CardHeader className="p-6">
            <CardTitle className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              {identityRole === 'caregiver' ? (
                <Users className="h-5 w-5" />
              ) : identityRole === 'clinician' ? (
                <Stethoscope className="h-5 w-5" />
              ) : (
                <User className="h-5 w-5" />
              )}
              Current User
            </CardTitle>
            <CardDescription>Your current identity and context</CardDescription>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Display Name</div>
                  <p className="font-medium text-lg">{session.user.displayName}</p>
                </div>
              </div>
              
              <div>
                <div className="text-sm text-muted-foreground mb-1">Identity Role</div>
                <span className={`px-3 py-1 rounded text-sm font-medium ${getIdentityBadgeClass()}`}>
                  {getIdentityLabel()}
                </span>
              </div>
              
              {identityRole === 'caregiver' && activePatient && (
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Managing</div>
                  <p className="font-medium">{activePatient.fullName}</p>
                  {activePatient.relationshipLabel && (
                    <p className="text-sm text-muted-foreground">
                      Relationship: {activePatient.relationshipLabel}
                    </p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Patient Identity - Show Self Patient Info */}
        {identityRole === 'patient' && selfPatient && (
          <PatientInfoCard patient={selfPatient} title="Patient Information" />
        )}

        {/* Caregiver Identity - Show Caregiver Profile and Linked Patients */}
        {identityRole === 'caregiver' && (
          <>
            {/* Caregiver Profile */}
            {caregiverProfile && (
              <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
                <CardHeader className="p-6">
                  <CardTitle className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Caregiver Profile
                  </CardTitle>
                  <CardDescription>Your caregiver information</CardDescription>
                </CardHeader>
                <CardContent className="p-6 pt-0">
                  <div className="space-y-4">
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Name</div>
                      <p className="font-medium">{caregiverProfile.displayName}</p>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Relationship to Patients</div>
                      <p className="font-medium">{caregiverProfile.relationship}</p>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Patients Managed</div>
                      <p className="font-medium">{caregiverProfile.patientIds.length} patient(s)</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Linked Patients */}
            <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
              <CardHeader className="p-6">
                <CardTitle className="text-xl font-semibold text-gray-900">Patients You Manage</CardTitle>
                <CardDescription>Patients linked to your caregiver account</CardDescription>
              </CardHeader>
              <CardContent className="p-6 pt-0">
                {caregiverPatients.length === 0 ? (
                  <p className="text-muted-foreground">No patients linked to your account.</p>
                ) : (
                  <div className="space-y-4">
                    {caregiverPatients.map((patient) => {
                      const serviceLine = getServiceLine(patient.serviceLineId);
                      const isActive = patient.id === session.activePatientId;
                      
                      return (
                        <div
                          key={patient.id}
                          className={`p-4 rounded-lg border ${
                            isActive ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium">{patient.fullName}</h4>
                                {isActive && (
                                  <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                                    Currently Viewing
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {patient.relationshipLabel}
                              </p>
                            </div>
                            <div className="text-right text-sm">
                              <p className="text-muted-foreground">Member ID</p>
                              <p className="font-medium">{patient.memberId || 'N/A'}</p>
                            </div>
                          </div>
                          {serviceLine && (
                            <div className="mt-2 text-sm">
                              <span className="text-muted-foreground">Service: </span>
                              <span className="font-medium">{serviceLine.name}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Clinician Identity - Show currently viewing patient info */}
        {identityRole === 'clinician' && activePatient && (
          <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardHeader className="p-6">
              <CardTitle className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <User className="h-5 w-5" />
                Patient Being Viewed
              </CardTitle>
              <CardDescription>You are viewing this patient's portal in login-as mode</CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              <div className="space-y-4">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Patient Name</div>
                  <p className="font-medium text-lg">{activePatient.fullName}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Member ID</div>
                    <p className="font-medium">{activePatient.memberId || 'N/A'}</p>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Date of Birth</div>
                    <p className="font-medium">{formatDate(activePatient.dob)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Developer mode: show role switch hint when viewing as caregiver */}
        {isDeveloperEntry && viewMode === 'caregiver' && selfPatient && (
          <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardHeader className="p-6">
              <CardTitle className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <User className="h-5 w-5" />
                Your Patient Profile
              </CardTitle>
              <CardDescription>
                Switch to "Patient" role to manage your own care
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{selfPatient.fullName}</p>
                  <p className="text-sm text-muted-foreground">
                    Member ID: {selfPatient.memberId || 'N/A'}
                  </p>
                </div>
                <div className="text-sm text-muted-foreground">
                  Switch to Patient role in the header to view your own care information.
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </PageShellContent>
    </PageShell>
  );
}

export default ProfilePage;
