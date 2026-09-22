import { AlertTriangle, BookOpen, CheckCircle2, LoaderCircle, Sparkles, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button } from '../../components/ui/button';
import { doctorError } from './doctor-api';
import {
  doctorClinicalSupportApi,
  type BriefPatientResult,
  type DoctorSupportClinicalResult,
  type DoctorSupportExecutionResponse,
  type DoctorSupportScreen,
  type DoctorSupportTaskId,
} from './doctor-clinical-support-api';

const taskLabels: Record<DoctorSupportTaskId, string> = {
  BRIEF_PATIENT: 'Patient Clinical Brief',
  CONNECT_EVIDENCE: 'Clinical relationships',
  COMPARE_EVIDENCE: 'Compare reports',
  CROSS_CHECK_ASSESSMENT: 'Check a clinical hypothesis',
  FIND_GAPS: 'Missing information',
  EXPLORE_EXPLANATIONS: 'Explore clinical patterns',
  STRUCTURE_NOTES: 'Organize draft notes',
  FOCUSED_EVIDENCE_QUESTION: 'Evidence answer',
};

export interface ClinoraClinicalSupportPanelProps {
  appointmentId: string;
  screen: DoctorSupportScreen;
  currentReportId?: string;
  selectedObservationIds?: string[];
  comparableReportsAvailable?: boolean;
  appointmentMode?: boolean;
}

