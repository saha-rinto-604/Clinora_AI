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
  UploadCloud,
} from 'lucide-react';
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
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
import { BiomedicalBackground } from '../../components/landing/biomedical-background';
import { Button } from '../../components/ui/button';
import { buttonVariants } from '../../components/ui/button-variants';
import { Skeleton } from '../../components/ui/feedback';
import type { Appointment } from '../appointments/appointment-api';
import type { HealthRecord, TimelineEvent } from '../patient-record/patient-record-api';
import { formatReportDate } from '../patient-reports/patient-report-format';
import { patientReportTypeLabels } from '../patient-reports/patient-report-types';
import {
  completedSectionCount,
  profileSections,
  sectionCompletion,
  type ProfileSectionId,
} from './patient-profile-state';
import type { PatientPortalSummary } from './patient-portal-api';
import type { PatientDashboard, PatientProfile } from './patient-types';

export interface PatientHomeSection<T> {
  data: T | null;
  loading: boolean;
  error: string;
  retry: () => Promise<void>;
}

const profileDescriptions: Record<ProfileSectionId, string> = {
  personal: 'Identity and contact details',
  basic: 'Blood group and measurements',
  medical: 'Family history and lifestyle context',
  emergency: 'A trusted emergency contact',
};

const profileLabels: Record<ProfileSectionId, string> = {
  personal: 'Personal details',
  basic: 'Basic health',
  medical: 'Medical background',
  emergency: 'Emergency contact',
};

export function PatientHomeCanvas({ children }: { children: ReactNode }) {
  return <div className="relative mx-auto w-full max-w-[1160px] pb-6 sm:pb-10">{children}</div>;
}

