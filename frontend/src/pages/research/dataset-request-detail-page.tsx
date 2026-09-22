import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  Database,
  Download,
  Info,
  Layers,
  LoaderCircle,
  Lock,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Button } from '../../components/ui/button';
import { apiErrorMessage } from '../../features/auth/auth-api';
import { researchApi } from '../../features/research/research-api';
import { ResearchStatusBadge } from '../../features/research/research-status-badge';
import type {
  DatasetGenerationJob,
  DatasetRequest,
  DatasetVersion,
  ResearchDataset,
} from '../../features/research/research-types';

export function DatasetRequestDetailPage() {
  const { requestId } = useParams<{ requestId: string }>();

  const [request, setRequest] = useState<DatasetRequest | null>(null);
  const [dataset, setDataset] = useState<ResearchDataset | null>(null);
  const [versions, setVersions] = useState<DatasetVersion[]>([]);
  const [latestJob, setLatestJob] = useState<DatasetGenerationJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [downloadingVersion, setDownloadingVersion] = useState<number | null>(null);
  const [copiedChecksum, setCopiedChecksum] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  const loadDatasetAndJobs = useCallback(async (reqId: string) => {
    try {
      const [job, ds] = await Promise.all([
        researchApi.getLatestGenerationJob(reqId).catch(() => null),
        researchApi.getDatasetByRequest(reqId).catch(() => null),
      ]);
      setLatestJob(job);
      if (ds) {
        setDataset(ds);
        const vList = await researchApi.listDatasetVersions(ds.id).catch(() => []);
        setVersions(vList);
      }
    } catch (e) {
      console.error('Error loading dataset/job info', e);
    }
  }, []);

  const loadData = useCallback(async () => {
    if (!requestId) return;
    setLoading(true);
    setError('');
    setPermissionDenied(false);
    try {
      const data = await researchApi.getDatasetRequest(requestId);
      setRequest(data);
      if (data.status === 'APPROVED') {
        await loadDatasetAndJobs(requestId);
      }
    } catch (err: unknown) {
      if ((err as { response?: { status?: number } })?.response?.status === 403) {
        setPermissionDenied(true);
      } else {
        setError(apiErrorMessage(err, 'Failed to load dataset request details.'));
      }
    } finally {
      setLoading(false);
    }
  }, [requestId, loadDatasetAndJobs]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Polling for active background generation job
  useEffect(() => {
    if (!latestJob || (latestJob.status !== 'PENDING' && latestJob.status !== 'PROCESSING')) {
      return;
    }
    const timer = setInterval(async () => {
      if (!requestId) return;
      try {
        const job = await researchApi.getLatestGenerationJob(requestId);
        setLatestJob(job);
        if (job && (job.status === 'SUCCEEDED' || job.status === 'FAILED')) {
          setGenerating(false);
          await loadDatasetAndJobs(requestId);
        }
      } catch (err) {
        console.error('Polling generation job error', err);
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [latestJob, requestId, loadDatasetAndJobs]);

  const handleGenerate = async () => {
    if (!requestId) return;
    setGenerating(true);
    setError('');
    setActionSuccess('');
    try {
      const job = await researchApi.triggerGeneration(requestId);
      setLatestJob(job);
      setActionSuccess('De-identification pipeline started. Dataset generation job queued.');
    } catch (err: unknown) {
      setError(apiErrorMessage(err, 'Failed to trigger dataset generation.'));
      setGenerating(false);
    }
  };

  const handleDownload = async (version: DatasetVersion) => {
    if (!dataset) return;
    setDownloadingVersion(version.versionNumber);
    setError('');
    try {
      const res = await researchApi.downloadDatasetVersion(dataset.id, version.versionNumber);
      const blob = new Blob([res.data], {
        type: version.format === 'CSV' ? 'text/csv' : 'application/json',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = version.format === 'CSV' ? 'csv' : 'json';
      const cleanName = dataset.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
      a.download = `${cleanName}_v${version.versionNumber}.${ext}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: unknown) {
      setError(apiErrorMessage(err, 'Failed to download dataset version.'));
    } finally {
      setDownloadingVersion(null);
    }
  };

  const handleCopyChecksum = (checksum: string) => {
    navigator.clipboard.writeText(checksum);
    setCopiedChecksum(checksum);
    setTimeout(() => setCopiedChecksum(null), 2500);
  };

  const handleSubmit = async () => {
    if (!requestId || !window.confirm('Submit this dataset request for administrative governance review?')) return;
    setActionLoading(true);
    setError('');
    setActionSuccess('');
    try {
      const updated = await researchApi.submitDatasetRequest(requestId);
      setRequest(updated);
      setActionSuccess('Dataset request submitted successfully for governance review.');
    } catch (err: unknown) {
      setError(apiErrorMessage(err, 'Failed to submit dataset request.'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!requestId || !window.confirm('Cancel this dataset request?')) return;
    setActionLoading(true);
    setError('');
    setActionSuccess('');
    try {
      const updated = await researchApi.cancelDatasetRequest(requestId);
      setRequest(updated);
      setActionSuccess('Dataset request cancelled.');
    } catch (err: unknown) {
      setError(apiErrorMessage(err, 'Failed to cancel dataset request.'));
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex items-center justify-center text-slate-400 gap-3">
        <LoaderCircle className="w-6 h-6 animate-spin text-cyan-400" />
        <span>Loading dataset request details...</span>
      </div>
    );
  }

  if (permissionDenied) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-5 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
          <ShieldAlert className="w-8 h-8 text-rose-400" />
        </div>
        <div>
          <div className="text-base font-semibold text-slate-200">Access Denied</div>
          <div className="text-sm text-slate-400 mt-1 max-w-xs">
            You do not have permission to view this dataset request. It may belong to a different researcher.
          </div>
        </div>
        <Link to="/research">
          <Button variant="secondary">Back to Workspace</Button>
        </Link>
      </div>
    );
  }

  if (!loading && error && !request) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-5 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-rose-400" />
        </div>
        <div>
          <div className="text-base font-semibold text-slate-200">Failed to Load Request</div>
          <div className="text-sm text-slate-400 mt-1 max-w-xs">{error}</div>
        </div>
        <button
          onClick={loadData}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="py-20 text-center space-y-4">
        <AlertCircle className="w-10 h-10 mx-auto text-rose-400" />
        <div className="text-base font-medium text-slate-200">Dataset Request Not Found</div>
        <Link to="/research">
          <Button variant="secondary">Back to Workspace</Button>
        </Link>
      </div>
    );
  }

  let parsedVariables: string[] = [];
  try {
    parsedVariables = JSON.parse(request.requestedVariables || '[]');
  } catch {
    parsedVariables = [];
  }

  let parsedPopulation: Record<string, string | number | undefined> = {};
  try {
    parsedPopulation = JSON.parse(request.requestedPopulation || '{}');
  } catch {
    parsedPopulation = {};
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-6 border-b border-slate-800">
        <div className="flex items-start gap-3.5">
          <Link
            to={`/research/projects/${request.projectId}`}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 mt-1"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-mono uppercase tracking-wider text-indigo-400 font-semibold">
                Dataset Governance Request
              </span>
              <ResearchStatusBadge status={request.status} />
              <span className="text-xs text-slate-400 font-mono bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                Format: {request.requestedFormat}
              </span>
            </div>
            <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-slate-100">{request.name}</h1>
            <p className="mt-1 text-xs text-slate-400">
              Created {new Date(request.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2.5 shrink-0">
          {request.submittable ? (
            <Button
              onClick={handleSubmit}
              disabled={actionLoading}
              className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs shadow-md shadow-cyan-500/20"
            >
              <Send className="w-3.5 h-3.5 mr-1.5" />
              Submit for Review
            </Button>
          ) : null}

          {request.cancellable ? (
            <Button
              onClick={handleCancel}
              disabled={actionLoading}
              variant="secondary"
              className="text-xs text-rose-300 border-rose-800/60 hover:bg-rose-950/30"
            >
              <XCircle className="w-3.5 h-3.5 mr-1.5" />
              Cancel Request
            </Button>
          ) : null}
        </div>
      </div>

      {actionSuccess ? (
        <div className="p-4 rounded-xl border border-emerald-800/60 bg-emerald-950/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      ) : null}

      {error ? (
        <div className="p-4 rounded-xl border border-rose-800/60 bg-rose-950/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {/* Decision feedback banners */}
      {request.status === 'MORE_INFO_REQUIRED' ? (
        <div className="p-4 rounded-xl border border-amber-800/80 bg-amber-950/30 text-amber-200 text-xs space-y-1">
          <div className="font-semibold flex items-center gap-2 text-amber-300">
            <Info className="w-4 h-4" />
            Reviewer Requested Additional Information
          </div>
          <p className="text-amber-200/90 pl-6">{request.reviewNotes}</p>
        </div>
      ) : null}

      {request.status === 'REJECTED' ? (
        <div className="p-4 rounded-xl border border-rose-800/80 bg-rose-950/30 text-rose-200 text-xs space-y-1">
          <div className="font-semibold flex items-center gap-2 text-rose-300">
            <ShieldAlert className="w-4 h-4" />
            Dataset Request Rejected
          </div>
          <p className="text-rose-200/90 pl-6">{request.reviewNotes}</p>
        </div>
      ) : null}

      {request.status === 'APPROVED' ? (
        <div className="p-5 rounded-2xl border border-emerald-800/80 bg-emerald-950/30 text-emerald-200 text-xs space-y-2">
          <div className="font-semibold text-emerald-300 flex items-center gap-2 text-sm">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Dataset Extraction Request Approved
          </div>
          <p className="text-slate-300">
            {request.reviewNotes || 'Approved by system administrator for clinical observation snapshot generation.'}
          </p>
          <div className="pt-2 text-[11px] text-emerald-400/90 font-mono">
            {request.expiresAt
              ? `Governance validity expires: ${new Date(request.expiresAt).toLocaleDateString()}`
              : 'Governance approval granted (Standard Protocol)'}
          </div>
        </div>
      ) : null}

      {/* Active Generation Job Banner */}
      {latestJob && (latestJob.status === 'PENDING' || latestJob.status === 'PROCESSING') ? (
        <div className="p-5 rounded-2xl border border-cyan-800/80 bg-cyan-950/40 text-cyan-200 text-xs space-y-3 animate-pulse">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 font-semibold text-cyan-300 text-sm">
              <LoaderCircle className="w-4 h-4 animate-spin text-cyan-400" />
              <span>De-identification Pipeline In Progress</span>
            </div>
            <span className="font-mono text-[11px] bg-cyan-900/60 px-2 py-0.5 rounded text-cyan-300 border border-cyan-700">
              {latestJob.status}
            </span>
          </div>
          <p className="text-slate-300">
            Applying 5-year age bands, generating project-scoped pseudonyms via HMAC-SHA256, generalizing observation dates to Year-Quarter, and enforcing minimum cohort size protection (&ge; 5). Your dataset version will appear below once complete.
          </p>
          <div className="text-[11px] text-cyan-400/80 font-mono">
            Job ID: {latestJob.id} &bull; Started: {new Date(latestJob.startedAt || latestJob.createdAt).toLocaleTimeString()}
          </div>
        </div>
      ) : null}

      {/* Generation Failed Banner */}
      {latestJob && latestJob.status === 'FAILED' ? (
        <div className="p-5 rounded-2xl border border-rose-800/80 bg-rose-950/40 text-rose-200 text-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 font-semibold text-rose-300 text-sm">
              <AlertCircle className="w-4 h-4 text-rose-400" />
              <span>Dataset Generation Failed</span>
            </div>
            <Button
              onClick={handleGenerate}
              disabled={generating}
              size="sm"
              className="bg-rose-600 hover:bg-rose-500 text-white text-xs h-7"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Retry Generation
            </Button>
          </div>
          <p className="text-slate-300 font-mono text-[11px] bg-slate-950 p-2.5 rounded border border-rose-900/60">
            {latestJob.failureReason || 'An error occurred during de-identification transformation.'}
          </p>
        </div>
      ) : null}

      {/* Generated Dataset Section (When Request is Approved) */}
      {request.status === 'APPROVED' ? (
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/80 p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-indigo-400" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200">
                  De-identified Research Dataset
                </h2>
                {dataset ? (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/80 font-semibold">
                    {dataset.status}
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Immutable, project-scoped data snapshots verified through the privacy-preserving de-identification pipeline.
              </p>
            </div>

            {(!latestJob || latestJob.status === 'SUCCEEDED' || latestJob.status === 'FAILED') ? (
              <Button
                onClick={handleGenerate}
                disabled={generating}
                className="bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-400 hover:to-cyan-400 text-slate-950 font-semibold text-xs shadow-md shadow-cyan-500/20 shrink-0"
              >
                {generating ? (
                  <>
                    <LoaderCircle className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Starting Pipeline...
                  </>
                ) : dataset && versions.length > 0 ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                    Generate New Snapshot
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                    Generate Dataset Snapshot
                  </>
                )}
              </Button>
            ) : null}
          </div>

          {versions.length === 0 && (!latestJob || (latestJob.status !== 'PENDING' && latestJob.status !== 'PROCESSING')) ? (
            <div className="py-8 text-center space-y-3">
              <Layers className="w-8 h-8 mx-auto text-slate-500" />
              <div className="text-xs text-slate-300 font-medium">No Dataset Versions Generated Yet</div>
              <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                Click &ldquo;Generate Dataset Snapshot&rdquo; to initiate the pipeline. Direct identifiers will be removed, high-risk quasi-identifiers will be generalized, and project-scoped pseudonyms will be assigned.
              </p>
            </div>
          ) : null}

          {versions.length > 0 ? (
            <div className="space-y-3">
              <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <span>Version History ({versions.length})</span>
              </div>
              <div className="space-y-3">
                {versions.map((v) => (
                  <div
                    key={v.id}
                    className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-mono text-sm font-bold text-slate-100">
                          Version {v.versionNumber}
                        </span>
                        {v.immutable ? (
                          <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                            <Lock className="w-3 h-3" />
                            Immutable
                          </span>
                        ) : null}
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800">
                          {v.format}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                          {v.deidentificationProfileVersion}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap">
                        <span>
                          <strong className="text-slate-200 font-mono">{v.recordCount.toLocaleString()}</strong> eligible observations
                        </span>
                        <span>&bull;</span>
                        <span>Generated {new Date(v.generatedAt).toLocaleDateString()} at {new Date(v.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>

                      <div className="flex items-center gap-2 pt-1 text-[11px] font-mono text-slate-400">
                        <span className="text-slate-400">SHA-256:</span>
                        <code className="bg-slate-900 px-2 py-0.5 rounded text-cyan-300 border border-slate-800 truncate max-w-[240px] sm:max-w-xs">
                          {v.checksum}
                        </code>
                        <button
                          onClick={() => handleCopyChecksum(v.checksum)}
                          title="Copy SHA-256 Checksum"
                          className="p-1 hover:text-slate-200 text-slate-400 transition"
                        >
                          {copiedChecksum === v.checksum ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <Button
                        onClick={() => handleDownload(v)}
                        disabled={downloadingVersion === v.versionNumber}
                        size="sm"
                        className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs shadow-md shadow-cyan-500/20"
                      >
                        {downloadingVersion === v.versionNumber ? (
                          <>
                            <LoaderCircle className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                            Authorizing Export...
                          </>
                        ) : (
                          <>
                            <Download className="w-3.5 h-3.5 mr-1.5" />
                            Download {v.format}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Research Purpose */}
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Purpose &amp; Scientific Justification
            </h2>
            <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-line">
              {request.purpose}
            </p>
          </div>

          {/* Requested Variables */}
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Requested Clinical Observation Variables
              </h2>
              <span className="text-xs text-cyan-400 font-mono">
                {parsedVariables.length} variables
              </span>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {parsedVariables.map((v) => (
                <span
                  key={v}
                  className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-cyan-300"
                >
                  {v}
                </span>
              ))}
            </div>
          </div>

          {/* Population Criteria */}
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Population &amp; Cohort Filters
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-slate-400 text-[11px]">Age Range</div>
                <div className="mt-1 font-mono text-slate-200 font-semibold">
                  {parsedPopulation.minAge ?? 'N/A'} – {parsedPopulation.maxAge ?? 'N/A'} yrs
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-slate-400 text-[11px]">Diagnostic Filter</div>
                <div className="mt-1 font-mono text-slate-200 font-semibold truncate">
                  {parsedPopulation.conditionFilter ?? 'General / None'}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-slate-400 text-[11px]">Requested Format</div>
                <div className="mt-1 font-mono text-indigo-300 font-semibold">
                  {request.requestedFormat}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Timeline & Privacy Guarantees */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 text-xs space-y-4">
            <h3 className="font-semibold uppercase tracking-wider text-[11px] text-slate-400">
              Governance Timestamps
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Created:</span>
                <span className="font-mono text-slate-200">
                  {new Date(request.createdAt).toLocaleDateString()}
                </span>
              </div>
              {request.submittedAt ? (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Submitted:</span>
                  <span className="font-mono text-slate-200">
                    {new Date(request.submittedAt).toLocaleDateString()}
                  </span>
                </div>
              ) : null}
              {request.reviewedAt ? (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Reviewed:</span>
                  <span className="font-mono text-slate-200">
                    {new Date(request.reviewedAt).toLocaleDateString()}
                  </span>
                </div>
              ) : null}
              {request.approvedAt ? (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Approved:</span>
                  <span className="font-mono text-emerald-400">
                    {new Date(request.approvedAt).toLocaleDateString()}
                  </span>
                </div>
              ) : null}
              {request.expiresAt ? (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Expires:</span>
                  <span className="font-mono text-amber-400">
                    {new Date(request.expiresAt).toLocaleDateString()}
                  </span>
                </div>
              ) : null}
            </div>
          </div>

          {/* Privacy & Governance Policy */}
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-5 text-xs space-y-3">
            <div className="flex items-center gap-2 text-indigo-300 font-semibold uppercase tracking-wider text-[11px]">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              <span>De-identification Guarantees</span>
            </div>
            <ul className="space-y-2 text-slate-300 text-[11px] leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">&check;</span>
                <span><strong>Direct Identifiers Removed:</strong> Names, phones, emails, national IDs, and exact birthdates are permanently excluded.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">&check;</span>
                <span><strong>Quasi-Identifiers Generalized:</strong> 5-year age bands (top-coded at 85+) and Year-Quarter observation dates.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">&check;</span>
                <span><strong>Project-Scoped HMAC:</strong> Pseudonyms prevent longitudinal cross-project correlation attacks.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">&check;</span>
                <span><strong>Privacy Checks:</strong> Strict minimum cohort size validation (&ge; 5 subjects) before release.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">&check;</span>
                <span><strong>Private Storage:</strong> Stored in private MinIO buckets with short-lived, audited signed downloads.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
