import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { PatientCareHeader } from './patient-care-header';

describe('Patient care header', () => {
  it('keeps content and navigation accessible with decorative artwork', async () => {
    const { container } = render(
      <PatientCareHeader
        eyebrow="Your care"
        title="Appointments"
        description="Manage your care."
        action={<a href="/patient/doctors">Find a Doctor</a>}
      />,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Appointments' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Find a Doctor' })).toHaveAttribute('href', '/patient/doctors');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});
