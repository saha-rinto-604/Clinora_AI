import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileImage,
  FileText,
  MoreHorizontal,
  PencilLine,
  Search,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
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
    }, 180);
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
      <div className="mt-4 rounded-[14px] border border-white/[0.065] bg-black/[0.08] p-3.5 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-white">Medical reports</p>
              <span className="rounded-full border border-white/[0.065] bg-white/[0.025] px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                Optional
              </span>
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              {selectedReports.length
                ? `${selectedReports.length} selected for this appointment`
                : 'Nothing is shared unless you choose a report and confirm the appointment.'}
            </p>
          </div>
          <Button type="button" variant="appSecondary" size="sm" disabled={disabled} onClick={() => setOpen(true)}>
            <FileText size={14} aria-hidden="true" />
            {selectedReports.length ? 'Manage reports' : 'Choose reports'}
          </Button>
        </div>

        {selectedReports.length ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {selectedReports.slice(0, 3).map((report) => (
              <li
                key={report.id}
                className="flex max-w-full items-center gap-2 rounded-[10px] border border-cyan-300/[0.1] bg-cyan-300/[0.035] py-1.5 pl-2.5 pr-1.5"
              >
                <span className="max-w-48 truncate text-[11px] font-medium text-slate-300 sm:max-w-64">
                  {patientReportDisplayName(report)}
                </span>
                <button
                  type="button"
                  onClick={() => removeSelected(report.id)}
                  disabled={disabled}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] text-slate-600 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-40"
                  aria-label={`Remove ${patientReportDisplayName(report)} from this appointment`}
                >
                  <X size={13} aria-hidden="true" />
                </button>
              </li>
            ))}
            {selectedReports.length > 3 ? (
              <li className="flex items-center px-1 text-[11px] font-medium text-slate-600">
                +{selectedReports.length - 3} more
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
        <DialogContent className="flex max-h-[82dvh] max-w-5xl flex-col gap-0 overflow-hidden border-white/[0.08] bg-[#07111b] p-0 shadow-[0_30px_100px_rgba(0,0,0,.52)]">
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
              <div className="flex flex-col gap-4 border-b border-white/[0.06] px-5 py-5 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-300">Appointment access</p>
                  <DialogTitle className="mt-1.5 text-xl font-semibold tracking-[-0.025em] text-white sm:text-2xl">
                    Choose medical reports
                  </DialogTitle>
                  <DialogDescription className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">
                    Select only the records you want this Doctor to access for this appointment. Preview and title
                    editing stay available from the row menu.
                  </DialogDescription>
                </div>
                <div className="shrink-0 text-left lg:text-right">
                  <p className="text-2xl font-semibold tabular-nums text-white">{selectedReports.length}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">Selected</p>
                </div>
              </div>

              <div className="border-b border-white/[0.06] px-5 py-3.5 sm:px-6">
                <div className="grid gap-2.5 md:grid-cols-[minmax(0,1fr)_13rem]">
                  <div className="relative">
                    <Search
                      size={15}
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600"
                      aria-hidden="true"
                    />
                    <input
                      value={query}
                      onChange={(event) => {
                        setQuery(event.target.value);
                        setPage(1);
                      }}
                      placeholder="Search reports"
                      className="min-h-10 w-full rounded-[10px] border border-white/[0.07] bg-white/[0.025] pl-10 pr-4 text-sm text-white outline-none placeholder:text-slate-700 focus:border-cyan-300/[0.24] focus:ring-4 focus:ring-cyan-300/[0.04]"
                      aria-label="Search medical reports"
                    />
                  </div>
                  <select
                    value={reportType}
                    onChange={(event) => {
                      setReportType(event.target.value as PatientReportType | '');
                      setPage(1);
                    }}
                    className="min-h-10 rounded-[10px] border border-white/[0.07] bg-white/[0.025] px-3 text-sm text-slate-300 outline-none focus:border-cyan-300/[0.24] focus:ring-4 focus:ring-cyan-300/[0.04]"
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
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3 sm:px-6 clinora-r3-scrollbar">
                {loading && !result ? <ReportPickerSkeleton /> : null}
                {loadError ? (
                  <div className="rounded-[12px] border border-rose-300/[0.12] bg-rose-300/[0.04] p-4">
                    <p role="alert" className="text-sm text-rose-200">
                      {loadError}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mt-2"
                      onClick={() => setRefreshKey((value) => value + 1)}
                    >
                      Try again
                    </Button>
                  </div>
                ) : null}

                {!loading && !loadError && result && result.items.length === 0 ? (
                  <div className="py-10 text-center">
                    <FileText size={22} className="mx-auto text-slate-700" aria-hidden="true" />
                    <p className="mt-3 text-sm font-semibold text-white">
                      {query || reportType ? 'No reports match these filters' : 'No active reports yet'}
                    </p>
                    <p className="mx-auto mt-1.5 max-w-md text-xs leading-5 text-slate-600">
                      {query || reportType
                        ? 'Try a broader search or another report type.'
                        : 'You can still book without sharing a report.'}
                    </p>
                    {!query && !reportType ? (
                      <Link
                        to="/patient/reports"
                        className="mt-4 inline-flex text-xs font-semibold text-cyan-200 hover:text-cyan-100"
                        onClick={() => setOpen(false)}
                      >
                        Open Medical Reports
                      </Link>
                    ) : null}
                  </div>
                ) : null}

                {result?.items.length ? (
                  <>
                    <ul className="divide-y divide-white/[0.055] md:hidden">
                      {result.items.map((report) => {
                        const selected = selectedIds.has(report.id);
                        const selectionLimitReached = !selected && selectedReports.length >= MAX_SELECTED_REPORTS;
                        return (
                          <ReportRowMobile
                            key={report.id}
                            report={report}
                            selected={selected}
                            disabled={selectionLimitReached}
                            onToggle={() => toggle(report)}
                            onPreview={() => setPreviewReport(report)}
                            onEdit={() => setEditTarget(report)}
                          />
                        );
                      })}
                    </ul>
                    <div className="hidden min-w-[42rem] md:block">
                      <div
                        className="grid grid-cols-[2.5rem_minmax(0,1.45fr)_minmax(9rem,.65fr)_minmax(8rem,.55fr)_2.5rem] items-center border-b border-white/[0.055] px-2 py-2 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-700"
                        aria-hidden="true"
                      >
                        <span />
                        <span>Report</span>
                        <span>Type</span>
                        <span>Date</span>
                        <span />
                      </div>
                      <ul className="divide-y divide-white/[0.055]">
                        {result.items.map((report) => {
                          const selected = selectedIds.has(report.id);
                          const selectionLimitReached = !selected && selectedReports.length >= MAX_SELECTED_REPORTS;
                          return (
                            <ReportRow
                              key={report.id}
                              report={report}
                              selected={selected}
                              disabled={selectionLimitReached}
                              onToggle={() => toggle(report)}
                              onPreview={() => setPreviewReport(report)}
                              onEdit={() => setEditTarget(report)}
                            />
                          );
                        })}
                      </ul>
                    </div>
                  </>
                ) : null}
              </div>

              <div className="flex flex-col gap-3 border-t border-white/[0.06] bg-[#050d16]/96 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={!result?.hasPrevious || loading}
                    onClick={() => setPage((value) => Math.max(1, value - 1))}
                    aria-label="Previous report page"
                  >
                    <ChevronLeft size={14} aria-hidden="true" /> Previous
                  </Button>
                  <span className="text-[11px] text-slate-600">
                    {result?.totalPages ? `Page ${result.page} of ${result.totalPages}` : 'Page 1'}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={!result?.hasNext || loading}
                    onClick={() => setPage((value) => value + 1)}
                    aria-label="Next report page"
                  >
                    Next <ChevronRight size={14} aria-hidden="true" />
                  </Button>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      'text-[11px]',
                      selectedReports.length >= MAX_SELECTED_REPORTS ? 'text-amber-200' : 'text-slate-600',
                    )}
                  >
                    {selectedReports.length} of {MAX_SELECTED_REPORTS} selected
                  </span>
                  <Button type="button" variant="appPrimary" size="sm" onClick={() => setOpen(false)}>
                    Done
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

