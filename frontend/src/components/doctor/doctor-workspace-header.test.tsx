import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { DoctorWorkspaceHeader } from './doctor-workspace-header';

describe('Doctor workspace header', () => {
  it.each([
    ['patients', 'doctor-patients-header.webp'],
    ['inbox', 'doctor-clinical-inbox-header.webp'],
    ['schedule', 'doctor-schedule-header.webp'],
    ['availability', 'doctor-availability-header.webp'],
  ] as const)('uses only the approved %s background as decoration', (background, filename) => {
    const { container } = render(
      <DoctorWorkspaceHeader
        eyebrow="Care"
        title="Workspace"
        description="Your clinical work."
        background={background}
      />,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Workspace' })).toBeInTheDocument();
    expect(screen.getByText('Your clinical work.')).toBeInTheDocument();
    expect(screen.getByText('Care')).toBeInTheDocument();
    const art = container.querySelector('[aria-hidden="true"]');
    expect(art).toHaveStyle({ backgroundImage: `url(/assets/biomedical/${filename})` });
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('keeps an optional action accessible and operable', async () => {
    const refresh = vi.fn();
    const { container } = render(
      <DoctorWorkspaceHeader
        eyebrow="Action queue"
        title="Clinical Inbox"
        description="Clinical work requiring your attention."
        background="inbox"
        actions={<button onClick={refresh}>Refresh</button>}
      />,
    );
    await userEvent.setup().click(screen.getByRole('button', { name: 'Refresh' }));
    expect(refresh).toHaveBeenCalledOnce();
    expect(await axe(container)).toHaveNoViolations();
  });
});
