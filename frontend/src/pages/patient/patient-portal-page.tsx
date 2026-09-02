import { useReducedMotion } from 'framer-motion';
import { ArrowRight, ScanText, UploadCloud } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { Link } from 'react-router';
import { Button } from '../../components/ui/button';
import { buttonVariants } from '../../components/ui/button-variants';
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
    <PatientHomeCanvas>
      <PatientHomeHeader
        firstName={dashboard?.firstName || profile?.firstName || user?.firstName || 'there'}
        verified={Boolean(user?.emailVerified)}
        reducedMotion={Boolean(reducedMotion)}
      />

      <div className="mt-8 space-y-8 sm:mt-9 sm:space-y-9">
        <section
          aria-labelledby="patient-report-analysis-title"
          className="relative overflow-hidden rounded-[var(--clinora-radius-lg)] border border-cyan-300/20 bg-[linear-gradient(118deg,rgba(8,145,178,0.12),rgba(15,23,42,0.18)_50%,rgba(20,184,166,0.055))] shadow-[0_24px_70px_-54px_rgba(34,211,238,0.8)]"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-72 bg-[radial-gradient(circle_at_70%_50%,rgba(34,211,238,0.09),transparent_62%)]"
          />
          <div className="relative grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="flex gap-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--clinora-info-soft)] text-[var(--clinora-info-foreground)] ring-1 ring-cyan-300/10">
                <ScanText size={18} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--clinora-info-foreground)]">
                  AI report analysis
                </p>
                <h2
                  id="patient-report-analysis-title"
                  className="mt-1.5 text-lg font-semibold tracking-[-0.025em] text-white sm:text-xl"
                >
                  Turn a report into results you can verify
                </h2>
                <p className="mt-1.5 max-w-3xl text-sm leading-6 text-[var(--clinora-text-muted)]">
                  Upload a laboratory report or choose one already stored in Clinora. Clinora extracts reported
                  laboratory values and lets you verify them against the original before later AI-assisted
                  interpretation.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] font-medium text-[var(--clinora-text-faint)]">
                  <span>Extract</span>
                  <ArrowRight size={12} aria-hidden="true" />
                  <span>Verify</span>
                  <ArrowRight size={12} aria-hidden="true" />
                  <span>Prepare for AI insight</span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:flex-nowrap lg:justify-end">
              <Link
                to="/patient/analyze"
                className={`${buttonVariants({ variant: 'appPrimary' })} focus-visible:outline-cyan-300`}
              >
                <ScanText size={16} aria-hidden="true" /> Analyze a report <ArrowRight size={15} aria-hidden="true" />
              </Link>
              <Button
                variant="appSecondary"
                className="focus-visible:outline-cyan-300"
                onClick={() => setUploadOpen(true)}
              >
                <UploadCloud size={16} aria-hidden="true" /> Upload new report
              </Button>
            </div>
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
