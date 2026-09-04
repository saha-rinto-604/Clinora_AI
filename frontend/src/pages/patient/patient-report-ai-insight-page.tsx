import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  FileCheck2,
  FileText,
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
import { cn } from '../../lib/cn';
import { patientReportAiApi, patientReportAiErrorMessage } from '../../features/patient-reports/patient-report-ai-api';
import type {
  PatientReportAiAnalysis,
  PatientReportAiAnalysisStatus,
  PatientReportAiClinicalPattern,
  PatientReportAiJobStatus,
  PatientReportAiResult,
} from '../../features/patient-reports/patient-report-ai-types';
import { patientReportApi } from '../../features/patient-reports/patient-report-api';
import { patientReportExtractionApi } from '../../features/patient-reports/patient-report-extraction-api';
import type {
  PatientReportExtraction,
  PatientReportObservation,
} from '../../features/patient-reports/patient-report-extraction-types';
import { patientReportTypeLabels, type PatientReport } from '../../features/patient-reports/patient-report-types';

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

  async function requestInsight() {
    setRequesting(true);
    setError('');
    try {
      setAnalysis(await patientReportAiApi.request(reportId));
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
          <Button variant="appPrimary" size="sm" onClick={() => void requestInsight()} disabled={requesting}>
            <RefreshCw size={15} className={requesting ? 'animate-spin motion-reduce:animate-none' : ''} aria-hidden="true" />
            {requesting ? 'Starting…' : 'Refresh insight'}
          </Button>
        </div>
      ) : null}

      {verified && status === 'NOT_REQUESTED' ? (
        <InsightReady report={report} extraction={extraction} busy={requesting} onStart={() => void requestInsight()} />
      ) : null}

      {verified && ['QUEUED', 'PROCESSING'].includes(status) ? (
        <InsightLab status={status} report={report} extraction={extraction} analysis={analysis} />
      ) : null}

      {verified && status === 'FAILED' ? (
        <InsightFailure
          failureCode={analysis.failureCode}
          busy={requesting}
          onRetry={() => void requestInsight()}
          reportId={reportId}
        />
      ) : null}

      {verified && status === 'SUCCEEDED' && analysis.result ? (
        <InsightResult report={report} extraction={extraction} analysis={analysis} />
      ) : null}
    </div>
  );
}

function InsightHeader({ report, reportId }: { report: PatientReport; reportId: string }) {
  return (
    <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <Link
          to={`/patient/analyze/${reportId}`}
          className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--clinora-text-muted)] transition-colors hover:text-white"
        >
          <ArrowLeft size={14} aria-hidden="true" /> Back to verified report
        </Link>
        <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-300">Clinora AI · MedGemma</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em] text-white sm:text-4xl">Your report insight</h1>
        <p className="mt-2 text-sm text-[var(--clinora-text-muted)]">
          {report.reportName} · {patientReportTypeLabels[report.reportType]}
          {report.providerLaboratory ? ` · ${report.providerLaboratory}` : ''}
        </p>
      </div>
      <div className="flex flex-wrap gap-2 text-[11px] font-semibold text-slate-300">
        <TrustChip icon={FileCheck2} label="Verified report values" />
        <TrustChip icon={LockKeyhole} label="Private by design" />
        <TrustChip icon={ShieldCheck} label="Safety checked before display" />
      </div>
    </header>
  );
}

