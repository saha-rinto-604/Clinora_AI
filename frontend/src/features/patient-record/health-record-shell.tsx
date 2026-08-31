import { Link, NavLink } from 'react-router';
import { buttonVariants } from '../../components/ui/button-variants';
import { cn } from '../../lib/cn';
import { formatRecordDate } from './health-record-format';

export function HealthRecordHeader({ lastUpdatedAt }: { lastUpdatedAt?: string | null }) {
  return (
    <header className="flex flex-col gap-5 border-b border-[var(--clinora-border-subtle)] pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--clinora-info-foreground)]">
          Your care record
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em] text-white sm:text-4xl">Health Record</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--clinora-text-muted)]">
          Your healthcare information across Clinora.
        </p>
        <p className="mt-1 text-xs leading-5 text-[var(--clinora-text-faint)]">
          Information from your Health Profile, reports and Clinora care.
          {lastUpdatedAt ? ` Last updated ${formatRecordDate(lastUpdatedAt)}.` : ''}
        </p>
      </div>
      <Link to="/patient/profile" className={buttonVariants({ variant: 'appSecondary' })}>
        Manage Health Profile
      </Link>
    </header>
  );
}

export function HealthRecordTabs() {
  return (
    <nav
      aria-label="Health Record views"
      className="mt-5 flex w-fit rounded-xl border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-nested)] p-1"
    >
      <NavLink end to="/patient/history" className={({ isActive }) => tabClass(isActive)}>
        Overview
      </NavLink>
      <NavLink to="/patient/timeline" className={({ isActive }) => tabClass(isActive)}>
        Timeline
      </NavLink>
    </nav>
  );
}

export function ProfileSourceLabel() {
  return <p className="text-xs text-[var(--clinora-text-faint)]">From your Health Profile</p>;
}

function tabClass(active: boolean) {
  return cn(
    'min-h-10 rounded-lg px-4 py-2 text-sm font-semibold transition',
    active
      ? 'bg-[var(--clinora-info-soft)] text-[var(--clinora-info-foreground)]'
      : 'text-[var(--clinora-text-muted)] hover:text-white',
  );
}
