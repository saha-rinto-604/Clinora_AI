import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { route, execute } = vi.hoisted(() => ({ route: vi.fn(), execute: vi.fn() }));
vi.mock('./doctor-clinical-support-api', async (load) => ({
  ...(await load<typeof import('./doctor-clinical-support-api')>()),
  doctorClinicalSupportApi: { route, execute },
}));

import { ClinoraClinicalSupportPanel } from './clinora-clinical-support-panel';

const observation = {
  observationId: 'o1', reportId: 'r1', label: 'MCV', canonicalCode: 'MCV', valueType: 'NUMERIC',
  numericValue: 70, textValue: null, comparator: null, unit: 'fL', referenceLow: 80, referenceHigh: 100,
  referenceRangeRaw: '80-100', authoritativeStatus: 'LOW', verificationStatus: 'DOCTOR_VERIFIED',
};

function response(taskResult: Record<string, unknown>, evidence = [observation]) {
  return {
    executionId: 'e1', doctorId: 'd1', appointmentId: 'a1', status: 'SUCCEEDED', evidenceSnapshotHash: 'hash',
    reports: [{ reportId: 'r1', reportType: 'CBC', clinicalDate: '2026-09-01', dateReliability: 'REPORT_DATE', extractionResultId: 'x1', sourceChecksum: 'sum', reportVersion: 1 }],
    evidence, selectionCandidates: [], startedAt: '', completedAt: '',
    taskResults: [{ status: 'SUCCEEDED', safeFailureCode: null, references: [], provenance: {}, ...taskResult }],
  };
}

const briefResponse = response({
  taskId: 'BRIEF_PATIENT',
  result: {
    taskId: 'BRIEF_PATIENT', summary: 'One verified CBC is available.', reportCount: 1, evidenceCount: 1,
    abnormalCount: 1, appointmentReason: null, evidenceHighlights: [{ observationId: 'o1', label: 'MCV' }],
    chronology: [], clinicalPatterns: [{ title: 'Red-cell pattern', supportingEvidence: [{ observationId: 'o1', label: 'MCV' }], limitingEvidence: [] }],
    openQuestions: ['Iron status'], limitations: [],
  },
});

function renderPanel() {
  return render(
    <ClinoraClinicalSupportPanel
      appointmentId="a1"
      screen="REPORT_REVIEW"
      currentReportId="r1"
      selectedObservationIds={['o1']}
      comparableReportsAvailable
    />,
  );
}

async function openAndWaitForBrief(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Open Clinora' }));
  expect(await screen.findByText('One verified CBC is available.')).toBeInTheDocument();
}

