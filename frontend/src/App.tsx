import { BrowserRouter, Route, Routes } from 'react-router';
import { LandingPage } from './components/landing/landing-page';
import { PublicLayout } from './components/public/public-layout';
import { AuthLayout } from './features/auth/auth-layout';
import { AuthProvider } from './features/auth/auth-provider';
import { ProtectedRoute } from './features/auth/protected-route';
import { AccountPage } from './pages/auth/account-page';
import { ForgotPasswordPage } from './pages/auth/forgot-password-page';
import { LoginPage } from './pages/auth/login-page';
import { RegisterPage } from './pages/auth/register-page';
import { ResetPasswordPage } from './pages/auth/reset-password-page';
import { VerifyEmailPage } from './pages/auth/verify-email-page';
import { AboutPage } from './pages/public/about-page';
import { AiClinicalIntelligencePage } from './pages/public/ai-clinical-intelligence-page';
import { ContactPage } from './pages/public/contact-page';
import { EmergencyBloodAssistancePage } from './pages/public/emergency-blood-assistance-page';
import { FaqPage } from './pages/public/faq-page';
import { FeaturesPage } from './pages/public/features-page';
import { LaboratoryOcrPage } from './pages/public/laboratory-ocr-page';
import { NotFoundPage } from './pages/public/not-found-page';
import { PrivacyPage } from './pages/public/privacy-page';
import { ResearchPage } from './pages/public/research-page';
import { TermsPage } from './pages/public/terms-page';

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
      </Route>

      <Route element={<AuthLayout />}>
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="verify-email" element={<VerifyEmailPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route path="account" element={<AccountPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
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
