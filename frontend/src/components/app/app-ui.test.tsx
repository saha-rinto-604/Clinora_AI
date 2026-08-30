import { axe } from 'jest-axe';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppSectionHeader, AppSurface, ProgressRail, ReportProcessingStatus, StatusPill } from './app-ui';

describe('authenticated application design primitives', () => {
  it('provides semantic surfaces, textual statuses, and accessible progress states', async () => {
    const { container } = render(
      <AppSurface as="section" variant="hero" aria-labelledby="sample-section-title">
        <AppSectionHeader
          eyebrow="Secure records"
          title="Sample section"
          titleId="sample-section-title"
          copy="A reusable authenticated application surface."
          action={<StatusPill tone="success">Verified</StatusPill>}
        />
        <ProgressRail
          label="Sample workflow"
          items={[
            { label: 'Profile', state: 'complete' },
            { label: 'Review', state: 'current' },
            { label: 'Finish', state: 'pending' },
          ]}
        />
        <ReportProcessingStatus stage="Extracted" />
      </AppSurface>,
    );

    expect(container.querySelector('[data-surface-variant="hero"]')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sample section' })).toBeInTheDocument();
    expect(screen.getByText('Verified')).toBeInTheDocument();
    expect(screen.getByLabelText('Complete')).toBeInTheDocument();
    expect(screen.getByLabelText('Current')).toBeInTheDocument();
    expect(screen.getByLabelText('Pending')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Report processing status' })).toHaveAttribute(
      'data-system-controlled',
      'true',
    );
    expect(screen.getAllByText('Extracted', { selector: 'span' })).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /uploaded|extracted|analysed|reviewed/i })).not.toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});
