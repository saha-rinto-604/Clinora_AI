import { DoctorWorkspaceHeader } from '../../components/doctor/doctor-workspace-header';
import { ArrowRight, CalendarDays, FileText, FlaskConical, Search, UsersRound } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { AppSurface, EmptyState, StatusPill } from '../../components/app/app-ui';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/feedback';
import {
  consultationApi,
  consultationError,
  type DoctorPatientListItem,
  type PatientCareState,
} from '../../features/consultations/consultation-api';
import { ProfileAvatar } from '../../features/profile/profile-image';

export function DoctorPatientsPage() {
  const [items, setItems] = useState<DoctorPatientListItem[]>([]);
  const [filter, setFilter] = useState<PatientFilter>('ALL');
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
    return items.filter(
      (item) =>
        (filter === 'ALL' || item.careState === filter) &&
        (!normalized || item.patientName.toLowerCase().includes(normalized)),
    );
  }, [filter, items, query]);

  const counts = useMemo(
    () => ({
      ALL: items.length,
      ACTIVE_CARE: items.filter((item) => item.careState === 'ACTIVE_CARE').length,
      NEW_PATIENT: items.filter((item) => item.careState === 'NEW_PATIENT').length,
      FOLLOW_UP: items.filter((item) => item.careState === 'FOLLOW_UP').length,
    }),
    [items],
  );

  return (
    <div className="mx-auto w-full max-w-[1180px] overflow-hidden rounded-[18px] border border-cyan-300/[0.1] bg-[#03101a]/72 shadow-[0_28px_90px_rgba(0,0,0,.2)]">
      <DoctorWorkspaceHeader
        eyebrow="Continuing care"
        title="Patients"
        description="Your ongoing clinical relationships, latest completed care, follow-up context and upcoming appointments."
        background="patients"
        integrated
      />

      <div className="flex flex-col gap-2 border-b border-cyan-300/[0.08] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex min-w-0 gap-1 overflow-x-auto" role="tablist" aria-label="Filter Patients by care state">
          {patientFilters.map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={filter === item.value}
              onClick={() => setFilter(item.value)}
              className={`inline-flex min-h-8 shrink-0 items-center gap-2 rounded-lg px-3 text-[11px] font-semibold transition ${
                filter === item.value
                  ? 'bg-cyan-400/15 text-cyan-100 ring-1 ring-inset ring-cyan-300/15'
                  : 'text-slate-400 hover:bg-white/[0.035] hover:text-slate-200'
              }`}
            >
              {item.label}{' '}
              <span className="font-normal tabular-nums text-current opacity-70">{counts[item.value]}</span>
            </button>
          ))}
        </div>
        <label className="relative block w-full sm:w-52">
          <Search
            size={13}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600"
            aria-hidden="true"
          />
          <span className="sr-only">Search your Patients</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search patients"
            className="min-h-8 w-full rounded-lg border border-cyan-300/[0.1] bg-[#020d16]/75 pl-8 pr-2.5 text-[11px] text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/30 focus:ring-2 focus:ring-cyan-400/10"
          />
        </label>
      </div>

      <div className="p-3 sm:p-4">
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
              title={
                query.trim()
                  ? 'No matching Patient'
                  : filter === 'ALL'
                    ? 'No care relationships yet'
                    : 'No Patients in this care state'
              }
              copy={
                query.trim()
                  ? 'Try another Patient name or care-state filter.'
                  : 'A Patient appears here after a current booking or an actual consultation with you. Cancelled-only bookings are not kept as care relationships.'
              }
            />
          </AppSurface>
        ) : (
          <div
            role="list"
            data-density="compact"
            aria-label="Continuing care Patient list"
            className="overflow-hidden rounded-xl border border-cyan-300/[0.12] bg-[#04131f]/82"
          >
            {filtered.map((patient, index) => (
              <div key={patient.patientId} role="listitem">
                <PatientRow patient={patient} divided={index > 0} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

type PatientFilter = 'ALL' | PatientCareState;

const patientFilters: Array<{ value: PatientFilter; label: string }> = [
  { value: 'ALL', label: 'All' },
  { value: 'ACTIVE_CARE', label: 'Active care' },
  { value: 'NEW_PATIENT', label: 'New patient' },
  { value: 'FOLLOW_UP', label: 'Follow-up' },
];

function PatientRow({ patient, divided }: { patient: DoctorPatientListItem; divided: boolean }) {
  const isNew = patient.careState === 'NEW_PATIENT';
  const primaryContext = patient.consultationInProgress
    ? patient.contextAppointmentAt
      ? `Consultation started · ${appointmentDateTime(patient.contextAppointmentAt, patient.contextAppointmentTimezone)}`
      : 'Consultation currently in progress'
    : isNew
      ? patient.contextAppointmentAt
        ? `First appointment · ${appointmentDateTime(patient.contextAppointmentAt, patient.contextAppointmentTimezone)}`
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
  if (patient.currentlySharedReportCount > 0 || isNew || patient.consultationInProgress) {
    metadata.push(
      patient.currentlySharedReportCount > 0
        ? `${patient.currentlySharedReportCount} shared report${patient.currentlySharedReportCount === 1 ? '' : 's'}`
        : 'No reports shared',
    );
  }
  if (patient.contextAppointmentMode) metadata.push(modeLabel(patient.contextAppointmentMode));
  if (isNew && !patient.latestConsultationAt) metadata.push('No previous consultation');
  if (!isNew && patient.nextAppointmentAt) metadata.push(`Next · ${shortDate(patient.nextAppointmentAt)}`);

  const destination =
    patient.consultationInProgress && patient.contextAppointmentId
      ? `/doctor/appointments/${patient.contextAppointmentId}/consultation`
      : `/doctor/patients/${patient.patientId}`;

  return (
    <article
      className={`group px-3 py-3 transition hover:bg-cyan-300/[0.035] sm:px-4 ${
        divided ? 'border-t border-[var(--clinora-border-subtle)]' : ''
      }`}
    >
      <div className="flex min-w-0 items-start gap-3">
        {patient.contextAppointmentId ? (
          <ProfileAvatar
            source={{ kind: 'doctor-patient', appointmentId: patient.contextAppointmentId }}
            name={patient.patientName}
            size="sm"
            className="h-10 w-10 rounded-full"
          />
        ) : (
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-cyan-300/15 bg-cyan-400/[0.09] text-xs font-bold text-cyan-200">
            {patientInitials(patient.patientName)}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-sm font-semibold text-white">
                  <Link to={`/doctor/patients/${patient.patientId}`} className="hover:text-cyan-100">
                    {patient.patientName}
                  </Link>
                </h2>
                <PrimaryCareState patient={patient} />
              </div>
              <p className="mt-1 text-[11px] leading-4 text-[var(--clinora-text-faint)]">{primaryContext}</p>
            </div>
            <Link
              to={destination}
              className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-lg border border-cyan-300/20 bg-cyan-400/[0.05] px-3 text-[10px] font-semibold text-cyan-200 transition group-hover:border-cyan-300/35 group-hover:bg-cyan-400/[0.09]"
            >
              {patient.consultationInProgress && patient.contextAppointmentId ? 'Resume' : 'Open patient'}
              <ArrowRight size={12} className="transition group-hover:translate-x-0.5" />
            </Link>
          </div>

          {(patient.consultationInProgress || isNew) && patient.contextAppointmentReason ? (
            <p className="mt-2 line-clamp-1 text-[12px] leading-5 text-slate-200">{patient.contextAppointmentReason}</p>
          ) : !isNew && (patient.latestAssessment || patient.latestPlan) ? (
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
              {metadata.map((item, index) => (
                <span key={item} className="inline-flex items-center gap-1.5">
                  {metadataIcon(item, index)} {item}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function patientInitials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || '?'
  );
}

function metadataIcon(value: string, index: number) {
  if (value.includes('investigation')) return <FlaskConical size={12} aria-hidden="true" />;
  if (value.includes('report')) return <FileText size={12} aria-hidden="true" />;
  if (value.startsWith('Follow-up') || value.startsWith('Next')) return <CalendarDays size={12} aria-hidden="true" />;
  return index === 0 ? <CalendarDays size={12} aria-hidden="true" /> : null;
}

function PrimaryCareState({ patient }: { patient: DoctorPatientListItem }) {
  if (patient.consultationInProgress) {
    return (
      <StatusPill tone="warning" className="min-h-6 px-2 py-0.5 text-[10px]">
        Consultation in progress
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

function appointmentDateTime(value: string, timezone: string | null) {
  return new Date(value).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    ...(timezone ? { timeZone: timezone } : {}),
  });
}

function modeLabel(mode: 'ONLINE' | 'IN_PERSON') {
  return mode === 'ONLINE' ? 'Online' : 'In-person';
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
