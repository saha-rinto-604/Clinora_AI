import { useReducedMotion } from 'framer-motion';
import { ScanText } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { Link } from 'react-router';
import { appointmentApi, type Appointment } from '../../features/appointments/appointment-api';
import { useAuthStore } from '../../features/auth/auth-store';
import {
  HealthInsights,
  HealthProfileProgress,
  HealthRecordSnapshot,
  MedicalReportsHero,
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
    async () => setActivity((await patientRecordApi.timeline({ limit: 4 })).items),
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
    <PatientHomeCanvas>
      <PatientHomeHeader
        firstName={dashboard?.firstName || profile?.firstName || user?.firstName || 'there'}
        verified={Boolean(user?.emailVerified)}
        reducedMotion={Boolean(reducedMotion)}
      />

      <div className="mt-9 space-y-9 sm:mt-10 sm:space-y-10">
        <section className="overflow-hidden rounded-[var(--clinora-radius-lg)] border border-cyan-300/15 bg-[var(--clinora-surface-raised)]">
          <div className="grid gap-6 p-6 sm:p-7 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="flex gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--clinora-info-soft)] text-[var(--clinora-info-foreground)]">
                <ScanText size={20} aria-hidden="true" />
              </span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--clinora-info-foreground)]">
                  Clinora intelligence
                </p>
                <h2 className="mt-2 text-xl font-semibold tracking-[-0.025em] text-white">
                  Understand your medical report
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--clinora-text-muted)]">
                  Extract laboratory-style results, compare them with the original document, and correct transcription
                  errors before AI-assisted analysis.
                </p>
              </div>
            </div>
            <Link
              to="/patient/analyze"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--clinora-primary-gradient)] px-5 text-sm font-semibold text-slate-950 transition-opacity hover:opacity-90"
            >
              <ScanText size={16} aria-hidden="true" /> Analyze a report
            </Link>
          </div>
        </section>
        <MedicalReportsHero
          section={section(dashboard, loading.reports, errors.reports, loadReports)}
          reducedMotion={Boolean(reducedMotion)}
          onUpload={() => setUploadOpen(true)}
        />

        <div className="grid items-start gap-5 lg:grid-cols-12 lg:gap-6">
          <HealthProfileProgress
            section={section(profile, loading.profile, errors.profile, loadProfile)}
            className="lg:col-span-7"
          />
          <UpcomingCare
            section={section(appointments, loading.care, errors.care, loadCare)}
            className="lg:col-span-5"
          />
        </div>

        <div className="grid items-start gap-5 lg:grid-cols-12 lg:gap-6">
          <HealthInsights
            section={section(profile, loading.profile, errors.profile, loadProfile)}
            className="lg:col-span-7"
          />
          <RecentHealthActivity
            section={section(activity, loading.activity, errors.activity, loadActivity)}
            className="lg:col-span-5"
          />
        </div>

        <div className="grid items-start gap-7 lg:grid-cols-12 lg:gap-8">
          <HealthRecordSnapshot
            section={section(record, loading.record, errors.record, loadRecord)}
            className="lg:col-span-7"
          />
          <PrivacySharingSummary
            section={section(sharing, loading.sharing, errors.sharing, loadSharing)}
            className="lg:col-span-5 lg:mt-4"
          />
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
