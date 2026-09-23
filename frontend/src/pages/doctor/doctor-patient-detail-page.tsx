import {
  Activity,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronRight,
  ClipboardList,
  FileText,
  FlaskConical,
  History,
  Info,
  MoreHorizontal,
  Paperclip,
  Pill,
  Stethoscope,
  Video,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { StatusPill } from '../../components/app/app-ui';
import { Skeleton } from '../../components/ui/feedback';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '../../components/ui/dropdown-menu';
import type {
  DoctorPatientDetail,
  DoctorPatientCurrentCare,
  PatientAppointmentLink,
  PatientCareEpisode,
} from '../../features/consultations/consultation-api';
import {
  appointmentPath,
  consultationPath,
  consultationMode,
  detailDate,
  detailDateTime,
  patientDetailModel,
  useDoctorPatientDetail,
  type CareTimelineEvent,
} from '../../features/doctor/doctor-patient-detail-model';
import { ProfileAvatar } from '../../features/profile/profile-image';

const secondaryAction =
  'inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-cyan-300/20 bg-[#061c2a]/70 px-3 text-xs font-medium text-slate-200 transition hover:border-cyan-300/40 hover:text-white focus-visible:outline-2 focus-visible:outline-cyan-300';
const quickAction =
  'flex min-h-10 w-full items-center gap-2.5 rounded-lg bg-[#0a2535]/70 px-3 py-2 text-left text-xs text-slate-200 transition hover:bg-cyan-300/10 focus-visible:outline-2 focus-visible:outline-cyan-300';
const tabs = [
  { value: 'overview', label: 'Overview', icon: ClipboardList },
  { value: 'appointments', label: 'Appointments', icon: CalendarDays },
  { value: 'reports', label: 'Reports', icon: FileText },
  { value: 'consultations', label: 'Consultations', icon: Stethoscope },
  { value: 'timeline', label: 'Care Timeline', icon: History },
];

export function DoctorPatientDetailPage() {
  const { patientId = '' } = useParams();
  const { data, loading, error, retry } = useDoctorPatientDetail(patientId);
  if (loading)
    return (
      <div className="mx-auto max-w-[1100px] space-y-4" role="status" aria-label="Loading Patient care history">
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-11 rounded-lg" />
        <Skeleton className="h-56 rounded-2xl" />
      </div>
    );
  if (!data)
    return (
      <div className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-4">
        <p role="alert" className="text-sm text-amber-100">
          {error || 'This Patient could not be found in your care history.'}
        </p>
        <div className="mt-3 flex gap-3">
          <button type="button" className={secondaryAction} onClick={retry}>
            Try again
          </button>
          <Link className={secondaryAction} to="/doctor/patients">
            Back to Patients
          </Link>
        </div>
      </div>
    );
  return <PatientWorkspace key={data.patientId} data={data} />;
}

function PatientWorkspace({ data }: { data: DoctorPatientDetail }) {
  const [tab, setTab] = useState('overview');
  const model = patientDetailModel(data);
  const { care, state, statusLabel, activeEpisode, appointments, history, next, appointmentId, primary } = model;
  const tone = state === 'IN_PROGRESS' || state === 'FOLLOW_UP' ? 'warning' : 'success';
  const initialLetters =
    data.patientName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || '?';
  const context =
    state === 'IN_PROGRESS' && activeEpisode
      ? `Started ${detailDateTime(activeEpisode.startedAt)}`
      : state === 'NEW_PATIENT'
        ? next
          ? `First appointment scheduled · ${detailDateTime(next.scheduledStart, next.timezone)}`
          : 'No completed consultation yet'
        : state === 'FOLLOW_UP' && care.followUpDate
          ? `Recommended follow-up · ${detailDate(care.followUpDate)}`
          : care.latestConsultationAt
            ? `Latest completed consultation · ${detailDate(care.latestConsultationAt)}`
            : 'Your clinical care relationship';

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-4 pb-4">
      <div className="flex min-h-8 items-center justify-between gap-3">
        <Link
          to="/doctor/patients"
          className="inline-flex min-h-8 items-center gap-2 text-sm text-slate-300 hover:text-cyan-200"
        >
          <ArrowLeft size={16} />
          Back to Patients
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className={secondaryAction}>
              <MoreHorizontal size={16} className="text-cyan-300" />
              More actions
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {next ? (
              <DropdownMenuItem asChild>
                <Link to={appointmentPath(next.appointmentId)}>Open upcoming appointment</Link>
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onSelect={() => setTab('timeline')}>Review care history</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <header
        aria-label="Patient identity"
        className="relative isolate overflow-hidden rounded-2xl border border-cyan-300/20 bg-[#031724] px-4 py-5 sm:px-6"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(100deg,#03131f_15%,#041b2b_65%,#04283d)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 -z-10 w-[45%] overflow-hidden opacity-40"
        >
          <svg
            viewBox="0 0 360 210"
            preserveAspectRatio="xMaxYMid slice"
            className="h-full w-full fill-cyan-300/50 stroke-cyan-400/30"
            focusable="false"
          >
            <path
              fill="none"
              d="M80 0 160 52 240 12 292 72 360 28M0 80 90 110 160 52 215 113 292 72 348 142M90 110 126 180 215 113 256 193 348 142 360 210M160 52 160 0M215 113 240 12M126 180 38 210M256 193 238 210"
            />
            {[
              [160, 52],
              [240, 12],
              [292, 72],
              [90, 110],
              [215, 113],
              [126, 180],
              [256, 193],
              [348, 142],
            ].map(([cx, cy]) => (
              <g key={`${cx}-${cy}`}>
                <circle cx={cx} cy={cy} r="13" fill="none" />
                <circle cx={cx} cy={cy} r="3" />
              </g>
            ))}
          </svg>
        </div>
        <div className="grid items-start gap-x-5 gap-y-4 sm:grid-cols-[80px_minmax(0,1fr)] lg:grid-cols-[80px_minmax(0,1fr)_260px]">
          <div className="sm:row-span-2">
            {appointmentId ? (
              <ProfileAvatar
                source={{ kind: 'doctor-patient', appointmentId }}
                name={data.patientName}
                size="xl"
                className="h-20 w-20 rounded-full border-cyan-300/25 text-2xl"
              />
            ) : (
              <span
                aria-label={`${data.patientName} initials`}
                className="grid h-20 w-20 place-items-center rounded-full border border-cyan-300/25 bg-cyan-400/10 text-2xl font-semibold text-cyan-300"
              >
                {initialLetters}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-semibold tracking-[-0.03em] text-white">{data.patientName}</h1>
            <p className="mt-2 break-all text-[11px] text-slate-400">
              Patient ID <span className="ml-2 text-slate-300">{data.patientId}</span>
            </p>
            <p className="mt-2 flex items-start gap-2 text-xs leading-5 text-slate-300">
              <CalendarDays size={14} className="mt-0.5 shrink-0 text-cyan-300" />
              {care.latestConsultationAt
                ? `Last completed visit ${detailDate(care.latestConsultationAt)}`
                : next
                  ? `Scheduled visit ${detailDate(next.scheduledStart, next.timezone)}`
                  : 'No completed visit recorded'}
            </p>
          </div>
          <div className="sm:col-start-2 lg:col-start-3 lg:row-span-2 lg:text-right">
            <StatusPill tone={tone} className="gap-2 border px-3 py-1 text-xs">
              <Activity size={14} aria-hidden="true" />
              {statusLabel}
            </StatusPill>
            <p className="mt-3 text-xs leading-5 text-slate-300">{context}</p>
            {state !== 'NEW_PATIENT' && next ? (
              <p className="mt-1 text-xs leading-5 text-slate-400">
                Next appointment {detailDateTime(next.scheduledStart, next.timezone)}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2 sm:col-start-2">
            {primary ? (
              <Link
                to={primary.to}
                className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-cyan-400 px-4 text-xs font-semibold text-slate-950 shadow-[0_0_18px_rgba(34,211,238,.16)] transition hover:bg-cyan-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
              >
                {primary.label}
                <ArrowRight size={15} />
              </Link>
            ) : null}
            <button
              type="button"
              className={secondaryAction}
              onClick={() => setTab(state === 'NEW_PATIENT' ? 'appointments' : 'timeline')}
            >
              <History size={14} />
              {state === 'NEW_PATIENT' ? 'View appointments' : 'View care history'}
            </button>
          </div>
        </div>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="overflow-x-auto border-b border-cyan-300/10">
          <TabsList
            aria-label="Patient detail navigation"
            className="flex w-max min-w-full justify-start gap-2 rounded-none border-0 bg-transparent p-0"
          >
            {tabs.map(({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="flex min-h-11 shrink-0 items-center gap-2 rounded-none border-b-2 border-transparent px-3 text-xs font-medium data-[state=active]:border-cyan-300 data-[state=active]:bg-transparent data-[state=active]:text-cyan-200 focus-visible:outline-2 focus-visible:outline-cyan-300 sm:px-4"
              >
                <Icon size={15} />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent value="overview" className="space-y-4">
          <DetailSection
            title="Clinical continuity"
            icon={<Stethoscope size={22} />}
            copy={
              state === 'IN_PROGRESS'
                ? 'Continue the current consultation or review Patient information.'
                : state === 'NEW_PATIENT'
                  ? 'Review upcoming appointment details and Patient context.'
                  : 'Your latest completed care and the next steps for this Patient.'
            }
          >
            <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1.6fr)_minmax(220px,1fr)]">
              <div className="rounded-lg border border-cyan-300/10 bg-[#061c29]/60 p-3">
                <h3 className="text-xs font-medium text-slate-200">
                  {state === 'IN_PROGRESS'
                    ? 'Current consultation'
                    : state === 'NEW_PATIENT'
                      ? 'Patient status'
                      : 'Latest completed care'}
                </h3>
                {state === 'IN_PROGRESS' && activeEpisode ? (
                  <Link
                    to={consultationPath(activeEpisode.appointmentId)}
                    className="mt-2 flex items-center gap-3 rounded-lg bg-[#0a2535]/70 p-3 hover:bg-cyan-300/10"
                  >
                    <FileText className="shrink-0 text-cyan-300" size={22} />
                    <span className="min-w-0 flex-1">
                      <strong className="block text-xs font-medium text-white">Consultation in progress</strong>
                      <span className="mt-1 block text-xs text-slate-400">
                        Started {detailDateTime(activeEpisode.startedAt)}
                      </span>
                    </span>
                    <ChevronRight size={16} className="text-slate-400" />
                  </Link>
                ) : state === 'NEW_PATIENT' ? (
                  <div className="mt-2">
                    <StatusPill tone="success">New Patient</StatusPill>
                    <p className="mt-2 text-xs leading-5 text-slate-400">
                      {next ? 'First appointment scheduled. ' : ''}
                      {history.length === 0 ? 'No previous consultation records.' : 'No completed consultation yet.'}
                    </p>
                  </div>
                ) : care.latestConsultationAt ? (
                  <CompletedCare care={care} />
                ) : (
                  <p className="mt-2 text-xs leading-5 text-slate-400">
                    {state === 'IN_PROGRESS'
                      ? 'Consultation in progress. Review your care history to continue.'
                      : 'No completed consultation yet.'}
                  </p>
                )}
                {state === 'IN_PROGRESS' && care.latestConsultationAt ? (
                  <details className="mt-3 text-xs text-slate-300">
                    <summary className="cursor-pointer text-cyan-200">Latest completed care</summary>
                    <CompletedCare care={care} />
                  </details>
                ) : null}
              </div>
              <div className="rounded-lg border border-cyan-300/10 bg-[#061c29]/60 p-3">
                <h3 className="mb-2 text-xs font-medium text-slate-200">Quick actions</h3>
                <div className="space-y-2">
                  {appointmentId ? (
                    <Link className={quickAction} to={appointmentPath(appointmentId)}>
                      <FileText size={16} className="shrink-0 text-cyan-300" />
                      {state === 'NEW_PATIENT'
                        ? 'Review appointment & shared reports'
                        : 'Review reports in appointment'}
                    </Link>
                  ) : (
                    <button type="button" className={quickAction} onClick={() => setTab('reports')}>
                      <FileText size={16} className="text-cyan-300" />
                      View report sharing
                    </button>
                  )}
                  <button
                    type="button"
                    className={quickAction}
                    onClick={() => setTab(state === 'NEW_PATIENT' ? 'appointments' : 'timeline')}
                  >
                    <History size={16} className="shrink-0 text-cyan-300" />
                    {state === 'NEW_PATIENT' ? 'View scheduled visits' : 'View care history'}
                  </button>
                </div>
              </div>
            </div>
          </DetailSection>
          <AppointmentSection
            appointments={appointments.slice(0, 5)}
            activeAppointmentId={activeEpisode?.appointmentId}
            onViewAll={() => setTab('appointments')}
          />
          {history.length ? (
            <HistorySection episodes={history.slice(0, 3)} onViewAll={() => setTab('consultations')} />
          ) : (
            <NoHistory />
          )}
        </TabsContent>
        <TabsContent value="appointments">
          <AppointmentSection appointments={appointments} activeAppointmentId={activeEpisode?.appointmentId} />
        </TabsContent>
        <TabsContent value="reports">
          <ReportSharing appointments={appointments} activeAppointmentId={activeEpisode?.appointmentId} />
        </TabsContent>
        <TabsContent value="consultations">
          {history.length ? <HistorySection episodes={history} /> : <NoHistory />}
        </TabsContent>
        <TabsContent value="timeline">
          <CareTimeline events={model.events} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DetailSection({
  title,
  copy,
  icon,
  action,
  children,
}: {
  title: string;
  copy?: string;
  icon: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-cyan-300/[0.12] bg-[#041722]/80 p-4">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-cyan-300/10 bg-cyan-400/10 text-cyan-300"
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold tracking-tight text-white">{title}</h2>
          {copy ? <p className="mt-1 text-xs leading-5 text-slate-400">{copy}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function CompletedCare({ care }: { care: DoctorPatientCurrentCare }) {
  return (
    <div className="mt-2 space-y-2 text-xs leading-5">
      {care.latestAssessment ? <p className="whitespace-pre-wrap text-slate-200">{care.latestAssessment}</p> : null}
      {care.latestPlan ? (
        <p className="whitespace-pre-wrap text-slate-400">
          <span className="text-slate-200">Plan: </span>
          {care.latestPlan}
        </p>
      ) : null}
      <CareCounts care={care} />
    </div>
  );
}

function CareCounts({
  care,
}: {
  care: Pick<
    DoctorPatientCurrentCare,
    'prescriptionCount' | 'prescriptionDocumentCount' | 'requestedInvestigationCount' | 'followUpDate'
  >;
}) {
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] leading-5 text-slate-400">
      {care.prescriptionCount > 0 ? (
        <span className="inline-flex items-center gap-1">
          <Pill size={12} />
          {care.prescriptionCount} prescription item{care.prescriptionCount === 1 ? '' : 's'}
        </span>
      ) : null}
      {care.prescriptionDocumentCount > 0 ? (
        <span className="inline-flex items-center gap-1">
          <Paperclip size={12} />
          {care.prescriptionDocumentCount} prescription document{care.prescriptionDocumentCount === 1 ? '' : 's'}
        </span>
      ) : null}
      {care.requestedInvestigationCount > 0 ? (
        <span className="inline-flex items-center gap-1">
          <FlaskConical size={12} />
          {care.requestedInvestigationCount} requested investigation{care.requestedInvestigationCount === 1 ? '' : 's'}
        </span>
      ) : null}
      {care.followUpDate ? (
        <span className="inline-flex items-center gap-1 text-amber-200">
          <CalendarDays size={12} />
          Follow-up {detailDate(care.followUpDate)}
        </span>
      ) : null}
    </span>
  );
}

function AppointmentSection({
  appointments,
  activeAppointmentId,
  onViewAll,
}: {
  appointments: PatientAppointmentLink[];
  activeAppointmentId?: string;
  onViewAll?: () => void;
}) {
  return (
    <DetailSection
      title="Upcoming appointments"
      copy="Next scheduled visits and follow-ups."
      icon={<CalendarDays size={21} />}
      action={
        onViewAll ? (
          <button type="button" aria-label="View all appointments" className={secondaryAction} onClick={onViewAll}>
            View all<span className="sr-only"> appointments</span>
          </button>
        ) : null
      }
    >
      {appointments.length ? (
        <ul className="mt-3 divide-y divide-cyan-300/10">
          {appointments.map((appointment) => (
            <li key={appointment.appointmentId}>
              <Link
                to={appointmentPath(appointment.appointmentId)}
                className="group grid grid-cols-[54px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg py-2 transition hover:bg-cyan-300/[0.04] sm:grid-cols-[60px_90px_minmax(0,1fr)_auto_auto]"
              >
                <span className="flex min-h-14 flex-col items-center justify-center rounded-lg border border-cyan-300/10 bg-[#082434]/70">
                  <span className="text-[10px] uppercase text-cyan-200">
                    {new Date(appointment.scheduledStart).toLocaleDateString(undefined, {
                      month: 'short',
                      timeZone: appointment.timezone,
                    })}
                  </span>
                  <strong className="text-lg font-medium leading-5 text-white">
                    {new Date(appointment.scheduledStart).toLocaleDateString(undefined, {
                      day: 'numeric',
                      timeZone: appointment.timezone,
                    })}
                  </strong>
                  <span className="text-[9px] text-slate-400">
                    {new Date(appointment.scheduledStart).toLocaleDateString(undefined, {
                      year: 'numeric',
                      timeZone: appointment.timezone,
                    })}
                  </span>
                </span>
                <span className="text-xs font-semibold text-white">
                  {new Date(appointment.scheduledStart).toLocaleTimeString(undefined, {
                    hour: 'numeric',
                    minute: '2-digit',
                    timeZone: appointment.timezone,
                  })}
                  <span className="mt-1 block text-[10px] font-normal text-slate-500">{appointment.timezone}</span>
                  <span className="mt-1 block font-normal text-slate-400 sm:hidden">
                    {consultationMode(appointment.consultationMode)}
                  </span>
                </span>
                <span className="hidden items-center gap-2 text-xs text-slate-300 sm:flex">
                  {appointment.consultationMode === 'ONLINE' ? <Video size={14} /> : <Stethoscope size={14} />}
                  {consultationMode(appointment.consultationMode)}
                </span>
                <span
                  className={`rounded-full border px-2.5 py-1 text-[10px] ${appointment.appointmentId === activeAppointmentId ? 'border-teal-300/20 bg-teal-400/10 text-teal-200' : 'border-cyan-300/15 bg-cyan-400/10 text-cyan-200'}`}
                >
                  {appointment.appointmentId === activeAppointmentId ? 'Ongoing' : 'Upcoming'}
                </span>
                <ChevronRight size={16} className="hidden text-slate-400 sm:block" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs leading-5 text-slate-400">
          No upcoming appointment. A future booking will appear here.
        </p>
      )}
    </DetailSection>
  );
}

function HistorySection({ episodes, onViewAll }: { episodes: PatientCareEpisode[]; onViewAll?: () => void }) {
  return (
    <DetailSection
      title="Consultations over time"
      copy="Your encounter records with this Patient."
      icon={<ChartNoAxesCombined size={21} />}
      action={
        onViewAll ? (
          <button type="button" aria-label="View all consultations" className={secondaryAction} onClick={onViewAll}>
            View all<span className="sr-only"> consultations</span>
          </button>
        ) : null
      }
    >
      <ol className="relative mt-3 ml-2 border-l border-cyan-300/15">
        {episodes.map((episode) => {
          const completed = episode.status === 'COMPLETED';
          return (
            <li key={episode.consultationId} className="relative pl-6">
              <span
                aria-hidden="true"
                className={`absolute -left-[7px] top-5 h-3 w-3 rounded-full ${completed ? 'bg-teal-300 ring-4 ring-teal-300/10' : 'border-2 border-cyan-300 bg-[#041722] ring-4 ring-cyan-300/15'}`}
              />
              <Link
                to={consultationPath(episode.appointmentId)}
                className="grid items-start gap-2 border-t border-cyan-300/10 py-3 hover:bg-cyan-300/[0.03] sm:grid-cols-[160px_minmax(0,1fr)_16px]"
              >
                <span className="text-xs">
                  <strong className={`block font-medium ${completed ? 'text-slate-300' : 'text-cyan-300'}`}>
                    {completed ? 'Completed consultation' : 'In progress'}
                  </strong>
                  <span className="mt-1 block text-[11px] leading-5 text-slate-400">
                    {completed && episode.completedAt
                      ? detailDate(episode.completedAt)
                      : detailDateTime(episode.startedAt)}
                  </span>
                </span>
                <span className="min-w-0 text-xs leading-5">
                  <span className="block text-slate-200">
                    {completed ? episode.assessment || 'Completed consultation' : 'Consultation in progress'}
                  </span>
                  {completed ? (
                    <>
                      {episode.plan ? <span className="mt-1 block text-slate-400">Plan: {episode.plan}</span> : null}
                      <span className="mt-1 block">
                        <CareCounts care={episode} />
                      </span>
                    </>
                  ) : (
                    <span className="mt-1 block text-slate-400">
                      Draft assessment and plan remain inside this consultation.
                    </span>
                  )}
                </span>
                <ChevronRight size={16} className="hidden self-center text-slate-400 sm:block" />
              </Link>
            </li>
          );
        })}
      </ol>
    </DetailSection>
  );
}

function NoHistory() {
  return (
    <section className="flex items-center gap-4 rounded-xl border border-cyan-300/10 bg-[#061c2a]/75 p-4">
      <Info size={25} className="shrink-0 text-cyan-300" />
      <div>
        <h2 className="text-sm font-semibold text-white">No consultation history yet</h2>
        <p className="mt-1 text-xs leading-5 text-slate-400">
          The first consultation will appear here after it is completed.
        </p>
      </div>
    </section>
  );
}

function ReportSharing({
  appointments,
  activeAppointmentId,
}: {
  appointments: PatientAppointmentLink[];
  activeAppointmentId?: string;
}) {
  const shared = appointments.filter((appointment) => appointment.sharedReportCount > 0);
  return (
    <DetailSection
      title="Appointment report sharing"
      copy="Reports are shared for individual appointments. Access is checked again when you open the appointment and can be revoked by the Patient."
      icon={<FileText size={21} />}
    >
      {shared.length ? (
        <ul className="mt-3 divide-y divide-cyan-300/10">
          {shared.map((appointment) => (
            <li key={appointment.appointmentId} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="text-sm text-slate-200">
                  {appointment.sharedReportCount} report{appointment.sharedReportCount === 1 ? '' : 's'} currently
                  shared
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {detailDateTime(appointment.scheduledStart, appointment.timezone)}
                </p>
              </div>
              <Link className={secondaryAction} to={appointmentPath(appointment.appointmentId)}>
                Open appointment to review
                <ArrowRight size={13} />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs leading-5 text-slate-400">
          No reports currently shared for the upcoming appointments shown here.
        </p>
      )}
      {activeAppointmentId && !shared.some((appointment) => appointment.appointmentId === activeAppointmentId) ? (
        <Link className={`${secondaryAction} mt-3`} to={appointmentPath(activeAppointmentId)}>
          Review current appointment access
          <ArrowRight size={13} />
        </Link>
      ) : null}
    </DetailSection>
  );
}

function CareTimeline({ events }: { events: CareTimelineEvent[] }) {
  return (
    <DetailSection
      title="Care Timeline"
      copy="Scheduled visits, recorded consultations and recommended follow-ups."
      icon={<History size={21} />}
    >
      {events.length ? (
        <ol className="mt-3 ml-2 border-l border-cyan-300/15">
          {events.map((event) => (
            <li key={event.key} className="relative pl-6">
              <span
                aria-hidden="true"
                className={`absolute -left-[5px] top-5 h-2 w-2 rounded-full ${event.kind === 'follow-up' ? 'bg-amber-300' : event.kind === 'completed' ? 'bg-teal-300' : 'bg-cyan-300'}`}
              />
              <div className="border-t border-cyan-300/10 py-3 text-xs">
                <p className="text-[11px] text-slate-400">
                  {event.kind === 'follow-up' ? detailDate(event.date) : detailDateTime(event.date, event.timezone)}
                </p>
                {event.to ? (
                  <Link
                    to={event.to}
                    className="mt-1 inline-flex items-center gap-2 font-medium text-slate-200 hover:text-cyan-200"
                  >
                    {event.title}
                    <ChevronRight size={13} />
                  </Link>
                ) : (
                  <p className="mt-1 font-medium text-slate-200">{event.title}</p>
                )}
                {event.detail ? <p className="mt-1 text-slate-400">{event.detail}</p> : null}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-3 text-xs text-slate-400">No care events recorded yet.</p>
      )}
    </DetailSection>
  );
}
