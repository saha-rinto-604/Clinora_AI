import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { route, execute } = vi.hoisted(() => ({ route: vi.fn(), execute: vi.fn() }));
vi.mock('./doctor-clinical-support-api', async (load) => ({
  ...(await load<typeof import('./doctor-clinical-support-api')>()),
  doctorClinicalSupportApi: { route, execute },
}));

import { ClinoraClinicalSupportPanel } from './clinora-clinical-support-panel';

describe('ClinoraClinicalSupportPanel', () => {
  beforeEach(() => {
    route.mockReset();
    execute.mockReset();
  });

  it('opens and closes the contextual panel without a standalone chat route', async () => {
    const user = userEvent.setup();
    render(
      <ClinoraClinicalSupportPanel
        appointmentId="a1"
        screen="REPORT_REVIEW"
        currentReportId="r1"
        selectedObservationIds={['o1']}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Open Clinora' }));
    expect(screen.getByRole('dialog', { name: 'Clinora Clinical Support' })).toBeInTheDocument();
    expect(screen.queryByText(/progress.*%/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close Clinora Clinical Support' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders registry clarification choices and executes the selected operation', async () => {
    const user = userEvent.setup();
    route.mockResolvedValue({
      status: 'CLARIFICATION_REQUIRED',
      taskIds: [],
      referencedContext: {},
      clarificationReason: 'AMBIGUOUS_INTENT',
      missingRequiredContext: [],
      clarificationOptions: [
        {
          taskId: 'FOCUSED_EVIDENCE_QUESTION',
          label: 'Ask about this evidence',
          shortDescription: 'Handle a focused question.',
        },
      ],
    });
    execute.mockResolvedValue({
      executionId: 'e1',
      doctorId: 'd1',
      appointmentId: 'a1',
      status: 'SUCCEEDED',
      evidenceSnapshotHash: 'hash',
      reports: [],
      evidence: [
        {
          observationId: 'o1',
          reportId: 'r1',
          label: 'NS1',
          canonicalCode: 'NS1',
          valueType: 'TEXT',
          numericValue: null,
          textValue: 'Positive',
          comparator: null,
          unit: null,
          referenceLow: null,
          referenceHigh: null,
          referenceRangeRaw: null,
          authoritativeStatus: 'POSITIVE',
          verificationStatus: 'PATIENT_CONFIRMED',
        },
      ],
      selectionCandidates: [],
      startedAt: '',
      completedAt: '',
      taskResults: [
        {
          taskId: 'FOCUSED_EVIDENCE_QUESTION',
          status: 'SUCCEEDED',
          safeFailureCode: null,
          references: [
            {
              chunkId: 'internal-chunk-id',
              sourceId: 'source',
              documentId: 'document',
              title: 'Approved NS1 reference',
              publisher: 'Clinora Clinical Library',
              sourceType: 'guideline',
              clinicalDomain: 'infectious_disease',
              publicationDate: '2026-01-01',
              version: '1',
              jurisdiction: null,
              sourceReference: null,
              sectionPath: 'Interpretation',
            },
          ],
          provenance: {},
          result: {
            taskId: 'FOCUSED_EVIDENCE_QUESTION',
            answer: 'The selected NS1 result is reported positive.',
            supportingEvidence: [{ observationId: 'o1', label: 'NS1' }],
            referenceChunkIds: [],
            limitations: ['Selected evidence only.'],
          },
        },
      ],
    });
    const view = render(
      <ClinoraClinicalSupportPanel
        appointmentId="a1"
        screen="REPORT_REVIEW"
        currentReportId="r1"
        selectedObservationIds={['o1']}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Open Clinora' }));
    await user.type(screen.getByLabelText('Ask Clinora about this context'), 'Check this.');
    await user.click(screen.getByRole('button', { name: 'Route request' }));
    expect(await screen.findByText('What would you like Clinora to do?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Ask about this evidence/ }));
    expect(await screen.findByText('The selected NS1 result is reported positive.')).toBeInTheDocument();
    expect(execute).toHaveBeenCalledWith(
      'a1',
      expect.objectContaining({ taskIds: ['FOCUSED_EVIDENCE_QUESTION'], selectedObservationIds: ['o1'] }),
    );
    expect(screen.getByText('Approved NS1 reference')).toBeInTheDocument();
    expect(screen.getByText(/Clinora Clinical Library · Interpretation/)).toBeInTheDocument();
    expect(screen.queryByText('internal-chunk-id')).not.toBeInTheDocument();
    view.rerender(
      <ClinoraClinicalSupportPanel
        appointmentId="a1"
        screen="REPORT_REVIEW"
        currentReportId="r1"
        selectedObservationIds={['o1', 'o2']}
      />,
    );
    expect(screen.getByText(/Evidence or working text changed/)).toBeInTheDocument();
  });

  it('keeps assessment and notes temporary and exposes their task actions', async () => {
    const user = userEvent.setup();
    route.mockResolvedValue({
      status: 'UNSUPPORTED',
      taskIds: [],
      clarificationOptions: [],
      referencedContext: {},
      clarificationReason: null,
      missingRequiredContext: [],
    });
    render(
      <ClinoraClinicalSupportPanel
        appointmentId="a1"
        screen="REPORT_REVIEW"
        currentReportId="r1"
        selectedObservationIds={['o1', 'o2']}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Open Clinora' }));
    await user.click(screen.getByText('Cross-check a working assessment'));
    await user.type(screen.getByLabelText('My working assessment…'), 'Possible iron deficiency');
    expect(screen.getByText(/not saved as a diagnosis/i)).toBeInTheDocument();
    await user.click(screen.getByText('Structure temporary notes'));
    await user.type(screen.getByLabelText('Doctor-authored notes'), '? iron deficiency, low MCV');
    expect(screen.getByText(/not persisted automatically/i)).toBeInTheDocument();
  });
});
