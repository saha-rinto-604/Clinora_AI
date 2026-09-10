import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  ExternalLink,
  FileSearch,
  FileText,
  ShieldCheck,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { AppSectionHeader, AppSurface, EmptyState, StatusPill } from '../../components/app/app-ui';
import { Button } from '../../components/ui/button';
import { buttonVariants } from '../../components/ui/button-variants';
import { Skeleton } from '../../components/ui/feedback';
import {
  doctorApi,
  doctorError,
  type DoctorObservationDecision,
  type DoctorReportObservation,
  type DoctorReportReview,
} from '../../features/doctor/doctor-api';
import { formatDoctorDate, reportTypeLabel } from '../../features/doctor/doctor-display';

export function DoctorReportReviewPage() {
  const { appointmentId = '', reportId = '' } = useParams();
  const [data, setData] = useState<DoctorReportReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewType, setPreviewType] = useState('');
  const [previewError, setPreviewError] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    if (!appointmentId || !reportId) return;
    setLoading(true);
    setError('');
    try {
      setData(await doctorApi.reportReview(appointmentId, reportId));
    } catch (requestError) {
      setError(doctorError(requestError, 'This report is not available for this appointment.'));
    } finally {
      setLoading(false);
    }
  }, [appointmentId, reportId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setPreviewUrl('');
    setPreviewError(false);
    if (!appointmentId || !reportId) return undefined;

    void doctorApi
      .reportContent(appointmentId, reportId)
      .then(({ blob, contentType }) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setPreviewType(contentType);
        setPreviewUrl(objectUrl);
      })
      .catch(() => {
        if (active) setPreviewError(true);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [appointmentId, reportId]);

  const download = async () => {
    if (!data) return;
    setDownloading(true);
    try {
      const blob = await doctorApi.downloadReport(appointmentId, reportId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = downloadName(data.displayName, data.mimeType);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      setError(doctorError(requestError, 'The report could not be downloaded.'));
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6" aria-label="Loading shared report">
        <Skeleton className="h-24 rounded-[var(--radius-app-card)]" />
        <div className="grid gap-6 xl:grid-cols-2">
          <Skeleton className="h-[620px] rounded-[var(--radius-app-card)]" />
          <Skeleton className="h-[620px] rounded-[var(--radius-app-card)]" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <AppSurface as="section" variant="attention">
        <p role="alert" className="text-sm text-[var(--clinora-warning-foreground)]">
          {error || 'This report is not available.'}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="appSecondary" onClick={() => void load()}>
            Try again
          </Button>
          <Link to={`/doctor/appointments/${appointmentId}`} className={buttonVariants({ variant: 'appSecondary' })}>
            Back to appointment
          </Link>
        </div>
      </AppSurface>
    );
  }

  const outsideCount = data.observations.filter((item) => item.resultStatus === 'OUTSIDE_RANGE').length;
  const withinCount = data.observations.filter((item) => item.resultStatus === 'WITHIN_RANGE').length;

  return (
    <div className="space-y-7">
      <Link
        to={`/doctor/appointments/${appointmentId}`}
        className="inline-flex min-h-10 items-center gap-2 text-sm font-medium text-[var(--clinora-text-muted)] transition-colors hover:text-[var(--clinora-info-foreground)]"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Back to appointment
      </Link>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <AppSectionHeader
          eyebrow="Patient-shared report"
          title={data.displayName}
          copy={`${reportTypeLabel(data.reportType)}${data.reportDate ? ` · ${formatDoctorDate(data.reportDate)}` : ''}${data.providerLaboratory ? ` · ${data.providerLaboratory}` : ''}`}
        />
        <div className="flex flex-wrap gap-2">
          <StatusPill tone="success">
            <ShieldCheck size={13} aria-hidden="true" /> Shared by Patient
          </StatusPill>
          {data.extractionReviewStatus === 'VERIFIED' ? (
            <StatusPill tone="info">
              <FileSearch size={13} aria-hidden="true" /> Structured results verified
            </StatusPill>
          ) : null}
        </div>
      </div>

      <AppSurface as="section" variant="nested" padding="compact">
        <p className="text-sm leading-6 text-[var(--clinora-text-muted)]">
          <strong className="font-semibold text-white">Use the original report as the clinical source.</strong>{' '}
          Clinora&apos;s structured values are a reading aid. They never replace the document the Patient shared.
        </p>
      </AppSurface>

      {data.extractionReviewStatus === 'VERIFIED' && data.observations.length ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryTile
            label="Structured results"
            value={String(data.observations.length)}
            icon={<FileSearch size={16} />}
          />
          <SummaryTile
            label="Outside reported range"
            value={String(outsideCount)}
            icon={<AlertTriangle size={16} />}
            tone={outsideCount ? 'warning' : 'neutral'}
          />
          <SummaryTile
            label="Within reported range"
            value={String(withinCount)}
            icon={<CheckCircle2 size={16} />}
            tone="success"
          />
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(400px,0.92fr)_minmax(0,1.08fr)]">
        <AppSurface as="section" padding="none" className="overflow-hidden" aria-labelledby="source-report-title">
          <div className="flex flex-col gap-3 border-b border-[var(--clinora-border-subtle)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <h2 id="source-report-title" className="text-base font-semibold text-white">
                Original report
              </h2>
              <p className="mt-1 text-xs text-[var(--clinora-text-muted)]">
                Secure source document shared for this appointment
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {previewUrl ? (
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonVariants({ variant: 'appSecondary', size: 'sm' })}
                >
                  <ExternalLink size={14} aria-hidden="true" /> Open
                </a>
              ) : null}
              <Button variant="appSecondary" size="sm" disabled={downloading} onClick={() => void download()}>
                <Download size={14} aria-hidden="true" /> {downloading ? 'Downloading…' : 'Download'}
              </Button>
            </div>
          </div>

          <div className="min-h-[520px] bg-black/20 p-2 sm:p-3">
            {previewUrl && previewType.includes('pdf') ? (
              <iframe
                title="Original shared medical report"
                src={previewUrl}
                className="h-[70vh] min-h-[520px] w-full rounded-xl bg-white"
              />
            ) : null}
            {previewUrl && previewType.startsWith('image/') ? (
              <div className="grid min-h-[520px] place-items-center overflow-auto rounded-xl bg-black/20 p-3">
                <img
                  src={previewUrl}
                  alt="Original shared medical report"
                  className="max-h-[72vh] max-w-full rounded-lg object-contain"
                />
              </div>
            ) : null}
            {!previewUrl && !previewError ? (
              <div className="grid min-h-[520px] place-items-center text-sm text-[var(--clinora-text-faint)]">
                Preparing secure preview…
              </div>
            ) : null}
            {previewError ? (
              <EmptyState
                className="min-h-[520px] justify-center p-6"
                icon={<FileText size={18} />}
                title="Preview unavailable"
                copy="The secure preview could not be opened. If access is still active, you can try downloading the report instead."
              />
            ) : null}
          </div>
        </AppSurface>

        <AppSurface as="section" padding="none" className="overflow-hidden" aria-labelledby="structured-results-title">
          <div className="border-b border-[var(--clinora-border-subtle)] px-5 py-4 sm:px-6">
            <h2 id="structured-results-title" className="text-base font-semibold text-white">
              Structured results
            </h2>
            <p className="mt-1.5 text-xs leading-5 text-[var(--clinora-text-muted)]">
              Values the Patient already reviewed and confirmed. Your review is recorded separately and does not change
              their version.
            </p>
          </div>

          {data.extractionReviewStatus !== 'VERIFIED' ? (
            <EmptyState
              className="p-6 sm:p-8"
              icon={<FileSearch size={18} />}
              title="Verified structured results are not available"
              copy="You can still review the original report. Clinora will not present unverified extracted values as clinical evidence."
            />
          ) : data.observations.length === 0 ? (
            <EmptyState
              className="p-6 sm:p-8"
              icon={<FileSearch size={18} />}
              title="No structured results found"
              copy="The original Patient-shared report remains available for review."
            />
          ) : (
            <div className="divide-y divide-[var(--clinora-border-subtle)]">
              {data.observations.map((observation) => (
                <ObservationRow
                  key={observation.id}
                  observation={observation}
                  appointmentId={appointmentId}
                  reportId={reportId}
                  onUpdated={(decision, comment) =>
                    setData((current) =>
                      current
                        ? {
                            ...current,
                            observations: current.observations.map((item) =>
                              item.id === observation.id
                                ? { ...item, doctorDecision: decision, doctorComment: comment || null }
                                : item,
                            ),
                          }
                        : current,
                    )
                  }
                />
              ))}
            </div>
          )}
        </AppSurface>
      </div>
    </div>
  );
}

