import { ArrowRight, CalendarDays, Clock3, FileText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { AppSurface, EmptyState, StatusPill } from '../../components/app/app-ui';
import { Button } from '../../components/ui/button';
import { buttonVariants } from '../../components/ui/button-variants';
import { Skeleton } from '../../components/ui/feedback';
import { appointmentApi, appointmentError, type Appointment } from '../../features/appointments/appointment-api';
import { cn } from '../../lib/cn';

type Collection = 'UPCOMING' | 'PAST';

export function PatientAppointmentsPage() {
  const [collection, setCollection] = useState<Collection>('UPCOMING');
  const [items, setItems] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    appointmentApi
      .list(collection)
      .then((result) => active && setItems(result))
      .catch(
        (requestError) => active && setError(appointmentError(requestError, 'We could not load your appointments.')),
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [collection, requestVersion]);

  return (
    <div className="mx-auto w-full max-w-[1080px] pb-8">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--clinora-info-foreground)]">
            Your care
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em] text-white sm:text-4xl">Appointments</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--clinora-text-muted)]">
            See upcoming care, review past bookings, and manage the reports you chose to share.
          </p>
        </div>
        <Link to="/patient/doctors" className={buttonVariants({ variant: 'appPrimary' })}>
          Find a Doctor <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </header>

      <nav
        aria-label="Appointment views"
        className="mt-7 flex w-fit rounded-xl border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-nested)] p-1"
      >
        {(['UPCOMING', 'PAST'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setCollection(value)}
            aria-pressed={collection === value}
            className={tabClass(collection === value)}
          >
            {value === 'UPCOMING' ? 'Upcoming' : 'Past'}
          </button>
        ))}
      </nav>

      <section className="mt-6" aria-live="polite">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
          </div>
        ) : null}
        {!loading && error ? (
          <AppSurface variant="attention" aria-labelledby="appointments-error-title">
            <h2 id="appointments-error-title" className="text-lg font-semibold text-white">
              {collection === 'UPCOMING' ? 'Upcoming appointments' : 'Past appointments'}
            </h2>
            <p className="mt-2 text-sm text-[var(--clinora-text-muted)]">
              We couldn&apos;t refresh your appointments. {error}
            </p>
            <Button variant="appSecondary" className="mt-4" onClick={() => setRequestVersion((value) => value + 1)}>
              Try again
            </Button>
          </AppSurface>
        ) : null}
        {!loading && !error && !items.length ? (
          <AppSurface>
            <EmptyState
              icon={<CalendarDays size={18} aria-hidden="true" />}
              title={collection === 'UPCOMING' ? 'No upcoming appointments' : 'No past appointments yet'}
              copy={
                collection === 'UPCOMING'
                  ? 'Find an approved Clinora Doctor and choose an available time when you need care.'
                  : 'Completed and cancelled appointments will appear here.'
              }
              action={
                collection === 'UPCOMING' ? (
                  <Link to="/patient/doctors" className={buttonVariants({ variant: 'appPrimary' })}>
                    Find a Doctor
                  </Link>
                ) : undefined
              }
            />
          </AppSurface>
        ) : null}
        {!loading && !error && items.length ? (
          <div className="space-y-3">
            {items.map((appointment) => (
              <AppointmentRow key={appointment.id} appointment={appointment} />
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function AppointmentRow({ appointment }: { appointment: Appointment }) {
  const scheduled = new Date(appointment.scheduledStart);
  const tone = appointment.status === 'BOOKED' ? 'success' : appointment.status === 'CANCELLED' ? 'warning' : 'neutral';
  return (
    <AppSurface as="article" variant="interactive" padding="compact">
      <div className="grid gap-5 sm:grid-cols-[5rem_minmax(0,1fr)_auto] sm:items-center">
        <div className="rounded-2xl border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-nested)] px-3 py-3 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--clinora-info-foreground)]">
            {scheduled.toLocaleDateString(undefined, { month: 'short' })}
          </p>
          <p className="mt-1 text-2xl font-semibold text-white">{scheduled.getDate()}</p>
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-lg font-semibold text-white">{appointment.doctorName}</h2>
            <StatusPill tone={tone}>
              {appointment.status === 'BOOKED' ? 'Confirmed' : sentenceCase(appointment.status)}
            </StatusPill>
          </div>
          <p className="mt-1 text-sm font-medium text-[var(--clinora-info-foreground)]">{appointment.specialization}</p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-[var(--clinora-text-muted)]">
            <span className="inline-flex items-center gap-1.5">
              <Clock3 size={14} aria-hidden="true" />
              {scheduled.toLocaleString(undefined, {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <FileText size={14} aria-hidden="true" />
              {appointment.sharedReportCount} report{appointment.sharedReportCount === 1 ? '' : 's'} shared
            </span>
          </div>
        </div>
        <Link to={`/patient/appointments/${appointment.id}`} className={buttonVariants({ variant: 'appSecondary' })}>
          View details <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>
    </AppSurface>
  );
}

function tabClass(active: boolean) {
  return cn(
    'min-h-9 rounded-lg px-4 py-2 text-sm font-semibold transition',
    active
      ? 'bg-[var(--clinora-info-soft)] text-[var(--clinora-info-foreground)]'
      : 'text-[var(--clinora-text-muted)] hover:text-white',
  );
}
function sentenceCase(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}
