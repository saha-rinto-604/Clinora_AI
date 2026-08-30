import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  CircleAlert,
  Clock3,
  FileText,
  HeartPulse,
  Ruler,
  Scale,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
  AppSectionHeader,
  AppSurface,
  DashboardMetric,
  EmptyState,
  IconWell,
  ProgressRail,
  StatusPill,
  type ProgressItem,
} from '../../components/app/app-ui';
import { ClinicalMotif } from '../../components/app/clinical-visuals';
import { BiomedicalBackground } from '../../components/landing/biomedical-background';
import { Button } from '../../components/ui/button';
import { buttonVariants } from '../../components/ui/button-variants';
import { Skeleton } from '../../components/ui/feedback';
import { useAuthStore } from '../../features/auth/auth-store';
import { patientApi, patientErrorMessage } from '../../features/patient/patient-api';
import {
  completedSectionCount,
  profileSections,
  sectionCompletion,
  type ProfileSectionId,
} from '../../features/patient/patient-profile-state';
import type { PatientDashboard, PatientProfile } from '../../features/patient/patient-types';

const profileDescriptions: Record<ProfileSectionId, string> = {
  personal: 'Identity and contact details',
  basic: 'Blood group and measurements',
  medical: 'History, allergies, and medications',
  emergency: 'A trusted emergency contact',
};

export function PatientDashboardPage() {
  const [dashboard, setDashboard] = useState<PatientDashboard | null>(null);
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [error, setError] = useState('');
  const user = useAuthStore((state) => state.user);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    let active = true;
    Promise.all([patientApi.dashboard(), patientApi.profile()])
      .then(([dashboardData, profileData]) => {
        if (active) {
          setDashboard(dashboardData);
          setProfile(profileData);
        }
      })
      .catch((requestError) => {
        if (active) setError(patientErrorMessage(requestError, 'Unable to load your Patient home.'));
      });
    return () => {
      active = false;
    };
  }, []);

  if (!dashboard && !error) {
    return (
      <PatientHomeCanvas>
        <DashboardSkeleton />
      </PatientHomeCanvas>
    );
  }

  if (error) {
    return (
      <AppSurface as="section" variant="elevated" className="mx-auto max-w-3xl border-[var(--clinora-danger-soft)]">
        <IconWell tone="danger">
          <CircleAlert size={18} aria-hidden="true" />
        </IconWell>
        <h1 className="mt-4 text-2xl font-semibold text-white">We couldn&apos;t load your Patient home</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--clinora-text-muted)]">{error}</p>
      </AppSurface>
    );
  }

  if (!dashboard || !profile) return null;

  const completion = sectionCompletion(profile);
  const completed = completedSectionCount(profile);
  const firstIncomplete = profileSections.find((section) => !completion[section.id]);
  const profileComplete = completed === profileSections.length;
  const profileTarget = profileComplete
    ? '/patient/profile?section=review'
    : `/patient/profile?section=${firstIncomplete?.id ?? 'personal'}`;
  const firstName = dashboard.firstName || user?.firstName || profile.firstName || 'there';

  return (
    <PatientHomeCanvas>
      <DashboardHeader
        firstName={firstName}
        verified={Boolean(user?.emailVerified)}
        reducedMotion={Boolean(reducedMotion)}
      />

      <div className="mt-9 space-y-9 sm:mt-10 sm:space-y-10">
        <MedicalReportsSection reducedMotion={Boolean(reducedMotion)} />

        <div className="grid items-start gap-5 lg:grid-cols-12 lg:gap-6">
          <PatientRecord
            profile={profile}
            completion={completion}
            completed={completed}
            profileComplete={profileComplete}
            nextSectionLabel={firstIncomplete?.label ?? 'Health profile'}
            profileTarget={profileTarget}
            className="lg:col-span-7"
          />
          <UpcomingCare className="lg:col-span-5" />
        </div>

        <div className="grid items-start gap-5 lg:grid-cols-12 lg:gap-6">
          <HealthInsights profile={profile} dashboard={dashboard} className="lg:col-span-7" />
          <RecentActivity profile={profile} accountVerified={Boolean(user?.emailVerified)} className="lg:col-span-5" />
        </div>

        <PrivacyAndSharing />
      </div>
    </PatientHomeCanvas>
  );
}

function PatientHomeCanvas({ children }: { children: ReactNode }) {
  return <div className="relative mx-auto w-full max-w-[1160px] pb-6 sm:pb-10">{children}</div>;
}

