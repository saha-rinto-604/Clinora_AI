import { CheckCircle2, CircleAlert, RefreshCw, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../../components/ui/button';
import { cn } from '../../lib/cn';
import { patientReportAiApi, patientReportAiErrorMessage } from './patient-report-ai-api';
import type {
  PatientReportAiAnalysis,
  PatientReportAiClinicalPattern,
  PatientReportAiEvidenceSupport,
  PatientReportAiJobStatus,
  PatientReportAiResult,
} from './patient-report-ai-types';

interface PatientReportAiPanelProps {
  reportId: string;
}

export function PatientReportAiPanel({ reportId }: PatientReportAiPanelProps) {
  const [analysis, setAnalysis] = useState<PatientReportAiAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const next = await patientReportAiApi.get(reportId);
      setAnalysis(next);
      setError('');
    } catch (requestError) {
      setError(patientReportAiErrorMessage(requestError, 'The AI report insight could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }, [reportId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  useEffect(() => {
    if (!analysis || !['QUEUED', 'PROCESSING'].includes(analysis.status)) return;
    const timer = window.setInterval(() => {
      void patientReportAiApi
        .get(reportId)
        .then((next) => {
          setAnalysis(next);
          setError('');
          if (!['QUEUED', 'PROCESSING'].includes(next.status)) window.clearInterval(timer);
        })
        .catch(() => undefined);
    }, 2500);
    return () => window.clearInterval(timer);
  }, [analysis, reportId]);

  async function requestInsight() {
    setRequesting(true);
    setError('');
    try {
      setAnalysis(await patientReportAiApi.request(reportId));
    } catch (requestError) {
      setError(patientReportAiErrorMessage(requestError, 'Clinora could not start the AI report insight.'));
    } finally {
      setRequesting(false);
    }
  }

  if (loading) {
    return (
      <section className="rounded-[var(--clinora-radius-lg)] border border-cyan-300/15 bg-[var(--clinora-surface-raised)] p-6">
        <div className="flex items-center gap-3 text-sm text-[var(--clinora-text-muted)]">
          <RefreshCw size={18} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
          Loading AI report insight…
        </div>
      </section>
    );
  }

  const status = analysis?.status ?? 'NOT_REQUESTED';
  const processing = status === 'QUEUED' || status === 'PROCESSING';
  const canRequest = status === 'NOT_REQUESTED' || status === 'FAILED' || Boolean(analysis?.stale);

  return (
    <section
      aria-labelledby="patient-report-ai-title"
      className="overflow-hidden rounded-[var(--clinora-radius-lg)] border border-cyan-300/15 bg-[linear-gradient(145deg,rgba(8,145,178,0.08),rgba(255,255,255,0.02)_48%,rgba(20,184,166,0.04))]"
    >
      <div className="border-b border-white/[0.07] p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-3">
            <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cyan-400/[0.09] text-cyan-200">
              <ShieldCheck size={19} aria-hidden="true" />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--clinora-info-foreground)]">
                MedGemma · Patient report intelligence
              </p>
              <h2 id="patient-report-ai-title" className="mt-1 text-xl font-semibold tracking-[-0.025em] text-white">
                AI report insight
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--clinora-text-muted)]">
                Clinora sends only your confirmed structured report values to the private MedGemma service. This
                interpretation is educational decision support, not a diagnosis or treatment plan.
              </p>
            </div>
          </div>
          {canRequest ? (
            <Button variant="appPrimary" onClick={() => void requestInsight()} disabled={requesting}>
              {requesting ? (
                <RefreshCw size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
              ) : (
                <CheckCircle2 size={16} aria-hidden="true" />
              )}
              {analysis?.stale
                ? 'Generate updated insight'
                : status === 'FAILED'
                  ? 'Try AI analysis again'
                  : 'Generate AI insight'}
            </Button>
          ) : null}
        </div>
        <div className="mt-5 flex flex-wrap gap-2 text-[11px] font-semibold text-slate-300">
          <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5">
            Verified values only
          </span>
          <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5">
            No medication advice
          </span>
          <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5">
            Evidence-linked reasoning
          </span>
        </div>
      </div>

      {error ? (
        <div
          className="m-5 rounded-2xl border border-rose-400/20 bg-rose-400/[0.07] p-4 text-sm text-rose-200"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {analysis?.stale ? (
        <div className="mx-5 mt-5 flex gap-3 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-4 text-sm text-amber-100 sm:mx-6">
          <CircleAlert size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p>
            This insight was created from an older verified value set. Generate an updated insight before relying on its
            explanation.
          </p>
        </div>
      ) : null}

      {status === 'NOT_REQUESTED' ? <ReadyState /> : null}
      {processing ? <ProcessingState status={status} /> : null}
      {status === 'FAILED' ? <FailureState failureCode={analysis?.failureCode ?? null} /> : null}
      {status === 'SUCCEEDED' && analysis?.result ? <ResultView analysis={analysis} /> : null}
    </section>
  );
}