function ReportRowMobile({
  report,
  selected,
  disabled,
  onToggle,
  onPreview,
  onEdit,
}: {
  report: PatientReport;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
  onPreview: () => void;
  onEdit: () => void;
}) {
  const secondary = patientReportSecondaryContext(report);
  return (
    <li className={cn('py-3 transition-colors', selected && 'bg-cyan-300/[0.035]')}>
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onToggle}
          disabled={disabled}
          aria-pressed={selected}
          aria-label={`${selected ? 'Remove' : 'Select'} ${patientReportDisplayName(report)}`}
          className={cn(
            'mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-[9px] border transition',
            selected
              ? 'border-cyan-300/[0.28] bg-cyan-300/[0.1] text-cyan-100'
              : 'border-white/[0.09] bg-white/[0.018] text-transparent',
            disabled && 'cursor-not-allowed opacity-35',
          )}
        >
          <Check size={14} aria-hidden="true" />
        </button>
        <ReportIcon mimeType={report.mimeType} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-100">{patientReportDisplayName(report)}</p>
          <p className="mt-1 text-[11px] text-slate-600">
            {patientReportTypeLabels[report.reportType]} · {formatReportDate(report.reportDate, report.createdAt)}
          </p>
          {secondary.length ? (
            <p className="mt-0.5 truncate text-[10px] text-slate-700">{secondary.join(' · ')}</p>
          ) : null}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`More actions for ${patientReportDisplayName(report)}`}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-[9px] text-slate-600 hover:bg-white/[0.05] hover:text-white"
            >
              <MoreHorizontal size={16} aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onSelect={onPreview}>
              <Eye size={14} aria-hidden="true" /> Preview
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onEdit}>
              <PencilLine size={14} aria-hidden="true" /> Edit title
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}