function ObservationRow({
  observation,
  appointmentId,
  reportId,
  onUpdated,
}: {
  observation: DoctorReportObservation;
  appointmentId: string;
  reportId: string;
  onUpdated: (decision: DoctorObservationDecision, comment?: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [comment, setComment] = useState(observation.doctorComment || '');
  const status = useMemo(() => observationStatus(observation), [observation]);

  const save = async (decision: DoctorObservationDecision) => {
    setSaving(true);
    setError('');
    try {
      const result = await doctorApi.reviewObservation(appointmentId, reportId, observation.id, decision, comment);
      onUpdated(result.decision, result.comment || undefined);
    } catch (requestError) {
      setError(doctorError(requestError, 'We could not save this review.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <article className="px-5 py-5 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-white">{observation.label}</h3>
            <StatusPill tone={status.tone}>{status.label}</StatusPill>
            {observation.patientVerification === 'PATIENT_CORRECTED' ? (
              <StatusPill tone="info">Patient corrected</StatusPill>
            ) : null}
            {observation.patientVerification === 'PATIENT_CONFIRMED' ? (
              <StatusPill tone="neutral">Patient confirmed</StatusPill>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap items-baseline gap-2">
            <span className="text-xl font-semibold tracking-[-0.02em] text-white">
              {[observation.comparator, observation.displayValue].filter(Boolean).join(' ')}
            </span>
            {observation.unit ? (
              <span className="text-xs text-[var(--clinora-text-muted)]">{observation.unit}</span>
            ) : null}
          </div>
          <p className="mt-1.5 text-xs text-[var(--clinora-text-muted)]">
            {observation.referenceRange
              ? `Reported reference: ${observation.referenceRange}`
              : 'Reference range not provided'}
            {observation.pageNumber ? ` · Page ${observation.pageNumber}` : ''}
          </p>
        </div>
        {observation.doctorDecision ? <DoctorDecision decision={observation.doctorDecision} /> : null}
      </div>

      <div className="mt-4 rounded-[var(--radius-app-compact)] border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-nested)] p-3.5">
        <p className="text-xs font-semibold text-slate-300">Your source check</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="appSecondary" size="sm" disabled={saving} onClick={() => void save('CONFIRMED')}>
            Looks correct
          </Button>
          <Button variant="appSecondary" size="sm" disabled={saving} onClick={() => void save('NEEDS_SOURCE_REVIEW')}>
            Check source
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-amber-200"
            disabled={saving}
            onClick={() => void save('DISAGREES')}
          >
            Doesn&apos;t match
          </Button>
        </div>
        <label className="mt-3 block text-xs font-medium text-[var(--clinora-text-muted)]">
          Note <span className="font-normal text-[var(--clinora-text-faint)]">(optional)</span>
          <textarea
            value={comment}
            maxLength={1200}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Add a short note if something needs attention"
            className="mt-2 min-h-20 w-full rounded-xl border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-1)] px-3 py-2.5 text-sm text-white outline-none focus:border-[var(--clinora-border-interactive)] focus:ring-4 focus:ring-[var(--clinora-focus-ring-soft)]"
          />
        </label>
        {error ? (
          <p role="alert" className="mt-2 text-xs text-rose-200">
            {error}
          </p>
        ) : null}
      </div>
    </article>
  );
}

function SummaryTile({
  label,
  value,
  icon,
  tone = 'info',
}: {
  label: string;
  value: string;
  icon: ReactNode;
  tone?: 'info' | 'success' | 'warning' | 'neutral';
}) {
  const toneClass = {
    info: 'text-[var(--clinora-info-foreground)]',
    success: 'text-[var(--clinora-success-foreground)]',
    warning: 'text-[var(--clinora-warning-foreground)]',
    neutral: 'text-slate-400',
  }[tone];
  return (
    <AppSurface as="div" padding="compact" radius="compact">
      <div className="flex items-center gap-3">
        <span className={toneClass}>{icon}</span>
        <div>
          <p className="text-xs text-[var(--clinora-text-muted)]">{label}</p>
          <p className="mt-0.5 text-lg font-semibold text-white">{value}</p>
        </div>
      </div>
    </AppSurface>
  );
}

function DoctorDecision({ decision }: { decision: DoctorObservationDecision }) {
  const value = {
    CONFIRMED: { label: 'Reviewed · matches source', tone: 'success' as const },
    NEEDS_SOURCE_REVIEW: { label: 'Needs source check', tone: 'warning' as const },
    DISAGREES: { label: 'Reviewed · mismatch noted', tone: 'warning' as const },
  }[decision];
  return <StatusPill tone={value.tone}>{value.label}</StatusPill>;
}

function observationStatus(observation: DoctorReportObservation): {
  label: string;
  tone: 'success' | 'warning' | 'neutral';
} {
  if (observation.resultStatus === 'OUTSIDE_RANGE') return { label: 'Outside reported range', tone: 'warning' };
  if (observation.resultStatus === 'WITHIN_RANGE') return { label: 'Within reported range', tone: 'success' };
  return { label: 'No range classification', tone: 'neutral' };
}

function downloadName(name: string, mimeType?: string | null) {
  const safe =
    name
      .trim()
      .replace(/[^a-z0-9._-]+/gi, '-')
      .replace(/^-+|-+$/g, '') || 'medical-report';
  const extension = mimeType?.includes('pdf')
    ? '.pdf'
    : mimeType?.includes('png')
      ? '.png'
      : mimeType?.includes('jpeg')
        ? '.jpg'
        : '';
  return safe.toLowerCase().endsWith(extension) ? safe : `${safe}${extension}`;
}
