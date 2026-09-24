import { AlertCircle, FolderGit2, Plus, Search, ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../../components/ui/button';
import { apiErrorMessage } from '../../features/auth/auth-api';
import { researchApi } from '../../features/research/research-api';
import { ResearchStatusBadge } from '../../features/research/research-status-badge';
import type { ResearchProject, ResearchProjectStatus } from '../../features/research/research-types';

const statusTabs: { label: string; value: ResearchProjectStatus | '' }[] = [
  { label: 'All Projects', value: '' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'In Review', value: 'SUBMITTED' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Action Required', value: 'MORE_INFO_REQUIRED' },
  { label: 'Archived', value: 'ARCHIVED' },
];

export function ResearchProjectsPage() {
  const [statusFilter, setStatusFilter] = useState<ResearchProjectStatus | ''>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [projects, setProjects] = useState<ResearchProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadProjects() {
      setLoading(true);
      setError('');
      try {
        const data = await researchApi.listProjects({
          status: statusFilter || undefined,
          size: 50,
        });
        setProjects(data.items);
      } catch (err: unknown) {
        setError(apiErrorMessage(err, 'Failed to load projects'));
      } finally {
        setLoading(false);
      }
    }

    loadProjects();
  }, [statusFilter]);

  const filteredProjects = projects.filter((p) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      p.title.toLowerCase().includes(query) ||
      p.researchField.toLowerCase().includes(query) ||
      (p.institutionName && p.institutionName.toLowerCase().includes(query))
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">Research Projects</h1>
          <p className="mt-1 text-sm text-slate-400">
            Create, manage, and track the governance status of your clinical research studies.
          </p>
        </div>
        <Link to="/research/projects/new">
          <Button className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold shadow-md shadow-cyan-500/20">
            <Plus className="w-4 h-4 mr-1.5" />
            New Research Project
          </Button>
        </Link>
      </div>

      {/* Error & Permission States */}
      {error ? (
        error.includes('403') ||
        error.toLowerCase().includes('forbidden') ||
        error.toLowerCase().includes('permission') ? (
          <div className="p-6 rounded-2xl border border-amber-800/80 bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-950 text-amber-200 text-sm space-y-2">
            <div className="flex items-center gap-2 font-semibold text-amber-300">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
              <span>Researcher Permission Required</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed pl-7">
              Your current Clinora credentials do not have the{' '}
              <code className="font-mono text-cyan-300 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                RESEARCHER
              </code>{' '}
              role required to create or browse clinical research projects. Please contact your institutional system
              administrator.
            </p>
          </div>
        ) : (
          <div className="p-4 rounded-xl border border-rose-800/60 bg-rose-950/30 text-rose-300 text-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )
      ) : null}

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Status Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800">
          {statusTabs.map((tab) => (
            <button
              key={tab.label}
              type="button"
              onClick={() => setStatusFilter(tab.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === tab.value
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Field */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search study title, field, IRB..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-xl text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-cyan-500/50"
          />
        </div>
      </div>

      {/* Projects List with 5-State Architecture */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-5 space-y-4 animate-pulse">
              <div className="flex items-center justify-between">
                <div className="h-4 w-28 bg-slate-800 rounded" />
                <div className="h-5 w-20 bg-slate-800 rounded-full" />
              </div>
              <div className="h-5 w-3/4 bg-slate-800/90 rounded" />
              <div className="space-y-1.5">
                <div className="h-3 w-full bg-slate-800/60 rounded" />
                <div className="h-3 w-2/3 bg-slate-800/60 rounded" />
              </div>
              <div className="pt-4 border-t border-slate-800/40 flex items-center justify-between">
                <div className="h-3 w-32 bg-slate-800/50 rounded" />
                <div className="h-6 w-16 bg-slate-800/60 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="py-16 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 p-8 space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
            <FolderGit2 className="w-7 h-7 text-cyan-400" />
          </div>
          <div>
            <div className="text-base font-semibold text-slate-200">
              {statusFilter ? 'No matching research projects found' : "You haven't created a research project yet."}
            </div>
            <p className="mt-1.5 text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
              {statusFilter
                ? `There are no research projects matching the status filter "${statusFilter}".`
                : 'Start by drafting a research study protocol. Projects require institutional governance review before dataset requests can be submitted.'}
            </p>
          </div>
          <div className="pt-2">
            <Link to="/research/projects/new">
              <Button className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs shadow-md shadow-cyan-500/20">
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Create New Project
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              className="rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-sm p-5 hover:border-cyan-500/30 hover:shadow-[0_0_24px_rgba(6,182,212,0.06)] transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-400/90 font-medium px-2 py-0.5 rounded bg-cyan-950/40 border border-cyan-800/40">
                    {project.researchField}
                  </span>
                  <ResearchStatusBadge status={project.status} />
                </div>
                <h2 className="text-base font-semibold text-slate-100 group-hover:text-cyan-300 transition-colors line-clamp-1">
                  {project.title}
                </h2>
                <p className="mt-2 text-xs text-slate-400 line-clamp-2 leading-relaxed">{project.objective}</p>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-800/60 flex items-center justify-between gap-2 text-xs">
                <div className="text-slate-400 truncate flex items-center gap-1.5">
                  <span className="text-slate-500">Protocol:</span>
                  <span className="text-slate-300 truncate font-mono text-[11px]">
                    {project.institutionName || 'Independent Protocol'}
                  </span>
                </div>
                <Link to={`/research/projects/${project.id}`}>
                  <Button
                    variant="secondary"
                    className="text-xs py-1 px-3 h-auto hover:border-cyan-500/40 hover:text-cyan-300"
                  >
                    Manage Workspace
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
