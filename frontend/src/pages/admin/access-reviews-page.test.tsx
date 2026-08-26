import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProtectedRoute } from '../../features/auth/protected-route';
import { useAuthStore } from '../../features/auth/auth-store';
import { AccessReviewsPage } from './access-reviews-page';
import type { AccessReviewDetail, PageView } from '../../features/admin-access-reviews/admin-access-review-types';
import type { AccessReviewQueueItem } from '../../features/admin-access-reviews/admin-access-review-types';

const mocks = vi.hoisted(() => ({
  queue: vi.fn(),
  detail: vi.fn(),
  startReview: vi.fn(),
  addNote: vi.fn(),
  requestMoreInformation: vi.fn(),
  approve: vi.fn(),
  reject: vi.fn(),
  downloadDocument: vi.fn(),
  interview: vi.fn(),
  requireInterview: vi.fn(),
  scheduleInterview: vi.fn(),
  rescheduleInterview: vi.fn(),
  cancelInterview: vi.fn(),
  completeInterview: vi.fn(),
  markInterviewNoShow: vi.fn(),
}));

vi.mock('../../features/admin-access-reviews/admin-access-review-api', () => ({
  adminAccessReviewApi: mocks,
  reviewErrorMessage: (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback),
}));

const adminUser = {
  id: '00000000-0000-0000-0000-000000000001',
  firstName: 'Clinora',
  lastName: 'Admin',
  email: 'admin@example.test',
  role: 'SYSTEM_ADMIN',
  accountStatus: 'ACTIVE',
  emailVerified: true,
};

const queueItem: AccessReviewQueueItem = {
  id: '11111111-1111-1111-1111-111111111111',
  applicationType: 'DOCTOR',
  firstName: 'Dora',
  lastName: 'Doctor',
  email: 'dora@example.test',
  status: 'SUBMITTED',
  submittedAt: '2026-08-15T10:00:00Z',
  updatedAt: '2026-08-15T10:05:00Z',
};

const detail: AccessReviewDetail = {
  ...queueItem,
  phone: '+15555550123',
  countryCode: 'US',
  emailVerifiedAt: '2026-08-15T09:00:00Z',
  doctor: {
    professionalTitle: 'Consultant',
    specialization: 'Internal Medicine',
    yearsExperience: 8,
    currentOrganization: 'Clinora Test Hospital',
    currentPosition: 'Lead Physician',
    registrationNumber: 'MED-123',
  },
  researcher: null,
  qualifications: [],
  documents: [
    {
      id: '22222222-2222-2222-2222-222222222222',
      documentType: 'CV',
      originalFilename: 'cv.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 120,
      createdAt: '2026-08-15T10:01:00Z',
    },
  ],
  events: [
    {
      type: 'SUBMITTED',
      message: 'Application submitted for professional access review.',
      createdAt: '2026-08-15T10:00:00Z',
    },
  ],
  internalNotes: [],
  allowedNextStatuses: ['UNDER_REVIEW', 'MORE_INFO_REQUIRED'],
};

function page(items: AccessReviewQueueItem[]): PageView<AccessReviewQueueItem> {
  return { items, page: 0, size: 20, totalItems: items.length, totalPages: items.length ? 1 : 0 };
}

