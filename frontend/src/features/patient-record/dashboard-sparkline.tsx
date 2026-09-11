import { useId } from 'react';
import { Area, AreaChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { BodyMeasurementPoint } from './patient-record-api';
import {
  dashboardMeasurements,
  dashboardTrend,
  measurementChange,
  measurementValue,
  type DashboardTrendMetric,
} from './dashboard-trend-model';

export function DashboardSparkline({
  points,
  metric,
}: {
  points: BodyMeasurementPoint[];
  metric: DashboardTrendMetric;
}) {
  const gradient = useId().replace(/:/g, '');
  const { label, unit, color } = dashboardMeasurements[metric];
  const { observations, first, latest, change, domain } = dashboardTrend(points, metric);
  if (!latest) return <span className="patient-home__trend-note">No history yet</span>;
  if (observations.length === 1)
    return <span className="patient-home__trend-note">Recorded {dateLabel(latest.timestamp)}</span>;
  const summary = `${measurementChange(change!, unit)} since ${dateLabel(first.timestamp)}`;
  if (observations.length < 3 || first.timestamp === latest.timestamp) {
    return <span className="patient-home__trend-note">{summary}</span>;
  }
  return (
    <div className="patient-home__trend">
      <div
        className="patient-home__sparkline"
        role="img"
        aria-label={`${label}: ${observations.length} recorded observations. ${summary}. Latest ${measurementValue(latest.value)} ${unit}.`}
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 120, height: 44 }}>
          <AreaChart data={observations} margin={{ top: 5, right: 5, bottom: 5, left: 3 }} accessibilityLayer>
            <defs>
              <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.2} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis hide dataKey="timestamp" type="number" scale="time" domain={['dataMin', 'dataMax']} />
            <YAxis hide type="number" domain={domain} />
            <Tooltip
              content={({ active, payload }) => {
                const point = payload?.[0]?.payload as { timestamp: number; value: number } | undefined;
                return active && point ? (
                  <div className="patient-home__chart-tooltip">
                    <time dateTime={new Date(point.timestamp).toISOString()}>
                      {new Date(point.timestamp).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                    </time>
                    <strong>
                      {measurementValue(point.value)} {unit}
                    </strong>
                  </div>
                ) : null;
              }}
              cursor={{ stroke: color, strokeOpacity: 0.25 }}
              allowEscapeViewBox={{ x: true, y: true }}
              isAnimationActive={false}
            />
            <Area
              type="linear"
              dataKey="value"
              stroke={color}
              strokeWidth={1.8}
              fill={`url(#${gradient})`}
              isAnimationActive={false}
              connectNulls={false}
              dot={false}
              activeDot={{ r: 3, fill: color, stroke: '#04121d', strokeWidth: 1.5 }}
            />
            <ReferenceDot x={latest.timestamp} y={latest.value} r={3} fill={color} stroke="#04121d" strokeWidth={1.5} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <span className="patient-home__trend-note">{summary}</span>
    </div>
  );
}

function dateLabel(timestamp: number) {
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
