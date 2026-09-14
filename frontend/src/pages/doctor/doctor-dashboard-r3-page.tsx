import {
  ArrowRight,
  CalendarClock,
  CalendarDays,
  ChevronRight,
  Clock3,
  FileText,
  Settings2,
  Stethoscope,
  UserRoundCheck,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { StatusPill } from '../../components/app/app-ui';
import { Skeleton } from '../../components/ui/feedback';
import {
  doctorApi,
  doctorError,
  type DoctorAppointmentSummary,
  type DoctorDashboard,
} from '../../features/doctor/doctor-api';
import { doctorStatusLabel, doctorStatusTone } from '../../features/doctor/doctor-display';
import { ProfileAvatar } from '../../features/profile/profile-image';

const DOCTOR_DASHBOARD_VIDEO = '/assets/biomedical/clinora-doctor-dashboard-cinematic.mp4';
const DOCTOR_DASHBOARD_POSTER = '/assets/biomedical/clinora-doctor-dashboard-cinematic-poster.webp';

export function DoctorDashboardPage() {
  const [data, setData] = useState<DoctorDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [videoFailed, setVideoFailed] = useState(false);
  const now = new Date();

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
      <section className="clinora-r5-alert" aria-label="Doctor workspace unavailable">
        <p role="alert">{error || 'The workspace is unavailable.'}</p>
        <button type="button" onClick={() => void load()}>
          Try again
        </button>
      </section>
    );
  }

  const next = data.nextAppointment;
  const activeAppointment = next ? isHappeningNow(next) : false;
  const missing = data.profileMissingItems ?? [];

  return (
    <div className="clinora-r5-dashboard clinora-r51-dashboard clinora-r5-doctor-dashboard">
      <div className="clinora-r51-topbar" aria-label="Doctor dashboard context">
        <span className="clinora-r51-topbar-label">Clinical workspace</span>
        <span className="clinora-r51-topbar-time">
          <Clock3 size={14} aria-hidden="true" />
          {formatTopbarDate(now)}
        </span>
      </div>

      <section className="clinora-r51-doctor-hero" aria-labelledby="doctor-dashboard-title">
        {!videoFailed ? (
          <video
            className="clinora-r51-doctor-hero-media"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster={DOCTOR_DASHBOARD_POSTER}
            tabIndex={-1}
            disablePictureInPicture
            aria-hidden="true"
            onError={() => setVideoFailed(true)}
          >
            <source src={DOCTOR_DASHBOARD_VIDEO} type="video/mp4" />
          </video>
        ) : (
          <img
            src={DOCTOR_DASHBOARD_POSTER}
            alt=""
            aria-hidden="true"
            className="clinora-r51-doctor-hero-media"
            draggable={false}
          />
        )}
        <div className="clinora-r51-doctor-hero-scrim" aria-hidden="true" />

        <div className="clinora-r51-doctor-hero-copy">
          <span className="clinora-r51-greeting">{greetingForTime(now)},</span>
          <div className="clinora-r51-doctor-name-row">
            <h1
              id="doctor-dashboard-title"
              aria-label={`Good to see you, ${data.doctor.displayName.replace(/^Dr\.\s+/i, '')}`}
            >
              {data.doctor.displayName}
            </h1>
            <span className="clinora-r5-verified">Verified Doctor</span>
          </div>
          <p className="clinora-r51-doctor-meta">
            {[data.doctor.specialization, data.doctor.currentPosition, data.doctor.currentOrganization]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <p className="clinora-r51-hero-quote">Better care today. Healthier tomorrows.</p>
        </div>

        <div className="clinora-r51-doctor-hero-action">
          <Link to="/doctor/schedule?scope=today" className="clinora-r5-secondary-action">
            <CalendarDays size={16} aria-hidden="true" /> Full schedule
          </Link>
        </div>
      </section>

      <section className="clinora-r5-metric-grid clinora-r51-metric-grid" aria-label="Doctor workspace overview">
        <MetricTile
          icon={<CalendarDays size={20} aria-hidden="true" />}
          label="Today's appointments"
          value={String(data.todayCount)}
          detail={`${data.today.length} visible today`}
          href="/doctor/schedule?scope=today"
        />
        <MetricTile
          icon={<Stethoscope size={20} aria-hidden="true" />}
          label="Upcoming care"
          value={String(data.upcomingCount)}
          detail="Booked appointments"
          href="/doctor/schedule?scope=upcoming"
        />
        <MetricTile
          icon={<FileText size={20} aria-hidden="true" />}
          label="Shared reports"
          value={String(data.sharedReportsForUpcomingCare)}
          detail="Shared for upcoming care"
          href="/doctor/schedule?scope=upcoming"
        />
        <MetricTile
          icon={<CalendarClock size={20} aria-hidden="true" />}
          label="Next available"
          value={data.nextAvailableAt ? formatCompactTime(data.nextAvailableAt) : '—'}
          detail={
            data.nextAvailableAt
              ? formatCompactDay(data.nextAvailableAt)
              : `${data.availableSlotCount} open booking times`
          }
          href="/doctor/availability"
        />
      </section>

      <div className="clinora-r5-workspace-grid clinora-r51-workspace-grid">
        <section className="clinora-r5-schedule-panel clinora-r51-schedule-panel" aria-labelledby="doctor-today-title">
          <div className="clinora-r5-panel-heading clinora-r51-panel-heading">
            <div className="clinora-r5-panel-heading-copy">
              <span className="clinora-r5-panel-icon">
                <CalendarDays size={18} aria-hidden="true" />
              </span>
              <div>
                <h2 id="doctor-today-title">Today's Schedule</h2>
                <p>Appointments and booking windows from your Clinora schedule.</p>
              </div>
            </div>
            <div className="clinora-r5-toolbar">
              <Link className="is-active" to="/doctor/schedule?scope=today">
                Day
              </Link>
              <Link to="/doctor/schedule?scope=upcoming">Upcoming</Link>
              <Link className="clinora-r5-add-action" to="/doctor/availability">
                + Add
              </Link>
            </div>
          </div>

          <DoctorTimeline appointments={data.today} />
        </section>

        <aside className="clinora-r5-side-rail clinora-r51-side-rail" aria-label="Doctor dashboard actions">
          <section className="clinora-r5-rail-card clinora-r51-next-card" aria-labelledby="next-patient-title">
            <div className="clinora-r5-rail-heading">
              <h2 id="next-patient-title">Next Patient</h2>
              <Link to="/doctor/schedule?scope=upcoming">View all</Link>
            </div>
            {next ? (
              <>
                <div className="clinora-r5-next-patient">
                  <ProfileAvatar
                    source={{ kind: 'doctor-patient', appointmentId: next.id }}
                    name={next.patientName}
                    size="md"
                    className="rounded-full"
                  />
                  <div className="min-w-0">
                    <div className="clinora-r5-next-patient-name-row">
                      <h3>{next.patientName}</h3>
                      <StatusPill tone={activeAppointment ? 'success' : doctorStatusTone(next.status)}>
                        {activeAppointment ? 'Current' : doctorStatusLabel(next.status)}
                      </StatusPill>
                    </div>
                    <p>{next.reason || 'Consultation'}</p>
                  </div>
                </div>
                <dl className="clinora-r5-patient-meta">
                  <div>
                    <dt>Date</dt>
                    <dd>{formatCompactDay(next.scheduledStart, next.timezone)}</dd>
                  </div>
                  <div>
                    <dt>Time</dt>
                    <dd>{formatAppointmentTime(next)}</dd>
                  </div>
                  <div>
                    <dt>Shared reports</dt>
                    <dd>{next.sharedReportCount}</dd>
                  </div>
                </dl>
                <Link className="clinora-r5-primary-action" to={`/doctor/appointments/${next.id}`}>
                  View Patient details <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </>
            ) : (
              <div className="clinora-r5-empty-rail">
                <Stethoscope size={20} aria-hidden="true" />
                <strong>No upcoming Patient</strong>
                <span>New bookings will appear here automatically.</span>
                <Link to="/doctor/availability">Review availability</Link>
              </div>
            )}
          </section>

          <section className="clinora-r5-rail-card" aria-labelledby="quick-actions-title">
            <div className="clinora-r5-rail-heading">
              <h2 id="quick-actions-title">Quick Actions</h2>
            </div>
            <div className="clinora-r5-quick-grid">
              <QuickLink
                to="/doctor/availability"
                icon={<CalendarClock size={18} aria-hidden="true" />}
                label="Availability"
              />
              <QuickLink to="/doctor/schedule" icon={<CalendarDays size={18} aria-hidden="true" />} label="Schedule" />
              <QuickLink to="/doctor/profile" icon={<UserRoundCheck size={18} aria-hidden="true" />} label="Profile" />
              <QuickLink to="/account" icon={<Settings2 size={18} aria-hidden="true" />} label="Security" />
            </div>
          </section>

          <section className="clinora-r5-rail-card" aria-labelledby="practice-status-title">
            <div className="clinora-r5-rail-heading">
              <h2 id="practice-status-title">Professional Setup</h2>
              <Link to="/doctor/profile">Review</Link>
            </div>
            <div className="clinora-r5-progress-row">
              <strong>{data.profileCompletion}%</strong>
              <span>profile complete</span>
            </div>
            <div
              className="clinora-r5-progress-track"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={data.profileCompletion}
            >
              <span style={{ width: `${data.profileCompletion}%` }} />
            </div>
            {missing.length ? (
              <p className="clinora-r5-rail-note">Next: {missing[0]?.label}</p>
            ) : (
              <p className="clinora-r5-rail-note is-complete">Professional setup complete.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function MetricTile({
  icon,
  label,
  value,
  detail,
  href,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  href: string;
}) {
  return (
    <Link className="clinora-r5-metric-tile" to={href}>
      <span className="clinora-r5-metric-icon">{icon}</span>
      <span className="clinora-r5-metric-copy">
        <span className="clinora-r5-metric-label">{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </span>
      <ChevronRight size={16} className="clinora-r5-metric-arrow" aria-hidden="true" />
    </Link>
  );
}

function QuickLink({ to, icon, label }: { to: string; icon: ReactNode; label: string }) {
  return (
    <Link to={to} className="clinora-r5-quick-link">
      <span>{icon}</span>
      <small>{label}</small>
    </Link>
  );
}

function DoctorTimeline({ appointments }: { appointments: DoctorAppointmentSummary[] }) {
  const sorted = useMemo(
    () => [...appointments].sort((a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime()),
    [appointments],
  );

  const hours = Array.from({ length: 9 }, (_, index) => index + 8);
  const startHour = 8;
  const endHour = 17;
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const markerVisible = nowMinutes >= startHour * 60 && nowMinutes <= endHour * 60;
  const markerTop = ((nowMinutes - startHour * 60) / ((endHour - startHour) * 60)) * 100;

  return (
    <div className="clinora-r5-timeline" aria-label="Today's schedule timeline">
      <div className="clinora-r5-time-axis" aria-hidden="true">
        {hours.map((hour) => (
          <span key={hour}>{String(hour).padStart(2, '0')}:00</span>
        ))}
      </div>
      <div className="clinora-r5-timeline-body">
        {hours.map((hour) => (
          <div key={hour} className="clinora-r5-gridline" />
        ))}
        {markerVisible ? (
          <div className="clinora-r5-now" style={{ top: `${markerTop}%` }} aria-hidden="true">
            <span /> <b>Now · {now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</b>
          </div>
        ) : null}
        {sorted.map((appointment) => {
          const start = new Date(appointment.scheduledStart);
          const end = new Date(appointment.scheduledEnd);
          const startMinutes = start.getHours() * 60 + start.getMinutes();
          const duration = Math.max(30, (end.getTime() - start.getTime()) / 60_000);
          const top = Math.max(
            0,
            Math.min(100, ((startMinutes - startHour * 60) / ((endHour - startHour) * 60)) * 100),
          );
          const height = Math.max(7.5, Math.min(18, (duration / ((endHour - startHour) * 60)) * 100));
          return (
            <Link
              key={appointment.id}
              to={`/doctor/appointments/${appointment.id}`}
              className="clinora-r5-timeline-appointment"
              style={{ top: `${top}%`, minHeight: `${height}%` }}
            >
              <ProfileAvatar
                source={{ kind: 'doctor-patient', appointmentId: appointment.id }}
                name={appointment.patientName}
                size="sm"
                className="rounded-full"
              />
              <span className="min-w-0 flex-1">
                <strong>{appointment.patientName}</strong>
                <small>{appointment.reason || 'Consultation'}</small>
              </span>
              <span className="clinora-r5-appointment-time">{formatAppointmentTime(appointment)}</span>
              {appointment.sharedReportCount > 0 ? (
                <span className="clinora-r5-report-count">
                  <FileText size={12} aria-hidden="true" /> {appointment.sharedReportCount}
                </span>
              ) : null}
            </Link>
          );
        })}
        {sorted.length === 0 ? (
          <div className="clinora-r5-timeline-empty clinora-r52-timeline-empty">
            <span className="clinora-r52-timeline-empty-icon">
              <CalendarDays size={20} aria-hidden="true" />
            </span>
            <strong>No appointments booked today</strong>
            <span>Your schedule remains visible so the day is still useful at a glance.</span>
            <Link className="clinora-r52-timeline-empty-action" to="/doctor/availability">
              Manage availability <ArrowRight size={13} aria-hidden="true" />
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5" role="status" aria-label="Loading Doctor workspace">
      <Skeleton className="h-64 rounded-[22px]" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Skeleton className="h-28 rounded-[18px]" />
        <Skeleton className="h-28 rounded-[18px]" />
        <Skeleton className="h-28 rounded-[18px]" />
        <Skeleton className="h-28 rounded-[18px]" />
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Skeleton className="h-[38rem] rounded-[20px]" />
        <Skeleton className="h-[28rem] rounded-[20px]" />
      </div>
    </div>
  );
}

function isHappeningNow(appointment: DoctorAppointmentSummary) {
  const current = Date.now();
  return (
    new Date(appointment.scheduledStart).getTime() <= current && new Date(appointment.scheduledEnd).getTime() >= current
  );
}

function greetingForTime(value: Date) {
  const hour = value.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatAppointmentTime(
  appointment: Pick<DoctorAppointmentSummary, 'scheduledStart' | 'scheduledEnd' | 'timezone'>,
) {
  return `${formatTime(appointment.scheduledStart, appointment.timezone)}–${formatTime(appointment.scheduledEnd, appointment.timezone)}`;
}

function formatTime(value: string, timezone?: string | null) {
  return new Date(value).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone || undefined,
  });
}

function formatCompactTime(value: string) {
  return new Date(value).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function formatCompactDay(value: string, timezone?: string | null) {
  return new Date(value).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: timezone || undefined,
  });
}

function formatTopbarDate(value: Date) {
  return `${value.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} · ${value.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
}