function renderRoute(user: typeof adminUser | null = adminUser, status?: 'unknown' | 'anonymous' | 'authenticated') {
  useAuthStore.setState({
    status: status ?? (user ? 'authenticated' : 'anonymous'),
    accessToken: user ? 'token' : null,
    user,
  });
  return render(
    <MemoryRouter initialEntries={['/admin/access-reviews']}>
      <Routes>
        <Route element={<ProtectedRoute allowedRoles={['SYSTEM_ADMIN']} />}>
          <Route path="/admin/access-reviews" element={<AccessReviewsPage />} />
        </Route>
        <Route path="/account" element={<div>Account security</div>} />
        <Route path="/login" element={<div>Login</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('System Admin access review workbench', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ status: 'anonymous', accessToken: null, user: null });
    mocks.queue.mockResolvedValue(page([queueItem]));
    mocks.detail.mockResolvedValue(detail);
    mocks.startReview.mockResolvedValue({
      ...detail,
      status: 'UNDER_REVIEW',
      allowedNextStatuses: ['MORE_INFO_REQUIRED'],
    });
    mocks.addNote.mockResolvedValue({
      ...detail,
      internalNotes: [
        {
          id: '33333333-3333-3333-3333-333333333333',
          reviewerUserId: adminUser.id,
          text: 'Verify registration evidence.',
          createdAt: '2026-08-15T10:20:00Z',
        },
      ],
    });
    mocks.requestMoreInformation.mockResolvedValue({
      ...detail,
      status: 'MORE_INFO_REQUIRED',
      allowedNextStatuses: [],
      events: [
        ...detail.events,
        {
          type: 'MORE_INFO_REQUESTED',
          message: 'Please provide updated qualification evidence.',
          createdAt: '2026-08-15T10:30:00Z',
        },
      ],
    });
    mocks.approve.mockResolvedValue({
      ...detail,
      status: 'ACTIVATION_PENDING',
      allowedNextStatuses: [],
    });
    mocks.reject.mockResolvedValue({
      ...detail,
      status: 'REJECTED',
      allowedNextStatuses: [],
    });
    mocks.downloadDocument.mockResolvedValue(new Blob(['pdf']));
    mocks.interview.mockResolvedValue(null);
    mocks.requireInterview.mockResolvedValue({});
    mocks.scheduleInterview.mockResolvedValue({});
    mocks.rescheduleInterview.mockResolvedValue({});
    mocks.cancelInterview.mockResolvedValue({});
    mocks.completeInterview.mockResolvedValue({});
    mocks.markInterviewNoShow.mockResolvedValue({});
  });

  it('allows System Admin to access the route and load review detail', async () => {
    renderRoute();

    expect(await screen.findByRole('heading', { name: 'Access Reviews' })).toBeInTheDocument();
    expect(await screen.findByText('Dora Doctor')).toBeInTheDocument();
    expect(await screen.findByText('Internal Medicine')).toBeInTheDocument();
  });

  it.each(['PATIENT', 'DOCTOR', 'RESEARCHER'])('denies %s access through the route guard', async (role) => {
    renderRoute({ ...adminUser, role, email: `${role.toLowerCase()}@example.test` });

    expect(await screen.findByText('Account security')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Access Reviews' })).not.toBeInTheDocument();
  });

  it('redirects anonymous users to login and preserves the restoring state', async () => {
    const { unmount } = renderRoute(null);
    expect(await screen.findByText('Login')).toBeInTheDocument();
    unmount();

    renderRoute(null, 'unknown');
    expect(screen.getByText('Restoring secure session...')).toBeInTheDocument();
  });

  it('renders loading, empty, and error queue states', async () => {
    let resolveQueue: (value: PageView<AccessReviewQueueItem>) => void = () => undefined;
    mocks.queue.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveQueue = resolve;
      }),
    );
    renderRoute();

    expect(screen.getByText('Loading review queue...')).toBeInTheDocument();
    resolveQueue(page([]));
    expect(await screen.findByText('No submitted applications match the current filters.')).toBeInTheDocument();

    mocks.queue.mockRejectedValueOnce(new Error('Queue unavailable.'));
    await userEvent.click(screen.getByRole('button', { name: /refresh/i }));
    expect(await screen.findByText('Queue unavailable.')).toBeInTheDocument();
  });

  it('sends Doctor, Researcher, and status filters to the queue API', async () => {
    const user = userEvent.setup();
    renderRoute();

    await screen.findByText('Dora Doctor');
    await user.selectOptions(screen.getByLabelText('Type'), 'RESEARCHER');
    await user.selectOptions(screen.getByLabelText('Status'), 'UNDER_REVIEW');

    await waitFor(() => {
      expect(mocks.queue).toHaveBeenLastCalledWith({
        applicationType: 'RESEARCHER',
        status: 'UNDER_REVIEW',
        page: 0,
        size: 20,
      });
    });
  });

  it('supports start review, internal note submission, and document retrieval', async () => {
    const user = userEvent.setup();
    renderRoute();

    await screen.findByText('Internal Medicine');
    await user.click(screen.getByRole('button', { name: /start review/i }));
    expect(await screen.findByText('Review started.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Internal review note'), 'Verify registration evidence.');
    await user.click(screen.getByRole('button', { name: /add internal note/i }));
    expect(await screen.findByText('Internal note saved.')).toBeInTheDocument();
    expect(mocks.addNote).toHaveBeenCalledWith(queueItem.id, 'Verify registration evidence.');

    await user.click(screen.getByRole('button', { name: /cv.pdf/i }));
    expect(await screen.findByText('Document retrieved securely.')).toBeInTheDocument();
    expect(mocks.downloadDocument).toHaveBeenCalledWith(queueItem.id, '22222222-2222-2222-2222-222222222222');
  });

  it('exposes Doctor interview requirement only after review starts', async () => {
    const user = userEvent.setup();
    renderRoute();

    await screen.findByText('Internal Medicine');
    expect(screen.queryByRole('button', { name: /require interview/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /start review/i }));
    expect(await screen.findByRole('button', { name: /require interview/i })).toBeInTheDocument();
  });

  it('validates and sends request-more-information without deferred actions', async () => {
    const user = userEvent.setup();
    renderRoute();

    await screen.findByText('Internal Medicine');
    expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reject/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /schedule interview/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /request more information/i }));
    expect(screen.getByRole('button', { name: /send request/i })).toBeDisabled();
    await user.type(
      screen.getByLabelText('Applicant-facing information request'),
      'Please provide updated qualification evidence.',
    );
    await user.click(screen.getByRole('button', { name: /send request/i }));

    expect(await screen.findByText('Information request sent.')).toBeInTheDocument();
    expect(mocks.requestMoreInformation).toHaveBeenCalledWith(
      queueItem.id,
      'Please provide updated qualification evidence.',
    );
  });

  it('supports final approval and rejection when review transitions allow them', async () => {
    const user = userEvent.setup();
    mocks.detail.mockResolvedValueOnce({
      ...detail,
      status: 'INTERVIEW_COMPLETED',
      allowedNextStatuses: ['ACTIVATION_PENDING', 'REJECTED'],
    });
    const { unmount } = renderRoute();

    await screen.findByText('Internal Medicine');
    await user.click(screen.getByRole('button', { name: /^approve$/i }));

    expect(await screen.findByText('Application approved. Activation link sent.')).toBeInTheDocument();
    expect(mocks.approve).toHaveBeenCalledWith(queueItem.id);

    unmount();
    mocks.detail.mockResolvedValueOnce({
      ...detail,
      status: 'INTERVIEW_COMPLETED',
      allowedNextStatuses: ['ACTIVATION_PENDING', 'REJECTED'],
    });
    renderRoute();

    await screen.findByText('Internal Medicine');
    await user.click(screen.getByRole('button', { name: /^reject$/i }));
    expect(screen.getByRole('button', { name: /reject application/i })).toBeDisabled();
    await user.type(screen.getByLabelText('Applicant-facing rejection reason'), 'Credential evidence is insufficient.');
    await user.click(screen.getByRole('button', { name: /reject application/i }));

    expect(await screen.findByText('Application rejected.')).toBeInTheDocument();
    expect(mocks.reject).toHaveBeenCalledWith(queueItem.id, 'Credential evidence is insufficient.');
  });
});
