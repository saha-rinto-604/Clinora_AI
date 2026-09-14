import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PersonalHealthSummary } from './longitudinal-health-api';
import { longitudinalHealthApi } from './longitudinal-health-api';
import { PersonalHealthSummaryPanel } from './personal-health-summary-panel';

describe('PersonalHealthSummaryPanel briefing', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(longitudinalHealthApi, 'providerStatus').mockResolvedValue({ status: 'CONFIGURED', model: 'gemini-2.5-flash', configured: true });
  });

  it('renders the distinct briefing sections and expands exact evidence for an undated verified lab', async () => {
    vi.spyOn(longitudinalHealthApi, 'generateSummary').mockResolvedValue(summary('AVAILABLE'));
    const user = userEvent.setup();
    renderPanel();
    expect(await screen.findByText('Clinora AI · Gemini 2.5 Flash')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Generate summary' }));

    for (const heading of ['Your Health Picture', 'What Stands Out', 'What Changed', 'What Looks Stable',
      'What May Deserve Follow-up', 'Questions for Your Next Visit', 'What Clinora Cannot Determine Yet']) {
      expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
    }
    expect(screen.getByText('Glucose regulation')).toBeInTheDocument();
    expect(screen.getAllByText(/HbA1c is 6.8%/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Undated findings are never used here/)).toBeInTheDocument();

    await user.click(screen.getAllByText('View evidence')[0]);
    expect(screen.getAllByText('6.8%').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Clinical date unavailable.*not used for chronology/).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Open source report' })[0]).toHaveAttribute('href', '/patient/reports/report-1');
  });

  it('separates provider failure from configuration and forces a fresh retry', async () => {
    const generate = vi.spyOn(longitudinalHealthApi, 'generateSummary')
      .mockResolvedValueOnce(summary('PERMISSION_DENIED'))
      .mockResolvedValueOnce(summary('AVAILABLE'));
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole('button', { name: 'Generate summary' }));
    expect(await screen.findByText('AI explanation unavailable')).toBeInTheDocument();
    expect(screen.getByText(/does not currently permit this AI explanation/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Refresh summary' }));
    expect(await screen.findByText('AI explanation generated')).toBeInTheDocument();
    expect(generate).toHaveBeenNthCalledWith(2, { period: 'LAST_12_MONTHS', forceRefresh: true });
  });

  it('shows insufficient data separately while keeping the deterministic briefing', async () => {
    vi.spyOn(longitudinalHealthApi, 'generateSummary').mockResolvedValue(summary('INSUFFICIENT_DATA', true));
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole('button', { name: 'Generate summary' }));
    expect(await screen.findByText('More verified data needed')).toBeInTheDocument();
    expect(screen.getByText(/not enough eligible verified health information yet/i)).toBeInTheDocument();
    expect(screen.queryByText(/temporarily unavailable/i)).not.toBeInTheDocument();
  });
});

function renderPanel() {
  render(<MemoryRouter><PersonalHealthSummaryPanel /></MemoryRouter>);
}

function summary(status: PersonalHealthSummary['aiSummary']['status'], empty = false): PersonalHealthSummary {
  const evidence = empty ? [] : [{
    evidenceId: 'E1', measurementCode: 'HBA1C', measurementName: 'HbA1c', healthAreaCode: 'GLUCOSE',
    healthAreaTitle: 'Glucose regulation', displayValue: '6.8%', unit: '%', suppliedRange: '4.0-5.6',
    status: 'HIGH' as const, clinicalDate: null, displayDate: '2026-09-14', dateReliable: false,
    chronologyEligible: false, dateBasis: 'UPLOAD_FALLBACK', sourceReportId: 'report-1', sourceReportName: 'Verified lab report',
    verificationStatus: 'PATIENT_CONFIRMED', sourceType: 'MEDICAL_REPORT' as const,
  }];
  return {
    period: { preset: 'LAST_12_MONTHS', label: 'Last 12 months', from: '2025-09-15', to: '2026-09-15' },
    snapshot: {
      verifiedReportsAvailable: empty ? 0 : 1, reliablyDatedReports: 0, dateUncertainVerifiedReports: empty ? 0 : 1,
      trackedVerifiedMeasurements: empty ? 0 : 1, healthAreasRepresented: empty ? 0 : 1,
      measurementsWithComparableHistory: 0, observationsExcludedByValidation: 0, measurementsWithIncompatibleHistory: 0,
      coverageFrom: null, coverageTo: null,
    },
    healthPicture: empty ? 'There is not enough eligible verified health information to describe your current health picture yet.'
      : 'Your current verified record shows HbA1c is 6.8% (high).',
    keyThemes: empty ? [] : [{ id: 'T-GLUCOSE', title: 'Glucose regulation', description: 'HbA1c is 6.8% and above its supplied range.', evidenceIds: ['E1'] }],
    changes: [], stableContext: [],
    followUpItems: empty ? [] : [{ id: 'F-1', text: 'HbA1c of 6.8% may be worth discussing in clinical context.', evidenceIds: ['E1'] }],
    visitQuestions: empty ? [] : [{ id: 'Q-1', text: 'How should my HbA1c of 6.8% be interpreted?', evidenceIds: ['E1'] }],
    limitations: empty ? [{ title: 'Not enough verified information', description: 'More verified information is needed.' }]
      : [{ title: 'Clinical dates are missing', description: 'The finding can appear in the current health picture but not in chronological trends.' }],
    evidence,
    aiSummary: {
      status, overallHealthView: status === 'AVAILABLE' ? 'Your current verified record shows HbA1c is 6.8% (high).' : null,
      keyThemes: [], stableContext: [], followUpItems: [], visitQuestions: [], limitations: [],
      reason: status === 'AVAILABLE' ? null : status, cached: false,
    },
    disclaimer: 'This briefing is not a diagnosis.', generatedAt: '2026-09-15T00:00:00Z',
  };
}
