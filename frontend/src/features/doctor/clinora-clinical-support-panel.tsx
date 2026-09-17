import { AlertTriangle, BookOpen, CheckCircle2, LoaderCircle, Sparkles, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '../../components/ui/button';
import { doctorError } from './doctor-api';
import {
  doctorClinicalSupportApi,
  type DoctorSupportClinicalResult,
  type DoctorSupportExecutionResponse,
  type DoctorSupportScreen,
  type DoctorSupportTaskId,
} from './doctor-clinical-support-api';

const taskLabels: Record<DoctorSupportTaskId, string> = {
  BRIEF_PATIENT: 'Brief me',
  CONNECT_EVIDENCE: 'Connect findings',
  COMPARE_EVIDENCE: 'Compare',
  CROSS_CHECK_ASSESSMENT: 'Cross-check assessment',
  FIND_GAPS: 'Find gaps',
  EXPLORE_EXPLANATIONS: 'Explore explanations',
  STRUCTURE_NOTES: 'Structure notes',
  FOCUSED_EVIDENCE_QUESTION: 'Ask about this evidence',
};

export interface ClinoraClinicalSupportPanelProps {
  appointmentId: string;
  screen: DoctorSupportScreen;
  currentReportId?: string;
  selectedObservationIds?: string[];
  comparableReportsAvailable?: boolean;
  appointmentMode?: boolean;
}

export function ClinoraClinicalSupportPanel({
  appointmentId,
  screen,
  currentReportId,
  selectedObservationIds = [],
  comparableReportsAvailable = false,
  appointmentMode = false,
}: ClinoraClinicalSupportPanelProps) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [assessment, setAssessment] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [choices, setChoices] = useState<
    Array<{ taskId: DoctorSupportTaskId; label: string; shortDescription: string }>
  >([]);
  const [response, setResponse] = useState<DoctorSupportExecutionResponse | null>(null);
  const [resultSignature, setResultSignature] = useState('');

  const signature = useMemo(
    () => JSON.stringify([currentReportId || '', [...selectedObservationIds].sort(), assessment.trim(), notes.trim()]),
    [assessment, currentReportId, notes, selectedObservationIds],
  );
  const stale = Boolean(response && resultSignature !== signature);

  const execute = async (taskIds: DoctorSupportTaskId[], originalQuestion: string) => {
    setBusy(true);
    setMessage('');
    setChoices([]);
    try {
      const execution = await doctorClinicalSupportApi.execute(appointmentId, {
        taskIds,
        originalQuestion,
        currentReportId: currentReportId || null,
        selectedObservationIds,
        doctorAssessment: assessment.trim() || null,
        doctorNotes: notes.trim() || null,
        clientExecutionKey: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      });
      setResponse(execution);
      setResultSignature(signature);
    } catch (error) {
      setMessage(doctorError(error, 'Clinora could not safely complete this request. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const route = async (explicitTaskId?: DoctorSupportTaskId) => {
    const text = explicitTaskId ? taskLabels[explicitTaskId] : question.trim();
    if (!text) return;
    setOpen(true);
    setBusy(true);
    setMessage('');
    setChoices([]);
    try {
      const decision = await doctorClinicalSupportApi.route(appointmentId, {
        message: text,
        explicitTaskId: explicitTaskId || null,
        currentScreen: screen,
        currentReportId: currentReportId || null,
        selectedObservationIds,
        doctorAssessmentPresent: Boolean(assessment.trim()),
        doctorNotesPresent: Boolean(notes.trim()),
      });
      if (decision.status === 'ROUTED') {
        await execute(decision.taskIds, text);
        return;
      }
      if (decision.status === 'CLARIFICATION_REQUIRED') {
        setChoices(decision.clarificationOptions);
        setMessage(
          decision.clarificationReason === 'MISSING_REQUIRED_CONTEXT'
            ? 'Add the required context, then choose the Clinora operation.'
            : 'What would you like Clinora to do?',
        );
      } else {
        setMessage(
          'Clinora supports focused work on authorized evidence. Diagnosis, treatment, dosage, and unrelated requests are outside this support tool.',
        );
      }
    } catch (error) {
      setMessage(doctorError(error, 'Clinora routing is temporarily unavailable.'));
    } finally {
      setBusy(false);
    }
  };

  const evidenceReady = appointmentMode || selectedObservationIds.length > 0;

  return (
    <>
      <section
        className="rounded-[var(--radius-app-card)] border border-cyan-400/20 bg-[linear-gradient(145deg,rgba(7,25,38,.94),rgba(16,15,42,.94))] p-4 shadow-[0_20px_60px_rgba(14,165,233,.08)]"
        aria-label="Clinora Clinical Support actions"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl border border-cyan-300/25 bg-cyan-400/10 text-cyan-200">
              <Sparkles size={17} aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-white">Clinora Clinical Support</h2>
              <p className="text-xs text-slate-400">Contextual support from authorized evidence</p>
            </div>
          </div>
          <Button
            variant="appPrimary"
            size="sm"
            onClick={() => {
              setOpen(true);
              if (appointmentMode) void route('BRIEF_PATIENT');
            }}
          >
            {appointmentMode ? 'Brief me' : 'Open Clinora'}
          </Button>
        </div>
        {!appointmentMode ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Action
              label="Connect findings"
              disabled={selectedObservationIds.length < 2}
              onClick={() => void route('CONNECT_EVIDENCE')}
            />
            <Action
              label="Compare"
              disabled={!comparableReportsAvailable}
              onClick={() => void route('COMPARE_EVIDENCE')}
            />
            <Action label="Find gaps" disabled={!evidenceReady} onClick={() => void route('FIND_GAPS')} />
            <Action
              label="Explore explanations"
              disabled={selectedObservationIds.length < 2}
              onClick={() => void route('EXPLORE_EXPLANATIONS')}
            />
          </div>
        ) : null}
      </section>

      {open ? (
        <div
          className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="clinora-support-title"
            className="ml-auto flex h-full w-full max-w-xl flex-col border-l border-cyan-300/20 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,.12),transparent_32%),#07111f] shadow-2xl motion-safe:animate-in motion-safe:slide-in-from-right motion-reduce:animate-none"
          >
            <header className="flex items-start justify-between border-b border-white/10 px-5 py-4 sm:px-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[.18em] text-cyan-300">Doctor workspace</p>
                <h2 id="clinora-support-title" className="mt-1 text-xl font-semibold text-white">
                  Clinora Clinical Support
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  Support only. Nothing here is written to the medical record.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Close Clinora Clinical Support"
                onClick={() => setOpen(false)}
              >
                <X size={18} />
              </Button>
            </header>
            <div className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
              {!appointmentMode ? (
                <p className="text-xs text-cyan-100">
                  {selectedObservationIds.length} verified finding{selectedObservationIds.length === 1 ? '' : 's'}{' '}
                  selected
                </p>
              ) : null}
              <label className="block text-sm font-medium text-white">
                Ask Clinora about this context
                <textarea
                  value={question}
                  maxLength={4000}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="For example: Compare this CBC and tell me what information is missing."
                  className="mt-2 min-h-24 w-full rounded-xl border border-white/10 bg-slate-950/55 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-400/10"
                />
              </label>
              <Button variant="appPrimary" disabled={busy || !question.trim()} onClick={() => void route()}>
                {busy ? (
                  <>
                    <LoaderCircle className="animate-spin" size={15} /> Working safely…
                  </>
                ) : (
                  'Route request'
                )}
              </Button>

              <details className="rounded-xl border border-white/10 bg-white/[.03] p-4">
                <summary className="cursor-pointer text-sm font-semibold text-white">
                  Cross-check a working assessment
                </summary>
                <label className="mt-3 block text-xs text-slate-300">
                  My working assessment…
                  <textarea
                    value={assessment}
                    maxLength={4000}
                    onChange={(event) => setAssessment(event.target.value)}
                    className="mt-2 min-h-20 w-full rounded-xl border border-white/10 bg-slate-950/55 p-3 text-sm text-white"
                  />
                </label>
                <p className="mt-2 text-xs text-slate-500">
                  Used only for this support request; not saved as a diagnosis.
                </p>
                <Button
                  className="mt-3"
                  variant="appSecondary"
                  size="sm"
                  disabled={busy || !assessment.trim() || !evidenceReady}
                  onClick={() => void route('CROSS_CHECK_ASSESSMENT')}
                >
                  Cross-check with Clinora
                </Button>
              </details>

              <details className="rounded-xl border border-white/10 bg-white/[.03] p-4">
                <summary className="cursor-pointer text-sm font-semibold text-white">Structure temporary notes</summary>
                <label className="mt-3 block text-xs text-slate-300">
                  Doctor-authored notes
                  <textarea
                    value={notes}
                    maxLength={8000}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="? iron deficiency, low MCV, tired 2 weeks, consider ferritin"
                    className="mt-2 min-h-24 w-full rounded-xl border border-white/10 bg-slate-950/55 p-3 text-sm text-white"
                  />
                </label>
                <p className="mt-2 text-xs text-slate-500">
                  Clinora organizes your words only. Notes are not persisted automatically.
                </p>
                <Button
                  className="mt-3"
                  variant="appSecondary"
                  size="sm"
                  disabled={busy || !notes.trim()}
                  onClick={() => void route('STRUCTURE_NOTES')}
                >
                  Structure notes
                </Button>
              </details>

              {message ? (
                <div
                  role={message.includes('temporarily') || message.includes('could not') ? 'alert' : 'status'}
                  className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm text-amber-100"
                >
                  {message}
                </div>
              ) : null}
              {choices.length ? (
                <div aria-label="Clarification options" className="grid gap-2">
                  {choices.map((choice) => (
                    <button
                      key={choice.taskId}
                      type="button"
                      onClick={() => void execute([choice.taskId], question.trim() || choice.label)}
                      className="rounded-xl border border-cyan-300/20 bg-cyan-300/5 p-3 text-left hover:bg-cyan-300/10"
                    >
                      <span className="block text-sm font-semibold text-cyan-100">{choice.label}</span>
                      <span className="mt-1 block text-xs text-slate-400">{choice.shortDescription}</span>
                    </button>
                  ))}
                </div>
              ) : null}

              {stale ? (
                <div
                  role="status"
                  className="flex items-center justify-between gap-3 rounded-xl border border-amber-300/20 bg-amber-300/5 p-3 text-xs text-amber-100"
                >
                  <span>Evidence or working text changed after this result. Run again for a fresh result.</span>
                  <Button size="sm" variant="appSecondary" onClick={() => void route()}>
                    Run again
                  </Button>
                </div>
              ) : null}
              {response ? <ExecutionResults response={response} /> : null}
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}

function Action({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <Button variant="appSecondary" size="sm" disabled={disabled} onClick={onClick}>
      {label}
    </Button>
  );
}

function ExecutionResults({ response }: { response: DoctorSupportExecutionResponse }) {
  return (
    <section aria-live="polite" className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-white">
        {response.status === 'SUCCEEDED' ? (
          <CheckCircle2 size={16} className="text-emerald-300" />
        ) : (
          <AlertTriangle size={16} className="text-amber-300" />
        )}{' '}
        {response.status === 'PARTIAL_SUCCESS'
          ? 'Completed with limitations'
          : response.status === 'SUCCEEDED'
            ? 'Clinora result'
            : 'Unable to complete safely'}
      </div>
      {response.taskResults.map((item) => (
        <article key={item.taskId} className="rounded-2xl border border-white/10 bg-white/[.035] p-4">
          <h3 className="text-sm font-semibold text-cyan-100">{taskLabels[item.taskId]}</h3>
          {item.status === 'SUCCEEDED' && item.result ? (
            <ClinicalResult result={item.result} evidence={response.evidence} />
          ) : (
            <p className="mt-3 text-sm text-amber-100">Clinora stopped safely: {safeFailure(item.safeFailureCode)}</p>
          )}
          {item.references.length ? (
            <div className="mt-4 border-t border-white/10 pt-4">
              <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-violet-200">
                <BookOpen size={14} /> General clinical references
              </h4>
              <ul className="mt-2 space-y-2">
                {item.references.map((reference) => (
                  <li key={reference.chunkId} className="rounded-lg bg-violet-300/5 p-2.5 text-xs text-slate-300">
                    <strong className="text-white">{reference.title}</strong>
                    <span className="mt-0.5 block">
                      {reference.publisher} · {reference.sectionPath}
                      {reference.version ? ` · ${reference.version}` : ''}
                      {reference.publicationDate ? ` · ${reference.publicationDate}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </article>
      ))}
    </section>
  );
}

function ClinicalResult({
  result,
  evidence,
}: {
  result: DoctorSupportClinicalResult;
  evidence: DoctorSupportExecutionResponse['evidence'];
}) {
  const byId = new Map(evidence.map((item) => [item.observationId, item]));
  const refs = (items: Array<{ observationId: string }>) => (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {items.map((ref) => {
        const item = byId.get(ref.observationId);
        return item ? (
          <span
            key={ref.observationId}
            className="rounded-full border border-cyan-300/15 bg-cyan-300/5 px-2 py-1 text-[11px] text-cyan-100"
          >
            {item.label}: {[item.comparator, item.numericValue ?? item.textValue, item.unit].filter(Boolean).join(' ')}
          </span>
        ) : null;
      })}
    </div>
  );
  if (result.taskId === 'STRUCTURE_NOTES')
    return (
      <div className="mt-3 space-y-3">
        {result.sections.map((section) => (
          <section key={section.section}>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-violet-200">
              {section.section.replaceAll('_', ' ')}
            </h4>
            <ul className="mt-1 list-disc pl-5 text-sm text-slate-200">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    );
  if (result.taskId === 'EXPLORE_EXPLANATIONS')
    return (
      <div className="mt-3 space-y-3">
        <p className="text-sm text-slate-200">{result.summary}</p>
        {result.explanations.map((item) => (
          <section key={item.name} className="rounded-xl border border-white/10 p-3">
            <h4 className="font-semibold text-white">Possible explanation: {item.name}</h4>
            <p className="mt-1 text-sm text-slate-300">{item.whyItMayFit}</p>
            {refs(item.supportingEvidence)}
            {item.limitingEvidence.length ? (
              <>
                <p className="mt-3 text-xs font-semibold text-amber-200">What does not fully match</p>
                {refs(item.limitingEvidence)}
              </>
            ) : null}
            {item.missingInformation.length ? (
              <p className="mt-3 text-xs text-slate-400">Missing information: {item.missingInformation.join('; ')}</p>
            ) : null}
          </section>
        ))}
      </div>
    );
  const summary =
    'summary' in result ? result.summary : result.taskId === 'FOCUSED_EVIDENCE_QUESTION' ? result.answer : '';
  const supporting =
    result.taskId === 'FOCUSED_EVIDENCE_QUESTION'
      ? result.supportingEvidence
      : result.taskId === 'BRIEF_PATIENT'
        ? result.evidenceHighlights
        : [];
  return (
    <div className="mt-3">
      <p className="text-sm leading-6 text-slate-200">{summary}</p>
      {refs(supporting)}
      {'openQuestions' in result && result.openQuestions.length ? (
        <p className="mt-3 text-xs text-slate-400">Open questions: {result.openQuestions.join('; ')}</p>
      ) : null}
      {result.limitations.length ? (
        <p className="mt-3 text-xs text-slate-500">Limitations: {result.limitations.join('; ')}</p>
      ) : null}
    </div>
  );
}

function safeFailure(code: string | null) {
  const known: Record<string, string> = {
    CLINICAL_REFERENCE_REQUIRED: 'an approved clinical reference was unavailable',
    UNSUPPORTED_CLINICAL_REQUEST: 'the request is outside focused evidence support',
    PROMPT_INJECTION_REJECTED: 'unsafe instructions were rejected',
    INVALID_CONTRACT_AFTER_REPAIR: 'the model response could not be validated',
    EVIDENCE_SELECTION_REQUIRED: 'choose comparable authorized evidence',
  };
  return (code && known[code]) || 'the response did not pass Clinora safety validation';
}
