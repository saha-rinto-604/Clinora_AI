import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../../App';
import { applicationApi } from '../../features/access-applications/application-api';
import type { AccessApplication } from '../../features/access-applications/application-types';

const draftResearcher: AccessApplication = {
  id: 'app-1',
  applicationType: 'RESEARCHER',
  firstName: 'Nadia',
  lastName: 'Islam',
  email: 'nadia@example.com',
  phone: '+8801800000000',
  countryCode: 'Bangladesh',
  status: 'DRAFT',
  emailVerifiedAt: '2026-08-10T00:00:00Z',
  submittedAt: null,
  doctor: null,
  researcher: {
    institution: 'Dhaka University',
    department: 'Public Health',
    professionalTitle: 'Research Fellow',
    institutionalProfileUrl: null,
    researchField: 'Population health',
    researchPurpose: 'Evaluate aggregate clinical trends.',
    researchSummary: null,
    orcid: null,
    researchProfileUrl: null,
    publicationProfileUrl: null,
    ethicsReference: null,
    projectApprovalReference: null,
  },
  qualifications: [],
  documents: [],
};

function renderRoute(path: string, strict = false) {
  const tree = (
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>
  );
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Phase 4C professional application routes', () => {
  it('renders the Doctor application as a professional approval flow', () => {
    renderRoute('/apply/doctor');

    expect(screen.getByRole('heading', { name: /apply for doctor access/i })).toBeInTheDocument();
    expect(screen.getByText(/mandatory onboarding interview/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
  });

  it('renders a distinct Researcher application path without interview messaging', () => {
    renderRoute('/apply/researcher');

    expect(screen.getByRole('heading', { name: /apply for researcher access/i })).toBeInTheDocument();
    expect(screen.getByText(/institution \/ organization/i)).toBeInTheDocument();
    expect(screen.queryByText(/interview/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^role$/i)).not.toBeInTheDocument();
  });

  it('verifies email once under StrictMode and waits for explicit continuation', async () => {
    const verifyEmail = vi.spyOn(applicationApi, 'verifyEmail').mockResolvedValue({ continuationToken: 'continue-1' });
    const establishSession = vi.spyOn(applicationApi, 'establishSession').mockResolvedValue({} as never);
    vi.spyOn(applicationApi, 'me').mockRejectedValue(new Error('not loaded in this assertion'));
    vi.spyOn(applicationApi, 'events').mockResolvedValue([]);

    renderRoute('/application/email-verification?token=verify-1', true);

    expect(await screen.findByRole('heading', { name: /email verified/i })).toBeInTheDocument();
    expect(verifyEmail).toHaveBeenCalledTimes(1);
    expect(establishSession).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: /continue application/i }));

    await waitFor(() => expect(establishSession).toHaveBeenCalledWith('continue-1'));
  });

  it('keeps invalid verification separate from resume and does not open the workspace', async () => {
    vi.spyOn(applicationApi, 'verifyEmail').mockRejectedValue({
      response: {
        data: {
          errorCode: 'APPLICATION_TOKEN_INVALID',
          message: 'The verification link could not be used.',
        },
      },
      isAxiosError: true,
    });
    const accessLink = vi.spyOn(applicationApi, 'requestAccessLink').mockResolvedValue({} as never);
    const me = vi.spyOn(applicationApi, 'me').mockResolvedValue(draftResearcher);

    renderRoute('/application/email-verification?token=bad-token');

    expect(await screen.findByText(/verification link could not be used/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /application in progress/i })).not.toBeInTheDocument();
    expect(accessLink).not.toHaveBeenCalled();
    expect(me).not.toHaveBeenCalled();
  });

  it('offers resend for expired verification and resume for reused verification', async () => {
    const resend = vi.spyOn(applicationApi, 'resendVerification').mockResolvedValue({} as never);
    vi.spyOn(applicationApi, 'verifyEmail').mockRejectedValueOnce({
      response: {
        data: {
          errorCode: 'APPLICATION_VERIFICATION_EXPIRED',
          message: 'This verification link has expired.',
        },
      },
      isAxiosError: true,
    });

    renderRoute('/application/email-verification?token=expired-token');

    await userEvent.click(await screen.findByRole('button', { name: /send a new verification email/i }));
    expect(resend).toHaveBeenCalledWith('expired-token');

    vi.restoreAllMocks();
    vi.spyOn(applicationApi, 'verifyEmail').mockRejectedValueOnce({
      response: {
        data: {
          errorCode: 'APPLICATION_VERIFICATION_ALREADY_USED',
          message: 'This verification link has already been used.',
        },
      },
      isAxiosError: true,
    });

    renderRoute('/application/email-verification?token=reused-token');

    expect(await screen.findByRole('link', { name: /resume application/i })).toBeInTheDocument();
  });

  it('shows role-specific Researcher progress and draft-safe actions', async () => {
    vi.spyOn(applicationApi, 'me').mockResolvedValue(draftResearcher);
    vi.spyOn(applicationApi, 'events').mockResolvedValue([]);

    renderRoute('/application/status');

    expect(await screen.findByRole('heading', { name: /application in progress/i })).toBeInTheDocument();
    expect(screen.getByText(/draft saved/i)).toBeInTheDocument();
    expect(screen.queryByText(/interview/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /withdraw application/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /save & exit/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/step 1 of 6/i).length).toBeGreaterThan(0);
  });

  it('uses confirmation dialog before withdrawing a submitted application', async () => {
    const submitted = { ...draftResearcher, status: 'SUBMITTED' as const, submittedAt: '2026-08-10T01:00:00Z' };
    vi.spyOn(applicationApi, 'me').mockResolvedValue(submitted);
    vi.spyOn(applicationApi, 'events').mockResolvedValue([]);
    vi.spyOn(applicationApi, 'withdraw').mockResolvedValue({ ...submitted, status: 'WITHDRAWN' });

    renderRoute('/application/status');

    await userEvent.click(await screen.findByRole('button', { name: /withdraw application/i }));

    const dialog = screen.getByRole('dialog', { name: /withdraw application/i });
    expect(within(dialog).getByRole('button', { name: /keep application/i })).toBeInTheDocument();
  });
});
