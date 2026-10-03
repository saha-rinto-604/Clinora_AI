import axios from 'axios';
import type { AIEvaluationRun } from './research-types';

type Configuration = Record<string, string | number | boolean | undefined>;

export function evaluationConfig(run: Pick<AIEvaluationRun, 'configuration'>): Configuration {
  try {
    const parsed: unknown = JSON.parse(run.configuration || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([, value]) =>
      ['string', 'number', 'boolean'].includes(typeof value)));
  } catch { return {}; }
}

export function evaluationReady(run: AIEvaluationRun): boolean {
  const config = evaluationConfig(run);
  return run.status === 'CONFIGURED' && run.taskType === 'ABNORMALITY_DETECTION'
    && config.predictionRunner === 'READY' && config.referenceResolver === 'READY'
    && config.automatedExecution === 'READY' && Number(config.eligibleObservations) > 0;
}

export function percentage(value: number | undefined): string {
  return value === undefined ? 'Unavailable' : `${(value * 100).toFixed(2)}%`;
}

export function evaluationError(error: unknown): string {
  const body = axios.isAxiosError(error) ? error.response?.data as { errorCode?: string; code?: string } | undefined : undefined;
  const code = typeof error === 'string' ? error : body?.errorCode ?? body?.code;
  if (code === 'CLINORA_AI_UNAVAILABLE') return 'Clinora AI is currently unavailable.';
  if (code === 'REFERENCE_NOT_FOUND') return 'Verified reference data is unavailable for this dataset version.';
  if (code === 'INVALID_AI_RESPONSE') return 'Clinora AI returned an incomplete or invalid response. No scores were saved.';
  return 'Evaluation could not be started.';
}
