import {
  Activity,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  FileCheck2,
  FileText,
  LineChart as LineChartIcon,
  Minus,
  RefreshCcw,
  Sparkles,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AppSectionHeader, AppSurface, EmptyState, IconWell, StatusPill } from '../../components/app/app-ui';
import { Button } from '../../components/ui/button';
import { buttonVariants } from '../../components/ui/button-variants';
import { Skeleton } from '../../components/ui/feedback';
import { cn } from '../../lib/cn';
import {
  longitudinalHealthApi,
  longitudinalHealthError,
  type HealthArea,
  type HealthMeasurement,
  type HealthRangeStatus,
  type HealthRecordHighlight,
  type LongitudinalHealthRecord,
} from './longitudinal-health-api';

const DEFAULT_VISIBLE_MEASUREMENTS = 6;

export function LongitudinalHealthRecordSection() {
  const [record, setRecord] = useState<LongitudinalHealthRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCode, setSelectedCode] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const next = await longitudinalHealthApi.load();
      setRecord(next);
      setSelectedCode((current) => (current && findMeasurement(next, current) ? current : null));
    } catch (caught) {
      setError(longitudinalHealthError(caught, 'We could not refresh your longitudinal Health Record.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => (record && selectedCode ? findMeasurement(record, selectedCode) : null),
    [record, selectedCode],
  );

  return (
    <section aria-labelledby="longitudinal-health-record-title" className="scroll-mt-24">
      <AppSectionHeader
        eyebrow="Automatically updated from verified data"
        title="Longitudinal Health Record"
        titleId="longitudinal-health-record-title"
        copy="Clinora organizes eligible verified report results and your recorded body measurements into one longitudinal record. Uncertain report dates remain visible but never create medical trends."
        action={
          record?.snapshot.trackedMeasurements ? (
            <Link to="/patient/summary" className={buttonVariants({ variant: 'appPrimary' })}>
              <Sparkles size={15} aria-hidden="true" /> Personal Health Summary
            </Link>
          ) : null
        }
      />

      {loading ? <RecordSkeleton /> : null}
      {!loading && error ? <LoadError message={error} retry={load} /> : null}
      {!loading && !error && record ? (
        record.snapshot.trackedMeasurements === 0 ? (
          <AppSurface as="div" variant="standard" className="mt-6">
            <EmptyState
              icon={<FileCheck2 size={18} aria-hidden="true" />}
              title="No eligible longitudinal health data yet"
              copy="Verified report values will appear automatically after they pass Clinora's Health Record eligibility checks. Body measurements build from your Health Profile."
              action={
                <Link to="/patient/reports" className={buttonVariants({ variant: 'appSecondary' })}>
                  View Medical Reports <ArrowRight size={15} aria-hidden="true" />
                </Link>
              }
            />
          </AppSurface>
        ) : (
          <div className="mt-6 space-y-7">
            <SnapshotStrip record={record} />
            <Highlights highlights={record.highlights} />

            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.12fr)_minmax(360px,.88fr)]">
              <div className="space-y-5">
                {record.areas.map((area) => (
                  <HealthAreaSection
                    key={area.code}
                    area={area}
                    selectedCode={selectedCode}
                    onSelect={setSelectedCode}
                  />
                ))}
              </div>
              <div className="xl:sticky xl:top-24">
                {selected ? <MeasurementDetail measurement={selected} /> : <ChooseMeasurement />}
              </div>
            </div>

            <DataTrustNote dateUncertainReports={record.snapshot.dateUncertainReports} />
          </div>
        )
      ) : null}
    </section>
  );
}