function ReadyState() {
  return (
    <div className="p-5 sm:p-6">
      <div className="max-w-3xl">
        <h3 className="text-base font-semibold text-white">Your verified report values are ready</h3>
        <p className="mt-2 text-sm leading-6 text-[var(--clinora-text-muted)]">
          MedGemma can now identify notable findings, describe possible clinical patterns, explain which confirmed
          results support them, and highlight missing or uncertain evidence. It is allowed to return no clear pattern
          when the supplied data are insufficient.
        </p>
      </div>
    </div>
  );
}

function ProcessingState({ status }: { status: PatientReportAiJobStatus }) {
  return (
    <div className="p-5 sm:p-6" aria-live="polite">
      <div className="flex max-w-3xl gap-3">
        <RefreshCw
          size={19}
          className="mt-0.5 shrink-0 animate-spin text-cyan-200 motion-reduce:animate-none"
          aria-hidden="true"
        />
        <div>
          <h3 className="text-base font-semibold text-white">
            {status === 'QUEUED' ? 'AI insight queued' : 'MedGemma is analyzing the verified values'}
          </h3>
          <p className="mt-2 text-sm leading-6 text-[var(--clinora-text-muted)]">
            You can leave this page and return later. Your original report and confirmed extraction remain unchanged if
            the local AI service becomes unavailable.
          </p>
        </div>
      </div>
    </div>
  );
}

