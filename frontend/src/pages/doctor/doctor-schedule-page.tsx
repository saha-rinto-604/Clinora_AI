import { CalendarDays, ChevronRight, FileText, History, Stethoscope } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { AppSectionHeader, AppSurface, EmptyState, IconWell, StatusPill } from '../../components/app/app-ui';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/feedback';
import {
  doctorApi,
  doctorError,
  type AppointmentScope,
  type DoctorAppointmentSummary,
} from '../../features/doctor/doctor-api';
import { doctorStatusLabel, doctorStatusTone, formatDoctorDateTime } from '../../features/doctor/doctor-display';

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

  return (
    <div className="space-y-7">
      <AppSectionHeader
        eyebrow="Schedule"
        title="Appointments"
        copy="Your booked care only. Open an appointment to see the Patient context and anything they chose to share with you."
      />

      <div
        className="inline-flex max-w-full gap-1 overflow-x-auto rounded-[var(--radius-app-compact)] border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-nested)] p-1"
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
            className={`min-h-10 whitespace-nowrap rounded-xl px-4 text-sm font-semibold transition-colors ${
              scope === item.value
                ? 'bg-[var(--clinora-info-soft)] text-[var(--clinora-info-foreground)]'
                : 'text-[var(--clinora-text-muted)] hover:bg-white/[0.035] hover:text-white'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error ? (
        <AppSurface as="section" variant="attention" padding="compact">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p role="alert" className="text-sm text-[var(--clinora-warning-foreground)]">
              {error}
            </p>
            <Button variant="appSecondary" onClick={() => void load()}>
              Try again
            </Button>
          </div>
        </AppSurface>
      ) : null}

      <AppSurface as="section" padding="none" className="overflow-hidden" aria-label={`${scope} appointments`}>
        {loading ? (
          <div className="space-y-3 p-5 sm:p-6">
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            className="p-6 sm:p-8"
            icon={scope === 'history' ? <History size={18} /> : <CalendarDays size={18} />}
            title={
              scope === 'today'
                ? 'No appointments today'
                : scope === 'history'
                  ? 'No care history yet'
                  : 'No upcoming appointments'
            }
            copy={
              scope === 'history'
                ? 'Completed and cancelled appointments will appear here as your care history grows.'
                : 'Patient bookings appear here automatically. You do not need to manually accept a confirmed booking.'
            }
          />
        ) : (
          <ul className="divide-y divide-[var(--clinora-border-subtle)]">
            {items.map((appointment) => (
              <li key={appointment.id}>
                <Link
                  to={`/doctor/appointments/${appointment.id}`}
                  className="group grid gap-4 px-5 py-5 transition-colors hover:bg-[var(--clinora-surface-hover)] focus-visible:outline-none sm:px-6 md:grid-cols-[minmax(0,1fr)_minmax(13rem,0.55fr)_auto] md:items-center"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <IconWell tone="info">
                      <Stethoscope size={16} />
                    </IconWell>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-white">{appointment.patientName}</span>
                      <span className="mt-1 block truncate text-xs text-[var(--clinora-text-muted)]">
                        {appointment.reason || 'Consultation'}
                      </span>
                    </span>
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-slate-200">
                      {formatDoctorDateTime(appointment.scheduledStart, appointment.timezone)}
                    </span>
                    <span className="mt-1 block text-xs text-[var(--clinora-text-faint)]">
                      {appointment.timezone || 'Local time'}
                    </span>
                  </span>
                  <span className="flex items-center gap-3 md:justify-end">
                    <StatusPill tone={doctorStatusTone(appointment.status)}>
                      {doctorStatusLabel(appointment.status)}
                    </StatusPill>
                    {appointment.sharedReportCount > 0 ? (
                      <span
                        className="inline-flex items-center gap-1 text-xs font-medium text-[var(--clinora-success-foreground)]"
                        title="Patient-shared reports"
                      >
                        <FileText size={14} aria-hidden="true" />
                        {appointment.sharedReportCount}
                      </span>
                    ) : null}
                    <ChevronRight
                      size={16}
                      className="text-slate-600 transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </AppSurface>

      {!loading && hasMore ? (
        <div className="flex justify-center">
          <Button variant="appSecondary" onClick={() => void loadMore()} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
