import {
  AlertCircle,
  Award,
  CheckCircle2,
  Clock,
  Eye,
  FileCheck2,
  FileText,
  FolderGit2,
  GraduationCap,
  LoaderCircle,
  MessageSquarePlus,
  PlayCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  User,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Button } from '../../components/ui/button';
import { apiErrorMessage } from '../../features/auth/auth-api';
import { adminResearchApi } from '../../features/research/research-api';
import { ResearchStatusBadge } from '../../features/research/research-status-badge';
import type {
  AdminProjectDetailResponse,
  AdminProjectQueueItem,
  ResearchProjectStatus,
} from '../../features/research/research-types';

export function AdminResearchProjectsPage() {
  const { projectId } = useParams<{ projectId?: string }>();
  const [statusFilter, setStatusFilter] = useState<ResearchProjectStatus | ''>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [allProjects, setAllProjects] = useState<AdminProjectQueueItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(projectId || null);
  const [detail, setDetail] = useState<AdminProjectDetailResponse | null>(null);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Decision Modal State
  const [modalType, setModalType] = useState<'MORE_INFO' | 'APPROVE' | 'REJECT' | null>(null);
  const [commentText, setCommentText] = useState('');

  // Fetch all projects for counts & filtering
  const loadQueue = async () => {
    setLoadingQueue(true);
    setError('');
    try {
      const data = await adminResearchApi.listProjects({
        size: 50,
      });
      setAllProjects(data.items);
    } catch (err: unknown) {
      setError(apiErrorMessage(err, 'Failed to load project review queue.'));
    } finally {
      setLoadingQueue(false);
    }
  };

  const loadDetail = async (id: string) => {
    setSelectedId(id);
    setLoadingDetail(true);
    setActionSuccess('');
    setError('');
    try {
      const data = await adminResearchApi.getProjectDetail(id);
      setDetail(data);
    } catch (err: unknown) {
      setError(apiErrorMessage(err, 'Failed to load project review details.'));
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, []);

  useEffect(() => {
    if (projectId) {
      loadDetail(projectId);
    }
  }, [projectId]);

  // If no project is selected but we have loaded projects, select the first relevant one
  useEffect(() => {
    if (!selectedId && allProjects.length > 0 && !projectId) {
      const submitted = allProjects.find((p) => p.status === 'SUBMITTED');
      const first = submitted || allProjects[0];
      if (first) {
        loadDetail(first.id);
      }
    }
  }, [allProjects, selectedId, projectId]);

  const handleStartReview = async () => {
    if (!selectedId) return;
    setActionLoading(true);
    setError('');
    try {
      const updated = await adminResearchApi.startReview(selectedId);
      setDetail(updated);
      setActionSuccess('Review initiated. Status set to Under Review.');
      await loadQueue();
    } catch (err: unknown) {
      setError(apiErrorMessage(err, 'Failed to start review.'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleExecuteModalAction = async () => {
    if (!selectedId || !modalType) return;
    setActionLoading(true);
    setError('');
    try {
      let updated: AdminProjectDetailResponse;
      if (modalType === 'MORE_INFO') {
        updated = await adminResearchApi.requestInfo(selectedId, commentText);
        setActionSuccess('Additional information requested from researcher.');
      } else if (modalType === 'APPROVE') {
        updated = await adminResearchApi.approve(selectedId, commentText);
        setActionSuccess('Project governance approval granted.');
      } else {
        updated = await adminResearchApi.reject(selectedId, commentText);
        setActionSuccess('Project rejected.');
      }
      setDetail(updated);
      setModalType(null);
      setCommentText('');
      await loadQueue();
    } catch (err: unknown) {
      setError(apiErrorMessage(err, 'Failed to record decision.'));
    } finally {
      setActionLoading(false);
    }
  };

  // KPI Metrics calculation
  const metrics = useMemo(() => {
    return {
      total: allProjects.length,
      submitted: allProjects.filter((p) => p.status === 'SUBMITTED').length,
      underReview: allProjects.filter((p) => p.status === 'UNDER_REVIEW').length,
      moreInfo: allProjects.filter((p) => p.status === 'MORE_INFO_REQUIRED').length,
      approved: allProjects.filter((p) => p.status === 'APPROVED').length,
      rejected: allProjects.filter((p) => p.status === 'REJECTED').length,
    };
  }, [allProjects]);

  // Filtered list based on status and search query
  const filteredQueue = useMemo(() => {
    return allProjects.filter((item) => {
      if (statusFilter && item.status !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(query);
        const matchesField = item.researchField.toLowerCase().includes(query);
        const matchesOwner = item.ownerName.toLowerCase().includes(query);
        const matchesEmail = item.ownerEmail.toLowerCase().includes(query);
        return matchesTitle || matchesField || matchesOwner || matchesEmail;
      }
      return true;
    });
  }, [allProjects, statusFilter, searchQuery]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      {/* Executive Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--clinora-border-subtle)]">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-400">
            <ShieldCheck className="w-4 h-4" />
            Governance Review Board
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            Research Protocol Governance
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Audit, inspect scientific rationale, request amendments, and grant institutional IRB approval.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={loadQueue}
            className="text-xs border-white/10 bg-white/[0.04] text-slate-300 hover:text-white hover:bg-white/[0.08]"
            title="Refresh list"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loadingQueue ? 'animate-spin text-cyan-400' : ''}`} />
            Refresh Queue
          </Button>
        </div>
      </div>

      {/* KPI Metrics Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Total Governed */}
        <div
          onClick={() => setStatusFilter('')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === ''
              ? 'border-cyan-500/50 bg-cyan-950/30 shadow-[0_0_15px_rgba(6,182,212,0.12)]'
              : 'border-white/[0.07] bg-white/[0.035] hover:border-white/15 hover:bg-white/[0.05]'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-medium uppercase tracking-wider">All Protocols</span>
            <FolderGit2 className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">{metrics.total}</div>
          <div className="mt-0.5 text-[10px] text-slate-500">Total submitted to platform</div>
        </div>

        {/* Needs Action / Submitted */}
        <div
          onClick={() => setStatusFilter('SUBMITTED')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'SUBMITTED'
              ? 'border-amber-500/50 bg-amber-950/30 shadow-[0_0_15px_rgba(245,158,11,0.12)]'
              : 'border-white/[0.07] bg-white/[0.035] hover:border-white/15 hover:bg-white/[0.05]'
          }`}
        >
          <div className="flex items-center justify-between text-amber-400">
            <span className="text-[11px] font-medium uppercase tracking-wider">Pending Initial Review</span>
            <Clock className="w-4 h-4" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-300">{metrics.submitted}</div>
          <div className="mt-0.5 text-[10px] text-amber-500/80">Awaiting admin review start</div>
        </div>

        {/* Under Review */}
        <div
          onClick={() => setStatusFilter('UNDER_REVIEW')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'UNDER_REVIEW'
              ? 'border-cyan-500/50 bg-cyan-950/30 shadow-[0_0_15px_rgba(6,182,212,0.12)]'
              : 'border-white/[0.07] bg-white/[0.035] hover:border-white/15 hover:bg-white/[0.05]'
          }`}
        >
          <div className="flex items-center justify-between text-cyan-400">
            <span className="text-[11px] font-medium uppercase tracking-wider">Under Active Review</span>
            <Eye className="w-4 h-4" />
          </div>
          <div className="mt-2 text-2xl font-bold text-cyan-300">{metrics.underReview}</div>
          <div className="mt-0.5 text-[10px] text-cyan-500/80">Currently in deliberation</div>
        </div>

        {/* More Info */}
        <div
          onClick={() => setStatusFilter('MORE_INFO_REQUIRED')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'MORE_INFO_REQUIRED'
              ? 'border-indigo-500/50 bg-indigo-950/30 shadow-[0_0_15px_rgba(99,102,241,0.12)]'
              : 'border-white/[0.07] bg-white/[0.035] hover:border-white/15 hover:bg-white/[0.05]'
          }`}
        >
          <div className="flex items-center justify-between text-indigo-400">
            <span className="text-[11px] font-medium uppercase tracking-wider">Info Requested</span>
            <MessageSquarePlus className="w-4 h-4" />
          </div>
          <div className="mt-2 text-2xl font-bold text-indigo-300">{metrics.moreInfo}</div>
          <div className="mt-0.5 text-[10px] text-indigo-500/80">Waiting for researcher response</div>
        </div>

        {/* Approved */}
        <div
          onClick={() => setStatusFilter('APPROVED')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'APPROVED'
              ? 'border-emerald-500/50 bg-emerald-950/30 shadow-[0_0_15px_rgba(16,185,129,0.12)]'
              : 'border-white/[0.07] bg-white/[0.035] hover:border-white/15 hover:bg-white/[0.05]'
          }`}
        >
          <div className="flex items-center justify-between text-emerald-400">
            <span className="text-[11px] font-medium uppercase tracking-wider">Approved Protocols</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-300">{metrics.approved}</div>
          <div className="mt-0.5 text-[10px] text-emerald-500/80">Authorized for Clinora data</div>
        </div>
      </div>

      {/* Notification Banners */}
      {actionSuccess && (
        <div className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-950/40 text-emerald-200 text-xs flex items-center justify-between gap-3 animate-in fade-in shadow-lg">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="font-medium">{actionSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccess('')}
            className="text-emerald-400 hover:text-emerald-200 text-xs underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl border border-rose-500/30 bg-rose-950/40 text-rose-200 text-xs flex items-center justify-between gap-3 animate-in fade-in shadow-lg">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError('')}
            className="text-rose-400 hover:text-rose-200 text-xs underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Split Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Search, Filter Tabs, and Queue (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, researcher, field..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/40 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
              >
                Clear
              </button>
            )}
          </div>

          {/* Status Filter Tab Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
            {(
              [
                { id: '', label: 'All' },
                { id: 'SUBMITTED', label: 'Submitted' },
                { id: 'UNDER_REVIEW', label: 'In Review' },
                { id: 'MORE_INFO_REQUIRED', label: 'Need Info' },
                { id: 'APPROVED', label: 'Approved' },
                { id: 'REJECTED', label: 'Rejected' },
              ] as const
            ).map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setStatusFilter(st.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                  statusFilter === st.id
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'bg-slate-900/60 text-slate-400 border border-slate-800/80 hover:text-slate-200'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {/* Queue Item List */}
          <div className="rounded-2xl border border-slate-800/90 bg-slate-900/50 divide-y divide-slate-800/60 max-h-[760px] overflow-y-auto shadow-sm">
            {loadingQueue ? (
              <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
                <LoaderCircle className="w-6 h-6 animate-spin text-cyan-400" />
                <span className="text-xs">Loading governance queue...</span>
              </div>
            ) : filteredQueue.length === 0 ? (
              <div className="py-20 text-center px-4">
                <FolderGit2 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs font-medium text-slate-300">No matching protocols found</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Try adjusting the search query or status filter.</p>
              </div>
            ) : (
              filteredQueue.map((item) => {
                const isSelected = selectedId === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => loadDetail(item.id)}
                    className={`p-4 cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-cyan-500/[0.12] border-l-4 border-l-cyan-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]'
                        : 'hover:bg-slate-800/40 border-l-4 border-l-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-cyan-400 bg-cyan-950/60 border border-cyan-800/50 px-2 py-0.5 rounded-md">
                        {item.researchField}
                      </span>
                      <ResearchStatusBadge status={item.status} />
                    </div>

                    <h3 className="mt-2 text-sm font-semibold text-slate-100 line-clamp-1 leading-snug">
                      {item.title}
                    </h3>

                    <div className="mt-2 text-xs text-slate-400 flex items-center gap-1.5">
                      <User className="w-3 h-3 text-slate-500 shrink-0" />
                      <span className="text-slate-300 font-medium truncate">{item.ownerName}</span>
                      <span className="text-slate-600">•</span>
                      <span className="text-slate-500 truncate">{item.ownerEmail}</span>
                    </div>

                    {item.submittedAt && (
                      <div className="mt-1.5 text-[10px] text-slate-500 font-mono flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-600" />
                        Submitted: {new Date(item.submittedAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Protocol Inspector & Decision Desk (7 cols) */}
        <div className="lg:col-span-7">
          {loadingDetail ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-20 flex flex-col items-center justify-center text-slate-400 gap-3">
              <LoaderCircle className="w-8 h-8 animate-spin text-cyan-400" />
              <span className="text-xs font-medium">Retrieving protocol protocol specifications...</span>
            </div>
          ) : !detail ? (
            <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 p-20 text-center">
              <ShieldCheck className="w-12 h-12 text-slate-700 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-slate-300">No Protocol Selected</h3>
              <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                Select a project protocol from the left governance queue to inspect its clinical objective, methodology,
                ethics references, and render administrative decisions.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl divide-y divide-slate-800/80">
              {/* Protocol Header & Action Bar */}
              <div className="p-6 space-y-4">
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-400 px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-800/60">
                        {detail.project.researchField}
                      </span>
                      <ResearchStatusBadge status={detail.project.status} />
                    </div>
                    <h2 className="mt-2 text-xl font-bold text-white tracking-tight leading-snug">
                      {detail.project.title}
                    </h2>
                    <div className="mt-2 text-xs text-slate-300 flex items-center gap-2 flex-wrap">
                      <span className="text-slate-400">Principal Investigator:</span>
                      <span className="font-semibold text-white">{detail.ownerName}</span>
                      <span className="text-slate-500">({detail.ownerEmail})</span>
                    </div>
                  </div>

                  {/* Governance Action Buttons Toolbar */}
                  {(detail.project.status === 'SUBMITTED' ||
                    detail.project.status === 'UNDER_REVIEW' ||
                    detail.project.status === 'MORE_INFO_REQUIRED') && (
                    <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Governance Actions</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {detail.project.status === 'SUBMITTED' && (
                          <Button
                            onClick={handleStartReview}
                            disabled={actionLoading}
                            variant="secondary"
                            className="h-8 px-3 text-xs border-cyan-800 bg-cyan-950/40 text-cyan-300 hover:bg-cyan-900/50 shadow-sm"
                          >
                            <PlayCircle className="w-3.5 h-3.5 mr-1.5" />
                            Start Review
                          </Button>
                        )}

                        <Button
                          onClick={() => {
                            setModalType('MORE_INFO');
                            setCommentText('');
                          }}
                          disabled={actionLoading}
                          variant="secondary"
                          className="h-8 px-3 text-xs border-amber-800/80 bg-amber-950/40 text-amber-300 hover:bg-amber-900/50 shadow-sm"
                        >
                          <MessageSquarePlus className="w-3.5 h-3.5 mr-1.5" />
                          Request Info
                        </Button>

                        <Button
                          onClick={() => {
                            setModalType('APPROVE');
                            setCommentText('');
                          }}
                          disabled={actionLoading}
                          className="h-8 px-3.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-sm shadow-emerald-950"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                          Approve
                        </Button>

                        <Button
                          onClick={() => {
                            setModalType('REJECT');
                            setCommentText('');
                          }}
                          disabled={actionLoading}
                          variant="secondary"
                          className="h-8 px-3 text-xs border-rose-800/80 bg-rose-950/40 text-rose-300 hover:bg-rose-900/50 shadow-sm"
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1.5" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Status Hero Callout */}
                {detail.project.status === 'APPROVED' && (
                  <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-950/20 text-xs text-emerald-300 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>
                        This study protocol has been approved. The researcher may now submit dataset extraction requests
                        against this protocol.
                      </span>
                    </div>
                    <Link
                      to="/admin/research/dataset-requests"
                      className="text-[11px] font-semibold text-emerald-400 hover:underline shrink-0 ml-2"
                    >
                      View Dataset Requests &rarr;
                    </Link>
                  </div>
                )}

                {detail.project.status === 'SUBMITTED' && (
                  <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-950/20 text-xs text-amber-300 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>
                      Awaiting administrative initiation. Click <strong>Start Review</strong> to place this protocol
                      under active institutional evaluation.
                    </span>
                  </div>
                )}
              </div>

              {/* Protocol Details Body */}
              <div className="p-6 space-y-6">
                {/* Protocol Objective */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-cyan-400" />
                    Research Objective &amp; Clinical Hypotheses
                  </div>
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/90 text-xs text-slate-200 leading-relaxed whitespace-pre-line shadow-inner">
                    {detail.project.objective}
                  </div>
                </div>

                {/* Methodology Summary */}
                {detail.project.methodologySummary && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <FileCheck2 className="w-3.5 h-3.5 text-indigo-400" />
                      Methodology Summary &amp; Statistical Design
                    </div>
                    <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/90 text-xs text-slate-200 leading-relaxed whitespace-pre-line shadow-inner">
                      {detail.project.methodologySummary}
                    </div>
                  </div>
                )}

                {/* Institution & Ethics Reference Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/90">
                    <div className="text-slate-400 text-[10px] uppercase font-mono tracking-wider flex items-center gap-1">
                      <GraduationCap className="w-3 h-3 text-cyan-400" />
                      Primary Affiliated Institution
                    </div>
                    <div className="mt-1.5 font-semibold text-xs text-slate-200">
                      {detail.project.institutionName || 'Independent / Unspecified'}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/90">
                    <div className="text-slate-400 text-[10px] uppercase font-mono tracking-wider flex items-center gap-1">
                      <Award className="w-3 h-3 text-amber-400" />
                      IRB / Ethics Protocol Reference
                    </div>
                    <div className="mt-1.5 font-mono text-xs text-cyan-300 font-semibold">
                      {detail.project.ethicsReference || 'Not provided'}
                    </div>
                  </div>
                </div>

                {/* Governance Review History / Audit Trail */}
                <div className="pt-2 space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-cyan-400" />
                    Research Security Audit Trail &amp; Decision History
                  </h3>

                  {detail.reviewHistory.length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/60 text-xs text-slate-500 italic text-center">
                      No administrative review actions recorded yet.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {detail.reviewHistory.map((rev) => {
                        const isApproved = rev.action === 'APPROVED';
                        const isRejected = rev.action === 'REJECTED';
                        const isInfo = rev.action === 'INFORMATION_REQUESTED';
                        return (
                          <div
                            key={rev.id}
                            className={`p-3.5 rounded-xl border text-xs space-y-1.5 bg-slate-950/70 ${
                              isApproved
                                ? 'border-emerald-800/60'
                                : isRejected
                                  ? 'border-rose-800/60'
                                  : isInfo
                                    ? 'border-amber-800/60'
                                    : 'border-slate-800'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span
                                className={`font-mono text-[11px] font-bold ${
                                  isApproved
                                    ? 'text-emerald-400'
                                    : isRejected
                                      ? 'text-rose-400'
                                      : isInfo
                                        ? 'text-amber-400'
                                        : 'text-cyan-400'
                                }`}
                              >
                                {rev.action.replace('_', ' ')}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                {new Date(rev.createdAt).toLocaleString()}
                              </span>
                            </div>
                            {rev.comment && (
                              <div className="text-slate-300 pl-2.5 border-l-2 border-slate-700 mt-1 text-[11px] leading-relaxed">
                                {rev.comment}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Decision Modal */}
      {modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-semibold">
                  Administrative Action
                </div>
                <h3 className="text-lg font-bold text-white mt-1">
                  {modalType === 'MORE_INFO'
                    ? 'Request Additional Protocol Information'
                    : modalType === 'APPROVE'
                      ? 'Grant Governance Protocol Approval'
                      : 'Reject Research Study Protocol'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalType(null)}
                className="text-slate-400 hover:text-slate-200 text-xs"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              {modalType === 'MORE_INFO'
                ? 'Specify what clarifications, ethical documentation, or methodological revisions are needed from the principal investigator.'
                : modalType === 'APPROVE'
                  ? 'Confirming approval authorizes this research study on Clinora. You may provide optional administrative notes or conditions.'
                  : 'State the formal regulatory, methodological, or governance reason why this protocol cannot be approved.'}
            </p>

            <textarea
              rows={4}
              required={modalType !== 'APPROVE'}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder={
                modalType === 'APPROVE'
                  ? 'Optional approval comments or IRB clearance notes...'
                  : 'Enter specific feedback or rationale (required)...'
              }
              className="w-full p-3 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30"
            />

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800/80">
              <Button
                variant="secondary"
                type="button"
                onClick={() => setModalType(null)}
                className="text-xs border-slate-800"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={actionLoading || (modalType !== 'APPROVE' && !commentText.trim())}
                onClick={handleExecuteModalAction}
                className={`text-xs font-semibold px-4 py-2 ${
                  modalType === 'APPROVE'
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : modalType === 'REJECT'
                      ? 'bg-rose-600 hover:bg-rose-500 text-white'
                      : 'bg-amber-600 hover:bg-amber-500 text-white'
                }`}
              >
                {actionLoading ? (
                  <LoaderCircle className="w-4 h-4 animate-spin" />
                ) : modalType === 'APPROVE' ? (
                  'Confirm Approval'
                ) : modalType === 'REJECT' ? (
                  'Confirm Rejection'
                ) : (
                  'Send Request'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
