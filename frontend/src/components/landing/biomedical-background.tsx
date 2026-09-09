import { LandingAmbientVideo } from './landing-ambient-video';
import { PatientReportBiomedicalVisual } from './patient-report-biomedical-visual';

export type BiomedicalBackgroundVariant = 'landing' | 'patient-report';

export function BiomedicalBackground({ variant = 'landing' }: { variant?: BiomedicalBackgroundVariant }) {
  return variant === 'patient-report' ? <PatientReportBiomedicalVisual /> : <LandingAmbientVideo />;
}
