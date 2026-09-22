import { ArrowRight, Search, UserRound, UsersRound } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { AppSurface, EmptyState, IconWell, StatusPill } from '../../components/app/app-ui';
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
    <div className="mx-auto w-full max-w-[1180px] space-y-4">
      <header className="border-b border-[var(--clinora-border-subtle)] pb-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--clinora-info-foreground)]">
              Continuing care
            </p>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-[-0.035em] text-white">Patients</h1>
            <p className="mt-1.5 text-xs leading-5 text-[var(--clinora-text-muted)] sm:text-sm">
              Ongoing care relationships, latest completed context and next steps.
            </p>
          </div>
          <label className="relative block w-full lg:max-w-[19rem]">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--clinora-text-faint)]"
            />
            <span className="sr-only">Search your Patients</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search patients"
              className="min-h-10 w-full rounded-xl border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-nested)] pl-9 pr-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-[var(--clinora-border-interactive)] focus:ring-4 focus:ring-[var(--clinora-focus-ring-soft)]"
            />
          </label>
        </div>
      </header>

      {error ? (
        <AppSurface variant="attention" padding="compact" radius="compact">
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
        <div
          className="overflow-hidden rounded-[var(--radius-app-card)] border border-[var(--clinora-border-subtle)]"
          role="status"
          aria-label="Loading Patients"
        >
          <Skeleton className="h-28 rounded-none" />
          <Skeleton className="h-28 rounded-none border-t border-[var(--clinora-border-subtle)]" />
          <Skeleton className="h-28 rounded-none border-t border-[var(--clinora-border-subtle)]" />
        </div>
      ) : filtered.length === 0 ? (
        <AppSurface padding="compact" radius="compact">
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
        <div
          role="list"
          data-density="compact"
          aria-label="Continuing care Patient list"
          className="overflow-hidden rounded-[var(--radius-app-card)] border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-1)]"
        >
          {filtered.map((patient, index) => (
            <div key={patient.patientId} role="listitem">
              <PatientRow patient={patient} divided={index > 0} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PatientRow({ patient, divided }: { patient: DoctorPatientListItem; divided: boolean }) {
  const isNew = patient.careState === 'NEW_PATIENT';
  const primaryContext = patient.consultationInProgress
    ? patient.latestConsultationAt
      ? `Consultation in progress · previous completed ${shortDate(patient.latestConsultationAt)}`
      : 'Consultation currently in progress'
    : isNew
      ? patient.nextAppointmentAt
        ? `First appointment · ${shortDateTime(patient.nextAppointmentAt)}`
        : 'First consultation not yet completed'
      : patient.latestConsultationAt
        ? `Latest completed consultation · ${shortDate(patient.latestConsultationAt)}`
        : 'Continuing care relationship';

  const metadata: string[] = [];
  if (patient.requestedInvestigationCount > 0) {
    metadata.push(
      `${patient.requestedInvestigationCount} requested investigation${patient.requestedInvestigationCount === 1 ? '' : 's'}`,
    );
  }
  if (patient.followUpDate) metadata.push(`Follow-up · ${localDate(patient.followUpDate)}`);
  if (patient.currentlySharedReportCount > 0) {
    metadata.push(
      `${patient.currentlySharedReportCount} shared report${patient.currentlySharedReportCount === 1 ? '' : 's'}`,
    );
  }
  if (!isNew && patient.nextAppointmentAt) metadata.push(`Next · ${shortDate(patient.nextAppointmentAt)}`);

  return (
    <Link
      to={`/doctor/patients/${patient.patientId}`}
      className={`group block px-4 py-3.5 transition hover:bg-[var(--clinora-surface-hover)] sm:px-5 ${
        divided ? 'border-t border-[var(--clinora-border-subtle)]' : ''
      }`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <IconWell tone="info" className="h-9 w-9 rounded-xl">
          <UserRound size={15} />
        </IconWell>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-sm font-semibold text-white">{patient.patientName}</h2>
                <PrimaryCareState patient={patient} />
              </div>
              <p className="mt-1 text-[11px] leading-4 text-[var(--clinora-text-faint)]">{primaryContext}</p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-cyan-200 opacity-80 transition group-hover:opacity-100">
              Open patient <ArrowRight size={13} className="transition group-hover:translate-x-0.5" />
            </span>
          </div>

          {!isNew && (patient.latestAssessment || patient.latestPlan) ? (
            <div className="mt-2.5 grid gap-1">
              {patient.latestAssessment ? (
                <p className="line-clamp-1 text-[13px] leading-5 text-slate-200">{patient.latestAssessment}</p>
              ) : null}
              {patient.latestPlan ? (
                <p className="line-clamp-1 text-[11px] leading-4 text-[var(--clinora-text-muted)]">
                  <span className="font-semibold text-slate-400">Plan:</span> {patient.latestPlan}
                </p>
              ) : null}
            </div>
          ) : null}

          {metadata.length ? (
            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[var(--clinora-text-faint)] sm:text-[11px]">
              {metadata.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

function PrimaryCareState({ patient }: { patient: DoctorPatientListItem }) {
  if (patient.consultationInProgress) {
    return (
      <StatusPill tone="warning" className="min-h-6 px-2 py-0.5 text-[10px]">
        In progress
      </StatusPill>
    );
  }
  return <CareState state={patient.careState} />;
}

function CareState({ state }: { state: PatientCareState }) {
  const compactClass = 'min-h-6 px-2 py-0.5 text-[10px]';
  if (state === 'NEW_PATIENT') {
    return (
      <StatusPill tone="info" className={compactClass}>
        New Patient
      </StatusPill>
    );
  }
  if (state === 'FOLLOW_UP') {
    return (
      <StatusPill tone="warning" className={compactClass}>
        Follow-up
      </StatusPill>
    );
  }
  return (
    <StatusPill tone="success" className={compactClass}>
      Active care
    </StatusPill>
  );
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
