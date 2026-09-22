import {
  AlertCircle,
  BrainCircuit,
  Grid,
  LoaderCircle,
  Play,
  ShieldAlert,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '../../components/ui/button';
import { apiErrorMessage } from '../../features/auth/auth-api';
import { researchApi } from '../../features/research/research-api';
import type {
  AIEvaluationRun,
  CreateEvaluationRunPayload,
  EvaluationTaskType,
} from '../../features/research/research-types';

interface AIEvaluationSectionProps {
  projectId: string;
  isApproved: boolean;
}

export function AIEvaluationSection({ projectId, isApproved }: AIEvaluationSectionProps) {
  const [runs, setRuns] = useState<AIEvaluationRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedRun, setSelectedRun] = useState<AIEvaluationRun | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New run form state
  const [formDatasetVersionId, setFormDatasetVersionId] = useState('');
  const [formModelId, setFormModelId] = useState('medgemma-7b-clinical');
  const [formModelVersion, setFormModelVersion] = useState('v1.2.0');
  const [formPromptVersion, setFormPromptVersion] = useState('lab-extract-v3');
  const [formTaskType, setFormTaskType] = useState<EvaluationTaskType>('EXTRACTION');
  const [formGroundTruth, setFormGroundTruth] = useState('PHYSICIAN_VERIFIED_OBSERVATIONS');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const loadRuns = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError('');
    try {
      const data = await researchApi.listEvaluationRuns(projectId);
      setRuns(data);
    } catch (err: unknown) {
      setError(apiErrorMessage(err, 'Failed to load evaluation runs.'));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (isApproved) {
      loadRuns();
    }
  }, [isApproved, loadRuns]);

  const handleStartRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDatasetVersionId.trim()) {
      setFormError('Dataset Version UUID is required.');
      return;
    }
    setSubmitting(true);
    setFormError('');

    try {
      const payload: CreateEvaluationRunPayload = {
        datasetVersionId: formDatasetVersionId.trim(),
        modelId: formModelId.trim(),
        modelVersion: formModelVersion.trim(),
        promptVersion: formPromptVersion.trim(),
        taskType: formTaskType,
        groundTruthDefinition: formGroundTruth.trim(),
        configuration: {
          temperature: 0.1,
          top_p: 0.95,
          evaluation_harness: 'Clinora_Eval_v1',
        },
      };

      const newRun = await researchApi.createEvaluationRun(projectId, payload);
      setRuns((prev) => [newRun, ...prev]);
      setIsModalOpen(false);
      setSelectedRun(newRun);
    } catch (err: unknown) {
      setFormError(apiErrorMessage(err, 'Failed to initiate AI evaluation run.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/60">
        <div>
          <div className="flex items-center gap-2">
            <BrainCircuit className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-semibold text-slate-100">
              AI Model Evaluation Framework (Phase R13)
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Reproducible benchmark runs evaluating model versions against gold-standard dataset versions.
          </p>
        </div>

        {isApproved && (
          <Button
            onClick={() => {
              setFormError('');
              setIsModalOpen(true);
            }}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs self-start sm:self-auto"
          >
            <Play className="w-3.5 h-3.5 mr-1.5" />
            New Evaluation Run
          </Button>
        )}
      </div>

      {/* Critical Governance Boundary Alert */}
      <div className="rounded-xl border border-amber-800/70 bg-amber-950/20 p-4 text-xs text-amber-200/90 space-y-1.5">
        <div className="flex items-center gap-2 font-semibold text-amber-300">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
          <span>Strict Model Governance Boundary (SRS Rule)</span>
        </div>
        <p className="text-[11px] text-amber-200/80 leading-relaxed pl-6">
          Research evaluation runs are strictly non-interfering experiment artifacts. Even when evaluation succeeds with 100% metrics, research runs can <strong>never automatically promote or overwrite production models</strong>. Production model deployment requires independent clinical board clearance.
        </p>
      </div>

      {/* Runs Table / Empty state */}
      {loading ? (
        <div className="py-8 flex items-center justify-center text-slate-400 text-xs gap-2">
          <LoaderCircle className="w-4 h-4 animate-spin text-indigo-400" />
          <span>Loading evaluation runs...</span>
        </div>
      ) : error ? (
        <div className="p-3 rounded-lg bg-red-950/30 border border-red-800 text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : runs.length === 0 ? (
        <div className="py-8 text-center">
          <BrainCircuit className="w-8 h-8 mx-auto text-slate-600 mb-2" />
          <div className="text-xs font-medium text-slate-300">No evaluation runs yet</div>
          <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
            Benchmark MedGemma or custom extraction models against your approved de-identified dataset versions to compute Accuracy, Precision, Recall, F1, and ROC-AUC.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-800/60">
          {runs.map((run) => (
            <div
              key={run.id}
              className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-800/20 px-3 rounded-xl transition-colors"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-slate-200 font-mono">
                    {run.modelId} <span className="text-indigo-400 text-xs">{run.modelVersion}</span>
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-slate-800 text-slate-300 border border-slate-700">
                    {run.taskType}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono text-cyan-300 bg-cyan-950/40 border border-cyan-800/60">
                    Prompt: {run.promptVersion}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                      run.status === 'COMPLETED'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : run.status === 'RUNNING'
                        ? 'bg-amber-950 text-amber-300 border border-amber-800 animate-pulse'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {run.status}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 flex items-center gap-3">
                  <span>Ground truth: <strong className="text-slate-300">{run.groundTruthDefinition}</strong></span>
                  <span>•</span>
                  <span>{new Date(run.createdAt).toLocaleString()}</span>
                </div>
              </div>

              {/* Metrics Pills & View Button */}
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                {run.metrics && (
                  <div className="flex items-center gap-2 mr-2">
                    <div className="px-2 py-1 rounded bg-slate-950 border border-slate-800 text-center">
                      <div className="text-[9px] text-slate-400 uppercase font-semibold">Acc</div>
                      <div className="text-xs font-mono font-bold text-emerald-400">
                        {(run.metrics.accuracy * 100).toFixed(1)}%
                      </div>
                    </div>
                    <div className="px-2 py-1 rounded bg-slate-950 border border-slate-800 text-center">
                      <div className="text-[9px] text-slate-400 uppercase font-semibold">F1</div>
                      <div className="text-xs font-mono font-bold text-cyan-400">
                        {run.metrics.f1.toFixed(3)}
                      </div>
                    </div>
                    <div className="px-2 py-1 rounded bg-slate-950 border border-slate-800 text-center">
                      <div className="text-[9px] text-slate-400 uppercase font-semibold">Bal. Acc.</div>
                      <div className="text-xs font-mono font-bold text-purple-400">
                        {(run.metrics.balancedAccuracy ?? run.metrics.rocAuc ?? 0).toFixed(3)}
                      </div>
                    </div>
                  </div>
                )}
                <Button
                  variant="secondary"
                  onClick={() => setSelectedRun(run)}
                  className="text-xs py-1 px-3 h-auto border border-slate-700 hover:border-slate-600"
                >
                  Inspect Results
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Evaluation Run Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <BrainCircuit className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-semibold text-slate-100">Launch AI Model Evaluation</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleStartRun} className="space-y-4 text-xs">
              {formError && (
                <div className="p-3 rounded-lg bg-red-950/40 border border-red-800 text-red-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Dataset Version UUID *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                  value={formDatasetVersionId}
                  onChange={(e) => setFormDatasetVersionId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Find this under the approved Dataset Request details or Datasets workspace.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Model Identifier</label>
                  <input
                    type="text"
                    required
                    value={formModelId}
                    onChange={(e) => setFormModelId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Model Version</label>
                  <input
                    type="text"
                    required
                    value={formModelVersion}
                    onChange={(e) => setFormModelVersion(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Prompt Version</label>
                  <input
                    type="text"
                    required
                    value={formPromptVersion}
                    onChange={(e) => setFormPromptVersion(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Task Type</label>
                  <select
                    value={formTaskType}
                    onChange={(e) => setFormTaskType(e.target.value as EvaluationTaskType)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="EXTRACTION">Extraction</option>
                    <option value="CLASSIFICATION">Classification</option>
                    <option value="ABNORMALITY_DETECTION">Abnormality Detection</option>
                    <option value="RISK_SCORING">Risk Scoring</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Ground Truth Definition</label>
                <input
                  type="text"
                  required
                  value={formGroundTruth}
                  onChange={(e) => setFormGroundTruth(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsModalOpen(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs"
                >
                  {submitting ? (
                    <>
                      <LoaderCircle className="w-3.5 h-3.5 animate-spin mr-1.5" />
                      Evaluating...
                    </>
                  ) : (
                    'Execute Benchmark'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detailed Inspection Drawer/Modal */}
      {selectedRun && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <BrainCircuit className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-base font-bold text-slate-100 font-mono">
                    {selectedRun.modelId} <span className="text-indigo-400">{selectedRun.modelVersion}</span>
                  </h3>
                </div>
                <div className="text-xs text-slate-400 font-mono">
                  Prompt: {selectedRun.promptVersion} • Task: {selectedRun.taskType}
                </div>
              </div>
              <button
                onClick={() => setSelectedRun(null)}
                className="text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Metrics KPI Scorecards */}
            {selectedRun.metrics ? (
              <div className="space-y-6">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                    Diagnostic &amp; Statistical Performance
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                      <div className="text-[10px] text-slate-400 font-semibold uppercase">Accuracy</div>
                      <div className="text-lg font-mono font-bold text-emerald-400 mt-1">
                        {(selectedRun.metrics.accuracy * 100).toFixed(2)}%
                      </div>
                      <div className="text-[9px] text-slate-500 mt-0.5">(TP + TN) / Total</div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                      <div className="text-[10px] text-slate-400 font-semibold uppercase">Precision (PPV)</div>
                      <div className="text-lg font-mono font-bold text-cyan-400 mt-1">
                        {(selectedRun.metrics.precision * 100).toFixed(2)}%
                      </div>
                      <div className="text-[9px] text-slate-500 mt-0.5">TP / (TP + FP)</div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                      <div className="text-[10px] text-slate-400 font-semibold uppercase">Recall (Sens)</div>
                      <div className="text-lg font-mono font-bold text-indigo-400 mt-1">
                        {(selectedRun.metrics.recall * 100).toFixed(2)}%
                      </div>
                      <div className="text-[9px] text-slate-500 mt-0.5">TP / (TP + FN)</div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                      <div className="text-[10px] text-slate-400 font-semibold uppercase">F1-Score</div>
                      <div className="text-lg font-mono font-bold text-amber-400 mt-1">
                        {selectedRun.metrics.f1.toFixed(4)}
                      </div>
                      <div className="text-[9px] text-slate-500 mt-0.5">Harmonic Mean</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mt-3">
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                      <div className="text-[10px] text-slate-400 font-semibold uppercase">Balanced Accuracy</div>
                      <div className="text-base font-mono font-bold text-purple-400 mt-1">
                        {(selectedRun.metrics.balancedAccuracy ?? selectedRun.metrics.rocAuc ?? 0).toFixed(4)}
                      </div>
                      <div className="text-[9px] text-slate-500 mt-0.5">(Sensitivity + Specificity) / 2</div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                      <div className="text-[10px] text-slate-400 font-semibold uppercase">False Positive Rate (FPR)</div>
                      <div className="text-base font-mono font-bold text-rose-400 mt-1">
                        {(selectedRun.metrics.falsePositiveRate * 100).toFixed(2)}%
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                      <div className="text-[10px] text-slate-400 font-semibold uppercase">False Negative Rate (FNR)</div>
                      <div className="text-base font-mono font-bold text-rose-400 mt-1">
                        {(selectedRun.metrics.falseNegativeRate * 100).toFixed(2)}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2x2 Confusion Matrix Visualization */}
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                    <Grid className="w-4 h-4 text-cyan-400" />
                    2x2 Diagnostic Confusion Matrix (Sample Count: {selectedRun.metrics.sampleCount})
                  </h4>
                  <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 text-xs">
                    <div className="grid grid-cols-2 gap-3 text-center">
                      <div className="p-4 rounded-lg bg-emerald-950/40 border border-emerald-800/60">
                        <div className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">
                          True Positives (TP)
                        </div>
                        <div className="text-2xl font-mono font-bold text-emerald-300 mt-1">
                          {selectedRun.metrics.confusionMatrix.truePositives}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1">
                          Model (+), Ground Truth (+)
                        </div>
                      </div>

                      <div className="p-4 rounded-lg bg-rose-950/40 border border-rose-800/60">
                        <div className="text-[10px] text-rose-400 font-semibold uppercase tracking-wider">
                          False Positives (FP)
                        </div>
                        <div className="text-2xl font-mono font-bold text-rose-300 mt-1">
                          {selectedRun.metrics.confusionMatrix.falsePositives}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1">
                          Model (+), Ground Truth (-)
                        </div>
                      </div>

                      <div className="p-4 rounded-lg bg-rose-950/40 border border-rose-800/60">
                        <div className="text-[10px] text-rose-400 font-semibold uppercase tracking-wider">
                          False Negatives (FN)
                        </div>
                        <div className="text-2xl font-mono font-bold text-rose-300 mt-1">
                          {selectedRun.metrics.confusionMatrix.falseNegatives}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1">
                          Model (-), Ground Truth (+)
                        </div>
                      </div>

                      <div className="p-4 rounded-lg bg-emerald-950/40 border border-emerald-800/60">
                        <div className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">
                          True Negatives (TN)
                        </div>
                        <div className="text-2xl font-mono font-bold text-emerald-300 mt-1">
                          {selectedRun.metrics.confusionMatrix.trueNegatives}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1">
                          Model (-), Ground Truth (-)
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Audit & Provenance Details */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 text-xs space-y-2 font-mono">
                  <div className="text-[10px] uppercase font-semibold text-slate-400 font-sans">
                    Audit &amp; Experiment Provenance
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-slate-300 text-[11px]">
                    <div>Run ID: <span className="text-slate-400">{selectedRun.id}</span></div>
                    <div>Dataset Version: <span className="text-slate-400">{selectedRun.datasetVersionId}</span></div>
                    <div>Created At: <span className="text-slate-400">{new Date(selectedRun.createdAt).toLocaleString()}</span></div>
                    <div>Completed At: <span className="text-slate-400">{selectedRun.completedAt ? new Date(selectedRun.completedAt).toLocaleString() : 'N/A'}</span></div>
                  </div>
                  <div className="pt-2 text-[10px] text-slate-500 font-sans">
                    Config: <code className="text-indigo-300">{selectedRun.configuration}</code>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">
                {selectedRun.status === 'RUNNING' ? (
                  <div className="flex items-center justify-center gap-2">
                    <LoaderCircle className="w-4 h-4 animate-spin text-indigo-400" />
                    <span>Run is currently executing...</span>
                  </div>
                ) : (
                  <div>Run ended with status {selectedRun.status}. {selectedRun.failureReason}</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
