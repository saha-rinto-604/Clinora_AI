import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'jest-axe';
import type { DoctorPatientDetail, PatientCareEpisode } from '../../features/consultations/consultation-api';
import { detailDate, detailDateTime } from '../../features/doctor/doctor-patient-detail-model';
import { DoctorPatientDetailPage } from './doctor-patient-detail-page';

const mocks = vi.hoisted(() => ({ patient: vi.fn(), photo: vi.fn() }));
vi.mock('../../features/consultations/consultation-api', async () => {
  const actual = await vi.importActual<typeof import('../../features/consultations/consultation-api')>(
    '../../features/consultations/consultation-api',
  );
  return { ...actual, consultationApi: { ...actual.consultationApi, patient: mocks.patient } };
});
vi.mock('../../features/profile/profile-image-api', async () => {
  const actual = await vi.importActual<typeof import('../../features/profile/profile-image-api')>(
    '../../features/profile/profile-image-api',
  );
  return { ...actual, profileImageApi: { ...actual.profileImageApi, content: mocks.photo } };
});

const completedEpisode: PatientCareEpisode = {
  consultationId: 'completed-record',
  appointmentId: 'completed-appointment',
  status: 'COMPLETED',
  startedAt: '2026-08-10T04:00:00Z',
  completedAt: '2026-08-10T04:30:00Z',
  assessment: 'Recorded assessment from completed care',
  plan: 'Recorded plan from completed care',
  prescriptionCount: 2,
  prescriptionDocumentCount: 1,
  requestedInvestigationCount: 3,
  followUpDate: '2026-10-09',
};
function patientFixture(): DoctorPatientDetail {
  return {
    patientId: 'authorized-patient-id',
    patientName: 'Test Patient',
    currentCare: {
      careState: 'NEW_PATIENT',
      consultationInProgress: false,
      latestConsultationAt: null,
      latestAssessment: null,
      latestPlan: null,
      prescriptionCount: 0,
      prescriptionDocumentCount: 0,
      requestedInvestigationCount: 0,
      followUpDate: null,
    },
    upcomingAppointments: [
      {
        appointmentId: 'upcoming-appointment',
        scheduledStart: '2026-12-21T15:00:00Z',
        scheduledEnd: '2026-12-21T15:30:00Z',
        timezone: 'Asia/Dhaka',
        consultationMode: 'ONLINE',
        sharedReportCount: 0,
      },
    ],
    careHistory: [],
  };
}
function establishedFixture(): DoctorPatientDetail {
  const data = patientFixture();
  data.careHistory = [{ ...completedEpisode }];
  data.currentCare = {
    careState: 'ACTIVE_CARE',
    consultationInProgress: false,
    latestConsultationAt: completedEpisode.completedAt,
    latestAssessment: completedEpisode.assessment,
    latestPlan: completedEpisode.plan,
    prescriptionCount: 2,
    prescriptionDocumentCount: 1,
    requestedInvestigationCount: 3,
    followUpDate: null,
  };
  return data;
}
async function openPatient(data: DoctorPatientDetail) {
  mocks.patient.mockResolvedValue(data);
  const result = render(
    <MemoryRouter initialEntries={['/doctor/patients/authorized-patient-id']}>
      <Routes>
        <Route path="/doctor/patients/:patientId" element={<DoctorPatientDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByRole('heading', { name: 'Test Patient' });
  return result;
}

describe('Doctor individual Patient workspace', () => {
  beforeEach(() => {
    mocks.patient.mockReset();
    mocks.photo.mockReset().mockResolvedValue(null);
  });

  it('shows the new Patient state with a real appointment CTA and compact empty history, without completed care', async () => {
    const data = patientFixture();
    await openPatient(data);
    const header = screen.getByRole('banner', { name: 'Patient identity' });
    expect(within(header).getByText('New Patient')).toBeInTheDocument();
    expect(within(header).getByText('authorized-patient-id')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open appointment' })).toHaveAttribute(
      'href',
      '/doctor/appointments/upcoming-appointment',
    );
    expect(screen.getByText('No consultation history yet')).toBeInTheDocument();
    expect(screen.getByText('The first consultation will appear here after it is completed.')).toBeInTheDocument();
    expect(screen.queryByText('Latest completed care')).not.toBeInTheDocument();
    expect(screen.queryByText('Completed consultation')).not.toBeInTheDocument();
    expect(mocks.patient).toHaveBeenCalledWith(data.patientId);
    expect(mocks.photo).toHaveBeenCalledWith({ kind: 'doctor-patient', appointmentId: 'upcoming-appointment' });
  });

  it('preserves completed care, real counts and the consultation record action for active care', async () => {
    const data = establishedFixture();
    data.upcomingAppointments = [];
    await openPatient(data);
    expect(screen.getByText('Active care')).toBeInTheDocument();
    expect(screen.getAllByText(completedEpisode.assessment!)).toHaveLength(2);
    expect(screen.getAllByText(/Recorded plan from completed care/)).toHaveLength(2);
    expect(screen.getAllByText('2 prescription items')).toHaveLength(2);
    expect(screen.getAllByText('1 prescription document')).toHaveLength(2);
    expect(screen.getAllByText('3 requested investigations')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'View latest consultation' })).toHaveAttribute(
      'href',
      '/doctor/appointments/completed-appointment/consultation',
    );
    expect(screen.getByLabelText('Test Patient initials')).toHaveTextContent('TP');
    expect(mocks.photo).not.toHaveBeenCalled();
  });

  it('shows real follow-up date and keeps the booked appointment available', async () => {
    const data = establishedFixture();
    data.currentCare.careState = 'FOLLOW_UP';
    data.currentCare.followUpDate = '2026-10-09';
    await openPatient(data);
    const header = screen.getByRole('banner', { name: 'Patient identity' });
    expect(within(header).getByText('Follow-up')).toBeInTheDocument();
    expect(within(header).getByText(`Recommended follow-up · ${detailDate('2026-10-09')}`)).toBeInTheDocument();
    expect(within(header).getByText(/Next appointment/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open appointment' })).toHaveAttribute(
      'href',
      '/doctor/appointments/upcoming-appointment',
    );
  });

  it.each(['NEW_PATIENT', 'ACTIVE_CARE', 'FOLLOW_UP'] as const)(
    'makes in-progress dominant over %s and never exposes draft notes or draft care events',
    async (careState) => {
      const user = userEvent.setup();
      const data = patientFixture();
      data.currentCare.careState = careState;
      data.currentCare.consultationInProgress = true;
      data.careHistory = [
        {
          ...completedEpisode,
          consultationId: 'active-record',
          appointmentId: 'active-appointment',
          status: 'IN_PROGRESS',
          startedAt: '2026-09-23T04:15:00Z',
          completedAt: null,
          assessment: 'PRIVATE DRAFT ASSESSMENT',
          plan: 'PRIVATE DRAFT PLAN',
          followUpDate: '2029-01-01',
        },
      ];
      await openPatient(data);
      const header = screen.getByRole('banner', { name: 'Patient identity' });
      expect(within(header).getByText('Consultation in progress')).toBeInTheDocument();
      expect(within(header).queryByText(/^(New Patient|Active care|Follow-up)$/)).not.toBeInTheDocument();
      expect(within(header).getByText(`Started ${detailDateTime('2026-09-23T04:15:00Z')}`)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Resume consultation' })).toHaveAttribute(
        'href',
        '/doctor/appointments/active-appointment/consultation',
      );
      expect(mocks.photo).toHaveBeenCalledWith({ kind: 'doctor-patient', appointmentId: 'active-appointment' });
      for (const tab of ['Overview', 'Consultations', 'Care Timeline']) {
        await user.click(screen.getByRole('tab', { name: tab }));
        expect(screen.queryByText('PRIVATE DRAFT ASSESSMENT')).not.toBeInTheDocument();
        expect(screen.queryByText(/PRIVATE DRAFT PLAN/)).not.toBeInTheDocument();
        expect(screen.queryByText('Recommended follow-up')).not.toBeInTheDocument();
      }
    },
  );

  it('makes every tab functional and exposes only appointment-scoped sharing summaries', async () => {
    const user = userEvent.setup();
    const data = establishedFixture();
    data.currentCare.followUpDate = completedEpisode.followUpDate;
    data.upcomingAppointments[0].sharedReportCount = 2;
    await openPatient(data);
    await user.click(screen.getByRole('tab', { name: 'Appointments' }));
    expect(screen.getByRole('tabpanel', { name: 'Appointments' })).toHaveTextContent('Upcoming appointments');
    expect(screen.queryByText('Clinical continuity')).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Reports' }));
    expect(screen.getByText('2 reports currently shared')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open appointment to review/ })).toHaveAttribute(
      'href',
      '/doctor/appointments/upcoming-appointment',
    );
    expect(screen.queryByRole('link', { name: /download|view report/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Consultations' }));
    expect(screen.getByText(completedEpisode.assessment!)).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Care Timeline' }));
    expect(screen.getByText('Consultation started')).toBeInTheDocument();
    expect(screen.getByText('Consultation completed')).toBeInTheDocument();
    expect(screen.getByText('Scheduled appointment')).toBeInTheDocument();
    expect(screen.getAllByText('Recommended follow-up')).toHaveLength(1);
    await user.click(screen.getByRole('tab', { name: 'Overview' }));
    await user.click(screen.getByRole('button', { name: 'View all appointments' }));
    expect(screen.getByRole('tab', { name: 'Appointments' })).toHaveAttribute('aria-selected', 'true');
  });

  it('does not create report rows when nothing is currently shared and falls back to initials when the photo is unavailable', async () => {
    const user = userEvent.setup();
    mocks.photo.mockRejectedValue(new Error('Access unavailable'));
    const { container } = await openPatient(patientFixture());
    await waitFor(() => expect(screen.getByLabelText('Test Patient profile photo')).toHaveTextContent('TP'));
    expect(container.querySelector('img')).toBeNull();
    await user.click(screen.getByRole('tab', { name: 'Reports' }));
    const panel = screen.getByRole('tabpanel', { name: 'Reports' });
    expect(within(panel).getByText(/No reports currently shared/)).toBeInTheDocument();
    expect(within(panel).queryByRole('list')).not.toBeInTheDocument();
    expect(within(panel).queryByRole('link')).not.toBeInTheDocument();
  });

  it('supports keyboard tab navigation and has no detected accessibility violations', async () => {
    const user = userEvent.setup();
    const { container } = await openPatient(patientFixture());
    expect(await axe(container)).toHaveNoViolations();
    screen.getByRole('tab', { name: 'Overview' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Appointments' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('tabpanel', { name: 'Appointments' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'More actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Review care history' }));
    expect(screen.getByRole('tab', { name: 'Care Timeline' })).toHaveAttribute('aria-selected', 'true');
  });
});
