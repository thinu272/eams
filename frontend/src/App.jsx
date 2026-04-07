import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { hasAnyRole } from './utils/rbac';

// Public pages
import HomePage from './pages/public/HomePage';
import EventsListingPage from './pages/public/EventsListingPage';
import EventDetailPage from './pages/public/EventDetailPage';

// Auth
import LoginPage from './pages/auth/LoginPage';
import SignupPage from './pages/auth/SignupPage';

// Buyer
import ConfirmOrderPage from './pages/buyer/ConfirmOrderPage';
import AttendeeConfirmPage from './pages/buyer/AttendeeConfirmPage';
import InviteAcceptPage from './pages/buyer/InviteAcceptPage';
import CheckoutPage from './pages/buyer/CheckoutPage';
import BuyerDashboardPage from './pages/buyer/BuyerDashboardPage';
import TicketWalletPage from './pages/buyer/TicketWalletPage';
import ResubmitPage from './pages/buyer/ResubmitPage';

// Admin
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminEvents from './pages/admin/AdminEvents';
import AdminUsers from './pages/admin/AdminUsers';
import VerificationDashboard from './pages/admin/VerificationDashboard';

// Organiser
import OrganiserDashboard from './pages/organiser/OrganiserDashboard';
import OrganiserAttendees from './pages/organiser/OrganiserAttendees';
import OrganiserTeam from './pages/organiser/OrganiserTeam';
import EntryLogsPage from './pages/organiser/EntryLogsPage';
import ReportsPage from './pages/organiser/ReportsPage';

// Sub-organiser
import SubOrgDashboard from './pages/suborg/SubOrgDashboard';
import SubOrgAttendees from './pages/suborg/SubOrgAttendees';
import BulkUploadPage from './pages/suborg/BulkUploadPage';
import PhotoVerifyPage from './pages/suborg/PhotoVerifyPage';
import EventEditPage from './pages/shared/EventEditPage';

// Entry
import EntryScannerPage from './pages/entry/EntryScannerPage';
import ZoneScannerPage from './pages/entry/ZoneScannerPage';

// Auditor
import AuditorDashboard from './pages/auditor/AuditorDashboard';
import AuditorLogsPage from './pages/auditor/AuditorLogsPage';
import AuditorReportsPage from './pages/auditor/AuditorReportsPage';

// 404
import NotFoundPage from './pages/NotFoundPage';
import ShortLinkRedirectPage from './pages/public/ShortLinkRedirectPage';

// Protected route wrapper
const Protected = ({ children, roles }) => {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"/>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !hasAnyRole(user.role, roles)) return <Navigate to="/login" replace />;
  return children;
};

const AppRoutes = () => (
  <Routes>
    {/* Public */}
    <Route path="/" element={<HomePage />} />
    <Route path="/events" element={<EventsListingPage />} />
    <Route path="/events/:slug" element={<EventDetailPage />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/signup" element={<SignupPage />} />

    {/* Buyer confirmation flow - public links from email */}
    <Route path="/confirm/:token" element={<ConfirmOrderPage />} />
    <Route path="/invite/:token" element={<InviteAcceptPage />} />
    <Route path="/resubmit/:token" element={<ResubmitPage />} />
    <Route path="/checkout" element={<CheckoutPage />} />
    <Route path="/attendee/confirm/:token" element={<AttendeeConfirmPage />} />
    <Route path="/dashboard" element={<Protected roles={['BUYER']}><BuyerDashboardPage /></Protected>} />
    <Route path="/ticket/:token" element={<TicketWalletPage />} />
    <Route path="/t/:code" element={<ShortLinkRedirectPage />} />

    {/* Admin */}
    <Route path="/admin/dashboard" element={<Protected roles={['main_admin','super_admin']}><AdminDashboard /></Protected>} />
    <Route path="/admin/events" element={<Protected roles={['main_admin','super_admin']}><AdminEvents /></Protected>} />
    <Route path="/admin/events/:id" element={<Protected roles={['main_admin','super_admin']}><EventEditPage /></Protected>} />
    <Route path="/admin/users" element={<Protected roles={['main_admin','super_admin']}><AdminUsers /></Protected>} />
    <Route path="/admin/verification" element={<Protected roles={['main_admin','main_organiser','sub_organiser']}><VerificationDashboard /></Protected>} />
    <Route path="/admin/reports" element={<Protected roles={['main_admin','super_admin']}><ReportsPage /></Protected>} />

    {/* Main Organiser */}
    <Route path="/organiser/dashboard" element={<Protected roles={['main_organiser']}><OrganiserDashboard /></Protected>} />
    <Route path="/organiser/events" element={<Protected roles={['main_organiser']}><AdminEvents /></Protected>} />
    <Route path="/organiser/events/:id" element={<Protected roles={['main_organiser']}><EventEditPage /></Protected>} />
    <Route path="/organiser/attendees" element={<Protected roles={['main_organiser']}><OrganiserAttendees /></Protected>} />
    <Route path="/organiser/team" element={<Protected roles={['main_organiser']}><OrganiserTeam /></Protected>} />
    <Route path="/organiser/entry-logs" element={<Protected roles={['main_organiser']}><EntryLogsPage /></Protected>} />
    <Route path="/organiser/reports" element={<Protected roles={['main_organiser']}><ReportsPage /></Protected>} />

    {/* Sub-Organiser */}
    <Route path="/suborg/dashboard" element={<Protected roles={['sub_organiser']}><SubOrgDashboard /></Protected>} />
    <Route path="/suborg/attendees" element={<Protected roles={['sub_organiser']}><SubOrgAttendees /></Protected>} />
    <Route path="/suborg/upload" element={<Protected roles={['sub_organiser']}><BulkUploadPage /></Protected>} />
    <Route path="/suborg/verify" element={<Protected roles={['sub_organiser']}><PhotoVerifyPage /></Protected>} />

    {/* Entry / Staff */}
    <Route path="/entry" element={<Protected roles={['main_admin','main_organiser','sub_organiser','staff','volunteer']}><EntryScannerPage /></Protected>} />
    <Route path="/entry-scan" element={<Protected roles={['main_admin','main_organiser','sub_organiser','staff','volunteer']}><EntryScannerPage /></Protected>} />
    <Route path="/zone-scan" element={<Protected roles={['main_admin','main_organiser','sub_organiser','staff','volunteer']}><ZoneScannerPage /></Protected>} />
    <Route path="/entry/logs" element={<Protected roles={['main_admin','main_organiser','staff']}><EntryLogsPage /></Protected>} />

    {/* Auditor */}
    <Route path="/auditor/dashboard" element={<Protected roles={['auditor']}><AuditorDashboard /></Protected>} />
    <Route path="/auditor/reports" element={<Protected roles={['auditor']}><AuditorReportsPage /></Protected>} />
    <Route path="/auditor/logs" element={<Protected roles={['auditor']}><AuditorLogsPage /></Protected>} />

    <Route path="*" element={<NotFoundPage />} />
  </Routes>
);

const App = () => {
  React.useEffect(() => {
    const handleUnhandledRejection = (event) => {
      if (event?.reason?.response?.status === 403) {
        // 403 errors are already handled via toast in api interceptor
        event.preventDefault();
        return;
      }
      console.error('Unhandled promise rejection:', event.reason);
    };
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => window.removeEventListener('unhandledrejection', handleUnhandledRejection);
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" toastOptions={{ duration: 3500, style: { fontSize: '14px' } }} />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
