import { ArrowRight, CalendarDays, Search, ShieldCheck, Stethoscope } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { AppSurface, EmptyState, StatusPill } from '../../components/app/app-ui';
import { buttonVariants } from '../../components/ui/button-variants';
import { Skeleton } from '../../components/ui/feedback';
import { appointmentApi, appointmentError, type DoctorSummary } from '../../features/appointments/appointment-api';

export function PatientDoctorsPage() {
  const [query, setQuery] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [doctors, setDoctors] = useState<DoctorSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    const timer = window.setTimeout(() => {
      appointmentApi
        .doctors({ query: query.trim() || undefined, specialty: specialty || undefined, limit: 30 })
        .then((items) => active && setDoctors(items))
        .catch(
          (requestError) => active && setError(appointmentError(requestError, 'We could not load Clinora Doctors.')),
        )
        .finally(() => active && setLoading(false));
    }, 220);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query, specialty]);

  const specialties = useMemo(
    () => [...new Set(doctors.map((doctor) => doctor.specialization))].sort((a, b) => a.localeCompare(b)),
    [doctors],
  );
  const visibleDoctors = availableOnly ? doctors.filter((doctor) => doctor.nextAvailableAt) : doctors;

  return (
    <div className="mx-auto w-full max-w-[1120px] pb-8">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--clinora-info-foreground)]">
            Book care
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em] text-white sm:text-4xl">Find a Doctor</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--clinora-text-muted)]">
            Choose an approved Clinora Doctor and an available appointment time.
          </p>
        </div>
        <Link to="/patient/appointments" className={buttonVariants({ variant: 'appSecondary' })}>
          My appointments
        </Link>
      </header>

      <AppSurface as="section" variant="elevated" padding="compact" className="mt-7" aria-label="Doctor search">
        <label htmlFor="doctor-search" className="text-sm font-semibold text-white">
          Search by Doctor name or specialty
        </label>
        <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_15rem_auto] md:items-center">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
              size={17}
              aria-hidden="true"
            />
            <input
              id="doctor-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cardiology, Dr. Rahman…"
              className="min-h-11 w-full rounded-xl border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-nested)] pl-10 pr-4 text-sm text-white outline-none placeholder:text-slate-600 focus:border-[var(--clinora-border-interactive)] focus:ring-4 focus:ring-[var(--clinora-focus-ring-soft)]"
            />
          </div>
          <label className="sr-only" htmlFor="doctor-specialty">
            Specialty
          </label>
          <select
            id="doctor-specialty"
            value={specialty}
            onChange={(event) => setSpecialty(event.target.value)}
            className="min-h-11 rounded-xl border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-nested)] px-3 text-sm text-white outline-none focus:border-[var(--clinora-border-interactive)] focus:ring-4 focus:ring-[var(--clinora-focus-ring-soft)]"
          >
            <option value="">All specialties</option>
            {specialty && !specialties.includes(specialty) ? <option value={specialty}>{specialty}</option> : null}
            {specialties.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <label className="flex min-h-11 items-center gap-2 rounded-xl border border-[var(--clinora-border-subtle)] px-3 text-sm font-medium text-[var(--clinora-text-muted)]">
            <input
              type="checkbox"
              checked={availableOnly}
              onChange={(event) => setAvailableOnly(event.target.checked)}
              className="h-4 w-4 accent-cyan-400"
            />
            Has availability
          </label>
        </div>
      </AppSurface>

      <section className="mt-6" aria-labelledby="doctor-results-title">
        <div className="flex items-center justify-between gap-3">
          <h2 id="doctor-results-title" className="text-xl font-semibold text-white">
            Available Clinora Doctors
          </h2>
          {!loading ? (
            <span className="text-xs text-[var(--clinora-text-faint)]">{visibleDoctors.length} shown</span>
          ) : null}
        </div>
        {loading ? (
          <div className="mt-4 space-y-3">
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
          </div>
        ) : null}
        {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
        {!loading && !error && !visibleDoctors.length ? (
          <AppSurface className="mt-4">
            <EmptyState
              icon={<Stethoscope size={18} />}
              title="No matching Doctors"
              copy={
                query || specialty || availableOnly
                  ? 'Try changing the name, specialty or availability filter.'
                  : 'No approved Clinora Doctors are currently available for booking.'
              }
            />
          </AppSurface>
        ) : null}
        <div className="mt-4 space-y-3">
          {visibleDoctors.map((doctor) => (
            <DoctorResult key={doctor.id} doctor={doctor} />
          ))}
        </div>
      </section>
    </div>
  );
}

function DoctorResult({ doctor }: { doctor: DoctorSummary }) {
  return (
    <AppSurface as="article" variant="interactive" padding="compact" className="group">
      <div className="grid gap-5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--clinora-info-soft)] text-sm font-bold text-[var(--clinora-info-foreground)]">
          {initials(doctor.displayName)}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-white">{doctor.displayName}</h3>
            <StatusPill tone="success">
              <ShieldCheck size={12} aria-hidden="true" />
              Clinora approved
            </StatusPill>
          </div>
          <p className="mt-1 text-sm font-medium text-[var(--clinora-info-foreground)]">{doctor.specialization}</p>
          <p className="mt-2 text-sm text-[var(--clinora-text-muted)]">
            {doctor.yearsExperience == null
              ? 'Experience verified during onboarding'
              : `${doctor.yearsExperience} years experience`}
            {doctor.currentOrganization ? ` · ${doctor.currentOrganization}` : ''}
          </p>
          <p className="mt-3 inline-flex items-center gap-2 text-xs text-[var(--clinora-text-faint)]">
            <CalendarDays size={14} aria-hidden="true" />
            {doctor.nextAvailableAt
              ? `Next available ${formatSlot(doctor.nextAvailableAt)}`
              : 'No future availability published yet'}
          </p>
        </div>
        <Link
          to={`/patient/doctors/${doctor.id}`}
          className={buttonVariants({ variant: doctor.nextAvailableAt ? 'appPrimary' : 'appSecondary' })}
        >
          View profile <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>
    </AppSurface>
  );
}
function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}
function formatSlot(value: string) {
  return new Date(value).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}
