import {
  Activity,
  ArrowRight,
  CalendarDays,
  FileText,
  HeartPulse,
  Ruler,
  ScanText,
  ShieldCheck,
  Stethoscope,
  UploadCloud,
  Weight,
} from 'lucide-react';
import { useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { Link } from 'react-router';
import { appointmentApi, type Appointment } from '../../features/appointments/appointment-api';
import { useAuthStore } from '../../features/auth/auth-store';
import { PatientCoreExperience } from '../../features/patient/patient-core-experience';
import {
  HealthInsights,
  PatientHomeCanvas,
  PatientHomeHeader,
  PrivacySharingSummary,
  RecentHealthActivity,
  UpcomingCare,
  type PatientHomeSection,
} from '../../features/patient/patient-home';
import { patientApi, patientErrorMessage } from '../../features/patient/patient-api';
import { patientPortalApi, type PatientPortalSummary } from '../../features/patient/patient-portal-api';
import type { PatientDashboard, PatientProfile } from '../../features/patient/patient-types';
import {
  patientRecordApi,
  type HealthRecord,
  type TimelineEvent,
} from '../../features/patient-record/patient-record-api';
import { PatientReportUploadDialog } from '../../features/patient-reports/patient-report-upload-dialog';
import type { PatientReport } from '../../features/patient-reports/patient-report-types';

type HomeDomain = 'reports' | 'profile' | 'care' | 'activity' | 'record' | 'sharing';

const initialLoading: Record<HomeDomain, boolean> = {
  reports: true,
  profile: true,
  care: true,
  activity: true,
  record: true,
  sharing: true,
};

const initialErrors: Record<HomeDomain, string> = {
  reports: '',
  profile: '',
  care: '',
  activity: '',
  record: '',
  sharing: '',
};

export function PatientPortalPage() {
  const user = useAuthStore((state) => state.user);
  const reducedMotion = useReducedMotion();
  const [dashboard, setDashboard] = useState<PatientDashboard | null>(null);
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const [activity, setActivity] = useState<TimelineEvent[] | null>(null);
  const [record, setRecord] = useState<HealthRecord | null>(null);
  const [sharing, setSharing] = useState<PatientPortalSummary | null>(null);
  const [loading, setLoading] = useState(initialLoading);
  const [errors, setErrors] = useState(initialErrors);
  const [uploadOpen, setUploadOpen] = useState(false);

  const loadReports = useHomeLoader(
    'reports',
    setLoading,
    setErrors,
    async () => setDashboard(await patientApi.dashboard()),
    'Medical reports could not be refreshed.',
  );
  const loadProfile = useHomeLoader(
    'profile',
    setLoading,
    setErrors,
    async () => setProfile(await patientApi.profile()),
    'Your Health Profile could not be refreshed.',
  );
  const loadCare = useHomeLoader(
    'care',
    setLoading,
    setErrors,
    async () => setAppointments(await appointmentApi.list('UPCOMING')),
    "We couldn't refresh your appointments.",
  );
  const loadActivity = useHomeLoader(
    'activity',
    setLoading,
    setErrors,
    async () => setActivity((await patientRecordApi.timeline({ limit: 6 })).items),
    'Recent health activity could not be refreshed.',
  );
  const loadRecord = useHomeLoader(
    'record',
    setLoading,
    setErrors,
    async () => setRecord(await patientRecordApi.history()),
    'Your Health Record snapshot could not be refreshed.',
  );
  const loadSharing = useHomeLoader(
    'sharing',
    setLoading,
    setErrors,
    async () => setSharing(await patientPortalApi.summary()),
    'Sharing status could not be refreshed.',
  );

  useEffect(() => {
    void loadReports();
    void loadProfile();
    void loadCare();
    void loadActivity();
    void loadRecord();
    void loadSharing();
  }, [loadActivity, loadCare, loadProfile, loadRecord, loadReports, loadSharing]);

  const nextAppointment = appointments?.length ? appointments.slice(0, 1) : appointments;

  return (
    <div className="clinora-r5-dashboard clinora-r51-dashboard clinora-r5-patient-dashboard">
      <PatientHomeCanvas>
        <PatientHomeHeader
          firstName={dashboard?.firstName || profile?.firstName || user?.firstName || 'there'}
          verified={Boolean(user?.emailVerified)}
          reducedMotion={Boolean(reducedMotion)}
        />

        <div className="clinora-r51-patient-stack">
          <PatientCoreExperience
            reports={section(dashboard, loading.reports, errors.reports, loadReports)}
            reducedMotion={Boolean(reducedMotion)}
            onUpload={() => setUploadOpen(true)}
          />

          <section className="clinora-r5-metric-grid clinora-r51-metric-grid" aria-label="Patient home overview">
            <PatientMetric
              icon={<FileText size={20} aria-hidden="true" />}
              label="Active reports"
              value={loading.reports ? '…' : String(dashboard?.activeReportCount ?? 0)}
              detail="Stored medical reports"
              to="/patient/reports"
            />
            <PatientMetric
              icon={<CalendarDays size={20} aria-hidden="true" />}
              label="Upcoming appointments"
              value={loading.care ? '…' : String(appointments?.length ?? 0)}
              detail="Scheduled care"
              to="/patient/appointments"
            />
            <PatientMetric
              icon={<Activity size={20} aria-hidden="true" />}
              label="Health record updates"
              value={loading.activity ? '…' : String(activity?.length ?? 0)}
              detail="Recent timeline events"
              to="/patient/history"
            />
            <PatientMetric
              icon={<HeartPulse size={20} aria-hidden="true" />}
              label="Health profile"
              value={loading.profile ? '…' : `${profile?.completenessPercent ?? 0}%`}
              detail="Profile completeness"
              to="/patient/profile"
            />
          </section>

          <div className="clinora-r5-patient-workspace-grid clinora-r51-patient-workspace-grid">
            <main className="clinora-r5-patient-main">
              <section
                className="clinora-r5-patient-panel clinora-r51-health-overview"
                aria-labelledby="patient-health-overview-title"
              >
                <div className="clinora-r5-panel-heading clinora-r51-panel-heading">
                  <div className="clinora-r5-panel-heading-copy">
                    <span className="clinora-r5-panel-icon">
                      <HeartPulse size={18} aria-hidden="true" />
                    </span>
                    <div>
                      <h2 id="patient-health-overview-title">Today's Health Overview</h2>
                      <p>A quick snapshot from health data already stored in Clinora.</p>
                    </div>
                  </div>
                  <Link to="/patient/history">View health record</Link>
                </div>
                <HealthOverview
                  profile={section(profile, loading.profile, errors.profile, loadProfile)}
                  record={section(record, loading.record, errors.record, loadRecord)}
                />
              </section>

              <div className="clinora-r5-patient-lower-grid clinora-r51-patient-lower-grid">
                <section className="clinora-r5-patient-panel" aria-labelledby="patient-upcoming-title">
                  <div className="clinora-r5-panel-heading compact">
                    <div className="clinora-r5-panel-heading-copy">
                      <span className="clinora-r5-panel-icon">
                        <CalendarDays size={18} aria-hidden="true" />
                      </span>
                      <div>
                        <h2 id="patient-upcoming-title">Upcoming Care</h2>
                        <p>Your scheduled consultations.</p>
                      </div>
                    </div>
                    <Link to="/patient/appointments">View all</Link>
                  </div>
                  <UpcomingCare section={section(appointments, loading.care, errors.care, loadCare)} />
                </section>

                <section className="clinora-r5-patient-panel" aria-labelledby="patient-activity-title">
                  <div className="clinora-r5-panel-heading compact">
                    <div className="clinora-r5-panel-heading-copy">
                      <span className="clinora-r5-panel-icon">
                        <Activity size={18} aria-hidden="true" />
                      </span>
                      <div>
                        <h2 id="patient-activity-title">Recent Health Activity</h2>
                        <p>Meaningful changes across your record.</p>
                      </div>
                    </div>
                    <Link to="/patient/history">View timeline</Link>
                  </div>
                  <RecentHealthActivity section={section(activity, loading.activity, errors.activity, loadActivity)} />
                </section>
              </div>
            </main>

            <aside className="clinora-r5-side-rail clinora-r51-side-rail" aria-label="Patient dashboard actions">
              <section
                className="clinora-r5-rail-card clinora-r51-next-appointment"
                aria-labelledby="patient-next-appointment-title"
              >
                <div className="clinora-r5-rail-heading">
                  <h2 id="patient-next-appointment-title">Next Appointment</h2>
                  <Link to="/patient/appointments">View all</Link>
                </div>
                <div className="clinora-r51-next-appointment-body">
                  <UpcomingCare
                    section={section(nextAppointment, loading.care, errors.care, loadCare)}
                    className="clinora-r51-upcoming-rail-content"
                  />
                </div>
              </section>

              <section className="clinora-r5-rail-card" aria-labelledby="patient-actions-title">
                <div className="clinora-r5-rail-heading">
                  <h2 id="patient-actions-title">Quick Actions</h2>
                </div>
                <div className="clinora-r5-quick-grid">
                  <QuickLink
                    to="/patient/analyze"
                    icon={<ScanText size={18} aria-hidden="true" />}
                    label="Analyze report"
                  />
                  <QuickLink
                    to="/patient/doctors"
                    icon={<Stethoscope size={18} aria-hidden="true" />}
                    label="Find a Doctor"
                  />
                  <button type="button" className="clinora-r5-quick-link" onClick={() => setUploadOpen(true)}>
                    <span>
                      <UploadCloud size={18} aria-hidden="true" />
                    </span>
                    <small>Upload report</small>
                  </button>
                  <QuickLink
                    to="/patient/appointments"
                    icon={<CalendarDays size={18} aria-hidden="true" />}
                    label="Appointments"
                  />
                </div>
              </section>

              <section className="clinora-r5-rail-card" aria-labelledby="patient-insights-title">
                <div className="clinora-r5-rail-heading">
                  <h2 id="patient-insights-title">Health Insights</h2>
                  <Link to="/patient/profile">View</Link>
                </div>
                <HealthInsights section={section(profile, loading.profile, errors.profile, loadProfile)} />
              </section>

              <section className="clinora-r5-rail-card" aria-labelledby="patient-privacy-title">
                <div className="clinora-r5-rail-heading">
                  <h2 id="patient-privacy-title">Privacy & Sharing</h2>
                </div>
                <PrivacySharingSummary section={section(sharing, loading.sharing, errors.sharing, loadSharing)} />
              </section>
            </aside>
          </div>
        </div>

        <PatientReportUploadDialog
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          onUploaded={(report: PatientReport) => {
            setDashboard((current) =>
              current
                ? {
                    ...current,
                    activeReportCount: current.activeReportCount + 1,
                    latestReport: {
                      id: report.id,
                      reportName: report.reportName,
                      reportType: report.reportType,
                      reportDate: report.reportDate,
                      providerLaboratory: report.providerLaboratory,
                      uploadedAt: report.createdAt,
                    },
                  }
                : current,
            );
            void loadRecord();
          }}
        />
      </PatientHomeCanvas>
    </div>
  );
}

function PatientMetric({
  icon,
  label,
  value,
  detail,
  to,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  to: string;
}) {
  return (
    <Link className="clinora-r5-metric-tile" to={to}>
      <span className="clinora-r5-metric-icon">{icon}</span>
      <span className="clinora-r5-metric-copy">
        <span className="clinora-r5-metric-label">{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </span>
      <ArrowRight size={15} className="clinora-r5-metric-arrow" aria-hidden="true" />
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

function HealthOverview({
  profile,
  record,
}: {
  profile: PatientHomeSection<PatientProfile>;
  record: PatientHomeSection<HealthRecord>;
}) {
  if (profile.loading || record.loading)
    return (
      <div className="clinora-r51-health-loading">
        <CompactLoading />
      </div>
    );
  if (profile.error && record.error)
    return <CompactError message="Your current health overview could not be loaded." retry={record.retry} />;

  const measurement = record.data?.currentMeasurements;
  const clinicalEssentials = record.data
    ? record.data.clinicalEssentials.allergies.length +
      record.data.clinicalEssentials.conditions.length +
      record.data.clinicalEssentials.medications.length
    : null;

  return (
    <div className="clinora-r51-health-stat-grid">
      <HealthStat
        icon={<Ruler size={18} aria-hidden="true" />}
        label="Height"
        value={measurement?.heightCm != null ? `${measurement.heightCm}` : '—'}
        unit={measurement?.heightCm != null ? 'cm' : 'Not recorded'}
      />
      <HealthStat
        icon={<Weight size={18} aria-hidden="true" />}
        label="Weight"
        value={measurement?.weightKg != null ? `${measurement.weightKg}` : '—'}
        unit={measurement?.weightKg != null ? 'kg' : 'Not recorded'}
      />
      <HealthStat
        icon={<HeartPulse size={18} aria-hidden="true" />}
        label="BMI"
        value={measurement?.bmi != null ? measurement.bmi.toFixed(1) : '—'}
        unit={measurement?.bmi != null ? 'Current baseline' : 'Not recorded'}
      />
      <HealthStat
        icon={<ShieldCheck size={18} aria-hidden="true" />}
        label="Clinical essentials"
        value={clinicalEssentials != null ? String(clinicalEssentials) : '—'}
        unit={clinicalEssentials != null ? 'Recorded items' : 'Not available'}
      />
      {profile.data ? (
        <div className="clinora-r51-health-profile-strip">
          <span>Health Profile</span>
          <strong>{profile.data.completenessPercent}% complete</strong>
          <Link to="/patient/profile">
            Review <ArrowRight size={12} aria-hidden="true" />
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function HealthStat({ icon, label, value, unit }: { icon: ReactNode; label: string; value: string; unit: string }) {
  return (
    <div className="clinora-r51-health-stat">
      <span className="clinora-r51-health-stat-icon">{icon}</span>
      <span className="clinora-r51-health-stat-copy">
        <small>{label}</small>
        <strong>{value}</strong>
        <em>{unit}</em>
      </span>
    </div>
  );
}

function CompactLoading() {
  return <div className="clinora-r5-compact-loading" role="status" aria-label="Loading health data" />;
}

function CompactError({ message, retry }: { message: string; retry: () => Promise<void> }) {
  return (
    <div className="clinora-r5-compact-error">
      <p role="alert">{message}</p>
      <button type="button" onClick={() => void retry()}>
        Try again
      </button>
    </div>
  );
}

function useHomeLoader(
  domain: HomeDomain,
  setLoading: Dispatch<SetStateAction<Record<HomeDomain, boolean>>>,
  setErrors: Dispatch<SetStateAction<Record<HomeDomain, string>>>,
  request: () => Promise<void>,
  fallback: string,
) {
  const requestRef = useRef(request);
  requestRef.current = request;
  return useCallback(async () => {
    setLoading((current) => ({ ...current, [domain]: true }));
    setErrors((current) => ({ ...current, [domain]: '' }));
    try {
      await requestRef.current();
    } catch (requestError) {
      setErrors((current) => ({ ...current, [domain]: patientErrorMessage(requestError, fallback) }));
    } finally {
      setLoading((current) => ({ ...current, [domain]: false }));
    }
  }, [domain, fallback, setErrors, setLoading]);
}

function section<T>(
  data: T | null,
  loading: boolean,
  error: string,
  retry: () => Promise<void>,
): PatientHomeSection<T> {
  return { data, loading, error, retry };
}
