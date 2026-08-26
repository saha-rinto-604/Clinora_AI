import {
  CheckCircle2,
  Download,
  Eye,
  FileText,
  LoaderCircle,
  MessageSquarePlus,
  PlayCircle,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../components/ui/dialog';
import { FormField, Label, Select, Textarea } from '../../components/ui/form';
import { adminAccessReviewApi, reviewErrorMessage } from '../../features/admin-access-reviews/admin-access-review-api';
import { DoctorInterviewAdminPanel } from '../../features/admin-access-reviews/doctor-interview-admin-panel';
import type {
  AccessReviewDetail,
  AccessReviewQueueItem,
  PageView,
} from '../../features/admin-access-reviews/admin-access-review-types';
import type {
  ApplicationDocument,
  ApplicationStatus,
  ApplicationType,
} from '../../features/access-applications/application-types';
import { cn } from '../../lib/cn';

const reviewStatuses: ApplicationStatus[] = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'MORE_INFO_REQUIRED',
  'INTERVIEW_REQUIRED',
  'INTERVIEW_SCHEDULED',
  'INTERVIEW_COMPLETED',
];
const applicationTypes: ApplicationType[] = ['DOCTOR', 'RESEARCHER'];

interface DocumentPreviewState {
  document: ApplicationDocument;
  url: string | null;
  contentType: string;
  filename: string;
  loading: boolean;
  error: string;
}

