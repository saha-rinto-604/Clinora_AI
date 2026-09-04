import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Eye,
  FileCheck2,
  FileText,
  PencilLine,
  RefreshCw,
  ScanText,
  ShieldCheck,
  Sparkles,
  UploadCloud,
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
import { patientReportTypeLabels, type PatientReport } from '../../features/patient-reports/patient-report-types';

export function PatientReportAnalysisPage() {
  const { reportId } = useParams();
  return reportId ? <AnalysisWorkspace reportId={reportId} /> : <AnalysisStart />;
}

function AnalysisStart() {
  const navigate = useNavigate();
  const [reports, setReports] = useState<PatientReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const page = await patientReportApi.list({ collection: 'ACTIVE', page: 1, size: 8 });
      setReports(page.items);
    } catch (requestError) {
      setError(patientReportErrorMessage(requestError, 'Your medical reports could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/15 bg-cyan-400/[0.07] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--clinora-info-foreground)]">
          <ScanText size={14} aria-hidden="true" /> AI report analysis
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
          Analyze a medical report
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--clinora-text-muted)] sm:text-base">
          Extract laboratory values, verify them against the original report, then continue to a dedicated AI insight
          workspace for a clear, patient-friendly explanation.
        </p>
      </header>

      <section
        aria-labelledby="analysis-start-title"
        className="rounded-[var(--clinora-radius-lg)] border border-cyan-300/15 bg-[linear-gradient(115deg,rgba(8,145,178,0.08),rgba(255,255,255,0.018)_55%)] p-5 sm:p-6"
      >
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--clinora-info-soft)] text-[var(--clinora-info-foreground)]">
              <UploadCloud size={20} aria-hidden="true" />
            </span>
            <div>
              <h2 id="analysis-start-title" className="text-base font-semibold text-white">
                Start with your report
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--clinora-text-muted)]">
                Upload a PDF, JPG or PNG, or choose a report already saved in Medical Reports. The original remains
                unchanged while you review Clinora's transcription.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="appPrimary" onClick={() => setUploadOpen(true)}>
              <UploadCloud size={16} aria-hidden="true" /> Upload report
            </Button>
            <a
              href="#existing-reports"
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-white/[0.09] bg-white/[0.035] px-4 text-sm font-semibold text-slate-200 hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
            >
              Choose existing <ChevronRight size={15} aria-hidden="true" />
            </a>
          </div>
        </div>
        <div className="mt-5 grid gap-3 border-t border-white/[0.07] pt-4 text-xs text-[var(--clinora-text-muted)] sm:grid-cols-3">
          <p>
            <span className="font-semibold text-slate-300">1 · Extract</span>
            <br />
            Clinora reads reported laboratory values.
          </p>
          <p>
            <span className="font-semibold text-slate-300">2 · Verify</span>
            <br />
            Compare uncertain values with the source.
          </p>
          <p>
            <span className="font-semibold text-slate-300">3 · Understand</span>
            <br />
            Continue to a dedicated AI insight after verification.
          </p>
        </div>
      </section>

      <section id="existing-reports" className="scroll-mt-24">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--clinora-text-faint)]">
              Medical Reports
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-[-0.025em] text-white">Select a report to analyze</h2>
          </div>
          <Link
            to="/patient/reports"
            className="text-sm font-semibold text-[var(--clinora-info-foreground)] hover:text-cyan-200"
          >
            Open report vault
          </Link>
        </div>

        {error ? (
          <div
            className="mt-5 rounded-2xl border border-rose-400/20 bg-rose-400/[0.07] p-4 text-sm text-rose-200"
            role="alert"
          >
            {error}{' '}
            <button
              type="button"
              onClick={() => void loadReports()}
              className="font-semibold underline underline-offset-4"
            >
              Try again
            </button>
          </div>
        ) : null}

        <div className="mt-5 grid gap-3">
          {loading ? (
            <div className="rounded-2xl border border-[var(--clinora-border-subtle)] bg-white/[0.025] p-5 text-sm text-[var(--clinora-text-muted)]">
              Loading your reports…
            </div>
          ) : reports.length ? (
            reports.map((report) => (
              <button
                key={report.id}
                type="button"
                onClick={() => navigate(`/patient/analyze/${report.id}`)}
                className="group flex min-h-20 items-center gap-4 rounded-2xl border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-raised)] p-4 text-left transition-colors hover:border-cyan-300/20 hover:bg-white/[0.05]"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/[0.045] text-slate-300">
                  <FileText size={19} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-white">{report.reportName}</span>
                  <span className="mt-1 block text-xs text-[var(--clinora-text-faint)]">
                    {patientReportTypeLabels[report.reportType]}
                    {report.reportDate ? ` · ${formatDate(report.reportDate)}` : ''}
                  </span>
                </span>
                <span className="hidden text-xs font-semibold text-[var(--clinora-info-foreground)] sm:inline">
                  Analyze
                </span>
                <ChevronRight
                  size={17}
                  className="text-slate-600 transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </button>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-[var(--clinora-border-interactive)] p-7 text-center">
              <p className="text-sm font-semibold text-white">No active medical reports yet</p>
              <p className="mt-1 text-xs leading-5 text-[var(--clinora-text-muted)]">
                Upload your first report to begin.
              </p>
              <Button variant="appPrimary" size="sm" className="mt-4" onClick={() => setUploadOpen(true)}>
                <UploadCloud size={15} aria-hidden="true" /> Upload report
              </Button>
            </div>
          )}
        </div>
      </section>

      <PatientReportUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUploaded={(report) => navigate(`/patient/analyze/${report.id}`)}
      />
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
    <div className="space-y-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <Link
            to="/patient/analyze"
            className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--clinora-text-muted)] hover:text-white"
          >
            <ArrowLeft size={14} aria-hidden="true" /> AI Report Analysis
          </Link>
          <h1 className="mt-3 text-2xl font-semibold tracking-[-0.035em] text-white sm:text-3xl">
            {report.reportName}
          </h1>
          <p className="mt-2 text-sm text-[var(--clinora-text-muted)]">
            {patientReportTypeLabels[report.reportType]}
            {report.reportDate ? ` · ${formatDate(report.reportDate)}` : ''}
            {report.providerLaboratory ? ` · ${report.providerLaboratory}` : ''}
          </p>
        </div>
        <AnalysisProgress extraction={extraction} />
      </header>

      {error ? (
        <div
          className="rounded-2xl border border-rose-400/20 bg-rose-400/[0.07] p-4 text-sm text-rose-200"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {extraction.status === 'NOT_REQUESTED' ? (
        <StartExtractionPanel busy={action === 'start'} onStart={() => void startExtraction()} />
      ) : null}

      {['QUEUED', 'PROCESSING'].includes(extraction.status) ? <ProcessingPanel status={extraction.status} /> : null}

      {extraction.status === 'FAILED' ? (
        <FailurePanel
          failureCode={extraction.failureCode}
          busy={action === 'start'}
          onRetry={() => void startExtraction()}
        />
      ) : null}

      {extraction.status === 'SUCCEEDED' ? (
        <>
          {extraction.observations.length ? (
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.02fr)_minmax(420px,0.98fr)]">
              <ReportSourceViewer report={report} sourceUrl={sourceUrl} selected={selectedObservation} />
              <section className="rounded-[var(--clinora-radius-lg)] border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-raised)]">
                <div className="border-b border-[var(--clinora-border-subtle)] p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--clinora-text-faint)]">
                        Extracted results
                      </p>
                      <h2 className="mt-1 text-xl font-semibold text-white">Review what Clinora read</h2>
                      <p className="mt-2 max-w-xl text-xs leading-5 text-[var(--clinora-text-muted)]">
                        Compare important values with the original report. Corrections change Clinora's transcription,
                        not your original medical document.
                      </p>
                    </div>
                    <div className="rounded-xl bg-white/[0.04] px-3 py-2 text-right">
                      <p className="text-sm font-semibold text-white">{extraction.observations.length} results</p>
                      <p className={cn('text-[11px]', unresolved ? 'text-amber-300' : 'text-emerald-300')}>
                        {unresolved
                          ? `${unresolved} ${unresolved === 1 ? 'needs' : 'need'} review`
                          : 'All flagged values have been reviewed'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="hidden grid-cols-[minmax(150px,1.15fr)_minmax(100px,0.7fr)_minmax(160px,1fr)_auto] gap-3 border-b border-white/[0.055] px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.11em] text-[var(--clinora-text-faint)] sm:grid">
                  <span>Test</span>
                  <span>Result</span>
                  <span>Reference on report</span>
                  <span className="text-right">Action</span>
                </div>
                <div className="max-h-[680px] divide-y divide-white/[0.055] overflow-y-auto">
                  {[...extraction.observations]
                    .sort(
                      (a, b) =>
                        Number(b.reviewRequired && b.verificationStatus === 'UNREVIEWED') -
                        Number(a.reviewRequired && a.verificationStatus === 'UNREVIEWED'),
                    )
                    .map((observation) => (
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
          ) : (
            <NoStructuredResults />
          )}

          {extraction.observations.length ? (
            <section className="flex flex-col gap-4 rounded-[var(--clinora-radius-lg)] border border-[var(--clinora-border-subtle)] bg-white/[0.025] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div className="flex gap-3">
                <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-400/[0.09] text-emerald-300">
                  <ShieldCheck size={18} aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-white">
                    {extraction.reviewStatus === 'VERIFIED' ? 'Report data verified' : 'Confirm the extracted results'}
                  </h2>
                  <p className="mt-1 max-w-2xl text-xs leading-5 text-[var(--clinora-text-muted)]">
                    {extraction.reviewStatus === 'VERIFIED'
                      ? 'These reviewed values are ready. Continue to your dedicated AI insight workspace when you want a clear explanation.'
                      : unresolved
                        ? `Review ${unresolved} flagged ${unresolved === 1 ? 'value' : 'values'} before confirmation.`
                        : 'Confirm that the extracted information matches your report before requesting AI-assisted interpretation.'}
                  </p>
                </div>
              </div>
              {extraction.reviewStatus === 'VERIFIED' ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-emerald-300/15 bg-emerald-400/[0.07] px-4 text-sm font-semibold text-emerald-200">
                    <CheckCircle2 size={16} aria-hidden="true" /> Verified
                  </span>
                  <Link
                    to={`/patient/analyze/${reportId}/insight`}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 px-4 text-sm font-semibold text-slate-950 transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 motion-reduce:transform-none"
                  >
                    <Sparkles size={16} aria-hidden="true" /> Open AI insight <ChevronRight size={15} aria-hidden="true" />
                  </Link>
                </div>
              ) : (
                <Button
                  variant="appPrimary"
                  onClick={() => void confirmExtraction()}
                  disabled={Boolean(unresolved) || action === 'confirm'}
                >
                  <FileCheck2 size={16} aria-hidden="true" />{' '}
                  {action === 'confirm' ? 'Confirming…' : 'Confirm extracted results'}
                </Button>
              )}
            </section>
          ) : null}
        </>
      ) : null}
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
  return (
    <section
      className="rounded-[var(--clinora-radius-lg)] border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-raised)] p-6 sm:p-8"
      aria-live="polite"
    >
      <div className="mx-auto max-w-2xl text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[var(--clinora-info-soft)] text-[var(--clinora-info-foreground)]">
          <RefreshCw size={21} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
        </span>
        <h2 className="mt-5 text-xl font-semibold text-white">
          {status === 'QUEUED' ? 'Waiting to process' : 'Reading your report'}
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--clinora-text-muted)]">
          {status === 'QUEUED'
            ? 'Your report is in the secure processing queue. You can leave this page and return later.'
            : 'Clinora is reading the document and organizing extracted results. No diagnosis or AI prediction is being generated.'}
        </p>
        <div className="mt-7 grid grid-cols-3 gap-2 text-left text-[11px] text-[var(--clinora-text-faint)]">
          {['Preparing document', 'Reading report', 'Organizing results'].map((label, index) => (
            <div key={label} className="border-t border-white/[0.1] pt-2">
              <span className="font-bold text-slate-400">0{index + 1}</span> {label}
            </div>
          ))}
        </div>
      </div>
    </section>
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
}: {
  report: PatientReport;
  sourceUrl: string;
  selected: PatientReportObservation | null;
}) {
  const page = selected?.pageNumber ?? 1;
  return (
    <section className="overflow-hidden rounded-[var(--clinora-radius-lg)] border border-[var(--clinora-border-subtle)] bg-[var(--clinora-bg-chrome)] xl:sticky xl:top-24 xl:self-start">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--clinora-border-subtle)] px-5 py-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--clinora-text-faint)]">
            Original report
          </p>
          <p className="mt-1 text-xs text-[var(--clinora-text-muted)]">
            {selected ? `Source for ${selected.label} · page ${page}` : 'Select a result to locate its source.'}
          </p>
        </div>
        {selected ? (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.045] px-2.5 py-1.5 text-[11px] font-semibold text-slate-300">
            <Eye size={13} aria-hidden="true" /> Page {page}
          </span>
        ) : null}
      </div>
      <div className="relative min-h-[520px] bg-black/20 p-3 sm:p-4 xl:min-h-[680px]">
        {!sourceUrl ? (
          <div className="grid min-h-[500px] place-items-center text-sm text-[var(--clinora-text-muted)]">
            Loading original report…
          </div>
        ) : report.mimeType === 'application/pdf' ? (
          <iframe
            title={`Original report: ${report.reportName}`}
            src={`${sourceUrl}#page=${page}&view=FitH`}
            className="h-[650px] w-full rounded-xl border-0 bg-white"
          />
        ) : (
          <div className="relative mx-auto w-fit max-w-full overflow-hidden rounded-xl bg-white">
            <img
              src={sourceUrl}
              alt={`Original report: ${report.reportName}`}
              className="max-h-[650px] max-w-full object-contain"
            />
            {selected?.boundingBox ? (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute rounded border-2 border-cyan-400 bg-cyan-300/10 shadow-[0_0_0_2px_rgba(0,0,0,0.18)]"
                style={{
                  left: `${selected.boundingBox.x * 100}%`,
                  top: `${selected.boundingBox.y * 100}%`,
                  width: `${selected.boundingBox.width * 100}%`,
                  height: `${selected.boundingBox.height * 100}%`,
                }}
              />
            ) : null}
          </div>
        )}
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
        'border-l-2 transition-colors',
        needsReview
          ? 'border-l-amber-300 bg-amber-300/[0.035]'
          : selected
            ? 'border-l-cyan-300 bg-cyan-300/[0.045]'
            : corrected
              ? 'border-l-cyan-300/40 bg-cyan-300/[0.018]'
              : 'border-l-transparent bg-transparent hover:bg-white/[0.02]',
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className="grid w-full gap-3 px-4 py-3.5 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-cyan-300 sm:grid-cols-[minmax(150px,1.15fr)_minmax(100px,0.7fr)_minmax(160px,1fr)_auto] sm:items-center"
      >
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-white">{observation.label}</span>
            {needsReview ? (
              <span className="rounded-full bg-amber-300/[0.1] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-amber-300">
                Needs review
              </span>
            ) : null}
            {corrected ? (
              <span className="rounded-full bg-cyan-300/[0.08] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-cyan-200">
                Corrected
              </span>
            ) : null}
            {confirmed ? (
              <span className="rounded-full bg-emerald-300/[0.08] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-emerald-200">
                Confirmed
              </span>
            ) : null}
          </span>
          <span className="mt-1 block text-[11px] text-[var(--clinora-text-faint)]">
            Page {observation.pageNumber}
            {confirmed ? ' · Confirmed by you' : ''}
          </span>
        </span>
        <span>
          <span className="block text-[10px] font-bold uppercase tracking-[0.11em] text-[var(--clinora-text-faint)] sm:hidden">
            Result
          </span>
          <span className="mt-1 block text-sm font-semibold text-white sm:mt-0">{observationValue(observation)}</span>
        </span>
        <span>
          <span className="block text-[10px] font-bold uppercase tracking-[0.11em] text-[var(--clinora-text-faint)] sm:hidden">
            Reference on report
          </span>
          <span className="mt-1 block text-xs leading-5 text-slate-300 sm:mt-0">
            {observation.referenceRangeRaw ?? 'Not confidently captured — compare with source'}
          </span>
          {rangeLabel(observation.derivedRangeFlag) ? (
            <span className={cn('mt-1 block text-[11px] font-semibold', rangeTone(observation.derivedRangeFlag))}>
              {rangeLabel(observation.derivedRangeFlag)}
            </span>
          ) : null}
        </span>
        <span className="inline-flex min-h-10 items-center gap-1.5 text-xs font-semibold text-slate-400 sm:justify-end">
          <Eye size={14} aria-hidden="true" /> View on report
        </span>
      </button>
      <div className="flex flex-wrap items-end justify-between gap-3 px-4 pb-3">
        <div className="min-w-0 flex-1">
          {selected ? <ReferenceRangeVisualization observation={observation} /> : null}
        </div>
        {!editing ? (
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {needsReview ? (
              <button
                type="button"
                onClick={() => void confirmUnchanged()}
                disabled={confirming}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-300/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {confirming ? (
                  <RefreshCw size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
                ) : (
                  <CheckCircle2 size={14} aria-hidden="true" />
                )}
                {confirming ? 'Confirming…' : 'Looks correct'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onEdit}
              disabled={confirming}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-[var(--clinora-info-foreground)] hover:bg-cyan-300/[0.05] hover:text-cyan-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <PencilLine size={14} aria-hidden="true" /> Edit result
            </button>
          </div>
        ) : null}
      </div>
      {reviewError ? (
        <p role="alert" className="px-4 pb-3 text-xs font-medium text-rose-300">
          {reviewError}
        </p>
      ) : null}
      {editing ? (
        <CorrectionEditor observation={observation} reportId={reportId} onCancel={onCancelEdit} onSaved={onSaved} />
      ) : null}
    </article>
  );
}

