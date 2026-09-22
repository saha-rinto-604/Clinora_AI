import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DoctorClinicalInboxPage } from './doctor-clinical-inbox-page';
import { DoctorPatientsPage } from './doctor-patients-page';

const mocks = vi.hoisted(() => ({
  patients: vi.fn(),
  inbox: vi.fn(),
}));

vi.mock('../../features/consultations/consultation-api', async () => {
  const actual = await vi.importActual<typeof import('../../features/consultations/consultation-api')>(
    '../../features/consultations/consultation-api',
  );
  return {
    ...actual,
    consultationApi: {
      ...actual.consultationApi,
      patients: mocks.patients,
      inbox: mocks.inbox,
    },
  };
});

describe('Doctor continuing-care information architecture', () => {
  beforeEach(() => {
    mocks.patients.mockReset();
    mocks.inbox.mockReset();
  });

  it('renders Patients as a compact longitudinal clinical index instead of schedule cards', async () => {
    mocks.patients.mockResolvedValue([
      {
        patientId: '11111111-1111-1111-1111-111111111111',
        patientName: 'Anika Islam',
        careState: 'ACTIVE_CARE',
        consultationInProgress: false,
        latestConsultationAt: '2026-09-23T09:00:00Z',
        latestAssessment: 'Iron deficiency under evaluation',
        latestPlan: 'Iron studies and clinical follow-up',
        requestedInvestigationCount: 1,
        followUpDate: '2026-10-07',
        nextAppointmentAt: '2026-09-30T09:00:00Z',
        currentlySharedReportCount: 2,
      },
    ]);

    render(
      <MemoryRouter>
        <DoctorPatientsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Anika Islam')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Continuing care Patient list' })).toHaveAttribute(
      'data-density',
      'compact',
    );
    expect(screen.getByText('Active care')).toBeInTheDocument();
    expect(screen.getByText('Iron deficiency under evaluation')).toBeInTheDocument();
    expect(screen.getByText(/Plan:/)).toBeInTheDocument();
    expect(screen.getByText(/requested investigation/)).toBeInTheDocument();
    expect(screen.queryByText('Established through Clinora care')).not.toBeInTheDocument();
    expect(screen.queryByText('Next care')).not.toBeInTheDocument();
    expect(screen.queryByText('Shared now')).not.toBeInTheDocument();
  });

  it('uses one in-progress state and does not fabricate missing completed-assessment copy', async () => {
    mocks.patients.mockResolvedValue([
      {
        patientId: '11111111-1111-1111-1111-111111111111',
        patientName: 'Anika Islam',
        careState: 'ACTIVE_CARE',
        consultationInProgress: true,
        latestConsultationAt: null,
        latestAssessment: null,
        latestPlan: null,
        requestedInvestigationCount: 0,
        followUpDate: null,
        nextAppointmentAt: '2026-09-23T10:30:00Z',
        currentlySharedReportCount: 9,
      },
    ]);

    render(
      <MemoryRouter>
        <DoctorPatientsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Anika Islam')).toBeInTheDocument();
    expect(screen.getAllByText('In progress')).toHaveLength(1);
    expect(screen.getByText('Consultation currently in progress')).toBeInTheDocument();
    expect(screen.queryByText(/No assessment text was recorded/i)).not.toBeInTheDocument();
  });

  it('renders Clinical Inbox as an action queue without a generic upcoming bucket', async () => {
    mocks.inbox.mockResolvedValue({
      inProgressCount: 1,
      evidenceReadyCount: 1,
      followUpCount: 0,
      needsAttentionCount: 2,
      items: [
        {
          key: 'consultation:1',
          type: 'IN_PROGRESS',
          priority: 'HIGH',
          patientId: '11111111-1111-1111-1111-111111111111',
          patientName: 'Anika Islam',
          appointmentId: '22222222-2222-2222-2222-222222222222',
          consultationId: '33333333-3333-3333-3333-333333333333',
          title: 'Consultation in progress',
          detail: 'Documentation is unfinished.',
          dueAt: null,
          dueDate: null,
          destination: '/doctor/appointments/22222222-2222-2222-2222-222222222222/consultation',
        },
        {
          key: 'evidence:1',
          type: 'EVIDENCE_READY',
          priority: 'NORMAL',
          patientId: '44444444-4444-4444-4444-444444444444',
          patientName: 'Rumana Akter',
          appointmentId: '55555555-5555-5555-5555-555555555555',
          consultationId: null,
          title: 'Patient-shared evidence ready',
          detail: '2 currently authorized reports are available for review before this consultation.',
          dueAt: '2026-09-24T09:00:00Z',
          dueDate: null,
          destination: '/doctor/appointments/55555555-5555-5555-5555-555555555555',
        },
      ],
    });

    render(
      <MemoryRouter>
        <DoctorClinicalInboxPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Clinical Inbox')).toBeInTheDocument();
    expect(screen.getByText('Documentation is unfinished.')).toBeInTheDocument();
    expect(screen.getByText(/currently authorized reports/)).toBeInTheDocument();
    expect(screen.queryByText('Upcoming care')).not.toBeInTheDocument();
  });
});