export function PatientHomeHeader({
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

export function MedicalReportsHero({
  section,
  reducedMotion,
  onUpload,
}: {
  section: PatientHomeSection<PatientDashboard>;
  reducedMotion: boolean;
  onUpload: () => void;
}) {
  const dashboard = section.data;
  const latest = dashboard?.latestReport ?? null;

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
            <div className="mb-5 flex items-center gap-3">
              <IconWell className="h-12 w-12" tone="info">
                <FileText size={21} aria-hidden="true" />
              </IconWell>
              {dashboard && dashboard.activeReportCount > 0 ? (
                <StatusPill tone="info">
                  {dashboard.activeReportCount} active report{dashboard.activeReportCount === 1 ? '' : 's'}
                </StatusPill>
              ) : null}
            </div>
            <AppSectionHeader
              eyebrow="Secure health records"
              title="Medical reports"
              titleId="medical-reports-title"
              copy={
                latest
                  ? 'Keep your clinical documents securely organised in Clinora.'
                  : 'Upload your first medical report to begin building your health record.'
              }
            />

            {section.loading ? <SectionSkeleton /> : null}
            {!section.loading && section.error ? (
              <SectionUnavailable message={section.error} onRetry={section.retry}>
                <Button variant="appPrimary" onClick={onUpload}>
                  <UploadCloud size={16} aria-hidden="true" /> Upload report
                </Button>
              </SectionUnavailable>
            ) : null}
            {!section.loading && !section.error && dashboard ? (
              <div className="mt-6 max-w-xl border-t border-[var(--clinora-border-subtle)] pt-5">
                {latest ? (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--clinora-text-faint)]">
                      Latest report
                    </p>
                    <p className="mt-2 truncate text-sm font-semibold text-[var(--clinora-text-primary)]">
                      {latest.reportName}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-[var(--clinora-text-muted)]">
                      {patientReportTypeLabels[latest.reportType]} · {formatReportDate(latest.reportDate)}
                    </p>
                  </div>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button variant="appPrimary" onClick={onUpload}>
                    <UploadCloud size={16} aria-hidden="true" /> Upload report
                  </Button>
                  {latest ? (
                    <Link to="/patient/reports" className={buttonVariants({ variant: 'appSecondary' })}>
                      View all reports <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                  ) : null}
                </div>
              </div>
            ) : null}
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

export function HealthProfileProgress({
  section,
  className,
}: {
  section: PatientHomeSection<PatientProfile>;
  className?: string;
}) {
  if (section.loading) return <LoadingSurface label="Loading Health Profile" className={className} />;
  if (section.error || !section.data) {
    return (
      <AppSurface as="section" className={className} aria-labelledby="health-profile-progress-title">
        <AppSectionHeader title="Your Health Profile" titleId="health-profile-progress-title" />
        <SectionUnavailable
          message={section.error || 'Your Health Profile could not be refreshed.'}
          onRetry={section.retry}
        />
      </AppSurface>
    );
  }

  const profile = section.data;
  const completion = sectionCompletion(profile);
  const completed = completedSectionCount(profile);
  const firstIncomplete = profileSections.find(({ id }) => !completion[id]);
  const profileComplete = completed === profileSections.length;
  const profileTarget = profileComplete
    ? '/patient/profile?section=personal'
    : `/patient/profile?section=${firstIncomplete?.id ?? 'personal'}`;

  if (profileComplete) {
    return (
      <AppSurface as="section" className={className} aria-labelledby="health-profile-progress-title">
        <AppSectionHeader
          title="Your Health Profile"
          titleId="health-profile-progress-title"
          copy="Keep the health information you manage in Clinora complete and up to date."
          action={<StatusPill tone="success">Complete</StatusPill>}
        />
        <ul className="mt-5 grid gap-x-5 gap-y-3 border-y border-[var(--clinora-border-subtle)] py-4 sm:grid-cols-2">
          {profileSections.map(({ id }) => (
            <li key={id} className="flex items-center gap-2.5 text-sm text-slate-300">
              <Check size={15} className="shrink-0 text-[var(--clinora-success-foreground)]" aria-hidden="true" />
              {profileLabels[id]}
            </li>
          ))}
        </ul>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-[var(--clinora-text-faint)]">
            {profile.updatedAt ? `Last updated ${formatShortDate(profile.updatedAt)}` : 'Your profile is complete.'}
          </p>
          <Link to={profileTarget} className={buttonVariants({ variant: 'appSecondary' })}>
            View profile <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </AppSurface>
    );
  }

  const current = firstIncomplete?.id;
  const items: ProgressItem[] = profileSections.map(({ id }) => ({
    label: profileLabels[id],
    description: profileDescriptions[id],
    state: completion[id] ? 'complete' : id === current ? 'current' : 'pending',
  }));

  return (
    <AppSurface as="section" variant="elevated" className={className} aria-labelledby="health-profile-progress-title">
      <AppSectionHeader
        title="Your Health Profile"
        titleId="health-profile-progress-title"
        copy="Keep the health information you manage in Clinora complete and up to date."
        action={<StatusPill tone="info">{completed} of 4 complete</StatusPill>}
      />
      <div className="mt-5">
        <ProgressRail items={items} label="Health Profile completion" />
      </div>
      <div className="mt-5 flex flex-col gap-4 border-t border-[var(--clinora-border-subtle)] pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[var(--clinora-text-muted)]">
          Next: {current ? profileLabels[current] : 'Health Profile'}
        </p>
        <Link to={profileTarget} className={buttonVariants({ variant: 'appPrimary' })}>
          Continue profile <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </AppSurface>
  );
}

export function UpcomingCare({
  section,
  className,
}: {
  section: PatientHomeSection<Appointment[]>;
  className?: string;
}) {
  const appointment = section.data?.[0] ?? null;
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
      {section.loading ? <SectionSkeleton /> : null}
      {!section.loading && section.error ? (
        <SectionUnavailable message={section.error} onRetry={section.retry} />
      ) : null}
      {!section.loading && !section.error && appointment ? (
        <div className="mt-5 border-t border-[var(--clinora-border-subtle)] pt-5">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--clinora-info-foreground)]">
            Next appointment
          </p>
          <p className="mt-3 text-lg font-semibold text-white">{formatAppointmentDay(appointment)}</p>
          <p className="mt-1 text-sm font-medium text-[var(--clinora-info-foreground)]">
            {formatAppointmentTime(appointment)}
          </p>
          <p className="mt-4 text-sm font-semibold text-white">{doctorDisplayName(appointment.doctorName)}</p>
          <p className="mt-1 text-sm text-[var(--clinora-text-muted)]">{appointment.specialization}</p>
          <p className="mt-3 text-xs text-[var(--clinora-text-faint)]">
            {appointment.sharedReportCount
              ? `${appointment.sharedReportCount} report${appointment.sharedReportCount === 1 ? '' : 's'} shared`
              : 'No reports shared'}
          </p>
          <Link
            to={`/patient/appointments/${appointment.id}`}
            className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-[var(--clinora-info-foreground)]"
          >
            View appointment <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      ) : null}
      {!section.loading && !section.error && !appointment ? (
        <EmptyState
          className="mt-5"
          title="No appointments scheduled."
          copy="Find an approved Clinora Doctor whenever you’re ready to book care."
          action={
            <Link to="/patient/doctors" className={buttonVariants({ variant: 'appPrimary' })}>
              Find a Doctor
            </Link>
          }
        />
      ) : null}
    </AppSurface>
  );
}

