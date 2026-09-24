import { ArrowRight, CalendarDays, Clock3, FileText, Stethoscope, Video, MapPin } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { AppSurface, EmptyState, IconWell, StatusPill } from '../../components/app/app-ui';
import { PatientCareHeader } from '../../components/patient/patient-care-header';
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
  const [counts, setCounts] = useState<Partial<Record<Collection, number>>>({});
  const [sort, setSort] = useState<'soonest' | 'latest'>('soonest');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    appointmentApi
      .list(collection)
      .then((result) => {
        if (!active) return;
        setItems(result);
        setCounts((current) => ({ ...current, [collection]: result.length }));
      })
      .catch(
        (requestError) => active && setError(appointmentError(requestError, 'We could not load your appointments.')),
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [collection, requestVersion]);

  const changeCollection = (value: Collection) => {
    setCollection(value);
    setSort(value === 'UPCOMING' ? 'soonest' : 'latest');
  };
  const sortedItems = [...items].sort(
    (a, b) =>
      (new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime()) * (sort === 'soonest' ? 1 : -1),
  );

  return (
    <div className="patient-care">
      <PatientCareHeader
        eyebrow="Your care"
        title="Appointments"
        description="See upcoming care, review past bookings, and manage the reports you chose to share."
        action={
          <Link to="/patient/doctors" className={buttonVariants({ variant: 'appPrimary' })}>
            Find a Doctor <ArrowRight size={15} aria-hidden="true" />
          </Link>
        }
      />

      <section className="patient-care-summary" aria-label="Appointment summary">
        {(['UPCOMING', 'PAST'] as const).map((value) => (
          <AppSurface key={value} padding="none" variant={collection === value ? 'hero' : 'interactive'}>
            <button
              type="button"
              className="patient-care-summary-item"
              onClick={() => changeCollection(value)}
              aria-label={`Show ${value.toLowerCase()} appointments`}
            >
              <IconWell tone={value === 'UPCOMING' ? 'info' : 'neutral'}>
                {value === 'UPCOMING' ? (
                  <CalendarDays size={19} aria-hidden="true" />
                ) : (
                  <Clock3 size={19} aria-hidden="true" />
                )}
              </IconWell>
              <span className="min-w-0">
                <strong className="block text-xl font-semibold">{counts[value] ?? 'View'}</strong>
                <span className="block text-xs text-[var(--clinora-text-muted)]">
                  {value === 'UPCOMING' ? 'Upcoming appointments' : 'Past appointments'}
                </span>
              </span>
            </button>
          </AppSurface>
        ))}
        <AppSurface padding="none">
          <div className="patient-care-summary-item">
            <IconWell>
              <FileText size={19} aria-hidden="true" />
            </IconWell>
            <div>
              <strong className="block text-xl font-semibold">
                {loading || error ? '—' : items.reduce((sum, item) => sum + item.sharedReportCount, 0)}
              </strong>
              <span className="block text-xs text-[var(--clinora-text-muted)]">Reports shared</span>
              <span className="block text-[11px] text-[var(--clinora-text-faint)]">In this view</span>
            </div>
          </div>
        </AppSurface>
        <AppSurface padding="none" variant="interactive">
          <Link to="/patient/doctors" className="patient-care-summary-item">
            <IconWell tone="success">
              <Stethoscope size={19} aria-hidden="true" />
            </IconWell>
            <span>
              <strong className="block text-sm font-semibold">Find a Doctor</strong>
              <span className="block text-xs text-[var(--clinora-text-muted)]">Book a consultation</span>
            </span>
          </Link>
        </AppSurface>
      </section>

      <div className="patient-care-toolbar">
        <nav
          aria-label="Appointment views"
          className="flex w-fit rounded-xl border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-nested)] p-1"
        >
          {(['UPCOMING', 'PAST'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => changeCollection(value)}
              aria-pressed={collection === value}
              className={tabClass(collection === value)}
            >
              {value === 'UPCOMING' ? 'Upcoming' : 'Past'}
              {counts[value] !== undefined ? ` (${counts[value]})` : ''}
            </button>
          ))}
        </nav>
        <label className="flex items-center gap-2 text-xs text-[var(--clinora-text-muted)]">
          Sort by
          <select
            className="patient-care-control"
            value={sort}
            onChange={(event) => setSort(event.target.value as typeof sort)}
          >
            <option value="soonest">Date (Soonest)</option>
            <option value="latest">Date (Latest)</option>
          </select>
        </label>
      </div>

      <section aria-live="polite" aria-busy={loading}>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
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
            {sortedItems.map((appointment) => (
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
    <AppSurface as="article" variant="interactive" padding="compact" className="sm:p-4">
      <div className="patient-care-appointment-row">
        <div className="rounded-xl border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-nested)] px-2 py-2 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--clinora-info-foreground)]">
            {scheduled.toLocaleDateString(undefined, { month: 'short', timeZone: appointment.bookingTimezone })}
          </p>
          <p className="text-2xl font-semibold text-white">
            {scheduled.toLocaleDateString(undefined, { day: 'numeric', timeZone: appointment.bookingTimezone })}
          </p>
          <p className="text-[10px] uppercase text-[var(--clinora-text-muted)]">
            {scheduled.toLocaleDateString(undefined, { weekday: 'short', timeZone: appointment.bookingTimezone })}
          </p>
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-white">{appointment.doctorName}</h2>
            <StatusPill tone={tone}>
              {appointment.status === 'BOOKED' ? 'Confirmed' : sentenceCase(appointment.status)}
            </StatusPill>
          </div>
          <p className="mt-1 text-sm font-medium text-[var(--clinora-info-foreground)]">{appointment.specialization}</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--clinora-text-muted)]">
            {appointment.consultationMode === 'ONLINE' ? (
              <Video size={14} aria-hidden="true" />
            ) : (
              <MapPin size={14} aria-hidden="true" />
            )}
            {appointment.consultationMode === 'ONLINE'
              ? 'Online consultation'
              : appointment.consultationMode === 'IN_PERSON'
                ? 'In-person consultation'
                : 'Consultation type not recorded'}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--clinora-text-muted)]">
            <span className="inline-flex items-center gap-1.5">
              <Clock3 size={14} aria-hidden="true" />
              {scheduled.toLocaleString(undefined, {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                hour: 'numeric',
                minute: '2-digit',
                timeZone: appointment.bookingTimezone,
                timeZoneName: 'short',
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
