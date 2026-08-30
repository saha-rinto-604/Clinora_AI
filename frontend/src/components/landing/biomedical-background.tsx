import { LandingBiomedicalVisual } from './landing-biomedical-visual';
import { PatientReportBiomedicalVisual } from './patient-report-biomedical-visual';

export type BiomedicalBackgroundVariant = 'landing' | 'patient-report';

export function BiomedicalBackground({ variant = 'landing' }: { variant?: BiomedicalBackgroundVariant }) {
  return variant === 'patient-report' ? <PatientReportBiomedicalVisual /> : <LandingBiomedicalVisual />;
}