function ReferenceRangeVisualization({ observation }: { observation: PatientReportObservation }) {
  if (observation.numericValue == null || observation.referenceLow == null || observation.referenceHigh == null)
    return null;
  if (observation.referenceHigh <= observation.referenceLow) return null;
  const span = observation.referenceHigh - observation.referenceLow;
  const displayMin = observation.referenceLow - span * 0.35;
  const displayMax = observation.referenceHigh + span * 0.35;
  const marker = Math.max(2, Math.min(98, ((observation.numericValue - displayMin) / (displayMax - displayMin)) * 100));
  const rangeStart = ((observation.referenceLow - displayMin) / (displayMax - displayMin)) * 100;
  const rangeEnd = ((observation.referenceHigh - displayMin) / (displayMax - displayMin)) * 100;
  return (
    <span
      className="mt-3 block max-w-sm"
      aria-label={`Result ${observation.numericValue}; report reference range ${observation.referenceLow} to ${observation.referenceHigh}`}
    >
      <span className="relative block h-2 rounded-full bg-white/[0.06]">
        <span
          className="absolute inset-y-0 rounded-full bg-emerald-300/25"
          style={{ left: `${rangeStart}%`, width: `${rangeEnd - rangeStart}%` }}
        />
        <span
          className={cn(
            'absolute top-1/2 h-3.5 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full',
            observation.derivedRangeFlag === 'WITHIN_REPORTED_RANGE' ? 'bg-emerald-300' : 'bg-amber-300',
          )}
          style={{ left: `${marker}%` }}
        />
      </span>
      <span className="mt-1.5 flex justify-between text-[10px] text-[var(--clinora-text-faint)]">
        <span>{observation.referenceLow}</span>
        <span>Report reference range</span>
        <span>{observation.referenceHigh}</span>
      </span>
    </span>
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
    <div className="grid min-w-[300px] grid-cols-3 overflow-hidden rounded-2xl border border-[var(--clinora-border-subtle)] bg-white/[0.025]">
      <ProgressStep label="Report secured" done />
      <ProgressStep
        label="Data extracted"
        done={extractionDone}
        active={['QUEUED', 'PROCESSING'].includes(extraction.status)}
      />
      <ProgressStep label="Results reviewed" done={verified} active={extractionDone && !verified} />
    </div>
  );
}

function ProgressStep({ label, done, active = false }: { label: string; done: boolean; active?: boolean }) {
  return (
    <div className="border-l border-white/[0.06] px-3 py-3 first:border-l-0">
      <span
        className={cn(
          'block text-[10px] font-bold uppercase tracking-[0.1em]',
          done ? 'text-emerald-300' : active ? 'text-cyan-200' : 'text-slate-600',
        )}
      >
        {done ? 'Complete' : active ? 'Current' : 'Pending'}
      </span>
      <span className="mt-1 block text-[11px] font-medium text-slate-300">{label}</span>
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

function formatDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(parsed);
}