function SnapshotStrip({ record }: { record: LongitudinalHealthRecord }) {
  const { snapshot } = record;
  const coverage =
    snapshot.coverageFrom && snapshot.coverageTo
      ? `${formatDate(snapshot.coverageFrom)} – ${formatDate(snapshot.coverageTo)}`
      : 'No reliable dated span yet';
  return (
    <AppSurface as="div" variant="hero" padding="compact">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5 xl:divide-x xl:divide-[var(--clinora-border-subtle)]">
        <SnapshotDatum label="Source reports" value={String(snapshot.reportsIncluded)} />
        <SnapshotDatum label="Tracked measurements" value={String(snapshot.trackedMeasurements)} />
        <SnapshotDatum label="Health areas" value={String(snapshot.healthAreas)} />
        <SnapshotDatum label="Reliable history" value={coverage} compact />
        <SnapshotDatum
          label="Date status"
          value={
            snapshot.dateUncertainReports
              ? `${snapshot.dateUncertainReports} report${snapshot.dateUncertainReports === 1 ? '' : 's'} need dates`
              : 'All report dates available'
          }
          compact
        />
      </div>
    </AppSurface>
  );
}

function SnapshotDatum({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className="min-w-0 xl:px-5 xl:first:pl-0 xl:last:pr-0">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--clinora-text-faint)]">{label}</p>
      <p className={cn('mt-1 font-semibold text-white', compact ? 'text-sm leading-6' : 'text-2xl tracking-[-0.03em]')}>
        {value}
      </p>
    </div>
  );
}

function Highlights({ highlights }: { highlights: HealthRecordHighlight[] }) {
  if (!highlights.length) return null;
  return (
    <div aria-label="Worth reviewing and recent changes">
      <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-[var(--clinora-info-foreground)]">
        Worth reviewing
      </p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {highlights.map((highlight) => (
          <AppSurface key={`${highlight.type}-${highlight.measurementCode}`} variant="nested" padding="compact">
            <div className="flex items-start gap-3">
              <IconWell
                tone={
                  abnormal(highlight.status) ? 'warning' : highlight.type === 'RETURNED_TO_RANGE' ? 'success' : 'info'
                }
              >
                {highlight.type === 'RETURNED_TO_RANGE' ? (
                  <FileCheck2 size={16} aria-hidden="true" />
                ) : (
                  <Activity size={16} aria-hidden="true" />
                )}
              </IconWell>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">{highlight.title}</p>
                <p className="mt-1 text-xs leading-5 text-[var(--clinora-text-muted)]">{highlight.detail}</p>
              </div>
            </div>
          </AppSurface>
        ))}
      </div>
    </div>
  );
}

