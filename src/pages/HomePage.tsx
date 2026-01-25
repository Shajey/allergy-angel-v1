import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getSession } from '@/lib/sessionStore';
import type { SessionState } from '@/types/session';

function HomePage() {
  const [session, setSession] = useState<SessionState>(getSession());

  useEffect(() => {
    const loadSession = () => {
      setSession(getSession());
    };

    loadSession();

    // Listen for session changes
    const handleSessionChange = () => {
      loadSession();
    };
    window.addEventListener('session-changed', handleSessionChange);

    return () => {
      window.removeEventListener('session-changed', handleSessionChange);
    };
  }, []);

  const activePatient = session.patients.find((p) => p.id === session.activePatientId);

  const getRoleBadgeClass = (role: string) => {
    return role === 'Caregiver'
      ? 'bg-blue-100 text-blue-700'
      : 'bg-green-100 text-green-700';
  };

  return (
    <div className="flex flex-col items-center justify-center py-8 sm:py-12 lg:py-16 px-4 sm:px-6 lg:px-8 bg-bg">
      <Card className="w-full max-w-2xl">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-2xl sm:text-3xl lg:text-4xl font-bold text-center text-primary-main">
            CareOS Portal
          </CardTitle>
          <CardDescription className="text-sm sm:text-base lg:text-lg text-center mt-2 sm:mt-3">
            <span className={`px-2 py-1 rounded text-xs sm:text-sm mr-2 ${getRoleBadgeClass(session.user.role)}`}>
              {session.user.role}
            </span>
            <span className="break-words">
              {activePatient ? `Viewing: ${activePatient.fullName}` : 'No active patient'}
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 sm:gap-3 lg:gap-4 justify-center p-4 sm:p-6">
          <Button asChild className="w-full sm:w-auto">
            <Link to="/care-plan">Care Plan</Link>
          </Button>
          <Button asChild className="w-full sm:w-auto">
            <Link to="/documents">Documents</Link>
          </Button>
          <Button asChild className="w-full sm:w-auto">
            <Link to="/messages">Messages</Link>
          </Button>
          <Button asChild className="w-full sm:w-auto">
            <Link to="/timeline">Timeline</Link>
          </Button>
          <Button asChild className="w-full sm:w-auto">
            <Link to="/visits">Visits</Link>
          </Button>
          <Button variant="secondary" asChild className="w-full sm:w-auto">
            <Link to="/login">Login</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default HomePage;