function DashboardHeader({
  firstName,
  verified,
  reducedMotion,
}: {
  firstName: string;
  verified: boolean;
  reducedMotion: boolean;
}) {
  return (
    <motion.header
      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      <p className="text-[13px] font-medium text-[var(--clinora-text-muted)]">{formatDay(new Date())}</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-balance text-3xl font-semibold tracking-[-0.045em] text-white sm:text-4xl">
          {greetingForTime(new Date())}, {firstName}
        </h1>
        <StatusPill tone={verified ? 'success' : 'warning'}>
          {verified ? <CheckCircle2 size={13} aria-hidden="true" /> : <CircleAlert size={13} aria-hidden="true" />}
          {verified ? 'Verified Patient' : 'Verification pending'}
        </StatusPill>
      </div>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--clinora-text-muted)] sm:text-[15px]">
        Here&apos;s what matters for your care today.
      </p>
    </motion.header>
  );
}

function MedicalReportsSection({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      <AppSurface
        as="section"
        id="patient-medical-reports"
        variant="hero"
        aria-labelledby="medical-reports-title"
        className="relative overflow-hidden"
      >
        <div className="relative grid items-stretch gap-7 lg:grid-cols-[minmax(0,0.95fr)_minmax(22rem,1.05fr)] lg:gap-6">
          <div className="relative z-10 flex min-w-0 flex-col justify-center py-1">
            <IconWell className="mb-5 h-12 w-12" tone="info">
              <FileText size={21} aria-hidden="true" />
            </IconWell>
            <AppSectionHeader
              eyebrow="Secure health records"
              title="Medical reports"
              titleId="medical-reports-title"
              copy="Keep your laboratory and diagnostic reports together in one secure health record."
            />

            <div className="mt-6 max-w-xl border-t border-[var(--clinora-border-subtle)] pt-5">
              <p className="text-sm font-semibold text-[var(--clinora-text-primary)]">
                Upload your first medical report to start your record.
              </p>
              <p className="mt-2 text-xs leading-5 text-[var(--clinora-text-muted)]">
                PDF, JPG, JPEG or PNG · up to 50 MB
              </p>
              <div className="mt-4">
                <Button variant="appSecondary" disabled aria-describedby="report-upload-availability">
                  <UploadCloud size={16} aria-hidden="true" /> Upload report
                </Button>
                <p
                  id="report-upload-availability"
                  className="mt-3 max-w-md text-xs leading-5 text-[var(--clinora-text-faint)]"
                >
                  Secure report upload will become available when report storage is enabled.
                </p>
              </div>
            </div>
          </div>

          <div
            className="relative min-h-[11rem] overflow-hidden sm:min-h-[13rem] md:min-h-[14rem] lg:-my-7 lg:-mr-7 lg:min-h-[20rem]"
            data-medical-reports-visual="clinical-ambient"
          >
            <BiomedicalBackground variant="patient-report" />
          </div>
        </div>
      </AppSurface>
    </motion.div>
  );
}

function PatientRecord({
  profile,
  completion,
  completed,
  profileComplete,
  nextSectionLabel,
  profileTarget,
  className,
}: {
  profile: PatientProfile;
  completion: ReturnType<typeof sectionCompletion>;
  completed: number;
  profileComplete: boolean;
  nextSectionLabel: string;
  profileTarget: string;
  className?: string;
}) {
  if (profileComplete) {
    return (
      <AppSurface as="section" className={className} aria-labelledby="patient-record-title">
        <AppSectionHeader
          title="Patient record"
          titleId="patient-record-title"
          copy="Your core Patient information is complete and ready to review when something changes."
          action={<StatusPill tone="success">Complete</StatusPill>}
        />
        <ul className="mt-5 grid gap-x-5 gap-y-3 border-y border-[var(--clinora-border-subtle)] py-4 sm:grid-cols-2">
          {profileSections.map(({ id, label }) => (
            <li key={id} className="flex items-center gap-2.5 text-sm text-slate-300">
              <Check size={15} className="shrink-0 text-[var(--clinora-success-foreground)]" aria-hidden="true" />{' '}
              {label}
            </li>
          ))}
        </ul>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-[var(--clinora-text-faint)]">
            {profile.updatedAt ? `Last updated ${formatShortDate(profile.updatedAt)}` : 'Your record is complete.'}
          </p>
          <Link to={profileTarget} className={buttonVariants({ variant: 'appSecondary' })}>
            View profile <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </AppSurface>
    );
  }

  const current = profileSections.find((section) => !completion[section.id])?.id;
  const items: ProgressItem[] = profileSections.map(({ id, label }) => ({
    label,
    description: profileDescriptions[id],
    state: completion[id] ? 'complete' : id === current ? 'current' : 'pending',
  }));

  return (
    <AppSurface as="section" variant="elevated" className={className} aria-labelledby="patient-record-title">
      <AppSectionHeader
        title="Patient record"
        titleId="patient-record-title"
        copy="Build your record in four focused steps so your saved health information stays clear and useful."
        action={<StatusPill tone="info">{completed} of 4 complete</StatusPill>}
      />
      <div className="mt-5">
        <ProgressRail items={items} label="Health profile setup steps" />
      </div>
      <div className="mt-5 flex flex-col gap-4 border-t border-[var(--clinora-border-subtle)] pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[var(--clinora-text-muted)]">Next: {nextSectionLabel}</p>
        <Link to={profileTarget} className={buttonVariants({ variant: 'appPrimary' })}>
          Start with {nextSectionLabel.toLowerCase()} <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </AppSurface>
  );
}

