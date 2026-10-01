import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PatientConsultationSummary } from '../../features/consultations/consultation-api';
import { PatientPrescriptionsPage } from './patient-prescriptions-page';

const mocks = vi.hoisted(() => ({
  patientPrescriptions: vi.fn(),
  patientPrescriptionDocument: vi.fn(),
  preparePrescriptionDocumentViewer: vi.fn(),
  presentPrescriptionDocument: vi.fn(),
  closePrescriptionDocumentViewer: vi.fn(),
}));

vi.mock('../../features/consultations/consultation-api', async () => {
  const actual = await vi.importActual<typeof import('../../features/consultations/consultation-api')>(
    '../../features/consultations/consultation-api',
  );
  return {
    ...actual,
    consultationApi: {
      ...actual.consultationApi,
      patientPrescriptions: mocks.patientPrescriptions,
      patientPrescriptionDocument: mocks.patientPrescriptionDocument,
    },
  };
});

vi.mock('../../features/consultations/prescription-document-file', () => ({
  preparePrescriptionDocumentViewer: mocks.preparePrescriptionDocumentViewer,
  presentPrescriptionDocument: mocks.presentPrescriptionDocument,
  closePrescriptionDocumentViewer: mocks.closePrescriptionDocumentViewer,
}));

describe('Patient prescriptions', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.preparePrescriptionDocumentViewer.mockReturnValue({ closed: false } as Window);
  });

  it('provides a dedicated longitudinal empty state', async () => {
    mocks.patientPrescriptions.mockResolvedValue([]);
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Prescriptions' })).toBeInTheDocument();
    expect(screen.getByText('No prescriptions yet')).toBeInTheDocument();
    expect(screen.getByText(/Draft consultation content is never shown/)).toBeInTheDocument();
  });

  it('renders finalized structured and original prescription content together', async () => {
    mocks.patientPrescriptions.mockResolvedValue([prescriptionSummary(['doc-1'])]);
    renderPage();

    expect(await screen.findByText('Dr Arafat Hossain')).toBeInTheDocument();
    expect(screen.getByText('Ferrous sulfate')).toBeInTheDocument();
    expect(screen.getByText('prescription-doc-1.pdf')).toBeInTheDocument();
  });

  it('opens a successful document through the existing patient document API without showing an error', async () => {
    const user = userEvent.setup();
    const blob = prescriptionPdf();
    mocks.patientPrescriptions.mockResolvedValue([prescriptionSummary(['doc-1'])]);
    mocks.patientPrescriptionDocument.mockResolvedValue(blob);
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'View' }));

    await waitFor(() =>
      expect(mocks.patientPrescriptionDocument).toHaveBeenCalledWith('consultation-1', 'doc-1', 'view'),
    );
    expect(mocks.presentPrescriptionDocument).toHaveBeenCalledWith(
      blob,
      'prescription-doc-1.pdf',
      'view',
      expect.anything(),
    );
    expect(screen.queryByText('This prescription document could not be opened.')).not.toBeInTheDocument();
  });

  it('shows an operation-specific error and retry action when the document request fails', async () => {
    const user = userEvent.setup();
    mocks.patientPrescriptions.mockResolvedValue([prescriptionSummary(['doc-1'])]);
    mocks.patientPrescriptionDocument.mockRejectedValue(new Error('network failure'));
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'View' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('This prescription document could not be opened.');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(mocks.closePrescriptionDocumentViewer).toHaveBeenCalled();
  });

  it('retries the failed document attempt and removes the error after success', async () => {
    const user = userEvent.setup();
    const blob = prescriptionPdf();
    mocks.patientPrescriptions.mockResolvedValue([prescriptionSummary(['doc-1'])]);
    mocks.patientPrescriptionDocument.mockRejectedValueOnce(new Error('network failure')).mockResolvedValueOnce(blob);
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'View' }));
    await user.click(await screen.findByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(mocks.presentPrescriptionDocument).toHaveBeenCalledTimes(1));
    expect(mocks.patientPrescriptionDocument).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(mocks.patientPrescriptions).toHaveBeenCalledTimes(1);
  });

  it('clears an old document error when the patient opens a different document', async () => {
    const user = userEvent.setup();
    mocks.patientPrescriptions.mockResolvedValue([prescriptionSummary(['doc-1', 'doc-2'])]);
    mocks.patientPrescriptionDocument.mockImplementation((_consultationId: string, documentId: string) =>
      documentId === 'doc-1' ? Promise.reject(new Error('network failure')) : Promise.resolve(prescriptionPdf()),
    );
    renderPage();

    const viewButtons = await screen.findAllByRole('button', { name: 'View' });
    await user.click(viewButtons[0]);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await user.click(viewButtons[1]);

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(mocks.presentPrescriptionDocument).toHaveBeenCalledWith(
      expect.any(Blob),
      'prescription-doc-2.pdf',
      'view',
      expect.anything(),
    );
  });

  it('ignores a stale failure after a newer document succeeds', async () => {
    const user = userEvent.setup();
    const firstRequest = deferred<Blob>();
    mocks.patientPrescriptions.mockResolvedValue([prescriptionSummary(['doc-1', 'doc-2'])]);
    mocks.patientPrescriptionDocument.mockImplementation((_consultationId: string, documentId: string) =>
      documentId === 'doc-1' ? firstRequest.promise : Promise.resolve(prescriptionPdf()),
    );
    renderPage();

    const viewButtons = await screen.findAllByRole('button', { name: 'View' });
    await user.click(viewButtons[0]);
    await user.click(viewButtons[1]);
    await waitFor(() => expect(mocks.presentPrescriptionDocument).toHaveBeenCalledTimes(1));

    firstRequest.reject(new Error('late network failure'));

    await waitFor(() => expect(mocks.closePrescriptionDocumentViewer).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(mocks.presentPrescriptionDocument).toHaveBeenCalledTimes(1);
  });
});

function renderPage() {
  return render(
    <MemoryRouter>
      <PatientPrescriptionsPage />
    </MemoryRouter>,
  );
}

function prescriptionSummary(documentIds: string[]): PatientConsultationSummary {
  return {
    consultationId: 'consultation-1',
    appointmentId: 'appointment-1',
    doctorId: 'doctor-1',
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
    prescriptionDocuments: documentIds.map((id) => ({
      id,
      consultationId: 'consultation-1',
      originalFilename: `prescription-${id}.pdf`,
      mimeType: 'application/pdf',
      sizeBytes: 1024,
      createdAt: '2026-09-23T09:00:00Z',
    })),
    investigations: [],
    followUp: null,
  };
}

function prescriptionPdf() {
  return new Blob(['%PDF-1.7 prescription'], { type: 'application/pdf' });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
