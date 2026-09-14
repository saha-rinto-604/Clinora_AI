import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Eye,
  FileCheck2,
  FlaskConical,
  FileText,
  Maximize2,
  Minus,
  PencilLine,
  Plus,
  RefreshCw,
  Search,
  ScanText,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Button } from '../../components/ui/button';
import { cn } from '../../lib/cn';
import {
  patientReportExtractionApi,
  patientReportExtractionErrorMessage,
} from '../../features/patient-reports/patient-report-extraction-api';
import type {
  PatientReportExtraction,
  PatientReportObservation,
  PatientReportObservationCorrectionInput,
} from '../../features/patient-reports/patient-report-extraction-types';
import { patientReportApi, patientReportErrorMessage } from '../../features/patient-reports/patient-report-api';
import { PatientReportUploadDialog } from '../../features/patient-reports/patient-report-upload-dialog';
import {
  patientReportDisplayName,
  patientReportSubjectLabel,
  patientReportTypeLabels,
  type PatientReport,
} from '../../features/patient-reports/patient-report-types';
import './patient-report-analysis-processing.css';
import './patient-report-reference-workspaces.css';
export function PatientReportAnalysisPage() {
  const { reportId } = useParams();
  return reportId ? <AnalysisWorkspace reportId={reportId} /> : <AnalysisStart />;
}

