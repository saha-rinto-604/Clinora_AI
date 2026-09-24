import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DoctorConsultationPage } from './doctor-consultation-page';

const mocks = vi.hoisted(() => ({
  appointment: vi.fn(),
  byAppointment: vi.fn(),
  uploadPrescriptionDocument: vi.fn(),
  complete: vi.fn(),
  save: vi.fn(),
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
      complete: mocks.complete,
      save: mocks.save,
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
  beforeEach(() => {
    vi.resetAllMocks();
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
    mocks.complete.mockImplementation(async (_id, draft) => ({
      ...(await mocks.byAppointment()),
      status: 'COMPLETED',
      version: 2,
      completedAt: '2026-09-23T05:00:00Z',
      ...draft,
    }));
  });

  it('renders real encounter data in the context rail, 2 by 2 documentation grid and compact care plan', async () => {
    renderWorkspace();

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
    expect(screen.getByRole('button', { name: 'Complete consultation' })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: 'Complete consultation' }));
    expect(screen.getByRole('heading', { name: 'Complete this consultation?' })).toBeInTheDocument();
    expect(
      screen.getByText(/You have not added digital clinical notes or care actions to this consultation/),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(screen.queryByRole('heading', { name: 'Complete this consultation?' })).not.toBeInTheDocument();

    const prescriptionFile = new File(['authorized prescription'], 'prescription.pdf', {
      type: 'application/pdf',
    });
    const draft = await mocks.byAppointment();
    mocks.byAppointment.mockResolvedValue({
      ...draft,
      prescriptionDocuments: [
        {
          id: 'document-1',
          consultationId: 'consultation-1',
          originalFilename: 'prescription.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 23,
          createdAt: '2026-09-23T04:35:00Z',
        },
      ],
    });
    await userEvent.upload(screen.getByLabelText('Upload prescription'), prescriptionFile);
    expect(mocks.uploadPrescriptionDocument).toHaveBeenCalledWith('consultation-1', prescriptionFile);
    expect(await screen.findByText('prescription.pdf')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Add medication/ }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('textbox', { name: /Medication name/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Complete consultation' }));
    expect(screen.getByText(/the Doctor-authored information saved here will be finalized/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Complete consultation' }));
    expect(mocks.complete).toHaveBeenCalledWith(
      'consultation-1',
      expect.objectContaining({ assessment: '', plan: '', prescriptions: [] }),
    );
  });

  it('opens a portalled modal without replacing the sticky footer or workspace', async () => {
    const user = userEvent.setup();
    const { container } = renderWorkspace();
    const trigger = await screen.findByRole('button', { name: 'Complete consultation' });
    await user.type(screen.getByRole('textbox', { name: 'History' }), 'Current draft');
    const footer = screen.getByText('Ready to finish?').closest('.sticky')!;
    const footerCopy = footer.textContent;
    const history = screen.getByRole('textbox', { name: 'History' });
    expect(within(footer as HTMLElement).getByRole('button', { name: 'Save draft' })).toBeEnabled();

    await user.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Complete this consultation?' });
    expect(container).not.toContainElement(dialog);
    expect(footer).toBeInTheDocument();
    expect(footer.textContent).toBe(footerCopy);
    expect(footer).not.toContainElement(dialog);
    expect(history).toHaveValue('Current draft');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(dialog).toHaveAccessibleDescription(normalMessage);
    expect(document.querySelector('[data-state="open"].fixed.inset-0')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'History' })).not.toBeInTheDocument();

    const keepEditing = within(dialog).getByRole('button', { name: 'Keep editing' });
    expect(keepEditing).toHaveFocus();
    await user.tab({ shift: true });
    expect(within(dialog).getByRole('button', { name: 'Close completion confirmation' })).toHaveFocus();
    await user.tab();
    expect(keepEditing).toHaveFocus();
  });

  it.each(['Keep editing', 'Close completion confirmation', 'Escape'])(
    '%s cancels without saving or completing and returns focus to the trigger',
    async (action) => {
      const user = userEvent.setup();
      renderWorkspace();
      const trigger = await screen.findByRole('button', { name: 'Complete consultation' });
      await user.click(trigger);
      if (action === 'Escape') await user.keyboard('{Escape}');
      else await user.click(screen.getByRole('button', { name: action }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(trigger).toHaveFocus();
      expect(mocks.complete).not.toHaveBeenCalled();
      expect(mocks.save).not.toHaveBeenCalled();
    },
  );

  it('allows empty completion, prevents double submission and dismissal while pending, then hydrates read-only state', async () => {
    const user = userEvent.setup();
    const initial = await mocks.byAppointment();
    let finish!: (value: typeof initial) => void;
    mocks.complete.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    renderWorkspace();
    const trigger = await screen.findByRole('button', { name: 'Complete consultation' });
    expect(trigger).toBeEnabled();
    await user.click(trigger);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAccessibleDescription(emptyMessage);
    await user.dblClick(within(dialog).getByRole('button', { name: 'Complete consultation' }));
    expect(mocks.complete).toHaveBeenCalledTimes(1);
    expect(mocks.complete).toHaveBeenCalledWith(
      'consultation-1',
      expect.objectContaining({
        historyNotes: '',
        findingsNotes: '',
        assessment: '',
        plan: '',
        prescriptions: [],
        investigations: [],
        followUp: null,
      }),
    );
    expect(within(dialog).getByRole('button', { name: 'Completing…' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Keep editing' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Close completion confirmation' })).toBeDisabled();
    await user.keyboard('{Escape}');
    expect(dialog).toBeInTheDocument();
    await act(async () => finish({ ...initial, status: 'COMPLETED', completedAt: '2026-09-23T05:00:00Z' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Consultation completed' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'History' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Complete consultation' })).not.toBeInTheDocument();
  });

  it('keeps API errors in the open dialog and permits retry', async () => {
    const user = userEvent.setup();
    mocks.complete.mockRejectedValueOnce(new Error('Request failed'));
    renderWorkspace();
    await user.click(await screen.findByRole('button', { name: 'Complete consultation' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Complete consultation' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('We could not complete the consultation.');
    expect(within(dialog).getByRole('button', { name: 'Keep editing' })).toBeEnabled();
    await user.click(within(dialog).getByRole('button', { name: 'Complete consultation' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(mocks.complete).toHaveBeenCalledTimes(2);
  });

  it.each(['History', 'Findings', 'Assessment', 'Plan'])(
    'uses current unsaved %s in the confirmation copy',
    async (field) => {
      const user = userEvent.setup();
      renderWorkspace();
      await screen.findByRole('button', { name: 'Complete consultation' });
      await user.type(screen.getByRole('textbox', { name: field }), 'Digital clinical content');
      await user.click(screen.getByRole('button', { name: 'Complete consultation' }));
      expect(screen.getByRole('dialog')).toHaveAccessibleDescription(normalMessage);
    },
  );

  it.each([
    {
      prescriptions: [
        {
          id: 'rx-1',
          medicationName: 'Medication',
          strength: '',
          dose: '',
          route: '',
          frequency: '',
          duration: '',
          instructions: '',
        },
      ],
    },
    { investigations: [{ id: 'test-1', testName: 'Blood count', reason: '', instructions: '', priority: 'ROUTINE' }] },
    { followUp: { id: 'follow-up-1', recommendedDate: '', reason: '', instructions: '' } },
  ])('recognizes existing care actions: %j', async (careAction) => {
    mocks.byAppointment.mockResolvedValue({ ...(await mocks.byAppointment()), ...careAction });
    renderWorkspace();
    await userEvent.click(await screen.findByRole('button', { name: 'Complete consultation' }));
    expect(screen.getByRole('dialog')).toHaveAccessibleDescription(normalMessage);
  });

  it('ignores whitespace and blank temporary medication/investigation rows without blocking completion', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await screen.findByRole('button', { name: 'Complete consultation' });
    await user.type(screen.getByRole('textbox', { name: 'History' }), '   ');
    await user.click(screen.getByRole('button', { name: /Add medication/ }));
    await user.click(screen.getByRole('button', { name: /Request investigation/ }));
    await user.click(screen.getByRole('button', { name: 'Complete consultation' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAccessibleDescription(emptyMessage);
    await user.click(within(dialog).getByRole('button', { name: 'Complete consultation' }));
    expect(mocks.complete).toHaveBeenCalledWith(
      'consultation-1',
      expect.objectContaining({ prescriptions: [], investigations: [] }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

const normalMessage =
  'Are you sure you want to finish this consultation? Once completed, the Doctor-authored information saved here will be finalized and the consultation will become read-only.';
const emptyMessage =
  'You have not added digital clinical notes or care actions to this consultation. You can still complete it. Are you sure you want to finish?';

function renderWorkspace() {
  return render(
    <MemoryRouter initialEntries={['/doctor/appointments/appointment-1/consultation']}>
      <Routes>
        <Route path="/doctor/appointments/:appointmentId/consultation" element={<DoctorConsultationPage />} />
      </Routes>
    </MemoryRouter>,
  );
}