function ReportRow({
  report,
  selected,
  disabled,
  onToggle,
  onPreview,
  onEdit,
}: {
  report: PatientReport;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
  onPreview: () => void;
  onEdit: () => void;
}) {
  const secondary = patientReportSecondaryContext(report);
  const date = formatReportDate(report.reportDate, report.createdAt);
  return (
    <li
      className={cn(
        'grid grid-cols-[2.5rem_minmax(0,1.45fr)_minmax(9rem,.65fr)_minmax(8rem,.55fr)_2.5rem] items-center px-2 py-2.5 transition-colors',
        selected ? 'bg-cyan-300/[0.04]' : 'hover:bg-white/[0.022]',
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        aria-pressed={selected}
        aria-label={`${selected ? 'Remove' : 'Select'} ${patientReportDisplayName(report)}`}
        className={cn(
          'grid h-8 w-8 place-items-center rounded-[9px] border transition',
          selected
            ? 'border-cyan-300/[0.28] bg-cyan-300/[0.1] text-cyan-100'
            : 'border-white/[0.09] bg-white/[0.018] text-transparent hover:border-cyan-300/[0.2]',
          disabled && 'cursor-not-allowed opacity-35',
        )}
      >
        <Check size={14} aria-hidden="true" />
      </button>

      <div className="flex min-w-0 items-center gap-3 pr-3">
        <ReportIcon mimeType={report.mimeType} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-100" title={patientReportDisplayName(report)}>
            {patientReportDisplayName(report)}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-slate-600">
            {secondary.length ? secondary.join(' · ') : report.originalFilename}
          </p>
        </div>
      </div>

      <p className="truncate pr-3 text-xs text-slate-400">{patientReportTypeLabels[report.reportType]}</p>
      <p className="text-xs tabular-nums text-slate-500">{date}</p>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`More actions for ${patientReportDisplayName(report)}`}
            className="grid h-9 w-9 place-items-center rounded-[9px] text-slate-600 transition hover:bg-white/[0.05] hover:text-white"
          >
            <MoreHorizontal size={16} aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onSelect={onPreview}>
            <Eye size={14} aria-hidden="true" /> Preview
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onEdit}>
            <PencilLine size={14} aria-hidden="true" /> Edit title
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
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
    <div className="flex max-h-[82dvh] min-h-[62dvh] flex-col">
      <div className="border-b border-white/[0.06] px-5 py-4 sm:px-6">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-9 items-center gap-2 text-xs font-semibold text-slate-500 transition hover:text-white"
        >
          <ArrowLeft size={14} aria-hidden="true" /> Back to reports
        </button>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <DialogTitle className="truncate text-lg font-semibold tracking-[-0.02em] text-white sm:text-xl">
              {patientReportDisplayName(report)}
            </DialogTitle>
            <DialogDescription className="mt-1 text-xs leading-5 text-slate-500">
              {[patientReportTypeLabels[report.reportType], ...secondary].join(' · ')}
            </DialogDescription>
          </div>
          <Button type="button" variant="appSecondary" size="sm" onClick={onEdit}>
            <PencilLine size={14} aria-hidden="true" /> Edit title
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-black/20 p-3 sm:p-4 clinora-r3-scrollbar">
        {loading ? <Skeleton className="h-[55vh] rounded-[12px]" /> : null}
        {error ? (
          <div className="mx-auto max-w-lg rounded-[12px] border border-rose-300/[0.12] bg-rose-300/[0.04] p-5 text-center">
            <p role="alert" className="text-sm text-rose-200">
              {error}
            </p>
          </div>
        ) : null}
        {!loading && !error && url ? (
          report.mimeType === 'application/pdf' ? (
            <iframe
              src={url}
              title={`Preview ${patientReportDisplayName(report)}`}
              className="h-[58vh] min-h-[27rem] w-full rounded-[12px] border border-white/[0.07] bg-white"
            />
          ) : (
            <div className="grid min-h-[50vh] place-items-center rounded-[12px] border border-white/[0.07] bg-black/30 p-3">
              <img
                src={url}
                alt={`Preview of ${patientReportDisplayName(report)}`}
                className="max-h-[58vh] max-w-full rounded-[10px] object-contain"
              />
            </div>
          )
        ) : null}
      </div>

      <div className="border-t border-white/[0.06] px-5 py-3 sm:px-6">
        <p className="truncate text-[11px] text-slate-700">
          Original file: <span className="text-slate-500">{report.originalFilename}</span>
        </p>
      </div>
    </div>
  );
}

function ReportIcon({ mimeType }: { mimeType: PatientReport['mimeType'] }) {
  const Icon = mimeType === 'application/pdf' ? FileText : FileImage;
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border border-white/[0.055] bg-white/[0.02] text-cyan-200">
      <Icon size={15} aria-hidden="true" />
    </span>
  );
}

function formatReportDate(reportDate: string | null, createdAt: string) {
  const value = reportDate ? `${reportDate}T00:00:00` : createdAt;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Date unavailable';
  return parsed.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function ReportPickerSkeleton() {
  return (
    <div className="grid gap-1" role="status" aria-label="Loading medical reports">
      <Skeleton className="h-16 rounded-[10px]" />
      <Skeleton className="h-16 rounded-[10px]" />
      <Skeleton className="h-16 rounded-[10px]" />
    </div>
  );
}