function UpcomingCare({ className }: { className?: string }) {
  return (
    <AppSurface as="section" padding="compact" className={className} aria-labelledby="upcoming-care-title">
      <div className="flex items-center gap-3">
        <IconWell>
          <CalendarDays size={18} aria-hidden="true" />
        </IconWell>
        <h2 id="upcoming-care-title" className="text-xl font-semibold tracking-[-0.025em] text-white">
          Upcoming care
        </h2>
      </div>
      <EmptyState
        className="mt-5"
        title="No appointments scheduled."
        copy="Your next Clinora consultation will appear here."
      />
    </AppSurface>
  );
}

function HealthInsights({
  profile,
  dashboard,
  className,
}: {
  profile: PatientProfile;
  dashboard: PatientDashboard;
  className?: string;
}) {
  const metrics = [
    profile.heightCm != null
      ? { label: 'Height', value: `${profile.heightCm} cm`, icon: <Ruler size={18} aria-hidden="true" /> }
      : null,
    profile.weightKg != null
      ? { label: 'Weight', value: `${profile.weightKg} kg`, icon: <Scale size={18} aria-hidden="true" /> }
      : null,
    profile.heightCm != null && profile.weightKg != null && dashboard.bmi != null
      ? { label: 'BMI', value: dashboard.bmi.toFixed(1), icon: <HeartPulse size={18} aria-hidden="true" /> }
      : null,
  ].filter((metric): metric is NonNullable<typeof metric> => Boolean(metric));

  return (
    <AppSurface
      as="section"
      variant="elevated"
      className={`relative overflow-hidden ${className ?? ''}`}
      aria-labelledby="health-insights-title"
    >
      <div className="relative">
        <AppSectionHeader
          eyebrow="Health intelligence"
          title="Health insights"
          titleId="health-insights-title"
          copy="Your saved baseline measurements establish a starting point for future health trends."
        />

        {metrics.length ? (
          <>
            <ul
              className="mt-6 grid gap-5 border-y border-[var(--clinora-border-subtle)] py-5 sm:grid-cols-3"
              aria-label="Saved baseline measurements"
            >
              {metrics.map((metric) => (
                <li key={metric.label}>
                  <DashboardMetric {...metric} />
                </li>
              ))}
            </ul>
            <div className="mt-5 grid items-center gap-5 sm:grid-cols-[1fr_12rem]">
              <p className="text-xs leading-5 text-[var(--clinora-text-faint)]">
                Trend comparisons will appear when Clinora has measurements from more than one point in time.
              </p>
              <HealthTrendVisual />
            </div>
          </>
        ) : (
          <div className="mt-6 grid items-center gap-6 sm:grid-cols-[1fr_12rem]">
            <EmptyState
              icon={<Sparkles size={18} aria-hidden="true" />}
              title="Health trends need comparable measurements"
              copy="Your health trends will appear here once Clinora has comparable measurements over time."
            />
            <HealthTrendVisual />
          </div>
        )}
      </div>
    </AppSurface>
  );
}

function HealthTrendVisual() {
  return (
    <div
      className="relative min-h-32 w-full max-w-48 overflow-hidden justify-self-end"
      data-health-insight-visual="biomarker-trend"
    >
      <ClinicalMotif type="biomarker" placement="fill" intensity="supporting" motion="parallax-drift" />
      <div className="absolute inset-x-2 bottom-1">
        <TrendSchematic />
      </div>
    </div>
  );
}

