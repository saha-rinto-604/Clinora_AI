import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { LandingPage } from './landing-page';

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

describe('Phase 3B public landing page', () => {
  it('renders the production landing experience without accessibility violations', async () => {
    const { container } = render(<LandingPage />);

    expect(
      screen.getByRole('heading', { name: /clinical intelligence, built around human judgment/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
    expect(screen.getByRole('list', { name: 'Conceptual report processing states' })).toBeInTheDocument();

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('renders every authorized landing section and all six approved roles', () => {
    const { container } = render(<LandingPage />);

    for (const sectionId of requiredSections) {
      expect(container.querySelector(`#${sectionId}`)).toBeInTheDocument();
    }

    for (const role of roleLabels) {
      expect(screen.getByRole('heading', { name: role })).toBeInTheDocument();
    }
  });

  it('keeps public navigation links anchored to sections that exist on the landing page', () => {
    const { container } = render(<LandingPage />);
    const navigation = screen.getByRole('navigation', { name: 'Public navigation' });
    const links = within(navigation).getAllByRole('link');

    expect(links.length).toBeGreaterThan(4);

    for (const link of links) {
      const href = link.getAttribute('href');
      expect(href?.startsWith('#')).toBe(true);
      expect(container.querySelector(href!)).toBeInTheDocument();
    }
  });

  it('keeps internal phase labels and role enum codes out of public-facing copy', () => {
    render(<LandingPage />);

    expect(screen.queryByText(/Phase 3B/i)).not.toBeInTheDocument();
    expect(screen.queryByText('HOSPITAL_ADMIN')).not.toBeInTheDocument();
    expect(screen.queryByText('BLOOD_BANK_STAFF')).not.toBeInTheDocument();
    expect(screen.getByText('Hospital Administrator')).toBeInTheDocument();
    expect(screen.getByText('Blood Bank Staff')).toBeInTheDocument();
  });

  it('opens the mobile navigation drawer with an accessible control', async () => {
    const user = userEvent.setup();
    render(<LandingPage />);

    await user.click(screen.getByRole('button', { name: 'Open navigation menu' }));

    expect(screen.getByRole('dialog', { name: 'Clinora AI navigation' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Mobile public navigation' })).toBeInTheDocument();
  });

  it('uses accessible FAQ accordion behavior', async () => {
    const user = userEvent.setup();
    render(<LandingPage />);

    const trigger = screen.getByRole('button', { name: 'Does Clinora replace doctors?' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/human-in-the-loop clinical support/i)).toBeInTheDocument();
  });

  it('keeps the biomedical background decorative and out of the accessibility tree', () => {
    const { container } = render(<LandingPage />);

    const decorativeLayers = container.querySelectorAll('[aria-hidden="true"]');
    expect(decorativeLayers.length).toBeGreaterThan(0);
    expect(screen.queryByRole('img', { name: /dna|blood cell|molecular/i })).not.toBeInTheDocument();
  });

  it('does not perform network requests during static landing-page rendering', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    render(<LandingPage />);

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
