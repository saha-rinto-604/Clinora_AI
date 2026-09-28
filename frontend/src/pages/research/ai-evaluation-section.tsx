import {
  AlertCircle,
  ArrowRight,
  BrainCircuit,
  Check,
  Copy,
  LoaderCircle,
  Play,
  RotateCw,
  Scale,
  ShieldAlert,
  Sparkles,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '../../components/ui/button';
import { apiErrorMessage } from '../../features/auth/auth-api';
import { researchApi } from '../../features/research/research-api';
import type {
  AIEvaluationOptions,
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
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Options from server
  const [options, setOptions] = useState<AIEvaluationOptions | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [optionsError, setOptionsError] = useState('');

  // Multi-step modal state
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [formDatasetVersionId, setFormDatasetVersionId] = useState('');
  const [formModelId, setFormModelId] = useState('clinora-ai-clinical');
  const [formModelVersion, setFormModelVersion] = useState('v1.2.0');
  const [formPromptVersion, setFormPromptVersion] = useState('lab-extract-v3');
  const [formTaskType, setFormTaskType] = useState<EvaluationTaskType>('EXTRACTION');
  const [formGroundTruth, setFormGroundTruth] = useState('PHYSICIAN_VERIFIED_OBSERVATIONS');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Compare runs state
  const [selectedRunIdsForCompare, setSelectedRunIdsForCompare] = useState<string[]>([]);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);

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

  const loadOptions = useCallback(async () => {
    if (!projectId) return;
    setLoadingOptions(true);
    setOptionsError('');
    try {
      const opts = await researchApi.getEvaluationOptions(projectId);
      setOptions(opts);
      if (opts.datasetVersions.length > 0 && !formDatasetVersionId) {
        setFormDatasetVersionId(opts.datasetVersions[0].id);
      }
      if (opts.models.length > 0) {
        setFormModelId(opts.models[0].id);
        setFormModelVersion(opts.models[0].version);
        setFormPromptVersion(opts.models[0].promptVersion);
      }
    } catch (err: unknown) {
      setOptionsError(apiErrorMessage(err, 'Failed to load evaluation options.'));
    } finally {
      setLoadingOptions(false);
    }
  }, [projectId, formDatasetVersionId]);

  useEffect(() => {
    if (isApproved) {
      loadRuns();
      loadOptions();
    }
  }, [isApproved, loadRuns, loadOptions]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const openNewEvaluationModal = () => {
    setFormError('');
    setCurrentStep(1);
    setIsModalOpen(true);
    if (!options) {
      loadOptions();
    }
  };

  const handleModelChange = (modelId: string) => {
    setFormModelId(modelId);
    const m = options?.models.find((item) => item.id === modelId);
    if (m) {
      setFormModelVersion(m.version);
      setFormPromptVersion(m.promptVersion);
    }
  };

  const handleStartRun = async () => {
    if (!formDatasetVersionId.trim()) {
      setFormError('Please select an authorized Dataset Version.');
      setCurrentStep(1);
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
          temperature: 0.0,
          evaluationEngine: 'Clinora_Eval_Engine_v1.2',
          harness: 'Clinora_Eval_Harness_2026',
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

  const toggleCompareRun = (runId: string) => {
    setSelectedRunIdsForCompare((prev) =>
      prev.includes(runId) ? prev.filter((id) => id !== runId) : prev.length < 5 ? [...prev, runId] : prev
    );
  };

  const runsToCompare = runs.filter((r) => selectedRunIdsForCompare.includes(r.id));
  const selectedDatasetVersion = options?.datasetVersions.find((d) => d.id === formDatasetVersionId);
  const selectedModel = options?.models.find((m) => m.id === formModelId);

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/60">
        <div>
          <div className="flex items-center gap-2">
            <BrainCircuit className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-semibold text-slate-100">AI Model Evaluation Framework</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Benchmark Clinora AI model versions or approved research models against authorized de-identified dataset versions.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {selectedRunIdsForCompare.length >= 2 && (
            <Button
              onClick={() => setIsCompareModalOpen(true)}
              variant="secondary"
              className="border-indigo-700 bg-indigo-950/40 text-indigo-300 hover:bg-indigo-900/50 text-xs py-1.5 px-3 h-auto"
            >
              <Scale className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
              Compare ({selectedRunIdsForCompare.length})
            </Button>
          )}

          {isApproved && (
            <Button
              onClick={openNewEvaluationModal}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs py-1.5 px-3 h-auto"
              id="new-ai-evaluation-btn"
            >
              <Play className="w-3.5 h-3.5 mr-1.5" />
              New Evaluation
            </Button>
          )}
        </div>
      </div>

      {/* Critical Governance Boundary Alert */}
      <div className="rounded-xl border border-amber-800/70 bg-amber-950/20 p-4 text-xs text-amber-200/90 space-y-1.5">
        <div className="flex items-center gap-2 font-semibold text-amber-300">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
          <span>Strict Model Governance Boundary (Safety Guardrail)</span>
        </div>
        <p className="text-[11px] text-amber-200/80 leading-relaxed pl-6">
          Research evaluation results are experimental research artifacts and{' '}
          <strong>cannot automatically promote or replace Clinora&apos;s production clinical AI</strong>. Production
          clinical deployment requires independent institutional and regulatory clearance.
        </p>
      </div>

      {/* Runs Table / Empty state */}
      {loading ? (
        <div className="py-12 flex items-center justify-center text-slate-400 text-xs gap-2">
          <LoaderCircle className="w-4 h-4 animate-spin text-indigo-400" />
          <span>Loading evaluation runs...</span>
        </div>
      ) : error ? (
        <div className="p-3.5 rounded-xl bg-red-950/30 border border-red-800 text-red-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <Button onClick={loadRuns} variant="secondary" className="text-xs py-1 px-2.5 h-auto">
            <RotateCw className="w-3.5 h-3.5 mr-1" />
            Retry
          </Button>
        </div>
      ) : runs.length === 0 ? (
        <div className="py-12 text-center border border-dashed border-slate-800 rounded-2xl p-6">
          <BrainCircuit className="w-9 h-9 mx-auto text-slate-600 mb-2" />
          <div className="text-xs font-semibold text-slate-300">No evaluation runs yet</div>
          <p className="text-[11px] text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
            Benchmark Clinora AI model versions or approved research models against authorized de-identified dataset
            versions to compute scientifically sound diagnostic metrics.
          </p>
          {isApproved && (
            <Button
              onClick={openNewEvaluationModal}
              className="mt-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs py-1.5 px-3 h-auto"
            >
              <Play className="w-3.5 h-3.5 mr-1.5" />
              Start First Evaluation
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-[11px] text-slate-400 flex items-center justify-between px-1">
            <span>Select up to 5 completed runs to compare performance metrics side-by-side.</span>
            <span>{runs.length} evaluation {runs.length === 1 ? 'run' : 'runs'}</span>
          </div>

          <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl divide-y divide-slate-800/60 overflow-hidden">
            {runs.map((run) => {
              const isSelected = selectedRunIdsForCompare.includes(run.id);
              return (
                <div
                  key={run.id}
                  className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
                    isSelected ? 'bg-indigo-950/20' : 'hover:bg-slate-900/40'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {run.status === 'COMPLETED' && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleCompareRun(run.id)}
                        className="mt-1 rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-0 cursor-pointer"
                        title="Select for comparison"
                      />
                    )}

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-200 font-mono">
                          {run.modelId}{' '}
                          <span className="text-indigo-400 text-xs font-normal">{run.modelVersion}</span>
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
                                : run.status === 'FAILED'
                                  ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                  : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {run.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-2 flex-wrap">
                        <span>
                          Ground truth: <strong className="text-slate-300">{run.groundTruthDefinition}</strong>
                        </span>
                        <span>•</span>
                        <span>{new Date(run.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Metrics Pills & View Button */}
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    {run.metrics && (
                      <div className="flex items-center gap-2 mr-2">
                        <div className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-center">
                          <div className="text-[9px] text-slate-400 uppercase font-semibold">Acc</div>
                          <div className="text-xs font-mono font-bold text-emerald-400">
                            {(run.metrics.accuracy * 100).toFixed(1)}%
                          </div>
                        </div>
                        <div className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-center">
                          <div className="text-[9px] text-slate-400 uppercase font-semibold">F1</div>
                          <div className="text-xs font-mono font-bold text-cyan-400">{run.metrics.f1.toFixed(3)}</div>
                        </div>
                        <div className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-center">
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
                      className="text-xs py-1.5 px-3 h-auto border border-slate-700 hover:border-slate-600"
                    >
                      Inspect Results
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── NEW EVALUATION RUN GUIDED MODAL (5 STEPS) ────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl">
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

            {/* Stepper Progress */}
            <div className="flex items-center justify-between text-[11px] font-medium text-slate-400 px-1">
              {[
                { step: 1, label: 'Dataset' },
                { step: 2, label: 'Task' },
                { step: 3, label: 'Model' },
                { step: 4, label: 'Ground Truth' },
                { step: 5, label: 'Review' },
              ].map((s) => (
                <div key={s.step} className="flex items-center gap-1.5">
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      currentStep === s.step
                        ? 'bg-indigo-600 text-white'
                        : currentStep > s.step
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {currentStep > s.step ? '✓' : s.step}
                  </span>
                  <span className={currentStep === s.step ? 'text-slate-200 font-semibold' : ''}>{s.label}</span>
                </div>
              ))}
            </div>

            {(formError || optionsError) && (
              <div className="p-3 rounded-lg bg-red-950/40 border border-red-800 text-red-300 flex items-center gap-2 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError || optionsError}</span>
              </div>
            )}

            {/* Step 1: Dataset Version */}
            {currentStep === 1 && (
              <div className="space-y-4 text-xs">
                <div>
                  <h4 className="font-semibold text-slate-200 text-sm">Step 1 — Select Authorized Dataset Version</h4>
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    Only immutable, de-identified dataset versions for which you hold an active DatasetAccessGrant are
                    available.
                  </p>
                </div>

                {loadingOptions ? (
                  <div className="py-8 flex items-center justify-center text-slate-400 gap-2">
                    <LoaderCircle className="w-4 h-4 animate-spin text-indigo-400" />
                    <span>Checking authorized dataset versions...</span>
                  </div>
                ) : !options || options.datasetVersions.length === 0 ? (
                  <div className="p-4 rounded-xl border border-amber-800/60 bg-amber-950/30 text-amber-300 space-y-2">
                    <div className="flex items-center gap-2 font-semibold">
                      <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                      <span>No Authorized Dataset Versions Available</span>
                    </div>
                    <p className="text-[11px] text-amber-200/80 leading-relaxed">
                      You do not have an active DatasetAccessGrant for any generated dataset in this project. Project
                      membership alone does not grant dataset access. A dataset must first be requested, approved, and
                      generated.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {options.datasetVersions.map((dv) => {
                      const isSelected = formDatasetVersionId === dv.id;
                      return (
                        <div
                          key={dv.id}
                          onClick={() => setFormDatasetVersionId(dv.id)}
                          className={`p-3 rounded-xl border cursor-pointer transition-all ${
                            isSelected
                              ? 'border-indigo-500 bg-indigo-950/30 shadow-sm'
                              : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-200 text-xs">{dv.datasetName}</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-cyan-300">
                              v{dv.versionNumber} ({dv.format})
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-400 font-mono">
                            <span>Records: {dv.recordCount}</span>
                            <span>•</span>
                            <span className="truncate max-w-[200px]" title={dv.checksum}>
                              SHA: {dv.checksum.substring(0, 16)}...
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Task Type */}
            {currentStep === 2 && (
              <div className="space-y-4 text-xs">
                <div>
                  <h4 className="font-semibold text-slate-200 text-sm">Step 2 — Select Evaluation Task</h4>
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    Scientific metrics are tailored to each task type. Fixed-threshold metrics are never labeled as
                    ROC-AUC.
                  </p>
                </div>

                <div className="space-y-2.5">
                  {(options?.taskTypes || []).map((t) => {
                    const isSelected = formTaskType === t.taskType;
                    return (
                      <div
                        key={t.taskType}
                        onClick={() => setFormTaskType(t.taskType)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-indigo-500 bg-indigo-950/30 shadow-sm'
                            : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-200 text-xs">{t.label}</span>
                          <span className="text-[10px] font-mono uppercase text-slate-400">{t.taskType}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">{t.description}</p>
                        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                          {t.primaryMetrics.map((m) => (
                            <span
                              key={m}
                              className="px-2 py-0.5 rounded text-[9px] font-semibold bg-slate-800 text-slate-300"
                            >
                              {m}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 3: Model */}
            {currentStep === 3 && (
              <div className="space-y-4 text-xs">
                <div>
                  <h4 className="font-semibold text-slate-200 text-sm">Step 3 — Select Clinora AI Model</h4>
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    Only authorized Clinora AI models and validated research configurations are supported.
                  </p>
                </div>

                <div className="space-y-2.5">
                  {(options?.models || []).map((m) => {
                    const isSelected = formModelId === m.id;
                    return (
                      <div
                        key={m.id}
                        onClick={() => handleModelChange(m.id)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-indigo-500 bg-indigo-950/30 shadow-sm'
                            : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                            <span className="font-semibold text-slate-200 text-xs">{m.name}</span>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono text-indigo-300 bg-indigo-950/40 border border-indigo-800/60">
                            {m.version}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">{m.description}</p>
                        <div className="mt-2 text-[10px] text-slate-500 font-mono">
                          Provider: {m.provider} • Prompt: {m.promptVersion}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 4: Ground Truth */}
            {currentStep === 4 && (
              <div className="space-y-4 text-xs">
                <div>
                  <h4 className="font-semibold text-slate-200 text-sm">Step 4 — Ground Truth Definition</h4>
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    Ground truth defines what this evaluation considers correct. Raw OCR values must never become ground
                    truth.
                  </p>
                </div>

                <div className="space-y-2.5">
                  {(options?.groundTruthDefinitions || []).map((gt) => {
                    const isSelected = formGroundTruth === gt.code;
                    return (
                      <div
                        key={gt.code}
                        onClick={() => setFormGroundTruth(gt.code)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-indigo-500 bg-indigo-950/30 shadow-sm'
                            : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                        }`}
                      >
                        <div className="font-semibold text-slate-200 text-xs">{gt.label}</div>
                        <p className="text-[11px] text-slate-400 mt-1">{gt.description}</p>
                        <div className="mt-1.5 text-[10px] font-mono text-cyan-400/80">{gt.code}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 5: Review & Start */}
            {currentStep === 5 && (
              <div className="space-y-4 text-xs">
                <div>
                  <h4 className="font-semibold text-slate-200 text-sm">Step 5 — Review Benchmark Configuration</h4>
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    Verify experiment parameters before execution. Evaluation runs are immutable upon completion.
                  </p>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3 font-mono text-xs">
                  <div className="flex justify-between border-b border-slate-900 pb-2">
                    <span className="text-slate-400 font-sans">Dataset:</span>
                    <span className="text-slate-200">
                      {selectedDatasetVersion?.datasetName || 'Selected Dataset'} (v
                      {selectedDatasetVersion?.versionNumber})
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-900 pb-2">
                    <span className="text-slate-400 font-sans">Eligible Records:</span>
                    <span className="text-cyan-300">{selectedDatasetVersion?.recordCount || 0} samples</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-900 pb-2">
                    <span className="text-slate-400 font-sans">AI Model:</span>
                    <span className="text-indigo-300">
                      {selectedModel?.name || formModelId} ({formModelVersion})
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-900 pb-2">
                    <span className="text-slate-400 font-sans">Task Type:</span>
                    <span className="text-purple-300">{formTaskType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-sans">Ground Truth:</span>
                    <span className="text-emerald-300 truncate max-w-[220px]" title={formGroundTruth}>
                      {formGroundTruth}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                  <div className="font-semibold text-slate-300">Security &amp; Reproducibility Guarantee:</div>
                  <p>
                    Dataset SHA checksum and model configurations are immutably persisted alongside computed metrics. No
                    identifiable patient data is exposed or stored in this evaluation run.
                  </p>
                </div>
              </div>
            )}

            {/* Stepper Navigation Buttons */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              {currentStep > 1 ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setCurrentStep((prev) => (Math.max(1, prev - 1) as 1 | 2 | 3 | 4 | 5))}
                  className="text-xs py-1.5 px-3 h-auto"
                >
                  Back
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsModalOpen(false)}
                  className="text-xs py-1.5 px-3 h-auto"
                >
                  Cancel
                </Button>
              )}

              {currentStep < 5 ? (
                <Button
                  type="button"
                  onClick={() => {
                    if (currentStep === 1 && !formDatasetVersionId) {
                      setFormError('Please select a dataset version.');
                      return;
                    }
                    setFormError('');
                    setCurrentStep((prev) => (Math.min(5, prev + 1) as 1 | 2 | 3 | 4 | 5));
                  }}
                  disabled={currentStep === 1 && (!options || options.datasetVersions.length === 0)}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs py-1.5 px-3 h-auto"
                >
                  Next
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleStartRun}
                  disabled={submitting}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs py-1.5 px-3 h-auto"
                  id="execute-benchmark-btn"
                >
                  {submitting ? (
                    <>
                      <LoaderCircle className="w-3.5 h-3.5 animate-spin mr-1.5" />
                      Evaluating...
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 mr-1.5" />
                      Start Evaluation
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── DETAILED INSPECTION DRAWER/MODAL (PHASE E5) ───────────────────────── */}
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
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                      selectedRun.status === 'COMPLETED'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : selectedRun.status === 'RUNNING'
                          ? 'bg-amber-950 text-amber-300 border border-amber-800'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {selectedRun.status}
                  </span>
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
                      <div className="text-[10px] text-slate-400 font-semibold uppercase">Recall (Sensitivity)</div>
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
                      <div className="text-[10px] text-slate-400 font-semibold uppercase">
                        False Positive Rate (FPR)
                      </div>
                      <div className="text-base font-mono font-bold text-rose-400 mt-1">
                        {(selectedRun.metrics.falsePositiveRate * 100).toFixed(2)}%
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                      <div className="text-[10px] text-slate-400 font-semibold uppercase">
                        False Negative Rate (FNR)
                      </div>
                      <div className="text-base font-mono font-bold text-rose-400 mt-1">
                        {(selectedRun.metrics.falseNegativeRate * 100).toFixed(2)}%
                      </div>
                    </div>
                  </div>

                  {/* Task-Specific Extraction Metrics if present */}
                  {selectedRun.metrics.exactMatchRate !== undefined && (
                    <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-slate-800/60">
                      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                        <div className="text-[10px] text-slate-400 font-semibold uppercase">Exact Match Rate</div>
                        <div className="text-base font-mono font-bold text-cyan-400 mt-1">
                          {(selectedRun.metrics.exactMatchRate * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                        <div className="text-[10px] text-slate-400 font-semibold uppercase">Tolerance Match Rate</div>
                        <div className="text-base font-mono font-bold text-emerald-400 mt-1">
                          {((selectedRun.metrics.toleranceMatchRate ?? 0) * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                        <div className="text-[10px] text-slate-400 font-semibold uppercase">Mean Absolute Error</div>
                        <div className="text-base font-mono font-bold text-amber-400 mt-1">
                          {selectedRun.metrics.meanAbsoluteError ?? 0}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2x2 Confusion Matrix Visualization */}
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                    2x2 Diagnostic Confusion Matrix
                  </h4>
                  <div className="grid grid-cols-2 gap-3 font-mono text-center">
                    <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-800/40">
                      <div className="text-[10px] text-emerald-400 uppercase font-bold">True Positive (TP)</div>
                      <div className="text-xl font-bold text-emerald-300 mt-1">
                        {selectedRun.metrics.confusionMatrix.truePositives}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-800/40">
                      <div className="text-[10px] text-amber-400 uppercase font-bold">False Positive (FP)</div>
                      <div className="text-xl font-bold text-amber-300 mt-1">
                        {selectedRun.metrics.confusionMatrix.falsePositives}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-800/40">
                      <div className="text-[10px] text-rose-400 uppercase font-bold">False Negative (FN)</div>
                      <div className="text-xl font-bold text-rose-300 mt-1">
                        {selectedRun.metrics.confusionMatrix.falseNegatives}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60">
                      <div className="text-[10px] text-slate-300 uppercase font-bold">True Negative (TN)</div>
                      <div className="text-xl font-bold text-slate-200 mt-1">
                        {selectedRun.metrics.confusionMatrix.trueNegatives}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Provenance Details */}
                <div className="space-y-2 pt-2 border-t border-slate-800 text-xs">
                  <h4 className="font-semibold uppercase tracking-wider text-slate-400 text-[11px]">
                    Experiment Provenance &amp; Audit Metadata
                  </h4>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 font-mono text-[11px] space-y-2 text-slate-400">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Evaluation Run ID:</span>
                      <span className="text-slate-200">{selectedRun.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Target Dataset Version:</span>
                      <span className="text-slate-200">{selectedRun.datasetVersionId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Ground Truth Definition:</span>
                      <span className="text-slate-200">{selectedRun.groundTruthDefinition}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Execution Timestamps:</span>
                      <span className="text-slate-200">
                        {selectedRun.startedAt ? new Date(selectedRun.startedAt).toLocaleTimeString() : 'N/A'} →{' '}
                        {selectedRun.completedAt ? new Date(selectedRun.completedAt).toLocaleTimeString() : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Collaboration Citation CTA */}
                <div className="pt-2 flex items-center justify-between">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      const summary = `AI Evaluation [${selectedRun.modelId} ${selectedRun.modelVersion}] Acc: ${(selectedRun.metrics!.accuracy * 100).toFixed(1)}%, Bal.Acc: ${(selectedRun.metrics!.balancedAccuracy ?? 0).toFixed(3)}, F1: ${selectedRun.metrics!.f1.toFixed(3)} (Run: ${selectedRun.id})`;
                      copyToClipboard(summary, selectedRun.id);
                    }}
                    className="text-xs py-1.5 px-3 h-auto"
                  >
                    {copiedId === selectedRun.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                        Copied to Clipboard!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 mr-1" />
                        Copy Summary for Research Notes
                      </>
                    )}
                  </Button>

                  <Button
                    variant="secondary"
                    onClick={() => setSelectedRun(null)}
                    className="text-xs py-1.5 px-3 h-auto"
                  >
                    Close
                  </Button>
                </div>
              </div>
            ) : selectedRun.failureReason ? (
              <div className="p-4 rounded-xl bg-red-950/40 border border-red-800 text-red-300 text-xs space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" />
                  <span>Evaluation Run Failed</span>
                </div>
                <p className="text-[11px] text-red-200/80 font-mono mt-1">{selectedRun.failureReason}</p>
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs">
                <LoaderCircle className="w-5 h-5 animate-spin mx-auto text-indigo-400 mb-2" />
                <span>Evaluation calculation in progress...</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── COMPARE RUNS MODAL (PHASE E6) ────────────────────────────────────── */}
      {isCompareModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-slate-100">
                  Model Evaluation Comparison ({runsToCompare.length} Runs)
                </h3>
              </div>
              <button
                onClick={() => setIsCompareModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-400">
              Comparing performance metrics across evaluated model versions. Only real backend metrics are shown.
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-900/80 border-b border-slate-800 text-[10px] text-slate-400 uppercase font-sans">
                  <tr>
                    <th className="p-3">Model</th>
                    <th className="p-3">Task</th>
                    <th className="p-3">Dataset Version</th>
                    <th className="p-3 text-right">Accuracy</th>
                    <th className="p-3 text-right">Precision</th>
                    <th className="p-3 text-right">Recall</th>
                    <th className="p-3 text-right">F1-Score</th>
                    <th className="p-3 text-right">Bal. Acc</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {runsToCompare.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-900/40">
                      <td className="p-3 font-semibold text-slate-100">
                        {r.modelId} <span className="text-indigo-400 text-[10px] font-normal">{r.modelVersion}</span>
                      </td>
                      <td className="p-3 font-sans uppercase text-[10px] text-slate-400">{r.taskType}</td>
                      <td className="p-3 text-[10px] text-slate-400 truncate max-w-[120px]" title={r.datasetVersionId}>
                        {r.datasetVersionId.substring(0, 8)}...
                      </td>
                      <td className="p-3 text-right font-bold text-emerald-400">
                        {r.metrics ? (r.metrics.accuracy * 100).toFixed(1) + '%' : '-'}
                      </td>
                      <td className="p-3 text-right text-cyan-400">
                        {r.metrics ? (r.metrics.precision * 100).toFixed(1) + '%' : '-'}
                      </td>
                      <td className="p-3 text-right text-indigo-400">
                        {r.metrics ? (r.metrics.recall * 100).toFixed(1) + '%' : '-'}
                      </td>
                      <td className="p-3 text-right text-amber-400">
                        {r.metrics ? r.metrics.f1.toFixed(3) : '-'}
                      </td>
                      <td className="p-3 text-right text-purple-400 font-bold">
                        {r.metrics ? (r.metrics.balancedAccuracy ?? r.metrics.rocAuc ?? 0).toFixed(3) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end">
              <Button
                variant="secondary"
                onClick={() => setIsCompareModalOpen(false)}
                className="text-xs py-1.5 px-4 h-auto"
              >
                Close Comparison
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
