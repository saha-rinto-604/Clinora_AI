import {
  Activity,
  ArrowRight,
  Bell,
  CalendarDays,
  ChartNoAxesCombined,
  Clock3,
  Droplets,
  FileText,
  HeartPulse,
  LockKeyhole,
  Ruler,
  ScanText,
  Search,
  ShieldCheck,
  Stethoscope,
  UploadCloud,
  UserRound,
  Weight,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import type { Appointment } from '../appointments/appointment-api';
import { DashboardSparkline } from '../patient-record/dashboard-sparkline';
import {
  dashboardMeasurements,
  dashboardTrend,
  measurementChange,
  measurementValue,
  type DashboardTrendMetric,
} from '../patient-record/dashboard-trend-model';
import type { BodyMeasurementPoint, HealthRecord, TimelineEvent } from '../patient-record/patient-record-api';
import { ProfileAvatar } from '../profile/profile-image';
import type { PatientHomeSection } from './patient-home';
import type { PatientPortalSummary } from './patient-portal-api';
import type { PatientDashboard, PatientProfile } from './patient-types';

export function DashboardHeader({
  firstName,
  verified,
  unread,
}: {
  firstName: string;
  verified: boolean;
  unread: number | null;
}) {
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [searchMessage, setSearchMessage] = useState('');
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener('keydown', shortcut);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('keydown', shortcut);
    };
  }, []);
  const search = (event: FormEvent) => {
    event.preventDefault();
    const text = query.trim().toLowerCase();
    const destinations: [RegExp, string][] = [
      [/analysis|analyze|^ai\b/, '/patient/analyze'],
      [/report|lab/, '/patient/reports'],
      [/doctor/, '/patient/doctors'],
      [/appointment|booking/, '/patient/appointments'],
      [/profile/, '/patient/profile'],
      [/blood/, '/patient/blood-network'],
      [/record|history|health/, '/patient/history'],
    ];
    const destination = destinations.find(([pattern]) => pattern.test(text))?.[1];
    if (destination) {
      setSearchMessage('');
      navigate(destination);
    } else setSearchMessage('Try reports, doctors, appointments, health record, profile or AI analysis.');
  };
  const hour = now.getHours();
  return (
    <>
      <div className="patient-home__utility">
        <div className="patient-home__search-wrap">
          <form className="patient-home__search" role="search" onSubmit={search}>
            <Search size={18} aria-hidden="true" />
            <input
              ref={input}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search reports, doctors, appointments…"
              aria-label="Jump to reports, doctors, appointments or health record"
              aria-describedby={searchMessage ? 'patient-search-message' : undefined}
            />
            <kbd>Ctrl K</kbd>
          </form>
          {searchMessage ? (
            <p id="patient-search-message" role="status">
              {searchMessage}
            </p>
          ) : null}
        </div>
        <div className="patient-home__utilities">
          <Link
            to="/patient/notifications"
            className="patient-home__notification"
            aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
          >
            <Bell size={20} aria-hidden="true" />
            {unread != null && unread > 0 ? <span>{unread > 99 ? '99+' : unread}</span> : null}
          </Link>
          <div className="patient-home__clock">
            <Clock3 size={23} aria-hidden="true" />
            <time dateTime={now.toISOString()}>
              <span>
                {now.toLocaleDateString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
              <strong>{now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</strong>
            </time>
          </div>
        </div>
      </div>
      <header className="patient-home__greeting">
        <div>
          <div className="patient-home__greeting-line">
            <h1>
              Good {hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'}, {firstName}
            </h1>
            {verified ? (
              <span className="patient-home__verified">
                <ShieldCheck size={14} aria-hidden="true" />
                Verified Patient
              </span>
            ) : null}
          </div>
          <p>Here&apos;s what matters for your health today.</p>
        </div>
        <p className="patient-home__motto" aria-hidden="true">
          Science
          <br />
          Humanity
          <br />A healthier tomorrow
        </p>
      </header>
    </>
  );
}

export function DashboardActions({ onUpload }: { onUpload: () => void }) {
  return (
    <section className="patient-home__actions" aria-label="Patient tools">
      <article className="patient-home__action patient-home__action--analysis">
        <span className="patient-home__action-icon">
          <ScanText size={25} aria-hidden="true" />
        </span>
        <div>
          <span className="patient-home__eyebrow">AI Report Analysis</span>
          <h2>Turn a report into insights</h2>
          <p>Review your reports and explore AI-assisted explanations in one place.</p>
          <Link className="patient-home__button patient-home__button--primary" to="/patient/analyze">
            <ScanText size={14} aria-hidden="true" />
            Analyze a report
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </article>
      <article className="patient-home__action patient-home__action--blood">
        <span className="patient-home__action-icon">
          <Droplets size={25} aria-hidden="true" />
        </span>
        <div>
          <span className="patient-home__eyebrow">Blood Network</span>
          <h2>Nearby help, organized</h2>
          <p>Find compatible donors, request help, or support others in your community.</p>
          <Link className="patient-home__button" to="/patient/blood-network">
            <Droplets size={14} aria-hidden="true" />
            Explore Blood Network
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </article>
      <article className="patient-home__action patient-home__action--reports">
        <span className="patient-home__action-icon">
          <FileText size={25} aria-hidden="true" />
        </span>
        <div>
          <span className="patient-home__eyebrow">Medical Reports</span>
          <h2>Your health records in one place</h2>
          <p>Your test results, scans and documents stay secure and organized.</p>
          <button type="button" className="patient-home__button" onClick={onUpload}>
            <UploadCloud size={14} aria-hidden="true" />
            Upload a report
            <ArrowRight size={15} aria-hidden="true" />
          </button>
        </div>
      </article>
    </section>
  );
}

export function DashboardMetrics({
  reports,
  care,
  activity,
  profile,
}: {
  reports: PatientHomeSection<PatientDashboard>;
  care: PatientHomeSection<Appointment[]>;
  activity: PatientHomeSection<TimelineEvent[]>;
  profile: PatientHomeSection<PatientProfile>;
}) {
  return (
    <section className="patient-home__metrics" aria-label="Patient home overview">
      <Metric
        icon={FileText}
        label="Active Reports"
        value={reports.data?.activeReportCount}
        section={reports}
        detail="Stored medical reports"
        to="/patient/reports"
      />
      <Metric
        icon={CalendarDays}
        label="Upcoming Appointments"
        value={care.data?.length}
        section={care}
        detail="Scheduled care"
        to="/patient/appointments"
      />
      <Metric
        icon={Activity}
        label="Health Record Updates"
        value={activity.data ? visibleActivity(activity.data).length : undefined}
        section={activity}
        detail="Recent timeline events"
        to="/patient/history"
      />
      <Metric
        icon={HeartPulse}
        label="Health Profile"
        value={profile.data?.completenessPercent}
        section={profile}
        suffix="%"
        detail="Profile completeness"
        to="/patient/profile"
      />
    </section>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  section,
  suffix = '',
  detail,
  to,
}: {
  icon: LucideIcon;
  label: string;
  value: number | undefined;
  section: PatientHomeSection<unknown>;
  suffix?: string;
  detail: string;
  to: string;
}) {
  return (
    <Link className="patient-home__metric" to={to}>
      <span className="patient-home__metric-icon">
        <Icon size={24} aria-hidden="true" />
      </span>
      <span>
        <span className="patient-home__metric-label">{label}</span>
        <strong>
          {section.loading && value == null ? '…' : section.error || value == null ? '—' : `${value}${suffix}`}
        </strong>
        <small>{section.error ? 'Currently unavailable' : detail}</small>
      </span>
      <ArrowRight size={15} aria-hidden="true" />
    </Link>
  );
}

export function DashboardPanel({
  title,
  icon: Icon,
  copy,
  to,
  children,
  className = '',
}: {
  title: string;
  icon?: LucideIcon;
  copy?: string;
  to?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`patient-home__panel ${className}`} aria-label={title}>
      <div className="patient-home__panel-heading">
        <div>
          {Icon ? (
            <span className="patient-home__panel-icon">
              <Icon size={20} aria-hidden="true" />
            </span>
          ) : null}
          <div>
            <h2>{title}</h2>
            {copy ? <p>{copy}</p> : null}
          </div>
        </div>
        {to ? <Link to={to}>View all</Link> : null}
      </div>
      {children}
    </section>
  );
}

export function DashboardState({
  section,
  empty,
  children,
}: {
  section: PatientHomeSection<unknown>;
  empty?: string;
  children?: ReactNode;
}) {
  if (section.loading && section.data == null)
    return (
      <div className="patient-home__loading" role="status" aria-label="Loading health data">
        <span />
        <span />
      </div>
    );
  if (section.error)
    return (
      <div className="patient-home__empty">
        <p role="alert">{section.error}</p>
        <button className="patient-home__text-link" onClick={() => void section.retry()}>
          Try again
        </button>
      </div>
    );
  if (empty)
    return (
      <div className="patient-home__empty">
        <p>{empty}</p>
      </div>
    );
  return <>{children}</>;
}

export function DashboardHealthOverview({
  record,
  trends,
}: {
  record: PatientHomeSection<HealthRecord>;
  trends: PatientHomeSection<BodyMeasurementPoint[]>;
}) {
  const essentials = record.data?.clinicalEssentials;
  const count = essentials
    ? essentials.allergies.length + essentials.conditions.length + essentials.medications.length
    : null;
  return (
    <DashboardPanel
      title="Today's Health Overview"
      icon={ChartNoAxesCombined}
      copy="A quick snapshot of your saved measurements and health record."
      to="/patient/history"
      className="patient-home__overview"
    >
      <DashboardState section={record}>
        <div className="patient-home__health-grid">
          {(['heightCm', 'weightKg', 'bmi'] as const).map((metric) => (
            <Measurement
              key={metric}
              metric={metric}
              current={record.data?.currentMeasurements[metric] ?? null}
              trends={trends}
            />
          ))}
          <article className="patient-home__health-card">
            <span className="patient-home__health-icon">
              <ShieldCheck size={20} aria-hidden="true" />
            </span>
            <div className="patient-home__measurement">
              <h3>Clinical essentials</h3>
              <strong>{count ?? '—'}</strong>
              <span>{count == null ? 'Not available' : 'Recorded items'}</span>
            </div>
            <p className="patient-home__health-note">Allergies, conditions &amp; medications</p>
          </article>
        </div>
      </DashboardState>
      {trends.error ? (
        <button className="patient-home__text-link patient-home__history-retry" onClick={() => void trends.retry()}>
          Measurement history unavailable · Retry
        </button>
      ) : null}
    </DashboardPanel>
  );
}

function Measurement({
  metric,
  current,
  trends,
}: {
  metric: DashboardTrendMetric;
  current: number | null;
  trends: PatientHomeSection<BodyMeasurementPoint[]>;
}) {
  const { label, unit } = dashboardMeasurements[metric];
  const points = trends.error ? [] : (trends.data ?? []);
  const { latest, first, observations } = dashboardTrend(points, metric);
  const hasChart = observations.length >= 3 && first.timestamp !== latest?.timestamp;
  const value = latest?.value ?? current;
  const Icon = metric === 'heightCm' ? Ruler : metric === 'weightKg' ? Weight : HeartPulse;
  return (
    <article
      className={`patient-home__health-card patient-home__health-card--${metric}${hasChart ? ' patient-home__health-card--history' : ''}`}
    >
      <span className="patient-home__health-icon">
        <Icon size={20} aria-hidden="true" />
      </span>
      <div className="patient-home__measurement">
        <h3>{label}</h3>
        <strong>{value == null ? '—' : measurementValue(value)}</strong>
        <span>{value == null ? 'Not recorded' : unit}</span>
      </div>
      <div className="patient-home__measurement-history">
        {trends.loading && !trends.data ? (
          <span className="patient-home__trend-note">Loading history…</span>
        ) : trends.error ? (
          <span className="patient-home__trend-note">History unavailable</span>
        ) : (
          <DashboardSparkline points={points} metric={metric} />
        )}
      </div>
    </article>
  );
}

export function DashboardCare({
  section,
  rail = false,
}: {
  section: PatientHomeSection<Appointment[]>;
  rail?: boolean;
}) {
  const appointments = (section.data ?? [])
    .filter((item) => item.status === 'BOOKED')
    .slice()
    .sort((a, b) => Date.parse(a.scheduledStart) - Date.parse(b.scheduledStart));
  const next = appointments[0];
  return (
    <DashboardPanel
      title={rail ? 'Next Appointment' : 'Upcoming Care'}
      icon={rail ? undefined : CalendarDays}
      copy={rail ? undefined : 'Your scheduled appointments and care.'}
      to="/patient/appointments"
      className={rail ? 'patient-home__next' : 'patient-home__care'}
    >
      <DashboardState section={section}>
        {!next ? (
          <div className="patient-home__empty">
            <span className="patient-home__empty-icon">
              <CalendarDays size={23} aria-hidden="true" />
            </span>
            <strong>No appointments scheduled</strong>
            <p>Find a Clinora Doctor when you&apos;re ready for your next visit.</p>
            <Link
              className={rail ? 'patient-home__button patient-home__button--primary' : 'patient-home__text-link'}
              to="/patient/doctors"
            >
              Find a Doctor
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
        ) : rail ? (
          <>
            <div className="patient-home__doctor">
              <ProfileAvatar source={{ kind: 'patient-doctor', doctorId: next.doctorId }} name={next.doctorName} />
              <div>
                <strong>{doctorName(next.doctorName)}</strong>
                <span>{next.specialization}</span>
              </div>
            </div>
            <div className="patient-home__appointment-date">
              <CalendarDays size={16} aria-hidden="true" />
              <time dateTime={next.scheduledStart}>
                {appointmentDate(next, { month: 'short', day: 'numeric', year: 'numeric' })}
              </time>
            </div>
            <div className="patient-home__appointment-date">
              <Clock3 size={16} aria-hidden="true" />
              <span>{appointmentTime(next)}</span>
            </div>
            <Link
              className="patient-home__button patient-home__button--primary"
              to={`/patient/appointments/${next.id}`}
            >
              View appointment
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </>
        ) : (
          <ol className="patient-home__care-list">
            {appointments.slice(0, 2).map((appointment) => (
              <li key={appointment.id}>
                <Link to={`/patient/appointments/${appointment.id}`}>
                  <time className="patient-home__date-tile" dateTime={appointment.scheduledStart}>
                    <span>{appointmentDate(appointment, { month: 'short' })}</span>
                    <strong>{appointmentDate(appointment, { day: 'numeric' })}</strong>
                  </time>
                  <div>
                    <span>{appointmentTime(appointment)}</span>
                    <strong>{appointment.reasonForVisit || 'Consultation'}</strong>
                    <span>{doctorName(appointment.doctorName)}</span>
                  </div>
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ol>
        )}
      </DashboardState>
    </DashboardPanel>
  );
}

export function DashboardActivity({ section }: { section: PatientHomeSection<TimelineEvent[]> }) {
  const events = visibleActivity(section.data ?? []).slice(0, 4);
  return (
    <DashboardPanel
      title="Recent Health Activity"
      icon={Clock3}
      copy="Your latest updates across connected care."
      to="/patient/timeline"
      className="patient-home__activity"
    >
      <DashboardState
        section={section}
        empty={events.length ? undefined : 'Your recent health activity will appear here as your record grows.'}
      >
        <ol className="patient-home__activity-list">
          {events.map((event) => {
            const Icon =
              event.category === 'REPORTS'
                ? FileText
                : event.category === 'APPOINTMENTS'
                  ? CalendarDays
                  : event.category === 'PROFILE'
                    ? UserRound
                    : HeartPulse;
            const analysis =
              event.sourceId &&
              ['REPORT_EXTRACTION_COMPLETED', 'REPORT_EXTRACTION_READY', 'REPORT_EXTRACTION_REVIEW_REQUIRED'].includes(
                event.eventType,
              );
            return (
              <li key={event.id}>
                <span className="patient-home__activity-icon">
                  <Icon size={18} aria-hidden="true" />
                </span>
                <div>
                  <strong>{event.title}</strong>
                  {event.detail ? (
                    <span>
                      {event.sourceType === 'MEDICAL_REPORT' && /^[a-f0-9-]{24,}$/i.test(event.detail)
                        ? 'Medical report'
                        : event.detail}
                    </span>
                  ) : null}
                  {analysis ? (
                    <Link to={`/patient/analyze/${event.sourceId}`}>
                      Open analysis
                      <ArrowRight size={12} aria-hidden="true" />
                    </Link>
                  ) : null}
                </div>
                <time dateTime={event.occurredAt}>
                  {new Date(event.occurredAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </time>
              </li>
            );
          })}
        </ol>
      </DashboardState>
    </DashboardPanel>
  );
}

export function DashboardQuickActions({ onUpload }: { onUpload: () => void }) {
  return (
    <DashboardPanel title="Quick Actions" className="patient-home__quick">
      <div className="patient-home__quick-grid">
        <Link to="/patient/analyze">
          <span>
            <ScanText size={23} aria-hidden="true" />
          </span>
          Analyze
          <br />
          Report
        </Link>
        <Link to="/patient/doctors">
          <span>
            <Stethoscope size={23} aria-hidden="true" />
          </span>
          Find a<br />
          Doctor
        </Link>
        <button onClick={onUpload}>
          <span>
            <UploadCloud size={23} aria-hidden="true" />
          </span>
          Upload
          <br />
          Report
        </button>
        <Link to="/patient/appointments">
          <span>
            <CalendarDays size={23} aria-hidden="true" />
          </span>
          Book
          <br />
          Appointment
        </Link>
      </div>
    </DashboardPanel>
  );
}

export function DashboardInsights({
  trends,
  record,
}: {
  trends: PatientHomeSection<BodyMeasurementPoint[]>;
  record: PatientHomeSection<HealthRecord>;
}) {
  return (
    <DashboardPanel title="Health Insights" to="/patient/history" className="patient-home__insights">
      <DashboardState section={record}>
        <div className="patient-home__insight-baseline">
          <span className="patient-home__panel-icon">
            <HeartPulse size={23} aria-hidden="true" />
          </span>
          <div>
            <strong>Your measurement baseline</strong>
            {(['weightKg', 'bmi'] as const).map((metric) => {
              const trend = dashboardTrend(trends.error ? [] : (trends.data ?? []), metric);
              const { label, unit } = dashboardMeasurements[metric];
              const value = trend.latest?.value ?? record.data?.currentMeasurements[metric];
              return (
                <p key={metric}>
                  {label}: {value == null ? 'not recorded' : `${measurementValue(value)} ${unit}`}
                  {trend.change != null ? (
                    <span>
                      {measurementChange(trend.change, unit)} across {trend.observations.length} observations
                    </span>
                  ) : null}
                </p>
              );
            })}
            <Link to="/patient/profile?section=basic">
              Review measurements
              <ArrowRight size={12} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </DashboardState>
    </DashboardPanel>
  );
}

export function DashboardPrivacy({ section }: { section: PatientHomeSection<PatientPortalSummary> }) {
  const shares = section.data?.care.activeReportShareCount;
  const doctors = section.data?.care.doctorCount;
  return (
    <section className="patient-home__panel patient-home__privacy" aria-label="Privacy & Sharing">
      <span className="patient-home__panel-icon">
        <LockKeyhole size={22} aria-hidden="true" />
      </span>
      <div>
        <h2>Privacy &amp; Sharing</h2>
        <DashboardState section={section}>
          <p>
            {shares == null
              ? 'Sharing status is unavailable.'
              : shares > 0
                ? `${shares} report${shares === 1 ? '' : 's'} shared with ${doctors} Clinora Doctor${doctors === 1 ? '' : 's'}.`
                : 'Your health data stays private and secure, shared only through your authorized care network.'}
          </p>
        </DashboardState>
        {shares != null && shares > 0 ? (
          <Link className="patient-home__text-link" to="/patient/appointments">
            Manage sharing
            <ArrowRight size={12} aria-hidden="true" />
          </Link>
        ) : null}
      </div>
    </section>
  );
}

function visibleActivity(events: TimelineEvent[]) {
  return events
    .filter(
      (event) =>
        !['REPORT_EXTRACTION_REQUESTED', 'REPORT_EXTRACTION_QUEUED', 'REPORT_EXTRACTION_PROCESSING'].includes(
          event.eventType,
        ),
    )
    .slice()
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
}
function doctorName(name: string) {
  return /^dr\.?\s/i.test(name) ? name : `Dr. ${name}`;
}
function appointmentDate(appointment: Appointment, options: Intl.DateTimeFormatOptions) {
  return new Date(appointment.scheduledStart).toLocaleDateString(undefined, {
    ...options,
    timeZone: appointment.bookingTimezone,
  });
}
function appointmentTime(appointment: Appointment) {
  const options: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: appointment.bookingTimezone,
  };
  return `${new Date(appointment.scheduledStart).toLocaleTimeString(undefined, options)} – ${new Date(appointment.scheduledEnd).toLocaleTimeString(undefined, options)}`;
}