function TrustChip({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5">
      <Icon size={13} className="text-cyan-200" aria-hidden="true" /> {label}
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
    <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-[#f5f7fb] text-slate-950 shadow-[0_24px_70px_rgba(15,23,42,0.16)]">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
        <div className="bg-white p-6 sm:p-8 lg:p-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-cyan-800">
            <CheckCircle2 size={14} aria-hidden="true" /> Verified and ready
          </span>
          <h2 className="mt-5 max-w-3xl text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">
            Understand what your verified lab report may suggest.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
            MedGemma looks for clinically meaningful patterns and possible conditions while Clinora keeps the exact values,
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
          <p className="mt-2 text-lg font-semibold text-slate-950">{report.reportName}</p>
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
    <section aria-live="polite" className="rounded-[32px] border border-slate-200 bg-[#f4f7fb] p-4 text-slate-950 shadow-[0_26px_80px_rgba(15,23,42,0.18)] sm:p-7 lg:p-10">
      <div className="mx-auto max-w-4xl rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.10)] sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">
            <FileText size={16} aria-hidden="true" /> {report.reportName}
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
              <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500 motion-reduce:animate-none" /> MedGemma analysis active
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
              ? 'Your request is securely queued. Analysis will start automatically when the local MedGemma worker is ready.'
              : 'Clinora is asking MedGemma for cautious clinical possibilities, then checking every evidence link before anything is shown.'}
          </p>
        </div>

        <div className="mt-6 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
          <div className="h-2 w-full animate-pulse bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-600 motion-reduce:animate-none" />
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <ProcessStep title="Verified values" text="Confirmed report data" state="complete" />
          <ProcessStep
            title="AI reasoning + evidence"
            text={queued ? 'Waiting to start' : 'Clinical inference with grounding checks'}
            state="active"
          />
          <ProcessStep title="Safe result" text="Shown only after validation" state="waiting" />
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-slate-200 pt-5 text-xs font-medium text-slate-500">
          <span className="inline-flex items-center gap-1.5"><FileCheck2 size={14} className="text-emerald-600" aria-hidden="true" /> Verified values only</span>
          <span className="inline-flex items-center gap-1.5"><LockKeyhole size={14} className="text-blue-600" aria-hidden="true" /> Private Clinora processing</span>
          <span className="inline-flex items-center gap-1.5"><ShieldCheck size={14} className="text-cyan-700" aria-hidden="true" /> Validation required before display</span>
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
    <section className="rounded-[28px] border border-amber-200 bg-white p-6 text-center text-slate-950 shadow-[0_18px_50px_rgba(15,23,42,0.12)] sm:p-8">
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
}: {
  report: PatientReport;
  extraction: PatientReportExtraction;
  analysis: PatientReportAiAnalysis;
}) {
  const result = analysis.result;
  const observationMap = useMemo(
    () => new Map(extraction.observations.map((observation) => [observation.id, observation])),
    [extraction.observations],
  );
  if (!result) return null;

  const hasConditions = result.analysisStatus === 'POSSIBLE_CLINICAL_PATTERN' && result.clinicalPatterns.length > 0;
  const { outside, within, unavailable } = observationSummary(extraction.observations);
  const keyOutside = outside.slice(0, 4);

  return (
    <div className="overflow-hidden rounded-[30px] border border-slate-200 bg-[#f5f7fb] text-slate-950 shadow-[0_26px_80px_rgba(15,23,42,0.18)]">
      <ResultHero result={result} report={report} hasConditions={hasConditions} outsideCount={outside.length} />

      <section className="border-t border-slate-200 p-5 sm:p-7 lg:p-8">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.42fr)]">
          <div className="rounded-[22px] border border-slate-200 bg-white p-5 sm:p-6">
            <SectionHeadingLight eyebrow="Health summary" title="Your verified report at a glance" />
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <MetricTile label="Outside expected range" value={outside.length} tone="alert" />
              <MetricTile label="Within expected range" value={within.length} tone="good" />
            </div>
            {unavailable.length ? (
              <p className="mt-3 text-xs text-slate-500">
                {unavailable.length} verified {unavailable.length === 1 ? 'result has' : 'results have'} no usable reference range in the report.
              </p>
            ) : null}
          </div>

          <div className="rounded-[22px] border border-slate-200 bg-white p-5 sm:p-6">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Report overview</p>
            <p className="mt-2 text-base font-semibold text-slate-950">{patientReportTypeLabels[report.reportType]}</p>
            <div className="mt-4 flex items-center justify-between gap-4 border-t border-slate-100 pt-4 text-sm">
              <span className="text-slate-500">Out of range / total</span>
              <span className="font-semibold tabular-nums text-slate-900">{outside.length}/{extraction.observations.length}</span>
            </div>
            <div className="mt-3">
              <p className="text-xs font-semibold text-slate-500">Key results</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {keyOutside.length ? keyOutside.map((observation) => <CompactFinding key={observation.id} observation={observation} />) : (
                  <span className="text-sm text-emerald-700">No verified values are outside their supplied ranges.</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 p-5 sm:p-7 lg:p-8">
        {hasConditions ? (
          <>
            <SectionHeadingLight
              eyebrow="AI interpretation"
              title="Possible conditions to discuss"
              description="Clinora shows a condition only when MedGemma links it to verified evidence that passes grounding checks. These are possibilities, not diagnoses."
            />
            <div className="mt-5 space-y-5">
              {result.clinicalPatterns.map((pattern, index) => (
                <ConditionCard
                  key={`${pattern.name}-${index}`}
                  pattern={pattern}
                  index={index}
                  observationMap={observationMap}
                />
              ))}
            </div>
          </>
        ) : outside.length ? (
          <ClinicalPatternFallback result={result} outside={outside} />
        ) : (
          <ReassuringResult result={result} />
        )}
      </section>

      {outside.length ? (
        <section className="border-t border-slate-200 p-5 sm:p-7 lg:p-8">
          <SectionHeadingLight
            eyebrow="Verified findings"
            title="What stands out in your report"
            description="These statuses are calculated from the exact values and reference ranges you confirmed. MedGemma cannot change them."
          />
          <div className="mt-5 overflow-hidden rounded-[22px] border border-slate-200 bg-white">
            <div className="hidden grid-cols-[minmax(0,1.2fr)_minmax(120px,0.7fr)_minmax(150px,0.8fr)_minmax(150px,0.8fr)] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 md:grid">
              <span>Test</span><span>Result</span><span>Reference</span><span>Status</span>
            </div>
            {outside.map((observation, index) => (
              <VerifiedFindingRow
                key={observation.id}
                observation={observation}
                repeatedStatus={outside.slice(0, index).some((candidate) => rangeState(candidate) === rangeState(observation))}
              />
            ))}
          </div>
        </section>
      ) : null}

      {result.discussionPoints.length ? (
        <section className="border-t border-slate-200 p-5 sm:p-7 lg:p-8">
          <SectionHeadingLight eyebrow="Your next conversation" title="Questions you may want to ask your clinician" />
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {result.discussionPoints.map((point, index) => (
              <article key={`${point.type}-${point.title}-${index}`} className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-cyan-50 text-cyan-700">
                  <MessagesSquare size={17} aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{point.title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{point.reason}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="border-t border-slate-200 bg-white p-5 sm:p-7 lg:p-8">
        {hasConditions ? (
          <>
            <SectionHeadingLight
              eyebrow="In everyday language"
              title="What this may mean for you"
              description="A plain-language explanation to help you prepare for a conversation with a clinician."
            />
            <p className="mt-4 max-w-4xl text-base leading-8 text-slate-700">{result.patientExplanation}</p>
          </>
        ) : null}

        <div className={cn('rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5', hasConditions && 'mt-7')}>
          <div className="flex gap-3">
            <ShieldCheck size={18} className="mt-0.5 shrink-0 text-amber-700" aria-hidden="true" />
            <div className="max-w-4xl">
              <p className="text-sm font-semibold text-amber-950">About this AI insight</p>
              <p className="mt-2 text-sm leading-6 text-amber-950/75">
                Clinora AI helps you understand patterns in your verified report. It does not diagnose a medical condition
                and cannot replace an evaluation by a qualified healthcare professional. A clinician can interpret these
                findings together with your symptoms, medical history, medicines, and other tests.
              </p>
              {result.limitations.length ? (
                <ul className="mt-4 space-y-1.5 border-t border-amber-200 pt-4 text-xs leading-5 text-amber-950/70">
                  {result.limitations.map((limitation, index) => (
                    <li key={`${limitation}-${index}`} className="flex gap-2"><span aria-hidden="true">•</span><span>{limitation}</span></li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            to="/patient/doctors"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-400"
          >
            <Stethoscope size={16} aria-hidden="true" /> Find a doctor
          </Link>
          <Link
            to={`/patient/analyze/${report.id}`}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            View verified report <ChevronRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <details className="border-t border-slate-200 bg-slate-50 px-5 py-4 text-[11px] text-slate-500 sm:px-7 lg:px-8">
        <summary className="cursor-pointer font-semibold text-slate-600">About this analysis</summary>
        <p className="mt-2 leading-5">
          Powered by {result.modelName}. The result uses verified report values with Clinora’s evidence and patient-safety checks.
          Prompt {result.promptVersion} · contract {result.schemaVersion}.
        </p>
      </details>
    </div>
  );
}

function ResultHero({
  result,
  report,
  hasConditions,
  outsideCount,
}: {
  result: PatientReportAiResult;
  report: PatientReport;
  hasConditions: boolean;
  outsideCount: number;
}) {
  const title = hasConditions
    ? 'Your verified report may fit one or more possible conditions.'
    : outsideCount
      ? 'Your report shows a clinical pattern worth discussing.'
      : 'No clear abnormal pattern stands out in this verified report.';

  return (
    <section className="bg-white p-6 sm:p-8 lg:p-10">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-4xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-800">
              <CheckCircle2 size={13} aria-hidden="true" /> Report processed
            </span>
            <ResultStatusPill status={result.analysisStatus} />
          </div>
          <h2 className="mt-5 text-3xl font-semibold tracking-[-0.045em] text-slate-950 sm:text-4xl lg:text-5xl">{title}</h2>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">{result.summary}</p>
          <p className="mt-4 text-xs text-slate-500">
            Prepared from the verified values in {report.reportName}. This is AI-assisted interpretation, not a diagnosis or treatment plan.
          </p>
        </div>
        <div className="grid min-w-[250px] gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs">
          <ResultTrustRow icon={FileCheck2} text="Based on values you reviewed" />
          <ResultTrustRow icon={ShieldCheck} text="Evidence and safety checks applied" />
          <ResultTrustRow icon={Stethoscope} text="Possible conditions are not diagnoses" />
        </div>
      </div>
    </section>
  );
}

function ResultTrustRow({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return <div className="flex items-center gap-2.5 text-slate-600"><Icon size={15} className="text-cyan-700" aria-hidden="true" /> {text}</div>;
}

function MetricTile({ label, value, tone }: { label: string; value: number; tone: 'alert' | 'good' }) {
  return (
    <div className={cn('rounded-2xl border p-4', tone === 'alert' ? 'border-rose-200 bg-rose-50' : 'border-emerald-200 bg-emerald-50')}>
      <p className={cn('text-xs font-semibold', tone === 'alert' ? 'text-rose-700' : 'text-emerald-700')}>{label}</p>
      <p className={cn('mt-2 text-3xl font-bold tabular-nums', tone === 'alert' ? 'text-rose-700' : 'text-emerald-700')}>{String(value).padStart(2, '0')}</p>
    </div>
  );
}

function CompactFinding({ observation }: { observation: PatientReportObservation }) {
  const state = rangeState(observation);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
      {state === 'HIGH' ? <ArrowUp size={12} className="text-amber-600" aria-hidden="true" /> : <ArrowDown size={12} className="text-blue-600" aria-hidden="true" />}
      {`${observation.label} · ${rangeStateLabel(state)}`}
    </span>
  );
}

function ConditionCard({
  pattern,
  index,
  observationMap,
}: {
  pattern: PatientReportAiClinicalPattern;
  index: number;
  observationMap: Map<string, PatientReportObservation>;
}) {
  const supporting = pattern.supportingObservationIds
    .map((id) => observationMap.get(id))
    .filter((observation): observation is PatientReportObservation => Boolean(observation));
  const contradictory = pattern.contradictoryObservationIds
    .map((id) => observationMap.get(id))
    .filter((observation): observation is PatientReportObservation => Boolean(observation));

  return (
    <article className="overflow-hidden rounded-[22px] border border-blue-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
      <div className="border-b border-blue-100 bg-blue-50/70 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.13em] text-blue-700">
          <span>Possible condition</span>
          {index > 0 ? <span className="text-slate-400">Alternative possibility</span> : null}
        </div>
        <h3 className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-slate-950">{pattern.name}</h3>
      </div>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)]">
        <div className="p-5 sm:p-6">
          <h4 className="text-sm font-semibold text-slate-950">Why this may fit</h4>
          <p className="mt-2 text-sm leading-7 text-slate-600">{pattern.reasoning}</p>

          <h4 className="mt-6 text-sm font-semibold text-slate-950">Evidence from your verified report</h4>
          <div className="mt-3 space-y-2">
            {supporting.map((observation) => <EvidenceRow key={observation.id} observation={observation} />)}
          </div>

          {contradictory.length ? (
            <div className="mt-6">
              <h4 className="text-sm font-semibold text-slate-950">What does not fully match</h4>
              <div className="mt-3 space-y-2">
                {contradictory.map((observation) => <EvidenceRow key={observation.id} observation={observation} muted />)}
              </div>
            </div>
          ) : null}
        </div>

        <aside className="border-t border-slate-200 bg-slate-50 p-5 sm:p-6 lg:border-l lg:border-t-0">
          {pattern.missingEvidence.length ? (
            <InfoList title="What information is still missing" items={pattern.missingEvidence} />
          ) : (
            <p className="text-sm leading-6 text-slate-600">A clinician may still need symptoms, history, examination findings, or other tests to judge whether this possibility fits.</p>
          )}

          {pattern.possibleCauses.length ? (
            <div className="mt-6 border-t border-slate-200 pt-5">
              <InfoList title="Other possibilities to consider" items={pattern.possibleCauses} />
            </div>
          ) : null}

          <p className="mt-6 border-t border-slate-200 pt-5 text-xs leading-5 text-slate-500">
            Clinora shows this as a possibility because the evidence links passed grounding checks. It is not a diagnosis.
          </p>
        </aside>
      </div>
    </article>
  );
}

function ClinicalPatternFallback({ result, outside }: { result: PatientReportAiResult; outside: PatientReportObservation[] }) {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)]">
      <article className="rounded-[22px] border border-blue-200 bg-white p-5 sm:p-6">
        <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-blue-700">
          Clinical pattern worth discussing
        </span>
        <h2 className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-slate-950">The findings are meaningful, but not specific enough for one condition.</h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">{result.patientExplanation}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {outside.slice(0, 5).map((observation) => <CompactFinding key={observation.id} observation={observation} />)}
        </div>
      </article>
      <aside className="rounded-[22px] border border-slate-200 bg-white p-5 sm:p-6">
        <h3 className="text-sm font-semibold text-slate-950">Why Clinora is not naming a condition yet</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          The verified findings do not distinguish one responsible condition-level explanation strongly enough. Clinora will not force a disease name simply to produce a prediction.
        </p>
        <div className="mt-5 border-t border-slate-200 pt-5">
          <InfoList
            title="What could help clarify the pattern"
            items={[
              'Relevant symptoms and medical history',
              'The rest of the report and previous comparable results',
              'Additional tests selected by a qualified clinician when appropriate',
            ]}
          />
        </div>
      </aside>
    </div>
  );
}

function ReassuringResult({ result }: { result: PatientReportAiResult }) {
  return (
    <article className="rounded-[22px] border border-emerald-200 bg-emerald-50 p-5 sm:p-6">
      <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-800"><CheckCircle2 size={17} aria-hidden="true" /> No clear abnormal pattern from this report</span>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-emerald-950/75">{result.patientExplanation}</p>
    </article>
  );
}

function InfoList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-slate-950">{title}</h4>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
        {items.map((item) => <li key={item} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-600" aria-hidden="true" /><span>{item}</span></li>)}
      </ul>
    </div>
  );
}

function EvidenceRow({ observation, muted = false }: { observation: PatientReportObservation; muted?: boolean }) {
  return (
    <div className={cn('grid gap-2 rounded-xl border px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center', muted ? 'border-slate-200 bg-slate-50' : 'border-cyan-100 bg-cyan-50/50')}>
      <div>
        <p className="text-sm font-semibold text-slate-900">{observation.label}</p>
        <p className="mt-1 text-xs text-slate-500">{formatObservationValue(observation)} · Reference {formatReference(observation)}</p>
      </div>
      <RangePill state={rangeState(observation)} />
    </div>
  );
}

function VerifiedFindingRow({
  observation,
  repeatedStatus,
}: {
  observation: PatientReportObservation;
  repeatedStatus: boolean;
}) {
  return (
    <div className="grid gap-2 border-b border-slate-100 px-5 py-4 last:border-b-0 md:grid-cols-[minmax(0,1.2fr)_minmax(120px,0.7fr)_minmax(150px,0.8fr)_minmax(150px,0.8fr)] md:items-center md:gap-4">
      <span className="font-semibold text-slate-900">{observation.label}</span>
      <span className="text-sm text-slate-700"><span className="mr-2 text-xs text-slate-400 md:hidden">Result</span>{formatObservationValue(observation)}</span>
      <span className="text-sm text-slate-600"><span className="mr-2 text-xs text-slate-400 md:hidden">Reference</span>{formatReference(observation)}</span>
      <RangePill state={rangeState(observation)} prefix={repeatedStatus ? 'Also ' : undefined} />
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

type ObservationRangeState = 'LOW' | 'IN_RANGE' | 'HIGH' | 'REPORTED';

function rangeState(observation: PatientReportObservation): ObservationRangeState {
  if (observation.valueType === 'NUMERIC' && observation.numericValue != null) {
    if (observation.referenceLow != null && observation.numericValue < observation.referenceLow) return 'LOW';
    if (observation.referenceHigh != null && observation.numericValue > observation.referenceHigh) return 'HIGH';
    if (observation.referenceLow != null || observation.referenceHigh != null) return 'IN_RANGE';
  }
  const flag = `${observation.derivedRangeFlag ?? ''} ${observation.sourceFlag ?? ''}`.toUpperCase();
  if (flag.includes('ABOVE') || /\b(?:HIGH|H)\b/.test(flag)) return 'HIGH';
  if (flag.includes('BELOW') || /\b(?:LOW|L)\b/.test(flag)) return 'LOW';
  if (flag.includes('WITHIN') || flag.includes('NORMAL') || flag.includes('IN_RANGE')) return 'IN_RANGE';
  return 'REPORTED';
}

function RangePill({ state, prefix = '' }: { state: ObservationRangeState; prefix?: string }) {
  const label = rangeStateLabel(state);
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-[10px] font-bold',
        state === 'IN_RANGE' && 'border-emerald-200 bg-emerald-50 text-emerald-800',
        state === 'HIGH' && 'border-amber-200 bg-amber-50 text-amber-800',
        state === 'LOW' && 'border-blue-200 bg-blue-50 text-blue-800',
        state === 'REPORTED' && 'border-slate-200 bg-slate-50 text-slate-600',
      )}
    >
      {`${prefix}${prefix ? label.toLocaleLowerCase() : label}`}
    </span>
  );
}

function rangeStateLabel(state: ObservationRangeState) {
  return state === 'IN_RANGE'
    ? 'Within expected range'
    : state === 'REPORTED'
      ? 'Range not available'
      : state === 'HIGH'
        ? 'Higher than expected'
        : 'Lower than expected';
}

function formatObservationValue(observation: PatientReportObservation) {
  const value = observation.numericValue != null
    ? `${observation.comparator ?? ''}${observation.numericValue}`
    : observation.textValue || 'Reported';
  return observation.unit ? `${value} ${observation.unit}` : value;
}

function formatReference(observation: PatientReportObservation) {
  if (observation.referenceRangeRaw) return observation.referenceRangeRaw;
  if (observation.referenceLow != null && observation.referenceHigh != null) return `${observation.referenceLow}–${observation.referenceHigh}`;
  if (observation.referenceLow != null) return `≥ ${observation.referenceLow}`;
  if (observation.referenceHigh != null) return `≤ ${observation.referenceHigh}`;
  return 'Not stated on report';
}

function ResultStatusPill({ status }: { status: PatientReportAiAnalysisStatus }) {
  const label = status === 'POSSIBLE_CLINICAL_PATTERN' ? 'Possible condition' : status === 'NO_CLEAR_ABNORMAL_PATTERN' ? 'No clear condition' : 'More context needed';
  return <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-600">{label}</span>;
}

function SectionHeadingLight({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return (
    <div className="max-w-3xl">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-700">{eyebrow}</p>
      <h2 className="mt-1 text-xl font-semibold tracking-[-0.025em] text-slate-950">{title}</h2>
      {description ? <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p> : null}
    </div>
  );
}

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