describe('ClinoraClinicalSupportPanel', () => {
  beforeEach(() => {
    route.mockReset();
    execute.mockReset();
    execute.mockResolvedValue(briefResponse);
  });

  it('loads a deterministic Patient Clinical Brief automatically without routing', async () => {
    const user = userEvent.setup();
    renderPanel();
    await openAndWaitForBrief(user);

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledWith('a1', expect.objectContaining({ taskIds: ['BRIEF_PATIENT'] }));
    expect(route).not.toHaveBeenCalled();
    expect(screen.getByText(/1 verified observations · 1 currently shared reports · 1 important abnormalities/)).toBeInTheDocument();
    expect(screen.getByText('Red-cell pattern')).toBeInTheDocument();
    expect(screen.getByText('Iron status')).toBeInTheDocument();
  });

  it('shows only the four primary action types and demotes draft-note organization', async () => {
    const user = userEvent.setup();
    renderPanel();
    await openAndWaitForBrief(user);
    const dialog = screen.getByRole('dialog', { name: 'Clinora Clinical Support' });
    const actions = within(dialog).getByLabelText('Clinical Support quick actions');

    expect(within(actions).getByRole('button', { name: 'Explore clinical patterns' })).toBeInTheDocument();
    expect(within(actions).getByRole('button', { name: 'Check a clinical hypothesis' })).toBeInTheDocument();
    expect(within(actions).getByRole('button', { name: 'Compare reports' })).toBeInTheDocument();
    expect(within(actions).getByRole('button', { name: 'What information is missing?' })).toBeInTheDocument();
    expect(within(dialog).getByText('Consultation tools / Organize draft notes')).toBeInTheDocument();
  });

  it('bypasses routing for an explicit quick action', async () => {
    const user = userEvent.setup();
    renderPanel();
    await openAndWaitForBrief(user);
    execute.mockClear();
    execute.mockResolvedValue(response({ taskId: 'FIND_GAPS', result: { taskId: 'FIND_GAPS', summary: 'Context is missing.', gaps: [], limitations: [], summaryReferenceChunkIds: [] } }));

    const dialog = screen.getByRole('dialog', { name: 'Clinora Clinical Support' });
    await user.click(within(dialog).getByRole('button', { name: 'What information is missing?' }));

    await waitFor(() => expect(execute).toHaveBeenCalledWith('a1', expect.objectContaining({ taskIds: ['FIND_GAPS'] })));
    expect(route).not.toHaveBeenCalled();
  });

  it('uses routing only for free text and carries an inline hypothesis into execution', async () => {
    const user = userEvent.setup();
    renderPanel();
    await openAndWaitForBrief(user);
    execute.mockClear();
    route.mockResolvedValue({ status: 'ROUTED', taskIds: ['CROSS_CHECK_ASSESSMENT'], clarificationOptions: [], clarificationReason: null, missingRequiredContext: [], referencedContext: {} });
    execute.mockResolvedValue(response({ taskId: 'CROSS_CHECK_ASSESSMENT', result: { taskId: 'CROSS_CHECK_ASSESSMENT', evidenceFit: 'INSUFFICIENT_EVIDENCE', summary: 'More context is needed.', points: [], missingInformation: ['Iron studies'], alternativeConsiderations: [], limitations: [], summaryReferenceChunkIds: [] } }));

    await user.type(screen.getByRole('textbox', { name: 'Ask Clinora' }), 'Could this be beta-thalassemia trait?');
    await user.click(screen.getByRole('button', { name: 'Ask Clinora' }));

    await waitFor(() => expect(route).toHaveBeenCalledTimes(1));
    expect(execute).toHaveBeenCalledWith('a1', expect.objectContaining({
      taskIds: ['CROSS_CHECK_ASSESSMENT'],
      doctorAssessment: 'Could this be beta-thalassemia trait?',
    }));
  });

  it('renders the complete hypothesis evidence-fit structure from authoritative values', async () => {
    const user = userEvent.setup();
    renderPanel();
    await openAndWaitForBrief(user);
    execute.mockClear();
    execute.mockResolvedValue(response({
      taskId: 'CROSS_CHECK_ASSESSMENT',
      result: {
        taskId: 'CROSS_CHECK_ASSESSMENT', evidenceFit: 'MIXED_OR_LIMITED_EVIDENCE', summary: 'The available evidence is mixed.',
        points: [
          { statement: 'Microcytosis supports the hypothesis.', relation: 'SUPPORTS', evidence: [{ observationId: 'o1', label: 'MCV' }], referenceChunkIds: [] },
          { statement: 'The thyroid finding may be independent.', relation: 'UNRELATED', evidence: [{ observationId: 'o1', label: 'MCV' }], referenceChunkIds: [] },
          { statement: 'Iron status remains uncertain.', relation: 'UNCERTAIN', evidence: [], referenceChunkIds: [] },
        ],
        missingInformation: ['Ferritin'], alternativeConsiderations: [{ name: 'Iron availability pattern', rationale: 'Could also fit.', evidence: [{ observationId: 'o1', label: 'MCV' }], missingInformation: ['Ferritin'], referenceChunkIds: [] }],
        limitations: ['Not a diagnosis.'], summaryReferenceChunkIds: [],
      },
    }));
    const dialog = screen.getByRole('dialog', { name: 'Clinora Clinical Support' });
    await user.click(within(dialog).getByRole('button', { name: 'Check a clinical hypothesis' }));
    await user.type(screen.getByRole('textbox', { name: 'Clinical hypothesis' }), 'Possible beta-thalassemia trait');
    await user.click(screen.getByRole('button', { name: 'Check hypothesis' }));

    expect(await screen.findByText('Mixed or limited evidence')).toBeInTheDocument();
    expect(screen.getByText('Supports')).toBeInTheDocument();
    expect(screen.getByText('Uncertain')).toBeInTheDocument();
    expect(screen.getByText('Unrelated findings')).toBeInTheDocument();
    expect(screen.getByText('Alternative considerations')).toBeInTheDocument();
    expect(screen.getAllByText((_, node) => node?.textContent === 'MCV: 70 fL · LOW · ref 80-100').length).toBeGreaterThan(0);
    expect(route).not.toHaveBeenCalled();
  });

  it('renders separate clinical clusters and context-aware follow-ups', async () => {
    const user = userEvent.setup();
    renderPanel();
    await openAndWaitForBrief(user);
    execute.mockClear();
    execute.mockResolvedValue(response({
      taskId: 'EXPLORE_EXPLANATIONS',
      result: { taskId: 'EXPLORE_EXPLANATIONS', summary: 'The findings may represent separate processes.', explanations: [
        { clinicalCluster: 'Red-cell pattern', name: 'Microcytic pattern', whyItMayFit: 'The indices may fit.', supportingEvidence: [{ observationId: 'o1', label: 'MCV' }], limitingEvidence: [], missingInformation: ['Iron status'], referenceChunkIds: [] },
        { clinicalCluster: 'Thyroid pattern', name: 'Independent thyroid process', whyItMayFit: 'This may be separate.', supportingEvidence: [{ observationId: 'o1', label: 'MCV' }], limitingEvidence: [], missingInformation: [], referenceChunkIds: [] },
      ], limitations: [], summaryReferenceChunkIds: [] },
    }));
    const dialog = screen.getByRole('dialog', { name: 'Clinora Clinical Support' });
    await user.click(within(dialog).getByRole('button', { name: 'Explore clinical patterns' }));

    expect(await screen.findByText('Thyroid pattern')).toBeInTheDocument();
    expect(screen.getAllByText('Red-cell pattern').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Explain the evidence for this pattern' })).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it('shows the controlled validation reason instead of one generic safety message', async () => {
    const user = userEvent.setup();
    renderPanel();
    await openAndWaitForBrief(user);
    execute.mockClear();
    execute.mockResolvedValue(response({
      taskId: 'EXPLORE_EXPLANATIONS', status: 'FAILED_SAFE', result: null,
      safeFailureCode: 'INVENTED_HISTORY',
    }));

    const dialog = screen.getByRole('dialog', { name: 'Clinora Clinical Support' });
    await user.click(within(dialog).getByRole('button', { name: 'Explore clinical patterns' }));

    expect(await screen.findByText(/introduced unsupported Patient history/)).toBeInTheDocument();
    expect(screen.queryByText(/did not pass Clinora safety validation/)).not.toBeInTheDocument();
  });

  it.each(['GEMINI_RATE_LIMITED', 'GEMINI_TIMEOUT', 'GEMINI_UNAVAILABLE', 'MODEL_BUSY', 'MODEL_TIMEOUT', 'MODEL_UNAVAILABLE'])('shows the clinical result without provider messaging for %s', async (code) => {
    const user = userEvent.setup();
    renderPanel();
    await openAndWaitForBrief(user);
    execute.mockClear();
    execute.mockResolvedValue({ ...response({
      taskId: 'EXPLORE_EXPLANATIONS', status: 'DEGRADED', result: {
        taskId: 'EXPLORE_EXPLANATIONS',
        summary: 'Existing report analysis — live cross-report reasoning temporarily unavailable.',
        explanations: [{ clinicalCluster: 'CBC · 2026-09-01', name: 'Red-cell pattern', whyItMayFit: 'This concept appears in an existing READY report analysis and is linked to the verified evidence shown.', supportingEvidence: [{ observationId: 'o1', label: 'MCV' }], limitingEvidence: [], missingInformation: ['Iron status'], referenceChunkIds: [] }],
        limitations: ['This is advisory existing report-level analysis, not live cross-report reasoning.', 'Not a diagnosis.'], summaryReferenceChunkIds: [],
      },
      safeFailureCode: code,
      provenance: { executionProvider: 'MEDGEMMA_SNAPSHOT_FALLBACK', reasoningSnapshots: [{ status: 'READY' }] },
    }), status: 'DEGRADED' });

    const dialog = screen.getByRole('dialog', { name: 'Clinora Clinical Support' });
    await user.click(within(dialog).getByRole('button', { name: 'Explore clinical patterns' }));

    expect(await screen.findByText('Clinora result')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Degraded clinical reasoning mode' })).not.toBeInTheDocument();
    expect(screen.queryByText('Showing existing report analysis')).not.toBeInTheDocument();
    expect(screen.queryByText(/temporarily unavailable|temporarily busy|Gemini|READY|DB evidence/i)).not.toBeInTheDocument();
    expect(screen.getByText('Clinical patterns from the available report evidence.')).toBeInTheDocument();
    expect(screen.getByText('This report-level pattern is linked to the verified evidence shown.')).toBeInTheDocument();
    expect(screen.getByText('This advisory analysis is limited to individual reports; relationships across reports have not been assessed.')).toBeInTheDocument();
    expect(screen.getByText('Not a diagnosis.')).toBeInTheDocument();
    expect(within(screen.getByRole('article')).getByText((_, node) => node?.tagName === 'SPAN' && node.textContent === 'MCV: 70 fL · LOW · ref 80-100')).toBeInTheDocument();
    expect(screen.queryByText(/Clinora stopped safely/)).not.toBeInTheDocument();
  });

  it('renders the explicitly limited hypothesis fallback without calling it a safety failure', async () => {
    const user = userEvent.setup();
    renderPanel();
    await openAndWaitForBrief(user);
    execute.mockClear();
    execute.mockResolvedValue({ ...response({
      taskId: 'CROSS_CHECK_ASSESSMENT', status: 'DEGRADED', result: {
        taskId: 'CROSS_CHECK_ASSESSMENT', evidenceFit: 'MIXED_OR_LIMITED_EVIDENCE',
        summary: 'Live cross-report hypothesis checking is unavailable; this is existing report-level analysis only.',
        points: [{ statement: 'Existing report analysis lists iron deficiency.', relation: 'SUPPORTS', evidence: [{ observationId: 'o1', label: 'MCV' }], referenceChunkIds: [] }],
        missingInformation: ['Iron status'], alternativeConsiderations: [], limitations: ['No live cross-report hypothesis conclusion was generated; concept matching is exact after basic wording normalization and is not fuzzy diagnostic inference.'], summaryReferenceChunkIds: [],
      },
      safeFailureCode: 'GEMINI_RATE_LIMITED',
      provenance: { executionProvider: 'MEDGEMMA_SNAPSHOT_FALLBACK', reasoningSnapshots: [{ status: 'READY' }] },
    }), status: 'DEGRADED' });

    const dialog = screen.getByRole('dialog', { name: 'Clinora Clinical Support' });
    await user.click(within(dialog).getByRole('button', { name: 'Check a clinical hypothesis' }));
    await user.type(screen.getByRole('textbox', { name: 'Clinical hypothesis' }), 'Possible iron deficiency');
    await user.click(screen.getByRole('button', { name: 'Check hypothesis' }));

    expect(await screen.findByText('Clinora result')).toBeInTheDocument();
    expect(screen.getByText('Report-level evidence related to this hypothesis is shown below.')).toBeInTheDocument();
    expect(screen.getByText('Mixed or limited evidence')).toBeInTheDocument();
    expect(screen.getByText('This result matches the hypothesis wording to report-level findings; it does not establish a diagnostic conclusion across reports.')).toBeInTheDocument();
    expect(screen.queryByText(/unavailable|temporarily busy|live cross-report/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Unable to complete safely/)).not.toBeInTheDocument();
  });

  it('shows missing information without the provider availability summary', async () => {
    const user = userEvent.setup();
    renderPanel();
    await openAndWaitForBrief(user);
    execute.mockResolvedValue({ ...response({
      taskId: 'FIND_GAPS', status: 'DEGRADED', safeFailureCode: 'GEMINI_UNAVAILABLE',
      result: {
        taskId: 'FIND_GAPS', summary: 'Showing gaps from existing READY report analysis; live cross-report reasoning is temporarily unavailable.',
        gaps: [{ category: 'Ferritin', whyRelevant: 'Iron status is uncertain.', relatedEvidence: [{ observationId: 'o1', label: 'MCV' }] }],
        limitations: ['Not a test order.'], summaryReferenceChunkIds: [],
      },
    }), status: 'DEGRADED' });
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'What information is missing?' }));

    expect(await screen.findByText('Missing information identified in the available report evidence.')).toBeInTheDocument();
    expect(screen.getByText('Ferritin')).toBeInTheDocument();
    expect(screen.getByText('Not a test order.')).toBeInTheDocument();
    expect(screen.queryByText(/unavailable|READY/i)).not.toBeInTheDocument();
  });

  it('keeps a neutral retry message when there is no result to display', async () => {
    const user = userEvent.setup();
    renderPanel();
    await openAndWaitForBrief(user);
    execute.mockResolvedValue({ ...response({
      taskId: 'EXPLORE_EXPLANATIONS', status: 'FAILED_SAFE', result: null, safeFailureCode: 'GEMINI_UNAVAILABLE',
    }), status: 'FAILED_SAFE' });
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Explore clinical patterns' }));

    expect(await screen.findByText('No result could be prepared for this request. Please try again.')).toBeInTheDocument();
    expect(screen.queryByText('Clinora result')).not.toBeInTheDocument();
    expect(screen.queryByText(/temporarily unavailable/i)).not.toBeInTheDocument();
  });

  it('renders report side-by-side evidence when no repeated observation is directly comparable', async () => {
    const user = userEvent.setup();
    renderPanel();
    await openAndWaitForBrief(user);
    execute.mockClear();
    execute.mockResolvedValue(response({
      taskId: 'COMPARE_EVIDENCE', result: {
        taskId: 'COMPARE_EVIDENCE', summary: 'No directly comparable repeated observations were available across these reports.', comparisons: [],
        nonComparable: ['No directly comparable repeated observations were available across these reports.'],
        reportSummaries: [
          { label: 'Report A', reportId: 'r1', reportType: 'CBC', clinicalDate: '2026-09-01', importantFindings: [{ observationId: 'o1', label: 'MCV' }], existingAnalysis: ['Red-cell pattern'] },
          { label: 'Report B', reportId: 'r2', reportType: 'IRON_STUDIES', clinicalDate: '2026-09-10', importantFindings: [], existingAnalysis: ['Iron availability pattern'] },
        ],
        findingsOnlyInEarlierReport: [{ observationId: 'o1', label: 'MCV' }], findingsOnlyInLaterReport: [], persistentFindings: [], patternDifferences: ['Only Report A existing analysis: Red-cell pattern'], limitations: [],
      },
    }));

    const dialog = screen.getByRole('dialog', { name: 'Clinora Clinical Support' });
    await user.click(within(dialog).getByRole('button', { name: 'Compare reports' }));

    expect(await screen.findByText('No directly comparable repeated findings')).toBeInTheDocument();
    expect(screen.getByText('Report A')).toBeInTheDocument();
    expect(screen.getByText('Report B')).toBeInTheDocument();
    expect(screen.getByText('Iron availability pattern')).toBeInTheDocument();
    expect(screen.queryByText(/Unable to complete safely/)).not.toBeInTheDocument();
  });

  it('refreshes authorization by reloading the Brief after the drawer is closed and reopened', async () => {
    const user = userEvent.setup();
    renderPanel();
    await openAndWaitForBrief(user);
    await user.click(screen.getByRole('button', { name: 'Close Clinora Clinical Support' }));
    await user.click(screen.getByRole('button', { name: 'Open Clinora' }));

    await waitFor(() => expect(execute).toHaveBeenCalledTimes(2));
    expect(execute.mock.calls.every((call) => call[1].taskIds[0] === 'BRIEF_PATIENT')).toBe(true);
  });
});