function HealthAreaSection({
  area,
  selectedCode,
  onSelect,
}: {
  area: HealthArea;
  selectedCode: string | null;
  onSelect: (code: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? area.measurements : area.measurements.slice(0, DEFAULT_VISIBLE_MEASUREMENTS);
  const hiddenCount = area.measurements.length - visible.length;
  return (
    <AppSurface as="section" variant="standard" padding="none" aria-labelledby={`health-area-${area.code}`}>
      <div className="border-b border-[var(--clinora-border-subtle)] px-5 py-4 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 id={`health-area-${area.code}`} className="text-base font-semibold text-white">
              {area.title}
            </h3>
            <p className="mt-1 text-xs text-[var(--clinora-text-faint)]">
              {area.measurements.length}{' '}
              {area.measurements.length === 1 ? 'tracked measurement' : 'tracked measurements'}
            </p>
          </div>
          {area.measurements.length > DEFAULT_VISIBLE_MEASUREMENTS ? (
            <Button variant="ghost" size="sm" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
              {expanded ? <ChevronUp size={15} aria-hidden="true" /> : <ChevronDown size={15} aria-hidden="true" />}
              {expanded ? 'Show less' : `View all ${area.measurements.length}`}
            </Button>
          ) : null}
        </div>
      </div>
      <div className="divide-y divide-[var(--clinora-border-subtle)]">
        {visible.map((measurement) => (
          <MeasurementRow
            key={measurement.code}
            measurement={measurement}
            selected={selectedCode === measurement.code}
            onSelect={() => onSelect(measurement.code)}
          />
        ))}
      </div>
      {!expanded && hiddenCount > 0 ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="w-full border-t border-[var(--clinora-border-subtle)] px-5 py-3 text-left text-xs font-semibold text-[var(--clinora-info-foreground)] sm:px-6"
        >
          + {hiddenCount} more {hiddenCount === 1 ? 'measurement' : 'measurements'}
        </button>
      ) : null}
    </AppSurface>
  );
}

function MeasurementRow({
  measurement,
  selected,
  onSelect,
}: {
  measurement: HealthMeasurement;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-3.5 text-left transition sm:grid-cols-[minmax(0,1.15fr)_minmax(145px,.75fr)_minmax(150px,.75fr)_auto] sm:px-6',
        selected
          ? 'bg-[var(--clinora-info-soft)] ring-1 ring-inset ring-[var(--clinora-border-interactive)]'
          : 'hover:bg-[var(--clinora-surface-hover)]',
      )}
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-white">{measurement.name}</p>
        <p className="mt-1 text-xs text-[var(--clinora-text-faint)]">{historyAvailability(measurement)}</p>
      </div>
      <div className="text-right sm:text-left">
        <p className="text-sm font-semibold tabular-nums text-white">{formatObservationValue(measurement.latest)}</p>
        <p className="mt-1 text-xs text-[var(--clinora-text-faint)]">{dateLabel(measurement.latest)}</p>
      </div>
      <div className="hidden sm:block">
        <TrendLabel measurement={measurement} />
      </div>
      <div className="flex items-center gap-2">
        <RangePill status={measurement.latest.status} />
        <span className="hidden whitespace-nowrap text-xs font-semibold text-[var(--clinora-info-foreground)] lg:inline">
          {measurement.graph.available ? 'View trend' : 'View history'}
        </span>
        <ArrowRight size={14} className="text-[var(--clinora-text-faint)]" aria-hidden="true" />
      </div>
    </button>
  );
}

function ChooseMeasurement() {
  return (
    <AppSurface as="aside" variant="elevated">
      <EmptyState
        icon={<LineChartIcon size={18} aria-hidden="true" />}
        title="Select a measurement to view its history"
        copy="Measurements with reliable comparable dates show a change or trend. Undated report results remain visible without being plotted as medical chronology."
      />
    </AppSurface>
  );
}

