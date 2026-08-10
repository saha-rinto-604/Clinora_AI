import { CheckCircle2, Download, FilePlus2, FileText, LoaderCircle, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { applicationApi, applicationErrorMessage } from './application-api';
import type { AccessApplication, ApplicationDocument, ApplicationDocumentType } from './application-types';
import { ApplicationNotice } from './application-ui';

function documentDefinitions(application: AccessApplication) {
  const doctor = application.applicationType === 'DOCTOR';
  return doctor
    ? [
        { type: 'CV' as const, label: 'Curriculum vitae', requirement: 'Required' },
        { type: 'MEDICAL_LICENSE' as const, label: 'Medical registration evidence', requirement: 'Required' },
        { type: 'QUALIFICATION' as const, label: 'Qualification evidence', requirement: 'At least one required' },
        { type: 'OTHER' as const, label: 'Additional supporting document', requirement: 'Optional' },
      ]
    : [
        {
          type: 'INSTITUTIONAL_EVIDENCE' as const,
          label: 'Institutional evidence',
          requirement: 'Optional · Add if relevant',
        },
        {
          type: 'ETHICS_OR_PROJECT_APPROVAL' as const,
          label: 'Ethics or project approval',
          requirement: 'Optional · Add if relevant',
        },
        { type: 'CV' as const, label: 'Curriculum vitae', requirement: 'Optional' },
        { type: 'OTHER' as const, label: 'Other supporting document', requirement: 'Optional' },
      ];
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) return `${kilobytes.toFixed(kilobytes >= 100 ? 0 : 1)} KB`;
  return `${(kilobytes / 1024).toFixed(1)} MB`;
}

export function ApplicationDocumentManager({
  application,
  onReload,
}: {
  application: AccessApplication;
  onReload: () => Promise<void>;
}) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const types = documentDefinitions(application);

  async function upload(type: ApplicationDocumentType, file?: File) {
    if (!file) return;
    setBusy(type);
    setError('');
    try {
      await applicationApi.upload(type, file);
      await onReload();
    } catch (caught) {
      setError(applicationErrorMessage(caught, 'We could not upload that document. Please try again.'));
    } finally {
      setBusy('');
    }
  }

  async function remove(id: string) {
    setBusy(id);
    setError('');
    try {
      await applicationApi.deleteDocument(id);
      await onReload();
    } catch (caught) {
      setError(applicationErrorMessage(caught, 'We could not remove that document. Please try again.'));
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-start gap-2.5 text-sm leading-6 text-slate-400">
        <FileText size={16} className="mt-1 shrink-0 text-cyan-300" aria-hidden="true" />
        <p>
          PDF, JPEG, and PNG files are supported. Documents remain private and are available only through Clinora’s
          backend.
        </p>
      </div>
      {error ? <ApplicationNotice tone="error">{error}</ApplicationNotice> : null}
      <div className="divide-y divide-white/10 border-y border-white/10">
        {types.map((definition) => {
          const matching = application.documents.filter((document) => document.documentType === definition.type);
          return (
            <div key={definition.type} className="py-4 first:pt-3 last:pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">{definition.label}</h3>
                  <p className="mt-1 text-xs text-slate-500">{definition.requirement}</p>
                </div>
                <label className="inline-flex min-h-9 w-fit cursor-pointer items-center gap-2 rounded-lg border border-white/[0.12] bg-white/[0.035] px-3 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.07]">
                  <input
                    className="sr-only"
                    type="file"
                    accept="application/pdf,image/jpeg,image/png"
                    disabled={Boolean(busy)}
                    onChange={(event) => void upload(definition.type, event.target.files?.[0])}
                  />
                  {busy === definition.type ? (
                    <LoaderCircle size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  ) : (
                    <FilePlus2 size={14} aria-hidden="true" />
                  )}
                  {busy === definition.type ? 'Uploading…' : matching.length ? 'Add another' : 'Add file'}
                </label>
              </div>
              {matching.length ? (
                <div className="mt-3 grid gap-2">
                  {matching.map((document) => (
                    <DocumentRow key={document.id} document={document} busy={busy === document.id} onRemove={remove} />
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DocumentRow({
  document,
  busy,
  onRemove,
}: {
  document: ApplicationDocument;
  busy: boolean;
  onRemove: (id: string) => Promise<void>;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-lg bg-white/[0.025] px-3 py-2.5 text-sm">
      <CheckCircle2 size={15} className="shrink-0 text-teal-300" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-slate-200">{document.originalFilename}</p>
        <p className="mt-0.5 text-xs text-slate-500">{formatFileSize(document.sizeBytes)}</p>
      </div>
      <a
        title="Download document"
        aria-label={`Download ${document.originalFilename}`}
        className="rounded-lg p-2 text-slate-400 transition hover:bg-white/[0.05] hover:text-white"
        href={applicationApi.documentUrl(document.id)}
      >
        <Download size={15} aria-hidden="true" />
      </a>
      <button
        type="button"
        title="Remove document"
        aria-label={`Remove ${document.originalFilename}`}
        disabled={busy}
        className="rounded-lg p-2 text-rose-300 transition hover:bg-rose-300/[0.06] hover:text-rose-200 disabled:opacity-50"
        onClick={() => void onRemove(document.id)}
      >
        {busy ? (
          <LoaderCircle size={15} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
        ) : (
          <Trash2 size={15} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
