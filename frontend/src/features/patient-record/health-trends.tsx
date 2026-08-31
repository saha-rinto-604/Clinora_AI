import { ArrowRight, LineChart as LineChartIcon, RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AppSectionHeader, AppSurface } from '../../components/app/app-ui';
import { Button } from '../../components/ui/button';
import { buttonVariants } from '../../components/ui/button-variants';
import { Skeleton } from '../../components/ui/feedback';
import { cn } from '../../lib/cn';
import type { BodyMeasurementPoint, HealthTrends } from './patient-record-api';
import { formatRecordDate } from './health-record-format';
import { ProfileSourceLabel } from './health-record-shell';

type TrendMetric = 'weightKg' | 'bmi';

export function HealthTrendsSection({
  trends,
  loading,
  error,
  retry,
}: {
  trends: HealthTrends | null;
  loading: boolean;
  error: string;
  retry: () => void;
}) {
  const [metric, setMetric] = useState<TrendMetric>('weightKg');
  const points = useMemo(() => metricPoints(trends?.points ?? [], metric), [metric, trends]);
  const label = metric === 'weightKg' ? 'Weight' : 'BMI';
  const unit = metric === 'weightKg' ? 'kg' : 'BMI';
  const first = points[0];
  const latest = points.at(-1);
  const change = first && latest ? latest.value - first.value : null;

  return (
    <AppSurface as="section" variant="elevated" aria-labelledby="health-trends-title">
      <AppSectionHeader
        eyebrow="Measurements over time"
        title="Health Trends"
        titleId="health-trends-title"
        copy="See how measurements recorded through your Health Profile change over time."
      />

      {loading ? (
        <div role="status" aria-label="Loading Health Trends" className="mt-6 space-y-4">
          <Skeleton className="h-10 w-48 rounded-xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      ) : null}
      {!loading && error ? (
        <div className="mt-6 rounded-xl border border-rose-300/15 bg-rose-300/[0.04] p-4">
          <p role="alert" className="text-sm text-[var(--clinora-text-muted)]">
            Health Trends could not be refreshed. The rest of your Health Record is still available.
          </p>
          <Button variant="appSecondary" className="mt-3" onClick={retry}>
            <RotateCcw size={15} aria-hidden="true" /> Try again
          </Button>
        </div>
      ) : null}
      {!loading && !error ? (
        <>
          <div
            className="mt-6 flex w-fit rounded-xl border border-[var(--clinora-border-subtle)] p-1"
            role="group"
            aria-label="Health trend measurement"
          >
            {(['weightKg', 'bmi'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setMetric(value)}
                aria-pressed={metric === value}
                className={cn(
                  'min-h-10 rounded-lg px-4 text-sm font-semibold transition',
                  metric === value
                    ? 'bg-[var(--clinora-info-soft)] text-[var(--clinora-info-foreground)]'
                    : 'text-[var(--clinora-text-muted)] hover:text-white',
                )}
              >
                {value === 'weightKg' ? 'Weight' : 'BMI'}
              </button>
            ))}
          </div>

          {points.length === 0 ? <NoMeasurements /> : null}
          {points.length === 1 && latest ? <OneMeasurement point={latest} label={label} unit={unit} /> : null}
          {points.length >= 2 && latest && first ? (
            <div className="mt-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--clinora-text-faint)]">
                    Latest {label.toLowerCase()}
                  </p>
                  <p className="mt-1 text-3xl font-semibold tracking-[-0.04em] text-white">
                    {formatValue(latest.value, metric)}{' '}
                    <span className="text-base text-[var(--clinora-text-muted)]">{unit}</span>
                  </p>
                </div>
                <div className="text-right text-sm text-[var(--clinora-text-muted)]">
                  <p>
                    {formatChange(change!, metric)} since {formatRecordDate(first.recordedAt)}
                  </p>
                  <p className="mt-1 text-xs text-[var(--clinora-text-faint)]">{points.length} recorded measurements</p>
                </div>
              </div>
              <div
                className="mt-6 h-64 min-w-0"
                role="img"
                aria-label={`${label} trend with ${points.length} recorded measurements from ${formatRecordDate(first.recordedAt)} to ${formatRecordDate(latest.recordedAt)}.`}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={points} margin={{ top: 8, right: 12, bottom: 4, left: -14 }}>
                    <CartesianGrid stroke="rgba(148,163,184,.12)" vertical={false} />
                    <XAxis
                      dataKey="shortDate"
                      tick={{ fill: '#8b9bb1', fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={24}
                    />
                    <YAxis
                      tick={{ fill: '#8b9bb1', fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      domain={['dataMin - 1', 'dataMax + 1']}
                    />
                    <Tooltip
                      contentStyle={{
                        background: '#081221',
                        border: '1px solid rgba(148,163,184,.18)',
                        borderRadius: 12,
                      }}
                      labelStyle={{ color: '#cbd5e1' }}
                      formatter={(value) => [`${formatValue(Number(value), metric)} ${unit}`, label]}
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
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <ProfileSourceLabel />
                <p className="text-xs text-[var(--clinora-text-faint)]">
                  Last recorded {formatRecordDate(latest.recordedAt)}
                </p>
              </div>
              <MeasurementTable points={trends?.points ?? []} />
            </div>
          ) : null}
        </>
      ) : null}
    </AppSurface>
  );
}

function NoMeasurements() {
  return (
    <div className="mt-6 border-t border-[var(--clinora-border-subtle)] pt-6">
      <LineChartIcon size={22} className="text-[var(--clinora-info-foreground)]" aria-hidden="true" />
      <h3 className="mt-4 text-lg font-semibold text-white">No historical measurements yet</h3>
      <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--clinora-text-muted)]">
        Your current measurements will appear here, and trends will build as measurements are updated over time.
      </p>
      <Link to="/patient/profile?section=basic" className={cn(buttonVariants({ variant: 'appSecondary' }), 'mt-4')}>
        Update Health Profile <ArrowRight size={15} aria-hidden="true" />
      </Link>
    </div>
  );
}

function OneMeasurement({ point, label, unit }: { point: ChartPoint; label: string; unit: string }) {
  return (
    <div className="mt-6 border-t border-[var(--clinora-border-subtle)] pt-6">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--clinora-text-faint)]">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-white">
        {point.value.toFixed(1)} <span className="text-base text-[var(--clinora-text-muted)]">{unit}</span>
      </p>
      <p className="mt-2 text-sm text-[var(--clinora-text-muted)]">Recorded {point.fullDate}</p>
      <p className="mt-4 max-w-xl text-sm leading-6 text-[var(--clinora-text-muted)]">
        One measurement recorded. A trend will appear after another measurement is recorded.
      </p>
      <div className="mt-4">
        <ProfileSourceLabel />
      </div>
    </div>
  );
}

function MeasurementTable({ points }: { points: BodyMeasurementPoint[] }) {
  return (
    <details className="mt-5 border-t border-[var(--clinora-border-subtle)] pt-4">
      <summary className="cursor-pointer text-sm font-semibold text-[var(--clinora-info-foreground)]">
        View measurements
      </summary>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[28rem] text-left text-sm">
          <thead className="text-xs text-[var(--clinora-text-faint)]">
            <tr>
              <th className="py-2 pr-4">Date</th>
              <th className="py-2 pr-4">Weight</th>
              <th className="py-2">BMI</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--clinora-border-subtle)] text-[var(--clinora-text-muted)]">
            {points.map((point) => (
              <tr key={point.id}>
                <td className="py-3 pr-4">{formatRecordDate(point.recordedAt)}</td>
                <td className="py-3 pr-4">
                  {point.weightKg == null ? 'Not recorded' : `${point.weightKg.toFixed(1)} kg`}
                </td>
                <td className="py-3">{point.bmi == null ? 'Not available' : point.bmi.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

interface ChartPoint {
  value: number;
  recordedAt: string;
  shortDate: string;
  fullDate: string;
}

function metricPoints(points: BodyMeasurementPoint[], metric: TrendMetric): ChartPoint[] {
  return points
    .filter((point) => point[metric] != null)
    .map((point) => ({
      value: point[metric]!,
      recordedAt: point.recordedAt,
      shortDate: new Date(point.recordedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
      fullDate: formatRecordDate(point.recordedAt),
    }));
}

function formatValue(value: number, metric: TrendMetric) {
  return metric === 'weightKg' ? value.toFixed(1) : value.toFixed(1);
}

function formatChange(value: number, metric: TrendMetric) {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  const unit = metric === 'weightKg' ? ' kg' : ' BMI';
  return `${sign}${Math.abs(value).toFixed(1)}${unit}`;
}