export function HealthInsights({
  section,
  className,
}: {
  section: PatientHomeSection<PatientProfile>;
  className?: string;
}) {
  if (section.loading) return <LoadingSurface label="Loading Health Insights" className={className} />;
  if (section.error || !section.data) {
    return (
      <AppSurface as="section" variant="elevated" className={className} aria-labelledby="health-insights-title">
        <AppSectionHeader eyebrow="Your baseline" title="Health insights" titleId="health-insights-title" />
        <SectionUnavailable
          message={section.error || 'Health insights could not be refreshed.'}
          onRetry={section.retry}
        />
      </AppSurface>
    );
  }

  const profile = section.data;
  const bmi = calculateBmi(profile.heightCm, profile.weightKg);
  const metrics = [
    profile.heightCm != null
      ? { label: 'Height', value: `${profile.heightCm} cm`, icon: <Ruler size={18} aria-hidden="true" /> }
      : null,
    profile.weightKg != null
      ? { label: 'Weight', value: `${profile.weightKg} kg`, icon: <Scale size={18} aria-hidden="true" /> }
      : null,
    bmi != null ? { label: 'BMI', value: bmi.toFixed(1), icon: <HeartPulse size={18} aria-hidden="true" /> } : null,
  ].filter((metric): metric is NonNullable<typeof metric> => Boolean(metric));

  return (
    <AppSurface as="section" variant="elevated" className={className} aria-labelledby="health-insights-title">
      <AppSectionHeader
        eyebrow="Your baseline"
        title="Health insights"
        titleId="health-insights-title"
        copy="Your saved measurements provide a reliable baseline for future comparisons."
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
          <p className="mt-5 text-xs leading-5 text-[var(--clinora-text-faint)]">
            Trends will appear as Clinora records trustworthy measurements over time.
          </p>
        </>
      ) : (
        <EmptyState
          className="mt-6"
          icon={<HeartPulse size={18} aria-hidden="true" />}
          title="No baseline measurements yet"
          copy="Add your height and weight in Health Profile to establish your baseline."
          action={
            <Link to="/patient/profile?section=basic" className={buttonVariants({ variant: 'appSecondary' })}>
              Add measurements
            </Link>
          }
        />
      )}
    </AppSurface>
  );
}

