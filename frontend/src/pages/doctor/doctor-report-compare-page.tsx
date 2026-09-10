import { ArrowLeft, ArrowRightLeft, FileSearch } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { AppSectionHeader, AppSurface, EmptyState, StatusPill } from '../../components/app/app-ui';
import { Button } from '../../components/ui/button';
import { buttonVariants } from '../../components/ui/button-variants';
import { Skeleton } from '../../components/ui/feedback';
import {
  doctorApi,
  doctorError,
  type DoctorReportComparison,
  type DoctorReportObservation,
} from '../../features/doctor/doctor-api';
import { formatDoctorDate, reportTypeLabel } from '../../features/doctor/doctor-display';

export function DoctorReportComparePage() {
  const { appointmentId = '' } = useParams();
  const [params] = useSearchParams();
  const left = params.get('left') || '';
  const right = params.get('right') || '';
  const [data, setData] = useState<DoctorReportComparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!appointmentId || !left || !right || left === right) {
      setError('Choose two different shared reports from the appointment.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      setData(await doctorApi.compareReports(appointmentId, left, right));
    } catch (requestError) {
      setError(doctorError(requestError, 'These reports are not available for comparison.'));
    } finally {
      setLoading(false);
    }
  }, [appointmentId, left, right]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => comparisonRows(data), [data]);

  if (loading) {
    return (
      <div className="space-y-6" aria-label="Loading report comparison">
        <Skeleton className="h-24 rounded-[var(--radius-app-card)]" />
        <Skeleton className="h-[520px] rounded-[var(--radius-app-card)]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <AppSurface as="section" variant="attention">
        <p role="alert" className="text-sm text-[var(--clinora-warning-foreground)]">
          {error || 'The report comparison is unavailable.'}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link to={`/doctor/appointments/${appointmentId}`} className={buttonVariants({ variant: 'appSecondary' })}>
            Back to appointment
          </Link>
          {left && right && left !== right ? (
            <Button variant="appSecondary" onClick={() => void load()}>
              Try again
            </Button>
          ) : null}
        </div>
      </AppSurface>
    );
  }

  return (
    <div className="space-y-7">
      <Link
        to={`/doctor/appointments/${appointmentId}`}
        className="inline-flex min-h-10 items-center gap-2 text-sm font-medium text-[var(--clinora-text-muted)] transition-colors hover:text-[var(--clinora-info-foreground)]"
      >
        <ArrowLeft size={16} aria-hidden="true" /> Back to appointment
      </Link>

      <AppSectionHeader
        eyebrow="Shared evidence"
        title="Compare structured results"
        copy="A side-by-side view of two reports the Patient shared for this appointment. This is a reading aid, not an AI interpretation."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <ReportHeader label="First report" report={data.left} />
        <ReportHeader label="Second report" report={data.right} />
      </div>

      {data.left.extractionReviewStatus !== 'VERIFIED' || data.right.extractionReviewStatus !== 'VERIFIED' ? (
        <AppSurface as="section">
          <EmptyState
            icon={<FileSearch size={18} />}
            title="Verified structured results are needed for comparison"
            copy="One or both reports do not have Patient-verified structured values. Review the original reports individually instead."
          />
        </AppSurface>
      ) : rows.length === 0 ? (
        <AppSurface as="section">
          <EmptyState
            icon={<ArrowRightLeft size={18} />}
            title="No comparable results"
            copy="Clinora could not match structured result names across these two reports."
          />
        </AppSurface>
      ) : (
        <AppSurface as="section" padding="none" className="overflow-hidden">
          <div className="hidden border-b border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-nested)] px-5 py-3 text-xs font-semibold text-[var(--clinora-text-muted)] md:grid md:grid-cols-[minmax(12rem,0.8fr)_minmax(0,1fr)_minmax(0,1fr)] md:gap-5 sm:px-6">
            <span>Result</span>
            <span>{data.left.displayName}</span>
            <span>{data.right.displayName}</span>
          </div>
          <div className="divide-y divide-[var(--clinora-border-subtle)]">
            {rows.map((row) => (
              <article
                key={row.key}
                className="grid gap-4 px-5 py-5 md:grid-cols-[minmax(12rem,0.8fr)_minmax(0,1fr)_minmax(0,1fr)] md:gap-5 sm:px-6"
              >
                <div>
                  <p className="text-sm font-semibold text-white">{row.label}</p>
                  <p className="mt-1 text-xs text-[var(--clinora-text-faint)]">Matched by Clinora label</p>
                </div>
                <ComparedValue heading={data.left.displayName} observation={row.left} />
                <ComparedValue heading={data.right.displayName} observation={row.right} />
              </article>
            ))}
          </div>
        </AppSurface>
      )}
    </div>
  );
}

function ReportHeader({ label, report }: { label: string; report: DoctorReportComparison['left'] }) {
  return (
    <AppSurface as="section" variant="nested" padding="compact" radius="compact">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--clinora-info-foreground)]">{label}</p>
      <h2 className="mt-2 text-base font-semibold text-white">{report.displayName}</h2>
      <p className="mt-1 text-xs leading-5 text-[var(--clinora-text-muted)]">
        {reportTypeLabel(report.reportType)}
        {report.reportDate ? ` · ${formatDoctorDate(report.reportDate)}` : ''}
        {report.providerLaboratory ? ` · ${report.providerLaboratory}` : ''}
      </p>
    </AppSurface>
  );
}

function ComparedValue({ heading, observation }: { heading: string; observation?: DoctorReportObservation }) {
  if (!observation) {
    return (
      <div>
        <p className="text-[11px] font-semibold text-[var(--clinora-text-faint)] md:hidden">{heading}</p>
        <p className="mt-1 text-sm text-[var(--clinora-text-faint)]">Not reported</p>
      </div>
    );
  }
  const tone =
    observation.resultStatus === 'OUTSIDE_RANGE'
      ? 'warning'
      : observation.resultStatus === 'WITHIN_RANGE'
        ? 'success'
        : 'neutral';
  const label =
    observation.resultStatus === 'OUTSIDE_RANGE'
      ? 'Outside range'
      : observation.resultStatus === 'WITHIN_RANGE'
        ? 'Within range'
        : 'Not classified';
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold text-[var(--clinora-text-faint)] md:hidden">{heading}</p>
      <div className="mt-1 flex flex-wrap items-baseline gap-2 md:mt-0">
        <span className="text-lg font-semibold text-white">
          {[observation.comparator, observation.displayValue].filter(Boolean).join(' ')}
        </span>
        {observation.unit ? <span className="text-xs text-[var(--clinora-text-muted)]">{observation.unit}</span> : null}
      </div>
      <div className="mt-2">
        <StatusPill tone={tone}>{label}</StatusPill>
      </div>
      <p className="mt-2 text-xs text-[var(--clinora-text-muted)]">
        {observation.referenceRange ? `Reference: ${observation.referenceRange}` : 'Reference range not provided'}
      </p>
    </div>
  );
}

function comparisonRows(data: DoctorReportComparison | null) {
  if (!data) return [];
  const left = new Map(data.left.observations.map((item) => [normalizedLabel(item.label), item]));
  const right = new Map(data.right.observations.map((item) => [normalizedLabel(item.label), item]));
  const keys = Array.from(new Set([...left.keys(), ...right.keys()])).sort((a, b) => a.localeCompare(b));
  return keys.map((key) => ({
    key,
    label: left.get(key)?.label || right.get(key)?.label || key,
    left: left.get(key),
    right: right.get(key),
  }));
}

function normalizedLabel(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}
