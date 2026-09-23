import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
        contextAppointmentId: '22222222-2222-2222-2222-222222222222',
        contextAppointmentAt: '2026-09-30T09:00:00Z',
        contextAppointmentTimezone: 'Asia/Dhaka',
        contextAppointmentMode: 'IN_PERSON',
        contextAppointmentReason: 'Review progress',
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
    expect(screen.getAllByText('Active care')).toHaveLength(2);
    expect(screen.getByRole('tab', { name: /Active care 1/ })).toBeInTheDocument();
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
        contextAppointmentId: '22222222-2222-2222-2222-222222222222',
        contextAppointmentAt: '2026-09-23T10:30:00Z',
        contextAppointmentTimezone: 'Asia/Dhaka',
        contextAppointmentMode: 'ONLINE',
        contextAppointmentReason: 'Review current symptoms',
        currentlySharedReportCount: 9,
      },
    ]);

    render(
      <MemoryRouter>
        <DoctorPatientsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Anika Islam')).toBeInTheDocument();
    expect(screen.getByText('Consultation in progress')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Resume/ })).toHaveAttribute(
      'href',
      '/doctor/appointments/22222222-2222-2222-2222-222222222222/consultation',
    );
    expect(screen.getByText('Review current symptoms')).toBeInTheDocument();
    expect(screen.queryByText(/No assessment text was recorded/i)).not.toBeInTheDocument();
  });

  it('keeps Patient search and real care-state filters functional', async () => {
    const user = userEvent.setup();
    mocks.patients.mockResolvedValue([
      {
        patientId: '11111111-1111-1111-1111-111111111111',
        patientName: 'First Patient',
        careState: 'ACTIVE_CARE',
        consultationInProgress: false,
        latestConsultationAt: '2026-09-20T09:00:00Z',
        latestAssessment: null,
        latestPlan: null,
        requestedInvestigationCount: 0,
        followUpDate: null,
        nextAppointmentAt: null,
        contextAppointmentId: null,
        contextAppointmentAt: null,
        contextAppointmentTimezone: null,
        contextAppointmentMode: null,
        contextAppointmentReason: null,
        currentlySharedReportCount: 0,
      },
      {
        patientId: '22222222-2222-2222-2222-222222222222',
        patientName: 'Second Patient',
        careState: 'NEW_PATIENT',
        consultationInProgress: false,
        latestConsultationAt: null,
        latestAssessment: null,
        latestPlan: null,
        requestedInvestigationCount: 0,
        followUpDate: null,
        nextAppointmentAt: '2026-09-30T09:00:00Z',
        contextAppointmentId: '33333333-3333-3333-3333-333333333333',
        contextAppointmentAt: '2026-09-30T09:00:00Z',
        contextAppointmentTimezone: 'Asia/Dhaka',
        contextAppointmentMode: 'ONLINE',
        contextAppointmentReason: 'First visit',
        currentlySharedReportCount: 0,
      },
    ]);

    render(
      <MemoryRouter>
        <DoctorPatientsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('First Patient')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: /New patient 1/ }));
    expect(screen.queryByText('First Patient')).not.toBeInTheDocument();
    expect(screen.getByText('Second Patient')).toBeInTheDocument();

    await user.type(screen.getByRole('searchbox', { name: 'Search your Patients' }), 'missing');
    expect(screen.getByText('No matching Patient')).toBeInTheDocument();
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
