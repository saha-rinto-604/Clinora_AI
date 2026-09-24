import { CalendarClock, CheckCircle2, Download, Eye, FileText, FlaskConical, Pill, Stethoscope } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { AppSectionHeader, AppSurface, EmptyState, IconWell } from '../app/app-ui';
import { Button } from '../ui/button';
import { buttonVariants } from '../ui/button-variants';
import {
  consultationApi,
  consultationError,
  type PatientConsultationSummary as Summary,
  type PrescriptionDocumentView,
} from '../../features/consultations/consultation-api';
import { presentPrescriptionDocument } from '../../features/consultations/prescription-document-file';

export function PatientConsultationSummary({ appointmentId }: { appointmentId: string }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [documentBusy, setDocumentBusy] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    consultationApi
      .patientSummary(appointmentId)
      .then((value) => {
        if (active) setSummary(value);
      })
      .catch((requestError) => {
        if (active) setError(consultationError(requestError, 'Your consultation summary could not be loaded.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [appointmentId]);

  const openDocument = async (document: PrescriptionDocumentView, disposition: 'view' | 'download') => {
    if (!summary) return;
    const key = `${document.id}:${disposition}`;
    setDocumentBusy(key);
    setError('');
    try {
      const blob = await consultationApi.patientPrescriptionDocument(summary.consultationId, document.id, disposition);
      presentPrescriptionDocument(blob, document.originalFilename, disposition);
    } catch (requestError) {
      setError(consultationError(requestError, 'This prescription document could not be opened.'));
    } finally {
      setDocumentBusy('');
    }
  };

  if (loading || (!summary && !error)) return null;

  if (error && !summary) {
    return (
      <AppSurface variant="attention" className="mt-6">
        <p role="alert" className="text-sm text-amber-100">
          {error}
        </p>
      </AppSurface>
    );
  }

  if (!summary) return null;

  const hasPatientVisibleContent = Boolean(
    summary.assessment ||
      summary.plan ||
      summary.prescriptions.length ||
      summary.prescriptionDocuments.length ||
      summary.investigations.length ||
      summary.followUp,
  );

  return (
    <AppSurface as="section" variant="elevated" className="mt-6" aria-labelledby="consultation-summary-title">
      <div className="flex items-start gap-3">
        <IconWell tone="success">
          <CheckCircle2 size={17} />
        </IconWell>
        <div className="min-w-0 flex-1">
          <AppSectionHeader
            eyebrow="Doctor completed"
            title={hasPatientVisibleContent ? 'Consultation & care plan' : 'Consultation completed'}
            titleId="consultation-summary-title"
            copy={
              hasPatientVisibleContent
                ? `Completed ${formatDateTime(summary.completedAt)}. These are Doctor-authored instructions from this consultation.`
                : `Completed ${formatDateTime(summary.completedAt)}. No additional digital care notes were added for this consultation.`
            }
          />
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-4 text-sm text-amber-100">
          {error}
        </p>
      ) : null}

      {summary.assessment || summary.plan ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {summary.assessment ? <SummaryBlock title="Doctor assessment" value={summary.assessment} /> : null}
          {summary.plan ? <SummaryBlock title="Plan" value={summary.plan} /> : null}
        </div>
      ) : null}

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <section className="rounded-xl border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-nested)] p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
            <Pill size={15} /> Structured medication instructions
          </h3>
          {summary.prescriptions.length ? (
            <ul className="mt-3 space-y-3">
              {summary.prescriptions.map((item) => (
                <li
                  key={item.id}
                  className="border-t border-[var(--clinora-border-subtle)] pt-3 first:border-0 first:pt-0"
                >
                  <strong className="block text-sm text-white">{item.medicationName}</strong>
                  <p className="mt-1 text-xs leading-5 text-[var(--clinora-text-muted)]">
                    {[item.strength, item.dose, item.route, item.frequency, item.duration]
                      .filter(Boolean)
                      .join(' - ') || 'See Doctor instructions below.'}
                  </p>
                  {item.instructions ? <p className="mt-1 text-xs text-slate-300">{item.instructions}</p> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-[var(--clinora-text-faint)]">
              No structured medication instructions were added.
            </p>
          )}
        </section>

        <section className="rounded-xl border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-nested)] p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
            <FileText size={15} /> Original prescription documents
          </h3>
          {summary.prescriptionDocuments.length ? (
            <ul className="mt-3 space-y-2">
              {summary.prescriptionDocuments.map((document) => (
                <li
                  key={document.id}
                  className="flex flex-col gap-2 rounded-lg border border-[var(--clinora-border-subtle)] p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="min-w-0">
                    <strong className="block truncate text-xs font-semibold text-white">
                      {document.originalFilename}
                    </strong>
                    <span className="mt-1 block text-[11px] text-[var(--clinora-text-faint)]">
                      {fileLabel(document.mimeType)} - {fileSize(document.sizeBytes)}
                    </span>
                  </span>
                  <span className="flex gap-2">
                    <Button
                      size="sm"
                      variant="appSecondary"
                      disabled={!!documentBusy}
                      onClick={() => void openDocument(document, 'view')}
                    >
                      <Eye size={13} /> View
                    </Button>
                    <Button
                      size="sm"
                      variant="appSecondary"
                      disabled={!!documentBusy}
                      onClick={() => void openDocument(document, 'download')}
                    >
                      <Download size={13} /> Download
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-[var(--clinora-text-faint)]">
              No original prescription document was attached.
            </p>
          )}
        </section>

        <section className="rounded-xl border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-nested)] p-4 lg:col-span-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
            <FlaskConical size={15} /> Requested investigations
          </h3>
          {summary.investigations.length ? (
            <ul className="mt-3 grid gap-3 lg:grid-cols-2">
              {summary.investigations.map((item) => (
                <li key={item.id} className="rounded-lg border border-[var(--clinora-border-subtle)] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-sm text-white">{item.testName}</strong>
                    <span
                      className={
                        item.priority === 'URGENT'
                          ? 'text-xs font-semibold text-amber-200'
                          : 'text-xs text-[var(--clinora-text-faint)]'
                      }
                    >
                      {item.priority === 'URGENT' ? 'Urgent' : 'Routine'}
                    </span>
                  </div>
                  {item.reason ? (
                    <p className="mt-1 text-xs leading-5 text-[var(--clinora-text-muted)]">{item.reason}</p>
                  ) : null}
                  {item.instructions ? <p className="mt-1 text-xs text-slate-300">{item.instructions}</p> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-[var(--clinora-text-faint)]">No investigation was requested.</p>
          )}
        </section>
      </div>

      {summary.followUp ? (
        <section className="mt-5 rounded-xl border border-cyan-300/15 bg-cyan-300/[0.045] p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <IconWell tone="info">
                <CalendarClock size={15} />
              </IconWell>
              <div>
                <h3 className="text-sm font-semibold text-white">Follow-up recommended</h3>
                <p className="mt-1 text-sm text-cyan-100">{formatLocalDate(summary.followUp.recommendedDate)}</p>
                {summary.followUp.reason ? (
                  <p className="mt-1 text-xs text-[var(--clinora-text-muted)]">{summary.followUp.reason}</p>
                ) : null}
                {summary.followUp.instructions ? (
                  <p className="mt-1 text-xs text-slate-300">{summary.followUp.instructions}</p>
                ) : null}
              </div>
            </div>
            <Link to={`/patient/doctors/${summary.doctorId}`} className={buttonVariants({ variant: 'appPrimary' })}>
              <Stethoscope size={15} /> Book follow-up
            </Link>
          </div>
        </section>
      ) : null}

      {!hasPatientVisibleContent ? (
        <EmptyState
          className="mt-5"
          icon={<Stethoscope size={17} />}
          title="Consultation completed"
          copy="No additional digital care notes were added for this consultation."
        />
      ) : !summary.prescriptions.length &&
      !summary.prescriptionDocuments.length &&
      !summary.investigations.length &&
      !summary.followUp ? (
        <EmptyState
          className="mt-5"
          icon={<Stethoscope size={17} />}
          title="No structured care actions"
          copy="The Doctor completed this consultation without medication, a prescription document, investigations or a follow-up recommendation."
        />
      ) : null}
    </AppSurface>
  );
}

function SummaryBlock({ title, value }: { title: string; value: string }) {
  return (
    <section className="rounded-xl border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-nested)] p-4">
      <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--clinora-text-faint)]">{title}</h3>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-200">{value}</p>
    </section>
  );
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatLocalDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileLabel(mimeType: string) {
  if (mimeType === 'application/pdf') return 'PDF';
  if (mimeType === 'image/png') return 'PNG';
  return 'JPEG';
}
