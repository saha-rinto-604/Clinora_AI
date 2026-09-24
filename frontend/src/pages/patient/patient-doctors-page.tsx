import { ArrowRight, BriefcaseBusiness, CalendarDays, Search, ShieldCheck, Stethoscope } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { AppSurface, EmptyState, StatusPill } from '../../components/app/app-ui';
import { PatientCareHeader } from '../../components/patient/patient-care-header';
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
  const [sort, setSort] = useState('available');

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
  const visibleDoctors = (availableOnly ? doctors.filter((doctor) => doctor.nextAvailableAt) : [...doctors]).sort(
    (a, b) => {
      if (sort === 'name') return a.displayName.localeCompare(b.displayName);
      const next = (value: string | null) => (value ? new Date(value).getTime() : Infinity);
      return next(a.nextAvailableAt) - next(b.nextAvailableAt) || a.displayName.localeCompare(b.displayName);
    },
  );

  return (
    <div className="patient-care">
      <PatientCareHeader
        eyebrow="Book care"
        title="Find a Doctor"
        description="Compare verified Clinora Doctors using professional context and real published availability."
        action={
          <Link to="/patient/appointments" className={buttonVariants({ variant: 'appSecondary' })}>
            <CalendarDays size={16} aria-hidden="true" /> My appointments
          </Link>
        }
      />

      <AppSurface as="section" padding="compact" className="mt-3 sm:p-4" aria-label="Doctor search">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_13rem_auto] xl:items-end">
          <div className="sm:col-span-2 xl:col-span-1">
            <label htmlFor="doctor-search" className="mb-2 block text-xs font-medium text-white">
              Search by Doctor name or specialty
            </label>
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
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium text-white" htmlFor="doctor-specialty">
              Specialty
            </label>
            <select
              id="doctor-specialty"
              value={specialty}
              onChange={(event) => setSpecialty(event.target.value)}
              className="min-h-11 w-full rounded-xl border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-nested)] px-3 text-sm text-white outline-none focus:border-[var(--clinora-border-interactive)] focus:ring-4 focus:ring-[var(--clinora-focus-ring-soft)]"
            >
              <option value="">All specialties</option>
              {specialty && !specialties.includes(specialty) ? <option value={specialty}>{specialty}</option> : null}
              {specialties.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-white">Availability</p>
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
        </div>
      </AppSurface>

      <section aria-labelledby="doctor-results-title" aria-busy={loading}>
        <div className="patient-care-toolbar">
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="doctor-results-title" className="text-lg font-semibold text-white">
              Clinora Doctors
            </h2>
            {!loading && !error ? <StatusPill>{visibleDoctors.length} shown</StatusPill> : null}
          </div>
          <label className="flex items-center gap-2 text-xs text-[var(--clinora-text-muted)]">
            Sort by
            <select
              aria-label="Sort shown Doctors"
              className="patient-care-control"
              value={sort}
              onChange={(event) => setSort(event.target.value)}
            >
              <option value="available">Next available</option>
              <option value="name">Name (A–Z)</option>
            </select>
          </label>
        </div>

        {loading ? (
          <div className="mt-4 grid gap-3">
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
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

        {!loading && !error ? (
          <div className="grid gap-2.5">
            {visibleDoctors.map((doctor) => (
              <DoctorResult key={doctor.id} doctor={doctor} />
            ))}
          </div>
        ) : null}
        {!loading && !error && doctors.length === 30 ? (
          <p className="mt-3 text-xs text-[var(--clinora-text-muted)]">
            Showing up to 30 matches. Refine your search to find more Doctors. Availability and sorting apply to these
            results.
          </p>
        ) : null}
      </section>
    </div>
  );
}

function DoctorResult({ doctor }: { doctor: DoctorSummary }) {
  const organization = [doctor.currentPosition, doctor.currentOrganization].filter(Boolean).join(' · ');
  return (
    <AppSurface as="article" variant="interactive" padding="compact" className="group sm:p-4">
      <div className="patient-care-doctor-row">
        <ProfileAvatar
          source={{ kind: 'patient-doctor', doctorId: doctor.id }}
          name={doctor.displayName}
          size="md"
          className="h-12 w-12 rounded-full"
        />

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-white">{doctor.displayName}</h3>
            <StatusPill tone="success">
              <ShieldCheck size={12} aria-hidden="true" /> Clinora verified
            </StatusPill>
          </div>
          <p className="mt-0.5 text-sm font-medium text-[var(--clinora-info-foreground)]">{doctor.specialization}</p>
          <p className="mt-0.5 text-xs text-[var(--clinora-text-muted)]">
            {doctor.professionalTitle || 'Medical professional'}
            {doctor.yearsExperience == null ? '' : ` · ${doctor.yearsExperience} years experience`}
          </p>
          {organization ? (
            <p className="mt-0.5 flex items-start gap-1.5 text-xs leading-4 text-[var(--clinora-text-muted)]">
              <BriefcaseBusiness size={14} className="mt-0.5 shrink-0 text-slate-500" aria-hidden="true" />
              {organization}
            </p>
          ) : null}
        </div>

        <div className="patient-care-doctor-next">
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--clinora-text-muted)]">
            <CalendarDays size={14} aria-hidden="true" /> Next appointment
          </p>
          <p
            className={`mt-1 text-xs ${doctor.nextAvailableAt ? 'font-semibold text-white' : 'text-[var(--clinora-text-muted)]'}`}
          >
            {doctor.nextAvailableAt ? formatSlot(doctor.nextAvailableAt) : 'No future time published'}
          </p>
          <Link
            to={`/patient/doctors/${doctor.id}`}
            className={`${buttonVariants({ variant: doctor.nextAvailableAt ? 'appPrimary' : 'appSecondary', size: 'sm' })} mt-2 w-full`}
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