export function AccessReviewsPage() {
  const [applicationType, setApplicationType] = useState<ApplicationType | ''>('');
  const [status, setStatus] = useState<ApplicationStatus | ''>('');
  const [queue, setQueue] = useState<PageView<AccessReviewQueueItem> | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AccessReviewDetail | null>(null);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [queueError, setQueueError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [noteText, setNoteText] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoMessage, setInfoMessage] = useState('');
  const [infoSaving, setInfoSaving] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectSaving, setRejectSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [preview, setPreview] = useState<DocumentPreviewState | null>(null);

  const loadQueue = useCallback(async () => {
    setLoadingQueue(true);
    setQueueError('');
    try {
      const data = await adminAccessReviewApi.queue({
        applicationType: applicationType || undefined,
        status: status || undefined,
        page: 0,
        size: 20,
      });
      setQueue(data);
      setSelectedId((current) => current ?? data.items[0]?.id ?? null);
    } catch (error) {
      setQueueError(reviewErrorMessage(error, 'Access review queue could not be loaded.'));
    } finally {
      setLoadingQueue(false);
    }
  }, [applicationType, status]);

  const loadDetail = useCallback(async (applicationId: string) => {
    setLoadingDetail(true);
    setDetailError('');
    try {
      setDetail(await adminAccessReviewApi.detail(applicationId));
    } catch (error) {
      setDetailError(reviewErrorMessage(error, 'Application review details could not be loaded.'));
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
  }, [loadDetail, selectedId]);

  const selected = useMemo(
    () => queue?.items.find((item) => item.id === selectedId) ?? null,
    [queue?.items, selectedId],
  );

  async function startReview() {
    if (!detail) return;
    setActionMessage('');
    try {
      const next = await adminAccessReviewApi.startReview(detail.id);
      setDetail(next);
      setActionMessage('Review started.');
      await loadQueue();
    } catch (error) {
      setDetailError(reviewErrorMessage(error, 'Review could not be started.'));
    }
  }

  async function addNote() {
    if (!detail || !noteText.trim()) return;
    setNoteSaving(true);
    setActionMessage('');
    try {
      const next = await adminAccessReviewApi.addNote(detail.id, noteText);
      setDetail(next);
      setNoteText('');
      setActionMessage('Internal note saved.');
    } catch (error) {
      setDetailError(reviewErrorMessage(error, 'Internal note could not be saved.'));
    } finally {
      setNoteSaving(false);
    }
  }

  async function requestMoreInformation() {
    if (!detail || !infoMessage.trim()) return;
    setInfoSaving(true);
    setActionMessage('');
    try {
      const next = await adminAccessReviewApi.requestMoreInformation(detail.id, infoMessage);
      setDetail(next);
      setInfoMessage('');
      setInfoOpen(false);
      setActionMessage('Information request sent.');
      await loadQueue();
    } catch (error) {
      setDetailError(reviewErrorMessage(error, 'Information request could not be sent.'));
    } finally {
      setInfoSaving(false);
    }
  }

  async function approveApplication() {
    if (!detail) return;
    setApproving(true);
    setActionMessage('');
    try {
      const next = await adminAccessReviewApi.approve(detail.id);
      setDetail(next);
      setActionMessage('Application approved. Activation link sent.');
      await loadQueue();
    } catch (error) {
      setDetailError(reviewErrorMessage(error, 'Application could not be approved.'));
    } finally {
      setApproving(false);
    }
  }

  async function rejectApplication() {
    if (!detail || !rejectReason.trim()) return;
    setRejectSaving(true);
    setActionMessage('');
    try {
      const next = await adminAccessReviewApi.reject(detail.id, rejectReason);
      setDetail(next);
      setRejectReason('');
      setRejectOpen(false);
      setActionMessage('Application rejected.');
      await loadQueue();
    } catch (error) {
      setDetailError(reviewErrorMessage(error, 'Application could not be rejected.'));
    } finally {
      setRejectSaving(false);
    }
  }

  const closePreview = useCallback(() => {
    setPreview((current) => {
      if (current?.url) URL.revokeObjectURL(current.url);
      return null;
    });
  }, []);

  useEffect(() => {
    const url = preview?.url;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [preview?.url]);

  async function openDocument(document: ApplicationDocument) {
    if (!detail) return;
    closePreview();
    setDetailError('');
    setActionMessage('');
    setPreview({
      document,
      url: null,
      contentType: document.mimeType,
      filename: document.originalFilename,
      loading: true,
      error: '',
    });
    try {
      const file = await adminAccessReviewApi.downloadDocument(detail.id, document.id);
      const url = URL.createObjectURL(file.blob);
      setPreview({
        document,
        url,
        contentType: file.contentType || document.mimeType,
        filename: file.filename || document.originalFilename,
        loading: false,
        error: '',
      });
    } catch (error) {
      setPreview((current) =>
        current?.document.id === document.id
          ? {
              ...current,
              loading: false,
              error: reviewErrorMessage(error, 'Document could not be retrieved securely.'),
            }
          : current,
      );
    }
  }

  async function downloadDocument(document: ApplicationDocument) {
    if (!detail) return;
    setDetailError('');
    setActionMessage('');
    try {
      const file = await adminAccessReviewApi.downloadDocument(detail.id, document.id);
      const url = URL.createObjectURL(file.blob);
      const anchor = window.document.createElement('a');
      anchor.href = url;
      anchor.download = file.filename || document.originalFilename;
      anchor.rel = 'noopener';
      anchor.click();
      URL.revokeObjectURL(url);
      setActionMessage('Document downloaded securely.');
    } catch (error) {
      setDetailError(reviewErrorMessage(error, 'Document could not be downloaded securely.'));
    }
  }

  function downloadPreview() {
    if (!preview?.url) return;
    const anchor = window.document.createElement('a');
    anchor.href = preview.url;
    anchor.download = preview.filename;
    anchor.rel = 'noopener';
    anchor.click();
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[390px_minmax(0,1fr)] lg:px-8">
        <section className="grid gap-4 self-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">System Admin</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-white">Access Reviews</h1>
          </div>

          <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.045] p-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField>
                <Label htmlFor="applicationType">Type</Label>
                <Select
                  id="applicationType"
                  value={applicationType}
                  onChange={(event) => {
                    setSelectedId(null);
                    setApplicationType(event.target.value as ApplicationType | '');
                  }}
                >
                  <option value="">All</option>
                  {applicationTypes.map((type) => (
                    <option key={type} value={type}>
                      {label(type)}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField>
                <Label htmlFor="status">Status</Label>
                <Select
                  id="status"
                  value={status}
                  onChange={(event) => {
                    setSelectedId(null);
                    setStatus(event.target.value as ApplicationStatus | '');
                  }}
                >
                  <option value="">All reviewable</option>
                  {reviewStatuses.map((item) => (
                    <option key={item} value={item}>
                      {label(item)}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>
            <Button variant="secondary" className="justify-center" onClick={() => void loadQueue()}>
              <RefreshCw size={16} aria-hidden="true" />
              Refresh
            </Button>
          </div>

          <div className="grid gap-3" aria-live="polite">
            {loadingQueue ? <StateMessage text="Loading review queue..." /> : null}
            {queueError ? <StateMessage tone="error" text={queueError} /> : null}
            {!loadingQueue && !queueError && queue?.items.length === 0 ? (
              <StateMessage text="No submitted applications match the current filters." />
            ) : null}
            {queue?.items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                className={cn(
                  'grid gap-2 rounded-2xl border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-cyan-300/50',
                  item.id === selectedId
                    ? 'border-cyan-300/45 bg-cyan-300/[0.08]'
                    : 'border-white/10 bg-white/[0.035] hover:border-white/20',
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-white">
                    {item.firstName} {item.lastName}
                  </span>
                  <Badge variant={item.applicationType === 'DOCTOR' ? 'info' : 'success'}>
                    {label(item.applicationType)}
                  </Badge>
                </div>
                <span className="text-sm text-slate-300">{item.email}</span>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <Badge variant="neutral">{label(item.status)}</Badge>
                  <span>Submitted {formatDate(item.submittedAt)}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="min-h-[70vh] rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-6">
          {!selected && !loadingDetail ? <StateMessage text="Select an application to open review details." /> : null}
          {loadingDetail ? <StateMessage text="Loading application detail..." /> : null}
          {detailError ? <StateMessage tone="error" text={detailError} /> : null}
          {actionMessage ? <StateMessage tone="success" text={actionMessage} /> : null}
          {detail && !loadingDetail ? (
            <div className="grid gap-6">
              <header className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={detail.applicationType === 'DOCTOR' ? 'info' : 'success'}>
                      {label(detail.applicationType)}
                    </Badge>
                    <Badge variant="warning">{label(detail.status)}</Badge>
                  </div>
                  <h2 className="mt-3 text-2xl font-semibold tracking-normal text-white">
                    {detail.firstName} {detail.lastName}
                  </h2>
                  <p className="mt-1 text-sm text-slate-300">{detail.email}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {detail.allowedNextStatuses.includes('UNDER_REVIEW') ? (
                    <Button onClick={() => void startReview()}>
                      <PlayCircle size={16} aria-hidden="true" />
                      Start Review
                    </Button>
                  ) : null}
                  {detail.allowedNextStatuses.includes('MORE_INFO_REQUIRED') ? (
                    <Button variant="secondary" onClick={() => setInfoOpen(true)}>
                      <MessageSquarePlus size={16} aria-hidden="true" />
                      Request More Information
                    </Button>
                  ) : null}
                  {detail.allowedNextStatuses.includes('ACTIVATION_PENDING') ? (
                    <Button onClick={() => void approveApplication()} disabled={approving}>
                      {approving ? (
                        <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
                      ) : (
                        <CheckCircle2 size={16} aria-hidden="true" />
                      )}
                      Approve
                    </Button>
                  ) : null}
                  {detail.allowedNextStatuses.includes('REJECTED') ? (
                    <Button variant="secondary" onClick={() => setRejectOpen(true)}>
                      <XCircle size={16} aria-hidden="true" />
                      Reject
                    </Button>
                  ) : null}
                </div>
              </header>

              <DetailGrid
                detail={detail}
                onView={(document) => void openDocument(document)}
                onDownload={(document) => void downloadDocument(document)}
              />

              {detail.applicationType === 'DOCTOR' ? (
                <DoctorInterviewAdminPanel
                  applicationId={detail.id}
                  applicationStatus={detail.status}
                  onChanged={async () => {
                    await Promise.all([loadQueue(), loadDetail(detail.id)]);
                  }}
                />
              ) : null}

              <section className="grid gap-3">
                <h3 className="text-lg font-semibold text-white">Internal Reviewer Notes</h3>
                <div className="grid gap-3">
                  <Textarea
                    value={noteText}
                    onChange={(event) => setNoteText(event.target.value)}
                    maxLength={2000}
                    placeholder="Add an internal note for System Admin reviewers."
                    aria-label="Internal review note"
                  />
                  <Button
                    className="justify-self-start"
                    onClick={() => void addNote()}
                    disabled={!noteText.trim() || noteSaving}
                  >
                    {noteSaving ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : null}
                    Add Internal Note
                  </Button>
                </div>
                <div className="grid gap-2">
                  {detail.internalNotes.length === 0 ? (
                    <p className="text-sm text-slate-400">No internal notes yet.</p>
                  ) : null}
                  {detail.internalNotes.map((note) => (
                    <article key={note.id} className="rounded-xl border border-white/10 bg-slate-950/45 p-3">
                      <p className="text-sm leading-6 text-slate-200">{note.text}</p>
                      <p className="mt-2 text-xs text-slate-500">
                        Reviewer {note.reviewerUserId} · {formatDate(note.createdAt)}
                      </p>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          ) : null}
        </section>
      </div>

      <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
        <DialogContent>
          <DialogTitle>Request More Information</DialogTitle>
          <DialogDescription className="text-sm leading-6 text-slate-400">
            This message is visible to the applicant in their secure portal.
          </DialogDescription>
          <Textarea
            value={infoMessage}
            onChange={(event) => setInfoMessage(event.target.value)}
            maxLength={500}
            placeholder="Please provide updated qualification evidence."
            aria-label="Applicant-facing information request"
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setInfoOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void requestMoreInformation()} disabled={!infoMessage.trim() || infoSaving}>
              {infoSaving ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : null}
              Send Request
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogTitle>Reject Application</DialogTitle>
          <DialogDescription className="text-sm leading-6 text-slate-400">
            This reason is visible to the applicant and included in the decision email.
          </DialogDescription>
          <Textarea
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            maxLength={500}
            placeholder="Explain why this professional application is not approved."
            aria-label="Applicant-facing rejection reason"
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void rejectApplication()} disabled={!rejectReason.trim() || rejectSaving}>
              {rejectSaving ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : null}
              Reject Application
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={preview !== null} onOpenChange={(open) => (!open ? closePreview() : undefined)}>
        <DialogContent className="max-w-4xl">
          <DialogTitle>Review Document</DialogTitle>
          <DialogDescription className="text-sm leading-6 text-slate-400">
            {preview?.filename ?? 'Secure application document'}
          </DialogDescription>
          {preview?.loading ? <StateMessage text="Loading document securely..." /> : null}
          {preview?.error ? <StateMessage tone="error" text={preview.error} /> : null}
          {preview?.url && isPdf(preview.contentType) ? (
            <iframe
              title={`Preview ${preview.filename}`}
              src={preview.url}
              className="h-[70vh] w-full rounded-xl border border-white/10 bg-slate-950"
            />
          ) : null}
          {preview?.url && isImage(preview.contentType) ? (
            <img
              src={preview.url}
              alt={`Preview of ${preview.filename}`}
              className="max-h-[70vh] w-full rounded-xl border border-white/10 object-contain"
            />
          ) : null}
          {preview?.url && !isPdf(preview.contentType) && !isImage(preview.contentType) ? (
            <StateMessage text="This file type cannot be previewed in the browser." />
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={closePreview}>
              Close
            </Button>
            <Button onClick={downloadPreview} disabled={!preview?.url}>
              <Download size={16} aria-hidden="true" />
              Download
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function DetailGrid({
  detail,
  onView,
  onDownload,
}: {
  detail: AccessReviewDetail;
  onView: (document: ApplicationDocument) => void;
  onDownload: (document: ApplicationDocument) => void;
}) {
  const professionalRows: Array<[string, string | null | undefined]> =
    detail.applicationType === 'DOCTOR'
      ? [
          ['Title', detail.doctor?.professionalTitle],
          ['Specialization', detail.doctor?.specialization],
          ['Experience', detail.doctor?.yearsExperience?.toString()],
          ['Organization', detail.doctor?.currentOrganization],
          ['Position', detail.doctor?.currentPosition],
          ['Registration', detail.doctor?.registrationNumber],
        ]
      : [
          ['Institution', detail.researcher?.institution],
          ['Department', detail.researcher?.department],
          ['Title', detail.researcher?.professionalTitle],
          ['Research field', detail.researcher?.researchField],
          ['Research purpose', detail.researcher?.researchPurpose],
          ['Ethics reference', detail.researcher?.ethicsReference],
        ];

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Panel title="Application">
        <Info label="Phone" value={detail.phone} />
        <Info label="Country" value={detail.countryCode} />
        <Info label="Email verified" value={formatDate(detail.emailVerifiedAt)} />
        <Info label="Submitted" value={formatDate(detail.submittedAt)} />
      </Panel>
      <Panel title="Professional Details">
        {professionalRows.map(([name, value]) => (
          <Info key={name} label={name} value={value} />
        ))}
      </Panel>
      <Panel title="Documents">
        {detail.documents.length === 0 ? <p className="text-sm text-slate-400">No supporting documents.</p> : null}
        {detail.documents.map((document) => (
          <div
            key={document.id}
            className="grid gap-3 rounded-xl border border-white/10 bg-slate-950/45 px-3 py-2 text-sm text-slate-200 sm:grid-cols-[minmax(0,1fr)_auto]"
          >
            <button
              type="button"
              onClick={() => onView(document)}
              className="min-w-0 text-left focus:outline-none focus:ring-2 focus:ring-cyan-300/50"
            >
              <span className="inline-flex max-w-full items-center gap-2">
                <FileText size={16} className="shrink-0" aria-hidden="true" />
                <span className="truncate">{document.originalFilename}</span>
              </span>
              <span className="mt-1 block text-xs text-slate-500">{label(document.documentType)}</span>
            </button>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => onView(document)}>
                <Eye size={14} aria-hidden="true" />
                View
              </Button>
              <Button size="sm" onClick={() => onDownload(document)}>
                <Download size={14} aria-hidden="true" />
                Download
              </Button>
            </div>
          </div>
        ))}
      </Panel>
      <Panel title="Applicant Timeline">
        {detail.events.length === 0 ? <p className="text-sm text-slate-400">No timeline events.</p> : null}
        {detail.events.map((event) => (
          <article
            key={`${event.type}-${event.createdAt}`}
            className="rounded-xl border border-white/10 bg-slate-950/45 p-3"
          >
            <p className="text-sm font-semibold text-slate-100">{label(event.type)}</p>
            <p className="mt-1 text-sm leading-6 text-slate-300">{event.message}</p>
            <p className="mt-2 text-xs text-slate-500">{formatDate(event.createdAt)}</p>
          </article>
        ))}
      </Panel>
    </div>
  );
}

function isPdf(contentType: string) {
  return contentType.toLowerCase().includes('application/pdf');
}

function isImage(contentType: string) {
  return ['image/jpeg', 'image/jpg', 'image/png'].some((type) => contentType.toLowerCase().includes(type));
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid content-start gap-3 rounded-2xl border border-white/10 bg-slate-950/35 p-4">
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      {children}
    </section>
  );
}

function Info({ label: name, value }: { label: string; value?: string | null }) {
  return (
    <div className="grid gap-1 border-b border-white/5 pb-2 last:border-0 last:pb-0">
      <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{name}</dt>
      <dd className="text-sm leading-6 text-slate-200">{value || 'Not provided'}</dd>
    </div>
  );
}

function StateMessage({ text, tone = 'info' }: { text: string; tone?: 'info' | 'error' | 'success' }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'rounded-xl border px-3.5 py-3 text-sm leading-6',
        tone === 'error'
          ? 'border-rose-300/20 bg-rose-300/[0.08] text-rose-100'
          : tone === 'success'
            ? 'border-emerald-300/20 bg-emerald-300/[0.08] text-emerald-100'
            : 'border-cyan-300/20 bg-cyan-300/[0.06] text-cyan-100',
      )}
    >
      {text}
    </div>
  );
}

function label(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatDate(value?: string | null) {
  if (!value) return 'Not available';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}
