import {
  ArrowRight,
  CalendarClock,
  CalendarDays,
  ChevronRight,
  Clock3,
  FileText,
  Stethoscope,
  UserRoundCheck,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { StatusPill } from '../../components/app/app-ui';
import { buttonVariants } from '../../components/ui/button-variants';
import { Skeleton } from '../../components/ui/feedback';
import {
  doctorApi,
  doctorError,
  type DoctorAppointmentSummary,
  type DoctorDashboard,
} from '../../features/doctor/doctor-api';
import { doctorStatusLabel, doctorStatusTone } from '../../features/doctor/doctor-display';
import { ProfileAvatar } from '../../features/profile/profile-image';
import { cn } from '../../lib/cn';

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

  if (loading) return <DashboardSkeleton />;

  if (error || !data) {
    return (
      <section className="clinora-r3-panel p-5 sm:p-6" aria-label="Doctor workspace unavailable">
        <p role="alert" className="text-sm text-amber-100">
          {error || 'The workspace is unavailable.'}
        </p>
        <button
          type="button"
          className="mt-4 text-sm font-semibold text-white underline underline-offset-4"
          onClick={() => void load()}
        >
          Try again
        </button>
      </section>
    );
  }

  const next = data.nextAppointment;
  const activeAppointment = next ? isHappeningNow(next) : false;
  const missing = data.profileMissingItems ?? [];

  return (
    <div className="space-y-6 sm:space-y-7">
      <header className="flex flex-col gap-5 border-b border-white/[0.06] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <ProfileAvatar
            source={{ kind: 'self' }}
            name={data.doctor.displayName}
            size="lg"
            className="rounded-[16px]"
          />
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500">{formatDay(new Date())}</p>
            <h1
              aria-label={`Good to see you, ${data.doctor.displayName.replace(/^Dr\.\s+/i, '')}`}
              className="mt-1 text-3xl font-semibold tracking-[-0.045em] text-white sm:text-[2.15rem]"
            >
              {greetingForTime(new Date())}, {data.doctor.displayName.replace(/^Dr\.\s+/i, '')}
            </h1>
            <p className="mt-1.5 truncate text-sm text-slate-500">
              {[data.doctor.specialization, data.doctor.professionalTitle].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
        <Link
          to="/doctor/schedule?scope=today"
          className="inline-flex min-h-10 shrink-0 items-center gap-2 self-start rounded-[11px] border border-white/[0.08] bg-white/[0.025] px-3.5 text-sm font-semibold text-slate-200 transition hover:border-white/[0.13] hover:bg-white/[0.045] sm:self-auto"
        >
          <CalendarDays size={15} aria-hidden="true" /> Full schedule
        </Link>
      </header>

      {missing.length ? (
        <div className="flex flex-col gap-3 rounded-[14px] border border-cyan-300/[0.1] bg-cyan-300/[0.035] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <UserRoundCheck size={16} className="mt-0.5 shrink-0 text-cyan-200" aria-hidden="true" />
            <p className="text-xs leading-5 text-slate-400">
              <span className="font-semibold text-slate-200">Professional profile can be stronger.</span>{' '}
              {missing[0]?.label
                ? `Add ${missing[0].label.toLowerCase()} to improve how Patients see your profile.`
                : 'Finish optional profile details when convenient.'}
            </p>
          </div>
          <Link to="/doctor/profile" className="shrink-0 text-xs font-semibold text-cyan-200 hover:text-cyan-100">
            Review profile <ArrowRight size={13} className="ml-1 inline" aria-hidden="true" />
          </Link>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_310px]">
        <div className="space-y-6">
          <section
            className="clinora-r3-panel clinora-r3-panel--raised overflow-hidden"
            aria-labelledby="next-patient-title"
          >
            <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] px-5 py-3.5 sm:px-6">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-cyan-300/80" aria-hidden="true" />
                <p className="clinora-r3-kicker">{activeAppointment ? 'In progress' : 'Next patient'}</p>
              </div>
              {next ? (
                <p className="text-xs font-medium tabular-nums text-slate-500">{formatAppointmentWindow(next)}</p>
              ) : (
                <p className="text-xs text-slate-600">No upcoming booking</p>
              )}
            </div>

            {next ? (
              <div className="grid gap-5 px-5 py-5 sm:px-6 sm:py-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div className="flex min-w-0 items-start gap-4">
                  <ProfileAvatar
                    source={{ kind: 'doctor-patient', appointmentId: next.id }}
                    name={next.patientName}
                    size="md"
                    className="rounded-[14px] ring-1 ring-white/[0.08]"
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 id="next-patient-title" className="text-2xl font-semibold tracking-[-0.035em] text-white">
                        {next.patientName}
                      </h2>
                      <StatusPill tone={activeAppointment ? 'success' : 'info'}>
                        {activeAppointment ? 'Current' : doctorStatusLabel(next.status)}
                      </StatusPill>
                    </div>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{next.reason || 'Consultation'}</p>
                    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock3 size={13} aria-hidden="true" /> {durationMinutes(next)} min
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <FileText size={13} aria-hidden="true" /> {next.sharedReportCount} shared report
                        {next.sharedReportCount === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>
                </div>
                <Link to={`/doctor/appointments/${next.id}`} className={buttonVariants({ variant: 'appPrimary' })}>
                  Open workspace <ChevronRight size={16} aria-hidden="true" />
                </Link>
              </div>
            ) : (
              <div className="px-5 py-7 sm:px-6">
                <div className="flex max-w-2xl items-start gap-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] border border-white/[0.07] bg-white/[0.025] text-slate-500">
                    <Stethoscope size={17} aria-hidden="true" />
                  </span>
                  <div>
                    <h2 id="next-patient-title" className="text-lg font-semibold text-white">
                      Your clinical queue is clear
                    </h2>
                    <p className="mt-1.5 text-sm leading-6 text-slate-500">
                      New Patient bookings will appear here automatically. Report access remains limited to documents a
                      Patient explicitly shares for that appointment.
                    </p>
                    <Link
                      to="/doctor/availability"
                      className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-cyan-200 hover:text-cyan-100"
                    >
                      Review availability <ArrowRight size={14} aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="clinora-r3-panel overflow-hidden" aria-labelledby="today-agenda-title">
            <div className="flex flex-col gap-3 border-b border-white/[0.06] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <p className="clinora-r3-kicker">Today</p>
                <h2 id="today-agenda-title" className="mt-1 clinora-r3-section-title">
                  Clinical agenda
                </h2>
              </div>
              <p className="text-xs text-slate-600">
                {data.todayCount} appointment{data.todayCount === 1 ? '' : 's'} scheduled
              </p>
            </div>

            {data.today.length ? (
              <ol className="divide-y divide-white/[0.055]">
                {data.today.map((appointment, index) => (
                  <AgendaRow key={appointment.id} appointment={appointment} first={index === 0} />
                ))}
              </ol>
            ) : (
              <div className="grid min-h-40 place-items-center px-5 py-8 text-center sm:px-6">
                <div className="max-w-md">
                  <CalendarDays size={20} className="mx-auto text-slate-600" aria-hidden="true" />
                  <p className="mt-3 text-sm font-semibold text-slate-200">No appointments today</p>
                  <p className="mt-1.5 text-xs leading-5 text-slate-600">
                    Your next booked Patient will appear in the queue above.
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-8 xl:self-start" aria-label="Practice overview">
          <section className="clinora-r3-panel p-5">
            <p className="clinora-r3-kicker">Practice pulse</p>
            <h2 className="mt-1 clinora-r3-section-title">This workspace</h2>
            <dl className="mt-5 divide-y divide-white/[0.055] border-y border-white/[0.055]">
              <PulseRow label="Upcoming care" value={`${data.upcomingCount}`} detail="booked" />
              <PulseRow
                label="Patient-shared evidence"
                value={`${data.sharedReportsForUpcomingCare}`}
                detail="reports"
              />
              <PulseRow label="Open booking times" value={`${data.availableSlotCount}`} detail="available" />
            </dl>
          </section>

          <section className="clinora-r3-panel p-5">
            <div className="flex items-start justify-between gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-[11px] bg-cyan-300/[0.06] text-cyan-200 ring-1 ring-inset ring-cyan-300/[0.08]">
                <CalendarClock size={16} aria-hidden="true" />
              </span>
              <Link to="/doctor/availability" className="text-xs font-semibold text-cyan-200 hover:text-cyan-100">
                Manage
              </Link>
            </div>
            <h2 className="mt-4 text-sm font-semibold text-white">Availability</h2>
            {data.nextAvailableAt ? (
              <>
                <p className="mt-1 text-sm font-medium text-slate-300">{formatCompactDateTime(data.nextAvailableAt)}</p>
                <p className="mt-1 text-xs text-slate-600">Next open time visible to Patients</p>
              </>
            ) : (
              <p className="mt-1 text-xs leading-5 text-slate-500">No future booking time is currently published.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function AgendaRow({ appointment, first }: { appointment: DoctorAppointmentSummary; first: boolean }) {
  return (
    <li>
      <Link
        to={`/doctor/appointments/${appointment.id}`}
        className="group grid gap-3 px-5 py-4 transition-colors hover:bg-white/[0.02] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-cyan-300 sm:grid-cols-[88px_minmax(0,1fr)_auto] sm:items-center sm:px-6"
      >
        <span className="relative block pl-5 sm:pl-0">
          <span className="text-sm font-semibold tabular-nums text-slate-200">
            {formatTime(appointment.scheduledStart, appointment.timezone)}
          </span>
          <span className="mt-0.5 block text-[10px] text-slate-600">{durationMinutes(appointment)} min</span>
          <span
            className="absolute bottom-[-1.05rem] left-0 top-[-1.05rem] hidden w-px bg-white/[0.055] sm:block"
            aria-hidden="true"
          />
          <span
            className={cn(
              'absolute left-[-3px] top-2 hidden h-[7px] w-[7px] rounded-full ring-4 ring-[#07111b] sm:block',
              first ? 'bg-cyan-300' : 'bg-slate-600',
            )}
            aria-hidden="true"
          />
        </span>
        <span className="flex min-w-0 items-center gap-3">
          <ProfileAvatar
            source={{ kind: 'doctor-patient', appointmentId: appointment.id }}
            name={appointment.patientName}
            size="sm"
            className="rounded-[10px]"
          />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-white">{appointment.patientName}</span>
            <span className="mt-0.5 block truncate text-xs text-slate-500">{appointment.reason || 'Consultation'}</span>
          </span>
        </span>
        <span className="flex items-center gap-3 sm:justify-end">
          {appointment.sharedReportCount > 0 ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-teal-200/80">
              <FileText size={12} aria-hidden="true" /> {appointment.sharedReportCount}
            </span>
          ) : null}
          <StatusPill tone={doctorStatusTone(appointment.status)}>{doctorStatusLabel(appointment.status)}</StatusPill>
          <ChevronRight
            size={15}
            className="text-slate-700 transition group-hover:translate-x-0.5 group-hover:text-slate-400"
            aria-hidden="true"
          />
        </span>
      </Link>
    </li>
  );
}

function PulseRow({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="flex items-baseline gap-1.5 text-right">
        <span className="text-lg font-semibold tabular-nums text-white">{value}</span>
        <span className="text-[10px] text-slate-600">{detail}</span>
      </dd>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading Doctor workspace">
      <div className="flex items-center gap-4">
        <Skeleton className="h-14 w-14 rounded-[16px]" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-64 rounded-lg" />
          <Skeleton className="h-4 w-80 rounded-lg" />
        </div>
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_310px]">
        <div className="space-y-6">
          <Skeleton className="h-52 rounded-[18px]" />
          <Skeleton className="h-80 rounded-[18px]" />
        </div>
        <Skeleton className="h-72 rounded-[18px]" />
      </div>
    </div>
  );
}

function isHappeningNow(appointment: DoctorAppointmentSummary) {
  const now = Date.now();
  return new Date(appointment.scheduledStart).getTime() <= now && new Date(appointment.scheduledEnd).getTime() >= now;
}

function durationMinutes(appointment: Pick<DoctorAppointmentSummary, 'scheduledStart' | 'scheduledEnd'>) {
  return Math.max(
    0,
    Math.round(
      (new Date(appointment.scheduledEnd).getTime() - new Date(appointment.scheduledStart).getTime()) / 60_000,
    ),
  );
}

function formatDay(value: Date) {
  return value.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}

function greetingForTime(value: Date) {
  const hour = value.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatTime(value: string, timezone?: string | null) {
  return new Date(value).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone || undefined,
  });
}

function formatAppointmentWindow(appointment: DoctorAppointmentSummary) {
  const day = new Date(appointment.scheduledStart).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: appointment.timezone || undefined,
  });
  return `${day} · ${formatTime(appointment.scheduledStart, appointment.timezone)}–${formatTime(appointment.scheduledEnd, appointment.timezone)}`;
}

function formatCompactDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}
