import { useEffect, useState, useRef, type ChangeEvent } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Award,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileCheck,
  FileText,
  GraduationCap,
  IdCard,
  Loader2,
  RefreshCw,
  ShieldAlert,
  UploadCloud,
  X,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { FormNotice } from '../../features/auth/auth-ui';
import {
  researchCredentialsApi,
  type ResearcherCredentialView,
} from '../../features/research/research-credentials-api';

function formatCountdown(totalSeconds: number): string {
  if (totalSeconds <= 0) return '0 days (Expired)';
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (days > 0) {
    return `${days} day${days === 1 ? '' : 's'}, ${hours} hour${hours === 1 ? '' : 's'}`;
  }
  if (hours > 0) {
    return `${hours} hour${hours === 1 ? '' : 's'}, ${minutes} minute${minutes === 1 ? '' : 's'}`;
  }
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

export function ResearchCredentialsPage() {
  const [data, setData] = useState<ResearcherCredentialView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states
  const [institutionName, setInstitutionName] = useState('');
  const [degreeProgram, setDegreeProgram] = useState('');
  const [credentialIdNumber, setCredentialIdNumber] = useState('');
  const [studentIdFile, setStudentIdFile] = useState<File | null>(null);
  const [certFile, setCertFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showResubmitForm, setShowResubmitForm] = useState(false);

  // Document preview modal
  const [previewDocType, setPreviewDocType] = useState<'student-id' | 'certificate' | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewMimeType, setPreviewMimeType] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [downloadingDocType, setDownloadingDocType] = useState<'student-id' | 'certificate' | null>(null);

  const studentIdInputRef = useRef<HTMLInputElement>(null);
  const certInputRef = useRef<HTMLInputElement>(null);

  const openPreview = async (docType: 'student-id' | 'certificate') => {
    setPreviewDocType(docType);
    setPreviewLoading(true);
    setPreviewError(null);
    if (previewBlobUrl) {
      URL.revokeObjectURL(previewBlobUrl);
      setPreviewBlobUrl(null);
    }
    try {
      const { url, mimeType } = await researchCredentialsApi.getDocumentBlob(docType);
      setPreviewBlobUrl(url);
      setPreviewMimeType(mimeType);
    } catch (err: any) {
      setPreviewError(err?.message || 'Failed to load document for preview.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    if (previewBlobUrl) {
      URL.revokeObjectURL(previewBlobUrl);
      setPreviewBlobUrl(null);
    }
    setPreviewDocType(null);
    setPreviewError(null);
    setPreviewMimeType(null);
  };

  const handleDownload = async (docType: 'student-id' | 'certificate', defaultFilename: string) => {
    try {
      setDownloadingDocType(docType);
      await researchCredentialsApi.downloadDocument(docType, defaultFilename);
    } catch (err: any) {
      setError(err?.message || 'Failed to download document.');
    } finally {
      setDownloadingDocType(null);
    }
  };

  useEffect(() => {
    return () => {
      if (previewBlobUrl) {
        URL.revokeObjectURL(previewBlobUrl);
      }
    };
  }, [previewBlobUrl]);

  const loadCredentials = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await researchCredentialsApi.getMyCredentials();
      setData(res);
      if (res.institutionName) setInstitutionName(res.institutionName);
      if (res.degreeProgram) setDegreeProgram(res.degreeProgram);
      if (res.credentialIdNumber) setCredentialIdNumber(res.credentialIdNumber);
    } catch (err: any) {
      setError(err?.message || 'Failed to load credential verification status.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCredentials();
  }, []);

  const handleStudentIdChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setStudentIdFile(e.target.files[0]);
    }
  };

  const handleCertChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setCertFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!institutionName.trim() || !degreeProgram.trim() || !credentialIdNumber.trim()) {
      setError('Please fill in all institution and credential metadata fields.');
      return;
    }
    if (!studentIdFile) {
      setError('Please upload your Student ID Card picture or Institutional Faculty Badge.');
      return;
    }
    if (!certFile) {
      setError('Please upload your Last Educational Certificate or Degree document.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setSuccessMsg(null);
      const updated = await researchCredentialsApi.submitCredentials(
        {
          institutionName: institutionName.trim(),
          degreeProgram: degreeProgram.trim(),
          credentialIdNumber: credentialIdNumber.trim(),
        },
        studentIdFile,
        certFile,
      );
      setData(updated);
      setShowResubmitForm(false);
      setSuccessMsg('Your credentials have been successfully submitted for institutional admin verification.');
    } catch (err: any) {
      setError(err?.message || 'Failed to submit credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-400" />
      </div>
    );
  }

  const isVerified = data?.verificationStatus === 'VERIFIED';
  const isSubmitted = data?.verificationStatus === 'SUBMITTED';
  const isRejected = data?.verificationStatus === 'REJECTED';
  const isPending = data?.verificationStatus === 'PENDING_SUBMISSION';
  const isExpired = data?.isExpired || data?.verificationStatus === 'EXPIRED';

  const shouldShowForm = isPending || isRejected || showResubmitForm || !data?.hasStudentId;

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-2.5">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-teal-500/10 text-teal-300">
            <Award className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Institutional Credentials & Verification
            </h1>
            <p className="text-sm text-slate-400">
              Submit your student ID or institutional badge and educational certificate for administrative compliance.
            </p>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {error && <FormNotice tone="error">{error}</FormNotice>}
      {successMsg && <FormNotice tone="success">{successMsg}</FormNotice>}

      {/* Status & Countdown Overview Card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-slate-300">Verification Status:</span>
              {isVerified && (
                <Badge variant="neutral" className="border-teal-500/30 bg-teal-500/15 text-teal-300">
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-teal-400" />
                  Credentials Verified
                </Badge>
              )}
              {isSubmitted && (
                <Badge variant="neutral" className="border-cyan-500/30 bg-cyan-500/15 text-cyan-300">
                  <Clock className="mr-1.5 h-3.5 w-3.5 text-cyan-400" />
                  Under Admin Review
                </Badge>
              )}
              {isPending && (
                <Badge variant="neutral" className="border-amber-500/30 bg-amber-500/15 text-amber-300">
                  <AlertTriangle className="mr-1.5 h-3.5 w-3.5 text-amber-400" />
                  Pending Submission
                </Badge>
              )}
              {isRejected && (
                <Badge variant="danger" className="text-xs">
                  <ShieldAlert className="mr-1.5 h-3.5 w-3.5" />
                  Resubmission Required
                </Badge>
              )}
              {isExpired && (
                <Badge variant="danger" className="text-xs">
                  <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />
                  Grace Period Expired
                </Badge>
              )}
            </div>

            <p className="text-xs leading-5 text-slate-400">
              {isVerified && 'Your identity and academic credentials have been verified by an institutional administrator. Your account is in good standing.'}
              {isSubmitted && 'Your documents were submitted and are currently in the administrator review queue. Verification typically completes within 1-2 business days.'}
              {isPending && 'All newly onboarded researchers must submit institutional credentials within 30 days. Accounts without verified credentials are automatically suspended.'}
              {isRejected && 'Your previous credential submission could not be verified. Please review the administrator feedback below and upload updated documents.'}
              {isExpired && 'The 30-day compliance window has expired without verified credentials. Please submit your valid credentials immediately.'}
            </p>
          </div>

          {/* Countdown timer pill */}
          {!isVerified && data && (
            <div className={`rounded-xl border p-4 text-center sm:min-w-[220px] ${
              isExpired
                ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                : data.secondsRemaining < 7 * 86400
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                  : 'border-slate-800 bg-slate-950/70 text-slate-200'
            }`}>
              <div className="flex items-center justify-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold">
                <Clock className="h-3.5 w-3.5" />
                <span>Verification Deadline</span>
              </div>
              <p className="mt-1 font-mono text-lg font-bold">
                {isExpired ? 'EXPIRED' : formatCountdown(data.secondsRemaining)}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                Due: {new Date(data.submissionDeadline).toLocaleDateString()}
              </p>
            </div>
          )}
        </div>

        {/* Rejection notice if rejected */}
        {isRejected && data?.rejectionReason && (
          <div className="mt-5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-200">
            <p className="font-semibold text-rose-300 flex items-center gap-1.5">
              <ShieldAlert className="h-4 w-4" /> Administrator Feedback / Rejection Note:
            </p>
            <p className="mt-1 text-slate-200">{data.rejectionReason}</p>
          </div>
        )}
      </div>

      {/* Uploaded Documents Showcase (When already submitted or verified) */}
      {data && data.hasStudentId && !showResubmitForm && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Current Uploaded Documents</h2>
            {(isRejected || isVerified || isSubmitted) && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowResubmitForm(true)}
                className="border-slate-700 bg-slate-800/60 text-xs text-slate-200 hover:bg-slate-700"
              >
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Upload New / Updated Files
              </Button>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Student ID Card */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-teal-500/10 text-teal-300">
                    <IdCard className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">Student / Institutional ID Card</h3>
                    <p className="text-xs text-slate-400">{data.studentIdFilename || 'ID Card Document'}</p>
                  </div>
                </div>
                {data.studentIdSizeBytes && (
                  <span className="text-xs text-slate-500 font-mono">
                    {(data.studentIdSizeBytes / 1024).toFixed(1)} KB
                  </span>
                )}
              </div>

              <div className="mt-4 flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => openPreview('student-id')}
                  className="flex-1 border-slate-700 bg-slate-800/40 text-teal-300 hover:bg-teal-500/20 text-xs h-8"
                >
                  <Eye className="mr-1.5 h-3.5 w-3.5" /> Preview
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={downloadingDocType === 'student-id'}
                  onClick={() => handleDownload('student-id', data.studentIdFilename || 'student-id')}
                  className="border-slate-700 bg-slate-800/40 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                >
                  {downloadingDocType === 'student-id' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>

            {/* Educational Certificate */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-500/10 text-cyan-300">
                    <GraduationCap className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">Last Educational Certificate</h3>
                    <p className="text-xs text-slate-400">{data.certificateFilename || 'Certificate Document'}</p>
                  </div>
                </div>
                {data.certificateSizeBytes && (
                  <span className="text-xs text-slate-500 font-mono">
                    {(data.certificateSizeBytes / 1024).toFixed(1)} KB
                  </span>
                )}
              </div>

              <div className="mt-4 flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => openPreview('certificate')}
                  className="flex-1 border-slate-700 bg-slate-800/40 text-cyan-300 hover:bg-cyan-500/20 text-xs h-8"
                >
                  <Eye className="mr-1.5 h-3.5 w-3.5" /> Preview
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={downloadingDocType === 'certificate'}
                  onClick={() => handleDownload('certificate', data.certificateFilename || 'certificate')}
                  className="border-slate-700 bg-slate-800/40 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                >
                  {downloadingDocType === 'certificate' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Academic Metadata Summary */}
          {data.institutionName && (
            <div className="rounded-xl border border-slate-800/80 bg-slate-900/30 p-4 text-xs">
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <span className="text-slate-500">Institution:</span>
                  <p className="font-medium text-slate-200">{data.institutionName}</p>
                </div>
                <div>
                  <span className="text-slate-500">Degree / Program:</span>
                  <p className="font-medium text-slate-200">{data.degreeProgram}</p>
                </div>
                <div>
                  <span className="text-slate-500">Credential ID Number:</span>
                  <p className="font-medium text-slate-200 font-mono">{data.credentialIdNumber}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Submission Form */}
      {shouldShowForm && (
        <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-lg font-semibold text-white">
                {showResubmitForm ? 'Resubmit Verification Documents' : 'Submit Credentials for Verification'}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Upload clear, legible photos or scans of your credentials. Accepted formats: PDF, JPEG, PNG (max 15MB each).
              </p>
            </div>
            {showResubmitForm && (
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => setShowResubmitForm(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </Button>
            )}
          </div>

          {/* Institutional Metadata Inputs */}
          <div className="grid gap-5 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Institution / University Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={institutionName}
                onChange={(e) => setInstitutionName(e.target.value)}
                placeholder="e.g. Stanford University"
                required
                className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3.5 py-2.5 text-xs text-white placeholder-slate-600 outline-none focus:border-teal-500/50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Degree Program / Department <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={degreeProgram}
                onChange={(e) => setDegreeProgram(e.target.value)}
                placeholder="e.g. M.Sc. Bioinformatics"
                required
                className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3.5 py-2.5 text-xs text-white placeholder-slate-600 outline-none focus:border-teal-500/50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Student ID / Staff ID Number <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={credentialIdNumber}
                onChange={(e) => setCredentialIdNumber(e.target.value)}
                placeholder="e.g. STU-2024-8849"
                required
                className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3.5 py-2.5 text-xs text-white placeholder-slate-600 outline-none focus:border-teal-500/50"
              />
            </div>
          </div>

          {/* Document Upload Dropzones */}
          <div className="grid gap-6 sm:grid-cols-2">
            {/* Student ID Card Uploader */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>1. Student ID Card Picture / Faculty Badge <span className="text-rose-400">*</span></span>
                {studentIdFile && <span className="text-[11px] text-teal-400 font-mono">{(studentIdFile.size / 1024).toFixed(1)} KB</span>}
              </label>

              <input
                type="file"
                ref={studentIdInputRef}
                onChange={handleStudentIdChange}
                accept="image/*,.pdf"
                className="hidden"
              />

              <div
                onClick={() => studentIdInputRef.current?.click()}
                className={`flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition ${
                  studentIdFile
                    ? 'border-teal-500/50 bg-teal-500/5'
                    : 'border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-950/80'
                }`}
              >
                {studentIdFile ? (
                  <div className="space-y-1">
                    <FileCheck className="mx-auto h-8 w-8 text-teal-400" />
                    <p className="text-xs font-semibold text-white">{studentIdFile.name}</p>
                    <p className="text-[11px] text-teal-300">File selected — click to replace</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <UploadCloud className="mx-auto h-8 w-8 text-slate-500" />
                    <p className="text-xs font-semibold text-slate-200">Upload Student ID Photo</p>
                    <p className="text-[11px] text-slate-500">Drag & drop or click to browse (PDF, PNG, JPG)</p>
                  </div>
                )}
              </div>
            </div>

            {/* Last Educational Certificate Uploader */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>2. Last Educational Certificate / Degree <span className="text-rose-400">*</span></span>
                {certFile && <span className="text-[11px] text-cyan-400 font-mono">{(certFile.size / 1024).toFixed(1)} KB</span>}
              </label>

              <input
                type="file"
                ref={certInputRef}
                onChange={handleCertChange}
                accept="image/*,.pdf"
                className="hidden"
              />

              <div
                onClick={() => certInputRef.current?.click()}
                className={`flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition ${
                  certFile
                    ? 'border-cyan-500/50 bg-cyan-500/5'
                    : 'border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-950/80'
                }`}
              >
                {certFile ? (
                  <div className="space-y-1">
                    <FileCheck className="mx-auto h-8 w-8 text-cyan-400" />
                    <p className="text-xs font-semibold text-white">{certFile.name}</p>
                    <p className="text-[11px] text-cyan-300">File selected — click to replace</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <UploadCloud className="mx-auto h-8 w-8 text-slate-500" />
                    <p className="text-xs font-semibold text-slate-200">Upload Educational Certificate</p>
                    <p className="text-[11px] text-slate-500">Drag & drop or click to browse (PDF, PNG, JPG)</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Submit Action */}
          <div className="flex items-center justify-between border-t border-slate-800 pt-4">
            <p className="text-[11px] text-slate-500">
              By submitting, you certify that all uploaded credentials are authentic and represent your current academic standing.
            </p>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-gradient-to-r from-teal-500 to-cyan-500 font-semibold text-slate-950 hover:opacity-90"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting…
                </>
              ) : (
                'Submit Credentials for Verification'
              )}
            </Button>
          </div>
        </form>
      )}

      {/* Document Preview Modal */}
      {previewDocType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="relative flex h-[85vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-teal-400" />
                <div>
                  <h3 className="font-semibold text-white">
                    {previewDocType === 'student-id' ? 'Student ID Card Preview' : 'Educational Certificate Preview'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {previewDocType === 'student-id' ? data?.studentIdFilename : data?.certificateFilename}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {previewBlobUrl && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      const filename = previewDocType === 'student-id'
                        ? (data?.studentIdFilename || 'student-id')
                        : (data?.certificateFilename || 'certificate');
                      void handleDownload(previewDocType, filename);
                    }}
                    className="border-slate-700 bg-slate-800 text-xs h-8 text-slate-200"
                  >
                    <Download className="mr-1.5 h-3.5 w-3.5" /> Download
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={closePreview}
                  className="h-8 w-8 p-0 text-slate-400 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-950">
              {previewLoading && (
                <div className="flex flex-col items-center gap-3 text-slate-400">
                  <Loader2 className="h-8 w-8 animate-spin text-teal-400" />
                  <p className="text-xs">Loading secure document preview…</p>
                </div>
              )}
              {previewError && (
                <div className="flex flex-col items-center gap-3 text-center text-rose-400 max-w-sm">
                  <AlertCircle className="h-8 w-8 text-rose-500" />
                  <p className="text-xs">{previewError}</p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => openPreview(previewDocType)}
                    className="border-slate-700 text-xs text-white"
                  >
                    Retry
                  </Button>
                </div>
              )}
              {!previewLoading && !previewError && previewBlobUrl && (
                (previewMimeType?.toLowerCase().includes('pdf') ||
                 (previewDocType === 'student-id'
                   ? data?.studentIdFilename?.toLowerCase().endsWith('.pdf')
                   : data?.certificateFilename?.toLowerCase().endsWith('.pdf'))) ? (
                  <iframe
                    src={previewBlobUrl}
                    title="Document Preview"
                    className="h-full w-full rounded-lg border-0 bg-slate-950"
                  />
                ) : (
                  <img
                    src={previewBlobUrl}
                    alt="Document Preview"
                    className="max-h-[70vh] max-w-full rounded-lg object-contain shadow-2xl"
                  />
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
