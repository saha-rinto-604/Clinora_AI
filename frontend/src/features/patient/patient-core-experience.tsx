import { ArrowRight, Droplets, FileText, MapPinned, ScanText, UploadCloud } from 'lucide-react';
import { Link } from 'react-router';
import { AppSurface, IconWell, StatusPill } from '../../components/app/app-ui';
import { Button } from '../../components/ui/button';
import { buttonVariants } from '../../components/ui/button-variants';
import { formatReportDate } from '../patient-reports/patient-report-format';
import { patientReportTypeLabels } from '../patient-reports/patient-report-types';
import { SectionSkeleton, SectionUnavailable, type PatientHomeSection } from './patient-home';
import type { PatientDashboard, PatientDashboardReport } from './patient-types';

const CORE_VIDEO = '/assets/biomedical/clinora-core-home-cinematic.mp4';
const CORE_POSTER = '/assets/biomedical/clinora-core-home-cinematic-poster.webp';

export function PatientCoreExperience({
  reports,
  reducedMotion,
  onUpload,
}: {
  reports: PatientHomeSection<PatientDashboard>;
  reducedMotion: boolean;
  onUpload: () => void;
}) {
  const dashboard = reports.data;
  const latest = dashboard?.latestReport ?? null;
  const latestTitle = latest ? patientReportDisplayName(latest) : null;
  const latestMeta = latest ? patientReportDisplayMeta(latest) : null;

  return (
    <AppSurface
      as="section"
      variant="hero"
      padding="none"
      aria-label="Patient tools"
      className="relative overflow-hidden"
      data-patient-core-experience="true"
    >
      <CinematicCoreMedia reducedMotion={reducedMotion} />

      <div className="relative z-10 flex min-h-[34rem] flex-col justify-end pt-48 sm:pt-56 lg:min-h-[31rem] lg:pt-52">
        <div className="grid border-t border-[var(--clinora-border-subtle)] bg-[linear-gradient(180deg,rgba(4,20,27,0.72),rgba(4,20,27,0.96)_22%,rgba(4,20,27,0.985))] lg:grid-cols-3">
          <article className="border-b border-[var(--clinora-border-subtle)] bg-[linear-gradient(150deg,rgba(8,145,178,0.08),rgba(15,23,42,0.12)_58%,transparent)] p-5 sm:p-6 lg:border-b-0 lg:border-r">
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
                <p className="mt-1.5 text-sm leading-6 text-[var(--clinora-text-muted)]">
                  Choose a report already stored in Clinora. Clinora extracts reported laboratory values and lets you
                  verify them against the original before later AI-assisted interpretation.
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
            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                to="/patient/analyze"
                className={`${buttonVariants({ variant: 'appPrimary' })} focus-visible:outline-cyan-300`}
              >
                <ScanText size={16} aria-hidden="true" /> Analyze a report <ArrowRight size={15} aria-hidden="true" />
              </Link>
              <Button variant="appSecondary" className="focus-visible:outline-cyan-300" onClick={onUpload}>
                <UploadCloud size={16} aria-hidden="true" /> Upload new report
              </Button>
            </div>
          </article>

          <article className="border-b border-[var(--clinora-border-subtle)] bg-[linear-gradient(150deg,rgba(159,18,57,0.09),rgba(15,23,42,0.12)_58%,transparent)] p-5 sm:p-6 lg:border-b-0 lg:border-r">
            <div className="flex gap-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-rose-300/15 bg-rose-300/[0.075] text-rose-200">
                <Droplets size={18} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-rose-200">Blood Network</p>
                <h2
                  id="patient-blood-network-title"
                  className="mt-1.5 text-lg font-semibold tracking-[-0.025em] text-white sm:text-xl"
                >
                  Nearby help, organized on a live map
                </h2>
                <p className="mt-1.5 text-sm leading-6 text-[var(--clinora-text-muted)]">
                  Create a blood request, alert opted-in Clinora patients with the matching blood group inside a 5 km
                  area, and coordinate after someone accepts.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-medium text-[var(--clinora-text-faint)]">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPinned size={12} aria-hidden="true" /> 5 km proximity matching
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>Contact stays private until acceptance</span>
                </div>
              </div>
            </div>
            <Link
              to="/patient/blood-network"
              className={`${buttonVariants({ variant: 'appSecondary' })} mt-5 border-rose-300/15 bg-rose-300/[0.055] text-rose-100 hover:bg-rose-300/[0.09]`}
            >
              <Droplets size={16} aria-hidden="true" /> Open Blood Network <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </article>

          <article
            className="bg-[linear-gradient(150deg,rgba(8,145,178,0.06),rgba(15,23,42,0.14)_58%,transparent)] p-5 sm:p-6"
            data-medical-reports-panel="true"
          >
            <div className="flex items-start gap-4">
              <IconWell className="h-10 w-10" tone="info">
                <FileText size={19} aria-hidden="true" />
              </IconWell>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--clinora-info-foreground)]">
                    Secure health records
                  </p>
                  {dashboard && dashboard.activeReportCount > 0 ? (
                    <StatusPill tone="info" className="min-h-6 px-2.5 py-0.5 text-[11px]">
                      {dashboard.activeReportCount} active report{dashboard.activeReportCount === 1 ? '' : 's'}
                    </StatusPill>
                  ) : null}
                </div>
                <h2
                  id="medical-reports-title"
                  className="mt-1.5 text-lg font-semibold tracking-[-0.025em] text-white sm:text-xl"
                >
                  Medical reports
                </h2>
                <p className="mt-1.5 text-sm leading-6 text-[var(--clinora-text-muted)]">
                  {latest
                    ? 'Keep your clinical documents securely organised in Clinora.'
                    : 'Upload your first medical report to begin building your health record.'}
                </p>
              </div>
            </div>

            {reports.loading ? <SectionSkeleton /> : null}
            {!reports.loading && reports.error ? (
              <SectionUnavailable message={reports.error} onRetry={reports.retry}>
                <Button variant="appPrimary" onClick={onUpload}>
                  <UploadCloud size={16} aria-hidden="true" /> Upload report
                </Button>
              </SectionUnavailable>
            ) : null}
            {!reports.loading && !reports.error && dashboard ? (
              <div className="mt-4 border-t border-[var(--clinora-border-subtle)] pt-4">
                {latest ? (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--clinora-text-faint)]">
                      Latest report
                    </p>
                    <p className="mt-2 truncate text-sm font-semibold text-[var(--clinora-text-primary)]">
                      {latestTitle}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-[var(--clinora-text-muted)]">{latestMeta}</p>
                  </div>
                ) : null}
                <div className="mt-3.5 flex flex-wrap gap-2.5">
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
          </article>
        </div>
      </div>
    </AppSurface>
  );
}