type ActiveRequest = 'ROUTING_QUESTION' | DoctorSupportTaskId;

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
  const [hypothesisOpen, setHypothesisOpen] = useState(false);
  const [activeRequest, setActiveRequest] = useState<ActiveRequest | null>(null);
  const activeRequestRef = useRef<ActiveRequest | null>(null);
  const briefRequestKeyRef = useRef('');
  const briefGenerationRef = useRef(0);
  const [processingStage, setProcessingStage] = useState('');
  const [message, setMessage] = useState('');
  const [briefMessage, setBriefMessage] = useState('');
  const [choices, setChoices] = useState<
    Array<{ taskId: DoctorSupportTaskId; label: string; shortDescription: string }>
  >([]);
  const [briefResponse, setBriefResponse] = useState<DoctorSupportExecutionResponse | null>(null);
  const [response, setResponse] = useState<DoctorSupportExecutionResponse | null>(null);
  const [resultSignature, setResultSignature] = useState('');

  const evidenceScopeKey = useMemo(
    () => JSON.stringify([appointmentId, currentReportId || '', [...selectedObservationIds].sort()]),
    [appointmentId, currentReportId, selectedObservationIds],
  );
  const signature = useMemo(
    () => JSON.stringify([evidenceScopeKey, assessment.trim(), notes.trim()]),
    [assessment, evidenceScopeKey, notes],
  );
  const stale = Boolean(response && resultSignature !== signature);
  const evidenceReady = appointmentMode || Boolean(currentReportId) || selectedObservationIds.length > 0;
  const compareReady = appointmentMode || comparableReportsAvailable;
  const requestInFlight = activeRequest !== null;

  const closePanel = () => {
    briefGenerationRef.current += 1;
    briefRequestKeyRef.current = '';
    setBriefResponse(null);
    setBriefMessage('');
    setOpen(false);
  };

  useEffect(() => {
    if (!open || briefRequestKeyRef.current === evidenceScopeKey || activeRequestRef.current !== null) return;
    briefRequestKeyRef.current = evidenceScopeKey;
    const generation = ++briefGenerationRef.current;
    activeRequestRef.current = 'BRIEF_PATIENT';
    setActiveRequest('BRIEF_PATIENT');
    setBriefMessage('');
    setProcessingStage('Checking authorized evidence…');
    void doctorClinicalSupportApi
      .execute(appointmentId, {
        taskIds: ['BRIEF_PATIENT'],
        originalQuestion: 'Prepare the Patient Clinical Brief.',
        currentReportId: currentReportId || null,
        selectedObservationIds,
        doctorAssessment: null,
        doctorNotes: null,
        clientExecutionKey: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      })
      .then((execution) => {
        if (briefGenerationRef.current === generation) setBriefResponse(execution);
      })
      .catch((error) => {
        if (briefGenerationRef.current === generation) {
          setBriefMessage(doctorError(error, 'The Patient Clinical Brief is temporarily unavailable.'));
        }
      })
      .finally(() => {
        if (briefGenerationRef.current === generation) {
          activeRequestRef.current = null;
          setActiveRequest(null);
          setProcessingStage('');
        }
      });
  }, [activeRequest, appointmentId, currentReportId, evidenceScopeKey, open, selectedObservationIds]);

  const beginRequest = (request: ActiveRequest) => {
    if (activeRequestRef.current !== null) return false;
    activeRequestRef.current = request;
    setActiveRequest(request);
    setMessage('');
    setChoices([]);
    setResponse(null);
    setResultSignature('');
    return true;
  };

  const finishRequest = () => {
    activeRequestRef.current = null;
    setActiveRequest(null);
    setProcessingStage('');
  };

  const performExecution = async (
    taskIds: DoctorSupportTaskId[],
    originalQuestion: string,
    assessmentOverride?: string,
  ) => {
    setProcessingStage(
      taskIds.every((task) => task === 'COMPARE_EVIDENCE' || task === 'FOCUSED_EVIDENCE_QUESTION')
        ? 'Preparing result from authorized evidence…'
        : 'Reviewing existing clinical reasoning and validating evidence…',
    );
    try {
      const execution = await doctorClinicalSupportApi.execute(appointmentId, {
        taskIds,
        originalQuestion,
        currentReportId: currentReportId || null,
        selectedObservationIds,
        doctorAssessment: assessmentOverride?.trim() || assessment.trim() || null,
        doctorNotes: notes.trim() || null,
        clientExecutionKey: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      });
      setResponse(execution);
      setResultSignature(signature);
    } catch (error) {
      setMessage(doctorError(error, 'Clinora could not safely complete this request. Please try again.'));
    }
  };

  const execute = async (
    taskIds: DoctorSupportTaskId[],
    originalQuestion: string,
    assessmentOverride?: string,
  ) => {
    if (!beginRequest(taskIds[0] || 'ROUTING_QUESTION')) return;
    setOpen(true);
    try {
      await performExecution(taskIds, originalQuestion, assessmentOverride);
    } finally {
      finishRequest();
    }
  };

  const routeQuestion = async () => {
    const text = question.trim();
    if (!text || !beginRequest('ROUTING_QUESTION')) return;
    setProcessingStage('Checking authorized evidence and understanding the request…');
    try {
      const decision = await doctorClinicalSupportApi.route(appointmentId, {
        message: text,
        explicitTaskId: null,
        currentScreen: screen,
        currentReportId: currentReportId || null,
        selectedObservationIds,
        doctorAssessmentPresent: Boolean(assessment.trim()),
        doctorNotesPresent: Boolean(notes.trim()),
      });
      if (decision.status === 'ROUTED') {
        const inlineHypothesis = decision.taskIds.includes('CROSS_CHECK_ASSESSMENT') && !assessment.trim();
        await performExecution(decision.taskIds, text, inlineHypothesis ? text : undefined);
        return;
      }
      setProcessingStage('');
      if (decision.status === 'CLARIFICATION_REQUIRED') {
        setChoices(decision.clarificationOptions);
        setMessage(
          decision.clarificationReason === 'MISSING_REQUIRED_CONTEXT'
            ? 'Add the required context, then choose how Clinora should help.'
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
      finishRequest();
    }
  };

  const openHypothesis = (clear = false) => {
    if (clear) setAssessment('');
    setHypothesisOpen(true);
    setOpen(true);
  };

  const runKnownAction = (task: DoctorSupportTaskId, label: string) => {
    if (task === 'CROSS_CHECK_ASSESSMENT' && !assessment.trim()) {
      openHypothesis();
      return;
    }
    void execute([task], label);
  };

  const quickActions = (
    <div className="grid gap-2 sm:grid-cols-2" aria-label="Clinical Support quick actions">
      <Action label="Explore clinical patterns" disabled={!evidenceReady || requestInFlight} onClick={() => runKnownAction('EXPLORE_EXPLANATIONS', 'Explore clinical patterns')} />
      <Action label="Check a clinical hypothesis" disabled={!evidenceReady || requestInFlight} onClick={() => openHypothesis()} />
      <Action label="Compare reports" disabled={!compareReady || requestInFlight} onClick={() => runKnownAction('COMPARE_EVIDENCE', 'Compare the available reports')} />
      <Action label="What information is missing?" disabled={!evidenceReady || requestInFlight} onClick={() => runKnownAction('FIND_GAPS', 'What important information is missing?')} />
    </div>
  );

  return (
    <>
      <section className="rounded-[var(--radius-app-card)] border border-cyan-400/20 bg-[linear-gradient(145deg,rgba(7,25,38,.94),rgba(16,15,42,.94))] p-4 shadow-[0_20px_60px_rgba(14,165,233,.08)]" aria-label="Clinora Clinical Support actions">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl border border-cyan-300/25 bg-cyan-400/10 text-cyan-200"><Sparkles size={17} aria-hidden="true" /></span>
            <div><h2 className="text-sm font-semibold text-white">Clinora Clinical Support</h2><p className="text-xs text-slate-400">One assistant grounded in currently authorized evidence</p></div>
          </div>
          <Button variant="appPrimary" size="sm" onClick={() => setOpen(true)}>Open Clinora</Button>
        </div>
        <div className="mt-4">{quickActions}</div>
      </section>

      {open ? (
        <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closePanel(); }}>
          <aside role="dialog" aria-modal="true" aria-labelledby="clinora-support-title" className="ml-auto flex h-full w-full max-w-2xl flex-col border-l border-cyan-300/20 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,.12),transparent_32%),#07111f] shadow-2xl motion-safe:animate-in motion-safe:slide-in-from-right motion-reduce:animate-none">
            <header className="flex items-start justify-between border-b border-white/10 px-5 py-4 sm:px-6">
              <div><p className="text-xs font-semibold uppercase tracking-[.18em] text-cyan-300">Doctor workspace</p><h2 id="clinora-support-title" className="mt-1 text-xl font-semibold text-white">Clinora Clinical Support</h2><p className="mt-1 text-xs text-slate-400">Support only. Nothing here is written to the medical record.</p></div>
              <Button variant="ghost" size="sm" aria-label="Close Clinora Clinical Support" onClick={closePanel}><X size={18} /></Button>
            </header>

            <div className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
              <PatientClinicalBrief response={briefResponse} loading={activeRequest === 'BRIEF_PATIENT'} message={briefMessage} />

              <section className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[.035] p-4">
                <label className="block text-sm font-semibold text-white">Ask Clinora
                  <textarea value={question} maxLength={4000} onChange={(event) => setQuestion(event.target.value)} placeholder="What clinical pattern do these findings suggest?" className="mt-2 min-h-24 w-full rounded-xl border border-white/10 bg-slate-950/55 px-3 py-2.5 text-sm font-normal text-white outline-none focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-400/10" />
                </label>
                <Button className="mt-3" variant="appPrimary" disabled={requestInFlight || !question.trim()} onClick={() => void routeQuestion()}>Ask Clinora</Button>
              </section>

              <section><h3 className="mb-2 text-xs font-semibold uppercase tracking-[.14em] text-slate-400">Quick actions</h3>{quickActions}</section>

              {hypothesisOpen ? (
                <section className="rounded-xl border border-violet-300/20 bg-violet-300/[.04] p-4">
                  <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold text-white">Check a clinical hypothesis</h3><Button variant="ghost" size="sm" onClick={() => setHypothesisOpen(false)}>Close</Button></div>
                  <label className="mt-3 block text-xs text-slate-300">Clinical hypothesis
                    <textarea value={assessment} maxLength={4000} onChange={(event) => setAssessment(event.target.value)} placeholder="Possible beta-thalassemia trait" className="mt-2 min-h-20 w-full rounded-xl border border-white/10 bg-slate-950/55 p-3 text-sm text-white" />
                  </label>
                  <p className="mt-2 text-xs text-slate-500">Used only for this support request; not saved as a diagnosis.</p>
                  <Button className="mt-3" variant="appSecondary" size="sm" disabled={requestInFlight || !assessment.trim() || !evidenceReady} onClick={() => void execute(['CROSS_CHECK_ASSESSMENT'], assessment.trim())}>Check hypothesis</Button>
                </section>
              ) : null}

              <details className="rounded-xl border border-white/10 bg-white/[.025] p-4">
                <summary className="cursor-pointer text-sm font-semibold text-slate-200">Consultation tools / Organize draft notes</summary>
                <label className="mt-3 block text-xs text-slate-300">Doctor-authored notes<textarea value={notes} maxLength={8000} onChange={(event) => setNotes(event.target.value)} className="mt-2 min-h-24 w-full rounded-xl border border-white/10 bg-slate-950/55 p-3 text-sm text-white" /></label>
                <p className="mt-2 text-xs text-slate-500">Clinora organizes your words only. Notes are not persisted automatically.</p>
                <Button className="mt-3" variant="appSecondary" size="sm" disabled={requestInFlight || !notes.trim()} onClick={() => void execute(['STRUCTURE_NOTES'], 'Organize these draft consultation notes')}>Organize draft notes</Button>
              </details>

              {processingStage ? <div role="status" className="flex items-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/5 p-3 text-sm text-cyan-100"><LoaderCircle className="animate-spin" size={15} /> {processingStage}</div> : null}
              {message ? <div role={message.includes('temporarily') || message.includes('could not') ? 'alert' : 'status'} className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm text-amber-100">{message}</div> : null}
              {choices.length ? <div aria-label="Clarification options" className="grid gap-2">{choices.map((choice) => <button key={choice.taskId} type="button" disabled={requestInFlight} onClick={() => { if (choice.taskId === 'CROSS_CHECK_ASSESSMENT' && !assessment.trim()) openHypothesis(); else void execute([choice.taskId], question.trim() || choice.label); }} className="rounded-xl border border-cyan-300/20 bg-cyan-300/5 p-3 text-left hover:bg-cyan-300/10"><span className="block text-sm font-semibold text-cyan-100">{taskLabels[choice.taskId]}</span><span className="mt-1 block text-xs text-slate-400">{choice.shortDescription}</span></button>)}</div> : null}
              {stale ? <div role="status" className="flex items-center justify-between gap-3 rounded-xl border border-amber-300/20 bg-amber-300/5 p-3 text-xs text-amber-100"><span>Evidence or working text changed after this result. Run again for a fresh result.</span><Button size="sm" variant="appSecondary" disabled={requestInFlight || !question.trim()} onClick={() => void routeQuestion()}>Run again</Button></div> : null}
              {response ? <ExecutionResults response={response} /> : null}
              {response?.taskResults.some((item) => item.status === 'SUCCEEDED') ? <FollowUpActions assessmentPresent={Boolean(assessment.trim())} compareReady={compareReady} disabled={requestInFlight} onExecute={(task, prompt) => runKnownAction(task, prompt)} onHypothesis={() => openHypothesis(true)} /> : null}
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}

function Action({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return <Button variant="appSecondary" size="sm" disabled={disabled} onClick={onClick}>{label}</Button>;
}

function PatientClinicalBrief({ response, loading, message }: { response: DoctorSupportExecutionResponse | null; loading: boolean; message: string }) {
  const task = response?.taskResults.find((item) => item.taskId === 'BRIEF_PATIENT');
  const result = task?.status === 'SUCCEEDED' ? (task.result as BriefPatientResult | null) : null;
  return <section aria-labelledby="patient-clinical-brief" className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[.035] p-4">
    <div className="flex items-center justify-between gap-3"><h3 id="patient-clinical-brief" className="text-sm font-semibold text-emerald-100">Patient Clinical Brief</h3>{loading ? <LoaderCircle className="animate-spin text-emerald-200" size={15} aria-label="Loading Patient Clinical Brief" /> : null}</div>
    {message ? <p className="mt-2 text-xs text-amber-100">{message}</p> : null}
    {task && task.status !== 'SUCCEEDED' ? <p className="mt-2 text-xs text-amber-100">Clinora stopped safely: {safeFailure(task.safeFailureCode)}</p> : null}
    {result && response ? <div className="mt-3 space-y-3">
      <p className="text-sm leading-6 text-slate-200">{result.summary}</p>
      <p className="text-xs text-emerald-100">{result.evidenceCount ?? response.evidence.length} verified observations · {result.reportCount ?? response.reports.length} currently shared reports · {result.abnormalCount ?? result.evidenceHighlights.length} important abnormalities</p>
      {result.evidenceHighlights.length ? <ResultSection title="Important abnormal findings"><EvidenceChips references={result.evidenceHighlights} evidence={response.evidence} /></ResultSection> : null}
      {result.chronology.length ? <ResultSection title="Meaningful changes over time"><div className="space-y-2">{result.chronology.map((item) => <div key={item.statement}><p className="text-sm text-slate-300">{item.statement}</p><EvidenceChips references={item.evidence} evidence={response.evidence} /></div>)}</div></ResultSection> : null}
      {result.clinicalPatterns?.length ? <ResultSection title="Existing report-level clinical patterns"><div className="space-y-2">{result.clinicalPatterns.map((pattern) => <div key={pattern.title} className="rounded-lg border border-white/10 p-2.5"><p className="text-sm font-medium text-white">{pattern.title}</p><EvidenceChips references={pattern.supportingEvidence} evidence={response.evidence} />{pattern.limitingEvidence.length ? <><p className="mt-2 text-xs text-amber-200">Limiting evidence</p><EvidenceChips references={pattern.limitingEvidence} evidence={response.evidence} /></> : null}</div>)}</div></ResultSection> : null}
      {result.openQuestions.length ? <ResultSection title="Missing evidence or context"><TextList items={result.openQuestions} /></ResultSection> : null}
      <Limitations items={result.limitations} />
    </div> : !loading && !message && !task ? <p className="mt-2 text-xs text-slate-400">The brief will appear here from currently authorized evidence.</p> : null}
  </section>;
}

function ExecutionResults({ response }: { response: DoctorSupportExecutionResponse }) {
  const heading = executionHeading(response);
  return <section aria-live="polite" className="space-y-4">
    <div className="flex items-center gap-2 text-sm font-semibold text-white">{response.status === 'SUCCEEDED' ? <CheckCircle2 size={16} className="text-emerald-300" /> : <AlertTriangle size={16} className="text-amber-300" />}{heading}</div>
    <p className="text-xs text-slate-400">Based on {response.evidence.length} verified observations from {response.reports.length} currently shared reports.</p>
    {response.taskResults.map((item) => <article key={item.taskId} className="rounded-2xl border border-white/10 bg-white/[.035] p-4">
      <h3 className="text-sm font-semibold text-cyan-100">{taskLabels[item.taskId]}</h3>
      {(item.status === 'SUCCEEDED' || item.status === 'DEGRADED') && item.result
        ? <>{item.status === 'DEGRADED' ? <DegradedNotice code={item.safeFailureCode} /> : null}<ClinicalResult result={item.result} evidence={response.evidence} /></>
        : <TaskFailure item={item} />}
      {item.references.length ? <div className="mt-4 border-t border-white/10 pt-4"><h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-violet-200"><BookOpen size={14} /> General clinical references</h4><ul className="mt-2 space-y-2">{item.references.map((reference) => <li key={reference.chunkId} className="rounded-lg bg-violet-300/5 p-2.5 text-xs text-slate-300"><strong className="text-white">{reference.title}</strong><span className="mt-0.5 block">{reference.publisher} · {reference.sectionPath}{reference.version ? ` · ${reference.version}` : ''}{reference.publicationDate ? ` · ${reference.publicationDate}` : ''}</span></li>)}</ul></div> : null}
    </article>)}
  </section>;
}

function DegradedNotice({ code }: { code: string | null }) {
  return <section aria-label="Degraded clinical reasoning mode" className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/[.06] p-3">
    <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-100">Showing existing report analysis</h4>
    <p role="status" className="mt-1 text-sm text-amber-50">{code === 'GEMINI_RATE_LIMITED' || code === 'MODEL_BUSY' ? 'Clinical reasoning is temporarily busy. Please try again shortly.' : 'Live clinical reasoning is temporarily unavailable.'}</p>
    <p className="mt-1 text-xs text-slate-300">Patient facts are verified DB evidence. Clinical patterns and gaps are advisory content from already READY report analysis; no new MedGemma analysis was requested.</p>
  </section>;
}

function TaskFailure({ item }: { item: DoctorSupportExecutionResponse['taskResults'][number] }) {
  const providerFailure = ['GEMINI_RATE_LIMITED', 'GEMINI_TIMEOUT', 'GEMINI_UNAVAILABLE', 'MODEL_BUSY', 'MODEL_TIMEOUT', 'MODEL_UNAVAILABLE'].includes(item.safeFailureCode ?? '');
  const preparation = ['CLINICAL_REASONING_PREPARING', 'CLINICAL_REASONING_STALE', 'CLINICAL_REASONING_UNAVAILABLE'].includes(item.safeFailureCode ?? '');
  const selection = ['EVIDENCE_SELECTION_REQUIRED', 'COMPARABLE_REPORTS_REQUIRED', 'RELIABLE_COMPARABLE_EVIDENCE_REQUIRED'].includes(item.safeFailureCode ?? '');
  if (providerFailure || preparation || selection) {
    return <p role="status" className="mt-3 text-sm text-amber-100">{safeFailure(item.safeFailureCode)}</p>;
  }
  return <p role="alert" className="mt-3 text-sm text-amber-100">Clinora stopped safely: {safeFailure(item.safeFailureCode)}</p>;
}

function executionHeading(response: DoctorSupportExecutionResponse) {
  if (response.status === 'SUCCEEDED') return 'Clinora result';
  if (response.status === 'DEGRADED' || response.taskResults.some((item) => ['GEMINI_RATE_LIMITED', 'GEMINI_TIMEOUT', 'GEMINI_UNAVAILABLE', 'MODEL_BUSY', 'MODEL_TIMEOUT', 'MODEL_UNAVAILABLE'].includes(item.safeFailureCode ?? ''))) return 'Live clinical reasoning temporarily unavailable';
  if (response.taskResults.some((item) => ['CLINICAL_REASONING_PREPARING', 'CLINICAL_REASONING_STALE'].includes(item.safeFailureCode ?? ''))) return 'Existing report analysis is preparing';
  if (response.taskResults.some((item) => ['EVIDENCE_SELECTION_REQUIRED', 'COMPARABLE_REPORTS_REQUIRED', 'RELIABLE_COMPARABLE_EVIDENCE_REQUIRED'].includes(item.safeFailureCode ?? ''))) return 'More comparable report evidence is needed';
  return response.status === 'PARTIAL_SUCCESS' ? 'Completed with limitations' : 'Unable to complete safely';
}

function ClinicalResult({ result, evidence }: { result: DoctorSupportClinicalResult; evidence: DoctorSupportExecutionResponse['evidence'] }) {
  const chips = (items: Array<{ observationId: string }>) => <EvidenceChips references={items} evidence={evidence} />;
  if (result.taskId === 'STRUCTURE_NOTES') return <div className="mt-3 space-y-3">{result.sections.map((section) => <ResultSection key={section.section} title={section.section.replaceAll('_', ' ')}><TextList items={section.items} /></ResultSection>)}</div>;
  if (result.taskId === 'FOCUSED_EVIDENCE_QUESTION') return <div className="mt-3 space-y-3"><ResultSection title="Direct answer"><p className="text-sm leading-6 text-slate-200">{result.answer}</p></ResultSection><ResultSection title="Exact supporting evidence">{chips(result.supportingEvidence)}</ResultSection><Limitations items={result.limitations} /></div>;
  if (result.taskId === 'BRIEF_PATIENT') return <div className="mt-3"><p className="text-sm text-slate-200">{result.summary}</p>{chips(result.evidenceHighlights)}{result.openQuestions.length ? <ResultSection title="Missing evidence or context"><TextList items={result.openQuestions} /></ResultSection> : null}<Limitations items={result.limitations} /></div>;
  if (result.taskId === 'COMPARE_EVIDENCE') return <div className="mt-3 space-y-3">
    <ResultSection title={result.comparisons.length ? 'Direct comparison' : 'No directly comparable repeated findings'}><p className="text-sm text-slate-200">{result.summary}</p></ResultSection>
    {result.comparisons.map((item) => <section key={`${item.canonicalCode}-${item.explanation}`} className="rounded-xl border border-white/10 p-3"><p className="text-xs font-semibold uppercase tracking-wider text-cyan-200">{item.direction.replaceAll('_', ' ')}</p><p className="mt-1 text-sm text-slate-300">{item.explanation}</p>{chips(item.evidence)}</section>)}
    {result.reportSummaries?.map((report) => <section key={report.reportId} className="rounded-xl border border-white/10 p-3"><h4 className="font-semibold text-white">{report.label}</h4><p className="mt-0.5 text-xs text-slate-400">{report.reportType.replaceAll('_', ' ')}{report.clinicalDate ? ` · ${report.clinicalDate}` : ' · date unavailable'}</p>{report.importantFindings.length ? <ResultSection title="Important verified findings">{chips(report.importantFindings)}</ResultSection> : null}{report.existingAnalysis.length ? <ResultSection title="Existing READY report analysis"><TextList items={report.existingAnalysis} /></ResultSection> : null}</section>)}
    {result.persistentFindings?.length ? <ResultSection title="Persistent findings"><div className="space-y-2">{result.persistentFindings.map((item) => <div key={item.canonicalCode}><p className="text-sm text-slate-300">{item.label}</p>{chips(item.evidence)}</div>)}</div></ResultSection> : null}
    {result.findingsOnlyInEarlierReport?.length ? <ResultSection title="Findings only in earlier report">{chips(result.findingsOnlyInEarlierReport)}</ResultSection> : null}
    {result.findingsOnlyInLaterReport?.length ? <ResultSection title="Findings only in later report">{chips(result.findingsOnlyInLaterReport)}</ResultSection> : null}
    {result.patternDifferences?.length ? <ResultSection title="Existing-analysis pattern differences"><TextList items={result.patternDifferences} /></ResultSection> : null}
    {result.nonComparable.length ? <ResultSection title="Not reliably comparable"><TextList items={result.nonComparable} /></ResultSection> : null}<Limitations items={result.limitations} />
  </div>;
  if (result.taskId === 'CONNECT_EVIDENCE') return <div className="mt-3 space-y-3"><p className="text-sm text-slate-200">{result.summary}</p>{result.patterns.map((pattern) => <section key={pattern.title} className="rounded-xl border border-white/10 p-3"><h4 className="font-semibold text-white">{pattern.title}</h4><p className="mt-1 text-sm text-slate-300">{pattern.relationship}</p>{chips(pattern.evidence)}<Limitations items={pattern.limitations} /></section>)}<Limitations items={result.limitations} /></div>;
  if (result.taskId === 'FIND_GAPS') return <div className="mt-3 space-y-3"><ResultSection title="Missing information"><p className="text-sm text-slate-200">{result.summary}</p></ResultSection>{result.gaps.map((gap) => <section key={gap.category} className="rounded-xl border border-white/10 p-3"><h4 className="font-semibold text-white">{gap.category}</h4><p className="mt-1 text-sm text-slate-300">{gap.whyRelevant}</p>{chips(gap.relatedEvidence)}</section>)}<Limitations items={result.limitations} /></div>;
  if (result.taskId === 'EXPLORE_EXPLANATIONS') return <div className="mt-3 space-y-3"><ResultSection title="Direct interpretation"><p className="text-sm text-slate-200">{result.summary}</p></ResultSection>{result.explanations.map((item) => <section key={`${item.clinicalCluster}-${item.name}`} className="rounded-xl border border-white/10 p-3"><p className="text-xs font-semibold uppercase tracking-wider text-violet-200">{item.clinicalCluster}</p><h4 className="mt-1 font-semibold text-white">{item.name}</h4><ResultSection title="Why this may fit"><p className="text-sm text-slate-300">{item.whyItMayFit}</p>{chips(item.supportingEvidence)}</ResultSection>{item.limitingEvidence.length ? <ResultSection title="What does not fit / limiting evidence">{chips(item.limitingEvidence)}</ResultSection> : null}{item.missingInformation.length ? <ResultSection title="Missing information"><TextList items={item.missingInformation} /></ResultSection> : null}</section>)}<Limitations items={result.limitations} /></div>;

  const fitLabels = { CONSISTENT_WITH_AVAILABLE_EVIDENCE: 'Consistent with available evidence', MIXED_OR_LIMITED_EVIDENCE: 'Mixed or limited evidence', NOT_SUPPORTED_BY_AVAILABLE_EVIDENCE: 'Not supported by available evidence', INSUFFICIENT_EVIDENCE: 'Insufficient evidence' } as const;
  const groups = [['SUPPORTS', 'Supports'], ['CONTRADICTS', 'Contradicts / does not support'], ['UNCERTAIN', 'Uncertain'], ['UNRELATED', 'Unrelated findings']] as const;
  return <div className="mt-3 space-y-3"><ResultSection title="Direct answer / interpretation"><p className="inline-flex rounded-full border border-violet-300/20 bg-violet-300/10 px-2.5 py-1 text-xs font-semibold text-violet-100">{fitLabels[result.evidenceFit]}</p><p className="mt-2 text-sm text-slate-200">{result.summary}</p></ResultSection>{groups.map(([relation, title]) => { const points = result.points.filter((point) => point.relation === relation); return points.length ? <ResultSection key={relation} title={title}><div className="space-y-2">{points.map((point) => <div key={point.statement}><p className="text-sm text-slate-300">{point.statement}</p>{chips(point.evidence)}</div>)}</div></ResultSection> : null; })}{result.missingInformation.length ? <ResultSection title="Missing information"><TextList items={result.missingInformation} /></ResultSection> : null}{result.alternativeConsiderations.length ? <ResultSection title="Alternative considerations"><div className="space-y-2">{result.alternativeConsiderations.map((item) => <div key={item.name} className="rounded-lg border border-white/10 p-2.5"><p className="text-sm font-medium text-white">{item.name}</p><p className="mt-1 text-sm text-slate-300">{item.rationale}</p>{chips(item.evidence)}{item.missingInformation.length ? <p className="mt-2 text-xs text-slate-400">Missing: {item.missingInformation.join('; ')}</p> : null}</div>)}</div></ResultSection> : null}<Limitations items={result.limitations} /></div>;
}

function EvidenceChips({ references, evidence }: { references: Array<{ observationId: string }>; evidence: DoctorSupportExecutionResponse['evidence'] }) {
  const byId = new Map(evidence.map((item) => [item.observationId, item]));
  return <div className="mt-2 flex flex-wrap gap-1.5">{references.map((reference) => { const item = byId.get(reference.observationId); if (!item) return null; const value = item.numericValue ?? item.textValue ?? 'Reported'; const comparator = item.comparator && item.comparator !== '=' ? item.comparator : ''; const range = item.referenceRangeRaw || (item.referenceLow !== null || item.referenceHigh !== null ? `${item.referenceLow ?? ''}–${item.referenceHigh ?? ''}` : ''); return <span key={reference.observationId} className="rounded-lg border border-cyan-300/15 bg-cyan-300/5 px-2 py-1 text-[11px] text-cyan-100"><strong>{item.label}</strong>: {[comparator, value, item.unit].filter((part) => part !== null && part !== '').join(' ')} · {item.authoritativeStatus.replaceAll('_', ' ')}{range ? ` · ref ${range}` : ''}</span>; })}</div>;
}

function ResultSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="mt-3"><h4 className="text-xs font-semibold uppercase tracking-wider text-violet-200">{title}</h4><div className="mt-1">{children}</div></section>;
}

function TextList({ items }: { items: string[] }) {
  return <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">{items.map((item) => <li key={item}>{item}</li>)}</ul>;
}

function Limitations({ items }: { items: string[] }) {
  return items.length ? <ResultSection title="Limitations"><TextList items={items} /></ResultSection> : null;
}

function FollowUpActions({ assessmentPresent, compareReady, disabled, onExecute, onHypothesis }: { assessmentPresent: boolean; compareReady: boolean; disabled: boolean; onExecute: (task: DoctorSupportTaskId, prompt: string) => void; onHypothesis: () => void }) {
  return <section className="rounded-xl border border-white/10 p-4"><h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Suggested follow-up</h3><div className="mt-3 flex flex-wrap gap-2">{assessmentPresent ? <Action label="What does not fit?" disabled={disabled} onClick={() => onExecute('CROSS_CHECK_ASSESSMENT', 'What does not fit this hypothesis?')} /> : null}<Action label="What information is missing?" disabled={disabled} onClick={() => onExecute('FIND_GAPS', 'What important information is missing?')} />{compareReady ? <Action label="Compare with the previous report" disabled={disabled} onClick={() => onExecute('COMPARE_EVIDENCE', 'Compare with the previous report')} /> : null}<Action label="Check another hypothesis" disabled={disabled} onClick={onHypothesis} /><Action label="Explain the evidence for this pattern" disabled={disabled} onClick={() => onExecute('EXPLORE_EXPLANATIONS', 'Explain the evidence for this pattern')} /></div></section>;
}

function safeFailure(code: string | null) {
  const known: Record<string, string> = {
    GEMINI_RATE_LIMITED: 'Clinical reasoning is temporarily busy. Please try again shortly.',
    GEMINI_TIMEOUT: 'live clinical reasoning timed out',
    GEMINI_UNAVAILABLE: 'live clinical reasoning is temporarily unavailable',
    CLINICAL_REASONING_PREPARING: 'Clinora is preparing the latest report analysis',
    CLINICAL_REASONING_STALE: 'Clinora is preparing a fresh analysis for changed report evidence',
    CLINICAL_REASONING_UNAVAILABLE: 'the latest report analysis is unavailable',
    MODEL_BUSY: 'Clinical reasoning is temporarily busy. Please try again shortly.',
    MODEL_TIMEOUT: 'clinical reasoning timed out',
    MODEL_UNAVAILABLE: 'clinical reasoning is temporarily unavailable',
    CLINICAL_REFERENCE_REQUIRED: 'an approved clinical reference was unavailable',
    CLINICAL_REFERENCE_RETRIEVAL_FAILED: 'approved clinical references could not be checked safely',
    UNSUPPORTED_CLINICAL_REQUEST: 'the request is outside focused evidence support',
    PROMPT_INJECTION_REJECTED: 'unsafe instructions were rejected',
    INVALID_CONTRACT_AFTER_REPAIR: 'the model response did not match the required clinical response structure',
    OUTPUT_TRUNCATED: 'the model response ended before its clinical response structure was complete',
    TASK_VERSION_MISMATCH: 'the clinical task contract is out of date; restart the services and try again',
    EVIDENCE_SELECTION_REQUIRED: 'choose comparable authorized evidence',
    COMPARABLE_REPORTS_REQUIRED: 'at least two currently authorized reports are needed for comparison',
    RELIABLE_COMPARABLE_EVIDENCE_REQUIRED: 'the selected reports do not contain reliably comparable dated findings',
    UNKNOWN_EVIDENCE_HANDLE: 'the response referenced evidence outside the currently authorized set',
    UNAUTHORIZED_EVIDENCE_HANDLE: 'the response referenced evidence outside the currently authorized set',
    UNREFERENCED_EVIDENCE_HANDLE: 'the response used evidence that was not attached to that clinical claim',
    EVIDENCE_HANDLE_MAPPING_MISMATCH: 'the response changed an authorized evidence identity',
    UNKNOWN_OBSERVATION_ID: 'the response referenced an observation outside the currently authorized set',
    OBSERVATION_LABEL_MISMATCH: 'the response changed an authorized observation identity',
    OBSERVATION_VALUE_CHANGED: 'the response changed an authoritative Patient value',
    OBSERVATION_UNIT_CHANGED: 'the response changed an authoritative Patient unit',
    OBSERVATION_STATUS_CHANGED: 'the response changed an authoritative finding status',
    NORMAL_AS_ABNORMAL: 'the response mischaracterized an in-range finding',
    DEFINITIVE_CERTAINTY: 'the response overstated clinical certainty',
    DEFINITIVE_DIAGNOSIS: 'the response presented a diagnosis as confirmed fact',
    HYPOTHESIS_AS_FACT: 'the response presented a clinical hypothesis as fact',
    RANKED_DIAGNOSIS: 'the response ranked diagnoses beyond the authorized support scope',
    DOCTOR_CORRECTNESS_VERDICT: 'the response made an unsupported verdict about the Doctor assessment',
    INVENTED_HISTORY: 'the response introduced unsupported Patient history',
    TREATMENT_OR_DOSE: 'the response crossed Clinora’s treatment or dosage safety boundary',
    IMPERATIVE_TEST_ORDER: 'the response crossed Clinora’s test-order safety boundary',
  };
  if (code && known[code]) return known[code];
  if (code && import.meta.env.DEV && /^[A-Z0-9_]{1,96}$/.test(code)) {
    return `validation stopped at ${code}`;
  }
  return 'the response did not pass Clinora safety validation';
}