function AnalysisStart() {
  const navigate = useNavigate();
  const [personalReports, setPersonalReports] = useState<PatientReport[]>([]);
  const [otherReports, setOtherReports] = useState<PatientReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [reportTypeFilter, setReportTypeFilter] = useState<'' | PatientReport['reportType']>('');
  const [sortOrder, setSortOrder] = useState<'report-date' | 'uploaded'>('report-date');

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [personalPage, otherPage] = await Promise.all([
        patientReportApi.list({ collection: 'ACTIVE', subjectType: 'SELF', page: 1, size: 4 }),
        patientReportApi.list({
          collection: 'ACTIVE',
          subjectType: 'OTHER',
          reportType: reportTypeFilter || undefined,
          query: query.trim() || undefined,
          page: 1,
          size: 12,
        }),
      ]);
      setPersonalReports(personalPage.items);
      setOtherReports(otherPage.items);
    } catch (requestError) {
      setError(patientReportErrorMessage(requestError, 'Your medical reports could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }, [query, reportTypeFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadReports(), 180);
    return () => window.clearTimeout(timer);
  }, [loadReports]);

  const sortedOtherReports = useMemo(() => {
    return otherReports.filter((report) => report.subjectType === 'OTHER').sort((left, right) => {
      if (sortOrder === 'uploaded') return Date.parse(right.createdAt) - Date.parse(left.createdAt);
      const leftDate = left.reportDate ? Date.parse(`${left.reportDate}T00:00:00Z`) : Date.parse(left.createdAt);
      const rightDate = right.reportDate ? Date.parse(`${right.reportDate}T00:00:00Z`) : Date.parse(right.createdAt);
      return rightDate - leftDate;
    });
  }, [otherReports, sortOrder]);

  return (
    <div className="clinora-report-start-reference">
      <header className="clinora-report-start-reference__header">
        <div className="clinora-report-start-reference__copy">
          <div className="clinora-reference-eyebrow">
            <ScanText size={14} aria-hidden="true" /> Clinora AI analysis
          </div>
          <h1>Analyze a medical report</h1>
          <p>
            Upload your laboratory report, verify the values, and get clear, patient-friendly insights powered by Clinora AI.
          </p>
        </div>
        <div className="clinora-report-start-reference__art" aria-hidden="true" />
      </header>

      <section className="clinora-report-start-reference__launch" aria-labelledby="analysis-start-title">
        <div className="clinora-report-start-reference__launch-main">
          <span className="clinora-reference-icon-well">
            <UploadCloud size={20} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 id="analysis-start-title">Start with your report</h2>
            <p>
              Upload a PDF, JPG or PNG, or choose a report already saved in Medical Reports. The original remains unchanged while you review Clinora&apos;s analysis.
            </p>
          </div>
          <div className="clinora-report-start-reference__launch-actions">
            <Button variant="appPrimary" onClick={() => setUploadOpen(true)}>
              <UploadCloud size={16} aria-hidden="true" /> Upload report
            </Button>
            <a href="#existing-reports" className="clinora-reference-secondary-button">
              Choose existing <ChevronRight size={15} aria-hidden="true" />
            </a>
          </div>
        </div>
        <div className="clinora-report-start-reference__steps" aria-label="Report analysis workflow">
          <div><strong>1 · Extract</strong><span>Clinora reads reported laboratory values.</span></div>
          <ChevronRight size={15} aria-hidden="true" />
          <div><strong>2 · Verify</strong><span>Compare uncertain values with the source.</span></div>
          <ChevronRight size={15} aria-hidden="true" />
          <div><strong>3 · Understand</strong><span>Get a clear, patient-friendly insight after verification.</span></div>
        </div>
      </section>

      {error ? (
        <div className="clinora-reference-error" role="alert">
          {error}{' '}
          <button type="button" onClick={() => void loadReports()}>Try again</button>
        </div>
      ) : null}

      <section id="existing-reports" className="clinora-report-library-reference scroll-mt-24" aria-labelledby="personal-lab-reports-title">
        <div className="clinora-report-library-reference__heading">
          <span className="clinora-reference-icon-well"><UserRound size={19} aria-hidden="true" /></span>
          <div>
            <h2 id="personal-lab-reports-title">Personal lab reports</h2>
            <p>Reports that belong to you and can contribute to your own Clinora Health Record.</p>
          </div>
          <Link to="/patient/reports" className="clinora-report-library-reference__view-all">
            View all <ChevronRight size={14} aria-hidden="true" />
          </Link>
        </div>
        <ReportPreviewRows
          reports={personalReports}
          loading={loading}
          emptyText="No personal reports are ready for analysis yet."
          onAnalyze={(report) => navigate(`/patient/analyze/${report.id}`)}
        />
      </section>

      <section className="clinora-report-library-reference" aria-labelledby="other-lab-reports-title">
        <div className="clinora-report-library-reference__heading clinora-report-library-reference__heading--filters">
          <span className="clinora-reference-icon-well"><UsersRound size={19} aria-hidden="true" /></span>
          <div>
            <h2 id="other-lab-reports-title">Other lab reports</h2>
            <p>Reports uploaded for family members or someone else. These stay separate from your own Clinora Health Record.</p>
          </div>
          <div className="clinora-report-library-reference__filters" aria-label="Filter other reports">
            <label>
              <span className="sr-only">Report type</span>
              <select
                value={reportTypeFilter}
                onChange={(event) => setReportTypeFilter(event.target.value as '' | PatientReport['reportType'])}
              >
                <option value="">All report types</option>
                {Object.entries(patientReportTypeLabels).map(([type, label]) => (
                  <option key={type} value={type}>{label}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="sr-only">Sort reports</span>
              <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value as 'report-date' | 'uploaded')}>
                <option value="report-date">Sort by date</option>
                <option value="uploaded">Recently uploaded</option>
              </select>
            </label>
          </div>
          <Link to="/patient/reports" className="clinora-report-library-reference__view-all">
            View all <ChevronRight size={14} aria-hidden="true" />
          </Link>
        </div>
        <div className="clinora-report-library-reference__search">
          <Search size={15} aria-hidden="true" />
          <label className="sr-only" htmlFor="analysis-report-search">Search reports</label>
          <input
            id="analysis-report-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search reports, providers or person labels"
          />
        </div>
        <ReportPreviewRows
          reports={sortedOtherReports}
          loading={loading}
          emptyText="No other-person reports match these filters."
          onAnalyze={(report) => navigate(`/patient/analyze/${report.id}`)}
        />
      </section>

      <PatientReportUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUploaded={(report) => navigate(`/patient/analyze/${report.id}`)}
      />
    </div>
  );
}

function ReportPreviewRows({
  reports,
  loading,
  emptyText,
  onAnalyze,
}: {
  reports: PatientReport[];
  loading: boolean;
  emptyText: string;
  onAnalyze: (report: PatientReport) => void;
}) {
  if (loading) {
    return <div className="clinora-report-library-reference__empty">Loading reports…</div>;
  }
  if (!reports.length) {
    return <div className="clinora-report-library-reference__empty">{emptyText}</div>;
  }
  return (
    <div className="clinora-report-library-reference__rows">
      {reports.map((report) => (
        <button key={report.id} type="button" className="clinora-report-library-reference__row" onClick={() => onAnalyze(report)}>
          <span className="clinora-report-library-reference__file"><FileText size={17} aria-hidden="true" /></span>
          <span className="clinora-report-library-reference__identity">
            <strong>{patientReportDisplayName(report)}</strong>
            <span>{report.providerLaboratory?.trim() || patientReportTypeLabels[report.reportType]}</span>
          </span>
          <span className="clinora-report-library-reference__fact">
            <CalendarDays size={14} aria-hidden="true" />
            <span><strong>{report.reportDate ? formatDate(report.reportDate) : formatUploadedDate(report.createdAt)}</strong><small>{report.reportDate ? 'Report date' : 'Uploaded'}</small></span>
          </span>
          <span className="clinora-report-library-reference__fact">
            <FlaskConical size={14} aria-hidden="true" />
            <span><strong>{patientReportTypeLabels[report.reportType]}</strong><small>Report type</small></span>
          </span>
          <span className={cn('clinora-report-library-reference__subject', (report.subjectType ?? 'SELF') === 'OTHER' && 'is-other')}>
            {(report.subjectType ?? 'SELF') === 'SELF' ? <UserRound size={13} aria-hidden="true" /> : <UsersRound size={13} aria-hidden="true" />}
            {patientReportSubjectLabel(report)}
          </span>
          <span className="clinora-report-library-reference__analyze">Analyze <ChevronRight size={14} aria-hidden="true" /></span>
        </button>
      ))}
    </div>
  );
}

function AnalysisWorkspace({ reportId }: { reportId: string }) {
  const [report, setReport] = useState<PatientReport | null>(null);
  const [extraction, setExtraction] = useState<PatientReportExtraction | null>(null);
  const [sourceUrl, setSourceUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState('');
  const [error, setError] = useState('');
  const [selectedObservationId, setSelectedObservationId] = useState<string | null>(null);
  const [editingObservationId, setEditingObservationId] = useState<string | null>(null);
  const [showReviewHelp, setShowReviewHelp] = useState(false);

  const load = useCallback(async () => {
    try {
      const [nextReport, nextExtraction] = await Promise.all([
        patientReportApi.detail(reportId),
        patientReportExtractionApi.get(reportId),
      ]);
      setReport(nextReport);
      setExtraction(nextExtraction);
      setError('');
    } catch (requestError) {
      setError(patientReportExtractionErrorMessage(requestError, 'This report analysis could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }, [reportId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let active = true;
    let nextUrl = '';
    void patientReportApi
      .content(reportId)
      .then((blob) => {
        if (!active) return;
        nextUrl = URL.createObjectURL(blob);
        setSourceUrl(nextUrl);
      })
      .catch(() => undefined);
    return () => {
      active = false;
      if (nextUrl) URL.revokeObjectURL(nextUrl);
    };
  }, [reportId]);

  const extractionStatus = extraction?.status;

  useEffect(() => {
    if (!extractionStatus || !['QUEUED', 'PROCESSING'].includes(extractionStatus)) return;
    const timer = window.setInterval(() => {
      void patientReportExtractionApi
        .get(reportId)
        .then((next) => {
          setExtraction(next);
          if (!['QUEUED', 'PROCESSING'].includes(next.status)) window.clearInterval(timer);
        })
        .catch(() => undefined);
    }, 2200);
    return () => window.clearInterval(timer);
  }, [extractionStatus, reportId]);

  const selectedObservation = useMemo(
    () => extraction?.observations.find((item) => item.id === selectedObservationId) ?? null,
    [extraction?.observations, selectedObservationId],
  );
  const unresolved =
    extraction?.observations.filter((item) => item.reviewRequired && item.verificationStatus === 'UNREVIEWED').length ??
    0;

  useEffect(() => {
    if (selectedObservationId || extraction?.status !== 'SUCCEEDED' || !extraction.observations.length) return;
    const firstReview = extraction.observations.find(
      (item) => item.reviewRequired && item.verificationStatus === 'UNREVIEWED',
    );
    setSelectedObservationId((firstReview ?? extraction.observations[0]).id);
  }, [extraction, selectedObservationId]);

  const reviewRows = useMemo(() => {
    if (!extraction) return [];
    return [...extraction.observations].sort(
      (a, b) =>
        Number(b.reviewRequired && b.verificationStatus === 'UNREVIEWED') -
        Number(a.reviewRequired && a.verificationStatus === 'UNREVIEWED'),
    );
  }, [extraction]);

  async function startExtraction() {
    setAction('start');
    setError('');
    try {
      setExtraction(await patientReportExtractionApi.start(reportId));
    } catch (requestError) {
      setError(patientReportExtractionErrorMessage(requestError, 'Report extraction could not be started.'));
    } finally {
      setAction('');
    }
  }

  async function confirmExtraction() {
    setAction('confirm');
    setError('');
    try {
      setExtraction(await patientReportExtractionApi.confirm(reportId));
    } catch (requestError) {
      setError(patientReportExtractionErrorMessage(requestError, 'The extracted results could not be confirmed.'));
    } finally {
      setAction('');
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-[var(--clinora-border-subtle)] p-6 text-sm text-[var(--clinora-text-muted)]">
        Loading report analysis…
      </div>
    );
  }

  if (!report || !extraction) {
    return <AnalysisLoadError message={error || 'This report analysis is unavailable.'} />;
  }

  return (
    <div className="clinora-report-review-reference">
      <header className="clinora-report-review-reference__header">
        <div className="clinora-report-review-reference__identity">
          <Link to="/patient/analyze" className="clinora-report-review-reference__back">
            <ArrowLeft size={14} aria-hidden="true" /> Back to AI Report Analysis
          </Link>
          <div className="clinora-report-review-reference__title-line">
            <h1>{patientReportDisplayName(report)}</h1>
            <span>{patientReportTypeLabels[report.reportType]}</span>
          </div>
          <p>
            {patientReportTypeLabels[report.reportType]}
            <span aria-hidden="true"> · </span>
            Uploaded {formatUploadedDate(report.createdAt)}
            {report.providerLaboratory ? <><span aria-hidden="true"> · </span>{report.providerLaboratory}</> : null}
          </p>
        </div>
        <AnalysisProgress extraction={extraction} />
      </header>

      {error ? <div className="clinora-reference-error" role="alert">{error}</div> : null}

      {extraction.status === 'NOT_REQUESTED' ? (
        <StartExtractionPanel busy={action === 'start'} onStart={() => void startExtraction()} />
      ) : null}

      {['QUEUED', 'PROCESSING'].includes(extraction.status) ? <ProcessingPanel status={extraction.status} /> : null}

      {extraction.status === 'FAILED' ? (
        <FailurePanel failureCode={extraction.failureCode} busy={action === 'start'} onRetry={() => void startExtraction()} />
      ) : null}

      {extraction.status === 'SUCCEEDED' && extraction.observations.length ? (
        <>
          <div className="clinora-report-review-reference__workspace">
            <ReportSourceViewer
              report={report}
              sourceUrl={sourceUrl}
              selected={selectedObservation}
              pageCount={extraction.pageCount ?? 1}
            />

            <section className="clinora-report-review-reference__results" aria-labelledby="review-what-clinora-read-title">
              <div className="clinora-report-review-reference__results-head">
                <div>
                  <p className="clinora-reference-section-label">Extracted results</p>
                  <h2 id="review-what-clinora-read-title">Review what Clinora read</h2>
                  <p>Compare important values with the original report. Corrections change Clinora&apos;s transcription, not your original document.</p>
                </div>
                <button
                  type="button"
                  className="clinora-report-review-reference__help"
                  aria-expanded={showReviewHelp}
                  onClick={() => setShowReviewHelp((value) => !value)}
                >
                  <CircleAlert size={14} aria-hidden="true" /> How to review?
                </button>
              </div>

              {showReviewHelp ? (
                <div className="clinora-report-review-reference__help-note">
                  Select a row to locate it on the source. Confirm values that match the report, or edit only Clinora&apos;s transcription when something was read incorrectly.
                </div>
              ) : null}

              <div className="clinora-report-review-reference__summary" aria-live="polite">
                <span className="clinora-reference-icon-well"><FileText size={18} aria-hidden="true" /></span>
                <div>
                  <strong>{extraction.observations.length} <span>results extracted</span></strong>
                  <small className={unresolved ? 'needs-review' : 'complete'}>
                    {unresolved ? `${unresolved} ${unresolved === 1 ? 'needs' : 'need'} review` : 'All flagged values have been reviewed'}
                  </small>
                </div>
              </div>

              <div className="clinora-report-review-reference__table-head" aria-hidden="true">
                <span>Test</span><span>Result</span><span>Reference on report</span><span>Action</span>
              </div>
              <div className="clinora-report-review-reference__rows">
                {reviewRows.map((observation) => (
                  <ObservationCard
                    key={observation.id}
                    observation={observation}
                    selected={observation.id === selectedObservationId}
                    editing={observation.id === editingObservationId}
                    onSelect={() => setSelectedObservationId(observation.id)}
                    onEdit={() => {
                      setSelectedObservationId(observation.id);
                      setEditingObservationId(observation.id);
                    }}
                    onCancelEdit={() => setEditingObservationId(null)}
                    onSaved={(next) => {
                      setExtraction(next);
                      setEditingObservationId(null);
                      setSelectedObservationId(observation.id);
                    }}
                    reportId={reportId}
                  />
                ))}
              </div>
            </section>
          </div>

          <section className="clinora-report-review-reference__confirm-bar">
            <div>
              <span className="clinora-report-review-reference__confirm-icon"><ShieldCheck size={20} aria-hidden="true" /></span>
              <span>
                <strong>{extraction.reviewStatus === 'VERIFIED' ? 'Report data verified' : 'Confirm the extracted results'}</strong>
                <small>
                  {extraction.reviewStatus === 'VERIFIED'
                    ? 'Your reviewed values are ready for Clinora AI insight.'
                    : unresolved
                      ? `Review ${unresolved} flagged ${unresolved === 1 ? 'value' : 'values'} before confirmation.`
                      : 'All extracted values are ready for your confirmation.'}
                </small>
              </span>
            </div>
            {extraction.reviewStatus === 'VERIFIED' ? (
              <Link to={`/patient/analyze/${reportId}/insight`} className="clinora-reference-primary-button">
                <Sparkles size={16} aria-hidden="true" /> Open AI insight <ChevronRight size={15} aria-hidden="true" />
              </Link>
            ) : (
              <Button variant="appPrimary" onClick={() => void confirmExtraction()} disabled={Boolean(unresolved) || action === 'confirm'}>
                <FileCheck2 size={16} aria-hidden="true" /> {action === 'confirm' ? 'Confirming…' : 'Confirm extracted results'}
              </Button>
            )}
          </section>
        </>
      ) : null}

      {extraction.status === 'SUCCEEDED' && !extraction.observations.length ? <NoStructuredResults /> : null}
    </div>
  );

}

function StartExtractionPanel({ busy, onStart }: { busy: boolean; onStart: () => void }) {
  return (
    <section className="overflow-hidden rounded-[var(--clinora-radius-lg)] border border-cyan-300/15 bg-[var(--clinora-surface-raised)]">
      <div className="grid gap-8 p-6 lg:grid-cols-[1fr_auto] lg:items-center lg:p-8">
        <div className="flex gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--clinora-info-soft)] text-[var(--clinora-info-foreground)]">
            <ScanText size={22} aria-hidden="true" />
          </span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--clinora-info-foreground)]">
              Secure report extraction
            </p>
            <h2 className="mt-2 text-xl font-semibold text-white">Organize the information in this report</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--clinora-text-muted)]">
              Clinora will read the document, identify laboratory-style results and preserve where each value came from
              so you can verify it against the original.
            </p>
            <p className="mt-3 text-xs text-[var(--clinora-text-faint)]">
              Your original report remains unchanged. AI insight becomes available only after you verify the extracted
              values.
            </p>
          </div>
        </div>
        <Button variant="appPrimary" onClick={onStart} disabled={busy}>
          <ScanText size={16} aria-hidden="true" /> {busy ? 'Queuing…' : 'Extract report data'}
        </Button>
      </div>
    </section>
  );
}

function ProcessingPanel({ status }: { status: PatientReportExtraction['status'] }) {
  const queued = status === 'QUEUED';
  return (
    <section
      className="clinora-ocr-processing overflow-hidden rounded-[28px] border border-cyan-300/15 bg-[var(--clinora-surface-raised)]"
      aria-live="polite"
      data-ocr-status={queued ? 'queued' : 'processing'}
    >
      <div className="grid gap-0 lg:grid-cols-[minmax(300px,0.86fr)_minmax(0,1.14fr)]">
        <div className="relative border-b border-white/[0.07] bg-[linear-gradient(145deg,rgba(34,211,238,0.07),rgba(255,255,255,0.018))] p-6 sm:p-8 lg:border-b-0 lg:border-r">
          <div className="mx-auto max-w-sm">
            <div className="flex items-center justify-between gap-3 text-[11px] font-semibold text-slate-400">
              <span className="inline-flex items-center gap-2"><FileText size={14} className="text-cyan-200" aria-hidden="true" /> Source document</span>
              <span className="rounded-full border border-cyan-300/15 bg-cyan-300/[0.06] px-2.5 py-1 text-cyan-100">
                {queued ? 'Queued securely' : 'Reading now'}
              </span>
            </div>
            <div className="relative mt-5 aspect-[4/5] overflow-hidden rounded-[22px] border border-white/[0.09] bg-[#07101d] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.32)]">
              <div className="h-3 w-2/5 rounded-full bg-white/[0.11]" />
              <div className="mt-3 h-2 w-3/5 rounded-full bg-white/[0.06]" />
              <div className="mt-7 grid grid-cols-[1.25fr_0.7fr_0.8fr] gap-2 border-b border-white/[0.07] pb-2">
                <span className="h-2 rounded-full bg-cyan-200/20" />
                <span className="h-2 rounded-full bg-cyan-200/12" />
                <span className="h-2 rounded-full bg-cyan-200/12" />
              </div>
              <div className="space-y-4 pt-4" aria-hidden="true">
                {[86, 72, 91, 64, 79, 68].map((width, index) => (
                  <div key={width + index} className="grid grid-cols-[1.25fr_0.7fr_0.8fr] items-center gap-2">
                    <span className="h-2 rounded-full bg-white/[0.08]" style={{ width: `${width}%` }} />
                    <span className="h-2 rounded-full bg-white/[0.055]" />
                    <span className="h-2 rounded-full bg-white/[0.045]" />
                  </div>
                ))}
              </div>
              {queued ? <span className="clinora-ocr-queue-glow" aria-hidden="true" /> : <span className="clinora-ocr-scan-band" aria-hidden="true" />}
              <div className="absolute inset-x-5 bottom-5 flex items-center gap-2 rounded-xl border border-emerald-300/10 bg-emerald-400/[0.05] px-3 py-2 text-[10px] font-semibold text-emerald-200">
                <ShieldCheck size={13} aria-hidden="true" /> Original document stays unchanged
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8 lg:p-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/[0.06] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-100">
            <ScanText size={13} aria-hidden="true" /> Document extraction
          </span>
          <h2 className="mt-5 text-2xl font-semibold tracking-[-0.03em] text-white sm:text-3xl">
            {queued ? 'Your report is queued securely' : 'Reading and organizing your report'}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--clinora-text-muted)]">
            {queued
              ? 'Clinora has your report and will begin extraction automatically when the private document worker is available.'
              : 'Clinora is locating laboratory-style text and values so you can compare the transcription with the original before any AI insight is requested.'}
          </p>

          <div className="mt-7 space-y-3">
            <ExtractionStatusRow icon={CheckCircle2} title="Report secured" text="The uploaded source is stored privately and remains unchanged." state="complete" />
            <ExtractionStatusRow
              icon={queued ? RefreshCw : ScanText}
              title={queued ? 'Waiting for extraction' : 'Reading document data'}
              text={queued ? 'No extraction is running yet.' : 'Text and laboratory-style results are being organized for review.'}
              state={queued ? 'waiting' : 'active'}
            />
            <ExtractionStatusRow icon={FileCheck2} title="Your review comes next" text="You will confirm or correct extracted values before clinical AI reasoning can begin." state="next" />
          </div>

          <div className="mt-7 border-t border-white/[0.07] pt-5 text-xs leading-6 text-[var(--clinora-text-faint)]">
            This is document extraction, not prediction. Clinora AI insight starts only after you verify the extracted report data.
          </div>
        </div>
      </div>
    </section>
  );
}

