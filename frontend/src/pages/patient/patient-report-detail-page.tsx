import {
  Archive,
  ArrowLeft,
  CircleAlert,
  Download,
  FileImage,
  FileText,
  LockKeyhole,
  MoreHorizontal,
  Pencil,
  RefreshCcw,
  RotateCcw,
  ScanText,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { AppSurface, EmptyState, IconWell, StatusPill } from '../../components/app/app-ui';
import { Button } from '../../components/ui/button';
import { buttonVariants } from '../../components/ui/button-variants';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { Skeleton } from '../../components/ui/feedback';
import { IconButton } from '../../components/ui/icon-button';
import { PatientReportMetadataDialog } from '../../features/patient-reports/patient-report-metadata-dialog';
import { patientReportApi, patientReportErrorMessage } from '../../features/patient-reports/patient-report-api';
import {
  formatFileSize,
  formatReportDate,
  formatReportTimestamp,
  reportFileKind,
  saveBlob,
} from '../../features/patient-reports/patient-report-format';
import { patientReportTypeLabels, type PatientReport } from '../../features/patient-reports/patient-report-types';

export function PatientReportDetailPage() {
  const { reportId } = useParams();
  const [report, setReport] = useState<PatientReport | null>(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewError, setPreviewError] = useState('');
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewKey, setPreviewKey] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let active = true;
    if (!reportId) {
      setLoadError('That medical report could not be found.');
      setLoading(false);
      return () => {
        active = false;
      };
    }
    setLoading(true);
    setLoadError('');
    patientReportApi
      .detail(reportId)
      .then((result) => {
        if (active) setReport(result);
      })
      .catch((error) => {
        if (active) setLoadError(patientReportErrorMessage(error, 'We could not load this medical report.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reportId]);

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    if (!reportId || !report?.id) return () => undefined;
    setPreviewLoading(true);
    setPreviewError('');
    setPreviewUrl('');
    patientReportApi
      .content(reportId)
      .then((blob) => {
        if (typeof URL.createObjectURL !== 'function') {
          throw new Error('Preview is not supported by this browser.');
        }
        objectUrl = URL.createObjectURL(blob);
        if (active) setPreviewUrl(objectUrl);
      })
      .catch((error) => {
        if (active) setPreviewError(patientReportErrorMessage(error, 'The secure preview is temporarily unavailable.'));
      })
      .finally(() => {
        if (active) setPreviewLoading(false);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [previewKey, report?.id, reportId]);

  const download = async () => {
    if (!reportId || !report) return;
    setDownloading(true);
    setActionError('');
    try {
      const blob = await patientReportApi.download(reportId);
      saveBlob(blob, report.originalFilename);
    } catch (error) {
      setActionError(patientReportErrorMessage(error, 'We could not download this report.'));
    } finally {
      setDownloading(false);
    }
  };

  const archive = async () => {
    if (!reportId) return;
    setActionLoading(true);
    setActionError('');
    try {
      const updated = await patientReportApi.archive(reportId);
      setReport(updated);
      setArchiveOpen(false);
    } catch (error) {
      setActionError(patientReportErrorMessage(error, 'We could not archive this report.'));
    } finally {
      setActionLoading(false);
    }
  };

  const restore = async () => {
    if (!reportId) return;
    setActionLoading(true);
    setActionError('');
    try {
      setReport(await patientReportApi.restore(reportId));
    } catch (error) {
      setActionError(patientReportErrorMessage(error, 'We could not restore this report.'));
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <DetailSkeleton />;

  if (loadError || !report) {
    return (
      <AppSurface as="section" variant="elevated" className="mx-auto max-w-3xl">
        <EmptyState
          icon={<CircleAlert size={19} aria-hidden="true" />}
          iconTone="danger"
          title="Report unavailable"
          copy={loadError || 'That medical report could not be found.'}
          action={
            <Link to="/patient/reports" className={buttonVariants({ variant: 'appSecondary' })}>
              Back to reports
            </Link>
          }
        />
      </AppSurface>
    );
  }

  const FileIcon = report.mimeType === 'application/pdf' ? FileText : FileImage;

  return (
    <div className="mx-auto w-full max-w-[1280px] pb-8">
      <Link
        to="/patient/reports"
        className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-[var(--clinora-text-muted)] hover:text-white"
      >
        <ArrowLeft size={16} aria-hidden="true" /> Back to medical reports
      </Link>

      <header className="mt-5 flex flex-col gap-5 border-b border-[var(--clinora-border-subtle)] pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <IconWell tone={report.archived ? 'neutral' : 'info'} className="h-12 w-12 shrink-0">
            <FileIcon size={21} aria-hidden="true" />
          </IconWell>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--clinora-info-foreground)]">
                {patientReportTypeLabels[report.reportType]}
              </p>
              {report.archived ? (
                <StatusPill tone="neutral">Archived</StatusPill>
              ) : (
                <StatusPill tone="success">Current</StatusPill>
              )}
            </div>
            <h1 className="mt-2 break-words text-3xl font-semibold tracking-[-0.04em] text-white">
              {report.reportName}
            </h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[var(--clinora-text-muted)]">
              <span>{formatReportDate(report.reportDate)}</span>
              {report.providerLaboratory ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{report.providerLaboratory}</span>
                </>
              ) : null}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          {!report.archived ? (
            <Link to={`/patient/analyze/${report.id}`} className={buttonVariants({ variant: 'appPrimary' })}>
              <ScanText size={16} aria-hidden="true" /> Analyze report
            </Link>
          ) : null}
          <Button variant="appSecondary" onClick={() => void download()} disabled={downloading}>
            <Download size={16} aria-hidden="true" /> {downloading ? 'Downloading…' : 'Download'}
          </Button>
          <Button variant="appSecondary" onClick={() => setEditOpen(true)}>
            <Pencil size={16} aria-hidden="true" /> Edit details
          </Button>
          {report.archived ? (
            <Button variant="appSecondary" onClick={() => void restore()} disabled={actionLoading}>
              <RotateCcw size={16} aria-hidden="true" /> Restore
            </Button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <IconButton variant="appSecondary" aria-label="More report actions">
                  <MoreHorizontal size={18} aria-hidden="true" />
                </IconButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setArchiveOpen(true)}>
                  <Archive size={15} aria-hidden="true" /> Archive report
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>

      {report.archived ? (
        <div className="mt-5 rounded-[var(--clinora-radius-md)] border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-nested)] px-4 py-3 text-sm text-[var(--clinora-text-muted)]">
          This report is preserved in your archive and can be restored to your current report library at any time.
        </div>
      ) : null}
      {actionError ? (
        <p role="alert" className="mt-5 text-sm text-rose-300">
          {actionError}
        </p>
      ) : null}

      <div className="mt-6 grid items-start gap-5 lg:grid-cols-12 lg:gap-6">
        <AppSurface
          as="section"
          variant="elevated"
          padding="none"
          className="min-w-0 lg:col-span-8"
          aria-labelledby="report-preview-title"
        >
          <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-5">
            <div>
              <h2 id="report-preview-title" className="text-lg font-semibold text-white">
                Document preview
              </h2>
              <p className="mt-1 truncate text-xs text-[var(--clinora-text-faint)]">{report.originalFilename}</p>
            </div>
            <StatusPill tone="info">{reportFileKind(report)}</StatusPill>
          </div>
          <div className="min-h-[32rem] overflow-hidden border-t border-[var(--clinora-border-subtle)] bg-slate-950/65 lg:min-h-[42rem]">
            {previewLoading ? <Skeleton className="h-[42rem] rounded-none bg-white/[0.035]" /> : null}
            {!previewLoading && previewError ? (
              <div className="grid min-h-[32rem] place-items-center p-6">
                <EmptyState
                  icon={<CircleAlert size={19} aria-hidden="true" />}
                  iconTone="warning"
                  title="Preview unavailable"
                  copy={previewError}
                  action={
                    <div className="flex flex-wrap gap-2">
                      <Button variant="appSecondary" size="sm" onClick={() => setPreviewKey((value) => value + 1)}>
                        <RefreshCcw size={15} aria-hidden="true" /> Try preview again
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => void download()}>
                        <Download size={15} aria-hidden="true" /> Download instead
                      </Button>
                    </div>
                  }
                />
              </div>
            ) : null}
            {!previewLoading && !previewError && previewUrl && report.mimeType === 'application/pdf' ? (
              <iframe
                title={`Preview of ${report.reportName}`}
                src={`${previewUrl}#toolbar=1&navpanes=0`}
                className="h-[42rem] w-full bg-white"
              />
            ) : null}
            {!previewLoading && !previewError && previewUrl && report.mimeType !== 'application/pdf' ? (
              <div className="grid min-h-[32rem] place-items-center p-3 lg:min-h-[42rem]">
                <img
                  src={previewUrl}
                  alt={`Preview of ${report.reportName}`}
                  className="max-h-[40rem] max-w-full object-contain"
                />
              </div>
            ) : null}
          </div>
        </AppSurface>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:col-span-4">
          <AppSurface as="section" aria-labelledby="report-details-title">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="report-details-title" className="text-lg font-semibold text-white">
                  Report details
                </h2>
                <p className="mt-1 text-xs leading-5 text-[var(--clinora-text-faint)]">
                  Information used to organize this document.
                </p>
              </div>
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--clinora-success-soft)] text-[var(--clinora-success-foreground)]"
                title="Private document"
              >
                <LockKeyhole size={16} aria-hidden="true" />
              </span>
            </div>
            <div className="mt-5 flex items-start gap-2 rounded-[var(--clinora-radius-md)] bg-[var(--clinora-surface-nested)] px-3 py-3 text-xs leading-5 text-[var(--clinora-text-muted)]">
              <LockKeyhole
                className="mt-0.5 shrink-0 text-[var(--clinora-success-foreground)]"
                size={14}
                aria-hidden="true"
              />
              Loaded through your signed-in Patient session. No public file link is exposed.
            </div>
            <dl className="mt-5 divide-y divide-[var(--clinora-border-subtle)] border-y border-[var(--clinora-border-subtle)]">
              <ReportDetail label="Report date" value={formatReportDate(report.reportDate)} />
              <ReportDetail label="Type" value={patientReportTypeLabels[report.reportType]} />
              <ReportDetail label="Provider or laboratory" value={report.providerLaboratory ?? 'Not added'} />
              <ReportDetail label="Original file" value={report.originalFilename} />
              <ReportDetail label="File" value={`${reportFileKind(report)} · ${formatFileSize(report.sizeBytes)}`} />
              <ReportDetail label="Uploaded" value={formatReportTimestamp(report.createdAt)} />
            </dl>
          </AppSurface>
        </aside>
      </div>

      <PatientReportMetadataDialog report={report} open={editOpen} onOpenChange={setEditOpen} onUpdated={setReport} />
      <Dialog open={archiveOpen} onOpenChange={(open) => !actionLoading && setArchiveOpen(open)}>
        <DialogContent>
          <DialogTitle className="text-xl font-semibold text-white">Archive this report?</DialogTitle>
          <DialogDescription className="text-sm leading-6 text-[var(--clinora-text-muted)]">
            It will leave your current report list but remain safely preserved in your archive. You can restore it
            anytime.
          </DialogDescription>
          <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setArchiveOpen(false)} disabled={actionLoading}>
              Keep current
            </Button>
            <Button variant="appSecondary" onClick={() => void archive()} disabled={actionLoading}>
              <Archive size={16} aria-hidden="true" /> {actionLoading ? 'Archiving…' : 'Archive report'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReportDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-3.5">
      <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--clinora-text-faint)]">{label}</dt>
      <dd className="mt-1.5 break-words text-sm leading-6 text-slate-200">{value}</dd>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div role="status" aria-label="Loading medical report" className="mx-auto w-full max-w-[1280px]">
      <Skeleton className="h-28 rounded-[var(--clinora-radius-lg)] bg-white/[0.045]" />
      <div className="mt-6 grid gap-5 lg:grid-cols-12">
        <Skeleton className="h-[44rem] rounded-[var(--clinora-radius-lg)] bg-white/[0.04] lg:col-span-8" />
        <Skeleton className="h-96 rounded-[var(--clinora-radius-lg)] bg-white/[0.04] lg:col-span-4" />
      </div>
    </div>
  );
}
