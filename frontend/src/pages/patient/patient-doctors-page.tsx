import { ArrowRight, BriefcaseBusiness, CalendarDays, Search, ShieldCheck, Stethoscope } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { AppSurface, EmptyState, StatusPill } from '../../components/app/app-ui';
import { buttonVariants } from '../../components/ui/button-variants';
import { Skeleton } from '../../components/ui/feedback';
import { appointmentApi, appointmentError, type DoctorSummary } from '../../features/appointments/appointment-api';
import { ProfileAvatar } from '../../features/profile/profile-image';

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
    <div className="mx-auto w-full max-w-[1160px] pb-8">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--clinora-info-foreground)]">Book care</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em] text-white sm:text-4xl">Find a Doctor</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--clinora-text-muted)]">
            Compare verified Clinora Doctors using professional context and real published availability.
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
            Clinora Doctors
          </h2>
          {!loading ? <span className="text-xs text-[var(--clinora-text-faint)]">{visibleDoctors.length} shown</span> : null}
        </div>

        {loading ? (
          <div className="mt-4 grid gap-3">
            <Skeleton className="h-44 rounded-[24px]" />
            <Skeleton className="h-44 rounded-[24px]" />
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
                  ? 'Try changing the name, specialty, or availability filter.'
                  : 'No approved Clinora Doctors are currently available for booking.'
              }
            />
          </AppSurface>
        ) : null}

        <div className="mt-4 grid gap-4">
          {visibleDoctors.map((doctor) => (
            <DoctorResult key={doctor.id} doctor={doctor} />
          ))}
        </div>
      </section>
    </div>
  );
}

function DoctorResult({ doctor }: { doctor: DoctorSummary }) {
  const organization = [doctor.currentPosition, doctor.currentOrganization].filter(Boolean).join(' · ');
  return (
    <AppSurface as="article" variant="interactive" padding="compact" className="group overflow-hidden">
      <div className="grid gap-5 md:grid-cols-[auto_minmax(0,1fr)_15rem] md:items-center">
        <ProfileAvatar
          source={{ kind: 'patient-doctor', doctorId: doctor.id }}
          name={doctor.displayName}
          size="lg"
          className="rounded-[20px]"
        />

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-white sm:text-xl">{doctor.displayName}</h3>
            <StatusPill tone="success">
              <ShieldCheck size={12} aria-hidden="true" /> Clinora verified
            </StatusPill>
          </div>
          <p className="mt-1 text-sm font-semibold text-[var(--clinora-info-foreground)]">{doctor.specialization}</p>
          <p className="mt-2 text-sm text-[var(--clinora-text-muted)]">
            {doctor.professionalTitle || 'Medical professional'}
            {doctor.yearsExperience == null ? '' : ` · ${doctor.yearsExperience} years experience`}
          </p>
          {organization ? (
            <p className="mt-2 flex items-start gap-2 text-xs leading-5 text-[var(--clinora-text-muted)]">
              <BriefcaseBusiness size={14} className="mt-0.5 shrink-0 text-slate-500" aria-hidden="true" />
              {organization}
            </p>
          ) : null}
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4 md:text-right">
          <p className="flex items-center gap-2 text-xs font-medium text-[var(--clinora-text-faint)] md:justify-end">
            <CalendarDays size={14} aria-hidden="true" /> Next appointment
          </p>
          <p className="mt-2 text-sm font-semibold text-white">
            {doctor.nextAvailableAt ? formatSlot(doctor.nextAvailableAt) : 'No future time published'}
          </p>
          <Link
            to={`/patient/doctors/${doctor.id}`}
            className={`${buttonVariants({ variant: doctor.nextAvailableAt ? 'appPrimary' : 'appSecondary' })} mt-4 w-full`}
          >
            View profile <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </AppSurface>
  );
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