function ExtractionStatusRow({
  icon: Icon,
  title,
  text,
  state,
}: {
  icon: typeof ScanText;
  title: string;
  text: string;
  state: 'complete' | 'active' | 'waiting' | 'next';
}) {
  return (
    <div className="flex gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
      <span
        className={cn(
          'mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl',
          state === 'complete' && 'bg-emerald-400/[0.08] text-emerald-300',
          state === 'active' && 'bg-cyan-300/[0.09] text-cyan-200',
          state === 'waiting' && 'bg-white/[0.045] text-slate-400',
          state === 'next' && 'bg-white/[0.035] text-slate-500',
        )}
      >
        <Icon size={17} className={state === 'active' ? 'animate-pulse motion-reduce:animate-none' : ''} aria-hidden="true" />
      </span>
      <div>
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="mt-1 text-xs leading-5 text-[var(--clinora-text-muted)]">{text}</p>
      </div>
    </div>
  );
}

function FailurePanel({
  failureCode,
  busy,
  onRetry,
}: {
  failureCode: string | null;
  busy: boolean;
  onRetry: () => void;
}) {
  return (
    <section className="rounded-[var(--clinora-radius-lg)] border border-amber-300/15 bg-amber-300/[0.045] p-6 sm:p-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <CircleAlert size={21} className="mt-0.5 shrink-0 text-amber-300" aria-hidden="true" />
          <div>
            <h2 className="text-lg font-semibold text-white">We couldn't reliably read this report</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--clinora-text-muted)]">
              The original report is safe and unchanged. Try again, or open the original document if the scan or PDF
              needs attention.
            </p>
            {failureCode ? (
              <p className="mt-2 text-[11px] text-[var(--clinora-text-faint)]">Reference: {failureCode}</p>
            ) : null}
          </div>
        </div>
        <Button variant="appPrimary" onClick={onRetry} disabled={busy}>
          <RefreshCw size={16} aria-hidden="true" /> {busy ? 'Queuing…' : 'Try again'}
        </Button>
      </div>
    </section>
  );
}

