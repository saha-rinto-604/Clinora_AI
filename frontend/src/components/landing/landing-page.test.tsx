import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../../App';

const requiredSections = [
  'platform',
  'intelligence',
  'ai-ocr',
  'emergency-assistance',
  'roles',
  'research',
  'security',
  'workflow',
  'faq',
];

const roleLabels = [
  'Patient',
  'Doctor',
  'Hospital Administrator',
  'Researcher',
  'Blood Bank Staff',
  'System Administrator',
];

function renderHome() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

describe('Phase 3C public home route', () => {
  it('renders the Phase 3B landing experience inside the shared public website without accessibility violations', async () => {
    const { container } = renderHome();

    expect(
      screen.getByRole('heading', { name: /clinical intelligence, built around human judgment/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
    expect(screen.getByRole('list', { name: 'Conceptual report processing states' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Public navigation' })).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('keeps every landing section and all six approved roles', () => {
    const { container } = renderHome();

    for (const sectionId of requiredSections) {
      expect(container.querySelector(`#${sectionId}`)).toBeInTheDocument();
    }

    for (const role of roleLabels) {
      expect(screen.getByRole('heading', { name: role })).toBeInTheDocument();
    }
  });

  it('uses real public routes in the shared navigation', () => {
    renderHome();
    const navigation = screen.getByRole('navigation', { name: 'Public navigation' });
    const links = within(navigation).getAllByRole('link');

    expect(links.length).toBeGreaterThan(5);
    expect(within(navigation).getByRole('link', { name: 'Platform' })).toHaveAttribute('href', '/features');
    expect(within(navigation).getByRole('link', { name: 'AI' })).toHaveAttribute('href', '/ai-clinical-intelligence');
    expect(within(navigation).getByRole('link', { name: 'OCR' })).toHaveAttribute('href', '/laboratory-ocr');
  });

  it('keeps internal phase labels and role enum codes out of public-facing copy', () => {
    renderHome();

    expect(screen.queryByText(/Phase 3B/i)).not.toBeInTheDocument();
    expect(screen.queryByText('HOSPITAL_ADMIN')).not.toBeInTheDocument();
    expect(screen.queryByText('BLOOD_BANK_STAFF')).not.toBeInTheDocument();
    expect(screen.getByText('Hospital Administrator')).toBeInTheDocument();
    expect(screen.getByText('Blood Bank Staff')).toBeInTheDocument();
  });

  it('opens the shared mobile navigation drawer with an accessible control', async () => {
    const user = userEvent.setup();
    renderHome();

    await user.click(screen.getByRole('button', { name: 'Open navigation menu' }));

    expect(screen.getByRole('dialog', { name: 'Clinora AI navigation' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Mobile public navigation' })).toBeInTheDocument();
  });

  it('uses accessible FAQ accordion behavior on the home page', async () => {
    const user = userEvent.setup();
    renderHome();

    const trigger = screen.getByRole('button', { name: 'Does Clinora replace doctors?' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/human-in-the-loop clinical support/i)).toBeInTheDocument();
  });

  it('does not perform network requests during static public rendering', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    renderHome();

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