function MeasurementDetail({ measurement }: { measurement: HealthMeasurement }) {
  const latest = measurement.latest;
  const points = measurement.graph.points.map((point) => ({
    ...point,
    shortDate: new Date(`${point.date}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
    fullDate: formatDate(point.date),
  }));
  const previous = points.length >= 2 ? points.at(-2)! : null;

  return (
    <AppSurface as="aside" variant="elevated" aria-labelledby="selected-measurement-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--clinora-info-foreground)]">
            Measurement history
          </p>
          <h3 id="selected-measurement-title" className="mt-2 text-xl font-semibold tracking-[-0.025em] text-white">
            {measurement.name}
          </h3>
        </div>
        <RangePill status={latest.status} />
      </div>

      <div className="mt-5 border-b border-[var(--clinora-border-subtle)] pb-5">
        <p className="text-xs text-[var(--clinora-text-faint)]">Latest recorded result</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <p className="text-3xl font-semibold tracking-[-0.04em] text-white">{formatObservationValue(latest)}</p>
          <TrendLabel measurement={measurement} detailed />
        </div>
        <p className="mt-2 text-xs text-[var(--clinora-text-faint)]">{dateLabel(latest)}</p>
      </div>

      {measurement.trend.comparableDataPoints >= 2 ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
          <DetailMetric
            label="Previous"
            value={previous ? `${formatNumber(previous.value)}${previous.unit ? ` ${previous.unit}` : ''}` : '—'}
          />
          <DetailMetric
            label="Absolute change"
            value={formatSignedChange(measurement.trend.absoluteChange, measurement.trend.chartUnit)}
          />
          <DetailMetric label="Percentage change" value={formatPercentage(measurement.trend.percentageChange)} />
        </div>
      ) : null}

      {measurement.graph.available ? (
        <div className="mt-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-white">
              {measurement.trend.trendQualified
                ? 'Trend across reliably dated results'
                : 'Change between reliably dated results'}
            </p>
            <span className="text-xs text-[var(--clinora-text-faint)]">
              {measurement.trend.comparableDataPoints} comparable results
            </span>
          </div>
          <div
            className="h-64 min-w-0"
            role="img"
            aria-label={`${measurement.name} history with ${points.length} reliably dated comparable results.`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 8, right: 12, bottom: 4, left: -10 }}>
                <CartesianGrid stroke="rgba(148,163,184,.12)" vertical={false} />
                <XAxis
                  dataKey="shortDate"
                  tick={{ fill: '#8b9bb1', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={18}
                />
                <YAxis
                  tick={{ fill: '#8b9bb1', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  domain={['dataMin', 'dataMax']}
                  width={56}
                />
                <Tooltip
                  contentStyle={{ background: '#081221', border: '1px solid rgba(148,163,184,.18)', borderRadius: 12 }}
                  labelStyle={{ color: '#cbd5e1' }}
                  formatter={(value) => [
                    `${formatNumber(Number(value))}${measurement.trend.chartUnit ? ` ${measurement.trend.chartUnit}` : ''}`,
                    measurement.name,
                  ]}
                  labelFormatter={(_, payload) => payload[0]?.payload.fullDate ?? ''}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="var(--clinora-accent-cyan-strong)"
                  strokeWidth={2.5}
                  dot={{ fill: '#07101f', stroke: '#22d3ee', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {measurement.graph.normalizedUnits ? (
            <p className="mt-2 text-xs leading-5 text-[var(--clinora-text-faint)]">
              Comparable units were normalized for the graph. Original values remain preserved in their source records.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="mt-5 rounded-[var(--radius-app-compact)] border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-nested)] p-4">
          <p className="text-sm font-semibold text-white">No chronological graph yet</p>
          <p className="mt-1 text-xs leading-5 text-[var(--clinora-text-muted)]">
            {measurement.graph.reason ?? 'Clinora needs more reliably dated comparable history before drawing a graph.'}
          </p>
        </div>
      )}

      <dl className="mt-5 divide-y divide-[var(--clinora-border-subtle)] border-y border-[var(--clinora-border-subtle)]">
        <DetailDatum label="Supplied reference" value={referenceLabel(latest)} />
        <DetailDatum
          label={latest.dateReliable ? 'Clinical date' : 'Timeline date'}
          value={latest.dateReliable && latest.date ? formatDate(latest.date) : formatDate(latest.displayDate)}
        />
        <DetailDatum label="Date source" value={dateSourceLabel(latest)} />
        <DetailDatum
          label="Source"
          value={
            latest.sourceType === 'PATIENT_PROFILE' ? 'Health Profile' : latest.providerLaboratory || latest.reportName
          }
        />
      </dl>

      {!latest.dateReliable ? (
        <p className="mt-4 text-xs leading-5 text-[var(--clinora-warning-foreground)]">
          Report date unavailable — the upload date is shown only for reference. This result is excluded from
          chronological trends and period summaries until the report date is confirmed.
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-3">
        {latest.reportId ? (
          <Link to={`/patient/reports/${latest.reportId}`} className={buttonVariants({ variant: 'appSecondary' })}>
            <FileText size={15} aria-hidden="true" /> View source report
          </Link>
        ) : latest.sourceType === 'PATIENT_PROFILE' ? (
          <Link to="/patient/profile?section=basic" className={buttonVariants({ variant: 'appSecondary' })}>
            View Health Profile
          </Link>
        ) : null}
      </div>

      {points.length ? <HistoryTable measurement={measurement} points={points} /> : null}
    </AppSurface>
  );
}

function HistoryTable({
  measurement,
  points,
}: {
  measurement: HealthMeasurement;
  points: Array<HealthMeasurement['graph']['points'][number] & { fullDate: string }>;
}) {
  return (
    <details className="mt-5 border-t border-[var(--clinora-border-subtle)] pt-4">
      <summary className="cursor-pointer text-sm font-semibold text-[var(--clinora-info-foreground)]">
        View comparable dated history
      </summary>
      <div className="mt-3 space-y-2">
        {points.map((point) => (
          <div
            key={`${point.sourceId}-${point.date}-${point.value}`}
            className="grid gap-2 rounded-lg bg-[var(--clinora-surface-nested)] px-3 py-3 sm:grid-cols-[110px_minmax(0,1fr)_auto] sm:items-center"
          >
            <span className="text-xs text-[var(--clinora-text-faint)]">{point.fullDate}</span>
            <span className="text-sm font-medium tabular-nums text-white">
              {formatNumber(point.value)}
              {point.unit ? ` ${point.unit}` : ''}
            </span>
            <div className="flex items-center gap-2 sm:justify-end">
              <RangePill status={point.status} compact />
              {point.reportId ? (
                <Link
                  to={`/patient/reports/${point.reportId}`}
                  className="text-xs font-semibold text-[var(--clinora-info-foreground)]"
                >
                  Source
                </Link>
              ) : (
                <span className="text-xs text-[var(--clinora-text-faint)]">Health Profile</span>
              )}
            </div>
          </div>
        ))}
      </div>
      {measurement.graph.normalizedUnits ? (
        <p className="mt-2 text-xs text-[var(--clinora-text-faint)]">
          Graph values may use normalized comparable units.
        </p>
      ) : null}
    </details>
  );
}

function TrendLabel({ measurement, detailed = false }: { measurement: HealthMeasurement; detailed?: boolean }) {
  const { direction, comparableDataPoints, trendQualified } = measurement.trend;
  if (comparableDataPoints < 2 || direction === 'INSUFFICIENT_DATA' || direction === 'NOT_COMPARABLE') {
    return <span className="text-xs text-[var(--clinora-text-faint)]">Not enough comparable history</span>;
  }
  const content =
    direction === 'INCREASING'
      ? { icon: <ArrowUp size={14} aria-hidden="true" />, label: trendQualified ? 'Increasing trend' : 'Increased' }
      : direction === 'DECREASING'
        ? { icon: <ArrowDown size={14} aria-hidden="true" />, label: trendQualified ? 'Decreasing trend' : 'Decreased' }
        : direction === 'MIXED'
          ? { icon: <Activity size={14} aria-hidden="true" />, label: 'Mixed pattern' }
          : {
              icon: <Minus size={14} aria-hidden="true" />,
              label: trendQualified ? 'Relatively stable trend' : 'Little change',
            };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium text-[var(--clinora-info-foreground)]',
        detailed ? 'text-sm' : 'text-xs',
      )}
    >
      {content.icon} {content.label}
    </span>
  );
}

function historyAvailability(measurement: HealthMeasurement) {
  const points = measurement.trend.comparableDataPoints;
  if (points === 0 || points === 1)
    return `${measurement.historyCount} result${measurement.historyCount === 1 ? '' : 's'} · Not enough dated history`;
  if (points === 2) return '2 comparable results · Change available';
  return `${points} comparable results · Trend available`;
}

function RangePill({ status, compact = false }: { status: HealthRangeStatus; compact?: boolean }) {
  const tone = status === 'IN_RANGE' ? 'success' : abnormal(status) ? 'warning' : 'neutral';
  const label = status === 'IN_RANGE' ? 'In range' : status === 'LOW' ? 'Low' : status === 'HIGH' ? 'High' : 'Reported';
  return (
    <StatusPill tone={tone} className={compact ? 'min-h-6 px-2 py-0.5 text-[11px]' : undefined}>
      {label}
    </StatusPill>
  );
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-app-compact)] bg-[var(--clinora-surface-nested)] px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--clinora-text-faint)]">{label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-white">{value}</p>
    </div>
  );
}

function DetailDatum({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <dt className="text-xs text-[var(--clinora-text-faint)]">{label}</dt>
      <dd className="max-w-[65%] text-right text-xs font-medium text-[var(--clinora-text-muted)]">{value}</dd>
    </div>
  );
}

function DataTrustNote({ dateUncertainReports }: { dateUncertainReports: number }) {
  return (
    <div className="flex items-start gap-3 border-y border-[var(--clinora-border-subtle)] py-4">
      <FileCheck2 size={18} className="mt-0.5 shrink-0 text-[var(--clinora-success-foreground)]" aria-hidden="true" />
      <div>
        <p className="text-sm font-semibold text-white">Built from eligible verified source data</p>
        <p className="mt-1 max-w-3xl text-xs leading-5 text-[var(--clinora-text-muted)]">
          Clinora filters report metadata and malformed extraction noise, normalizes known biomarker aliases, and
          preserves source provenance. Only reliably dated compatible values create chronological graphs.
          {dateUncertainReports
            ? ` ${dateUncertainReports} verified report${dateUncertainReports === 1 ? '' : 's'} currently need a report date before they can contribute to trends.`
            : ''}
        </p>
      </div>
    </div>
  );
}

function LoadError({ message, retry }: { message: string; retry: () => Promise<void> }) {
  return (
    <AppSurface as="div" variant="attention" className="mt-6">
      <p role="alert" className="text-sm leading-6 text-[var(--clinora-text-muted)]">
        {message}
      </p>
      <Button variant="appSecondary" className="mt-4" onClick={() => void retry()}>
        <RefreshCcw size={15} aria-hidden="true" /> Try again
      </Button>
    </AppSurface>
  );
}

function RecordSkeleton() {
  return (
    <div className="mt-6 space-y-5" role="status" aria-label="Loading longitudinal Health Record">
      <Skeleton className="h-24 rounded-2xl" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    </div>
  );
}

function findMeasurement(record: LongitudinalHealthRecord, code: string) {
  return record.areas.flatMap((area) => area.measurements).find((measurement) => measurement.code === code) ?? null;
}

export function formatObservationValue(observation: HealthMeasurement['latest']) {
  if (observation.numericValue != null) {
    return `${observation.comparator ?? ''}${formatNumber(observation.numericValue)}${observation.unit ? ` ${observation.unit}` : ''}`;
  }
  return observation.textValue?.trim() || 'Reported';
}

function referenceLabel(observation: HealthMeasurement['latest']) {
  if (observation.referenceRangeRaw?.trim()) return observation.referenceRangeRaw.trim();
  if (observation.referenceLow != null && observation.referenceHigh != null) {
    return `${formatNumber(observation.referenceLow)} – ${formatNumber(observation.referenceHigh)}${observation.unit ? ` ${observation.unit}` : ''}`;
  }
  if (observation.referenceLow != null)
    return `≥ ${formatNumber(observation.referenceLow)}${observation.unit ? ` ${observation.unit}` : ''}`;
  if (observation.referenceHigh != null)
    return `≤ ${formatNumber(observation.referenceHigh)}${observation.unit ? ` ${observation.unit}` : ''}`;
  return 'Not supplied';
}

function dateLabel(observation: HealthMeasurement['latest']) {
  if (observation.dateReliable && observation.date) return formatDate(observation.date);
  return `${formatDate(observation.displayDate)} · date uncertain`;
}

function dateSourceLabel(observation: HealthMeasurement['latest']) {
  if (observation.dateBasis === 'REPORT_DATE') return 'Report date';
  if (observation.dateBasis === 'PROFILE_RECORDED_AT') return 'Health Profile recorded date';
  return 'Upload date shown for reference only';
}

function formatSignedChange(value: number | null, unit: string | null) {
  if (value == null) return '—';
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${formatNumber(Math.abs(value))}${unit ? ` ${unit}` : ''}`;
}

function formatPercentage(value: number | null) {
  if (value == null) return '—';
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${formatNumber(Math.abs(value))}%`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(value);
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function abnormal(status: HealthRangeStatus | string | null) {
  return status === 'LOW' || status === 'HIGH';
}
