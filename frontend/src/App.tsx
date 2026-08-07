import { BrowserRouter, Route, Routes } from 'react-router';
import { LandingPage } from './components/landing/landing-page';
import { PublicLayout } from './components/public/public-layout';
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
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
