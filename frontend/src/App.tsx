import { BrowserRouter, Route, Routes } from 'react-router';
import { LandingPage } from './components/landing/landing-page';
import { PublicLayout } from './components/public/public-layout';
import { AuthLayout } from './features/auth/auth-layout';
import { AuthProvider } from './features/auth/auth-provider';
import { ApplicationLayout } from './features/access-applications/application-layout';
import { ProtectedRoute } from './features/auth/protected-route';
import { AccountPage } from './pages/auth/account-page';
import { ForgotPasswordPage } from './pages/auth/forgot-password-page';
import { LoginPage } from './pages/auth/login-page';
import { RegisterPage } from './pages/auth/register-page';
import { ResetPasswordPage } from './pages/auth/reset-password-page';
import { VerifyEmailPage } from './pages/auth/verify-email-page';
import { ApplicationEmailVerificationPage } from './pages/applications/application-email-verification-page';
import { ApplicationActivationPage } from './pages/applications/application-activation-page';
import { ApplicationStatusPage } from './pages/applications/application-status-page';
import { ProfessionalApplicationPage } from './pages/applications/professional-application-page';
import { AccessReviewsPage } from './pages/admin/access-reviews-page';
import { AboutPage } from './pages/public/about-page';
import { AiClinicalIntelligencePage } from './pages/public/ai-clinical-intelligence-page';
import { ContactPage } from './pages/public/contact-page';
import { EmergencyBloodAssistancePage } from './pages/public/emergency-blood-assistance-page';
import { FaqPage } from './pages/public/faq-page';
import { FeaturesPage } from './pages/public/features-page';
import { LaboratoryOcrPage } from './pages/public/laboratory-ocr-page';
import { NotFoundPage } from './pages/public/not-found-page';
import { PrivacyPage } from './pages/public/privacy-page';
import { ProfessionalAccessPage } from './pages/public/professional-access-page';
import { ResearchPage } from './pages/public/research-page';
import { TermsPage } from './pages/public/terms-page';
import { PatientLayout } from './features/patient/patient-layout';
import { PatientShell } from './features/patient/patient-layout';
import { useAuthStore } from './features/auth/auth-store';
import { PatientProfilePage } from './pages/patient/patient-profile-page';
import { PatientReportAnalysisPage } from './pages/patient/patient-report-analysis-page';
import { PatientReportAiInsightPage } from './pages/patient/patient-report-ai-insight-page';
import { PatientReportDetailPage } from './pages/patient/patient-report-detail-page';
import { PatientReportsPage } from './pages/patient/patient-reports-page';
import { PatientPortalPage } from './pages/patient/patient-portal-page';
import { PatientHealthRecordPage } from './pages/patient/patient-health-record-page';
import { PatientTimelinePage } from './pages/patient/patient-timeline-page';
import { PatientDoctorsPage } from './pages/patient/patient-doctors-page';
import { PatientDoctorDetailPage } from './pages/patient/patient-doctor-detail-page';
import { PatientAppointmentsPage } from './pages/patient/patient-appointments-page';
import { PatientAppointmentDetailPage } from './pages/patient/patient-appointment-detail-page';
import { PatientNotificationsPage } from './pages/patient/patient-notifications-page';
import { DoctorAvailabilityPage } from './pages/doctor/doctor-availability-page';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<LandingPage />} />
        <Route path="features" element={<FeaturesPage />} />
        <Route path="ai-clinical-intelligence" element={<AiClinicalIntelligencePage />} />
        <Route path="laboratory-ocr" element={<LaboratoryOcrPage />} />
        <Route path="emergency-blood-assistance" element={<EmergencyBloodAssistancePage />} />
        <Route path="research" element={<ResearchPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="contact" element={<ContactPage />} />
        <Route path="faq" element={<FaqPage />} />
        <Route path="privacy" element={<PrivacyPage />} />
        <Route path="terms" element={<TermsPage />} />
        <Route path="professional-access" element={<ProfessionalAccessPage />} />
      </Route>

      <Route element={<AuthLayout />}>
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="verify-email" element={<VerifyEmailPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />
      </Route>

      <Route element={<ApplicationLayout />}>
        <Route path="apply/doctor" element={<ProfessionalApplicationPage type="DOCTOR" />} />
        <Route path="apply/researcher" element={<ProfessionalApplicationPage type="RESEARCHER" />} />
        <Route path="application/email-verification" element={<ApplicationEmailVerificationPage />} />
        <Route path="application/activate" element={<ApplicationActivationPage />} />
        <Route path="application/status" element={<ApplicationStatusPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route path="account" element={<RoleAwareAccountPage />} />
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['PATIENT']} />}>
        <Route element={<PatientLayout />}>
          <Route path="patient" element={<PatientPortalPage />} />
          <Route path="patient/profile" element={<PatientProfilePage />} />
          <Route path="patient/analyze" element={<PatientReportAnalysisPage />} />
          <Route path="patient/analyze/:reportId" element={<PatientReportAnalysisPage />} />
          <Route path="patient/analyze/:reportId/insight" element={<PatientReportAiInsightPage />} />
          <Route path="patient/reports" element={<PatientReportsPage />} />
          <Route path="patient/reports/:reportId" element={<PatientReportDetailPage />} />
          <Route path="patient/history" element={<PatientHealthRecordPage />} />
          <Route path="patient/timeline" element={<PatientTimelinePage />} />
          <Route path="patient/doctors" element={<PatientDoctorsPage />} />
          <Route path="patient/doctors/:doctorId" element={<PatientDoctorDetailPage />} />
          <Route path="patient/appointments" element={<PatientAppointmentsPage />} />
          <Route path="patient/appointments/:appointmentId" element={<PatientAppointmentDetailPage />} />
          <Route path="patient/notifications" element={<PatientNotificationsPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['DOCTOR']} />}>
        <Route path="doctor/availability" element={<DoctorAvailabilityPage />} />
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['SYSTEM_ADMIN']} />}>
        <Route path="admin/access-reviews" element={<AccessReviewsPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

function RoleAwareAccountPage() {
  const role = useAuthStore((state) => state.user?.role);
  return role === 'PATIENT' ? (
    <PatientShell>
      <AccountPage embedded />
    </PatientShell>
  ) : (
    <AccountPage />
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
