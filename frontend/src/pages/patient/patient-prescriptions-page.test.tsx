import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PatientPrescriptionsPage } from './patient-prescriptions-page';

const mocks = vi.hoisted(() => ({ patientPrescriptions: vi.fn() }));

vi.mock('../../features/consultations/consultation-api', async () => {
  const actual = await vi.importActual<typeof import('../../features/consultations/consultation-api')>(
    '../../features/consultations/consultation-api',
  );
  return {
    ...actual,
    consultationApi: { ...actual.consultationApi, patientPrescriptions: mocks.patientPrescriptions },
  };
});

describe('Patient prescriptions', () => {
  beforeEach(() => mocks.patientPrescriptions.mockReset());

  it('provides a dedicated longitudinal empty state', async () => {
    mocks.patientPrescriptions.mockResolvedValue([]);
    render(
      <MemoryRouter>
        <PatientPrescriptionsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Prescriptions' })).toBeInTheDocument();
    expect(screen.getByText('No prescriptions yet')).toBeInTheDocument();
    expect(screen.getByText(/Draft consultation content is never shown/)).toBeInTheDocument();
  });

  it('renders finalized structured and original prescription content together', async () => {
    mocks.patientPrescriptions.mockResolvedValue([
      {
        consultationId: '11111111-1111-1111-1111-111111111111',
        appointmentId: '22222222-2222-2222-2222-222222222222',
        doctorId: '33333333-3333-3333-3333-333333333333',
        doctorName: 'Dr Arafat Hossain',
        specialization: 'Internal Medicine',
        assessment: 'Iron deficiency under evaluation',
        plan: 'Continue follow-up',
        completedAt: '2026-09-23T09:00:00Z',
        prescriptions: [
          {
            id: 'rx-1',
            medicationName: 'Ferrous sulfate',
            strength: '325 mg',
            dose: '1 tablet',
            route: 'Oral',
            frequency: 'Daily',
            duration: '30 days',
            instructions: 'After food',
          },
        ],
        prescriptionDocuments: [
          {
            id: 'doc-1',
            consultationId: '11111111-1111-1111-1111-111111111111',
            originalFilename: 'prescription.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 1024,
            createdAt: '2026-09-23T09:00:00Z',
          },
        ],
        investigations: [],
        followUp: null,
      },
    ]);

    render(
      <MemoryRouter>
        <PatientPrescriptionsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Dr Arafat Hossain')).toBeInTheDocument();
    expect(screen.getByText('Ferrous sulfate')).toBeInTheDocument();
    expect(screen.getByText('prescription.pdf')).toBeInTheDocument();
  });
});