function FailureState({ failureCode }: { failureCode: string | null }) {
  const capacityIssue = failureCode === 'AI_MODEL_UNAVAILABLE' || failureCode === 'AI_SERVICE_UNAVAILABLE';
  return (
    <div className="p-5 sm:p-6" aria-live="polite">
      <div className="flex max-w-3xl gap-3 rounded-2xl border border-amber-300/15 bg-amber-300/[0.045] p-4">
        <CircleAlert size={19} className="mt-0.5 shrink-0 text-amber-300" aria-hidden="true" />
        <div>
          <h3 className="text-base font-semibold text-white">AI insight could not be completed</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--clinora-text-muted)]">
            {capacityIssue
              ? 'The local MedGemma service is unavailable or does not currently have enough GPU capacity. Your report and verified values are safe and unchanged.'
              : 'Clinora rejected or could not complete the AI response. Your report and verified values are safe and unchanged.'}
          </p>
          {failureCode ? (
            <p className="mt-2 text-[11px] text-[var(--clinora-text-faint)]">Reference: {failureCode}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ResultView({ analysis }: { analysis: PatientReportAiAnalysis }) {
  const result = analysis.result;
  if (!result) return null;

  return (
    <div className="space-y-0">
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-3xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-emerald-300">
              AI interpretation complete
            </p>
            <h3 className="mt-2 text-lg font-semibold text-white">What MedGemma found in the confirmed values</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">{result.summary}</p>
          </div>
          <AnalysisStatusPill status={result.analysisStatus} />
        </div>
      </div>

      {result.notableFindings.length ? (
        <div className="border-t border-white/[0.07] p-5 sm:p-6">
          <SectionHeading eyebrow="Confirmed evidence" title="Notable findings" />
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {result.notableFindings.map((finding) => (
              <article
                key={`${finding.observationId}-${finding.title}`}
                className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4"
              >
                <h4 className="text-sm font-semibold text-white">{finding.title}</h4>
                <p className="mt-2 text-xs leading-5 text-[var(--clinora-text-muted)]">{finding.interpretation}</p>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {result.clinicalPatterns.length ? (
        <div className="border-t border-white/[0.07] p-5 sm:p-6">
          <SectionHeading eyebrow="Clinical reasoning" title="Possible patterns to discuss" />
          <div className="mt-4 space-y-3">
            {result.clinicalPatterns.map((pattern, index) => (
              <PatternCard key={`${pattern.name}-${index}`} pattern={pattern} rank={index + 1} />
            ))}
          </div>
        </div>
      ) : (
        <div className="border-t border-white/[0.07] p-5 sm:p-6">
          <SectionHeading eyebrow="Clinical reasoning" title="No forced condition list" />
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--clinora-text-muted)]">
            MedGemma did not identify a sufficiently supported clinical pattern from the confirmed values provided. That
            is a valid result and does not mean that a complete clinical evaluation would find nothing important.
          </p>
        </div>
      )}

      {result.discussionPoints.length ? (
        <div className="border-t border-white/[0.07] p-5 sm:p-6">
          <SectionHeading eyebrow="Next conversation" title="Topics to discuss with a clinician" />
          <div className="mt-4 divide-y divide-white/[0.06] rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4">
            {result.discussionPoints.map((point, index) => (
              <div key={`${point.type}-${point.title}-${index}`} className="py-4">
                <p className="text-sm font-semibold text-white">{point.title}</p>
                <p className="mt-1 text-xs leading-5 text-[var(--clinora-text-muted)]">{point.reason}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="border-t border-white/[0.07] p-5 sm:p-6">
        <SectionHeading eyebrow="Plain-language explanation" title="What this means" />
        <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-300">{result.patientExplanation}</p>
        <div className="mt-5 rounded-2xl border border-amber-300/15 bg-amber-300/[0.045] p-4">
          <p className="text-xs font-semibold text-amber-100">Important limitations</p>
          <ul className="mt-2 space-y-1.5 text-xs leading-5 text-[var(--clinora-text-muted)]">
            {result.limitations.map((limitation, index) => (
              <li key={`${limitation}-${index}`} className="flex gap-2">
                <span aria-hidden="true">•</span>
                <span>{limitation}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link
            to="/patient/doctors"
            className="inline-flex min-h-10 items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 px-4 text-sm font-semibold text-slate-950 transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 motion-reduce:transform-none"
          >
            Find a doctor
          </Link>
          <p className="text-xs text-[var(--clinora-text-faint)]">
            Clinical decisions, diagnosis and treatment remain with qualified healthcare professionals.
          </p>
        </div>
      </div>

      <div className="border-t border-white/[0.07] px-5 py-3 text-[10px] leading-5 text-[var(--clinora-text-faint)] sm:px-6">
        Model: {result.modelName} · Prompt: {result.promptVersion} · Contract: {result.schemaVersion}
      </div>
    </div>
  );
}

function PatternCard({ pattern, rank }: { pattern: PatientReportAiClinicalPattern; rank: number }) {
  const evidenceItems = useMemo(
    () => [
      ...pattern.missingEvidence.map((item) => ({ label: 'Missing evidence', value: item })),
      ...pattern.possibleCauses.map((item) => ({ label: 'Possible cause', value: item })),
    ],
    [pattern.missingEvidence, pattern.possibleCauses],
  );

  return (
    <article className="rounded-2xl border border-white/[0.075] bg-white/[0.025] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-xs font-bold text-slate-300">
            {rank}
          </span>
          <div>
            <h4 className="text-base font-semibold text-white">{pattern.name}</h4>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--clinora-text-muted)]">{pattern.reasoning}</p>
          </div>
        </div>
        <EvidencePill support={pattern.supportLevel} />
      </div>
      {evidenceItems.length ? (
        <div className="mt-4 grid gap-2 border-t border-white/[0.06] pt-4 sm:grid-cols-2">
          {evidenceItems.map((item, index) => (
            <div key={`${item.label}-${item.value}-${index}`} className="rounded-xl bg-white/[0.025] px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--clinora-text-faint)]">
                {item.label}
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-300">{item.value}</p>
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function EvidencePill({ support }: { support: PatientReportAiEvidenceSupport }) {
  return (
    <span
      className={cn(
        'rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em]',
        support === 'STRONG' && 'border-emerald-300/20 bg-emerald-400/[0.07] text-emerald-200',
        support === 'MODERATE' && 'border-cyan-300/20 bg-cyan-400/[0.07] text-cyan-100',
        support === 'LIMITED' && 'border-amber-300/20 bg-amber-300/[0.06] text-amber-100',
      )}
    >
      {support.toLowerCase()} AI support
    </span>
  );
}

function AnalysisStatusPill({ status }: { status: PatientReportAiResult['analysisStatus'] }) {
  const label =
    status === 'POSSIBLE_CLINICAL_PATTERN'
      ? 'Possible pattern'
      : status === 'NO_CLEAR_ABNORMAL_PATTERN'
        ? 'No clear pattern'
        : 'Insufficient evidence';
  return (
    <span className="rounded-full border border-white/[0.09] bg-white/[0.035] px-3 py-1.5 text-[11px] font-semibold text-slate-300">
      {label}
    </span>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--clinora-text-faint)]">{eyebrow}</p>
      <h3 className="mt-1 text-base font-semibold text-white">{title}</h3>
    </div>
  );
}
