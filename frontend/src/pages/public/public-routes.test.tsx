import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AppRoutes } from '../../App';

const routes = [
  ['/features', /one connected platform for the clinical care journey/i],
  ['/ai-clinical-intelligence', /clinical reasoning designed for professional review/i],
  ['/laboratory-ocr', /from report pages to structured clinical information/i],
  ['/emergency-blood-assistance', /faster coordination when every minute matters/i],
  ['/research', /clinical data can inform research without exposing patient identity/i],
  ['/about', /building a more connected clinical intelligence ecosystem/i],
  ['/contact', /questions about the clinora platform/i],
  ['/faq', /clear answers about clinical ai and connected healthcare workflows/i],
  ['/privacy', /sensitive healthcare information deserves deliberate boundaries/i],
  ['/terms', /clear boundaries for a healthcare intelligence platform/i],
] as const;

function renderRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

describe('Phase 3C public routes', () => {
  for (const [path, heading] of routes) {
    it(`renders ${path} with a single primary heading`, () => {
      renderRoute(path);
      expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
      expect(screen.getByRole('navigation', { name: 'Public navigation' })).toBeInTheDocument();
      expect(screen.getByRole('navigation', { name: 'Footer navigation' })).toBeInTheDocument();
    });
  }

  it('renders a branded 404 route with recovery links', () => {
    renderRoute('/this-page-does-not-exist');

    expect(screen.getByRole('heading', { level: 1, name: /outside the clinora public map/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to home/i })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: /explore features/i })).toHaveAttribute('href', '/features');
  });

  it('keeps the contact page informational and does not render a fake submission form', () => {
    renderRoute('/contact');

    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /send|submit/i })).not.toBeInTheDocument();
    expect(screen.getByText(/contact delivery is not connected yet/i)).toBeInTheDocument();
  });

  it('states the AI professional-review boundary on the AI page', () => {
    renderRoute('/ai-clinical-intelligence');

    expect(screen.getByText(/professional review is required before any clinical decision/i)).toBeInTheDocument();
    expect(screen.getByText(/ai output is advisory/i)).toBeInTheDocument();
  });

  it('marks OCR example data as illustrative', () => {
    renderRoute('/laboratory-ocr');

    expect(screen.getByText('Illustrative data')).toBeInTheDocument();
    expect(screen.getByText('Not a patient record')).toBeInTheDocument();
  });

  it('shows the Emergency Blood Assistance availability limitation', () => {
    renderRoute('/emergency-blood-assistance');

    expect(screen.getByText(/does not guarantee blood availability/i)).toBeInTheDocument();
  });

  it('does not make unsupported certification claims on privacy content', () => {
    renderRoute('/privacy');

    expect(screen.queryByText(/HIPAA certified/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/GDPR certified/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/SOC 2 certified/i)).not.toBeInTheDocument();
    expect(screen.getByText(/legal review required/i)).toBeInTheDocument();
  });

  it('passes an accessibility scan on a representative content page', async () => {
    const { container } = renderRoute('/features');
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
