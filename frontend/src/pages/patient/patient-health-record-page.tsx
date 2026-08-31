import { ArrowRight, CalendarDays, FileText, HeartPulse, Pill, ShieldAlert } from 'lucide-react';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { AppSectionHeader, AppSurface, IconWell } from '../../components/app/app-ui';
import { Button } from '../../components/ui/button';
import { buttonVariants } from '../../components/ui/button-variants';
import { Skeleton } from '../../components/ui/feedback';
import {
  HealthRecordHeader,
  HealthRecordTabs,
  ProfileSourceLabel,
} from '../../features/patient-record/health-record-shell';
import { HealthTrendsSection } from '../../features/patient-record/health-trends';
import {
  patientRecordApi,
  patientRecordError,
  type HealthRecord,
  type HealthRecordAppointment,
  type HealthTrends,
  type SourcedHealthValue,
} from '../../features/patient-record/patient-record-api';
import { bloodGroupLabels } from '../../features/patient/patient-types';
import { patientReportTypeLabels } from '../../features/patient-reports/patient-report-types';

export function PatientHealthRecordPage() {
  const [record, setRecord] = useState<HealthRecord | null>(null);
  const [recordLoading, setRecordLoading] = useState(true);
  const [recordError, setRecordError] = useState('');
  const [trends, setTrends] = useState<HealthTrends | null>(null);
  const [trendsLoading, setTrendsLoading] = useState(true);
  const [trendsError, setTrendsError] = useState('');

  const loadRecord = useCallback(async () => {
    setRecordLoading(true);
    setRecordError('');
    try {
      setRecord(await patientRecordApi.history());
    } catch (error) {
      setRecordError(patientRecordError(error, 'We could not load your Health Record.'));
    } finally {
      setRecordLoading(false);
    }
  }, []);
  const loadTrends = useCallback(async () => {
    setTrendsLoading(true);
    setTrendsError('');
    try {
      setTrends(await patientRecordApi.healthTrends());
    } catch (error) {
      setTrendsError(patientRecordError(error, 'Health Trends could not be refreshed.'));
    } finally {
      setTrendsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRecord();
    void loadTrends();
  }, [loadRecord, loadTrends]);

  if (recordLoading) return <HealthRecordSkeleton />;
  if (recordError || !record) return <RecordError message={recordError} retry={loadRecord} />;

  if (!record.profile.profileCreated) {
    return (
      <div className="mx-auto w-full max-w-[1120px] pb-8">
        <HealthRecordHeader />
        <HealthRecordTabs />
        <AppSurface as="section" variant="hero" className="mt-8 max-w-3xl">
          <h2 className="text-2xl font-semibold tracking-[-0.03em] text-white">Your Health Record starts with you</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--clinora-text-muted)]">
            Your Health Record will build as you add health information, medical reports and Clinora care.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/patient/profile" className={buttonVariants({ variant: 'appPrimary' })}>
              Complete Health Profile
            </Link>
            <Link to="/patient/reports" className={buttonVariants({ variant: 'appSecondary' })}>
              Medical Reports
            </Link>
          </div>
        </AppSurface>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1120px] pb-8">
      <HealthRecordHeader lastUpdatedAt={record.lastUpdatedAt} />
      <HealthRecordTabs />

      <div className="mt-9 space-y-10">
        <ClinicalEssentials record={record} />

        <section aria-labelledby="measurements-section-title">
          <div className="mb-5">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--clinora-info-foreground)]">
              Longitudinal health
            </p>
            <h2 id="measurements-section-title" className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">
              Measurements
            </h2>
          </div>
          <div className="grid items-start gap-6 lg:grid-cols-12">
            <CurrentMeasurements record={record} />
            <div className="min-w-0 lg:col-span-8">
              <HealthTrendsSection
                trends={trends}
                loading={trendsLoading}
                error={trendsError}
                retry={() => void loadTrends()}
              />
            </div>
          </div>
        </section>

        <div className="grid items-start gap-9 lg:grid-cols-2 lg:gap-12">
          <MedicalReports record={record} />
          <CareHistory record={record} />
        </div>

        <HealthBackground record={record} />
      </div>
    </div>
  );
}

