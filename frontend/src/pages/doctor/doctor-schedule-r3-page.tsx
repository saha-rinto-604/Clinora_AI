import { CalendarDays, ChevronRight, FileText, History, Stethoscope } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { StatusPill } from '../../components/app/app-ui';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/feedback';
import {
  doctorApi,
  doctorError,
  type AppointmentScope,
  type DoctorAppointmentSummary,
} from '../../features/doctor/doctor-api';
import { doctorStatusLabel, doctorStatusTone } from '../../features/doctor/doctor-display';
import { ProfileAvatar } from '../../features/profile/profile-image';
import { cn } from '../../lib/cn';

const PAGE_SIZE = 20;
const scopes: Array<{ value: AppointmentScope; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'history', label: 'History' },
];

export function DoctorSchedulePage() {
  const [params, setParams] = useSearchParams();
  const scope = useMemo<AppointmentScope>(() => {
    const value = params.get('scope');
    return value === 'today' || value === 'history' ? value : 'upcoming';
  }, [params]);
  const [items, setItems] = useState<DoctorAppointmentSummary[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const page = await doctorApi.appointments(scope, PAGE_SIZE, 0);
      setItems(page.items);
      setHasMore(page.hasMore);
    } catch (requestError) {
      setError(doctorError(requestError, 'We could not load your appointments.'));
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = async () => {
    setLoadingMore(true);
    setError('');
    try {
      const page = await doctorApi.appointments(scope, PAGE_SIZE, items.length);
      setItems((current) => [...current, ...page.items]);
      setHasMore(page.hasMore);
    } catch (requestError) {
      setError(doctorError(requestError, 'We could not load more appointments.'));
    } finally {
      setLoadingMore(false);
    }
  };

  const grouped = useMemo(() => groupAppointments(items), [items]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-5 border-b border-white/[0.06] pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="clinora-r3-kicker">Care schedule</p>
          <h1 className="mt-1.5 text-3xl font-semibold tracking-[-0.045em] text-white sm:text-[2.15rem]">
            Appointments
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Booked Patient care, organized around time. Open an appointment for the Patient context and the reports they
            explicitly shared.
          </p>
        </div>
        <div
          className="inline-flex max-w-full gap-1 overflow-x-auto rounded-[12px] border border-white/[0.07] bg-white/[0.025] p-1"
          role="tablist"
          aria-label="Appointment collection"
        >
          {scopes.map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={scope === item.value}
              onClick={() => setParams({ scope: item.value })}
              className={cn(
                'min-h-9 whitespace-nowrap rounded-[9px] px-4 text-xs font-semibold transition-colors',
                scope === item.value
                  ? 'bg-white/[0.08] text-white shadow-sm'
                  : 'text-slate-500 hover:bg-white/[0.035] hover:text-slate-200',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      {error ? (
        <section className="rounded-[14px] border border-amber-300/[0.12] bg-amber-300/[0.045] px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p role="alert" className="text-sm text-amber-100">
              {error}
            </p>
            <Button variant="appSecondary" size="sm" onClick={() => void load()}>
              Try again
            </Button>
          </div>
        </section>
      ) : null}

      <section className="clinora-r3-panel overflow-hidden" aria-label={`${scope} appointments`}>
        <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-[11px] border border-white/[0.06] bg-white/[0.025] text-slate-400">
              {scope === 'history' ? (
                <History size={16} aria-hidden="true" />
              ) : (
                <CalendarDays size={16} aria-hidden="true" />
              )}
            </span>
            <div>
              <h2 className="text-sm font-semibold text-white">{scopeTitle(scope)}</h2>
              <p className="mt-0.5 text-[11px] text-slate-600">{scopeCopy(scope)}</p>
            </div>
          </div>
          {!loading ? <span className="text-xs tabular-nums text-slate-600">{items.length} shown</span> : null}
        </div>

        {loading ? (
          <div className="space-y-3 p-5 sm:p-6" role="status" aria-label="Loading appointments">
            <Skeleton className="h-20 rounded-[14px]" />
            <Skeleton className="h-20 rounded-[14px]" />
            <Skeleton className="h-20 rounded-[14px]" />
          </div>
        ) : items.length === 0 ? (
          <div className="grid min-h-64 place-items-center px-6 py-10 text-center">
            <div className="max-w-md">
              <span className="mx-auto grid h-11 w-11 place-items-center rounded-[13px] border border-white/[0.07] bg-white/[0.025] text-slate-500">
                {scope === 'history' ? (
                  <History size={18} aria-hidden="true" />
                ) : (
                  <Stethoscope size={18} aria-hidden="true" />
                )}
              </span>
              <h3 className="mt-4 text-base font-semibold text-white">{emptyTitle(scope)}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">{emptyCopy(scope)}</p>
              {scope !== 'history' ? (
                <Link
                  to="/doctor/availability"
                  className="mt-4 inline-flex text-sm font-semibold text-cyan-200 hover:text-cyan-100"
                >
                  Manage availability
                </Link>
              ) : null}
            </div>
          </div>
        ) : (
          <div>
            {grouped.map((group) => (
              <section key={group.key} aria-labelledby={`schedule-${group.key}`}>
                <div className="sticky top-0 z-[1] flex items-center justify-between gap-3 border-y border-white/[0.045] bg-[#07111b]/95 px-5 py-2.5 backdrop-blur sm:px-6">
                  <h3
                    id={`schedule-${group.key}`}
                    className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500"
                  >
                    {group.label}
                  </h3>
                  <span className="text-[10px] text-slate-700">
                    {group.items.length} appointment{group.items.length === 1 ? '' : 's'}
                  </span>
                </div>
                <ol className="divide-y divide-white/[0.05]">
                  {group.items.map((appointment) => (
                    <ScheduleRow key={appointment.id} appointment={appointment} historical={scope === 'history'} />
                  ))}
                </ol>
              </section>
            ))}
          </div>
        )}
      </section>

      {!loading && hasMore ? (
        <div className="flex justify-center">
          <Button variant="appSecondary" onClick={() => void loadMore()} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : 'Load more appointments'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function ScheduleRow({ appointment, historical }: { appointment: DoctorAppointmentSummary; historical: boolean }) {
  return (
    <li>
      <Link
        to={`/doctor/appointments/${appointment.id}`}
        className="group grid gap-3 px-5 py-4 transition-colors hover:bg-white/[0.022] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-cyan-300 sm:px-6 md:grid-cols-[94px_minmax(0,1fr)_minmax(150px,0.45fr)_auto] md:items-center"
      >
        <span>
          <span className="block text-sm font-semibold tabular-nums text-slate-100">
            {formatTime(appointment.scheduledStart, appointment.timezone)}
          </span>
          <span className="mt-0.5 block text-[10px] text-slate-600">{durationMinutes(appointment)} min</span>
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
        <span className="flex items-center gap-2 text-xs text-slate-500">
          <FileText size={13} aria-hidden="true" />
          {appointment.sharedReportCount
            ? `${appointment.sharedReportCount} shared`
            : historical
              ? 'No shared reports'
              : 'No report shared'}
        </span>
        <span className="flex items-center gap-3 md:justify-end">
          <StatusPill tone={doctorStatusTone(appointment.status)}>{doctorStatusLabel(appointment.status)}</StatusPill>
          <ChevronRight
            size={15}
            className="text-slate-700 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-400"
            aria-hidden="true"
          />
        </span>
      </Link>
    </li>
  );
}

function groupAppointments(items: DoctorAppointmentSummary[]) {
  const groups = new Map<string, DoctorAppointmentSummary[]>();
  for (const item of items) {
    const key = dateKey(item.scheduledStart, item.timezone);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.entries()].map(([key, groupItems]) => ({
    key,
    label: formatDateHeading(groupItems[0].scheduledStart, groupItems[0].timezone),
    items: groupItems,
  }));
}

function dateKey(value: string, timezone?: string | null) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone || undefined,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));
  return ['year', 'month', 'day'].map((type) => parts.find((part) => part.type === type)?.value ?? '00').join('-');
}

function formatDateHeading(value: string, timezone?: string | null) {
  const date = new Date(value);
  const todayKey = dateKey(new Date().toISOString(), timezone);
  const key = dateKey(value, timezone);
  const prefix = key === todayKey ? 'Today · ' : '';
  return `${prefix}${date.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: timezone || undefined,
  })}`;
}

function formatTime(value: string, timezone?: string | null) {
  return new Date(value).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone || undefined,
  });
}

function durationMinutes(appointment: Pick<DoctorAppointmentSummary, 'scheduledStart' | 'scheduledEnd'>) {
  return Math.max(
    0,
    Math.round(
      (new Date(appointment.scheduledEnd).getTime() - new Date(appointment.scheduledStart).getTime()) / 60_000,
    ),
  );
}

function scopeTitle(scope: AppointmentScope) {
  if (scope === 'today') return 'Today’s care';
  if (scope === 'history') return 'Care history';
  return 'Upcoming care';
}

function scopeCopy(scope: AppointmentScope) {
  if (scope === 'history') return 'Completed, elapsed and cancelled bookings';
  if (scope === 'today') return 'Your booked Patient care for today';
  return 'Future confirmed Patient bookings';
}

function emptyTitle(scope: AppointmentScope) {
  if (scope === 'today') return 'No appointments today';
  if (scope === 'history') return 'No care history yet';
  return 'No upcoming appointments';
}

function emptyCopy(scope: AppointmentScope) {
  if (scope === 'history') return 'Completed and cancelled appointments will appear here as your care history grows.';
  return 'Patient bookings appear automatically once confirmed. You do not need to manually accept them.';
}
