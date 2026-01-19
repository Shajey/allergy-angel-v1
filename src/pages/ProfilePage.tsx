import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import PageShell, { PageShellContent } from '@/components/layout/PageShell';
import PageHeader from '@/components/layout/PageHeader';
import { useViewMode } from '@/context/ViewModeContext';
import { getHeaderCopy } from '@/lib/viewMode';
import { getSession, getCaregiverProfile, getSelfPatient, getCaregiverPatients } from '@/lib/sessionStore';
import { getServiceLine } from '@/lib/serviceLines';
import type { SessionState, PatientProfile } from '@/types/session';
import { User, Users, Calendar, Hash, Stethoscope } from 'lucide-react';

function ProfilePage() {
  const { viewMode } = useViewMode();
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

        {/* Current User Card */}
        <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
          <CardHeader className="p-6">
            <CardTitle className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              {session.user.role === 'Caregiver' ? (
                <Users className="h-5 w-5" />
              ) : (
                <User className="h-5 w-5" />
              )}
              Current User
            </CardTitle>
            <CardDescription>Your current viewing role and context</CardDescription>
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
                <div className="text-sm text-muted-foreground mb-1">Current Role</div>
                <span className={`px-3 py-1 rounded text-sm font-medium ${getRoleBadgeClass(session.user.role)}`}>
                  {session.user.role}
                </span>
              </div>
              
              {session.user.role === 'Caregiver' && activePatient && (
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

        {/* Patient Role - Show Self Patient Info */}
        {session.user.role === 'Patient' && selfPatient && (
          <PatientInfoCard patient={selfPatient} title="Patient Information" />
        )}

        {/* Caregiver Role - Show Caregiver Profile and Linked Patients */}
        {session.user.role === 'Caregiver' && (
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

        {/* If user can also be a patient, show their patient profile */}
        {session.user.role === 'Caregiver' && selfPatient && (
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