function ClinicalEssentials({ record }: { record: HealthRecord }) {
  return (
    <section
      aria-labelledby="clinical-essentials-title"
      className="border-y border-[var(--clinora-border-subtle)] py-7"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--clinora-info-foreground)]">
            Clinical essentials
          </p>
          <h2 id="clinical-essentials-title" className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">
            Important health information currently recorded in Clinora
          </h2>
        </div>
        <Link
          to="/patient/profile?section=medical"
          className="text-sm font-semibold text-[var(--clinora-info-foreground)]"
        >
          Manage Health Profile <ArrowRight size={14} className="inline" aria-hidden="true" />
        </Link>
      </div>
      <div className="mt-7 grid gap-7 lg:grid-cols-3 lg:gap-0 lg:divide-x lg:divide-[var(--clinora-border-subtle)]">
        <ClinicalGroup
          icon={<ShieldAlert size={18} aria-hidden="true" />}
          title="Allergies"
          values={record.clinicalEssentials.allergies}
          empty="No allergies recorded in your Health Profile."
        />
        <ClinicalGroup
          icon={<HeartPulse size={18} aria-hidden="true" />}
          title="Health conditions"
          values={record.clinicalEssentials.conditions}
          empty="No health conditions recorded."
        />
        <ClinicalGroup
          icon={<Pill size={18} aria-hidden="true" />}
          title="Current medications"
          values={record.clinicalEssentials.medications}
          empty="No current medications recorded."
        />
      </div>
      <div className="mt-6">
        <ProfileSourceLabel />
      </div>
    </section>
  );
}

