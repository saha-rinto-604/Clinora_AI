import { Activity, ArrowRight, FileText, HeartPulse, ShieldCheck, UserRound } from 'lucide-react';
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
import { bloodGroupLabels, type PatientDashboard, type PatientProfile } from '../../features/patient/patient-types';
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

  return (
    <div className="clinora-r3-patient">
      <PatientHomeCanvas>
        <PatientHomeHeader
          firstName={dashboard?.firstName || profile?.firstName || user?.firstName || 'there'}
          verified={Boolean(user?.emailVerified)}
          reducedMotion={Boolean(reducedMotion)}
        />

        <div className="mt-7 space-y-9 sm:mt-8 sm:space-y-10">
          <PatientCoreExperience
            reports={section(dashboard, loading.reports, errors.reports, loadReports)}
            reducedMotion={Boolean(reducedMotion)}
            onUpload={() => setUploadOpen(true)}
          />

          <HealthDataWorkspace
            profile={section(profile, loading.profile, errors.profile, loadProfile)}
            record={section(record, loading.record, errors.record, loadRecord)}
          />

          <section aria-labelledby="patient-care-activity-title">
            <SectionHeading
              eyebrow="Care coordination"
              title="What needs your attention"
              copy="Upcoming care and meaningful health-record changes, without turning your home page into an analytics dashboard."
              id="patient-care-activity-title"
            />
            <div className="mt-4 grid items-start gap-5 lg:grid-cols-12">
              <UpcomingCare
                section={section(appointments, loading.care, errors.care, loadCare)}
                className="lg:col-span-5"
              />
              <RecentHealthActivity
                section={section(activity, loading.activity, errors.activity, loadActivity)}
                className="lg:col-span-7"
              />
            </div>
          </section>

          <section aria-labelledby="patient-baseline-privacy-title">
            <SectionHeading
              eyebrow="Your baseline"
              title="Context and control"
              copy="Keep useful measurements visible while privacy and sharing remain explicit."
              id="patient-baseline-privacy-title"
            />
            <div className="mt-4 grid items-start gap-5 lg:grid-cols-12">
              <HealthInsights
                section={section(profile, loading.profile, errors.profile, loadProfile)}
                className="lg:col-span-7"
              />
              <div className="clinora-r3-panel p-5 sm:p-6 lg:col-span-5">
                <PrivacySharingSummary section={section(sharing, loading.sharing, errors.sharing, loadSharing)} />
              </div>
            </div>
          </section>
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

function HealthDataWorkspace({
  profile,
  record,
}: {
  profile: PatientHomeSection<PatientProfile>;
  record: PatientHomeSection<HealthRecord>;
}) {
  return (
    <section aria-labelledby="health-data-title">
      <SectionHeading
        eyebrow="Your health data"
        title="One place, two clear sources"
        copy="Health Profile is information you maintain. Health Record is the longitudinal medical evidence Clinora organizes around it."
        id="health-data-title"
      />

      <div className="clinora-r3-panel mt-4 overflow-hidden">
        <div className="grid lg:grid-cols-2">
          <div className="p-5 sm:p-6 lg:border-r lg:border-white/[0.055]">
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border border-cyan-300/[0.09] bg-cyan-300/[0.045] text-cyan-200">
                  <UserRound size={16} aria-hidden="true" />
                </span>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-cyan-300">Self-maintained</p>
                  <h3 className="mt-1 text-base font-semibold text-white">Health Profile</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    Personal context you can review and update at any time.
                  </p>
                </div>
              </div>
              {profile.data ? (
                <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-400">
                  {profile.data.completenessPercent}%
                </span>
              ) : null}
            </div>

            {profile.loading ? <CompactLoading /> : null}
            {!profile.loading && profile.error ? <CompactError message={profile.error} retry={profile.retry} /> : null}
            {!profile.loading && !profile.error && profile.data ? (
              <>
                <dl className="mt-5 grid grid-cols-2 gap-x-5 gap-y-4 border-y border-white/[0.055] py-4 sm:grid-cols-3">
                  <SmallFact
                    label="Blood group"
                    value={profile.data.bloodGroup ? bloodGroupLabels[profile.data.bloodGroup] : 'Not set'}
                  />
                  <SmallFact
                    label="Allergies"
                    value={
                      profile.data.allergies.length ? `${profile.data.allergies.length} recorded` : 'None recorded'
                    }
                  />
                  <SmallFact
                    label="Medications"
                    value={
                      profile.data.currentMedications.length
                        ? `${profile.data.currentMedications.length} recorded`
                        : 'None recorded'
                    }
                  />
                  <SmallFact
                    label="Conditions"
                    value={
                      profile.data.chronicConditions.length
                        ? `${profile.data.chronicConditions.length} recorded`
                        : 'None recorded'
                    }
                  />
                  <SmallFact
                    label="Emergency contact"
                    value={profile.data.emergencyContact.configured ? 'Configured' : 'Not configured'}
                  />
                  <SmallFact label="Updated" value={formatCompactDate(profile.data.updatedAt)} />
                </dl>
                <Link
                  to="/patient/profile"
                  className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-200 hover:text-cyan-100"
                >
                  Review Health Profile <ArrowRight size={13} aria-hidden="true" />
                </Link>
              </>
            ) : null}
          </div>

          <div className="border-t border-white/[0.055] p-5 sm:p-6 lg:border-t-0">
            <div className="flex gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border border-teal-300/[0.09] bg-teal-300/[0.04] text-teal-200">
                <HeartPulse size={16} aria-hidden="true" />
              </span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-teal-300">Longitudinal record</p>
                <h3 className="mt-1 text-base font-semibold text-white">Health Record</h3>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  Reports, measurements and care history organized over time.
                </p>
              </div>
            </div>

            {record.loading ? <CompactLoading /> : null}
            {!record.loading && record.error ? <CompactError message={record.error} retry={record.retry} /> : null}
            {!record.loading && !record.error && record.data ? (
              <>
                <div className="mt-5 grid gap-3 border-y border-white/[0.055] py-4 sm:grid-cols-2">
                  <RecordLine
                    icon={<FileText size={14} aria-hidden="true" />}
                    label="Recent reports"
                    value={
                      record.data.recentReports.length
                        ? `${record.data.recentReports.length} in current snapshot`
                        : 'No recent reports'
                    }
                  />
                  <RecordLine
                    icon={<Activity size={14} aria-hidden="true" />}
                    label="Current measurement"
                    value={measurementSummary(record.data)}
                  />
                  <RecordLine
                    icon={<ShieldCheck size={14} aria-hidden="true" />}
                    label="Clinical essentials"
                    value={`${record.data.clinicalEssentials.allergies.length + record.data.clinicalEssentials.conditions.length + record.data.clinicalEssentials.medications.length} recorded items`}
                  />
                  <RecordLine
                    icon={<HeartPulse size={14} aria-hidden="true" />}
                    label="Last updated"
                    value={formatCompactDate(record.data.lastUpdatedAt)}
                  />
                </div>
                <Link
                  to="/patient/history"
                  className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-teal-200 hover:text-teal-100"
                >
                  Open Health Record <ArrowRight size={13} aria-hidden="true" />
                </Link>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionHeading({ eyebrow, title, copy, id }: { eyebrow: string; title: string; copy: string; id: string }) {
  return (
    <header className="max-w-3xl">
      <p className="clinora-r3-kicker">{eyebrow}</p>
      <h2 id={id} className="mt-1 text-xl font-semibold tracking-[-0.03em] text-white sm:text-2xl">
        {title}
      </h2>
      <p className="mt-1.5 text-sm leading-6 text-slate-600">{copy}</p>
    </header>
  );
}

function SmallFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-700">{label}</dt>
      <dd className="mt-1 text-xs font-medium text-slate-300">{value}</dd>
    </div>
  );
}

function RecordLine({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex min-w-0 gap-2.5">
      <span className="mt-0.5 shrink-0 text-teal-300">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-slate-700">{label}</p>
        <p className="mt-1 truncate text-xs text-slate-400">{value}</p>
      </div>
    </div>
  );
}

function CompactLoading() {
  return (
    <div
      className="mt-5 h-20 animate-pulse rounded-[12px] bg-white/[0.025] motion-reduce:animate-none"
      role="status"
      aria-label="Loading health data"
    />
  );
}

function CompactError({ message, retry }: { message: string; retry: () => Promise<void> }) {
  return (
    <div className="mt-5 rounded-[10px] border border-rose-300/[0.1] bg-rose-300/[0.035] p-3">
      <p role="alert" className="text-xs leading-5 text-rose-200">
        {message}
      </p>
      <button
        type="button"
        onClick={() => void retry()}
        className="mt-2 text-xs font-semibold text-white underline underline-offset-4"
      >
        Try again
      </button>
    </div>
  );
}

function measurementSummary(record: HealthRecord) {
  const parts: string[] = [];
  if (record.currentMeasurements.heightCm != null) parts.push(`${record.currentMeasurements.heightCm} cm`);
  if (record.currentMeasurements.weightKg != null) parts.push(`${record.currentMeasurements.weightKg} kg`);
  if (record.currentMeasurements.bmi != null) parts.push(`BMI ${record.currentMeasurements.bmi.toFixed(1)}`);
  return parts.length ? parts.join(' · ') : 'No baseline yet';
}

function formatCompactDate(value: string | null) {
  if (!value) return 'Not available';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not available';
  return parsed.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
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
