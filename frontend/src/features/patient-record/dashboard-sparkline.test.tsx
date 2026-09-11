import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardSparkline } from './dashboard-sparkline';
import type { BodyMeasurementPoint } from './patient-record-api';

// Test fixtures only: production charts receive the existing authenticated history API.
const points: BodyMeasurementPoint[] = [
  {
    id: 'a',
    recordedAt: '2026-09-01T08:00:00Z',
    weightKg: 72,
    heightCm: null,
    bmi: null,
    sourceType: 'PATIENT_PROFILE',
  },
  {
    id: 'b',
    recordedAt: '2026-09-07T08:00:00Z',
    weightKg: 71,
    heightCm: null,
    bmi: null,
    sourceType: 'PATIENT_PROFILE',
  },
  {
    id: 'c',
    recordedAt: '2026-09-10T08:00:00Z',
    weightKg: 71.5,
    heightCm: null,
    bmi: null,
    sourceType: 'PATIENT_PROFILE',
  },
];

describe('Patient dashboard sparklines', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 150,
      height: 44,
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 150,
      bottom: 44,
      toJSON: () => ({}),
    });
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each([0, 1, 2])('does not render a chart for %s observations', (count) => {
    const view = render(<DashboardSparkline points={points.slice(0, count)} metric="weightKg" />);
    expect(view.container.querySelector('svg')).toBeNull();
    if (count === 0) expect(screen.getByText('No history yet')).toBeInTheDocument();
    if (count === 1) expect(screen.getByText(/Recorded Sep 1/)).toBeInTheDocument();
    if (count === 2) expect(screen.getByText(/−1 kg since Sep 1/)).toBeInTheDocument();
  });

  it('renders Recharts and emphasizes the latest of three real points', () => {
    const view = render(<DashboardSparkline points={points} metric="weightKg" />);
    expect(screen.getByRole('img', { name: /Weight: 3 recorded observations.*Latest 71.5 kg/ })).toBeInTheDocument();
    expect(view.container.querySelector('.recharts-area')).toBeInTheDocument();
    expect(view.container.querySelector('.recharts-reference-dot')).toBeInTheDocument();
  });

  it('exposes the recorded date, value and unit in the keyboard tooltip', async () => {
    const view = render(<DashboardSparkline points={points} metric="weightKg" />);
    const chart = view.container.querySelector('.recharts-surface')!;
    fireEvent.focus(chart);
    fireEvent.keyDown(chart, { key: 'ArrowRight' });
    expect(await screen.findByText('71 kg')).toBeInTheDocument();
    expect(view.container.querySelector('.patient-home__chart-tooltip time')).toHaveAttribute(
      'dateTime',
      '2026-09-07T08:00:00.000Z',
    );
  });

  it('does not draw a timeline when all observations have the same timestamp', () => {
    const view = render(
      <DashboardSparkline
        points={points.map((point) => ({ ...point, recordedAt: points[0].recordedAt }))}
        metric="weightKg"
      />,
    );
    expect(view.container.querySelector('svg')).toBeNull();
  });
});