function ClinicalGroup({
  icon,
  title,
  values,
  empty,
}: {
  icon: ReactNode;
  title: string;
  values: SourcedHealthValue[];
  empty: string;
}) {
  return (
    <div className="min-w-0 lg:px-6 lg:first:pl-0 lg:last:pr-0">
      <h3 className="flex items-center gap-2.5 text-sm font-semibold text-white">
        {icon}
        {title}
      </h3>
      {values.length ? (
        <ul className="mt-4 space-y-2.5">
          {values.map((value) => (
            <li key={value.name} className="text-sm leading-6 text-slate-200">
              {value.name}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm leading-6 text-[var(--clinora-text-muted)]">{empty}</p>
      )}
    </div>
  );
}

function CurrentMeasurements({ record }: { record: HealthRecord }) {
  const measurements = record.currentMeasurements;
  return (
    <aside
      className="border-y border-[var(--clinora-border-subtle)] py-5 lg:col-span-4"
      aria-labelledby="current-measurements-title"
    >
      <h3 id="current-measurements-title" className="text-sm font-semibold text-white">
        Current measurements
      </h3>
      <dl className="mt-4 divide-y divide-[var(--clinora-border-subtle)]">
        <Datum
          label="Blood group"
          value={measurements.bloodGroup ? bloodGroupLabels[measurements.bloodGroup] : 'Not recorded'}
        />
        <Datum label="Height" value={measurements.heightCm == null ? 'Not recorded' : `${measurements.heightCm} cm`} />
        <Datum label="Weight" value={measurements.weightKg == null ? 'Not recorded' : `${measurements.weightKg} kg`} />
        <Datum label="BMI" value={measurements.bmi == null ? 'Not available' : measurements.bmi.toFixed(1)} />
      </dl>
      <div className="mt-4">
        <ProfileSourceLabel />
      </div>
    </aside>
  );
}

function MedicalReports({ record }: { record: HealthRecord }) {
  return (
    <section aria-labelledby="record-reports-title">
      <SectionHeading title="Medical Reports" titleId="record-reports-title" action="View all" to="/patient/reports" />
      {record.recentReports.length ? (
        <ul className="mt-4 divide-y divide-[var(--clinora-border-subtle)] border-y border-[var(--clinora-border-subtle)]">
          {record.recentReports.map((report) => (
            <li key={report.id} className="flex items-start gap-3 py-4">
              <IconWell tone="neutral">
                <FileText size={16} aria-hidden="true" />
              </IconWell>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{report.reportName}</p>
                <p className="mt-1 text-xs leading-5 text-[var(--clinora-text-muted)]">
                  {patientReportTypeLabels[report.reportType as keyof typeof patientReportTypeLabels] ??
                    'Medical report'}
                  {report.reportDate ? ` · ${formatDateOnly(report.reportDate)}` : ''}
                </p>
                <p className="mt-1 text-xs text-[var(--clinora-text-faint)]">Uploaded medical report</p>
              </div>
              <Link
                to={`/patient/reports/${report.id}`}
                className="text-sm font-semibold text-[var(--clinora-info-foreground)]"
              >
                Open
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm leading-6 text-[var(--clinora-text-muted)]">
          No medical reports are part of your Health Record yet.
        </p>
      )}
    </section>
  );
}

function CareHistory({ record }: { record: HealthRecord }) {
  const rows = [record.care.nextAppointment, ...record.care.recentAppointments].filter(
    (item): item is HealthRecordAppointment => Boolean(item),
  );
  return (
    <section aria-labelledby="care-history-title">
      <SectionHeading
        title="Care History"
        titleId="care-history-title"
        action="View appointments"
        to="/patient/appointments"
      />
      {rows.length ? (
        <ul className="mt-4 divide-y divide-[var(--clinora-border-subtle)] border-y border-[var(--clinora-border-subtle)]">
          {rows.map((appointment) => (
            <li key={appointment.id} className="flex items-start gap-3 py-4">
              <IconWell tone={appointment === record.care.nextAppointment ? 'success' : 'neutral'}>
                <CalendarDays size={16} aria-hidden="true" />
              </IconWell>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">{doctorName(appointment.doctorName)}</p>
                <p className="mt-1 text-xs text-[var(--clinora-text-muted)]">
                  {formatAppointment(appointment.scheduledStart)} · {appointment.specialization}
                </p>
                <p className="mt-1 text-xs text-[var(--clinora-text-faint)]">Clinora appointment</p>
              </div>
              <Link
                to={`/patient/appointments/${appointment.id}`}
                className="text-sm font-semibold text-[var(--clinora-info-foreground)]"
              >
                View
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm leading-6 text-[var(--clinora-text-muted)]">
          No Clinora care appointments have been recorded yet.
        </p>
      )}
    </section>
  );
}

function HealthBackground({ record }: { record: HealthRecord }) {
  return (
    <section aria-labelledby="health-background-title" className="border-t border-[var(--clinora-border-subtle)] pt-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--clinora-text-faint)]">
            Health background
          </p>
          <h2 id="health-background-title" className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">
            Context you have recorded
          </h2>
        </div>
        <Link
          to="/patient/profile?section=medical"
          className="text-sm font-semibold text-[var(--clinora-info-foreground)]"
        >
          Manage in Health Profile <ArrowRight size={14} className="inline" aria-hidden="true" />
        </Link>
      </div>
      <div className="mt-6 grid gap-7 sm:grid-cols-2">
        <TextRecord title="Family medical history" value={record.background.familyMedicalHistory} />
        <TextRecord title="Lifestyle information" value={record.background.lifestyleInformation} />
      </div>
      <div className="mt-5">
        <ProfileSourceLabel />
      </div>
    </section>
  );
}

function SectionHeading({
  title,
  titleId,
  action,
  to,
}: {
  title: string;
  titleId: string;
  action: string;
  to: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <h2 id={titleId} className="text-xl font-semibold text-white">
        {title}
      </h2>
      <Link to={to} className="text-sm font-semibold text-[var(--clinora-info-foreground)]">
        {action} <ArrowRight size={14} className="inline" aria-hidden="true" />
      </Link>
    </div>
  );
}
function Datum({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <dt className="text-sm text-[var(--clinora-text-muted)]">{label}</dt>
      <dd className="text-sm font-semibold text-white">{value}</dd>
    </div>
  );
}
function TextRecord({ title, value }: { title: string; value: string | null }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <p className="mt-2 whitespace-pre-line text-sm leading-7 text-[var(--clinora-text-muted)]">
        {value || 'Nothing recorded yet.'}
      </p>
    </div>
  );
}
function HealthRecordSkeleton() {
  return (
    <div className="mx-auto max-w-[1120px]" role="status" aria-label="Loading Health Record">
      <Skeleton className="h-28 rounded-2xl" />
      <Skeleton className="mt-8 h-56 rounded-2xl" />
      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <Skeleton className="h-72 rounded-2xl lg:col-span-4" />
        <Skeleton className="h-72 rounded-2xl lg:col-span-8" />
      </div>
    </div>
  );
}
function RecordError({ message, retry }: { message: string; retry: () => Promise<void> }) {
  return (
    <AppSurface as="section" variant="attention" className="mx-auto max-w-3xl">
      <AppSectionHeader title="We couldn't load your Health Record" copy={message} />
      <Button variant="appSecondary" className="mt-5" onClick={() => void retry()}>
        Try again
      </Button>
    </AppSurface>
  );
}
function formatDateOnly(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
function formatAppointment(value: string) {
  return new Date(value).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}
function doctorName(value: string) {
  return /^dr\.?\s/i.test(value) ? value : `Dr. ${value}`;
}
