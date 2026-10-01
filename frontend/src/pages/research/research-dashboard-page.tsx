import {
  AlertCircle,
  ArrowRight,
  Bell,
  Database,
  FolderGit2,
  LoaderCircle,
  MailCheck,
  Plus,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../../components/ui/button';
import { apiErrorMessage } from '../../features/auth/auth-api';
import { useAuthStore } from '../../features/auth/auth-store';
import { researchApi } from '../../features/research/research-api';
import { ResearchStatusBadge } from '../../features/research/research-status-badge';
import type {
  DatasetRequest,
  ResearchProject,
  ResearchProjectInvitation,
  ResearchProjectStatus,
} from '../../features/research/research-types';
import { CinematicBackground } from '../../components/app/cinematic-background';
import { cn } from '../../lib/cn';

type ProjectActionConfig = {
  label: string;
  dotClass: string;
  badgeClass: string;
  actionText: string;
  getRoute: (project: ResearchProject) => string;
};

const PROJECT_STATUS_CONFIG: Record<ResearchProjectStatus, ProjectActionConfig> = {
  DRAFT: {
    label: 'Draft',
    dotClass: 'bg-slate-400',
    badgeClass: 'border-slate-700/70 bg-slate-800/40 text-slate-300',
    actionText: 'Continue editing',
    getRoute: (p) => (p.editable ? `/research/projects/${p.id}/edit` : `/research/projects/${p.id}`),
  },
  SUBMITTED: {
    label: 'Submitted',
    dotClass: 'bg-cyan-400',
    badgeClass: 'border-cyan-800/50 bg-cyan-950/30 text-cyan-300',
    actionText: 'Open project',
    getRoute: (p) => `/research/projects/${p.id}`,
  },
  UNDER_REVIEW: {
    label: 'Under review',
    dotClass: 'bg-amber-400',
    badgeClass: 'border-amber-800/50 bg-amber-950/30 text-amber-300',
    actionText: 'Open project',
    getRoute: (p) => `/research/projects/${p.id}`,
  },
  MORE_INFO_REQUIRED: {
    label: 'Action required',
    dotClass: 'bg-amber-400',
    badgeClass: 'border-amber-800/60 bg-amber-950/40 text-amber-200',
    actionText: 'Update project',
    getRoute: (p) => (p.editable ? `/research/projects/${p.id}/edit` : `/research/projects/${p.id}`),
  },
  APPROVED: {
    label: 'Approved',
    dotClass: 'bg-emerald-400',
    badgeClass: 'border-emerald-800/50 bg-emerald-950/30 text-emerald-300',
    actionText: 'Open project',
    getRoute: (p) => `/research/projects/${p.id}`,
  },
  ACTIVE: {
    label: 'Active',
    dotClass: 'bg-emerald-400',
    badgeClass: 'border-emerald-800/50 bg-emerald-950/30 text-emerald-300',
    actionText: 'Open project',
    getRoute: (p) => `/research/projects/${p.id}`,
  },
  REJECTED: {
    label: 'Rejected',
    dotClass: 'bg-rose-400',
    badgeClass: 'border-rose-800/50 bg-rose-950/30 text-rose-300',
    actionText: 'View decision',
    getRoute: (p) => `/research/projects/${p.id}`,
  },
  COMPLETED: {
    label: 'Completed',
    dotClass: 'bg-teal-400',
    badgeClass: 'border-teal-800/50 bg-teal-950/30 text-teal-300',
    actionText: 'Open project',
    getRoute: (p) => `/research/projects/${p.id}`,
  },
  ARCHIVED: {
    label: 'Archived',
    dotClass: 'bg-slate-500',
    badgeClass: 'border-slate-800/60 bg-slate-900/40 text-slate-400',
    actionText: 'View project',
    getRoute: (p) => `/research/projects/${p.id}`,
  },
  WITHDRAWN: {
    label: 'Withdrawn',
    dotClass: 'bg-slate-500',
    badgeClass: 'border-slate-800/60 bg-slate-900/40 text-slate-400',
    actionText: 'View project',
    getRoute: (p) => `/research/projects/${p.id}`,
  },
};

function getProjectConfig(status: ResearchProjectStatus): ProjectActionConfig {
  return (
    PROJECT_STATUS_CONFIG[status] ?? {
      label: status,
      dotClass: 'bg-slate-400',
      badgeClass: 'border-slate-700/70 bg-slate-800/40 text-slate-300',
      actionText: 'Open project',
      getRoute: (p: ResearchProject) => `/research/projects/${p.id}`,
    }
  );
}

export function ResearchDashboardPage() {
  const user = useAuthStore((state) => state.user);
  const [projects, setProjects] = useState<ResearchProject[]>([]);
  const [datasetRequests, setDatasetRequests] = useState<DatasetRequest[]>([]);
  const [invitations, setInvitations] = useState<ResearchProjectInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const projectsData = await researchApi.listProjects({ size: 50 });
      setProjects(projectsData.items);

      // For approved/active projects, fetch their dataset requests
      const approvedProjects = projectsData.items.filter((p) => p.status === 'APPROVED' || p.status === 'ACTIVE');

      const allRequests: DatasetRequest[] = [];
      for (const p of approvedProjects) {
        try {
          const reqs = await researchApi.listDatasetRequests(p.id, { size: 20 });
          allRequests.push(...reqs.items);
        } catch {
          // continue loading other project requests
        }
      }
      setDatasetRequests(allRequests);

      // Load collaboration invitations inbox
      try {
        const invs = await researchApi.listMyInvitations();
        setInvitations(invs.filter((i) => i.status === 'PENDING'));
      } catch {
        // non-critical — dashboard still loads
      }
    } catch (err: unknown) {
      setError(apiErrorMessage(err, 'Failed to load research workspace data.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Compute real metrics from API data (zero fake data!)
  const activeProjectsCount = projects.filter((p) => p.status === 'ACTIVE').length;
  const pendingReviewsCount = projects.filter(
    (p) => p.status === 'SUBMITTED' || p.status === 'UNDER_REVIEW' || p.status === 'MORE_INFO_REQUIRED',
  ).length;
  const approvedProjectsCount = projects.filter((p) => p.status === 'APPROVED' || p.status === 'ACTIVE').length;
  const totalDatasetRequests = datasetRequests.length;
  const approvedDatasetRequests = datasetRequests.filter((r) => r.status === 'APPROVED').length;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Workspace Header with Cinematic Background */}
      <div className="relative isolate overflow-hidden rounded-2xl border border-cyan-500/25 bg-[linear-gradient(135deg,rgba(4,20,27,0.78),rgba(2,11,20,0.85)_50%,rgba(4,20,27,0.92))] p-6 sm:p-8 shadow-2xl backdrop-blur-md">
        <CinematicBackground heightClass="h-full" className="rounded-2xl" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100">Research Workspace</h1>
            <p className="mt-2 text-sm text-slate-400 max-w-2xl leading-relaxed">
              Governed access to privacy-preserving Clinora research resources. Create research protocols, submit
              studies for institutional review, and manage structured dataset extraction requests.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link to="/research/projects/new">
              <Button className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold shadow-lg shadow-cyan-500/20">
                <Plus className="w-4 h-4 mr-1.5" />
                New Research Project
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {error ? (
        <div className="p-4 rounded-xl border border-rose-800/60 bg-rose-950/30 text-rose-300 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {/* Collaboration Invitations Inbox */}
      {invitations.length > 0 && (
        <div className="rounded-2xl border border-cyan-800/40 bg-cyan-950/10 p-5 space-y-3">
          <div className="flex items-center gap-2.5">
            <Bell className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-slate-100">
              Pending Collaboration Invitations
              <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-cyan-500 text-slate-950 text-[10px] font-bold">
                {invitations.length}
              </span>
            </h2>
          </div>
          <div className="space-y-2">
            {invitations.map((inv) => (
              <div
                key={inv.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-800 bg-slate-900/60"
              >
                <div className="space-y-0.5">
                  <p className="text-xs font-medium text-slate-200">
                    <span className="text-cyan-300">{inv.invitedByDisplayName}</span> invited you to join{' '}
                    <span className="font-semibold text-slate-100">{inv.projectTitle ?? 'a research project'}</span>
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Role: <span className="text-slate-400">{inv.proposedRole.replace('_', ' ')}</span> · Expires{' '}
                    {new Date(inv.expiresAt).toLocaleDateString()}
                  </p>
                  {inv.message && <p className="text-[11px] text-slate-500 italic mt-0.5">"{inv.message}"</p>}
                  <p className="text-[10px] text-amber-500/80 mt-0.5">
                    ⚠ Accepting grants project access only — not clinical dataset access.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="secondary"
                    className="text-xs h-7 px-3"
                    onClick={async () => {
                      try {
                        await researchApi.declineInvitation(inv.id);
                        setInvitations((prev) => prev.filter((i) => i.id !== inv.id));
                      } catch (err: unknown) {
                        alert(apiErrorMessage(err, 'Failed to decline invitation.'));
                      }
                    }}
                  >
                    Decline
                  </Button>
                  <Button
                    className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs h-7 px-3"
                    onClick={async () => {
                      try {
                        await researchApi.acceptInvitation(inv.id);
                        // Remove invitation from inbox then reload full dashboard
                        // so the newly accessible project appears in My Projects
                        setInvitations((prev) => prev.filter((i) => i.id !== inv.id));
                        await loadDashboardData();
                      } catch (err: unknown) {
                        alert(apiErrorMessage(err, 'Failed to accept invitation.'));
                      }
                    }}
                  >
                    <MailCheck className="w-3.5 h-3.5 mr-1.5" />
                    Accept
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Real Metric KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-sm">
          <div className="text-xs font-medium text-slate-400">Active Projects</div>
          <div className="mt-2 text-2xl font-bold font-mono text-emerald-400">
            {loading ? <LoaderCircle className="w-5 h-5 animate-spin" /> : activeProjectsCount}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">Approved & active</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-sm">
          <div className="text-xs font-medium text-slate-400">Pending Reviews</div>
          <div className="mt-2 text-2xl font-bold font-mono text-amber-400">
            {loading ? <LoaderCircle className="w-5 h-5 animate-spin" /> : pendingReviewsCount}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">Awaiting admin review</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-sm">
          <div className="text-xs font-medium text-slate-400">Approved Projects</div>
          <div className="mt-2 text-2xl font-bold font-mono text-cyan-400">
            {loading ? <LoaderCircle className="w-5 h-5 animate-spin" /> : approvedProjectsCount}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">Governance granted</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-sm">
          <div className="text-xs font-medium text-slate-400">Dataset Requests</div>
          <div className="mt-2 text-2xl font-bold font-mono text-slate-200">
            {loading ? <LoaderCircle className="w-5 h-5 animate-spin" /> : totalDatasetRequests}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">Structured extractions</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-sm col-span-2 sm:col-span-1">
          <div className="text-xs font-medium text-slate-400">Approved Datasets</div>
          <div className="mt-2 text-2xl font-bold font-mono text-purple-400">
            {loading ? <LoaderCircle className="w-5 h-5 animate-spin" /> : approvedDatasetRequests}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">Ready for cohort pipeline</div>
        </div>
      </div>

      {/* Main Workspace Layout (Full Width) */}
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 backdrop-blur-sm p-5 sm:p-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800/60">
            <div className="flex items-center gap-2.5">
              <FolderGit2 className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-semibold text-slate-100">My Projects &amp; Collaborations</h2>
            </div>
            <Link
              to="/research/projects"
              className="text-xs font-medium text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
            >
              View all ({projects.length})
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="py-12 flex items-center justify-center text-slate-400 gap-3">
              <LoaderCircle className="w-5 h-5 animate-spin text-cyan-400" />
              <span>Loading your research projects...</span>
            </div>
          ) : projects.length === 0 ? (
            <div className="py-12 text-center">
              <FolderGit2 className="w-10 h-10 mx-auto text-slate-600 mb-3" />
              <div className="text-sm font-medium text-slate-300">No research projects yet</div>
              <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
                Start by drafting a research study protocol. Projects require System Admin governance approval before
                dataset requests can be submitted.
              </p>
              <div className="mt-4">
                <Link to="/research/projects/new">
                  <Button variant="secondary" className="text-xs">
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Create First Project
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/60 mt-2">
              {projects.slice(0, 5).map((project) => {
                const config = getProjectConfig(project.status);
                return (
                  <div
                    key={project.id}
                    className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                  >
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/research/projects/${project.id}`}
                        className="text-sm font-medium text-slate-200 group-hover:text-cyan-300 transition-colors flex items-center gap-2"
                      >
                        <span className="truncate">{project.title}</span>
                        {project.ownerUserId !== user?.id && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-950/60 text-purple-300 border border-purple-800 shrink-0">
                            <Users className="w-2.5 h-2.5" />
                            Collaborator
                          </span>
                        )}
                      </Link>
                      <div className="mt-1 flex items-center gap-2.5 text-xs text-slate-400">
                        <span className="text-slate-400 font-mono">{project.researchField}</span>
                        {project.institutionName ? (
                          <>
                            <span className="text-slate-600">•</span>
                            <span className="truncate">{project.institutionName}</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 self-start sm:self-center">
                      <span
                        className={cn(
                          'inline-flex h-7 items-center gap-1.5 px-2.5 rounded-full border text-xs font-medium tracking-tight shrink-0',
                          config.badgeClass,
                        )}
                      >
                        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', config.dotClass)} aria-hidden="true" />
                        {config.label}
                      </span>
                      <Link
                        to={config.getRoute(project)}
                        className="inline-flex h-9 items-center gap-1.5 px-3 rounded-lg border border-slate-700/70 bg-slate-800/60 text-xs font-medium text-slate-200 hover:border-cyan-500/50 hover:bg-slate-800 hover:text-cyan-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 shrink-0"
                      >
                        <span>{config.actionText}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Dataset Requests Section */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 backdrop-blur-sm p-5 sm:p-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800/60">
            <div className="flex items-center gap-2.5">
              <Database className="w-5 h-5 text-indigo-400" />
              <h2 className="text-lg font-semibold text-slate-100">Dataset Requests</h2>
            </div>
            <span className="text-xs text-slate-400">{datasetRequests.length} total requests</span>
          </div>

          {loading ? (
            <div className="py-8 flex items-center justify-center text-slate-400 gap-2">
              <LoaderCircle className="w-4 h-4 animate-spin text-indigo-400" />
              <span className="text-xs">Loading dataset requests...</span>
            </div>
          ) : datasetRequests.length === 0 ? (
            <div className="py-8 text-center">
              <Database className="w-8 h-8 mx-auto text-slate-600 mb-2" />
              <div className="text-sm font-medium text-slate-300">No dataset requests yet</div>
              <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
                Dataset requests can be initiated once you have an APPROVED research project.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/60 mt-2">
              {datasetRequests.slice(0, 5).map((req) => (
                <div
                  key={req.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                >
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/research/dataset-requests/${req.id}`}
                      className="text-sm font-medium text-slate-200 group-hover:text-indigo-300 transition-colors truncate block"
                    >
                      {req.name}
                    </Link>
                    <div className="mt-0.5 text-xs text-slate-400 font-mono">Format: {req.requestedFormat}</div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 self-start sm:self-center">
                    <ResearchStatusBadge status={req.status} />
                    <Link
                      to={`/research/dataset-requests/${req.id}`}
                      className="inline-flex h-9 items-center gap-1.5 px-3 rounded-lg border border-slate-700/70 bg-slate-800/60 text-xs font-medium text-slate-200 hover:border-cyan-500/50 hover:bg-slate-800 hover:text-cyan-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 shrink-0"
                    >
                      <span>{req.status === 'DRAFT' ? 'Continue request' : 'Open request'}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