function ReportSourceViewer({
  report,
  sourceUrl,
  selected,
  pageCount,
}: {
  report: PatientReport;
  sourceUrl: string;
  selected: PatientReportObservation | null;
  pageCount: number;
}) {
  const [zoom, setZoom] = useState(100);
  const [visiblePage, setVisiblePage] = useState(selected?.pageNumber ?? 1);

  useEffect(() => {
    if (selected?.pageNumber) setVisiblePage(selected.pageNumber);
  }, [selected?.pageNumber]);

  const safePageCount = Math.max(1, pageCount || 1);
  const page = Math.min(Math.max(1, visiblePage), safePageCount);
  const changeZoom = (delta: number) => setZoom((value) => Math.min(160, Math.max(70, value + delta)));

  return (
    <section className="clinora-report-review-reference__source">
      <div className="clinora-report-review-reference__source-head">
        <div>
          <h2>Original report</h2>
          <p>{selected ? `Source for ${selected.label}` : 'Select a result to locate its source.'}</p>
        </div>
        <div className="clinora-report-review-reference__viewer-tools" aria-label="Document view controls">
          <button type="button" onClick={() => changeZoom(-10)} aria-label="Zoom out" disabled={zoom <= 70}>
            <Minus size={15} aria-hidden="true" />
          </button>
          <span>{zoom}%</span>
          <button type="button" onClick={() => changeZoom(10)} aria-label="Zoom in" disabled={zoom >= 160}>
            <Plus size={15} aria-hidden="true" />
          </button>
          <a href={sourceUrl || undefined} target="_blank" rel="noreferrer" aria-label="Open source report in new tab" className={!sourceUrl ? 'is-disabled' : ''}>
            <Maximize2 size={15} aria-hidden="true" />
          </a>
        </div>
      </div>

      <div className="clinora-report-review-reference__document-stage">
        {!sourceUrl ? (
          <div className="clinora-report-review-reference__document-loading">Loading original report…</div>
        ) : report.mimeType === 'application/pdf' ? (
          <iframe
            title={`Original report: ${patientReportDisplayName(report)}`}
            src={`${sourceUrl}#page=${page}&zoom=${zoom}`}
            className="clinora-report-review-reference__pdf"
          />
        ) : (
          <div className="clinora-report-review-reference__image-scroll">
            <div className="clinora-report-review-reference__image-wrap" style={{ width: `${zoom}%` }}>
              <img src={sourceUrl} alt={`Original report: ${patientReportDisplayName(report)}`} />
              {selected?.boundingBox && selected.pageNumber === page ? (
                <span
                  aria-hidden="true"
                  className="clinora-report-review-reference__source-highlight"
                  style={{
                    left: `${selected.boundingBox.x * 100}%`,
                    top: `${selected.boundingBox.y * 100}%`,
                    width: `${selected.boundingBox.width * 100}%`,
                    height: `${selected.boundingBox.height * 100}%`,
                  }}
                />
              ) : null}
            </div>
          </div>
        )}
      </div>

      <div className="clinora-report-review-reference__page-nav">
        <button type="button" onClick={() => setVisiblePage((value) => Math.max(1, value - 1))} disabled={page <= 1} aria-label="Previous report page">
          <ChevronLeft size={15} aria-hidden="true" />
        </button>
        <span>Page {page} of {safePageCount}</span>
        <button type="button" onClick={() => setVisiblePage((value) => Math.min(safePageCount, value + 1))} disabled={page >= safePageCount} aria-label="Next report page">
          <ChevronRight size={15} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}

function ObservationCard({
  observation,
  selected,
  editing,
  onSelect,
  onEdit,
  onCancelEdit,
  onSaved,
  reportId,
}: {
  observation: PatientReportObservation;
  selected: boolean;
  editing: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSaved: (value: PatientReportExtraction) => void;
  reportId: string;
}) {
  const needsReview = observation.reviewRequired && observation.verificationStatus === 'UNREVIEWED';
  const corrected = observation.verificationStatus === 'PATIENT_CORRECTED';
  const confirmed = observation.verificationStatus === 'PATIENT_CONFIRMED';
  const [confirming, setConfirming] = useState(false);
  const [reviewError, setReviewError] = useState('');

  async function confirmUnchanged() {
    setConfirming(true);
    setReviewError('');
    try {
      onSaved(await patientReportExtractionApi.confirmObservation(reportId, observation.id));
    } catch (requestError) {
      setReviewError(patientReportExtractionErrorMessage(requestError, 'This extracted value could not be confirmed.'));
    } finally {
      setConfirming(false);
    }
  }

  return (
    <article
      className={cn(
        'clinora-report-review-reference__observation',
        needsReview && 'needs-review',
        selected && 'is-selected',
      )}
    >
      <button type="button" className="clinora-report-review-reference__observation-main" onClick={onSelect} aria-pressed={selected}>
        <span className="clinora-report-review-reference__test">
          <span className="clinora-report-review-reference__test-line">
            <strong>{observation.label}</strong>
            {needsReview ? <span className="clinora-report-review-reference__review-badge">Needs review</span> : null}
            {corrected ? <span className="clinora-report-review-reference__status-badge corrected">Corrected</span> : null}
            {confirmed ? <span className="clinora-report-review-reference__status-badge confirmed">Confirmed</span> : null}
          </span>
          <small>Page {observation.pageNumber}</small>
        </span>
        <span className="clinora-report-review-reference__result-value">{observationValue(observation)}</span>
        <span className="clinora-report-review-reference__reference-value">
          {observation.referenceRangeRaw ?? 'Not confidently captured — compare with source'}
          {rangeLabel(observation.derivedRangeFlag) ? (
            <small className={rangeTone(observation.derivedRangeFlag)}>{rangeLabel(observation.derivedRangeFlag)}</small>
          ) : null}
        </span>
      </button>

      <div className="clinora-report-review-reference__row-actions">
        {needsReview ? (
          <button type="button" onClick={() => void confirmUnchanged()} disabled={confirming} className="is-confirm">
            {confirming ? <RefreshCw size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <CheckCircle2 size={14} aria-hidden="true" />}
            {confirming ? 'Confirming…' : 'Looks correct'}
          </button>
        ) : confirmed || corrected ? (
          <span className="clinora-report-review-reference__reviewed-label"><CheckCircle2 size={14} aria-hidden="true" /> Reviewed</span>
        ) : null}
        <button type="button" onClick={onEdit} disabled={confirming}>
          <PencilLine size={14} aria-hidden="true" /> Edit result
        </button>
        <button type="button" onClick={onSelect}>
          <Eye size={14} aria-hidden="true" /> View on report
        </button>
      </div>

      {reviewError ? <p role="alert" className="clinora-report-review-reference__row-error">{reviewError}</p> : null}
      {editing ? (
        <div className="clinora-report-review-reference__editor">
          <CorrectionEditor observation={observation} reportId={reportId} onCancel={onCancelEdit} onSaved={onSaved} />
        </div>
      ) : null}
    </article>
  );
}

function CorrectionEditor({
  observation,
  reportId,
  onCancel,
  onSaved,
}: {
  observation: PatientReportObservation;
  reportId: string;
  onCancel: () => void;
  onSaved: (value: PatientReportExtraction) => void;
}) {
  const [label, setLabel] = useState(observation.label);
  const [valueType, setValueType] = useState<PatientReportObservation['valueType']>(observation.valueType);
  const [numericValue, setNumericValue] = useState(observation.numericValue?.toString() ?? '');
  const [textValue, setTextValue] = useState(observation.textValue ?? '');
  const [comparator, setComparator] = useState(observation.comparator ?? '');
  const [unit, setUnit] = useState(observation.unit ?? '');
  const [rangeRaw, setRangeRaw] = useState(observation.referenceRangeRaw ?? '');
  const [rangeLow, setRangeLow] = useState(observation.referenceLow?.toString() ?? '');
  const [rangeHigh, setRangeHigh] = useState(observation.referenceHigh?.toString() ?? '');
  const [sourceFlag, setSourceFlag] = useState(observation.sourceFlag ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    setError('');
    if (!label.trim()) {
      setError('Enter the test or result name shown on the report.');
      return;
    }
    const numeric = optionalNumber(numericValue);
    const low = optionalNumber(rangeLow);
    const high = optionalNumber(rangeHigh);
    if (valueType === 'NUMERIC' && numeric === undefined) {
      setError('Enter a valid numeric result, for example 10.4.');
      return;
    }
    if (valueType !== 'NUMERIC' && !textValue.trim()) {
      setError('Enter the text value shown on the report.');
      return;
    }
    if ((rangeLow.trim() && low === undefined) || (rangeHigh.trim() && high === undefined)) {
      setError('Enter valid numeric reference-range values.');
      return;
    }
    if (low != null && high != null && high < low) {
      setError('The upper reference value must be greater than or equal to the lower value.');
      return;
    }
    const input: PatientReportObservationCorrectionInput = {
      label: label.trim(),
      valueType,
      numericValue: valueType === 'NUMERIC' ? (numeric ?? null) : null,
      textValue: valueType === 'NUMERIC' ? null : textValue.trim() || null,
      comparator: valueType === 'NUMERIC' ? comparator.trim() || null : null,
      unit: unit.trim() || null,
      referenceRangeRaw: rangeRaw.trim() || null,
      referenceLow: low ?? null,
      referenceHigh: high ?? null,
      sourceFlag: sourceFlag.trim() || null,
    };
    setSaving(true);
    try {
      onSaved(await patientReportExtractionApi.correct(reportId, observation.id, input));
    } catch (requestError) {
      setError(patientReportExtractionErrorMessage(requestError, 'This extraction correction could not be saved.'));
    } finally {
      setSaving(false);
    }
  }

  const fieldClass =
    'mt-1.5 h-10 w-full rounded-xl border border-white/[0.1] bg-black/20 px-3 text-sm text-white outline-none transition-colors focus:border-cyan-300/35';
  return (
    <div className="border-t border-cyan-300/10 bg-black/10 p-4">
      <div className="mb-4 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--clinora-text-faint)]">
          What Clinora originally extracted
        </p>
        <p className="mt-1.5 text-xs text-slate-300">
          {observation.sourceLabel} · {observationValue(observation)}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-slate-300 sm:col-span-2">
          Test or result name
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            maxLength={160}
            className={fieldClass}
          />
        </label>
        <label className="text-xs font-semibold text-slate-300">
          Result type
          <select
            value={valueType}
            onChange={(event) => setValueType(event.target.value as PatientReportObservation['valueType'])}
            className={fieldClass}
          >
            <option value="NUMERIC">Numeric</option>
            <option value="QUALITATIVE">Qualitative</option>
            <option value="TEXT">Text</option>
          </select>
        </label>
        {valueType === 'NUMERIC' ? (
          <label className="text-xs font-semibold text-slate-300">
            Result
            <input
              inputMode="decimal"
              value={numericValue}
              onChange={(event) => setNumericValue(event.target.value)}
              className={fieldClass}
            />
          </label>
        ) : (
          <label className="text-xs font-semibold text-slate-300">
            Result
            <input
              value={textValue}
              onChange={(event) => setTextValue(event.target.value)}
              maxLength={400}
              className={fieldClass}
            />
          </label>
        )}
        <label className="text-xs font-semibold text-slate-300">
          Unit <span className="font-normal text-[var(--clinora-text-faint)]">(optional)</span>
          <input value={unit} onChange={(event) => setUnit(event.target.value)} maxLength={80} className={fieldClass} />
        </label>
        <label className="text-xs font-semibold text-slate-300">
          Comparator <span className="font-normal text-[var(--clinora-text-faint)]">(optional)</span>
          <select value={comparator} onChange={(event) => setComparator(event.target.value)} className={fieldClass}>
            <option value="">None</option>
            <option value="<">&lt;</option>
            <option value="<=">≤</option>
            <option value=">">&gt;</option>
            <option value=">=">≥</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-300">
          Reported flag <span className="font-normal text-[var(--clinora-text-faint)]">(optional)</span>
          <input
            value={sourceFlag}
            onChange={(event) => setSourceFlag(event.target.value)}
            maxLength={40}
            className={fieldClass}
          />
        </label>
        <label className="text-xs font-semibold text-slate-300 sm:col-span-2">
          Reference range as printed <span className="font-normal text-[var(--clinora-text-faint)]">(optional)</span>
          <input
            value={rangeRaw}
            onChange={(event) => setRangeRaw(event.target.value)}
            maxLength={160}
            className={fieldClass}
          />
        </label>
        <label className="text-xs font-semibold text-slate-300">
          Reference low <span className="font-normal text-[var(--clinora-text-faint)]">(optional)</span>
          <input
            inputMode="decimal"
            value={rangeLow}
            onChange={(event) => setRangeLow(event.target.value)}
            className={fieldClass}
          />
        </label>
        <label className="text-xs font-semibold text-slate-300">
          Reference high <span className="font-normal text-[var(--clinora-text-faint)]">(optional)</span>
          <input
            inputMode="decimal"
            value={rangeHigh}
            onChange={(event) => setRangeHigh(event.target.value)}
            className={fieldClass}
          />
        </label>
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-xs font-medium text-rose-300">
          {error}
        </p>
      ) : null}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button variant="appPrimary" size="sm" onClick={() => void save()} disabled={saving}>
          {saving ? 'Saving…' : 'Save correction'}
        </Button>
      </div>
    </div>
  );
}