function CinematicCoreMedia({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 h-[20rem] overflow-hidden sm:h-[23rem] lg:inset-0 lg:h-auto"
      data-core-experience-media="cinematic"
    >
      {reducedMotion ? (
        <img
          src={CORE_POSTER}
          alt=""
          draggable={false}
          className="h-full w-full object-cover object-[58%_48%] opacity-[0.76] saturate-[0.92]"
        />
      ) : (
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={CORE_POSTER}
          tabIndex={-1}
          disablePictureInPicture
          className="h-full w-full object-cover object-[58%_48%] opacity-[0.76] saturate-[0.92]"
        >
          <source src={CORE_VIDEO} type="video/mp4" />
        </video>
      )}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,42,47,0.5)_0%,rgba(5,42,47,0.22)_32%,transparent_62%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,18,24,0.04)_0%,rgba(3,18,24,0.12)_38%,rgba(3,18,24,0.7)_76%,rgba(3,18,24,0.98)_100%)]" />
    </div>
  );
}

function patientReportDisplayName(report: PatientDashboardReport) {
  const reportName = report.reportName.trim();
  if (reportName && !looksLikeOpaqueReportName(reportName)) return reportName;
  return patientReportTypeLabels[report.reportType] ?? 'Medical report';
}

function patientReportDisplayMeta(report: PatientDashboardReport) {
  const reportName = report.reportName.trim();
  const provider = report.providerLaboratory?.trim();
  const typeLabel = patientReportTypeLabels[report.reportType] ?? 'Medical report';
  const dateLabel = report.reportDate
    ? `Report date ${formatReportDate(report.reportDate)}`
    : `Uploaded ${formatShortDate(report.uploadedAt)}`;
  const context = provider || (!reportName || looksLikeOpaqueReportName(reportName) ? null : typeLabel);
  return [context, dateLabel].filter((value): value is string => Boolean(value)).join(' · ');
}

function looksLikeOpaqueReportName(value: string) {
  const trimmed = value.trim();
  const compact = trimmed.replace(/[-_\s]/g, '');
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmed)) {
    return true;
  }
  if (compact.length >= 16 && /^[a-f0-9]+$/i.test(compact)) return true;
  return /^(?:report|file|upload|document|object)[-_]?[a-z0-9]{12,}$/i.test(trimmed);
}

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
