import {
  ArrowLeft,
  CalendarClock,
  ClipboardList,
  FileText,
  FlaskConical,
  Pill,
  Stethoscope,
  UserRound,
} from 'lucide-react';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { AppSectionHeader, AppSurface, EmptyState, IconWell, StatusPill } from '../../components/app/app-ui';
import { Button } from '../../components/ui/button';
import { buttonVariants } from '../../components/ui/button-variants';
import { Skeleton } from '../../components/ui/feedback';
import {
  consultationApi,
  consultationError,
  type DoctorPatientDetail,
  type PatientCareEpisode,
} from '../../features/consultations/consultation-api';

export function DoctorPatientDetailPage() {
  const { patientId = '' } = useParams();
  const [data, setData] = useState<DoctorPatientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    setError('');
    try {
      setData(await consultationApi.patient(patientId));
    } catch (requestError) {
      setError(consultationError(requestError, 'We could not open this Patient care history.'));
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-5" role="status" aria-label="Loading Patient care history">
        <Skeleton className="h-28 rounded-[20px]" />
        <Skeleton className="h-72 rounded-[20px]" />
      </div>
    );
  }

  if (!data) {
    return (
      <AppSurface variant="attention">
        <p role="alert" className="text-sm text-amber-100">
          {error || 'This Patient could not be found in your care history.'}
        </p>
        <div className="mt-4 flex gap-3">
          <Button variant="appSecondary" onClick={() => void load()}>
            Try again
          </Button>
          <Link to="/doctor/patients" className={buttonVariants({ variant: 'appSecondary' })}>
            Back to Patients
          </Link>
        </div>
      </AppSurface>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        to="/doctor/patients"
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400 hover:text-white"
      >
        <ArrowLeft size={15} /> Back to Patients
      </Link>

      <AppSurface variant="hero">
        <div className="flex items-center gap-4">
          <IconWell tone="info">
            <UserRound size={20} />
          </IconWell>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-200">Care relationship</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-white sm:text-3xl">
              {data.patientName}
            </h1>
            <p className="mt-2 text-sm text-[var(--clinora-text-muted)]">
              Your appointments and Doctor-authored consultation history only. Patient report access remains separately
              controlled.
            </p>
          </div>
        </div>
      </AppSurface>

      <AppSurface padding="none" className="overflow-hidden">
        <div className="border-b border-[var(--clinora-border-subtle)] px-5 py-4 sm:px-6">
          <AppSectionHeader eyebrow="Next care" title="Upcoming appointments" />
        </div>
        {data.upcomingAppointments.length ? (
          <ul className="divide-y divide-[var(--clinora-border-subtle)]">
            {data.upcomingAppointments.map((appointment) => (
              <li key={appointment.appointmentId}>
                <Link
                  to={`/doctor/appointments/${appointment.appointmentId}`}
                  className="group flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-[var(--clinora-surface-hover)] sm:flex-row sm:items-center sm:justify-between sm:px-6"
                >
                  <span className="flex items-center gap-3">
                    <IconWell tone="info">
                      <CalendarClock size={15} />
                    </IconWell>
                    <span>
                      <strong className="block text-sm font-semibold text-white">
                        {formatDateTime(appointment.scheduledStart)}
                      </strong>
                      <span className="mt-1 block text-xs text-[var(--clinora-text-muted)]">
                        {appointment.consultationMode === 'ONLINE' ? 'Online' : 'In-person'} ·{' '}
                        {appointment.sharedReportCount} currently shared report
                        {appointment.sharedReportCount === 1 ? '' : 's'}
                      </span>
                    </span>
                  </span>
                  <span className="text-xs font-semibold text-cyan-200">Open appointment</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            className="p-6"
            icon={<CalendarClock size={17} />}
            title="No upcoming appointment"
            copy="A future Patient booking will appear here automatically."
          />
        )}
      </AppSurface>

      <AppSurface padding="none" className="overflow-hidden">
        <div className="border-b border-[var(--clinora-border-subtle)] px-5 py-4 sm:px-6">
          <AppSectionHeader
            eyebrow="Your clinical record"
            title="Consultation history"
            copy="Doctor-authored encounter records remain available without reopening revoked Patient report access."
          />
        </div>
        {data.careHistory.length ? (
          <div className="divide-y divide-[var(--clinora-border-subtle)]">
            {data.careHistory.map((episode) => (
              <CareEpisode key={episode.consultationId} episode={episode} />
            ))}
          </div>
        ) : (
          <EmptyState
            className="p-6"
            icon={<ClipboardList size={17} />}
            title="No consultation record yet"
            copy="Completed and in-progress consultations with this Patient will appear here."
          />
        )}
      </AppSurface>
    </div>
  );
}

function CareEpisode({ episode }: { episode: PatientCareEpisode }) {
  return (
    <article className="px-5 py-5 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-white">
              {episode.completedAt ? `Consultation · ${shortDate(episode.completedAt)}` : 'Consultation in progress'}
            </h2>
            <StatusPill tone={episode.status === 'COMPLETED' ? 'success' : 'warning'}>
              {episode.status === 'COMPLETED' ? 'Completed' : 'In progress'}
            </StatusPill>
          </div>
          {episode.assessment ? (
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              <span className="font-semibold text-white">Assessment: </span>
              {episode.assessment}
            </p>
          ) : null}
          {episode.plan ? (
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--clinora-text-muted)]">
              <span className="font-semibold text-slate-300">Plan: </span>
              {episode.plan}
            </p>
          ) : null}
        </div>
        <Link
          to={`/doctor/appointments/${episode.appointmentId}/consultation`}
          className={buttonVariants({ variant: 'appSecondary', size: 'sm' })}
        >
          <Stethoscope size={14} /> Open record
        </Link>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--clinora-text-muted)]">
        <CareChip
          icon={<Pill size={13} />}
          text={`${episode.prescriptionCount} prescription item${episode.prescriptionCount === 1 ? '' : 's'}`}
        />
        <CareChip
          icon={<FlaskConical size={13} />}
          text={`${episode.investigationCount} investigation${episode.investigationCount === 1 ? '' : 's'}`}
        />
        {episode.followUpDate ? (
          <CareChip icon={<CalendarClock size={13} />} text={`Follow-up ${shortDate(episode.followUpDate)}`} />
        ) : null}
        <CareChip icon={<FileText size={13} />} text="Source reports remain Patient-controlled" />
      </div>
    </article>
  );
}

function CareChip({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-nested)] px-2.5 py-1.5">
      {icon}
      {text}
    </span>
  );
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function shortDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