function AnalysisProgress({ extraction }: { extraction: PatientReportExtraction }) {
  const extractionDone = extraction.status === 'SUCCEEDED';
  const verified = extraction.reviewStatus === 'VERIFIED';
  return (
    <div className="clinora-report-review-reference__progress" aria-label="Report analysis progress">
      <ProgressStep icon={ShieldCheck} title="Report secured" text="File encrypted" done />
      <ProgressStep
        icon={FileCheck2}
        title="Data extracted"
        text={extractionDone ? 'OCR complete' : ['QUEUED', 'PROCESSING'].includes(extraction.status) ? 'OCR in progress' : 'Waiting to start'}
        done={extractionDone}
        active={['QUEUED', 'PROCESSING'].includes(extraction.status)}
      />
      <ProgressStep
        icon={CheckCircle2}
        title="Results reviewed"
        text={verified ? 'Verified by you' : extractionDone ? 'In progress' : 'Waiting'}
        done={verified}
        active={extractionDone && !verified}
      />
    </div>
  );
}

function ProgressStep({
  icon: Icon,
  title,
  text,
  done,
  active = false,
}: {
  icon: typeof ShieldCheck;
  title: string;
  text: string;
  done: boolean;
  active?: boolean;
}) {
  return (
    <div className={cn('clinora-report-review-reference__progress-step', done && 'is-done', active && 'is-active')}>
      <span className="clinora-report-review-reference__progress-icon">
        {done ? <CheckCircle2 size={17} aria-hidden="true" /> : active ? <span className="clinora-report-review-reference__progress-ring" aria-hidden="true" /> : <Icon size={17} aria-hidden="true" />}
      </span>
      <span><strong>{title}</strong><small>{text}</small></span>
    </div>
  );
}

