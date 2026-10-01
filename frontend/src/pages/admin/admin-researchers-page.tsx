import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  GraduationCap,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import {
  adminResearchersApi,
  type AccountStatus,
  type ApplicationStatus,
  type ResearcherSummaryView,
} from '../../features/admin/admin-researchers-api';
import { cn } from '../../lib/cn';

const accountStatusOptions: { value: AccountStatus | ''; label: string }[] = [
  { value: '', label: 'All Account Statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'DEACTIVATED', label: 'Deactivated' },
  { value: 'PENDING_VERIFICATION', label: 'Pending Verification' },
];

const applicationStatusOptions: { value: ApplicationStatus | ''; label: string }[] = [
  { value: '', label: 'All Application Statuses' },
  { value: 'ACTIVATED', label: 'Activated' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'MORE_INFO_REQUIRED', label: 'More Info Required' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'WITHDRAWN', label: 'Withdrawn' },
];

export function AdminResearchersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [accountStatus, setAccountStatus] = useState<AccountStatus | ''>('');
  const [applicationStatus, setApplicationStatus] = useState<ApplicationStatus | ''>('');
  const [researchField, setResearchField] = useState('');
  const [institution, setInstitution] = useState('');
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ResearcherSummaryView[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchTerm);
      setPage(0);
    }, 350);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const loadResearchers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminResearchersApi.listResearchers({
        q: debouncedQuery,
        accountStatus,
        applicationStatus,
        researchField: researchField.trim() || undefined,
        institution: institution.trim() || undefined,
        page,
        size,
      });
      if (res.success && res.data) {
        setItems(res.data.items);
        setTotalItems(res.data.totalItems);
        setTotalPages(res.data.totalPages);
      } else {
        setError(res.message || 'Failed to load researcher accounts.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error loading researcher accounts.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, accountStatus, applicationStatus, researchField, institution, page, size]);

  useEffect(() => {
    loadResearchers();
  }, [loadResearchers]);

  const resetFilters = () => {
    setSearchTerm('');
    setDebouncedQuery('');
    setAccountStatus('');
    setApplicationStatus('');
    setResearchField('');
    setInstitution('');
    setPage(0);
  };

  const getAccountStatusBadge = (status: AccountStatus) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Active</Badge>;
      case 'SUSPENDED':
        return <Badge className="bg-rose-500/10 text-rose-400 border border-rose-500/20">Suspended</Badge>;
      case 'DEACTIVATED':
        return <Badge className="bg-slate-500/10 text-slate-400 border border-slate-500/20">Deactivated</Badge>;
      case 'PENDING_VERIFICATION':
        return (
          <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20">Pending Verification</Badge>
        );
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const getApplicationStatusBadge = (status: ApplicationStatus | null) => {
    if (!status) {
      return <span className="text-xs text-slate-500 italic">No Application</span>;
    }
    switch (status) {
      case 'ACTIVATED':
        return <Badge className="bg-teal-500/10 text-teal-400 border border-teal-500/20">Activated</Badge>;
      case 'APPROVED':
        return <Badge className="bg-sky-500/10 text-sky-400 border border-sky-500/20">Approved</Badge>;
      case 'SUBMITTED':
        return <Badge className="bg-blue-500/10 text-blue-400 border border-blue-500/20">Submitted</Badge>;
      case 'MORE_INFO_REQUIRED':
        return <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20">More Info</Badge>;
      case 'REJECTED':
        return <Badge className="bg-rose-500/10 text-rose-400 border border-rose-500/20">Rejected</Badge>;
      case 'WITHDRAWN':
        return <Badge className="bg-slate-500/10 text-slate-400 border border-slate-500/20">Withdrawn</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const getCredentialStatusBadge = (status?: string | null) => {
    if (status === 'VERIFIED') {
      return (
        <Badge variant="neutral" className="bg-teal-500/10 text-teal-300 border-teal-500/20 text-[11px]">
          <CheckCircle2 className="w-3 h-3 mr-1 text-teal-400 inline" /> Verified
        </Badge>
      );
    }
    if (status === 'SUBMITTED') {
      return (
        <Badge variant="neutral" className="bg-cyan-500/10 text-cyan-300 border-cyan-500/20 text-[11px]">
          <Clock className="w-3 h-3 mr-1 text-cyan-400 inline" /> Under Review
        </Badge>
      );
    }
    if (status === 'REJECTED') {
      return (
        <Badge variant="danger" className="text-[11px]">
          <ShieldAlert className="w-3 h-3 mr-1 inline" /> Resubmit
        </Badge>
      );
    }
    if (status === 'EXPIRED') {
      return (
        <Badge variant="danger" className="text-[11px]">
          <AlertTriangle className="w-3 h-3 mr-1 inline" /> Expired
        </Badge>
      );
    }
    return (
      <Badge variant="neutral" className="bg-amber-500/10 text-amber-300 border-amber-500/20 text-[11px]">
        <Clock className="w-3 h-3 mr-1 text-amber-400 inline" /> Pending (30d)
      </Badge>
    );
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Researcher Accounts</h1>
              <p className="text-sm text-slate-400">
                Identity, verification provenance, and ongoing account governance for approved Researchers.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => loadResearchers()}
            disabled={loading}
            className="border-slate-700 bg-slate-800/60 hover:bg-slate-800 text-slate-200"
          >
            <RefreshCw className={cn('w-4 h-4 mr-1.5', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-slate-900/60 backdrop-blur border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Search Input */}
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search name, email, institution, field..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950/60 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500/50"
            />
          </div>

          {/* Account Status */}
          <div>
            <select
              value={accountStatus}
              onChange={(e) => {
                setAccountStatus(e.target.value as AccountStatus | '');
                setPage(0);
              }}
              className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500/50"
            >
              {accountStatusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Application Status */}
          <div>
            <select
              value={applicationStatus}
              onChange={(e) => {
                setApplicationStatus(e.target.value as ApplicationStatus | '');
                setPage(0);
              }}
              className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500/50"
            >
              {applicationStatusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Reset button */}
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={resetFilters}
              className="w-full border-slate-700 bg-slate-800/40 hover:bg-slate-800 text-slate-300 text-xs"
            >
              Reset Filters
            </Button>
          </div>
        </div>

        {/* Secondary filters row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-800/60">
          <div>
            <input
              type="text"
              placeholder="Filter by research field..."
              value={researchField}
              onChange={(e) => {
                setResearchField(e.target.value);
                setPage(0);
              }}
              className="w-full bg-slate-950/40 border border-slate-800/80 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500/50"
            />
          </div>
          <div>
            <input
              type="text"
              placeholder="Filter by institution..."
              value={institution}
              onChange={(e) => {
                setInstitution(e.target.value);
                setPage(0);
              }}
              className="w-full bg-slate-950/40 border border-slate-800/80 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500/50"
            />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-12 flex flex-col items-center justify-center text-center">
          <Loader2 className="w-8 h-8 text-teal-400 animate-spin mb-3" />
          <p className="text-sm text-slate-400">Loading researcher accounts...</p>
        </div>
      ) : error ? (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-6 text-center">
          <ShieldAlert className="w-8 h-8 text-rose-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-rose-300">{error}</p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => loadResearchers()}
            className="mt-4 border-rose-500/30 text-rose-200 hover:bg-rose-500/20"
          >
            Try Again
          </Button>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-12 text-center">
          <GraduationCap className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-medium text-slate-200">No Researcher Accounts Found</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            {debouncedQuery || accountStatus || applicationStatus || researchField || institution
              ? 'No researchers matched your search criteria. Try broadening your filters.'
              : 'There are currently no researcher accounts provisioned in the system.'}
          </p>
          {(debouncedQuery || accountStatus || applicationStatus || researchField || institution) && (
            <Button
              variant="secondary"
              size="sm"
              onClick={resetFilters}
              className="mt-4 border-slate-700 text-slate-300"
            >
              Reset Filters
            </Button>
          )}
        </div>
      ) : (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-xs text-slate-400 uppercase tracking-wider">
                <tr>
                  <th scope="col" className="py-3 px-4">
                    Researcher
                  </th>
                  <th scope="col" className="py-3 px-4">
                    Institution & Role
                  </th>
                  <th scope="col" className="py-3 px-4">
                    Research Field
                  </th>
                  <th scope="col" className="py-3 px-4">
                    Account Status
                  </th>
                  <th scope="col" className="py-3 px-4">
                    Application Status
                  </th>
                  <th scope="col" className="py-3 px-4">
                    Credentials
                  </th>
                  <th scope="col" className="py-3 px-4">
                    Created Date
                  </th>
                  <th scope="col" className="py-3 px-4 text-right">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {items.map((researcher) => {
                  const initials =
                    `${researcher.firstName?.charAt(0) || ''}${researcher.lastName?.charAt(0) || ''}`.toUpperCase();
                  const photoUrl = researcher.hasProfileImage
                    ? `/api/v1/profile-images/admin/users/${researcher.id}`
                    : null;

                  return (
                    <tr key={researcher.id} className="hover:bg-slate-800/30 transition-colors duration-150">
                      {/* Name & Avatar */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="relative w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0 text-xs font-semibold text-teal-400">
                            {photoUrl ? (
                              <img
                                src={photoUrl}
                                alt={`${researcher.firstName} ${researcher.lastName}`}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  // Fallback to initials if image fails
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            ) : null}
                            <span>{initials || 'R'}</span>
                          </div>
                          <div>
                            <div className="font-medium text-white flex items-center gap-1.5">
                              {researcher.firstName} {researcher.lastName}
                              {researcher.emailVerified && (
                                <span title="Email Verified">
                                  <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-400 font-mono">{researcher.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Institution & Title */}
                      <td className="py-3.5 px-4">
                        <div className="text-slate-200 font-medium truncate max-w-[200px]">
                          {researcher.institution || <span className="text-slate-500 italic">Not recorded</span>}
                        </div>
                        <div className="text-xs text-slate-400 truncate max-w-[200px]">
                          {researcher.professionalTitle || researcher.department || '—'}
                        </div>
                      </td>

                      {/* Field */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="text-xs font-medium text-teal-300 bg-teal-950/40 border border-teal-800/40 px-2 py-0.5 rounded">
                          {researcher.researchField || 'General Research'}
                        </span>
                      </td>

                      {/* Account Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getAccountStatusBadge(researcher.accountStatus)}
                      </td>

                      {/* Application Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getApplicationStatusBadge(researcher.applicationStatus)}
                      </td>

                      {/* Credential Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getCredentialStatusBadge(researcher.credentialVerificationStatus)}
                      </td>

                      {/* Created Date */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-400">
                        {new Date(researcher.createdAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>

                      {/* View Action */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-right">
                        <Link to={`/admin/researchers/${researcher.id}`}>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="border-slate-700 bg-slate-800/40 hover:bg-teal-500/20 hover:border-teal-500/50 hover:text-teal-300 text-xs h-8 px-3"
                          >
                            Manage
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="bg-slate-950/80 px-4 py-3 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
            <div>
              Showing <span className="font-semibold text-white">{page * size + 1}</span> to{' '}
              <span className="font-semibold text-white">{Math.min((page + 1) * size, totalItems)}</span> of{' '}
              <span className="font-semibold text-white">{totalItems}</span> researchers
            </div>
            <div className="flex items-center gap-2">
              <select
                value={size}
                onChange={(e) => {
                  setSize(Number(e.target.value));
                  setPage(0);
                }}
                className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white focus:outline-none"
              >
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
              </select>

              <div className="flex items-center gap-1">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="h-7 w-7 p-0 border-slate-800 text-slate-300 disabled:opacity-40"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
                <span className="px-2 font-mono">
                  {page + 1} / {Math.max(1, totalPages)}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                  className="h-7 w-7 p-0 border-slate-800 text-slate-300 disabled:opacity-40"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
