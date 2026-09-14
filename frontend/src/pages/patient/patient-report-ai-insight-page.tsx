import {
  ArrowLeft,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  FileCheck2,
  FileText,
  FlaskConical,
  LockKeyhole,
  MessagesSquare,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  type LucideIcon,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../components/ui/dialog';
import { cn } from '../../lib/cn';
import { patientReportAiApi, patientReportAiErrorMessage } from '../../features/patient-reports/patient-report-ai-api';
import type {
  PatientReportAiAnalysis,
  PatientReportAiClinicalCluster,
  PatientReportAiClinicalPattern,
  PatientReportAiJobStatus,
} from '../../features/patient-reports/patient-report-ai-types';
import { patientReportApi } from '../../features/patient-reports/patient-report-api';
import {
  formatObservationValue,
  formatReference,
  rangeStateLabel,
} from '../../features/patient-reports/patient-report-observation-presentation';
import { patientReportExtractionApi } from '../../features/patient-reports/patient-report-extraction-api';
import type {
  PatientReportExtraction,
  PatientReportObservation,
} from '../../features/patient-reports/patient-report-extraction-types';
import { patientObservationRangeState } from '../../features/patient-reports/patient-report-range-state';
import { patientReportDisplayName, patientReportTypeLabels, type PatientReport } from '../../features/patient-reports/patient-report-types';
import './patient-report-ai-insight-theme.css';
import './patient-report-reference-workspaces.css';

export function PatientReportAiInsightPage() {
  const { reportId } = useParams();
  if (!reportId) return <InsightLoadError message="This report insight is unavailable." />;
  return <InsightWorkspace reportId={reportId} />;
}

function InsightWorkspace({ reportId }: { reportId: string }) {
  const [report, setReport] = useState<PatientReport | null>(null);
  const [extraction, setExtraction] = useState<PatientReportExtraction | null>(null);
  const [analysis, setAnalysis] = useState<PatientReportAiAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState('');
  const [rerunOpen, setRerunOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [nextReport, nextExtraction, nextAnalysis] = await Promise.all([
        patientReportApi.detail(reportId),
        patientReportExtractionApi.get(reportId),
        patientReportAiApi.get(reportId),
      ]);
      setReport(nextReport);
      setExtraction(nextExtraction);
      setAnalysis(nextAnalysis);
      setError('');
    } catch (requestError) {
      setError(patientReportAiErrorMessage(requestError, 'This report insight could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }, [reportId]);

  useEffect(() => {
    void load();
  }, [load]);

  const analysisStatus = analysis?.status;
  useEffect(() => {
    if (!analysisStatus || !['QUEUED', 'PROCESSING'].includes(analysisStatus)) return;
    const timer = window.setInterval(() => {
      void patientReportAiApi
        .get(reportId)
        .then((next) => {
          setAnalysis(next);
          setError('');
          if (!['QUEUED', 'PROCESSING'].includes(next.status)) window.clearInterval(timer);
        })
        .catch(() => undefined);
    }, 2200);
    return () => window.clearInterval(timer);
  }, [analysisStatus, reportId]);

  async function requestInsight(force = false) {
    setRequesting(true);
    setError('');
    try {
      setAnalysis(await patientReportAiApi.request(reportId, force));
      if (force) setRerunOpen(false);
    } catch (requestError) {
      setError(patientReportAiErrorMessage(requestError, 'Clinora could not start your report insight.'));
    } finally {
      setRequesting(false);
    }
  }

  if (loading) return <InsightLoading />;
  if (!report || !extraction || !analysis) {
    return <InsightLoadError message={error || 'This report insight is unavailable.'} />;
  }

  const verified = extraction.status === 'SUCCEEDED' && extraction.reviewStatus === 'VERIFIED';
  const status = analysis.status;
  const analysisActive = ['QUEUED', 'PROCESSING'].includes(status);

  return (
    <div className="space-y-6 pb-8">
      <InsightHeader report={report} reportId={reportId} />

      {error ? (
        <div className="rounded-2xl border border-rose-400/20 bg-rose-400/[0.07] p-4 text-sm text-rose-200" role="alert">
          {error}
        </div>
      ) : null}

      {!verified ? <VerificationGuard reportId={reportId} /> : null}

      {verified && status === 'NOT_READY' ? (
        <InsightNotReady reportId={reportId} readinessCode={analysis.readinessCode} />
      ) : null}

      {verified && analysis.stale ? (
        <div className="flex flex-col gap-4 rounded-2xl border border-amber-300/20 bg-amber-300/[0.055] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <CircleAlert size={18} className="mt-0.5 shrink-0 text-amber-300" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-amber-100">Your verified values changed</p>
              <p className="mt-1 text-xs leading-5 text-[var(--clinora-text-muted)]">
                This insight was created from an older reviewed value set. Create a fresh insight before relying on it.
              </p>
            </div>
          </div>
          <Button variant="appPrimary" size="sm" onClick={() => setRerunOpen(true)} disabled={requesting || analysisActive}>
            <RefreshCw size={15} className={requesting ? 'animate-spin motion-reduce:animate-none' : ''} aria-hidden="true" />
            {requesting ? 'Re-running analysis…' : 'Re-run AI analysis'}
          </Button>
        </div>
      ) : null}

      {verified && status === 'NOT_REQUESTED' ? (
        <InsightReady report={report} extraction={extraction} busy={requesting} onStart={() => void requestInsight()} />
      ) : null}

      {verified && analysisActive ? (
        <InsightLab status={status} report={report} extraction={extraction} analysis={analysis} />
      ) : null}

      {verified && status === 'FAILED' ? (
        <InsightFailure
          failureCode={analysis.failureCode}
          busy={requesting}
          onRetry={() => analysis.result ? setRerunOpen(true) : void requestInsight()}
          reportId={reportId}
        />
      ) : null}

      {verified && analysis.result ? (
        <InsightResult
          report={report}
          extraction={extraction}
          analysis={analysis}
          busy={requesting || analysisActive}
          onRunAgain={() => setRerunOpen(true)}
        />
      ) : null}

      <Dialog open={rerunOpen} onOpenChange={(open) => !requesting && !analysisActive && setRerunOpen(open)}>
        <DialogContent>
          <DialogTitle className="text-xl font-semibold text-white">Run Clinora AI again?</DialogTitle>
          <DialogDescription className="text-sm leading-6 text-[var(--clinora-text-muted)]">
            Clinora will create a new interpretation using your latest verified report values.
          </DialogDescription>
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setRerunOpen(false)} disabled={requesting}>Cancel</Button>
            <Button variant="appPrimary" onClick={() => void requestInsight(true)} disabled={requesting || analysisActive}>
              <RefreshCw size={16} className={requesting ? 'animate-spin motion-reduce:animate-none' : ''} aria-hidden="true" />
              {requesting ? 'Re-running analysis…' : 'Re-run AI analysis'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InsightHeader({ report, reportId }: { report: PatientReport; reportId: string }) {
  return (
    <header className="clinora-ai-reference-header">
      <div className="clinora-ai-reference-header__copy">
        <Link to={`/patient/analyze/${reportId}`} className="clinora-ai-reference-header__back">
          <ArrowLeft size={14} aria-hidden="true" /> Back to verified report
        </Link>
        <p className="clinora-reference-section-label">Clinora AI · Clinical Intelligence</p>
        <h1>Your report insight</h1>
        <p className="clinora-ai-reference-header__meta">
          {patientReportDisplayName(report)} · {patientReportTypeLabels[report.reportType]}
          {report.providerLaboratory ? ` · ${report.providerLaboratory}` : ''}
        </p>
        <div className="clinora-ai-reference-header__trust">
          <TrustChip icon={FileCheck2} label="Verified report values" />
          <TrustChip icon={BrainCircuit} label="Reviewed for clarity" />
          <TrustChip icon={ShieldCheck} label="Safety checked before delivery" />
        </div>
      </div>
      <div className="clinora-ai-reference-header__art" aria-hidden="true">
        <span>Translating lab data into healthier tomorrows</span>
      </div>
    </header>
  );
}

function TrustChip({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <span className="clinora-ai-reference-header__trust-chip">
      <Icon size={13} aria-hidden="true" /> {label}
    </span>
  );
}

function InsightReady({
  report,
  extraction,
  busy,
  onStart,
}: {
  report: PatientReport;
  extraction: PatientReportExtraction;
  busy: boolean;
  onStart: () => void;
}) {
  const { outside, within } = observationSummary(extraction.observations);
  return (
    <section className="clinora-ai-insight-theme overflow-hidden rounded-[30px] border border-slate-200 bg-[#f5f7fb] text-slate-950 shadow-[0_24px_70px_rgba(15,23,42,0.16)]">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
        <div className="bg-white p-6 sm:p-8 lg:p-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-cyan-800">
            <CheckCircle2 size={14} aria-hidden="true" /> Verified and ready
          </span>
          <h2 className="mt-5 max-w-3xl text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">
            Understand what your verified lab report may suggest.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
            Clinora AI looks for clinically meaningful patterns and possible conditions while keeping the exact values,
            reference ranges, and range status fixed to the report you reviewed.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button variant="appPrimary" className="min-h-11 px-5" onClick={onStart} disabled={busy}>
              {busy ? (
                <RefreshCw size={17} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
              ) : (
                <Sparkles size={17} aria-hidden="true" />
              )}
              {busy ? 'Starting analysis…' : 'Analyze verified report'}
            </Button>
            <p className="max-w-md text-xs leading-5 text-slate-500">
              Possible conditions are shown only when supplied evidence passes Clinora’s grounding and safety checks.
            </p>
          </div>
        </div>
        <aside className="border-t border-slate-200 bg-slate-50 p-6 sm:p-8 lg:border-l lg:border-t-0">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Report ready</p>
          <p className="mt-2 text-lg font-semibold text-slate-950">{patientReportDisplayName(report)}</p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <MetricTile label="Outside expected range" value={outside.length} tone="alert" />
            <MetricTile label="Within expected range" value={within.length} tone="good" />
          </div>
          <div className="mt-6 space-y-3 text-sm text-slate-600">
            <ReadyPointLight icon={FileCheck2} title="Verified values only" text="Uses the extraction you confirmed." />
            <ReadyPointLight icon={ShieldCheck} title="Grounded reasoning" text="AI cannot overwrite verified lab facts." />
            <ReadyPointLight icon={Stethoscope} title="Possible, not diagnosed" text="Condition names stay explicitly tentative." />
          </div>
        </aside>
      </div>
    </section>
  );
}

function ReadyPointLight({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <div className="flex gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-cyan-700">
        <Icon size={17} aria-hidden="true" />
      </span>
      <div>
        <p className="font-semibold text-slate-900">{title}</p>
        <p className="mt-0.5 text-xs leading-5 text-slate-500">{text}</p>
      </div>
    </div>
  );
}

function InsightLab({
  status,
  report,
  extraction,
  analysis,
}: {
  status: PatientReportAiJobStatus;
  report: PatientReport;
  extraction: PatientReportExtraction;
  analysis: PatientReportAiAnalysis;
}) {
  const queued = status === 'QUEUED';
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const started = analysis.startedAt ?? analysis.requestedAt;
  const elapsedSeconds = started ? Math.max(0, Math.floor((now - new Date(started).getTime()) / 1000)) : 0;
  const previewRows = extraction.observations.slice(0, 5);

  return (
    <section
      aria-live="polite"
      data-ai-status={queued ? 'queued' : 'processing'}
      className="clinora-ai-insight-theme rounded-[32px] border border-slate-200 bg-[#f4f7fb] p-4 text-slate-950 shadow-[0_26px_80px_rgba(15,23,42,0.18)] sm:p-7 lg:p-10"
    >
      <div className="mx-auto max-w-4xl rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.10)] sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">
            <FileText size={16} aria-hidden="true" /> {patientReportDisplayName(report)}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold tabular-nums text-slate-600">
            <Clock3 size={16} aria-hidden="true" /> {formatElapsed(elapsedSeconds)}
          </span>
        </div>

        <div className="relative mt-6 overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-inner">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
            <span className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-blue-700">
              <FileCheck2 size={14} aria-hidden="true" /> Verified lab report
            </span>
            <span className="inline-flex items-center gap-2 text-xs font-semibold text-blue-700">
              <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.62)] motion-reduce:animate-none" /> {queued ? 'Clinora AI queued securely' : 'Clinora AI analysis active'}
            </span>
          </div>

          <div className="p-4">
            <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(90px,0.6fr)_minmax(120px,0.8fr)] gap-3 rounded-lg bg-slate-100 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.11em] text-slate-500">
              <span>Test</span>
              <span>Result</span>
              <span>Reference</span>
            </div>
            <div className="mt-2 space-y-2">
              {previewRows.map((observation) => (
                <div
                  key={observation.id}
                  className="grid grid-cols-[minmax(0,1.3fr)_minmax(90px,0.6fr)_minmax(120px,0.8fr)] gap-3 rounded-lg border border-slate-100 px-3 py-2.5 text-xs"
                >
                  <span className="truncate font-semibold text-slate-700">{observation.label}</span>
                  <span className="truncate text-slate-600">{formatObservationValue(observation)}</span>
                  <span className="truncate text-slate-500">{formatReference(observation)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pointer-events-none absolute inset-x-0 top-[58%] h-px bg-blue-500/60 shadow-[0_0_18px_rgba(59,130,246,0.55)] motion-reduce:hidden" />
          <div className="border-t border-blue-100 bg-blue-50 px-4 py-2.5 text-xs font-semibold text-blue-800">
            {queued ? 'Waiting for the private AI worker…' : 'Comparing clinical patterns and validating evidence…'}
          </div>
        </div>

        <div className="mt-7 text-center">
          <h2 className="text-3xl font-semibold tracking-[-0.035em] text-slate-950">Analyzing your verified report</h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            {queued
              ? 'Your request is securely queued. Clinora AI will begin automatically as soon as private analysis capacity is available.'
              : 'Clinora AI is evaluating cautious clinical possibilities, then checking every evidence link before anything is shown.'}
          </p>
        </div>

        <div className="mt-6 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
          <div className={queued ? 'clinora-ai-queue-track h-2 w-full' : 'clinora-ai-activity-track h-2 w-full'} />
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ProcessStep title="Verified report" text="Confirmed report data" state="complete" />
          <ProcessStep
            title="Clinical correlation"
            text={queued ? 'Waiting to start' : 'Related findings and clinical possibilities'}
            state={queued ? 'waiting' : 'active'}
          />
          <ProcessStep title="Evidence grounding" text="Every clinical claim must be checked" state="waiting" />
          <ProcessStep title="Safety checked result" text="Shown only after validation" state="waiting" />
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-slate-200 pt-5 text-xs font-medium text-slate-500">
          <span className="inline-flex items-center gap-1.5"><FileCheck2 size={14} className="text-emerald-600" aria-hidden="true" /> Verified values only</span>
          <span className="inline-flex items-center gap-1.5"><LockKeyhole size={14} className="text-blue-600" aria-hidden="true" /> Private Clinora processing</span>
          <span className="inline-flex items-center gap-1.5"><ShieldCheck size={14} className="text-cyan-700" aria-hidden="true" /> Safety checked before display</span>
        </div>
      </div>
    </section>
  );
}

function ProcessStep({ title, text, state }: { title: string; text: string; state: 'complete' | 'active' | 'waiting' }) {
  return (
    <div
      className={cn(
        'rounded-2xl border px-4 py-3 text-left',
        state === 'complete' && 'border-emerald-200 bg-emerald-50',
        state === 'active' && 'border-blue-200 bg-blue-50',
        state === 'waiting' && 'border-slate-200 bg-slate-50',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        {state === 'complete' ? <CheckCircle2 size={16} className="text-emerald-600" aria-hidden="true" /> : null}
        {state === 'active' ? <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500 motion-reduce:animate-none" /> : null}
      </div>
      <p className="mt-1 text-xs leading-5 text-slate-500">{text}</p>
    </div>
  );
}

function formatElapsed(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function InsightFailure({
  failureCode,
  busy,
  onRetry,
  reportId,
}: {
  failureCode: string | null;
  busy: boolean;
  onRetry: () => void;
  reportId: string;
}) {
  const capacityIssue = failureCode === 'AI_MODEL_UNAVAILABLE' || failureCode === 'AI_SERVICE_UNAVAILABLE';
  const rejected = failureCode === 'AI_RESPONSE_REJECTED';
  return (
    <section className="clinora-ai-insight-theme rounded-[28px] border border-amber-200 bg-white p-6 text-center text-slate-950 shadow-[0_18px_50px_rgba(15,23,42,0.12)] sm:p-8">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-amber-50 text-amber-700">
        <CircleAlert size={21} aria-hidden="true" />
      </span>
      <h2 className="mt-5 text-2xl font-semibold tracking-[-0.03em]">Your insight is not ready yet</h2>
      <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-600">
        {capacityIssue
          ? 'The private AI workspace is not available right now. Your report and verified values are unchanged.'
          : rejected
            ? 'Clinora’s safety checks did not accept the generated explanation. Nothing unsafe or incomplete was saved as your result.'
            : 'Clinora could not complete this analysis. Your report and reviewed values remain safe and unchanged.'}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button variant="appPrimary" onClick={onRetry} disabled={busy}>
          <RefreshCw size={16} className={busy ? 'animate-spin motion-reduce:animate-none' : ''} aria-hidden="true" />
          {busy ? 'Starting again…' : 'Try again'}
        </Button>
        <Link
          to={`/patient/analyze/${reportId}`}
          className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          Review verified values
        </Link>
      </div>
      {failureCode ? (
        <details className="mx-auto mt-6 max-w-lg text-xs text-slate-500">
          <summary className="cursor-pointer font-semibold">Support details</summary>
          <p className="mt-2">Reference: {failureCode}</p>
        </details>
      ) : null}
    </section>
  );
}

function InsightResult({
  report,
  extraction,
  analysis,
  busy,
  onRunAgain,
}: {
  report: PatientReport;
  extraction: PatientReportExtraction;
  analysis: PatientReportAiAnalysis;
  busy: boolean;
  onRunAgain: () => void;
}) {
  const result = analysis.result;
  const observationMap = useMemo(
    () => new Map(extraction.observations.map((observation) => [observation.id, observation])),
    [extraction.observations],
  );
  if (!result) return null;

  const { outside, within, unavailable } = observationSummary(extraction.observations);
  const clusterContractPresent = result.clinicalClusters != null && result.schemaVersion !== '1.0';
  const clusters = clusterContractPresent ? (result.clinicalClusters ?? []) : [];
  const legacyPatterns = clusterContractPresent ? [] : result.clinicalPatterns;
  const findingCount = clusters.length || legacyPatterns.length;
  const hasClinicalPattern = findingCount > 0;

  const interpretationTitle = clusters.length
    ? `Your report contains ${clusters.length} clinically related ${clusters.length === 1 ? 'pattern' : 'patterns'}.`
    : legacyPatterns.length
      ? `Your verified report contains ${legacyPatterns.length} clinical ${legacyPatterns.length === 1 ? 'pattern' : 'patterns'} worth discussing.`
      : result.analysisStatus === 'NO_CLEAR_ABNORMAL_PATTERN'
        ? 'No clear abnormal pattern stands out in this verified report.'
        : 'More context is needed to interpret these verified findings.';

  const clinicalRelevance = new Map<string, string>();
  clusters.forEach((cluster) => {
    cluster.evidence.forEach((evidence) => {
      if (evidence.clinicalRelevance?.trim() && !clinicalRelevance.has(evidence.observationId)) {
        clinicalRelevance.set(evidence.observationId, evidence.clinicalRelevance.trim());
      }
    });
  });
  result.notableFindings.forEach((finding) => {
    if (finding.interpretation?.trim() && !clinicalRelevance.has(finding.observationId)) {
      clinicalRelevance.set(finding.observationId, finding.interpretation.trim());
    }
  });

  const evidenceIds = [
    ...clusters.flatMap((cluster) => cluster.evidence.map((item) => item.observationId)),
    ...legacyPatterns.flatMap((pattern) => [
      ...pattern.supportingObservationIds,
      ...pattern.contradictoryObservationIds,
    ]),
    ...result.notableFindings.map((item) => item.observationId),
    ...outside.map((item) => item.id),
    ...within.map((item) => item.id),
  ];
  const seen = new Set<string>();
  const evidenceObservations = evidenceIds
    .flatMap((id) => {
      if (seen.has(id)) return [];
      const observation = observationMap.get(id);
      if (!observation) return [];
      seen.add(id);
      return [observation];
    })
    .slice(0, 8);

  const firstHalfCount = Math.ceil(extraction.observations.length / 2);
  const valueColumns = [
    extraction.observations.slice(0, firstHalfCount),
    extraction.observations.slice(firstHalfCount),
  ].filter((items) => items.length > 0);
  const analysisTimestamp = analysis.displayedCompletedAt ?? analysis.completedAt;

  return (
    <div className="clinora-ai-reference">
      <section className="clinora-ai-reference__top-grid">
        <article className="clinora-ai-reference__interpretation" aria-labelledby="clinora-ai-interpretation-title">
          <div className="clinora-ai-reference__interpretation-copy">
            <div className="clinora-reference-section-label"><BrainCircuit size={15} aria-hidden="true" /> Report interpretation</div>
            <h2 id="clinora-ai-interpretation-title">{interpretationTitle}</h2>
            <p>{result.overallInterpretation?.trim() || result.summary}</p>
          </div>
          <div className="clinora-ai-reference__checks" aria-label="Interpretation safeguards">
            <ResultReferenceCheck text="Verified report values evaluated" />
            <ResultReferenceCheck text={hasClinicalPattern ? 'Clinically related findings grouped' : 'No unsupported condition forced'} />
            <ResultReferenceCheck text="Evidence grounding checks applied" />
            <ResultReferenceCheck text="Clinical uncertainty remains explicit" />
            <ResultReferenceCheck text="Not a definitive diagnosis" />
          </div>
        </article>

        <aside className="clinora-ai-reference__intelligence" aria-label="Clinora AI analysis process">
          <div className="clinora-ai-reference__wave" aria-hidden="true" />
          <h3>Advanced AI.<br />Clearer answers.<br />Healthier tomorrows.</h3>
          <div className="clinora-ai-reference__intelligence-points">
            <span><FlaskConical size={16} aria-hidden="true" /> Lab data analyzed</span>
            <span><BrainCircuit size={16} aria-hidden="true" /> Clinical patterns evaluated</span>
            <span><Sparkles size={16} aria-hidden="true" /> Evidence-based insight</span>
          </div>
        </aside>
      </section>

      <section className="clinora-ai-reference__related-stack" aria-label="Clinical findings from this analysis">
        {clusters.length ? clusters.map((cluster, index) => (
          <ClusterRelatedFinding
            key={`${cluster.displayTitle || cluster.title}-${index}`}
            cluster={cluster}
            index={index}
            observationMap={observationMap}
          />
        )) : legacyPatterns.length ? legacyPatterns.map((pattern, index) => (
          <LegacyRelatedFinding
            key={`${pattern.name}-${index}`}
            pattern={pattern}
            index={index}
            observationMap={observationMap}
          />
        )) : (
          <article className="clinora-ai-reference__related" aria-labelledby="clinora-related-finding-title">
            <span className="clinora-reference-icon-well"><FlaskConical size={19} aria-hidden="true" /></span>
            <div className="min-w-0 flex-1">
              <p className="clinora-reference-section-label">Clinical interpretation</p>
              <h2 id="clinora-related-finding-title">
                {outside.length ? 'Verified findings worth discussing' : 'Verified report interpretation'}
              </h2>
              <p>{result.patientExplanation || result.summary}</p>
            </div>
            <span className="clinora-ai-reference__relevance is-neutral">
              {result.analysisStatus === 'NO_CLEAR_ABNORMAL_PATTERN' ? 'No clear pattern' : 'More context needed'}
            </span>
          </article>
        )}
      </section>

      <section className="clinora-ai-reference__evidence" aria-labelledby="clinora-evidence-title">
        <div className="clinora-ai-reference__section-heading">
          <div>
            <p className="clinora-reference-section-label"><FileCheck2 size={14} aria-hidden="true" /> Evidence from your report</p>
            <h2 id="clinora-evidence-title">Key verified laboratory findings</h2>
          </div>
          <span>{evidenceObservations.length} shown · {extraction.observations.length} verified</span>
        </div>
        {evidenceObservations.length ? (
          <div className="clinora-ai-reference__evidence-grid">
            {evidenceObservations.map((observation) => (
              <InsightEvidenceTile
                key={observation.id}
                observation={observation}
                clinicalRelevance={clinicalRelevance.get(observation.id)}
              />
            ))}
          </div>
        ) : (
          <p className="clinora-ai-reference__empty">No verified observation could be mapped to the AI evidence returned for this result.</p>
        )}
      </section>

      <section className="clinora-ai-reference__summary" aria-label="Verified report summary">
        <span className="clinora-reference-icon-well"><FileText size={18} aria-hidden="true" /></span>
        <div className="clinora-ai-reference__summary-metric is-alert">
          <span>Report summary</span><strong>{String(outside.length).padStart(2, '0')}</strong><p>Values outside expected range</p>
        </div>
        <div className="clinora-ai-reference__summary-metric is-good">
          <span>Verified range status</span><strong>{String(within.length).padStart(2, '0')}</strong><p>Values within expected range</p>
        </div>
        <div className="clinora-ai-reference__overview">
          <strong>Report overview</strong>
          <dl>
            <div><dt>Total parameters analyzed</dt><dd>{extraction.observations.length}</dd></div>
            <div><dt>Findings</dt><dd>{findingCount}</dd></div>
            <div><dt>Report type</dt><dd>{patientReportTypeLabels[report.reportType]}</dd></div>
            {unavailable.length ? <div><dt>Range not classified</dt><dd>{unavailable.length}</dd></div> : null}
          </dl>
        </div>
      </section>

      <section className="clinora-ai-reference__verified" aria-labelledby="verified-values-title">
        <div className="clinora-ai-reference__section-heading">
          <div>
            <p className="clinora-reference-section-label"><FileCheck2 size={14} aria-hidden="true" /> Exact values from your verified report</p>
            <h2 id="verified-values-title">Verified laboratory values</h2>
            <p>These are the actual values you confirmed. Clinora AI does not change them.</p>
          </div>
        </div>
        <div className="clinora-ai-reference__tables">
          {valueColumns.map((items, columnIndex) => <VerifiedValueTable key={columnIndex} observations={items} />)}
        </div>
      </section>

      <section className="clinora-ai-reference__bottom-grid">
        <article className="clinora-ai-reference__questions">
          <div className="clinora-reference-section-label"><MessagesSquare size={14} aria-hidden="true" /> Questions you may want to ask your clinician</div>
          {result.discussionPoints.length ? (
            <ul>
              {result.discussionPoints.map((point, index) => (
                <li key={`${point.type}-${point.title}-${index}`}><strong>{point.title}</strong><span>{point.reason}</span></li>
              ))}
            </ul>
          ) : <p>No discussion question was returned for this analysis.</p>}
        </article>

        <article className="clinora-ai-reference__about">
          <div className="clinora-reference-section-label"><ShieldCheck size={14} aria-hidden="true" /> About this AI insight</div>
          <p>
            Clinora AI analyzes your verified report using evidence-grounded clinical reasoning to identify potential patterns and provide educational insight. This is not a diagnosis and should not replace professional medical advice.
          </p>
          {result.limitations.length ? <ul>{result.limitations.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul> : null}
        </article>
      </section>

      <div className="clinora-ai-reference__actions">
        {analysisTimestamp ? (
          <span className="text-xs font-medium text-slate-500">
            Updated {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(analysisTimestamp))}
          </span>
        ) : null}
        <button type="button" onClick={onRunAgain} disabled={busy} className="clinora-reference-secondary-button">
          <RefreshCw size={15} className={busy ? 'animate-spin motion-reduce:animate-none' : ''} aria-hidden="true" />
          {busy ? 'Re-running analysis…' : 'Re-run AI analysis'}
        </button>
        <Link to="/patient/doctors" className="clinora-reference-primary-button"><Stethoscope size={15} aria-hidden="true" /> Find a doctor</Link>
        <Link to={`/patient/analyze/${report.id}`} className="clinora-reference-secondary-button"><FileCheck2 size={15} aria-hidden="true" /> View verified report</Link>
        <details className="clinora-ai-reference__analysis-meta">
          <summary>Analysis details</summary>
          <span>Prompt {result.promptVersion} · contract {result.schemaVersion}</span>
        </details>
      </div>
    </div>
  );
}

function ClusterRelatedFinding({
  cluster,
  index,
  observationMap,
}: {
  cluster: PatientReportAiClinicalCluster;
  index: number;
  observationMap: Map<string, PatientReportObservation>;
}) {
  const title = cluster.displayTitle?.trim() || cluster.title.trim() || `Clinical finding ${index + 1}`;
  const contradictory = cluster.evidence
    .filter((item) => item.role === 'CONTRADICTS')
    .map((item) => observationMap.get(item.observationId))
    .filter((item): item is PatientReportObservation => Boolean(item));
  const candidateNames = new Set(cluster.candidates.map((candidate) => candidate.name.trim().toLocaleLowerCase()));

  return (
    <article
      className="clinora-ai-reference__related"
      aria-label={`Clinical finding ${index + 1}: ${title}`}
    >
      <span className="clinora-reference-icon-well"><FlaskConical size={19} aria-hidden="true" /></span>
      <div className="min-w-0 flex-1">
        <p className="clinora-reference-section-label">{index === 0 ? 'Related finding' : `Related finding ${index + 1}`}</p>
        <h2>{title}</h2>
        <p>{cluster.interpretation}</p>

        {cluster.candidates.length ? (
          <div className="clinora-ai-reference__candidate-list">
            {cluster.candidates.map((candidate, candidateIndex) => {
              const candidateContradictions = candidate.contradictoryObservationIds
                .map((id) => observationMap.get(id))
                .filter((item): item is PatientReportObservation => Boolean(item));
              return (
                <details
                  key={`${candidate.name}-${candidateIndex}`}
                  className="clinora-ai-reference__candidate"
                  aria-label={`Possible condition: ${candidate.name}`}
                >
                  <summary><span>Possible condition</span><strong>{candidate.name}</strong><ChevronRight size={13} aria-hidden="true" /></summary>
                  <p>{candidate.rationale}</p>
                  <div className="clinora-ai-reference__candidate-context">
                    <CandidateContext
                      title="What does not fully match"
                      items={candidateContradictions.map((item) => `${item.label} · ${formatObservationValue(item)} · ${rangeStateLabel(rangeState(item))}`)}
                      empty="No contradictory verified observation was returned for this possibility."
                    />
                    <CandidateContext
                      title="What information is still missing"
                      items={candidate.missingEvidence}
                      empty="No additional missing-evidence item was returned."
                    />
                    <CandidateContext
                      title="Other possibilities to consider"
                      items={candidate.alternatives.filter(
                        (alternative) => !candidateNames.has(alternative.trim().toLocaleLowerCase()),
                      )}
                      empty="No alternative possibility was returned."
                    />
                  </div>
                </details>
              );
            })}
          </div>
        ) : (cluster.missingEvidence.length || cluster.alternatives.length || contradictory.length) ? (
          <details className="clinora-ai-reference__candidate clinora-ai-reference__candidate--context">
            <summary><span>Clinical context</span><strong>What would help interpret this pattern</strong><ChevronRight size={13} aria-hidden="true" /></summary>
            <div className="clinora-ai-reference__candidate-context">
              <CandidateContext
                title="What does not fully match"
                items={contradictory.map((item) => `${item.label} · ${formatObservationValue(item)} · ${rangeStateLabel(rangeState(item))}`)}
                empty="No contradictory verified observation was returned for this pattern."
              />
              <CandidateContext title="What information is still missing" items={cluster.missingEvidence} empty="No missing-evidence item was returned." />
              <CandidateContext title="Other possibilities to consider" items={cluster.alternatives} empty="No alternative possibility was returned." />
            </div>
          </details>
        ) : null}
      </div>
      <span className="clinora-ai-reference__relevance">Clinically relevant</span>
    </article>
  );
}

function LegacyRelatedFinding({
  pattern,
  index,
  observationMap,
}: {
  pattern: PatientReportAiClinicalPattern;
  index: number;
  observationMap: Map<string, PatientReportObservation>;
}) {
  const contradictions = pattern.contradictoryObservationIds
    .map((id) => observationMap.get(id))
    .filter((item): item is PatientReportObservation => Boolean(item));

  return (
    <article className="clinora-ai-reference__related" aria-label={`Clinical finding ${index + 1}: ${pattern.name}`}>
      <span className="clinora-reference-icon-well"><FlaskConical size={19} aria-hidden="true" /></span>
      <div className="min-w-0 flex-1">
        <p className="clinora-reference-section-label">{index === 0 ? 'Related finding' : `Related finding ${index + 1}`}</p>
        <h2>{pattern.name}</h2>
        <p>{pattern.reasoning}</p>
        {(pattern.missingEvidence.length || pattern.possibleCauses.length || contradictions.length) ? (
          <details className="clinora-ai-reference__candidate clinora-ai-reference__candidate--context">
            <summary><span>Clinical context</span><strong>Why this may fit and what is still missing</strong><ChevronRight size={13} aria-hidden="true" /></summary>
            <div className="clinora-ai-reference__candidate-context">
              <CandidateContext
                title="What does not fully match"
                items={contradictions.map((item) => `${item.label} · ${formatObservationValue(item)} · ${rangeStateLabel(rangeState(item))}`)}
                empty="No contradictory verified observation was returned for this pattern."
              />
              <CandidateContext title="What information is still missing" items={pattern.missingEvidence} empty="No missing-evidence item was returned." />
              <CandidateContext title="Other possibilities to consider" items={pattern.possibleCauses} empty="No alternative possibility was returned." />
            </div>
          </details>
        ) : null}
      </div>
      <span className="clinora-ai-reference__relevance">Clinically relevant</span>
    </article>
  );
}

function CandidateContext({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <section>
      <strong>{title}</strong>
      {items.length ? <ul>{items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul> : <p>{empty}</p>}
    </section>
  );
}

function ResultReferenceCheck({ text }: { text: string }) {
  return <span><CheckCircle2 size={15} aria-hidden="true" /> {text}</span>;
}

function InsightEvidenceTile({
  observation,
  clinicalRelevance,
}: {
  observation: PatientReportObservation;
  clinicalRelevance?: string;
}) {
  const state = rangeState(observation);
  return (
    <article className={cn('clinora-ai-reference__evidence-tile', (state === 'LOW' || state === 'HIGH') && 'is-outside')}>
      <div className="clinora-ai-reference__evidence-title">
        <strong>{observation.label}</strong>
        <span className={cn('clinora-ai-reference__range-pill', state === 'IN_RANGE' && 'is-good', (state === 'LOW' || state === 'HIGH') && 'is-alert')}>
          {rangeStateLabel(state)}
        </span>
      </div>
      <div className="clinora-ai-reference__evidence-value">{formatObservationValue(observation)}</div>
      <small>Ref: {formatReference(observation)}</small>
      {clinicalRelevance ? <p>{clinicalRelevance}</p> : null}
    </article>
  );
}

function VerifiedValueTable({ observations }: { observations: PatientReportObservation[] }) {
  return (
    <div className="clinora-ai-reference__value-table">
      <div className="clinora-ai-reference__value-head"><span>Test</span><span>Result</span><span>Reference</span><span>Status</span></div>
      {observations.map((observation) => {
        const state = rangeState(observation);
        return (
          <div key={observation.id} className="clinora-ai-reference__value-row">
            <strong>{observation.label}</strong>
            <span>{formatObservationValue(observation)}</span>
            <span>{formatReference(observation)}</span>
            <span className={cn('clinora-ai-reference__table-status', state === 'IN_RANGE' && 'is-good', (state === 'LOW' || state === 'HIGH') && 'is-alert')}>
              <i aria-hidden="true" /> {rangeStateLabel(state)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function MetricTile({ label, value, tone }: { label: string; value: number; tone: 'alert' | 'good' }) {
  return (
    <div className={cn('rounded-2xl border p-4', tone === 'alert' ? 'border-rose-200 bg-rose-50' : 'border-emerald-200 bg-emerald-50')}>
      <p className={cn('text-xs font-semibold', tone === 'alert' ? 'text-rose-700' : 'text-emerald-700')}>{label}</p>
      <p className={cn('mt-2 text-3xl font-bold tabular-nums', tone === 'alert' ? 'text-rose-700' : 'text-emerald-700')}>{String(value).padStart(2, '0')}</p>
    </div>
  );
}

function observationSummary(observations: PatientReportObservation[]) {
  const outside: PatientReportObservation[] = [];
  const within: PatientReportObservation[] = [];
  const unavailable: PatientReportObservation[] = [];
  for (const observation of observations) {
    const state = rangeState(observation);
    if (state === 'LOW' || state === 'HIGH') outside.push(observation);
    else if (state === 'IN_RANGE') within.push(observation);
    else unavailable.push(observation);
  }
  return { outside, within, unavailable };
}

const rangeState = patientObservationRangeState;

function InsightNotReady({ reportId, readinessCode }: { reportId: string; readinessCode: string | null }) {
  return (
    <section className="rounded-[var(--clinora-radius-lg)] border border-amber-300/15 bg-amber-300/[0.045] p-6 sm:p-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <CircleAlert size={20} className="mt-0.5 shrink-0 text-amber-200" aria-hidden="true" />
          <div>
            <h2 className="text-lg font-semibold text-white">This report needs one more check</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--clinora-text-muted)]">
              Clinora does not yet have enough verified report information to create a reliable insight. Review the extracted values before trying again.
            </p>
            {readinessCode ? (
              <details className="mt-3 text-xs text-[var(--clinora-text-faint)]">
                <summary className="cursor-pointer font-semibold hover:text-slate-300">Support details</summary>
                <p className="mt-2">Reference: {readinessCode}</p>
              </details>
            ) : null}
          </div>
        </div>
        <Link
          to={`/patient/analyze/${reportId}`}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 px-4 text-sm font-semibold text-slate-950"
        >
          Review report values <ChevronRight size={15} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

function VerificationGuard({ reportId }: { reportId: string }) {
  return (
    <section className="rounded-[var(--clinora-radius-lg)] border border-amber-300/15 bg-amber-300/[0.045] p-6 sm:p-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <FileCheck2 size={20} className="mt-0.5 shrink-0 text-amber-200" aria-hidden="true" />
          <div>
            <h2 className="text-lg font-semibold text-white">Finish reviewing the report first</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--clinora-text-muted)]">
              AI insight opens only after every flagged value has been reviewed and the extracted report data is confirmed.
            </p>
          </div>
        </div>
        <Link
          to={`/patient/analyze/${reportId}`}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 px-4 text-sm font-semibold text-slate-950"
        >
          Continue review <ChevronRight size={15} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

function InsightLoading() {
  return (
    <div className="space-y-5" aria-live="polite">
      <div className="h-20 animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.025] motion-reduce:animate-none" />
      <div className="min-h-[520px] animate-pulse rounded-[28px] border border-cyan-300/10 bg-cyan-300/[0.025] motion-reduce:animate-none" />
      <span className="sr-only">Loading your report insight…</span>
    </div>
  );
}

function InsightLoadError({ message }: { message: string }) {
  return (
    <section className="rounded-2xl border border-rose-400/20 bg-rose-400/[0.07] p-6" role="alert">
      <div className="flex gap-3">
        <CircleAlert size={20} className="mt-0.5 shrink-0 text-rose-200" aria-hidden="true" />
        <div>
          <h1 className="text-lg font-semibold text-white">This report insight could not be opened</h1>
          <p className="mt-2 text-sm leading-6 text-rose-100/80">{message}</p>
        </div>
      </div>
    </section>
  );
}
