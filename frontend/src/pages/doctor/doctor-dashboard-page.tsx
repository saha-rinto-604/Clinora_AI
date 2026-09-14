import { CalendarClock, CalendarDays, FileText, Stethoscope, UserRoundCheck } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import {
  AppSectionHeader,
  AppSurface,
  DashboardMetric,
  EmptyState,
  IconWell,
  StatusPill,
} from '../../components/app/app-ui';
import { buttonVariants } from '../../components/ui/button-variants';
import { Skeleton } from '../../components/ui/feedback';
import { doctorApi, doctorError, type DoctorDashboard } from '../../features/doctor/doctor-api';
import { doctorStatusLabel, doctorStatusTone, formatDoctorDateTime } from '../../features/doctor/doctor-display';
import { ProfileAvatar } from '../../features/profile/profile-image';

export function DoctorDashboardPage() {
  const [data, setData] = useState<DoctorDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await doctorApi.dashboard());
    } catch (requestError) {
      setError(doctorError(requestError, 'We could not load your Doctor workspace.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-6" aria-label="Loading Doctor workspace">
        <Skeleton className="h-28 rounded-[var(--radius-app-card)]" />
        <Skeleton className="h-72 rounded-[var(--radius-app-card)]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <AppSurface as="section" variant="attention">
        <p role="alert" className="text-sm text-[var(--clinora-warning-foreground)]">
          {error || 'The workspace is unavailable.'}
        </p>
        <button type="button" className="mt-4 text-sm font-semibold text-white underline" onClick={() => void load()}>
          Try again
        </button>
      </AppSurface>
    );
  }

  const activeAppointment = data.nextAppointment
    ? new Date(data.nextAppointment.scheduledStart).getTime() <= Date.now() &&
      new Date(data.nextAppointment.scheduledEnd).getTime() >= Date.now()
    : false;
  const profileMissingItems = data.profileMissingItems ?? [];
  const profileTotalItems = data.profileTotalItems ?? 6;
  const profileCompletedItems = data.profileCompletedItems ?? Math.max(0, profileTotalItems - profileMissingItems.length);

  return (
    <div className="space-y-7">
      <header className="flex items-center gap-4">
        <ProfileAvatar source={{ kind: 'self' }} name={data.doctor.displayName} size="lg" />
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--clinora-info-foreground)]">
            Clinora Doctor
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-[-0.045em] text-white sm:text-4xl">
            Good to see you, {data.doctor.displayName.replace(/^Dr\.\s+/i, '')}
          </h1>
          <p className="mt-2 text-sm leading-6 text-[var(--clinora-text-muted)]">
            {[data.doctor.specialization, data.doctor.currentPosition, data.doctor.currentOrganization]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
      </header>

      {data.nextAppointment ? (
        <AppSurface as="section" variant="hero" aria-labelledby="next-patient-title">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <ProfileAvatar
                source={{ kind: 'doctor-patient', appointmentId: data.nextAppointment.id }}
                name={data.nextAppointment.patientName}
                size="md"
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                <StatusPill tone={activeAppointment ? 'success' : 'info'}>
                  {activeAppointment ? 'Current patient' : 'Next patient'}
                </StatusPill>
                <span className="text-xs text-[var(--clinora-text-faint)]">
                  {formatDoctorDateTime(data.nextAppointment.scheduledStart, data.nextAppointment.timezone)}
                </span>
                </div>
                <h2
                id="next-patient-title"
                className="mt-4 text-2xl font-semibold tracking-[-0.035em] text-white sm:text-3xl"
              >
                {data.nextAppointment.patientName}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--clinora-text-muted)]">
                  {data.nextAppointment.reason || 'Consultation'}
                </p>
                <div className="mt-4 flex flex-wrap gap-3 text-xs text-[var(--clinora-text-muted)]">
                <span>
                  {data.nextAppointment.sharedReportCount} shared report
                  {data.nextAppointment.sharedReportCount === 1 ? '' : 's'}
                </span>
                <span aria-hidden="true">•</span>
                <span>{doctorStatusLabel(data.nextAppointment.status)}</span>
                </div>
              </div>
            </div>
            <Link
              to={`/doctor/appointments/${data.nextAppointment.id}`}
              className={buttonVariants({ variant: 'appPrimary' })}
            >
              Open appointment
            </Link>
          </div>
        </AppSurface>
      ) : (
        <AppSurface as="section">
          <EmptyState
            icon={<Stethoscope size={18} />}
            title="No upcoming appointments"
            titleAs="h2"
            copy="When a Patient books with you, their appointment will appear here. Reports remain private unless the Patient shares them for that appointment."
            action={
              <Link to="/doctor/availability" className={buttonVariants({ variant: 'appSecondary' })}>
                Review availability
              </Link>
            }
          />
        </AppSurface>
      )}

      <AppSurface as="section" padding="compact" aria-label="Workspace overview">
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <DashboardMetric
            label="Today"
            value={`${data.todayCount} appointment${data.todayCount === 1 ? '' : 's'}`}
            icon={<CalendarDays size={16} />}
          />
          <DashboardMetric label="Upcoming" value={`${data.upcomingCount} booked`} icon={<Stethoscope size={16} />} />
          <DashboardMetric
            label="Shared for upcoming care"
            value={`${data.sharedReportsForUpcomingCare} report${data.sharedReportsForUpcomingCare === 1 ? '' : 's'}`}
            icon={<FileText size={16} />}
            tone="success"
          />
          <DashboardMetric
            label="Available booking times"
            value={`${data.availableSlotCount} open`}
            detail={
              data.nextAvailableAt
                ? `Next ${formatDoctorDateTime(data.nextAvailableAt)}`
                : 'Add availability when you are ready for new bookings.'
            }
            icon={<CalendarClock size={16} />}
            tone="neutral"
          />
        </div>
      </AppSurface>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.55fr)]">
        <AppSurface as="section" aria-labelledby="today-title">
          <AppSectionHeader
            eyebrow="Today"
            title="Care schedule"
            titleId="today-title"
            copy="Open an appointment to review the Patient context and any reports they chose to share."
            action={
              <Link to="/doctor/schedule?scope=today" className={buttonVariants({ variant: 'appSecondary' })}>
                Full schedule
              </Link>
            }
          />
          {data.today.length ? (
            <ul className="mt-5 divide-y divide-[var(--clinora-border-subtle)] border-y border-[var(--clinora-border-subtle)]">
              {data.today.map((appointment) => (
                <li key={appointment.id} className="py-4">
                  <Link
                    to={`/doctor/appointments/${appointment.id}`}
                    className="flex min-h-14 items-center gap-4 rounded-xl px-1 transition hover:bg-white/[0.025] focus-visible:outline-none"
                  >
                    <ProfileAvatar
                      source={{ kind: 'doctor-patient', appointmentId: appointment.id }}
                      name={appointment.patientName}
                      size="sm"
                      className="rounded-xl"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-white">{appointment.patientName}</span>
                      <span className="mt-1 block truncate text-xs text-[var(--clinora-text-muted)]">
                        {formatDoctorDateTime(appointment.scheduledStart, appointment.timezone)} ·{' '}
                        {appointment.reason || 'Consultation'}
                      </span>
                    </span>
                    <StatusPill tone={doctorStatusTone(appointment.status)}>
                      {doctorStatusLabel(appointment.status)}
                    </StatusPill>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              className="mt-6"
              icon={<CalendarDays size={18} />}
              title="Your day is clear"
              copy="You have no booked appointments scheduled for today."
            />
          )}
        </AppSurface>

        <AppSurface as="aside" aria-labelledby="profile-readiness-title">
          <AppSectionHeader eyebrow="Professional setup" title="Profile readiness" titleId="profile-readiness-title" />
          <div className="mt-5 flex items-center gap-4">
            <IconWell tone={data.profileCompletion === 100 ? 'success' : 'info'}>
              <UserRoundCheck size={17} />
            </IconWell>
            <div>
              <p className="text-2xl font-semibold text-white">{data.profileCompletion}%</p>
              <p className="text-xs text-[var(--clinora-text-muted)]">Professional workspace setup</p>
            </div>
          </div>
          <div
            className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.05]"
            aria-label={`${data.profileCompletion}% profile complete`}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={data.profileCompletion}
            role="progressbar"
          >
            <div
              className="h-full rounded-full bg-[var(--clinora-accent-teal)]"
              style={{ width: `${data.profileCompletion}%` }}
            />
          </div>
          <p className="mt-4 text-xs leading-5 text-[var(--clinora-text-faint)]">
            Your Clinora professional approval is already complete. {profileCompletedItems} of {profileTotalItems}{' '}
            optional setup items are complete.
          </p>
          {profileMissingItems.length ? (
            <div className="mt-4 border-t border-[var(--clinora-border-subtle)] pt-4">
              <p className="text-xs font-semibold text-slate-300">Next setup items</p>
              <ul className="mt-2 space-y-2">
                {profileMissingItems.slice(0, 3).map((item) => (
                  <li key={item.key}>
                    <Link
                      to={item.destination}
                      className="text-xs font-medium text-[var(--clinora-info-foreground)] hover:underline"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                to="/doctor/profile"
                className="mt-4 inline-flex text-xs font-semibold text-white underline decoration-white/30 underline-offset-4"
              >
                Complete professional profile
              </Link>
            </div>
          ) : (
            <p className="mt-4 text-xs font-medium text-teal-200">Professional setup complete.</p>
          )}
        </AppSurface>
      </div>
    </div>
  );
}
