import type { ReactNode } from 'react';
import '../../styles/patient-care.css';

/** Shared decorative artwork; all identities, copy and actions remain accessible React content. */
export function PatientCareHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action: ReactNode;
}) {
  return (
    <header className="patient-care-header patient-care-art">
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--clinora-info-foreground)]">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em] text-white">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--clinora-text-muted)]">{description}</p>
      </div>
      <div className="shrink-0">{action}</div>
    </header>
  );
}
