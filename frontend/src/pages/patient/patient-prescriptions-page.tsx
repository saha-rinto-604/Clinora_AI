import { CalendarClock, Download, Eye, FileText, FlaskConical, Pill, Stethoscope } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { AppSectionHeader, AppSurface, EmptyState, IconWell } from '../../components/app/app-ui';
import { Button } from '../../components/ui/button';
import { buttonVariants } from '../../components/ui/button-variants';
import { Skeleton } from '../../components/ui/feedback';
import {
  consultationApi,
  consultationError,
  type PatientConsultationSummary,
  type PrescriptionDocumentView,
} from '../../features/consultations/consultation-api';
import { presentPrescriptionDocument } from '../../features/consultations/prescription-document-file';

export function PatientPrescriptionsPage() {
  const [items, setItems] = useState<PatientConsultationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [documentBusy, setDocumentBusy] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setItems(await consultationApi.patientPrescriptions());
    } catch (requestError) {
      setError(consultationError(requestError, 'Your prescriptions could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openDocument = async (
    summary: PatientConsultationSummary,
    document: PrescriptionDocumentView,
    disposition: 'view' | 'download',
  ) => {
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

  return (
    <div className="space-y-6">
      <header className="border-b border-[var(--clinora-border-subtle)] pb-6">
        <AppSectionHeader
          eyebrow="Doctor-authored care"
          title="Prescriptions"
          copy="Finalized prescriptions from completed Clinora consultations, including structured medication instructions and original Doctor documents."
        />
      </header>

      {error ? (
        <AppSurface variant="attention">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p role="alert" className="text-sm text-amber-100">
              {error}
            </p>
            <Button size="sm" variant="appSecondary" onClick={() => void load()}>
              Try again
            </Button>
          </div>
        </AppSurface>
      ) : null}

      {loading ? (
        <div className="space-y-4" role="status" aria-label="Loading prescriptions">
          <Skeleton className="h-48 rounded-[18px]" />
          <Skeleton className="h-48 rounded-[18px]" />
        </div>
      ) : items.length === 0 ? (
        <AppSurface>
          <EmptyState
            icon={<Pill size={18} />}
            title="No prescriptions yet"
            copy="Doctor-authored prescriptions from completed Clinora consultations will appear here. Draft consultation content is never shown."
          />
        </AppSurface>
      ) : (
        <div className="space-y-4">
          {items.map((summary) => (
            <AppSurface key={summary.consultationId} padding="none" className="overflow-hidden">
              <div className="flex flex-col gap-3 border-b border-[var(--clinora-border-subtle)] px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
                <div className="flex items-center gap-2">
                  <IconWell tone="info">
                    <Stethoscope size={15} />
                  </IconWell>
                  <div>
                    <h2 className="text-sm font-semibold text-white">{summary.doctorName}</h2>
                    <p className="mt-0.5 text-xs text-[var(--clinora-text-muted)]">{summary.specialization}</p>
                  </div>
                </div>
                <span className="text-xs text-[var(--clinora-text-faint)]">{formatDate(summary.completedAt)}</span>
              </div>

              <div className="space-y-5 px-5 py-5 sm:px-6">
                {summary.assessment || summary.plan ? (
                  <div className="grid gap-3 lg:grid-cols-2">
                    {summary.assessment ? <CareText title="Doctor assessment" value={summary.assessment} /> : null}
                    {summary.plan ? <CareText title="Plan" value={summary.plan} /> : null}
                  </div>
                ) : null}

                {summary.prescriptions.length ? (
                  <section>
                    <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--clinora-text-faint)]">
                      <Pill size={14} /> Medications
                    </h3>
                    <div className="mt-2 grid gap-2 lg:grid-cols-2">
                      {summary.prescriptions.map((item) => (
                        <article
                          key={item.id}
                          className="rounded-xl border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-nested)] p-3.5"
                        >
                          <strong className="text-sm text-white">{item.medicationName}</strong>
                          <p className="mt-1 text-xs leading-5 text-[var(--clinora-text-muted)]">
                            {[item.strength, item.dose, item.route, item.frequency, item.duration]
                              .filter(Boolean)
                              .join(' - ') || 'See Doctor instructions.'}
                          </p>
                          {item.instructions ? (
                            <p className="mt-1 text-xs text-slate-300">{item.instructions}</p>
                          ) : null}
                        </article>
                      ))}
                    </div>
                  </section>
                ) : null}

                {summary.prescriptionDocuments.length ? (
                  <section>
                    <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--clinora-text-faint)]">
                      <FileText size={14} /> Original prescription
                    </h3>
                    <div className="mt-2 space-y-2">
                      {summary.prescriptionDocuments.map((document) => (
                        <div
                          key={document.id}
                          className="flex flex-col gap-2 rounded-xl border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-nested)] p-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <span className="min-w-0">
                            <strong className="block truncate text-xs font-semibold text-white">
                              {document.originalFilename}
                            </strong>
                            <span className="mt-1 block text-[11px] text-[var(--clinora-text-faint)]">
                              {fileSize(document.sizeBytes)}
                            </span>
                          </span>
                          <span className="flex gap-2">
                            <Button
                              size="sm"
                              variant="appSecondary"
                              disabled={!!documentBusy}
                              onClick={() => void openDocument(summary, document, 'view')}
                            >
                              <Eye size={13} /> View
                            </Button>
                            <Button
                              size="sm"
                              variant="appSecondary"
                              disabled={!!documentBusy}
                              onClick={() => void openDocument(summary, document, 'download')}
                            >
                              <Download size={13} /> Download
                            </Button>
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}

                {summary.investigations.length ? (
                  <section>
                    <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--clinora-text-faint)]">
                      <FlaskConical size={14} /> Requested investigations
                    </h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {summary.investigations.map((item) => (
                        <span
                          key={item.id}
                          className="rounded-full border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-nested)] px-3 py-1.5 text-xs text-slate-300"
                        >
                          {item.testName}
                          {item.priority === 'URGENT' ? ' - Urgent' : ''}
                        </span>
                      ))}
                    </div>
                  </section>
                ) : null}

                {summary.followUp ? (
                  <section className="flex flex-col gap-3 rounded-xl border border-cyan-300/15 bg-cyan-300/[0.045] p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <CalendarClock size={16} className="mt-0.5 text-cyan-200" />
                      <div>
                        <h3 className="text-sm font-semibold text-white">Follow-up recommended</h3>
                        <p className="mt-1 text-xs text-cyan-100">
                          {formatLocalDate(summary.followUp.recommendedDate)}
                        </p>
                        {summary.followUp.reason ? (
                          <p className="mt-1 text-xs text-[var(--clinora-text-muted)]">{summary.followUp.reason}</p>
                        ) : null}
                      </div>
                    </div>
                    <Link
                      to={`/patient/doctors/${summary.doctorId}`}
                      className={buttonVariants({ variant: 'appPrimary', size: 'sm' })}
                    >
                      Book follow-up
                    </Link>
                  </section>
                ) : null}

                <Link
                  to={`/patient/appointments/${summary.appointmentId}`}
                  className="inline-flex text-xs font-semibold text-cyan-200 hover:text-cyan-100"
                >
                  Open consultation details
                </Link>
              </div>
            </AppSurface>
          ))}
        </div>
      )}
    </div>
  );
}

function CareText({ title, value }: { title: string; value: string }) {
  return (
    <section className="rounded-xl border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-nested)] p-3.5">
      <h3 className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--clinora-text-faint)]">{title}</h3>
      <p className="mt-1.5 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-slate-200">{value}</p>
    </section>
  );
}

function formatDate(value: string) {
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
