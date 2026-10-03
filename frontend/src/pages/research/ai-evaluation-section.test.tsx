import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { researchApi } from '../../features/research/research-api';
import type { AIEvaluationRun } from '../../features/research/research-types';
import { AIEvaluationSection } from './ai-evaluation-section';

vi.mock('../../features/research/research-api');

const configured: AIEvaluationRun = {
  id: 'run-1', projectId: 'project-1', datasetVersionId: 'version-1', modelId: 'clinora-ai',
  modelVersion: 'v1', promptVersion: 'abnormality-all-v1', taskType: 'ABNORMALITY_DETECTION',
  groundTruthDefinition: 'VERIFIED_LAB_REFERENCE_RANGE', status: 'CONFIGURED',
  createdBy: 'researcher', createdAt: '2026-10-03T00:00:00Z',
  configuration: JSON.stringify({ predictionRunner: 'READY', referenceResolver: 'READY',
    automatedExecution: 'READY', eligibleObservations: 24, referenceSource: 'Verified Lab Reference Range' }),
};

async function inspect(run = configured) {
  vi.mocked(researchApi.listEvaluationRuns).mockResolvedValue([run]);
  render(<AIEvaluationSection projectId="project-1" isApproved />);
  fireEvent.click(await screen.findByRole('button', { name: 'Inspect Protocol' }));
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(researchApi.getEvaluationOptions).mockResolvedValue({ datasetVersions: [], models: [], taskTypes: [], groundTruthDefinitions: [] });
});

describe('AI evaluation execution', () => {
  it('enables execution only when all readiness checks and eligible counts agree', async () => {
    await inspect();
    expect(screen.getByRole('button', { name: 'Run Evaluation' })).toBeEnabled();
    expect(screen.getByText('24')).toBeInTheDocument();
    expect(screen.queryByText('Evaluating with Clinora AI...')).not.toBeInTheDocument();
  });

  it.each(['predictionRunner', 'referenceResolver', 'automatedExecution'])('disables execution when %s is unavailable', async (key) => {
    await inspect({ ...configured, configuration: JSON.stringify({ ...JSON.parse(configured.configuration), [key]: 'UNAVAILABLE' }) });
    expect(screen.getByRole('button', { name: 'Run Evaluation' })).toBeDisabled();
  });

  it('shows real pending execution and a clean runtime failure', async () => {
    let finish!: (run: AIEvaluationRun) => void;
    vi.mocked(researchApi.executeEvaluation).mockReturnValue(new Promise(resolve => { finish = resolve; }));
    await inspect();
    fireEvent.click(screen.getByRole('button', { name: 'Run Evaluation' }));
    expect(screen.getByRole('status')).toHaveTextContent('Evaluating with Clinora AI...');
    finish({ ...configured, status: 'FAILED', failureReason: 'CLINORA_AI_UNAVAILABLE' });
    expect(await screen.findByText('Clinora AI is currently unavailable.')).toBeInTheDocument();
    expect(screen.queryByText('Evaluation Performance')).not.toBeInTheDocument();
  });

  it('maps HTTP errors to inline messages without browser alerts or Axios internals', async () => {
    const alert = vi.spyOn(window, 'alert');
    vi.mocked(researchApi.executeEvaluation).mockRejectedValue({ isAxiosError: true, response: { data: { errorCode: 'REFERENCE_NOT_FOUND' } } });
    vi.mocked(researchApi.getEvaluationRun).mockResolvedValue(configured);
    await inspect();
    fireEvent.click(screen.getByRole('button', { name: 'Run Evaluation' }));
    expect(await screen.findByText('Verified reference data is unavailable for this dataset version.')).toBeInTheDocument();
    expect(alert).not.toHaveBeenCalled();
    alert.mockRestore();
  });

  it('renders six consistent metrics and real counts without extraction KPIs', async () => {
    await inspect({ ...configured, status: 'COMPLETED', metrics: {
      accuracy: .875, precision: .9, recall: .8182, f1: .8571, balancedAccuracy: .8706,
      falsePositiveRate: .0769, falseNegativeRate: .1818, sampleCount: 24,
      confusionMatrix: { truePositives: 9, trueNegatives: 12, falsePositives: 1, falseNegatives: 2 },
    } });
    expect(screen.getByText('Evaluation Performance')).toBeInTheDocument();
    expect(screen.getAllByText('87.50%').length).toBeGreaterThan(0);
    expect(screen.getByText('Specificity')).toBeInTheDocument();
    expect(screen.getByText('Confusion Matrix')).toBeInTheDocument();
    for (const label of ['Exact Match Rate', 'Tolerance Match Rate', 'Mean Absolute Error', 'False Positive Rate (FPR)'])
      expect(screen.queryByText(label)).not.toBeInTheDocument();
  });

  it('withholds historical scores and comparison', async () => {
    await inspect({ ...configured, status: 'COMPLETED', configuration: '{"legacyUnverified":true}' });
    expect(screen.getByText(/Unverified historical result/)).toBeInTheDocument();
    expect(screen.queryByTitle('Select for comparison')).not.toBeInTheDocument();
    await waitFor(() => expect(researchApi.executeEvaluation).not.toHaveBeenCalled());
  });
});
