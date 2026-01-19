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
    <div className="flex flex-col items-center justify-center py-16 px-8 bg-bg">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-4xl font-bold text-center text-primary-main">
            CareOS Portal
          </CardTitle>
          <CardDescription className="text-lg text-center">
            <span className={`px-2 py-1 rounded text-sm mr-2 ${getRoleBadgeClass(session.user.role)}`}>
              {session.user.role}
            </span>
            {activePatient ? `Viewing: ${activePatient.fullName}` : 'No active patient'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4 justify-center">
          <Button asChild>
            <Link to="/care-plan">Care Plan</Link>
          </Button>
          <Button asChild>
            <Link to="/documents">Documents</Link>
          </Button>
          <Button asChild>
            <Link to="/messages">Messages</Link>
          </Button>
          <Button asChild>
            <Link to="/timeline">Timeline</Link>
          </Button>
          <Button asChild>
            <Link to="/visits">Visits</Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link to="/login">Login</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default HomePage;