function TrendSchematic() {
  return (
    <svg
      viewBox="0 0 176 112"
      aria-hidden="true"
      className="h-auto w-full max-w-44 text-[var(--clinora-accent-cyan)] opacity-[var(--clinora-schematic-opacity)]"
      fill="none"
    >
      <path className="clinical-schematic-axis" d="M8 96H168" stroke="currentColor" />
      <path className="clinical-schematic-grid" d="M8 68H168" stroke="currentColor" strokeDasharray="4 7" />
      <path className="clinical-schematic-grid" d="M8 40H168" stroke="currentColor" strokeDasharray="4 7" />
      <path
        d="M14 82C38 76 50 87 74 66C96 48 111 61 130 42C143 30 154 32 164 24"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle className="clinical-schematic-point" cx="74" cy="66" r="4" fill="var(--clinora-accent-teal)" />
      <circle className="clinical-schematic-point" cx="130" cy="42" r="4" fill="var(--clinora-accent-cyan)" />
    </svg>
  );
}

function RecentActivity({
  profile,
  accountVerified,
  className,
}: {
  profile: PatientProfile;
  accountVerified: boolean;
  className?: string;
}) {
  const activities = [
    profile.updatedAt
      ? {
          title: 'Health profile updated',
          copy: 'Your saved health information changed.',
          meta: formatDateTime(profile.updatedAt),
        }
      : null,
    accountVerified
      ? {
          title: 'Patient account verified',
          copy: 'Your Clinora Patient identity is verified and active.',
          meta: 'Account',
        }
      : null,
  ].filter((activity): activity is NonNullable<typeof activity> => Boolean(activity));

  return (
    <AppSurface as="section" className={className} aria-labelledby="recent-activity-title">
      <div className="flex items-center gap-3">
        <IconWell tone="neutral">
          <Clock3 size={18} aria-hidden="true" />
        </IconWell>
        <div>
          <h2 id="recent-activity-title" className="text-xl font-semibold tracking-[-0.025em] text-white">
            Recent health activity
          </h2>
          <p className="mt-1 text-sm text-[var(--clinora-text-muted)]">Your latest real Clinora events.</p>
        </div>
      </div>

      {activities.length ? (
        <ol
          className="mt-6 divide-y divide-[var(--clinora-border-subtle)] border-y border-[var(--clinora-border-subtle)]"
          aria-label="Recent Patient activity"
        >
          {activities.map((activity, index) => (
            <TimelineItem key={activity.title} {...activity} last={index === activities.length - 1} />
          ))}
        </ol>
      ) : (
        <p className="mt-6 text-sm leading-6 text-[var(--clinora-text-muted)]">
          Your health activity will appear here as you begin using Clinora.
        </p>
      )}
    </AppSurface>
  );
}

function TimelineItem({ title, copy, meta, last }: { title: string; copy: string; meta: string; last: boolean }) {
  return (
    <li className="relative flex gap-3 py-4">
      {!last ? (
        <span
          className="absolute bottom-0 left-[4.5px] top-7 w-px bg-[var(--clinora-border-interactive)]"
          aria-hidden="true"
        />
      ) : null}
      <span
        className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--clinora-accent-cyan-strong)] ring-4 ring-[var(--clinora-focus-ring-soft)]"
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-slate-200">{title}</p>
          <span className="text-xs text-[var(--clinora-text-faint)]">{meta}</span>
        </div>
        <p className="mt-1 text-sm leading-6 text-[var(--clinora-text-muted)]">{copy}</p>
      </div>
    </li>
  );
}

function PrivacyAndSharing() {
  return (
    <section
      aria-labelledby="privacy-sharing-title"
      className="flex flex-col gap-4 border-t border-[var(--clinora-border-subtle)] pt-5 sm:flex-row sm:items-center"
    >
      <IconWell tone="success">
        <ShieldCheck size={18} aria-hidden="true" />
      </IconWell>
      <div>
        <h2 id="privacy-sharing-title" className="text-lg font-semibold text-white">
          Privacy &amp; sharing
        </h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--clinora-text-muted)]">
          Your health information stays private. Clinical access is granted only through authorized Clinora workflows.
        </p>
      </div>
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1160px]" role="status" aria-label="Loading Patient home">
      <Skeleton className="h-24 rounded-[var(--clinora-radius-lg)] bg-white/[0.055]" />
      <Skeleton className="mt-10 h-[25rem] rounded-[var(--clinora-radius-lg)] bg-white/[0.04]" />
      <Skeleton className="mt-10 h-72 rounded-[var(--clinora-radius-lg)] bg-white/[0.055]" />
    </div>
  );
}

function greetingForTime(date: Date) {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatDay(value: Date) {
  return value.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
