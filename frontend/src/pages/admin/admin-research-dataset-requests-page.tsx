import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Database,
  Eye,
  FileSpreadsheet,
  FileText,
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
import { useParams } from 'react-router';
import { Button } from '../../components/ui/button';
import { apiErrorMessage } from '../../features/auth/auth-api';
import { adminResearchApi } from '../../features/research/research-api';
import { ResearchStatusBadge } from '../../features/research/research-status-badge';
import type {
  AdminDatasetRequestDetailResponse,
  AdminDatasetRequestQueueItem,
  DatasetRequestStatus,
} from '../../features/research/research-types';

export function AdminResearchDatasetRequestsPage() {
  const { requestId } = useParams<{ requestId?: string }>();
  const [statusFilter, setStatusFilter] = useState<DatasetRequestStatus | ''>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [allRequests, setAllRequests] = useState<AdminDatasetRequestQueueItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(requestId || null);
  const [detail, setDetail] = useState<AdminDatasetRequestDetailResponse | null>(null);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Modal State
  const [modalType, setModalType] = useState<'MORE_INFO' | 'APPROVE' | 'REJECT' | null>(null);
  const [notesText, setNotesText] = useState('');
  const [expiresAtInput, setExpiresAtInput] = useState('');

  const loadQueue = async () => {
    setLoadingQueue(true);
    setError('');
    try {
      const data = await adminResearchApi.listDatasetRequests({
        size: 50,
      });
      setAllRequests(data);
    } catch (err: unknown) {
      setError(apiErrorMessage(err, 'Failed to load dataset review queue.'));
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
      const data = await adminResearchApi.getDatasetRequestDetail(id);
      setDetail(data);
    } catch (err: unknown) {
      setError(apiErrorMessage(err, 'Failed to load dataset request details.'));
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, []);

  useEffect(() => {
    if (requestId) {
      loadDetail(requestId);
    }
  }, [requestId]);

  // If no dataset request is selected but we have loaded requests, select the first relevant one
  useEffect(() => {
    if (!selectedId && allRequests.length > 0 && !requestId) {
      const submitted = allRequests.find((r) => r.status === 'SUBMITTED');
      const first = submitted || allRequests[0];
      if (first) {
        loadDetail(first.id);
      }
    }
  }, [allRequests, selectedId, requestId]);

  const handleStartReview = async () => {
    if (!selectedId) return;
    setActionLoading(true);
    setError('');
    try {
      const updated = await adminResearchApi.startDatasetReview(selectedId);
      setDetail(updated);
      setActionSuccess('Dataset review started. Status updated to Under Review.');
      await loadQueue();
    } catch (err: unknown) {
      setError(apiErrorMessage(err, 'Failed to start review.'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleExecuteModal = async () => {
    if (!selectedId || !modalType) return;
    setActionLoading(true);
    setError('');
    try {
      let updated: AdminDatasetRequestDetailResponse;
      if (modalType === 'MORE_INFO') {
        updated = await adminResearchApi.requestDatasetInfo(selectedId, notesText);
        setActionSuccess('Additional information requested for dataset cohort.');
      } else if (modalType === 'APPROVE') {
        const isoDate = expiresAtInput ? new Date(expiresAtInput).toISOString() : undefined;
        updated = await adminResearchApi.approveDataset(selectedId, notesText, isoDate);
        setActionSuccess('Dataset extraction request approved.');
      } else {
        updated = await adminResearchApi.rejectDataset(selectedId, notesText);
        setActionSuccess('Dataset extraction request rejected.');
      }
      setDetail(updated);
      setModalType(null);
      setNotesText('');
      setExpiresAtInput('');
      await loadQueue();
    } catch (err: unknown) {
      setError(apiErrorMessage(err, 'Failed to record decision.'));
    } finally {
      setActionLoading(false);
    }
  };

  // KPI metrics
  const metrics = useMemo(() => {
    return {
      total: allRequests.length,
      submitted: allRequests.filter((r) => r.status === 'SUBMITTED').length,
      underReview: allRequests.filter((r) => r.status === 'UNDER_REVIEW').length,
      moreInfo: allRequests.filter((r) => r.status === 'MORE_INFO_REQUIRED').length,
      approved: allRequests.filter((r) => r.status === 'APPROVED').length,
      rejected: allRequests.filter((r) => r.status === 'REJECTED').length,
    };
  }, [allRequests]);

  // Filtered requests
  const filteredRequests = useMemo(() => {
    return allRequests.filter((item) => {
      const matchesStatus = !statusFilter || item.status === statusFilter;
      const matchesSearch =
        !searchQuery ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.projectTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.researcherName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.researcherEmail.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [allRequests, statusFilter, searchQuery]);

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[var(--clinora-border-subtle)]">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-400 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" />
            Data Extraction Governance
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            Dataset Request Reviews
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Evaluate cohort extraction filters, requested clinical variables, validity expiration, and privacy-preserving de-identification compliance.
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
        <div
          onClick={() => setStatusFilter('')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === ''
              ? 'border-cyan-500/50 bg-cyan-950/30 shadow-[0_0_15px_rgba(6,182,212,0.12)]'
              : 'border-white/[0.07] bg-white/[0.035] hover:border-white/15 hover:bg-white/[0.05]'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-medium uppercase tracking-wider">All Requests</span>
            <Database className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">{metrics.total}</div>
          <div className="mt-0.5 text-[10px] text-slate-500">Total dataset requests</div>
        </div>

        <div
          onClick={() => setStatusFilter('SUBMITTED')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'SUBMITTED'
              ? 'border-amber-500/50 bg-amber-950/30 shadow-[0_0_15px_rgba(245,158,11,0.12)]'
              : 'border-white/[0.07] bg-white/[0.035] hover:border-white/15 hover:bg-white/[0.05]'
          }`}
        >
          <div className="flex items-center justify-between text-amber-400">
            <span className="text-[11px] font-medium uppercase tracking-wider">Pending Action</span>
            <Clock className="w-4 h-4" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-300">{metrics.submitted}</div>
          <div className="mt-0.5 text-[10px] text-amber-500/80">Awaiting review start</div>
        </div>

        <div
          onClick={() => setStatusFilter('UNDER_REVIEW')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'UNDER_REVIEW'
              ? 'border-cyan-500/50 bg-cyan-950/30 shadow-[0_0_15px_rgba(6,182,212,0.12)]'
              : 'border-white/[0.07] bg-white/[0.035] hover:border-white/15 hover:bg-white/[0.05]'
          }`}
        >
          <div className="flex items-center justify-between text-cyan-400">
            <span className="text-[11px] font-medium uppercase tracking-wider">Under Review</span>
            <Eye className="w-4 h-4" />
          </div>
          <div className="mt-2 text-2xl font-bold text-cyan-300">{metrics.underReview}</div>
          <div className="mt-0.5 text-[10px] text-cyan-500/80">In governance analysis</div>
        </div>

        <div
          onClick={() => setStatusFilter('MORE_INFO_REQUIRED')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'MORE_INFO_REQUIRED'
              ? 'border-indigo-500/50 bg-indigo-950/30 shadow-[0_0_15px_rgba(99,102,241,0.12)]'
              : 'border-white/[0.07] bg-white/[0.035] hover:border-white/15 hover:bg-white/[0.05]'
          }`}
        >
          <div className="flex items-center justify-between text-indigo-400">
            <span className="text-[11px] font-medium uppercase tracking-wider">Need Info</span>
            <MessageSquarePlus className="w-4 h-4" />
          </div>
          <div className="mt-2 text-2xl font-bold text-indigo-300">{metrics.moreInfo}</div>
          <div className="mt-0.5 text-[10px] text-indigo-500/80">Researcher clarification</div>
        </div>

        <div
          onClick={() => setStatusFilter('APPROVED')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'APPROVED'
              ? 'border-emerald-500/50 bg-emerald-950/30 shadow-[0_0_15px_rgba(16,185,129,0.12)]'
              : 'border-white/[0.07] bg-white/[0.035] hover:border-white/15 hover:bg-white/[0.05]'
          }`}
        >
          <div className="flex items-center justify-between text-emerald-400">
            <span className="text-[11px] font-medium uppercase tracking-wider">Approved Cohorts</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-300">{metrics.approved}</div>
          <div className="mt-0.5 text-[10px] text-emerald-500/80">Ready for dataset export</div>
        </div>
      </div>

      {/* Action Messages */}
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
              placeholder="Search by request name, study, researcher..."
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
                <span className="text-xs">Loading dataset requests queue...</span>
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="py-20 text-center px-4">
                <Database className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs font-medium text-slate-300">No dataset requests found</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Try adjusting the search query or status filter.
                </p>
              </div>
            ) : (
              filteredRequests.map((item) => {
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
                      <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-indigo-400 bg-indigo-950/60 border border-indigo-800/50 px-2 py-0.5 rounded-md">
                        {item.requestedFormat} Export
                      </span>
                      <ResearchStatusBadge status={item.status} />
                    </div>

                    <h3 className="mt-2 text-sm font-semibold text-slate-100 line-clamp-1 leading-snug">
                      {item.name}
                    </h3>

                    <div className="mt-1.5 text-xs text-slate-400 truncate">
                      Study: <span className="text-slate-300 font-medium">{item.projectTitle}</span>
                    </div>

                    <div className="mt-1 text-[11px] text-slate-500 flex items-center gap-1.5 truncate">
                      <User className="w-3 h-3 text-slate-500 shrink-0" />
                      <span>{item.researcherName}</span>
                      <span>•</span>
                      <span className="truncate">{item.researcherEmail}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Dataset Request Inspector & Decision Desk (7 cols) */}
        <div className="lg:col-span-7">
          {loadingDetail ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-20 flex flex-col items-center justify-center text-slate-400 gap-3">
              <LoaderCircle className="w-8 h-8 animate-spin text-cyan-400" />
              <span className="text-xs font-medium">Retrieving dataset request cohort criteria...</span>
            </div>
          ) : !detail ? (
            <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 p-20 text-center">
              <Database className="w-12 h-12 text-slate-700 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-slate-300">No Dataset Request Selected</h3>
              <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                Select a dataset request from the left queue to evaluate cohort filtering rules, requested medical variables, and record approval decisions.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl divide-y divide-slate-800/80">
              {/* Header & Actions */}
              <div className="p-6 space-y-4">
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-bold uppercase tracking-wider text-indigo-400 px-2 py-0.5 rounded bg-indigo-950/80 border border-indigo-800/60">
                        {detail.request.requestedFormat} Export
                      </span>
                      <ResearchStatusBadge status={detail.request.status} />
                    </div>
                    <h2 className="mt-2 text-xl font-bold text-white tracking-tight leading-snug">
                      {detail.request.name}
                    </h2>
                    <div className="mt-2 text-xs text-slate-300">
                      Study Protocol: <span className="font-semibold text-cyan-300">{detail.projectTitle}</span>
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      Researcher: {detail.researcherName} ({detail.researcherEmail})
                    </div>
                  </div>

                  {/* Review Action Buttons Toolbar */}
                  {(detail.request.status === 'SUBMITTED' ||
                    detail.request.status === 'UNDER_REVIEW' ||
                    detail.request.status === 'MORE_INFO_REQUIRED') && (
                    <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Governance Actions</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {detail.request.status === 'SUBMITTED' && (
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
                            setNotesText('');
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
                            setNotesText('');
                            setExpiresAtInput('');
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
                            setNotesText('');
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

                {/* Expiration or Status Alert */}
                {detail.request.status === 'APPROVED' && (
                  <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-950/20 text-xs text-emerald-300 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>
                        Dataset extraction authorized. Valid until:{' '}
                        <strong>
                          {detail.request.expiresAt
                            ? new Date(detail.request.expiresAt).toLocaleDateString()
                            : 'Permanent Authorization'}
                        </strong>
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Specifications Body */}
              <div className="p-6 space-y-6">
                {/* Research Purpose */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-cyan-400" />
                    Cohort Purpose &amp; Scientific Justification
                  </div>
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/90 text-xs text-slate-200 leading-relaxed whitespace-pre-line shadow-inner">
                    {detail.request.purpose}
                  </div>
                </div>

                {/* Requested Population Filters */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-cyan-400" />
                    Population &amp; Cohort Inclusion Criteria (JSONB)
                  </div>
                  <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800/90 shadow-inner">
                    <pre className="text-xs font-mono text-cyan-300 overflow-x-auto whitespace-pre-wrap">
                      {(() => {
                        try {
                          const parsed = JSON.parse(detail.request.requestedPopulation);
                          return JSON.stringify(parsed, null, 2);
                        } catch {
                          return detail.request.requestedPopulation;
                        }
                      })()}
                    </pre>
                  </div>
                </div>

                {/* Requested Clinical Variables */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                    Requested Medical / Clinical Variables (JSONB)
                  </div>
                  <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800/90 shadow-inner">
                    <pre className="text-xs font-mono text-emerald-300 overflow-x-auto whitespace-pre-wrap">
                      {(() => {
                        try {
                          const parsed = JSON.parse(detail.request.requestedVariables);
                          return JSON.stringify(parsed, null, 2);
                        } catch {
                          return detail.request.requestedVariables;
                        }
                      })()}
                    </pre>
                  </div>
                </div>

                {/* Review Notes / Decision Feedback */}
                {detail.request.reviewNotes && (
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-xs space-y-1.5">
                    <div className="text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                      Recorded Administrative Review Feedback:
                    </div>
                    <div className="text-slate-200 leading-relaxed">{detail.request.reviewNotes}</div>
                  </div>
                )}
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
                <div className="text-[10px] font-mono uppercase tracking-wider text-indigo-400 font-semibold">
                  Administrative Action
                </div>
                <h3 className="text-lg font-bold text-white mt-1">
                  {modalType === 'MORE_INFO'
                    ? 'Request Information on Dataset Cohort'
                    : modalType === 'APPROVE'
                    ? 'Approve Dataset Extraction Request'
                    : 'Reject Dataset Extraction Request'}
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
                ? 'State what variables, population filters, or compliance safeguards need clarification from the researcher.'
                : modalType === 'APPROVE'
                ? 'Authorizes the generation/export of this dataset. You may set an optional expiration date for dataset access.'
                : 'State the formal regulatory or security reason why this dataset extraction request is rejected.'}
            </p>

            <textarea
              rows={4}
              required={modalType !== 'APPROVE'}
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
              placeholder={
                modalType === 'APPROVE'
                  ? 'Optional governance notes or compliance remarks...'
                  : 'Enter decision rationale or instructions for researcher (required)...'
              }
              className="w-full p-3 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30"
            />

            {modalType === 'APPROVE' && (
              <div className="space-y-1.5 p-3 rounded-xl bg-slate-950 border border-slate-800">
                <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                  Optional Access Expiration Date
                </label>
                <input
                  type="date"
                  value={expiresAtInput}
                  onChange={(e) => setExpiresAtInput(e.target.value)}
                  className="w-full p-2 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500/60"
                />
                <p className="text-[10px] text-slate-500">
                  Leave blank for permanent authorization or specify when dataset access expires.
                </p>
              </div>
            )}

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
                disabled={actionLoading || (modalType !== 'APPROVE' && !notesText.trim())}
                onClick={handleExecuteModal}
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