function NoStructuredResults() {
  return (
    <section className="rounded-[var(--clinora-radius-lg)] border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-raised)] p-7 text-center sm:p-10">
      <FileText size={27} className="mx-auto text-slate-500" aria-hidden="true" />
      <h2 className="mt-4 text-lg font-semibold text-white">No structured laboratory results found</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[var(--clinora-text-muted)]">
        Clinora could read the document but could not organize it into laboratory-style values. The original report is
        still available and unchanged.
      </p>
    </section>
  );
}

function AnalysisLoadError({ message }: { message: string }) {
  return (
    <div className="rounded-[var(--clinora-radius-lg)] border border-rose-400/20 bg-rose-400/[0.06] p-6">
      <h1 className="text-lg font-semibold text-white">Report analysis unavailable</h1>
      <p className="mt-2 text-sm text-rose-200">{message}</p>
      <Link to="/patient/analyze" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-white">
        <ArrowLeft size={15} aria-hidden="true" /> Back to AI Report Analysis
      </Link>
    </div>
  );
}

function observationValue(observation: PatientReportObservation) {
  const value =
    observation.numericValue != null
      ? observation.numericValue.toString()
      : observation.textValue || 'Not confidently captured';
  return `${observation.comparator ?? ''}${value}${observation.unit ? ` ${observation.unit}` : ''}`;
}

function rangeLabel(flag: string | null) {
  if (flag === 'BELOW_REPORTED_RANGE') return "Below this report's stated range";
  if (flag === 'ABOVE_REPORTED_RANGE') return "Above this report's stated range";
  if (flag === 'WITHIN_REPORTED_RANGE') return "Within this report's stated range";
  return '';
}

function rangeTone(flag: string | null) {
  return flag === 'WITHIN_REPORTED_RANGE' ? 'text-emerald-300' : 'text-amber-300';
}

function optionalNumber(value: string): number | null | undefined {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function formatUploadedDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Date unavailable';
  return parsed.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(parsed);
}
