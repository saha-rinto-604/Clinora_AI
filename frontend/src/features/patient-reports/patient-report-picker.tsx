import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileImage,
  FileText,
  PencilLine,
  Search,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../components/ui/dialog';
import { Skeleton } from '../../components/ui/feedback';
import { cn } from '../../lib/cn';
import { PatientReportMetadataDialog } from './patient-report-metadata-dialog';
import { patientReportApi, patientReportErrorMessage } from './patient-report-api';
import {
  patientReportDisplayName,
  patientReportSecondaryContext,
  patientReportTypeLabels,
  patientReportTypes,
  type PatientReport,
  type PatientReportPage,
  type PatientReportType,
} from './patient-report-types';

const PAGE_SIZE = 12;
const MAX_SELECTED_REPORTS = 20;

type Props = {
  selectedReports: PatientReport[];
  onChange: (reports: PatientReport[]) => void;
  disabled?: boolean;
};

export function PatientReportPicker({ selectedReports, onChange, disabled = false }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [reportType, setReportType] = useState<PatientReportType | ''>('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PatientReportPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [previewReport, setPreviewReport] = useState<PatientReport | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [editTarget, setEditTarget] = useState<PatientReport | null>(null);

  const selectedIds = useMemo(() => new Set(selectedReports.map((report) => report.id)), [selectedReports]);

  useEffect(() => {
    if (!open || previewReport) return;
    let active = true;
    setLoading(true);
    setLoadError('');
    setResult(null);
    const timer = window.setTimeout(() => {
      patientReportApi
        .list({
          collection: 'ACTIVE',
          page,
          size: PAGE_SIZE,
          query: query.trim() || undefined,
          reportType: reportType || undefined,
        })
        .then((data) => {
          if (!active) return;
          setResult(data);
          if (page > 1 && data.totalPages > 0 && page > data.totalPages) setPage(data.totalPages);
        })
        .catch((error) => {
          if (active) setLoadError(patientReportErrorMessage(error, 'We could not load your medical reports.'));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 220);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [open, page, previewReport, query, refreshKey, reportType]);

  useEffect(() => {
    if (!open || !previewReport) {
      setPreviewUrl(null);
      setPreviewLoading(false);
      setPreviewError('');
      return;
    }

    let active = true;
    let objectUrl: string | null = null;
    setPreviewLoading(true);
    setPreviewError('');
    setPreviewUrl(null);

    patientReportApi
      .content(previewReport.id)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      })
      .catch((error) => {
        if (active) setPreviewError(patientReportErrorMessage(error, 'We could not preview this report.'));
      })
      .finally(() => {
        if (active) setPreviewLoading(false);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, previewReport]);

  const toggle = (report: PatientReport) => {
    if (selectedIds.has(report.id)) {
      onChange(selectedReports.filter((item) => item.id !== report.id));
      return;
    }
    if (selectedReports.length >= MAX_SELECTED_REPORTS) return;
    onChange([...selectedReports, report]);
  };

  const updateReport = (updated: PatientReport) => {
    setResult((current) =>
      current ? { ...current, items: current.items.map((item) => (item.id === updated.id ? updated : item)) } : current,
    );
    if (selectedIds.has(updated.id)) {
      onChange(selectedReports.map((item) => (item.id === updated.id ? updated : item)));
    }
    if (previewReport?.id === updated.id) setPreviewReport(updated);
    setRefreshKey((current) => current + 1);
  };

  const removeSelected = (reportId: string) => {
    onChange(selectedReports.filter((report) => report.id !== reportId));
  };

  return (
    <>
      <div className="mt-5 rounded-2xl border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-nested)] p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-white">
              {selectedReports.length ? `${selectedReports.length} report${selectedReports.length === 1 ? '' : 's'} selected` : 'No reports selected'}
            </p>
            <p className="mt-1 text-xs leading-5 text-[var(--clinora-text-faint)]">
              Optional. Nothing is shared with the Doctor until you confirm this appointment.
            </p>
          </div>
          <Button type="button" variant="appSecondary" disabled={disabled} onClick={() => setOpen(true)}>
            <FileText size={15} aria-hidden="true" />
            {selectedReports.length ? 'Change reports' : 'Choose reports'}
          </Button>
        </div>

        {selectedReports.length ? (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {selectedReports.slice(0, 4).map((report) => {
              const secondary = patientReportSecondaryContext(report);
              return (
              <li
                key={report.id}
                className="flex min-w-0 items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5"
              >
                <ReportIcon mimeType={report.mimeType} compact />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-slate-200">
                    {patientReportDisplayName(report)}
                  </span>
                  {secondary.length ? (
                    <span className="mt-0.5 block truncate text-[10px] text-[var(--clinora-text-faint)]">
                      {secondary.join(' · ')}
                    </span>
                  ) : null}
                </span>
                <button
                  type="button"
                  onClick={() => removeSelected(report.id)}
                  disabled={disabled}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-500 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-40"
                  aria-label={`Remove ${patientReportDisplayName(report)} from this appointment`}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </li>
              );
            })}
            {selectedReports.length > 4 ? (
              <li className="flex min-h-10 items-center px-1 text-xs font-medium text-[var(--clinora-text-muted)]">
                +{selectedReports.length - 4} more selected
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setPreviewReport(null);
        }}
      >
        <DialogContent className="flex max-h-[90dvh] max-w-4xl flex-col gap-0 overflow-hidden p-0">
          {previewReport ? (
            <ReportPreview
              report={previewReport}
              url={previewUrl}
              loading={previewLoading}
              error={previewError}
              onBack={() => setPreviewReport(null)}
              onEdit={() => setEditTarget(previewReport)}
            />
          ) : (
            <>
              <div className="border-b border-[var(--clinora-border-subtle)] px-5 py-5 sm:px-7">
                <DialogTitle className="text-xl font-semibold text-white">Choose reports to share</DialogTitle>
                <DialogDescription className="mt-2 max-w-2xl text-sm leading-6 text-[var(--clinora-text-muted)]">
                  Search by a recognizable title or provider, filter by report type, and use the displayed report date to identify the right document. Original filenames stay secondary.
                </DialogDescription>
              </div>

              <div className="border-b border-[var(--clinora-border-subtle)] px-5 py-4 sm:px-7">
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_14rem]">
                  <div className="relative">
                    <Search
                      size={16}
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
                      aria-hidden="true"
                    />
                    <input
                      value={query}
                      onChange={(event) => {
                        setQuery(event.target.value);
                        setPage(1);
                      }}
                      placeholder="Search title, provider, or original filename"
                      className="min-h-11 w-full rounded-xl border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-nested)] pl-10 pr-4 text-sm text-white outline-none placeholder:text-slate-600 focus:border-[var(--clinora-border-interactive)] focus:ring-4 focus:ring-[var(--clinora-focus-ring-soft)]"
                      aria-label="Search medical reports"
                    />
                  </div>
                  <select
                    value={reportType}
                    onChange={(event) => {
                      setReportType(event.target.value as PatientReportType | '');
                      setPage(1);
                    }}
                    className="min-h-11 rounded-xl border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-nested)] px-3 text-sm text-white outline-none focus:border-[var(--clinora-border-interactive)] focus:ring-4 focus:ring-[var(--clinora-focus-ring-soft)]"
                    aria-label="Filter medical reports by type"
                  >
                    <option value="">All report types</option>
                    {patientReportTypes.map((type) => (
                      <option key={type} value={type}>
                        {patientReportTypeLabels[type]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--clinora-text-faint)]">
                  <span>
                    {result ? `${result.totalItems} matching report${result.totalItems === 1 ? '' : 's'}` : 'Loading reports…'}
                  </span>
                  <span>{selectedReports.length} of {MAX_SELECTED_REPORTS} selected for this appointment</span>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">
                {loading && !result ? <ReportPickerSkeleton /> : null}
                {loadError ? (
                  <div className="rounded-2xl border border-rose-300/15 bg-rose-300/[0.05] p-4">
                    <p role="alert" className="text-sm text-rose-200">
                      {loadError}
                    </p>
                    <Button type="button" variant="ghost" className="mt-2" onClick={() => setRefreshKey((v) => v + 1)}>
                      Try again
                    </Button>
                  </div>
                ) : null}
                {!loading && !loadError && result && result.items.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[var(--clinora-border-subtle)] px-5 py-10 text-center">
                    <FileText size={22} className="mx-auto text-slate-500" aria-hidden="true" />
                    <p className="mt-3 text-sm font-semibold text-white">
                      {query || reportType ? 'No reports match these filters' : 'No active reports yet'}
                    </p>
                    <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-[var(--clinora-text-muted)]">
                      {query || reportType
                        ? 'Try a broader search or another report type.'
                        : 'You can still book this appointment without a report.'}
                    </p>
                    {!query && !reportType ? (
                      <Link
                        to="/patient/reports"
                        className="mt-4 inline-flex text-xs font-semibold text-[var(--clinora-info-foreground)] hover:underline"
                        onClick={() => setOpen(false)}
                      >
                        Open Medical Reports
                      </Link>
                    ) : null}
                  </div>
                ) : null}
                {result?.items.length ? (
                  <ul className="grid gap-3">
                    {result.items.map((report) => {
                      const selected = selectedIds.has(report.id);
                      const selectionLimitReached = !selected && selectedReports.length >= MAX_SELECTED_REPORTS;
                      const secondary = patientReportSecondaryContext(report);
                      return (
                        <li
                          key={report.id}
                          className={cn(
                            'rounded-2xl border p-4 transition sm:p-5',
                            selected
                              ? 'border-cyan-300/25 bg-cyan-300/[0.055]'
                              : 'border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-nested)] hover:border-white/[0.13]',
                          )}
                        >
                          <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
                            <ReportIcon mimeType={report.mimeType} />
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="min-w-0 truncate text-sm font-semibold text-white">
                                  {patientReportDisplayName(report)}
                                </h3>
                                {selected ? (
                                  <span className="inline-flex items-center gap-1 rounded-full border border-teal-300/15 bg-teal-300/[0.06] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-teal-100">
                                    <Check size={11} aria-hidden="true" /> Selected
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-1 text-xs font-medium text-[var(--clinora-info-foreground)]">
                                {patientReportTypeLabels[report.reportType]}
                              </p>
                              {secondary.length ? (
                                <p className="mt-1 truncate text-xs text-[var(--clinora-text-muted)]">{secondary.join(' · ')}</p>
                              ) : null}
                            </div>
                            <div className="flex flex-wrap gap-2 sm:justify-end">
                              <Button type="button" variant="ghost" onClick={() => setPreviewReport(report)}>
                                <Eye size={14} aria-hidden="true" /> Preview
                              </Button>
                              <Button type="button" variant="ghost" onClick={() => setEditTarget(report)}>
                                <PencilLine size={14} aria-hidden="true" /> Edit title
                              </Button>
                              <Button
                                type="button"
                                variant={selected ? 'appSecondary' : 'appPrimary'}
                                onClick={() => toggle(report)}
                                aria-pressed={selected}
                                disabled={selectionLimitReached}
                                title={selectionLimitReached ? `You can share up to ${MAX_SELECTED_REPORTS} reports per appointment.` : undefined}
                              >
                                {selected ? 'Remove' : selectionLimitReached ? 'Limit reached' : 'Select'}
                              </Button>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>

              <div className="flex flex-col gap-3 border-t border-[var(--clinora-border-subtle)] bg-[var(--clinora-bg-chrome)]/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={!result?.hasPrevious || loading}
                    onClick={() => setPage((value) => Math.max(1, value - 1))}
                    aria-label="Previous report page"
                  >
                    <ChevronLeft size={15} aria-hidden="true" /> Previous
                  </Button>
                  <span className="text-xs text-[var(--clinora-text-faint)]">
                    {result?.totalPages ? `Page ${result.page} of ${result.totalPages}` : 'Page 1'}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={!result?.hasNext || loading}
                    onClick={() => setPage((value) => value + 1)}
                    aria-label="Next report page"
                  >
                    Next <ChevronRight size={15} aria-hidden="true" />
                  </Button>
                </div>
                <div className="flex flex-col items-start gap-2 sm:items-end">
                  {selectedReports.length >= MAX_SELECTED_REPORTS ? (
                    <p className="text-[11px] text-amber-100">Maximum {MAX_SELECTED_REPORTS} reports per appointment.</p>
                  ) : null}
                  <Button type="button" variant="appPrimary" onClick={() => setOpen(false)}>
                    Done · {selectedReports.length} selected
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {editTarget ? (
        <PatientReportMetadataDialog
          report={editTarget}
          open
          onOpenChange={(next) => {
            if (!next) setEditTarget(null);
          }}
          onUpdated={(updated) => {
            updateReport(updated);
            setEditTarget(null);
          }}
        />
      ) : null}
    </>
  );
}

function ReportPreview({
  report,
  url,
  loading,
  error,
  onBack,
  onEdit,
}: {
  report: PatientReport;
  url: string | null;
  loading: boolean;
  error: string;
  onBack: () => void;
  onEdit: () => void;
}) {
  const secondary = patientReportSecondaryContext(report);
  return (
    <div className="flex max-h-[90dvh] min-h-[60dvh] flex-col">
      <div className="border-b border-[var(--clinora-border-subtle)] px-5 py-4 sm:px-7">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-9 items-center gap-2 text-xs font-semibold text-[var(--clinora-text-muted)] transition hover:text-white"
        >
          <ArrowLeft size={14} aria-hidden="true" /> Back to reports
        </button>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <DialogTitle className="truncate text-xl font-semibold text-white">{patientReportDisplayName(report)}</DialogTitle>
            <DialogDescription className="mt-1 text-xs leading-5 text-[var(--clinora-text-muted)]">
              {[patientReportTypeLabels[report.reportType], ...secondary].join(' · ')}
            </DialogDescription>
          </div>
          <Button type="button" variant="appSecondary" onClick={onEdit}>
            <PencilLine size={14} aria-hidden="true" /> Edit title
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-black/20 p-4 sm:p-6">
        {loading ? <Skeleton className="h-[58vh] rounded-2xl" /> : null}
        {error ? (
          <div className="mx-auto max-w-lg rounded-2xl border border-rose-300/15 bg-rose-300/[0.05] p-5 text-center">
            <p role="alert" className="text-sm text-rose-200">{error}</p>
          </div>
        ) : null}
        {!loading && !error && url ? (
          report.mimeType === 'application/pdf' ? (
            <iframe
              src={url}
              title={`Preview ${patientReportDisplayName(report)}`}
              className="h-[62vh] min-h-[28rem] w-full rounded-2xl border border-white/[0.08] bg-white"
            />
          ) : (
            <div className="grid min-h-[50vh] place-items-center rounded-2xl border border-white/[0.08] bg-black/30 p-3">
              <img
                src={url}
                alt={`Preview of ${patientReportDisplayName(report)}`}
                className="max-h-[62vh] max-w-full rounded-xl object-contain"
              />
            </div>
          )
        ) : null}
      </div>

      <div className="border-t border-[var(--clinora-border-subtle)] px-5 py-3 sm:px-7">
        <p className="truncate text-[11px] text-[var(--clinora-text-faint)]">
          Original file: <span className="text-slate-400">{report.originalFilename}</span>
        </p>
      </div>
    </div>
  );
}

function ReportIcon({ mimeType, compact = false }: { mimeType: PatientReport['mimeType']; compact?: boolean }) {
  const Icon = mimeType === 'application/pdf' ? FileText : FileImage;
  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center rounded-xl border border-white/[0.06] bg-[var(--clinora-info-soft)] text-[var(--clinora-info-foreground)]',
        compact ? 'h-8 w-8' : 'h-11 w-11',
      )}
    >
      <Icon size={compact ? 14 : 17} aria-hidden="true" />
    </span>
  );
}

function ReportPickerSkeleton() {
  return (
    <div className="grid gap-3" role="status" aria-label="Loading medical reports">
      <Skeleton className="h-24 rounded-2xl" />
      <Skeleton className="h-24 rounded-2xl" />
      <Skeleton className="h-24 rounded-2xl" />
    </div>
  );
}
