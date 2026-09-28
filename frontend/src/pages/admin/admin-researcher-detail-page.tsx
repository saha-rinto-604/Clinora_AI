import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Database,
  Download,
  Eye,
  FileCheck,
  FileText,
  FolderGit2,
  GraduationCap,
  History,
  IdCard,
  KeyRound,
  Layers,
  Loader2,
  Lock,
  Mail,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Unlock,
  User,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../components/ui/dialog';
import {
  adminResearchersApi,
  type ResearcherActivityView,
  type ResearcherAuditEventView,
  type ResearcherDetailView,
  type ResearcherDocumentView,
} from '../../features/admin/admin-researchers-api';
import { apiClient } from '../../features/auth/auth-api';
import { cn } from '../../lib/cn';

type ActiveTab = 'overview' | 'documents' | 'activity' | 'security' | 'audit';

export function AdminResearcherDetailPage() {
  const { researcherUserId } = useParams<{ researcherUserId: string }>();

  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [detail, setDetail] = useState<ResearcherDetailView | null>(null);
  const [documents, setDocuments] = useState<ResearcherDocumentView[]>([]);
  const [activity, setActivity] = useState<ResearcherActivityView | null>(null);
  const [auditEvents, setAuditEvents] = useState<ResearcherAuditEventView[]>([]);
  const [auditPage, setAuditPage] = useState(0);
  const [auditTotalPages, setAuditTotalPages] = useState(0);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Security action modals
  const [actionModal, setActionModal] = useState<'suspend' | 'reactivate' | 'revoke' | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Credential verification
  const [credentials, setCredentials] = useState<any>(null);
  const [credentialsLoading, setCredentialsLoading] = useState(false);
  const [verifyModal, setVerifyModal] = useState<'APPROVE' | 'REJECT' | 'EXTEND' | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');
  const [adminNotesInput, setAdminNotesInput] = useState('');
  const [additionalDaysInput, setAdditionalDaysInput] = useState(30);

  // Document preview modal
  const [previewDoc, setPreviewDoc] = useState<ResearcherDocumentView | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const loadDetail = useCallback(async () => {
    if (!researcherUserId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await adminResearchersApi.getResearcherDetail(researcherUserId);
      if (res.success && res.data) {
        setDetail(res.data);
      } else {
        setError(res.message || 'Researcher not found.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error loading researcher details.');
    } finally {
      setLoading(false);
    }
  }, [researcherUserId]);

  const loadDocuments = useCallback(async () => {
    if (!researcherUserId) return;
    try {
      const res = await adminResearchersApi.getResearcherDocuments(researcherUserId);
      if (res.success && res.data) {
        setDocuments(res.data);
      }
    } catch {
      // Ignored for secondary tab
    }
  }, [researcherUserId]);

  const loadActivity = useCallback(async () => {
    if (!researcherUserId) return;
    try {
      const res = await adminResearchersApi.getResearcherActivity(researcherUserId);
      if (res.success && res.data) {
        setActivity(res.data);
      }
    } catch {
      // Ignored for secondary tab
    }
  }, [researcherUserId]);

  const loadAuditEvents = useCallback(async (pageToLoad = 0) => {
    if (!researcherUserId) return;
    setLoadingAudit(true);
    try {
      const res = await adminResearchersApi.getResearcherAuditEvents(researcherUserId, pageToLoad, 15);
      if (res.success && res.data) {
        setAuditEvents(res.data.items);
        setAuditTotalPages(res.data.totalPages);
        setAuditPage(pageToLoad);
      }
    } catch {
      // Ignored
    } finally {
      setLoadingAudit(false);
    }
  }, [researcherUserId]);

  const loadCredentials = useCallback(async () => {
    if (!researcherUserId) return;
    try {
      setCredentialsLoading(true);
      const res = await adminResearchersApi.getCredentials(researcherUserId);
      if (res && res.data) {
        setCredentials(res.data);
      }
    } catch {
      // Ignored if not yet seeded
    } finally {
      setCredentialsLoading(false);
    }
  }, [researcherUserId]);

  useEffect(() => {
    loadDetail();
    loadDocuments();
    loadCredentials();
    loadActivity();
    loadAuditEvents(0);
  }, [loadDetail, loadDocuments, loadCredentials, loadActivity, loadAuditEvents]);

  // Document preview handler
  const handlePreviewDocument = async (doc: ResearcherDocumentView) => {
    if (!researcherUserId) return;
    setPreviewDoc(doc);
    setPreviewLoading(true);
    setPreviewError(null);
    if (previewBlobUrl) {
      URL.revokeObjectURL(previewBlobUrl);
      setPreviewBlobUrl(null);
    }

    try {
      const url = `/admin/researchers/${encodeURIComponent(researcherUserId)}/documents/${encodeURIComponent(doc.id)}/content?download=false`;
      const res = await apiClient.get<Blob>(url, { responseType: 'blob' });
      const blob = res.data;
      const blobUrl = URL.createObjectURL(blob);
      setPreviewBlobUrl(blobUrl);
    } catch (err: unknown) {
      setPreviewError(err instanceof Error ? err.message : 'Failed to display document content.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDownloadDocument = async (doc: ResearcherDocumentView) => {
    if (!researcherUserId) return;
    try {
      const url = `/admin/researchers/${encodeURIComponent(researcherUserId)}/documents/${encodeURIComponent(doc.id)}/content?download=true`;
      const res = await apiClient.get<Blob>(url, { responseType: 'blob' });
      const link = document.createElement('a');
      const blobUrl = URL.createObjectURL(res.data);
      link.href = blobUrl;
      link.download = doc.originalFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
    } catch (err: any) {
      alert(err?.message || 'Failed to download file.');
    }
  };

  const handleAdminVerifyCredentials = async () => {
    if (!researcherUserId || !verifyModal) return;
    setActionLoading(true);
    setActionError(null);
    try {
      if (verifyModal === 'APPROVE') {
        const res = await adminResearchersApi.verifyCredentials(researcherUserId, {
          action: 'APPROVE',
          adminNotes: adminNotesInput.trim() || undefined,
        });
        if (res && res.data) setCredentials(res.data);
      } else if (verifyModal === 'REJECT') {
        if (!rejectionReasonInput.trim()) {
          setActionError('Please provide a rejection / resubmission reason.');
          setActionLoading(false);
          return;
        }
        const res = await adminResearchersApi.verifyCredentials(researcherUserId, {
          action: 'REJECT',
          rejectionReason: rejectionReasonInput.trim(),
          adminNotes: adminNotesInput.trim() || undefined,
        });
        if (res && res.data) setCredentials(res.data);
      } else if (verifyModal === 'EXTEND') {
        const res = await adminResearchersApi.extendDeadline(researcherUserId, {
          additionalDays: additionalDaysInput,
          reason: adminNotesInput.trim() || undefined,
        });
        if (res && res.data) setCredentials(res.data);
      }
      setVerifyModal(null);
      setRejectionReasonInput('');
      setAdminNotesInput('');
      await loadDetail();
    } catch (err: any) {
      setActionError(err?.message || 'Failed to update credentials.');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePreviewCredential = async (docType: 'student-id' | 'certificate') => {
    if (!researcherUserId || !credentials) return;
    const isId = docType === 'student-id';
    const filename = isId ? credentials.studentIdFilename : credentials.certificateFilename;
    const mimeType = isId ? credentials.studentIdMimeType : credentials.certificateMimeType;
    setPreviewDoc({
      id: `credential-${docType}`,
      applicationId: '',
      documentType: (isId ? 'STUDENT_ID' : 'OTHER') as any,
      originalFilename: filename || (isId ? 'Student ID Card' : 'Educational Certificate'),
      mimeType: mimeType || 'image/jpeg',
      sizeBytes: isId ? (credentials.studentIdSizeBytes || 0) : (credentials.certificateSizeBytes || 0),
      createdAt: credentials.submittedAt || new Date().toISOString(),
    });
    setPreviewLoading(true);
    setPreviewError(null);
    if (previewBlobUrl) {
      URL.revokeObjectURL(previewBlobUrl);
      setPreviewBlobUrl(null);
    }
    try {
      const url = `/admin/researchers/${encodeURIComponent(researcherUserId)}/credentials/documents/${docType}`;
      const res = await apiClient.get<Blob>(url, { responseType: 'blob' });
      const blob = res.data;
      setPreviewBlobUrl(URL.createObjectURL(blob));
    } catch (err: any) {
      setPreviewError(err?.message || 'Failed to display document content.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDownloadCredential = async (docType: 'student-id' | 'certificate') => {
    if (!researcherUserId) return;
    try {
      const url = `/admin/researchers/${encodeURIComponent(researcherUserId)}/credentials/documents/${docType}`;
      const res = await apiClient.get<Blob>(url, { responseType: 'blob' });
      const link = document.createElement('a');
      const blobUrl = URL.createObjectURL(res.data);
      link.href = blobUrl;
      link.download = docType === 'student-id'
        ? (credentials?.studentIdFilename || 'student-id')
        : (credentials?.certificateFilename || 'educational-certificate');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
    } catch (err: any) {
      alert(err?.message || 'Download failed');
    }
  };

  const handleSecurityAction = async () => {
    if (!researcherUserId || !actionModal) return;
    setActionLoading(true);
    setActionError(null);

    try {
      if (actionModal === 'suspend') {
        await adminResearchersApi.suspendResearcher(researcherUserId, actionReason);
      } else if (actionModal === 'reactivate') {
        await adminResearchersApi.reactivateResearcher(researcherUserId, actionReason);
      } else if (actionModal === 'revoke') {
        await adminResearchersApi.revokeSessions(researcherUserId, actionReason);
      }

      setActionModal(null);
      setActionReason('');
      await loadDetail();
      await loadAuditEvents(0);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center max-w-5xl mx-auto">
        <Loader2 className="w-8 h-8 text-teal-400 animate-spin mx-auto mb-3" />
        <p className="text-slate-400 text-sm">Loading researcher workspace...</p>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="p-8 max-w-4xl mx-auto space-y-4">
        <Link to="/admin/researchers" className="text-slate-400 hover:text-white flex items-center gap-1.5 text-sm">
          <ArrowLeft className="w-4 h-4" /> Back to Researcher Accounts
        </Link>
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-8 text-center">
          <ShieldAlert className="w-10 h-10 text-rose-400 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-rose-200">Unable to Load Researcher Account</h2>
          <p className="text-sm text-rose-300/80 mt-1 max-w-md mx-auto">{error || 'Researcher record was not found.'}</p>
          <Button variant="secondary" size="sm" onClick={loadDetail} className="mt-4 border-rose-500/30 text-rose-200">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const { account, application, securitySummary } = detail;
  const initials = `${account.firstName?.charAt(0) || ''}${account.lastName?.charAt(0) || ''}`.toUpperCase();
  const photoUrl = account.hasProfileImage ? `/api/v1/profile-images/admin/users/${account.id}` : null;

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Back button */}
      <div>
        <Link
          to="/admin/researchers"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Researcher Accounts
        </Link>
      </div>

      {/* Top Banner Profile Card */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-2xl bg-slate-800 border-2 border-slate-700/80 flex items-center justify-center overflow-hidden flex-shrink-0 text-xl font-bold text-teal-400 shadow-md">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={`${account.firstName} ${account.lastName}`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : null}
              <span>{initials || 'R'}</span>
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  {account.firstName} {account.lastName}
                </h1>
                <Badge className="bg-teal-500/10 text-teal-300 border border-teal-500/20 text-xs">RESEARCHER</Badge>
                {account.accountStatus === 'ACTIVE' ? (
                  <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs">
                    Active Account
                  </Badge>
                ) : account.accountStatus === 'SUSPENDED' ? (
                  <Badge className="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs">
                    Suspended
                  </Badge>
                ) : (
                  <Badge variant="neutral" className="text-xs">
                    {account.accountStatus}
                  </Badge>
                )}
                {application && (
                  <Badge variant="neutral" className="text-xs text-sky-400 border-sky-500/30">
                    App: {application.status}
                  </Badge>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1 font-mono text-slate-300">
                  <Mail className="w-3.5 h-3.5 text-teal-400" />
                  {account.email}
                  {account.emailVerified && (
                    <span title="Verified Email">
                      <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 inline ml-0.5" />
                    </span>
                  )}
                </span>
                {application?.institution && (
                  <span className="flex items-center gap-1 text-slate-300">
                    <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                    {application.institution}
                  </span>
                )}
                <span className="flex items-center gap-1 text-slate-400">
                  <Calendar className="w-3.5 h-3.5" />
                  Enrolled {new Date(account.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {account.accountStatus === 'ACTIVE' ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setActionModal('suspend');
                  setActionReason('');
                  setActionError(null);
                }}
                className="border-rose-500/30 text-rose-300 hover:bg-rose-500/20 hover:border-rose-500 text-xs"
              >
                <Lock className="w-3.5 h-3.5 mr-1.5" /> Suspend Account
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setActionModal('reactivate');
                  setActionReason('');
                  setActionError(null);
                }}
                className="border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-500 text-xs"
              >
                <Unlock className="w-3.5 h-3.5 mr-1.5" /> Reactivate Account
              </Button>
            )}

            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setActionModal('revoke');
                setActionReason('');
                setActionError(null);
              }}
              className="border-slate-700 bg-slate-800/40 text-slate-300 hover:bg-slate-800 text-xs"
            >
              <KeyRound className="w-3.5 h-3.5 mr-1.5" /> Revoke Sessions
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1 border-b border-slate-800 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab('overview')}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 whitespace-nowrap',
            activeTab === 'overview'
              ? 'border-teal-400 text-teal-300 bg-slate-900/60'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          )}
        >
          <User className="w-4 h-4" /> Overview & Profile
        </button>

        <button
          onClick={() => setActiveTab('documents')}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 whitespace-nowrap',
            activeTab === 'documents'
              ? 'border-teal-400 text-teal-300 bg-slate-900/60'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          )}
        >
          <FileCheck className="w-4 h-4" /> Verification & Documents
          {documents.length > 0 && (
            <span className="ml-1 px-1.5 py-0.2 bg-teal-500/20 text-teal-300 rounded-full text-[10px]">
              {documents.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('activity')}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 whitespace-nowrap',
            activeTab === 'activity'
              ? 'border-teal-400 text-teal-300 bg-slate-900/60'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          )}
        >
          <Activity className="w-4 h-4" /> Research Activity
        </button>

        <button
          onClick={() => setActiveTab('security')}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 whitespace-nowrap',
            activeTab === 'security'
              ? 'border-teal-400 text-teal-300 bg-slate-900/60'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          )}
        >
          <Shield className="w-4 h-4" /> Account & Security
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 whitespace-nowrap',
            activeTab === 'audit'
              ? 'border-teal-400 text-teal-300 bg-slate-900/60'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          )}
        >
          <History className="w-4 h-4" /> Audit History
        </button>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Identity & Account Info */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <User className="w-4 h-4 text-teal-400" /> Account Identity & Governance
            </h3>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5">User ID</span>
                <span className="font-mono text-slate-200 text-[11px] select-all">{account.id}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Global Role</span>
                <span className="font-semibold text-teal-300">{account.role}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Account Status</span>
                <span className="text-slate-200">{account.accountStatus}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Email Verification</span>
                <span className={account.emailVerified ? 'text-teal-400' : 'text-amber-400'}>
                  {account.emailVerified ? 'Verified' : 'Unverified'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Created At</span>
                <span className="text-slate-200">{new Date(account.createdAt).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Last Login</span>
                <span className="text-slate-200">
                  {account.lastLoginAt ? new Date(account.lastLoginAt).toLocaleString() : 'Never logged in'}
                </span>
              </div>
              {account.deactivatedAt && (
                <div className="col-span-2">
                  <span className="text-rose-400 block mb-0.5">Suspension / Deactivation Date</span>
                  <span className="text-rose-200">{new Date(account.deactivatedAt).toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>

          {/* Application Provenance */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <FileCheck className="w-4 h-4 text-sky-400" /> Application Provenance
            </h3>
            {application ? (
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block mb-0.5">Application ID</span>
                  <span className="font-mono text-slate-200 text-[11px] select-all">{application.applicationId}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Application Status</span>
                  <span className="font-semibold text-sky-300">{application.status}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Submitted At</span>
                  <span className="text-slate-200">
                    {application.submittedAt ? new Date(application.submittedAt).toLocaleString() : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Attested At</span>
                  <span className="text-slate-200">
                    {application.attestedAt ? new Date(application.attestedAt).toLocaleString() : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Phone Number</span>
                  <span className="text-slate-200">{application.phone || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Country Code</span>
                  <span className="text-slate-200">{application.countryCode || '—'}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic py-4">
                No access application record found for this account (account provisioned directly by system administrator).
              </p>
            )}
          </div>

          {/* Professional & Institutional Details */}
          {application && (
            <div className="md:col-span-2 bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                <GraduationCap className="w-4 h-4 text-teal-400" /> Professional Credentials & Research Context
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block mb-0.5">Institution</span>
                  <span className="font-medium text-slate-200">{application.institution || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Department</span>
                  <span className="font-medium text-slate-200">{application.department || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Professional Title</span>
                  <span className="font-medium text-slate-200">{application.professionalTitle || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Research Field</span>
                  <span className="font-medium text-teal-300">{application.researchField || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">ORCID iD</span>
                  <span className="font-mono text-slate-200">{application.orcid || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Ethics Reference</span>
                  <span className="text-slate-200">{application.ethicsReference || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Project Approval Ref</span>
                  <span className="text-slate-200">{application.projectApprovalReference || '—'}</span>
                </div>
                {application.institutionalProfileUrl && (
                  <div className="md:col-span-2">
                    <span className="text-slate-400 block mb-0.5">Institutional Profile</span>
                    <a
                      href={application.institutionalProfileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-teal-400 hover:underline truncate block"
                    >
                      {application.institutionalProfileUrl}
                    </a>
                  </div>
                )}
                {application.researchPurpose && (
                  <div className="md:col-span-3 pt-2 border-t border-slate-800">
                    <span className="text-slate-400 block mb-1 font-medium">Proposed Research Purpose</span>
                    <p className="text-slate-300 leading-relaxed bg-slate-950/40 p-3 rounded-lg border border-slate-800/80">
                      {application.researchPurpose}
                    </p>
                  </div>
                )}
                {application.researchSummary && (
                  <div className="md:col-span-3">
                    <span className="text-slate-400 block mb-1 font-medium">Research Summary</span>
                    <p className="text-slate-300 leading-relaxed bg-slate-950/40 p-3 rounded-lg border border-slate-800/80">
                      {application.researchSummary}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Verification & Documents */}
      {activeTab === 'documents' && (
        <div className="space-y-6">
          {/* Section 1: Mandatory Student ID & Educational Certificate Verification Card */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur space-y-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-5">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-teal-500/10 text-teal-300">
                    <GraduationCap className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white">Institutional Credentials Verification</h3>
                    <p className="text-xs text-slate-400">
                      Mandatory student/faculty ID and last educational degree verification for scientific account governance.
                    </p>
                  </div>
                </div>
              </div>

              {/* Status Badge & Actions */}
              <div className="flex flex-wrap items-center gap-2">
                {credentials?.verificationStatus === 'VERIFIED' ? (
                  <Badge variant="neutral" className="bg-teal-500/10 text-teal-300 border-teal-500/20 text-xs py-1 px-3">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-teal-400 inline" /> Credentials Verified
                  </Badge>
                ) : credentials?.verificationStatus === 'SUBMITTED' ? (
                  <Badge variant="neutral" className="bg-cyan-500/10 text-cyan-300 border-cyan-500/20 text-xs py-1 px-3">
                    <Clock className="w-3.5 h-3.5 mr-1.5 text-cyan-400 inline" /> Ready for Admin Review
                  </Badge>
                ) : credentials?.verificationStatus === 'REJECTED' ? (
                  <Badge variant="danger" className="text-xs py-1 px-3">
                    <ShieldAlert className="w-3.5 h-3.5 mr-1.5 inline" /> Resubmission Requested
                  </Badge>
                ) : credentials?.isExpired ? (
                  <Badge variant="danger" className="text-xs py-1 px-3">
                    <AlertTriangle className="w-3.5 h-3.5 mr-1.5 inline" /> Verification Expired (Suspension Risk)
                  </Badge>
                ) : (
                  <Badge variant="neutral" className="bg-amber-500/10 text-amber-300 border-amber-500/20 text-xs py-1 px-3">
                    <Clock className="w-3.5 h-3.5 mr-1.5 text-amber-400 inline" /> Pending Submission (30-day window)
                  </Badge>
                )}

                {/* Governance Buttons */}
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setActionError(null);
                      setAdminNotesInput('');
                      setVerifyModal('APPROVE');
                    }}
                    className="bg-teal-500/15 text-teal-300 border-teal-500/30 hover:bg-teal-500/25 text-xs h-8"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Approve & Verify
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setActionError(null);
                      setRejectionReasonInput('');
                      setAdminNotesInput('');
                      setVerifyModal('REJECT');
                    }}
                    className="bg-rose-500/15 text-rose-300 border-rose-500/30 hover:bg-rose-500/25 text-xs h-8"
                  >
                    <ShieldAlert className="w-3.5 h-3.5 mr-1.5" /> Request Resubmission
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setActionError(null);
                      setAdminNotesInput('');
                      setAdditionalDaysInput(30);
                      setVerifyModal('EXTEND');
                    }}
                    className="border-slate-700 bg-slate-800/40 text-slate-300 hover:bg-slate-800 text-xs h-8"
                  >
                    <Clock className="w-3.5 h-3.5 mr-1.5" /> Extend Deadline
                  </Button>
                </div>
              </div>
            </div>

            {/* Rejection / Resubmission Notice if present */}
            {credentials?.rejectionReason && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-200">
                <span className="font-semibold text-rose-300">Previous Rejection Note:</span>{' '}
                {credentials.rejectionReason}
              </div>
            )}

            {/* Metadata row */}
            {credentials && (
              <div className="grid gap-4 sm:grid-cols-4 rounded-xl border border-slate-800/80 bg-slate-950/40 p-4 text-xs">
                <div>
                  <span className="text-slate-500">Institution:</span>
                  <p className="font-medium text-slate-200">{credentials.institutionName || '—'}</p>
                </div>
                <div>
                  <span className="text-slate-500">Degree Program:</span>
                  <p className="font-medium text-slate-200">{credentials.degreeProgram || '—'}</p>
                </div>
                <div>
                  <span className="text-slate-500">Credential ID:</span>
                  <p className="font-medium text-slate-200 font-mono">{credentials.credentialIdNumber || '—'}</p>
                </div>
                <div>
                  <span className="text-slate-500">Compliance Deadline:</span>
                  <p className="font-medium text-slate-200">
                    {credentials.submissionDeadline ? new Date(credentials.submissionDeadline).toLocaleDateString() : '—'}
                  </p>
                </div>
              </div>
            )}

            {/* Uploaded Credential Cards */}
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Student ID Card */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-xl bg-teal-500/10 text-teal-300">
                      <IdCard className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-white">Student ID Card / Faculty Badge</h4>
                      <p className="text-[11px] text-slate-400">
                        {credentials?.hasStudentId ? credentials.studentIdFilename : 'No Student ID uploaded'}
                      </p>
                    </div>
                  </div>
                  {credentials?.studentIdSizeBytes && (
                    <span className="text-[11px] text-slate-500 font-mono">
                      {(credentials.studentIdSizeBytes / 1024).toFixed(1)} KB
                    </span>
                  )}
                </div>

                {credentials?.hasStudentId && (
                  <div className="mt-3.5 flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handlePreviewCredential('student-id')}
                      className="flex-1 border-slate-700 bg-slate-800/40 text-teal-300 hover:bg-teal-500/20 text-xs h-7"
                    >
                      <Eye className="w-3.5 h-3.5 mr-1" /> View ID Photo
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleDownloadCredential('student-id')}
                      className="border-slate-700 bg-slate-800/40 text-slate-300 hover:bg-slate-800 text-xs h-7 px-2.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Educational Certificate */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-500/10 text-cyan-300">
                      <GraduationCap className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-white">Last Educational Certificate / Degree</h4>
                      <p className="text-[11px] text-slate-400">
                        {credentials?.hasCertificate ? credentials.certificateFilename : 'No Certificate uploaded'}
                      </p>
                    </div>
                  </div>
                  {credentials?.certificateSizeBytes && (
                    <span className="text-[11px] text-slate-500 font-mono">
                      {(credentials.certificateSizeBytes / 1024).toFixed(1)} KB
                    </span>
                  )}
                </div>

                {credentials?.hasCertificate && (
                  <div className="mt-3.5 flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handlePreviewCredential('certificate')}
                      className="flex-1 border-slate-700 bg-slate-800/40 text-cyan-300 hover:bg-cyan-500/20 text-xs h-7"
                    >
                      <Eye className="w-3.5 h-3.5 mr-1" /> View Certificate
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleDownloadCredential('certificate')}
                      className="border-slate-700 bg-slate-800/40 text-slate-300 hover:bg-slate-800 text-xs h-7 px-2.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Application Supporting Documents */}
          <div className="space-y-4">
            <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 text-xs text-slate-300 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-teal-400 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-white">Privileged Credential & Application Records</span>
                <p className="text-slate-400 mt-0.5">
                  Supporting documents from initial application and ongoing credential verifications are stored in private object storage. Every view and download is strictly audited.
                </p>
              </div>
            </div>

          {documents.length === 0 ? (
            <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-12 text-center">
              <FileCheck className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-300 font-medium">No Supporting Documents</p>
              <p className="text-xs text-slate-500 mt-1">No verification documents have been uploaded for this account.</p>
            </div>
          ) : (
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950/80 border-b border-slate-800 text-xs text-slate-400 uppercase">
                  <tr>
                    <th scope="col" className="py-3 px-4">Document Type</th>
                    <th scope="col" className="py-3 px-4">Original Filename</th>
                    <th scope="col" className="py-3 px-4">MIME Type</th>
                    <th scope="col" className="py-3 px-4">Size</th>
                    <th scope="col" className="py-3 px-4">Uploaded</th>
                    <th scope="col" className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {documents.map((doc) => (
                    <tr key={doc.id} className="hover:bg-slate-800/30">
                      <td className="py-3 px-4">
                        <Badge variant="neutral" className="bg-teal-500/10 text-teal-300 border-teal-500/20 text-[11px]">
                          {doc.documentType}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 font-medium text-white">{doc.originalFilename}</td>
                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">{doc.mimeType}</td>
                      <td className="py-3 px-4 text-slate-400">{(doc.sizeBytes / 1024).toFixed(1)} KB</td>
                      <td className="py-3 px-4 text-slate-400">
                        {new Date(doc.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handlePreviewDocument(doc)}
                          className="border-slate-700 bg-slate-800/40 text-teal-300 hover:bg-teal-500/20 h-7 text-xs"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" /> View
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleDownloadDocument(doc)}
                          className="border-slate-700 bg-slate-800/40 text-slate-300 hover:bg-slate-800 h-7 text-xs"
                        >
                          <Download className="w-3.5 h-3.5 mr-1" /> Download
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          </div>
        </div>
      )}

      {/* Tab 3: Research Activity */}
      {activeTab === 'activity' && (
        <div className="space-y-6">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 text-center">
              <span className="text-2xl font-bold text-white">{activity?.ownedProjects.length ?? 0}</span>
              <span className="text-[11px] text-slate-400 block mt-0.5">Owned Projects</span>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 text-center">
              <span className="text-2xl font-bold text-white">{activity?.collaborations.length ?? 0}</span>
              <span className="text-[11px] text-slate-400 block mt-0.5">Collaborations</span>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 text-center">
              <span className="text-2xl font-bold text-white">{activity?.datasetRequests.length ?? 0}</span>
              <span className="text-[11px] text-slate-400 block mt-0.5">Dataset Requests</span>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 text-center">
              <span className="text-2xl font-bold text-white">{activity?.generatedDatasets.length ?? 0}</span>
              <span className="text-[11px] text-slate-400 block mt-0.5">Active Datasets</span>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 text-center">
              <span className="text-2xl font-bold text-white">{activity?.aiEvaluationRuns.length ?? 0}</span>
              <span className="text-[11px] text-slate-400 block mt-0.5">AI Evaluations</span>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 text-center">
              <span className="text-2xl font-bold text-white">{activity?.publications.length ?? 0}</span>
              <span className="text-[11px] text-slate-400 block mt-0.5">Publications</span>
            </div>
          </div>

          {/* Owned Projects */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <FolderGit2 className="w-4 h-4 text-teal-400" /> Research Projects
            </h3>
            {activity?.ownedProjects && activity.ownedProjects.length > 0 ? (
              <div className="divide-y divide-slate-800/60">
                {activity.ownedProjects.map((p) => (
                  <div key={p.id} className="py-2.5 flex items-center justify-between gap-4 text-xs">
                    <div>
                      <span className="font-semibold text-white block text-sm">{p.title}</span>
                      <span className="text-slate-400">Field: {p.researchField}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="neutral" className="text-[11px]">
                        {p.status}
                      </Badge>
                      <span className="text-slate-500 font-mono text-[11px]">
                        {new Date(p.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic py-2">No research projects owned by this researcher.</p>
            )}
          </div>

          {/* Dataset Requests & Generated Datasets */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Dataset Requests */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Database className="w-4 h-4 text-sky-400" /> Dataset Requests
              </h3>
              {activity?.datasetRequests && activity.datasetRequests.length > 0 ? (
                <div className="divide-y divide-slate-800/60 text-xs">
                  {activity.datasetRequests.map((r) => (
                    <div key={r.id} className="py-2.5 flex items-center justify-between">
                      <div>
                        <span className="font-medium text-white block">{r.name}</span>
                        <span className="text-slate-400 text-[11px]">Project: {r.projectTitle}</span>
                      </div>
                      <div className="text-right">
                        <Badge variant="neutral" className="text-[10px]">
                          {r.status}
                        </Badge>
                        <span className="text-slate-500 block text-[10px] mt-0.5">{r.requestedFormat}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic py-2">No dataset requests recorded.</p>
              )}
            </div>

            {/* Generated Datasets */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" /> Research Datasets (Metadata Only)
              </h3>
              {activity?.generatedDatasets && activity.generatedDatasets.length > 0 ? (
                <div className="divide-y divide-slate-800/60 text-xs">
                  {activity.generatedDatasets.map((d) => (
                    <div key={d.id} className="py-2.5 flex items-center justify-between">
                      <div>
                        <span className="font-medium text-white block">{d.name}</span>
                        <span className="text-slate-400 text-[11px]">Project: {d.projectTitle}</span>
                      </div>
                      <div className="text-right">
                        <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px]">
                          {d.status}
                        </Badge>
                        <span className="text-slate-500 block text-[10px] mt-0.5">
                          Created {new Date(d.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic py-2">No generated datasets found.</p>
              )}
            </div>
          </div>

          {/* AI Evaluation Runs & Publications */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* AI Evaluations */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" /> AI Evaluation Runs
              </h3>
              {activity?.aiEvaluationRuns && activity.aiEvaluationRuns.length > 0 ? (
                <div className="divide-y divide-slate-800/60 text-xs">
                  {activity.aiEvaluationRuns.map((e) => (
                    <div key={e.id} className="py-2.5 flex items-center justify-between">
                      <div>
                        <span className="font-medium text-white block">
                          {e.modelId} ({e.modelVersion})
                        </span>
                        <span className="text-slate-400 text-[11px]">
                          Task: {e.taskType} · Project: {e.projectTitle}
                        </span>
                      </div>
                      <Badge variant="neutral" className="text-[10px]">
                        {e.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic py-2">No AI evaluation runs conducted.</p>
              )}
            </div>

            {/* Publications */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" /> Scientific Publications
              </h3>
              {activity?.publications && activity.publications.length > 0 ? (
                <div className="divide-y divide-slate-800/60 text-xs">
                  {activity.publications.map((p) => (
                    <div key={p.id} className="py-2.5 flex items-center justify-between">
                      <div>
                        <span className="font-medium text-white block">{p.title}</span>
                        <span className="text-slate-400 text-[11px]">
                          {p.journal || 'Journal'} {p.doi ? `· DOI: ${p.doi}` : ''}
                        </span>
                      </div>
                      <Badge variant="neutral" className="text-[10px]">
                        {p.publicationType}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic py-2">No scientific publications registered.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Account & Security */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
              <span className="text-xs text-slate-400 block mb-1">Active Refresh Sessions</span>
              <span className="text-3xl font-bold text-white font-mono">{securitySummary.activeSessionsCount}</span>
              <p className="text-[11px] text-slate-500 mt-1">Currently active login tokens across devices</p>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
              <span className="text-xs text-slate-400 block mb-1">Account State</span>
              <span className="text-2xl font-bold text-teal-300">{securitySummary.accountStatus}</span>
              <p className="text-[11px] text-slate-500 mt-1">Global account authorization status</p>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
              <span className="text-xs text-slate-400 block mb-1">Last Authoritative Login</span>
              <span className="text-sm font-semibold text-white block">
                {securitySummary.lastLoginAt ? new Date(securitySummary.lastLoginAt).toLocaleString() : 'Never logged in'}
              </span>
              <p className="text-[11px] text-slate-500 mt-1">Recorded at last successful credential exchange</p>
            </div>
          </div>

          {/* Security Actions Card */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <ShieldAlert className="w-4 h-4 text-amber-400" /> Account Security Controls
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Administrative actions taken here directly affect the researcher&apos;s authentication eligibility. All actions
              require audit reasons and will immediately revoke active sessions when suspending.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              {account.accountStatus === 'ACTIVE' ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setActionModal('suspend');
                    setActionReason('');
                    setActionError(null);
                  }}
                  className="border-rose-500/30 text-rose-300 hover:bg-rose-500/20 hover:border-rose-500 text-xs"
                >
                  <Lock className="w-4 h-4 mr-1.5" /> Suspend Account
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setActionModal('reactivate');
                    setActionReason('');
                    setActionError(null);
                  }}
                  className="border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-500 text-xs"
                >
                  <Unlock className="w-4 h-4 mr-1.5" /> Reactivate Account
                </Button>
              )}

              <Button
                variant="secondary"
                onClick={() => {
                  setActionModal('revoke');
                  setActionReason('');
                  setActionError(null);
                }}
                className="border-slate-700 bg-slate-800/40 text-slate-300 hover:bg-slate-800 text-xs"
              >
                <KeyRound className="w-4 h-4 mr-1.5" /> Revoke All Active Sessions
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Audit History */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <History className="w-4 h-4 text-teal-400" /> Governance & Security Audit Events
            </h3>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => loadAuditEvents(auditPage)}
              disabled={loadingAudit}
              className="border-slate-800 bg-slate-900 text-xs h-7"
            >
              <RefreshCw className={cn('w-3.5 h-3.5 mr-1', loadingAudit && 'animate-spin')} /> Refresh Log
            </Button>
          </div>

          {loadingAudit ? (
            <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-8 text-center">
              <Loader2 className="w-6 h-6 text-teal-400 animate-spin mx-auto mb-2" />
              <p className="text-xs text-slate-400">Loading audit history...</p>
            </div>
          ) : auditEvents.length === 0 ? (
            <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-8 text-center text-xs text-slate-500">
              No audit events found for this researcher account.
            </div>
          ) : (
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase">
                  <tr>
                    <th scope="col" className="py-2.5 px-4">Action</th>
                    <th scope="col" className="py-2.5 px-4">Outcome</th>
                    <th scope="col" className="py-2.5 px-4">Timestamp</th>
                    <th scope="col" className="py-2.5 px-4">IP / User Agent</th>
                    <th scope="col" className="py-2.5 px-4">Metadata</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {auditEvents.map((evt) => (
                    <tr key={evt.id} className="hover:bg-slate-800/30">
                      <td className="py-2.5 px-4 font-mono font-medium text-slate-200">{evt.action}</td>
                      <td className="py-2.5 px-4">
                        <Badge
                          variant="neutral"
                          className={cn(
                            'text-[10px]',
                            evt.outcome === 'SUCCESS'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          )}
                        >
                          {evt.outcome}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-4 text-slate-400 whitespace-nowrap">
                        {new Date(evt.occurredAt).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4 text-slate-400 font-mono text-[11px] truncate max-w-[150px]">
                        {evt.ipAddress || '—'}
                      </td>
                      <td className="py-2.5 px-4 text-slate-300 truncate max-w-[200px]" title={evt.metadata || ''}>
                        {evt.metadata || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Audit Pagination */}
              {auditTotalPages > 1 && (
                <div className="bg-slate-950/80 px-4 py-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <span>Page {auditPage + 1} of {auditTotalPages}</span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={auditPage === 0}
                      onClick={() => loadAuditEvents(auditPage - 1)}
                      className="h-6 px-2 text-xs border-slate-800"
                    >
                      Prev
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={auditPage >= auditTotalPages - 1}
                      onClick={() => loadAuditEvents(auditPage + 1)}
                      className="h-6 px-2 text-xs border-slate-800"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Confirmation Dialogs for Security Actions */}
      <Dialog open={verifyModal !== null} onOpenChange={(open) => !open && setVerifyModal(null)}>
        <DialogContent className="sm:max-w-md bg-slate-900 border-slate-800 text-white">
          <DialogTitle className="text-base font-semibold">
            {verifyModal === 'APPROVE' && 'Approve & Verify Credentials'}
            {verifyModal === 'REJECT' && 'Request Credential Resubmission'}
            {verifyModal === 'EXTEND' && 'Extend Verification Deadline'}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-400">
            {verifyModal === 'APPROVE' &&
              'Confirm that you have reviewed the uploaded student/faculty ID and educational certificate. This marks the researcher account verified and removes all suspension risks.'}
            {verifyModal === 'REJECT' &&
              'Specify the reason why the credentials cannot be accepted (e.g. illegible certificate, expired ID). The researcher will be prompted to resubmit.'}
            {verifyModal === 'EXTEND' &&
              'Grant additional grace period days to this researcher for submitting their mandatory credentials.'}
          </DialogDescription>

          <div className="space-y-3 py-2">
            {verifyModal === 'REJECT' && (
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Rejection Reason <span className="text-rose-400">*</span>
                </label>
                <textarea
                  rows={3}
                  value={rejectionReasonInput}
                  onChange={(e) => setRejectionReasonInput(e.target.value)}
                  placeholder="e.g. The student ID card photo is blurry and does not display an expiration date."
                  className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-rose-500"
                />
              </div>
            )}

            {verifyModal === 'EXTEND' && (
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Additional Days
                </label>
                <select
                  value={additionalDaysInput}
                  onChange={(e) => setAdditionalDaysInput(Number(e.target.value))}
                  className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                >
                  <option value={14}>+14 Days (2 weeks)</option>
                  <option value={30}>+30 Days (1 month)</option>
                  <option value={60}>+60 Days (2 months)</option>
                </select>
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                Admin Audit Notes <span className="text-slate-500">(optional)</span>
              </label>
              <textarea
                rows={2}
                value={adminNotesInput}
                onChange={(e) => setAdminNotesInput(e.target.value)}
                placeholder="Internal audit notes..."
                className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-teal-500"
              />
            </div>

            {actionError && (
              <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-2 text-xs text-rose-300">
                {actionError}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button
              variant="secondary"
              size="sm"
              type="button"
              disabled={actionLoading}
              onClick={() => setVerifyModal(null)}
              className="border-slate-700 text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={actionLoading}
              onClick={handleAdminVerifyCredentials}
              className={`text-xs ${
                verifyModal === 'APPROVE'
                  ? 'bg-teal-500 text-slate-950 hover:bg-teal-400 font-semibold'
                  : verifyModal === 'REJECT'
                  ? 'bg-rose-500 text-white hover:bg-rose-600 font-semibold'
                  : 'bg-slate-700 text-white hover:bg-slate-600'
              }`}
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Action'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialogs for Security Actions */}
      <Dialog open={actionModal !== null} onOpenChange={(open) => !open && setActionModal(null)}>
        <DialogContent className="sm:max-w-md bg-slate-900 border-slate-800 text-white">
          <DialogTitle className="text-base font-semibold">
            {actionModal === 'suspend' && 'Suspend Researcher Account'}
            {actionModal === 'reactivate' && 'Reactivate Researcher Account'}
            {actionModal === 'revoke' && 'Revoke Active Sessions'}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-400">
            {actionModal === 'suspend' &&
              'Suspending this account immediately prevents the researcher from signing in and revokes all currently active refresh sessions. Their research projects and publications remain preserved.'}
            {actionModal === 'reactivate' &&
              'Reactivating this account restores the researcher’s eligibility to sign in and operate on their research workspace.'}
            {actionModal === 'revoke' &&
              'This will terminate all currently active session tokens across all devices for this researcher.'}
          </DialogDescription>

          <div className="space-y-3 py-2">
            <label className="text-xs font-medium text-slate-300 block">
              Reason / Justification <span className="text-slate-500">(audited)</span>
            </label>
            <textarea
              rows={3}
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              placeholder="Provide a reason for this administrative security action..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
            />
            {actionError && <p className="text-xs text-rose-400 font-medium">{actionError}</p>}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={actionLoading}
              onClick={() => setActionModal(null)}
              className="border-slate-800 text-slate-300"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={actionLoading}
              onClick={handleSecurityAction}
              className={cn(
                'text-xs font-semibold',
                actionModal === 'suspend'
                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                  : 'bg-teal-600 hover:bg-teal-700 text-white'
              )}
            >
              {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
              Confirm Action
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Document Preview Modal */}
      <Dialog
        open={previewDoc !== null}
        onOpenChange={(open) => {
          if (!open) {
            if (previewBlobUrl) {
              URL.revokeObjectURL(previewBlobUrl);
              setPreviewBlobUrl(null);
            }
            setPreviewDoc(null);
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[85vh] bg-slate-900 border-slate-800 text-white flex flex-col p-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <DialogTitle className="text-base font-semibold text-white">{previewDoc?.originalFilename}</DialogTitle>
              <DialogDescription className="text-xs text-slate-400 font-mono mt-0.5">
                {previewDoc?.mimeType} · {previewDoc ? (previewDoc.sizeBytes / 1024).toFixed(1) : ''} KB · Type:{' '}
                {previewDoc?.documentType}
              </DialogDescription>
            </div>
            {previewDoc && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleDownloadDocument(previewDoc)}
                className="border-slate-700 bg-slate-800 text-xs h-7"
              >
                <Download className="w-3.5 h-3.5 mr-1" /> Download
              </Button>
            )}
          </div>

          <div className="flex-1 overflow-auto min-h-[350px] flex items-center justify-center p-2 my-2 bg-slate-950 rounded-lg border border-slate-800/80">
            {previewLoading ? (
              <div className="text-center p-8">
                <Loader2 className="w-8 h-8 text-teal-400 animate-spin mx-auto mb-2" />
                <p className="text-xs text-slate-400">Loading document securely from object storage...</p>
              </div>
            ) : previewError ? (
              <div className="text-center p-8 text-rose-400">
                <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
                <p className="text-xs font-medium">{previewError}</p>
              </div>
            ) : previewBlobUrl ? (
              previewDoc?.mimeType.startsWith('image/') ? (
                <img
                  src={previewBlobUrl}
                  alt={previewDoc.originalFilename}
                  className="max-h-[60vh] max-w-full object-contain rounded"
                />
              ) : previewDoc?.mimeType === 'application/pdf' ? (
                <iframe src={previewBlobUrl} className="w-full h-[60vh] rounded" title="Document Preview" />
              ) : (
                <div className="text-center p-8">
                  <FileText className="w-12 h-12 text-slate-500 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-300">Inline preview not supported for this file type</p>
                  <p className="text-xs text-slate-500 mt-1 mb-3">Download the file to inspect its contents</p>
                  <Button
                    size="sm"
                    onClick={() => previewDoc && handleDownloadDocument(previewDoc)}
                    className="bg-teal-600 hover:bg-teal-700 text-white text-xs"
                  >
                    <Download className="w-3.5 h-3.5 mr-1" /> Download Document
                  </Button>
                </div>
              )
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
