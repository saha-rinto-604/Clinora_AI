import { ArrowRight, Search, Stethoscope, UserRound, UsersRound } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { AppSectionHeader, AppSurface, EmptyState, IconWell, StatusPill } from '../../components/app/app-ui';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/feedback';
import {
  consultationApi,
  consultationError,
  type DoctorPatientListItem,
  type PatientCareState,
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
          eyebrow="Continuing care"
          title="Patients"
          copy="Your Patient relationships over time - latest completed care, follow-up context and upcoming appointments."
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
        <div className="grid gap-3 xl:grid-cols-2" role="status" aria-label="Loading Patients">
          <Skeleton className="h-36 rounded-[18px]" />
          <Skeleton className="h-36 rounded-[18px]" />
          <Skeleton className="h-36 rounded-[18px]" />
          <Skeleton className="h-36 rounded-[18px]" />
        </div>
      ) : filtered.length === 0 ? (
        <AppSurface>
          <EmptyState
            icon={<UsersRound size={18} />}
            title={query.trim() ? 'No matching Patient' : 'No care relationships yet'}
            copy={
              query.trim()
                ? 'Try another name from your existing care relationships.'
                : 'A Patient appears here after a current booking or an actual consultation with you. Cancelled-only bookings are not kept as care relationships.'
            }
          />
        </AppSurface>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {filtered.map((patient) => (
            <PatientCard key={patient.patientId} patient={patient} />
          ))}
        </div>
      )}
    </div>
  );
}

function PatientCard({ patient }: { patient: DoctorPatientListItem }) {
  const isNew = patient.careState === 'NEW_PATIENT';
  const primaryContext = isNew
    ? patient.nextAppointmentAt
      ? `First appointment ${shortDateTime(patient.nextAppointmentAt)}`
      : 'No completed consultation yet'
    : patient.latestConsultationAt
      ? `Last consultation ${shortDate(patient.latestConsultationAt)}`
      : 'Active consultation';
  const clinicalLine = isNew
    ? 'Open the Patient to review this booking and currently authorized evidence.'
    : patient.latestAssessment || 'No assessment text was recorded in the latest completed consultation.';

  const metadata: string[] = [];
  if (patient.requestedInvestigationCount > 0) {
    metadata.push(
      `${patient.requestedInvestigationCount} requested test${patient.requestedInvestigationCount === 1 ? '' : 's'}`,
    );
  }
  if (patient.followUpDate) metadata.push(`Follow-up ${localDate(patient.followUpDate)}`);
  if (patient.currentlySharedReportCount > 0) {
    metadata.push(
      `${patient.currentlySharedReportCount} shared report${patient.currentlySharedReportCount === 1 ? '' : 's'}`,
    );
  }
  if (!isNew && patient.nextAppointmentAt) metadata.push(`Next ${shortDate(patient.nextAppointmentAt)}`);

  return (
    <Link
      to={`/doctor/patients/${patient.patientId}`}
      className="group min-h-[132px] rounded-[var(--radius-app-card)] border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-1)] p-4 transition hover:border-[var(--clinora-border-interactive)] hover:bg-[var(--clinora-surface-hover)] sm:p-5"
    >
      <div className="flex h-full items-start gap-3.5">
        <IconWell tone="info">
          <UserRound size={17} />
        </IconWell>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-[15px] font-semibold text-white">{patient.patientName}</h2>
                <CareState state={patient.careState} />
                {patient.consultationInProgress ? <StatusPill tone="warning">In progress</StatusPill> : null}
              </div>
              <p className="mt-1 text-[11px] text-[var(--clinora-text-faint)]">{primaryContext}</p>
            </div>
            <ArrowRight
              size={15}
              className="mt-1 shrink-0 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-cyan-200"
            />
          </div>

          <p className="mt-3 line-clamp-1 text-sm leading-5 text-slate-200">{clinicalLine}</p>
          {!isNew && patient.latestPlan ? (
            <p className="mt-1 line-clamp-1 text-xs leading-5 text-[var(--clinora-text-muted)]">
              <span className="font-semibold text-slate-400">Plan:</span> {patient.latestPlan}
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--clinora-border-subtle)] pt-2.5 text-[11px] text-[var(--clinora-text-faint)]">
            {metadata.length ? (
              metadata.map((item) => <span key={item}>{item}</span>)
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <Stethoscope size={12} /> Open continuing care
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

function CareState({ state }: { state: PatientCareState }) {
  if (state === 'NEW_PATIENT') return <StatusPill tone="info">New Patient</StatusPill>;
  if (state === 'FOLLOW_UP') return <StatusPill tone="warning">Follow-up</StatusPill>;
  return <StatusPill tone="success">Active care</StatusPill>;
}

function shortDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function shortDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function localDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
