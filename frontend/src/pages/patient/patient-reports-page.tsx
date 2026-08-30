import {
  Archive,
  ArrowRight,
  CircleAlert,
  FileImage,
  FileText,
  FolderArchive,
  MoreHorizontal,
  RotateCcw,
  SearchX,
  UploadCloud,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { AppSurface, EmptyState, IconWell } from '../../components/app/app-ui';
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
import { Select } from '../../components/ui/form';
import { IconButton } from '../../components/ui/icon-button';
import { Pagination, PaginationButton, PaginationStatus } from '../../components/ui/pagination';
import { SearchField } from '../../components/ui/search-field';
import { patientReportApi, patientReportErrorMessage } from '../../features/patient-reports/patient-report-api';
import { PatientReportFirstUse } from '../../features/patient-reports/patient-report-first-use';
import {
  formatFileSize,
  formatReportDate,
  formatReportTimestamp,
  reportFileKind,
} from '../../features/patient-reports/patient-report-format';
import { PatientReportUploadDialog } from '../../features/patient-reports/patient-report-upload-dialog';
import {
  patientReportTypeLabels,
  patientReportTypes,
  type PatientReport,
  type PatientReportCollection,
  type PatientReportPage,
  type PatientReportType,
} from '../../features/patient-reports/patient-report-types';
import { cn } from '../../lib/cn';

export function PatientReportsPage() {
  const [reports, setReports] = useState<PatientReportPage | null>(null);
  const [search, setSearch] = useState('');
  const [reportType, setReportType] = useState<PatientReportType | ''>('');
  const [collection, setCollection] = useState<PatientReportCollection>('ACTIVE');
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busyReportId, setBusyReportId] = useState('');
  const [archiveTarget, setArchiveTarget] = useState<PatientReport | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError('');
    const timer = window.setTimeout(() => {
      patientReportApi
        .list({
          query: search.trim() || undefined,
          reportType: reportType || undefined,
          collection,
          page,
          size: 12,
        })
        .then((result) => {
          if (active) setReports(result);
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
  }, [collection, page, refreshKey, reportType, search]);

  const changeCollection = (next: PatientReportCollection) => {
    setCollection(next);
    setPage(1);
    setActionError('');
  };

  const restore = async (report: PatientReport) => {
    setBusyReportId(report.id);
    setActionError('');
    try {
      await patientReportApi.restore(report.id);
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setActionError(patientReportErrorMessage(error, 'We could not restore this report.'));
    } finally {
      setBusyReportId('');
    }
  };

  const archive = async () => {
    if (!archiveTarget) return;
    setBusyReportId(archiveTarget.id);
    setActionError('');
    try {
      await patientReportApi.archive(archiveTarget.id);
      setArchiveTarget(null);
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setActionError(patientReportErrorMessage(error, 'We could not archive this report.'));
    } finally {
      setBusyReportId('');
    }
  };

  const hasFilters = Boolean(search.trim() || reportType);
  const storedReportCount = reports ? reports.activeCount + reports.archivedCount : 0;
  const firstUse = !loading && !loadError && reports !== null && storedReportCount === 0;
  const showHeaderUpload = !loading && !loadError && storedReportCount > 0;

  return (
    <div className="mx-auto w-full max-w-[1280px] pb-8">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">Medical reports</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--clinora-text-muted)] sm:text-[15px]">
            Store and organize laboratory and diagnostic documents in your private Patient record.
          </p>
        </div>
        {showHeaderUpload ? (
          <Button variant="appPrimary" onClick={() => setUploadOpen(true)}>
            <UploadCloud size={17} aria-hidden="true" /> Upload report
          </Button>
        ) : null}
      </header>

      <div className="mt-8">
        {loading ? <ReportVaultSkeleton /> : null}

        {!loading && loadError ? (
          <AppSurface as="section" variant="elevated">
            <EmptyState
              icon={<CircleAlert size={19} aria-hidden="true" />}
              iconTone="danger"
              title="Reports are unavailable"
              copy={loadError}
              action={
                <Button variant="appSecondary" size="sm" onClick={() => setRefreshKey((value) => value + 1)}>
                  Try again
                </Button>
              }
            />
          </AppSurface>
        ) : null}

        {firstUse ? <PatientReportFirstUse onUpload={() => setUploadOpen(true)} /> : null}

        {!loading && !loadError && reports && storedReportCount > 0 ? (
          <ReportWorkspace
            reports={reports}
            collection={collection}
            search={search}
            reportType={reportType}
            hasFilters={hasFilters}
            actionError={actionError}
            busyReportId={busyReportId}
            onCollectionChange={changeCollection}
            onSearchChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            onReportTypeChange={(value) => {
              setReportType(value);
              setPage(1);
            }}
            onClearFilters={() => {
              setSearch('');
              setReportType('');
              setPage(1);
            }}
            onArchive={setArchiveTarget}
            onRestore={(report) => void restore(report)}
            onPreviousPage={() => setPage((value) => Math.max(1, value - 1))}
            onNextPage={() => setPage((value) => value + 1)}
          />
        ) : null}
      </div>

      <PatientReportUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUploaded={() => {
          setCollection('ACTIVE');
          setPage(1);
          setRefreshKey((value) => value + 1);
        }}
      />

      <Dialog open={Boolean(archiveTarget)} onOpenChange={(open) => !busyReportId && !open && setArchiveTarget(null)}>
        <DialogContent>
          <DialogTitle className="text-xl font-semibold text-white">Archive this report?</DialogTitle>
          <DialogDescription className="text-sm leading-6 text-[var(--clinora-text-muted)]">
            {archiveTarget?.reportName} will leave your current list but remain available in Archived. You can restore
            it anytime.
          </DialogDescription>
          <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setArchiveTarget(null)} disabled={Boolean(busyReportId)}>
              Keep current
            </Button>
            <Button variant="appSecondary" onClick={() => void archive()} disabled={Boolean(busyReportId)}>
              <Archive size={16} aria-hidden="true" /> {busyReportId ? 'Archiving…' : 'Archive report'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReportWorkspace({
  reports,
  collection,
  search,
  reportType,
  hasFilters,
  actionError,
  busyReportId,
  onCollectionChange,
  onSearchChange,
  onReportTypeChange,
  onClearFilters,
  onArchive,
  onRestore,
  onPreviousPage,
  onNextPage,
}: {
  reports: PatientReportPage;
  collection: PatientReportCollection;
  search: string;
  reportType: PatientReportType | '';
  hasFilters: boolean;
  actionError: string;
  busyReportId: string;
  onCollectionChange: (collection: PatientReportCollection) => void;
  onSearchChange: (value: string) => void;
  onReportTypeChange: (value: PatientReportType | '') => void;
  onClearFilters: () => void;
  onArchive: (report: PatientReport) => void;
  onRestore: (report: PatientReport) => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
}) {
  const selectedCollectionCount = collection === 'ACTIVE' ? reports.activeCount : reports.archivedCount;
  const showToolbar = selectedCollectionCount > 0 || hasFilters;

  return (
    <AppSurface as="section" variant="elevated" padding="none" className="min-w-0 overflow-hidden">
      <div className="flex overflow-x-auto border-b border-[var(--clinora-border-subtle)]" role="tablist">
        <CollectionTab
          active={collection === 'ACTIVE'}
          id="current-reports-tab"
          controls="report-collection-panel"
          label="Current"
          count={reports.activeCount}
          onClick={() => onCollectionChange('ACTIVE')}
        />
        <CollectionTab
          active={collection === 'ARCHIVED'}
          id="archived-reports-tab"
          controls="report-collection-panel"
          label="Archived"
          count={reports.archivedCount}
          onClick={() => onCollectionChange('ARCHIVED')}
        />
      </div>

      <div
        id="report-collection-panel"
        role="tabpanel"
        aria-labelledby={collection === 'ACTIVE' ? 'current-reports-tab' : 'archived-reports-tab'}
      >
        {showToolbar ? (
          <div className="grid gap-3 border-b border-[var(--clinora-border-subtle)] px-4 py-4 sm:px-5 md:grid-cols-[minmax(0,1fr)_15rem] md:items-center lg:px-6">
            <SearchField
              aria-label="Search medical reports"
              placeholder="Search by report name, file, or provider"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              onClear={search ? () => onSearchChange('') : undefined}
            />
            <label className="sr-only" htmlFor="report-type-filter">
              Filter by report type
            </label>
            <Select
              id="report-type-filter"
              value={reportType}
              onChange={(event) => onReportTypeChange(event.target.value as PatientReportType | '')}
            >
              <option value="">All report types</option>
              {patientReportTypes.map((type) => (
                <option key={type} value={type}>
                  {patientReportTypeLabels[type]}
                </option>
              ))}
            </Select>
          </div>
        ) : null}

        {collection === 'ARCHIVED' && reports.archivedCount > 0 ? (
          <div className="flex items-start gap-2 border-b border-[var(--clinora-border-subtle)] bg-white/[0.018] px-5 py-3 text-xs leading-5 text-[var(--clinora-text-muted)] lg:px-6">
            <FolderArchive className="mt-0.5 shrink-0 text-[var(--clinora-text-faint)]" size={15} aria-hidden="true" />
            Archived reports remain in your record and can be restored anytime.
          </div>
        ) : null}

        {actionError ? (
          <p role="alert" className="border-b border-rose-400/20 bg-rose-400/[0.05] px-5 py-3 text-sm text-rose-200">
            {actionError}
          </p>
        ) : null}

        {reports.items.length === 0 ? (
          <ReportsEmptyState
            collection={collection}
            hasFilters={hasFilters}
            hasArchivedReports={reports.archivedCount > 0}
            onClear={onClearFilters}
          />
        ) : (
          <div>
            <ReportListHeader />
            <ul aria-label={`${collection === 'ACTIVE' ? 'Current' : 'Archived'} medical reports`}>
              {reports.items.map((report) => (
                <ReportRow
                  key={report.id}
                  report={report}
                  busy={busyReportId === report.id}
                  onArchive={() => onArchive(report)}
                  onRestore={() => onRestore(report)}
                />
              ))}
            </ul>
          </div>
        )}

        {reports.totalPages > 1 ? (
          <Pagination className="border-t border-[var(--clinora-border-subtle)] px-5 py-4">
            <PaginationButton disabled={!reports.hasPrevious} onClick={onPreviousPage}>
              Previous
            </PaginationButton>
            <PaginationStatus>
              Page {reports.page} of {reports.totalPages}
            </PaginationStatus>
            <PaginationButton disabled={!reports.hasNext} onClick={onNextPage}>
              Next
            </PaginationButton>
          </Pagination>
        ) : null}
      </div>
    </AppSurface>
  );
}

function CollectionTab({
  active,
  id,
  controls,
  label,
  count,
  onClick,
}: {
  active: boolean;
  id: string;
  controls: string;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      id={id}
      aria-controls={controls}
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'relative flex min-h-14 shrink-0 items-center gap-2 px-5 text-sm font-semibold transition-colors sm:px-6',
        active ? 'text-white' : 'text-[var(--clinora-text-muted)] hover:text-white',
      )}
    >
      {label}
      <span
        className={cn(
          'min-w-6 rounded-full px-2 py-0.5 text-center text-[11px] tabular-nums',
          active
            ? 'bg-[var(--clinora-info-soft)] text-[var(--clinora-info-foreground)]'
            : 'bg-white/[0.045] text-[var(--clinora-text-faint)]',
        )}
      >
        {count}
      </span>
      {active ? (
        <span className="absolute inset-x-5 bottom-0 h-0.5 rounded-full bg-[var(--clinora-accent-cyan)]" />
      ) : null}
    </button>
  );
}

function ReportListHeader() {
  return (
    <div
      className="hidden min-h-11 grid-cols-[minmax(14rem,1.45fr)_8.5rem_minmax(10rem,0.9fr)_7.5rem_9rem_auto] items-center gap-4 border-b border-[var(--clinora-border-subtle)] bg-black/[0.08] px-6 text-[10px] font-bold uppercase tracking-[0.13em] text-[var(--clinora-text-faint)] lg:grid"
      aria-hidden="true"
    >
      <span>Report</span>
      <span>Report date</span>
      <span>Provider</span>
      <span>File</span>
      <span>Added</span>
      <span className="sr-only">Actions</span>
    </div>
  );
}

function ReportRow({
  report,
  busy,
  onArchive,
  onRestore,
}: {
  report: PatientReport;
  busy: boolean;
  onArchive: () => void;
  onRestore: () => void;
}) {
  const FileIcon = report.mimeType === 'application/pdf' ? FileText : FileImage;

  return (
    <li className="grid gap-4 border-b border-[var(--clinora-border-subtle)] px-4 py-5 transition-colors last:border-b-0 hover:bg-white/[0.018] sm:px-5 lg:grid-cols-[minmax(14rem,1.45fr)_8.5rem_minmax(10rem,0.9fr)_7.5rem_9rem_auto] lg:items-center lg:gap-4 lg:px-6 lg:py-4">
      <div className="flex min-w-0 items-start gap-3">
        <IconWell tone={report.archived ? 'neutral' : 'info'} className="shrink-0">
          <FileIcon size={18} aria-hidden="true" />
        </IconWell>
        <div className="min-w-0">
          <Link
            to={`/patient/reports/${report.id}`}
            className="block truncate text-sm font-semibold text-white hover:text-[var(--clinora-info-foreground)]"
          >
            {report.reportName}
          </Link>
          <p className="mt-1 text-xs text-[var(--clinora-info-foreground)]">
            {patientReportTypeLabels[report.reportType]}
          </p>
          <p className="mt-1.5 truncate text-xs text-[var(--clinora-text-faint)]">{report.originalFilename}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-4 lg:contents">
        <ReportCell label="Report date" value={formatReportDate(report.reportDate)} />
        <ReportCell label="Provider" value={report.providerLaboratory ?? 'Not added'} />
        <ReportCell label="File" value={`${reportFileKind(report)} · ${formatFileSize(report.sizeBytes)}`} />
        <ReportCell label="Added" value={formatReportTimestamp(report.createdAt)} />
      </div>

      <div className="flex items-center justify-end gap-2">
        <Link
          to={`/patient/reports/${report.id}`}
          aria-label={`Open ${report.reportName}`}
          className={buttonVariants({ variant: 'appSecondary', size: 'sm' })}
        >
          Open <ArrowRight size={15} aria-hidden="true" />
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton
              variant="appSecondary"
              size="sm"
              className="min-w-10"
              aria-label={`More actions for ${report.reportName}`}
              disabled={busy}
            >
              <MoreHorizontal size={17} aria-hidden="true" />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {report.archived ? (
              <DropdownMenuItem onSelect={onRestore} disabled={busy}>
                <RotateCcw size={15} aria-hidden="true" /> {busy ? 'Restoring…' : 'Restore report'}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={onArchive} disabled={busy}>
                <Archive size={15} aria-hidden="true" /> Archive report
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}

function ReportCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--clinora-text-faint)] lg:sr-only">
        {label}
      </p>
      <p className="mt-1 break-words text-xs leading-5 text-slate-300 lg:mt-0">{value}</p>
    </div>
  );
}

function ReportsEmptyState({
  collection,
  hasFilters,
  hasArchivedReports,
  onClear,
}: {
  collection: PatientReportCollection;
  hasFilters: boolean;
  hasArchivedReports: boolean;
  onClear: () => void;
}) {
  if (hasFilters) {
    return (
      <EmptyState
        className="px-5 py-10 sm:px-6"
        icon={<SearchX size={19} aria-hidden="true" />}
        title="No matching reports"
        copy="Try another report name, provider, or report type."
        action={
          <Button variant="appSecondary" size="sm" onClick={onClear}>
            Clear filters
          </Button>
        }
      />
    );
  }
  if (collection === 'ARCHIVED') {
    return (
      <EmptyState
        className="px-5 py-10 sm:px-6"
        icon={<FolderArchive size={19} aria-hidden="true" />}
        title="Archive is empty"
        copy="Reports moved out of your current list will remain available here for restoration."
      />
    );
  }
  return (
    <EmptyState
      className="px-5 py-10 sm:px-6"
      icon={<FileText size={19} aria-hidden="true" />}
      title="No current reports"
      copy={
        hasArchivedReports
          ? 'Your reports are currently archived. Open Archived to review or restore them.'
          : 'Upload a report to begin your private medical record.'
      }
    />
  );
}

function ReportVaultSkeleton() {
  return (
    <div role="status" aria-label="Loading medical reports" className="space-y-3">
      <Skeleton className="h-14 rounded-t-[var(--clinora-radius-lg)] rounded-b-none bg-white/[0.045]" />
      <Skeleton className="h-16 rounded-none bg-white/[0.04]" />
      {[0, 1, 2].map((item) => (
        <Skeleton key={item} className="h-24 rounded-[var(--clinora-radius-md)] bg-white/[0.035]" />
      ))}
    </div>
  );
}
