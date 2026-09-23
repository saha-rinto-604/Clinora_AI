import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { DoctorConsultationPage } from './doctor-consultation-page';

const mocks = vi.hoisted(() => ({
  appointment: vi.fn(),
  byAppointment: vi.fn(),
  uploadPrescriptionDocument: vi.fn(),
}));

vi.mock('../../features/doctor/doctor-api', () => ({
  doctorApi: { appointment: mocks.appointment },
}));

vi.mock('../../features/consultations/consultation-api', async () => {
  const actual = await vi.importActual<typeof import('../../features/consultations/consultation-api')>(
    '../../features/consultations/consultation-api',
  );
  return {
    ...actual,
    consultationApi: {
      ...actual.consultationApi,
      byAppointment: mocks.byAppointment,
      uploadPrescriptionDocument: mocks.uploadPrescriptionDocument,
    },
  };
});

vi.mock('../../features/profile/profile-image', () => ({
  ProfileAvatar: ({ name }: { name: string }) => <span aria-label={`${name} profile photo`}>TI</span>,
}));

vi.mock('../../features/doctor/clinora-clinical-support-panel', () => ({
  ClinoraClinicalSupportPanel: () => <section aria-label="Clinora Clinical Support actions" />,
}));

describe('Doctor consultation reference layout', () => {
  it('renders real encounter data in the context rail, 2 by 2 documentation grid and compact care plan', async () => {
    mocks.appointment.mockResolvedValue({
      id: 'appointment-1',
      status: 'BOOKED',
      reason: 'Review authorized results',
      scheduledStart: '2026-09-23T04:30:00Z',
      scheduledEnd: '2026-09-23T05:00:00Z',
      timezone: 'Asia/Dhaka',
      consultationMode: 'IN_PERSON',
      canModify: true,
      reportAccessActive: true,
      patient: {
        id: 'patient-1',
        displayName: 'Test Patient',
        dateOfBirth: '1990-06-15',
        gender: 'FEMALE',
        bloodGroup: null,
        allergies: [],
        chronicConditions: [],
        currentMedications: [],
      },
      sharedReports: [],
    });
    mocks.byAppointment.mockResolvedValue({
      id: 'consultation-1',
      appointmentId: 'appointment-1',
      patientId: 'patient-1',
      status: 'IN_PROGRESS',
      version: 1,
      historyNotes: null,
      findingsNotes: null,
      assessment: null,
      plan: null,
      startedAt: '2026-09-23T04:30:00Z',
      completedAt: null,
      prescriptions: [],
      prescriptionDocuments: [],
      investigations: [],
      followUp: null,
    });

    render(
      <MemoryRouter initialEntries={['/doctor/appointments/appointment-1/consultation']}>
        <Routes>
          <Route path="/doctor/appointments/:appointmentId/consultation" element={<DoctorConsultationPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Test Patient' })).toBeInTheDocument();
    expect(screen.getByText('Review authorized results')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'History' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Findings' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Assessment' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Plan' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add medication/ })).toBeInTheDocument();
    expect(screen.getByText('Upload prescription')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Request investigation/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add follow-up/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Complete consultation' })).toBeDisabled();

    const prescriptionFile = new File(['authorized prescription'], 'prescription.pdf', {
      type: 'application/pdf',
    });
    await userEvent.upload(screen.getByLabelText('Upload prescription'), prescriptionFile);
    expect(mocks.uploadPrescriptionDocument).toHaveBeenCalledWith('consultation-1', prescriptionFile);
  });
});
