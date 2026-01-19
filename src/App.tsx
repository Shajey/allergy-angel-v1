import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import HomePage from './pages/HomePage';
import TodayPage from './pages/TodayPage';
import ClinicianTodayPage from './pages/ClinicianTodayPage';
import TasksPage from './pages/TasksPage';
import LoginPage from './pages/LoginPage';
import DemoLoginPage from './pages/DemoLoginPage';
import DocumentsPage from './pages/DocumentsPage';
import CarePlanPage from './pages/CarePlanPage';
import MessagesPage from './pages/MessagesPage';
import TimelinePage from './pages/TimelinePage';
import ProfilePage from './pages/ProfilePage';
import VisitsPage from './pages/VisitsPage';
import { ToastContainer } from './components/ui/toast';
import { ViewModeProvider } from './context/ViewModeContext';

function App() {
  return (
    <ViewModeProvider>
    <Router>
      <ToastContainer />
      <Routes>
        {/* Demo login / persona launcher - standalone page */}
        <Route path="/" element={<DemoLoginPage />} />
        
        {/* Main app routes within AppShell */}
        <Route element={<AppShell />}>
          <Route path="today" element={<TodayPage />} />
          <Route path="clinician" element={<ClinicianTodayPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="home" element={<HomePage />} />
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="care-plan" element={<CarePlanPage />} />
          <Route path="messages" element={<MessagesPage />} />
          <Route path="timeline" element={<TimelinePage />} />
          <Route path="visits" element={<VisitsPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
        
        {/* Legacy login route */}
        <Route path="/login" element={<LoginPage />} />
      </Routes>
    </Router>
    </ViewModeProvider>
  );
}

export default App;
