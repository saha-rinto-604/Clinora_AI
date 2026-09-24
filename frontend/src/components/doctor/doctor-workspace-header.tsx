import type { ReactNode } from 'react';
import '../../styles/doctor-workspace-header.css';

const backgrounds = {
  patients: '/assets/biomedical/doctor-patients-header.webp',
  inbox: '/assets/biomedical/doctor-clinical-inbox-header.webp',
  schedule: '/assets/biomedical/doctor-schedule-header.webp',
  availability: '/assets/biomedical/doctor-availability-header.webp',
} as const;

export function DoctorWorkspaceHeader({
  eyebrow,
  title,
  description,
  background,
  actions,
  integrated = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  background: keyof typeof backgrounds;
  actions?: ReactNode;
  integrated?: boolean;
}) {
  return (
    <header className="doctor-workspace-header" data-background={background} data-integrated={integrated || undefined}>
      <div
        className="doctor-workspace-header__art"
        style={{ backgroundImage: `url(${backgrounds[background]})` }}
        aria-hidden="true"
      />
      <div className="doctor-workspace-header__copy">
        <p className="doctor-workspace-header__eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="doctor-workspace-header__description">{description}</p>
      </div>
      {actions ? <div className="doctor-workspace-header__actions">{actions}</div> : null}
    </header>
  );
}
