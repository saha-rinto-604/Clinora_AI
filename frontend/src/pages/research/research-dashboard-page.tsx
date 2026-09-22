import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Database,
  FolderGit2,
  Info,
  LoaderCircle,
  Plus,
  ShieldCheck,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../../components/ui/button';
import { apiErrorMessage } from '../../features/auth/auth-api';
import { researchApi } from '../../features/research/research-api';
import { ResearchStatusBadge } from '../../features/research/research-status-badge';
import type { DatasetRequest, ResearchProject } from '../../features/research/research-types';

export function ResearchDashboardPage() {
  const [projects, setProjects] = useState<ResearchProject[]>([]);
  const [datasetRequests, setDatasetRequests] = useState<DatasetRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadDashboardData() {
      setLoading(true);
      setError('');
      try {
        const projectsData = await researchApi.listProjects({ size: 50 });
        setProjects(projectsData.items);

        // For approved projects, fetch their dataset requests
        const approvedProjects = projectsData.items.filter(
          (p) => p.status === 'APPROVED' || p.status === 'ACTIVE'
        );

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
      } catch (err: unknown) {
        setError(apiErrorMessage(err, 'Failed to load research workspace data.'));
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  // Compute real metrics from API data (zero fake data!)
  const activeProjectsCount = projects.filter((p) => p.status === 'ACTIVE').length;
  const pendingReviewsCount = projects.filter(
    (p) => p.status === 'SUBMITTED' || p.status === 'UNDER_REVIEW' || p.status === 'MORE_INFO_REQUIRED'
  ).length;
  const approvedProjectsCount = projects.filter(
    (p) => p.status === 'APPROVED' || p.status === 'ACTIVE'
  ).length;
  const totalDatasetRequests = datasetRequests.length;
  const approvedDatasetRequests = datasetRequests.filter((r) => r.status === 'APPROVED').length;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Workspace Header */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 p-6 sm:p-8 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-800/60 bg-cyan-950/40 px-3 py-1 text-xs font-medium text-cyan-300 mb-3">
              <ShieldCheck className="w-3.5 h-3.5" />
              Governed Research Environment
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100">
              Research Workspace
            </h1>
            <p className="mt-2 text-sm text-slate-400 max-w-2xl leading-relaxed">
              Governed access to privacy-preserving Clinora research resources. Create research protocols,
              submit studies for institutional review, and manage structured dataset extraction requests.
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

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: My Projects */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 backdrop-blur-sm p-5 sm:p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800/60">
              <div className="flex items-center gap-2.5">
                <FolderGit2 className="w-5 h-5 text-cyan-400" />
                <h2 className="text-lg font-semibold text-slate-100">My Projects</h2>
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
                  Start by drafting a research study protocol. Projects require System Admin governance
                  approval before dataset requests can be submitted.
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
                {projects.slice(0, 5).map((project) => (
                  <div
                    key={project.id}
                    className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                  >
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/research/projects/${project.id}`}
                        className="text-sm font-medium text-slate-200 group-hover:text-cyan-300 transition-colors flex items-center gap-2"
                      >
                        <span className="truncate">{project.title}</span>
                      </Link>
                      <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
                        <span className="text-slate-400 font-mono">{project.researchField}</span>
                        {project.institutionName ? (
                          <>
                            <span>•</span>
                            <span className="truncate">{project.institutionName}</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <ResearchStatusBadge status={project.status} />
                      <Link to={`/research/projects/${project.id}`}>
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

          {/* Dataset Requests Section */}
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 backdrop-blur-sm p-5 sm:p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800/60">
              <div className="flex items-center gap-2.5">
                <Database className="w-5 h-5 text-indigo-400" />
                <h2 className="text-lg font-semibold text-slate-100">Dataset Requests</h2>
              </div>
              <span className="text-xs text-slate-400">
                {datasetRequests.length} total requests
              </span>
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
                    <div className="min-w-0">
                      <Link
                        to={`/research/dataset-requests/${req.id}`}
                        className="text-sm font-medium text-slate-200 group-hover:text-indigo-300 transition-colors truncate block"
                      >
                        {req.name}
                      </Link>
                      <div className="mt-0.5 text-xs text-slate-400 font-mono">
                        Format: {req.requestedFormat}
                      </div>
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
        </div>

        {/* Right Col: Production Roadmap & Governance Notice */}
        <div className="space-y-6">
          {/* Research Access Notice Card (Explicit milestone roadmap empty state) */}
          <div className="rounded-2xl border border-cyan-800/40 bg-gradient-to-b from-cyan-950/20 to-slate-900/60 p-5 sm:p-6 backdrop-blur-sm">
            <div className="flex items-center gap-2.5 text-cyan-400 mb-3">
              <Info className="w-5 h-5 shrink-0" />
              <h3 className="font-semibold text-slate-100 text-sm">Research Data Pipeline</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Clinical dataset generation is not yet available until eligible verified clinical
              observations are configured in subsequent phases.
            </p>
            <div className="mt-4 pt-4 border-t border-cyan-900/30 space-y-2.5 text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>R1–R3: Research Project Governance</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>R4: Dataset Request Governance</span>
              </div>
              <div className="flex items-center gap-2 text-cyan-300 font-medium">
                <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>R6–R8: Verified Observations &amp; De-identification Pipeline</span>
              </div>
            </div>
          </div>

          {/* Privacy & Governance Principles */}
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-5 sm:p-6 backdrop-blur-sm text-xs space-y-3">
            <h3 className="font-semibold text-slate-200 uppercase tracking-wider text-[11px]">
              Privacy Commitments
            </h3>
            <ul className="space-y-2 text-slate-400">
              <li className="flex items-start gap-2">
                <span className="text-cyan-400">•</span>
                <span>Zero patient-identifiable data in researcher workspace.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-cyan-400">•</span>
                <span>All cohort requests use structured variables; raw SQL execution is barred.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-cyan-400">•</span>
                <span>Every project and extraction decision is permanently auditable.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
