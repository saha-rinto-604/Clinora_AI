import type { BodyMeasurementPoint } from './patient-record-api';

export type DashboardTrendMetric = 'heightCm' | 'weightKg' | 'bmi';
export const dashboardMeasurements = {
  heightCm: { label: 'Height', unit: 'cm', minimumSpan: 10, color: '#22d3ee' },
  weightKg: { label: 'Weight', unit: 'kg', minimumSpan: 10, color: '#38bdf8' },
  bmi: { label: 'BMI', unit: 'kg/m²', minimumSpan: 4, color: '#a78bfa' },
} as const;

export function dashboardTrend(points: BodyMeasurementPoint[], metric: DashboardTrendMetric) {
  const seen = new Set<string>();
  const observations = points
    .flatMap((point) => {
      const value = point[metric];
      const timestamp = Date.parse(point.recordedAt);
      if (seen.has(point.id) || value == null || !Number.isFinite(value) || value <= 0 || !Number.isFinite(timestamp))
        return [];
      seen.add(point.id);
      return [{ id: point.id, value, timestamp }];
    })
    .sort((a, b) => a.timestamp - b.timestamp);
  const first = observations[0];
  const latest = observations.at(-1);
  const change = first && latest && observations.length >= 2 ? latest.value - first.value : null;
  const values = observations.map((point) => point.value);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;
  const span = Math.max(max - min, dashboardMeasurements[metric].minimumSpan, max * 0.1);
  const middle = (min + max) / 2;
  const domain: [number, number] = [Math.max(0, middle - span * 0.6), middle + span * 0.6];
  return { observations, first, latest, change, domain };
}

export function measurementValue(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function measurementChange(change: number, unit: string) {
  if (change === 0) return 'No change';
  const magnitude = Math.abs(change);
  return `${change > 0 ? '+' : '−'}${magnitude < 0.01 ? '<0.01' : measurementValue(magnitude)} ${unit}`;
}
