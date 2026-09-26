import {
  AlertCircle,
  Archive,
  ArrowLeft,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  Database,
  Edit3,
  History,
  Info,
  LoaderCircle,
  Lock,
  Plus,
  Send,
  ShieldAlert,
  ShieldCheck,
  Undo2,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Button } from '../../components/ui/button';
import { apiErrorMessage } from '../../features/auth/auth-api';
import { useAuthStore } from '../../features/auth/auth-store';
import { researchApi } from '../../features/research/research-api';
import { ResearchStatusBadge } from '../../features/research/research-status-badge';
import type { DatasetRequest, ResearchProject } from '../../features/research/research-types';
import { AIEvaluationSection } from './ai-evaluation-section';
import { ProjectCollaboratorsSection } from './project-collaborators-section';
import { ProjectPublicationsSection } from './project-publications-section';
import { ProjectAuditTrailSection } from './project-audit-trail-section';

export function ResearchProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const user = useAuthStore((state) => state.user);

  const [project, setProject] = useState<ResearchProject | null>(null);
  const [datasetRequests, setDatasetRequests] = useState<DatasetRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'collaborators' | 'evaluations' | 'publications' | 'audit'>(
    'overview',
  );

  const loadData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError('');
    try {
      const proj = await researchApi.getProject(projectId);
      setProject(proj);

      try {
        const reqs = await researchApi.listDatasetRequests(projectId, { size: 50 });
        setDatasetRequests(reqs.items);
      } catch {
        // dataset request endpoint could be empty or not yet requested
      }
    } catch (err: unknown) {
      setError(apiErrorMessage(err, 'Failed to load project details.'));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async () => {
    if (
      !projectId ||
      !window.confirm(
        'Submit this research project for administrative review? Editing will be locked until review is complete.',
      )
    )
      return;
    setActionLoading(true);
    setError('');
    setActionSuccess('');
    try {
      const updated = await researchApi.submitProject(projectId);
      setProject(updated);
      setActionSuccess('Project submitted successfully for administrative review.');
    } catch (err: unknown) {
      setError(apiErrorMessage(err, 'Failed to submit project.'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!projectId || !window.confirm('Withdraw this submitted project from administrative review?')) return;
    setActionLoading(true);
    setError('');
    setActionSuccess('');
    try {
      const updated = await researchApi.withdrawProject(projectId);
      setProject(updated);
      setActionSuccess('Project withdrawn.');
    } catch (err: unknown) {
      setError(apiErrorMessage(err, 'Failed to withdraw project.'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleArchive = async () => {
    if (!projectId || !window.confirm('Archive this research project?')) return;
    setActionLoading(true);
    setError('');
    setActionSuccess('');
    try {
      const updated = await researchApi.archiveProject(projectId);
      setProject(updated);
      setActionSuccess('Project archived.');
    } catch (err: unknown) {
      setError(apiErrorMessage(err, 'Failed to archive project.'));
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex items-center justify-center text-slate-400 gap-3">
        <LoaderCircle className="w-6 h-6 animate-spin text-cyan-400" />
        <span>Loading project details...</span>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="py-20 text-center space-y-4">
        <AlertCircle className="w-10 h-10 mx-auto text-rose-400" />
        <div className="text-base font-medium text-slate-200">Project Not Found</div>
        <Link to="/research/projects">
          <Button variant="secondary">Back to Projects</Button>
        </Link>
      </div>
    );
  }

  const isApprovedOrActive = project.status === 'APPROVED' || project.status === 'ACTIVE';
  const isOwner = user?.id === project.ownerUserId;
  const ownerDisplayName = isOwner && user
    ? `${user.firstName} ${user.lastName}`.trim()
    : 'Project Owner';

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Header & Navigation */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-6 border-b border-slate-800">
        <div className="flex items-start gap-3.5">
          <Link
            to="/research/projects"
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 mt-1"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-mono uppercase tracking-wider text-cyan-400 font-semibold">
                {project.researchField}
              </span>
              <ResearchStatusBadge status={project.status} />
              {project.ethicsReference ? (
                <span className="text-xs text-slate-400 font-mono bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                  {project.ethicsReference}
                </span>
              ) : null}
            </div>
            <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-slate-100">{project.title}</h1>
            <p className="mt-1 text-xs text-slate-400">
              Created {new Date(project.createdAt).toLocaleDateString()}
              {project.institutionName ? ` • ${project.institutionName}` : ''}
            </p>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {project.editable ? (
            <Link to={`/research/projects/${project.id}/edit`}>
              <Button variant="secondary" className="text-xs">
                <Edit3 className="w-3.5 h-3.5 mr-1" />
                Edit Protocol
              </Button>
            </Link>
          ) : null}

          {project.submittable ? (
            <Button
              onClick={handleSubmit}
              disabled={actionLoading}
              className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs shadow-md shadow-cyan-500/20"
            >
              <Send className="w-3.5 h-3.5 mr-1.5" />
              Submit for Review
            </Button>
          ) : null}

          {project.withdrawable ? (
            <Button
              onClick={handleWithdraw}
              disabled={actionLoading}
              variant="secondary"
              className="text-xs text-amber-300 border-amber-800/60 hover:bg-amber-950/30"
            >
              <Undo2 className="w-3.5 h-3.5 mr-1.5" />
              Withdraw
            </Button>
          ) : null}

          {project.status !== 'ARCHIVED' && project.status !== 'SUBMITTED' && project.status !== 'UNDER_REVIEW' ? (
            <Button
              onClick={handleArchive}
              disabled={actionLoading}
              variant="ghost"
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              <Archive className="w-3.5 h-3.5 mr-1.5" />
              Archive
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

      {/* Review Information Note Banner */}
      {project.status === 'MORE_INFO_REQUIRED' ? (
        <div className="p-4 rounded-xl border border-amber-800/80 bg-amber-950/30 text-amber-200 text-xs space-y-1">
          <div className="font-semibold flex items-center gap-2 text-amber-300">
            <Info className="w-4 h-4" />
            Administrator Feedback: Action Required
          </div>
          <p className="text-amber-200/90 pl-6">{project.reviewDecisionReason}</p>
        </div>
      ) : null}

      {project.status === 'REJECTED' ? (
        <div className="p-4 rounded-xl border border-rose-800/80 bg-rose-950/30 text-rose-200 text-xs space-y-1">
          <div className="font-semibold flex items-center gap-2 text-rose-300">
            <ShieldAlert className="w-4 h-4" />
            Project Review Finalized: Rejected
          </div>
          <p className="text-rose-200/90 pl-6">{project.reviewDecisionReason}</p>
        </div>
      ) : null}

      {project.status === 'APPROVED' ? (
        <div className="p-4 rounded-xl border border-emerald-800/80 bg-emerald-950/30 text-emerald-200 text-xs flex items-center gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <div>
            <span className="font-semibold text-emerald-300">Governance Approved:</span>{' '}
            {project.reviewDecisionReason || 'Project protocol verified and approved by system administrator.'}
          </div>
        </div>
      ) : null}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800/80 pb-px overflow-x-auto text-xs font-medium">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2.5 border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
            activeTab === 'overview'
              ? 'border-cyan-400 text-cyan-300 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          Overview &amp; Datasets
        </button>

        <button
          onClick={() => setActiveTab('collaborators')}
          className={`px-4 py-2.5 border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
            activeTab === 'collaborators'
              ? 'border-cyan-400 text-cyan-300 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          Team &amp; Collaboration
        </button>

        <button
          onClick={() => setActiveTab('evaluations')}
          className={`px-4 py-2.5 border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
            activeTab === 'evaluations'
              ? 'border-cyan-400 text-cyan-300 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <BrainCircuit className="w-3.5 h-3.5" />
          AI Model Evaluation
        </button>

        <button
          onClick={() => setActiveTab('publications')}
          className={`px-4 py-2.5 border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
            activeTab === 'publications'
              ? 'border-cyan-400 text-cyan-300 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          Publications
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2.5 border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
            activeTab === 'audit'
              ? 'border-cyan-400 text-cyan-300 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          Audit Trail
        </button>
      </div>

      {/* Main Metadata Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Tab Content */}
        <div className="lg:col-span-2 space-y-6">
          {activeTab === 'overview' && (
            <>
              {/* Objective */}
              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 space-y-3">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Research Objective</h2>
                <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-line">{project.objective}</p>
              </div>

              {/* Methodology */}
              {project.methodologySummary ? (
                <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 space-y-3">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Methodology Summary</h2>
                  <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                    {project.methodologySummary}
                  </p>
                </div>
              ) : null}

              {/* Detailed Description */}
              {project.description ? (
                <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 space-y-3">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Study Background &amp; Details
                  </h2>
                  <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">{project.description}</p>
                </div>
              ) : null}

              {/* Dataset Requests Sub-Section */}
              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-6 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/60">
                  <div>
                    <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                      <Database className="w-4 h-4 text-cyan-400" />
                      Clinical Dataset Requests
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Structured cohort requests submitted for this study protocol.
                    </p>
                  </div>

                  {isApprovedOrActive ? (
                    <Link to={`/research/projects/${project.id}/dataset-requests/new`}>
                      <Button className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs">
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        Request Clinical Dataset
                      </Button>
                    </Link>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-slate-800 bg-slate-950 text-[11px] text-slate-400">
                      <Lock className="w-3 h-3 text-amber-400" />
                      <span>Requires Project Approval First</span>
                    </div>
                  )}
                </div>

                {datasetRequests.length === 0 ? (
                  <div className="py-8 text-center">
                    <Database className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                    <div className="text-xs font-medium text-slate-300">No dataset requests yet</div>
                    <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                      {isApprovedOrActive
                        ? 'Use the button above to request a structured de-identified clinical observation dataset.'
                        : 'Dataset requests will become available once this project receives institutional approval.'}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800/60">
                    {datasetRequests.map((req) => (
                      <div key={req.id} className="py-3.5 flex items-center justify-between gap-3">
                        <div>
                          <Link
                            to={`/research/dataset-requests/${req.id}`}
                            className="text-sm font-medium text-slate-200 hover:text-cyan-300 truncate block"
                          >
                            {req.name}
                          </Link>
                          <div className="text-xs text-slate-400 font-mono mt-0.5">Format: {req.requestedFormat}</div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <ResearchStatusBadge status={req.status} />
                          <Link to={`/research/dataset-requests/${req.id}`}>
                            <Button variant="secondary" className="text-xs py-1 px-2.5 h-auto">
                              View
                            </Button>
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'collaborators' && (
            <ProjectCollaboratorsSection
              projectId={project.id}
              projectStatus={project.status}
              isOwner={isOwner}
              ownerUserId={project.ownerUserId}
              ownerDisplayName={ownerDisplayName}
            />
          )}

          {activeTab === 'evaluations' && (
            <AIEvaluationSection projectId={project.id} isApproved={isApprovedOrActive} />
          )}

          {activeTab === 'publications' && (
            <ProjectPublicationsSection projectId={project.id} isOwnerOrCollaborator={true} />
          )}

          {activeTab === 'audit' && <ProjectAuditTrailSection projectId={project.id} />}
        </div>

        {/* Right Col: Governance Timeline & Metadata */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 text-xs space-y-4">
            <h3 className="font-semibold uppercase tracking-wider text-[11px] text-slate-400">Governance Timestamps</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Created:</span>
                <span className="font-mono text-slate-200">{new Date(project.createdAt).toLocaleDateString()}</span>
              </div>
              {project.submittedAt ? (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Submitted:</span>
                  <span className="font-mono text-slate-200">{new Date(project.submittedAt).toLocaleDateString()}</span>
                </div>
              ) : null}
              {project.reviewedAt ? (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Reviewed:</span>
                  <span className="font-mono text-slate-200">{new Date(project.reviewedAt).toLocaleDateString()}</span>
                </div>
              ) : null}
              {project.approvedAt ? (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Approved:</span>
                  <span className="font-mono text-emerald-400">
                    {new Date(project.approvedAt).toLocaleDateString()}
                  </span>
                </div>
              ) : null}
              {project.archivedAt ? (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Archived:</span>
                  <span className="font-mono text-slate-400">{new Date(project.archivedAt).toLocaleDateString()}</span>
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-5 text-xs space-y-3">
            <h3 className="font-semibold uppercase tracking-wider text-[11px] text-slate-400">Protocol Integrity</h3>
            <p className="text-slate-400 leading-relaxed">
              This study is bound to Clinora's de-identification protocol. No direct patient identifying variables will
              ever be exposed to the research workspace.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
