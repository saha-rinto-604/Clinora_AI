import { ArrowRight, CalendarClock, FileText, FlaskConical, Search, UserRound, UsersRound } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { AppSectionHeader, AppSurface, EmptyState, IconWell } from '../../components/app/app-ui';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/feedback';
import {
  consultationApi,
  consultationError,
  type DoctorPatientListItem,
} from '../../features/consultations/consultation-api';

export function DoctorPatientsPage() {
  const [items, setItems] = useState<DoctorPatientListItem[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setItems(await consultationApi.patients());
    } catch (requestError) {
      setError(consultationError(requestError, 'We could not load your Patients.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return items;
    return items.filter((item) => item.patientName.toLowerCase().includes(normalized));
  }, [items, query]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-5 border-b border-[var(--clinora-border-subtle)] pb-6 lg:flex-row lg:items-end lg:justify-between">
        <AppSectionHeader
          eyebrow="Care relationships"
          title="Patients"
          copy="People you have actually cared for or who have booked with you. This is not a global Patient directory."
        />
        <label className="relative block w-full lg:max-w-sm">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--clinora-text-faint)]"
          />
          <span className="sr-only">Search your Patients</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search your Patients"
            className="min-h-11 w-full rounded-xl border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-nested)] pl-9 pr-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-[var(--clinora-border-interactive)] focus:ring-4 focus:ring-[var(--clinora-focus-ring-soft)]"
          />
        </label>
      </header>

      {error ? (
        <AppSurface variant="attention">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p role="alert" className="text-sm text-amber-100">
              {error}
            </p>
            <Button size="sm" variant="appSecondary" onClick={() => void load()}>
              Try again
            </Button>
          </div>
        </AppSurface>
      ) : null}

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2" role="status" aria-label="Loading Patients">
          <Skeleton className="h-40 rounded-[18px]" />
          <Skeleton className="h-40 rounded-[18px]" />
          <Skeleton className="h-40 rounded-[18px]" />
          <Skeleton className="h-40 rounded-[18px]" />
        </div>
      ) : filtered.length === 0 ? (
        <AppSurface>
          <EmptyState
            icon={<UsersRound size={18} />}
            title={query.trim() ? 'No matching Patient' : 'No care relationships yet'}
            copy={
              query.trim()
                ? 'Try another name from your existing care relationships.'
                : 'Patients appear here after they book an appointment with you. Clinora never exposes a global Patient directory.'
            }
          />
        </AppSurface>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((patient) => (
            <Link
              key={patient.patientId}
              to={`/doctor/patients/${patient.patientId}`}
              className="group rounded-[var(--radius-app-card)] border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-1)] p-5 transition hover:border-[var(--clinora-border-interactive)] hover:bg-[var(--clinora-surface-hover)] sm:p-6"
            >
              <div className="flex items-start gap-4">
                <IconWell tone="info">
                  <UserRound size={18} />
                </IconWell>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="truncate text-base font-semibold text-white">{patient.patientName}</h2>
                      <p className="mt-1 text-xs text-[var(--clinora-text-muted)]">Established through Clinora care</p>
                    </div>
                    <ArrowRight
                      size={16}
                      className="mt-1 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-cyan-200"
                    />
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <PatientMetric
                      icon={<CalendarClock size={14} />}
                      label="Next care"
                      value={patient.nextAppointmentAt ? shortDate(patient.nextAppointmentAt) : 'None booked'}
                    />
                    <PatientMetric
                      icon={<FileText size={14} />}
                      label="Shared now"
                      value={`${patient.currentlySharedReportCount} report${patient.currentlySharedReportCount === 1 ? '' : 's'}`}
                    />
                    <PatientMetric
                      icon={<FlaskConical size={14} />}
                      label="Requested tests"
                      value={String(patient.investigationCount)}
                    />
                  </div>
                  <p className="mt-4 border-t border-[var(--clinora-border-subtle)] pt-4 text-xs text-[var(--clinora-text-faint)]">
                    {patient.lastConsultationAt
                      ? `Last consultation ${shortDate(patient.lastConsultationAt)}`
                      : 'No completed consultation yet'}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function PatientMetric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <span className="rounded-xl bg-[var(--clinora-surface-nested)] p-3">
      <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--clinora-text-faint)]">
        {icon} {label}
      </span>
      <strong className="mt-1.5 block text-xs font-semibold text-slate-200">{value}</strong>
    </span>
  );
}

function shortDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