export function RecentHealthActivity({
  section,
  className,
}: {
  section: PatientHomeSection<TimelineEvent[]>;
  className?: string;
}) {
  return (
    <AppSurface as="section" className={className} aria-labelledby="recent-health-activity-title">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <IconWell tone="neutral">
            <Clock3 size={18} aria-hidden="true" />
          </IconWell>
          <div>
            <h2 id="recent-health-activity-title" className="text-xl font-semibold tracking-[-0.025em] text-white">
              Recent health activity
            </h2>
            <p className="mt-1 text-sm text-[var(--clinora-text-muted)]">
              Meaningful changes across your health record.
            </p>
          </div>
        </div>
        <Link to="/patient/timeline" className={buttonVariants({ variant: 'ghost' })}>
          View timeline <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>
      {section.loading ? <SectionSkeleton /> : null}
      {!section.loading && section.error ? (
        <SectionUnavailable message={section.error} onRetry={section.retry} />
      ) : null}
      {!section.loading && !section.error && section.data?.length ? (
        <ol
          className="mt-6 divide-y divide-[var(--clinora-border-subtle)] border-y border-[var(--clinora-border-subtle)]"
          aria-label="Recent health activity"
        >
          {section.data.slice(0, 4).map((event, index, items) => (
            <li key={event.id} className="relative flex gap-3 py-4">
              {index < items.length - 1 ? (
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
                  <p className="text-sm font-semibold text-slate-200">{event.title}</p>
                  <time className="text-xs text-[var(--clinora-text-faint)]" dateTime={event.occurredAt}>
                    {formatActivityDate(event.occurredAt)}
                  </time>
                </div>
                {event.detail ? (
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-[var(--clinora-text-muted)]">{event.detail}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      ) : null}
      {!section.loading && !section.error && !section.data?.length ? (
        <p className="mt-6 text-sm leading-6 text-[var(--clinora-text-muted)]">
          Your recent health activity will appear here as meaningful changes happen.
        </p>
      ) : null}
    </AppSurface>
  );
}

export function HealthRecordSnapshot({
  section,
  className,
}: {
  section: PatientHomeSection<HealthRecord>;
  className?: string;
}) {
  return (
    <AppSurface as="section" padding="compact" className={className} aria-labelledby="health-record-snapshot-title">
      <AppSectionHeader
        eyebrow="Health record"
        title="Your current clinical essentials"
        titleId="health-record-snapshot-title"
        copy="A concise view of the health information Clinora currently knows."
      />
      {section.loading ? <SectionSkeleton /> : null}
      {!section.loading && section.error ? (
        <SectionUnavailable message={section.error} onRetry={section.retry} />
      ) : null}
      {!section.loading && !section.error && section.data ? (
        <>
          <dl className="mt-5 grid gap-x-6 gap-y-4 border-y border-[var(--clinora-border-subtle)] py-5 sm:grid-cols-3">
            <ClinicalEssential label="Allergies" values={section.data.profile.allergies} empty="None recorded" />
            <ClinicalEssential
              label="Health conditions"
              values={section.data.profile.chronicConditions}
              empty="None recorded"
            />
            <ClinicalEssential
              label="Current medications"
              values={section.data.profile.currentMedications}
              empty="None recorded"
            />
          </dl>
          <Link
            to="/patient/history"
            className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-[var(--clinora-info-foreground)]"
          >
            View Health Record <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </>
      ) : null}
    </AppSurface>
  );
}

export function PrivacySharingSummary({
  section,
  className,
}: {
  section: PatientHomeSection<PatientPortalSummary>;
  className?: string;
}) {
  const shares = section.data?.care.activeReportShareCount ?? 0;
  const doctors = section.data?.care.doctorCount ?? 0;
  return (
    <section
      className={`border-t border-[var(--clinora-border-subtle)] pt-5 ${className ?? ''}`}
      aria-labelledby="privacy-sharing-title"
    >
      <div className="flex gap-3">
        <IconWell tone="success">
          <ShieldCheck size={18} aria-hidden="true" />
        </IconWell>
        <div className="min-w-0">
          <h2 id="privacy-sharing-title" className="text-lg font-semibold text-white">
            Privacy &amp; sharing
          </h2>
          {section.loading ? (
            <p className="mt-2 text-sm text-[var(--clinora-text-faint)]">Checking sharing status…</p>
          ) : null}
          {!section.loading && section.error ? (
            <>
              <p role="alert" className="mt-2 text-sm leading-6 text-[var(--clinora-text-muted)]">
                Your information remains private. Current sharing status could not be refreshed.
              </p>
              <Button variant="ghost" className="mt-2" onClick={() => void section.retry()}>
                Try again
              </Button>
            </>
          ) : null}
          {!section.loading && !section.error && section.data ? (
            <p className="mt-2 text-sm leading-6 text-[var(--clinora-text-muted)]">
              {shares
                ? `${shares} medical report${shares === 1 ? ' is' : 's are'} currently shared with ${doctors} Clinora Doctor${doctors === 1 ? '' : 's'}.`
                : 'Your health information stays private and is shared only through authorized Clinora workflows.'}
            </p>
          ) : null}
          {shares > 0 ? (
            <Link
              to="/patient/appointments"
              className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[var(--clinora-success-foreground)]"
            >
              Manage sharing <ArrowRight size={14} aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function ClinicalEssential({ label, values, empty }: { label: string; values: string[]; empty: string }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--clinora-text-faint)]">{label}</dt>
      <dd className="mt-2 text-sm leading-6 text-slate-200">
        {values.length
          ? `${values.slice(0, 2).join(', ')}${values.length > 2 ? ` +${values.length - 2} more` : ''}`
          : empty}
      </dd>
    </div>
  );
}

function LoadingSurface({ label, className }: { label: string; className?: string }) {
  return (
    <AppSurface as="section" className={className} aria-label={label}>
      <SectionSkeleton />
    </AppSurface>
  );
}

export function SectionSkeleton() {
  return (
    <div role="status" aria-label="Loading section" className="mt-5 space-y-3">
      <Skeleton className="h-5 w-2/3 rounded-lg" />
      <Skeleton className="h-16 rounded-xl" />
    </div>
  );
}

export function SectionUnavailable({
  message,
  onRetry,
  children,
}: {
  message: string;
  onRetry: () => Promise<void>;
  children?: ReactNode;
}) {
  return (
    <div className="mt-5 rounded-xl border border-rose-300/15 bg-rose-300/[0.04] p-4">
      <p role="alert" className="text-sm leading-6 text-[var(--clinora-text-muted)]">
        {message}
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        <Button variant="appSecondary" onClick={() => void onRetry()}>
          Try again
        </Button>
        {children}
      </div>
    </div>
  );
}

function calculateBmi(heightCm: number | null, weightKg: number | null) {
  if (heightCm == null || weightKg == null || heightCm < 80 || heightCm > 250 || weightKg < 20 || weightKg > 400) {
    return null;
  }
  return weightKg / (heightCm / 100) ** 2;
}

function doctorDisplayName(value: string) {
  return /^dr\.?\s/i.test(value) ? value : `Dr. ${value}`;
}

function formatAppointmentDay(appointment: Appointment) {
  return new Date(appointment.scheduledStart).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: appointment.bookingTimezone,
  });
}

function formatAppointmentTime(appointment: Appointment) {
  return new Date(appointment.scheduledStart).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: appointment.bookingTimezone,
  });
}

function greetingForTime(date: Date) {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatDay(value: Date) {
  return value.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatActivityDate(value: string) {
  const date = new Date(value);
  const today = new Date();
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const currentDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const difference = Math.round((currentDay - day) / 86_400_000);
  if (difference === 0) return 'Today';
  if (difference === 1) return 'Yesterday';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
