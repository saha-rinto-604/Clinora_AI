import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Download,
  Eye,
  FileText,
  FlaskConical,
  Paperclip,
  Pill,
  Plus,
  Save,
  Stethoscope,
  Trash2,
  Upload,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { AppSectionHeader, AppSurface, EmptyState, IconWell, StatusPill } from '../../components/app/app-ui';
import { Button } from '../../components/ui/button';
import { buttonVariants } from '../../components/ui/button-variants';
import { Skeleton } from '../../components/ui/feedback';
import { ClinoraClinicalSupportPanel } from '../../features/doctor/clinora-clinical-support-panel';
import { doctorApi, type DoctorAppointmentDetail } from '../../features/doctor/doctor-api';
import { formatDoctorDateTime } from '../../features/doctor/doctor-display';
import { ProfileAvatar } from '../../features/profile/profile-image';
import {
  consultationApi,
  consultationError,
  type ConsultationDraftRequest,
  type ConsultationView,
  type FollowUpDraft,
  type InvestigationDraft,
  type PrescriptionDraft,
  type PrescriptionDocumentView,
} from '../../features/consultations/consultation-api';
import { presentPrescriptionDocument } from '../../features/consultations/prescription-document-file';

type PrescriptionRow = PrescriptionDraft & { key: string };
type InvestigationRow = InvestigationDraft & { key: string };

export function DoctorConsultationPage() {
  const { appointmentId = '' } = useParams();
  const [appointment, setAppointment] = useState<DoctorAppointmentDetail | null>(null);
  const [consultation, setConsultation] = useState<ConsultationView | null>(null);
  const [historyNotes, setHistoryNotes] = useState('');
  const [findingsNotes, setFindingsNotes] = useState('');
  const [assessment, setAssessment] = useState('');
  const [plan, setPlan] = useState('');
  const [prescriptions, setPrescriptions] = useState<PrescriptionRow[]>([]);
  const [investigations, setInvestigations] = useState<InvestigationRow[]>([]);
  const [followUp, setFollowUp] = useState<FollowUpDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [documentBusy, setDocumentBusy] = useState('');
  const [documentError, setDocumentError] = useState('');

  const hydrate = useCallback((value: ConsultationView | null) => {
    setConsultation(value);
    if (!value) return;
    setHistoryNotes(value.historyNotes || '');
    setFindingsNotes(value.findingsNotes || '');
    setAssessment(value.assessment || '');
    setPlan(value.plan || '');
    setPrescriptions(
      value.prescriptions.map((item) => ({
        key: item.id,
        medicationName: item.medicationName,
        strength: item.strength || '',
        dose: item.dose || '',
        route: item.route || '',
        frequency: item.frequency || '',
        duration: item.duration || '',
        instructions: item.instructions || '',
      })),
    );
    setInvestigations(
      value.investigations.map((item) => ({
        key: item.id,
        testName: item.testName,
        reason: item.reason || '',
        instructions: item.instructions || '',
        priority: item.priority,
      })),
    );
    setFollowUp(
      value.followUp
        ? {
            recommendedDate: value.followUp.recommendedDate,
            reason: value.followUp.reason || '',
            instructions: value.followUp.instructions || '',
          }
        : null,
    );
    setDirty(false);
  }, []);

  const load = useCallback(async () => {
    if (!appointmentId) return;
    setLoading(true);
    setError('');
    try {
      const [appointmentValue, consultationValue] = await Promise.all([
        doctorApi.appointment(appointmentId),
        consultationApi.byAppointment(appointmentId),
      ]);
      setAppointment(appointmentValue);
      hydrate(consultationValue);
    } catch (requestError) {
      setError(consultationError(requestError, 'We could not open this consultation workspace.'));
    } finally {
      setLoading(false);
    }
  }, [appointmentId, hydrate]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!dirty) return undefined;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [dirty]);

  const editable = consultation?.status === 'IN_PROGRESS';
  const draft = useMemo<ConsultationDraftRequest | null>(() => {
    if (!consultation) return null;
    return {
      version: consultation.version,
      historyNotes,
      findingsNotes,
      assessment,
      plan,
      prescriptions: prescriptions.filter((item) => !isEmptyPrescriptionDraft(item)).map((item) => ({
        medicationName: item.medicationName,
        strength: item.strength,
        dose: item.dose,
        route: item.route,
        frequency: item.frequency,
        duration: item.duration,
        instructions: item.instructions,
      })),
      investigations: investigations.filter((item) => !isEmptyInvestigationDraft(item)).map((item) => ({
        testName: item.testName,
        reason: item.reason,
        instructions: item.instructions,
        priority: item.priority,
      })),
      followUp: followUp && !isEmptyFollowUpDraft(followUp) ? followUp : null,
    };
  }, [assessment, consultation, findingsNotes, followUp, historyNotes, investigations, plan, prescriptions]);
  const hasDigitalContent = Boolean(
    historyNotes.trim() ||
      findingsNotes.trim() ||
      assessment.trim() ||
      plan.trim() ||
      draft?.prescriptions.length ||
      consultation?.prescriptionDocuments.length ||
      draft?.investigations.length ||
      draft?.followUp,
  );

  const start = async () => {
    if (!appointmentId) return;
    setBusy('start');
    setError('');
    try {
      hydrate(await consultationApi.start(appointmentId));
      setAppointment(await doctorApi.appointment(appointmentId));
    } catch (requestError) {
      setError(consultationError(requestError, 'We could not start the consultation.'));
    } finally {
      setBusy('');
    }
  };

  const save = async () => {
    if (!consultation || !draft) return;
    setBusy('save');
    setError('');
    try {
      hydrate(await consultationApi.save(consultation.id, draft));
    } catch (requestError) {
      setError(consultationError(requestError, 'We could not save this consultation draft.'));
    } finally {
      setBusy('');
    }
  };

  const complete = async () => {
    if (!consultation || !draft) return;
    setBusy('complete');
    setError('');
    try {
      hydrate(await consultationApi.complete(consultation.id, draft));
      setAppointment(await doctorApi.appointment(appointmentId));
      setConfirmComplete(false);
    } catch (requestError) {
      setError(consultationError(requestError, 'We could not complete the consultation.'));
    } finally {
      setBusy('');
    }
  };

  const uploadPrescriptionDocument = async (file: File) => {
    if (!consultation || consultation.status !== 'IN_PROGRESS') return;
    setDocumentBusy('upload');
    setDocumentError('');
    try {
      await consultationApi.uploadPrescriptionDocument(consultation.id, file);
      hydrate(await consultationApi.byAppointment(appointmentId));
    } catch (requestError) {
      setDocumentError(consultationError(requestError, 'We could not upload this prescription document.'));
    } finally {
      setDocumentBusy('');
    }
  };

  const removePrescriptionDocument = async (documentId: string) => {
    if (!consultation || consultation.status !== 'IN_PROGRESS') return;
    setDocumentBusy(`remove:${documentId}`);
    setDocumentError('');
    try {
      await consultationApi.removePrescriptionDocument(consultation.id, documentId);
      hydrate(await consultationApi.byAppointment(appointmentId));
    } catch (requestError) {
      setDocumentError(consultationError(requestError, 'We could not remove this prescription document.'));
    } finally {
      setDocumentBusy('');
    }
  };

  const openPrescriptionDocument = async (document: PrescriptionDocumentView, disposition: 'view' | 'download') => {
    if (!consultation) return;
    setDocumentBusy(`${disposition}:${document.id}`);
    setDocumentError('');
    try {
      const blob = await consultationApi.doctorPrescriptionDocument(consultation.id, document.id, disposition);
      presentPrescriptionDocument(blob, document.originalFilename, disposition);
    } catch (requestError) {
      setDocumentError(consultationError(requestError, 'We could not open this prescription document.'));
    } finally {
      setDocumentBusy('');
    }
  };

  const markDirty = () => setDirty(true);

  if (loading) {
    return (
      <div className="space-y-5" role="status" aria-label="Loading consultation">
        <Skeleton className="h-28 rounded-[20px]" />
        <Skeleton className="h-96 rounded-[20px]" />
        <Skeleton className="h-72 rounded-[20px]" />
      </div>
    );
  }

  if (!appointment) {
    return (
      <AppSurface variant="attention">
        <p role="alert" className="text-sm text-amber-100">
          {error || 'This appointment could not be found.'}
        </p>
        <Button className="mt-4" variant="appSecondary" onClick={() => void load()}>
          Try again
        </Button>
      </AppSurface>
    );
  }

  const timingWarning = consultationTimingWarning(appointment);

  if (!consultation) {
    return (
      <div className="space-y-6">
        <Link
          to={`/doctor/appointments/${appointment.id}`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400 hover:text-white"
        >
          <ArrowLeft size={15} /> Back to appointment
        </Link>
        <AppSurface variant="hero">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <ProfileAvatar
                source={{ kind: 'doctor-patient', appointmentId: appointment.id }}
                name={appointment.patient.displayName}
                size="lg"
              />
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-200">Clinical encounter</p>
                <h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-white sm:text-3xl">
                  {appointment.patient.displayName}
                </h1>
                <p className="mt-2 text-sm text-slate-400">
                  {formatDoctorDateTime(appointment.scheduledStart, appointment.timezone)} ·{' '}
                  {appointment.consultationMode === 'ONLINE' ? 'Online' : 'In-person'}
                </p>
              </div>
            </div>
            {appointment.status === 'BOOKED' ? (
              <Button variant="appPrimary" disabled={busy === 'start'} onClick={() => void start()}>
                <Stethoscope size={16} /> {busy === 'start' ? 'Starting…' : 'Start consultation'}
              </Button>
            ) : null}
          </div>
        </AppSurface>
        {error ? <ErrorBanner message={error} onReload={() => void load()} /> : null}
        {timingWarning ? (
          <AppSurface variant="attention">
            <p className="text-sm font-semibold text-amber-100">Appointment timing check</p>
            <p className="mt-1 text-xs leading-5 text-amber-100/80">
              {timingWarning} Starting remains an explicit Doctor action.
            </p>
          </AppSurface>
        ) : null}
        <AppSurface>
          <AppSectionHeader
            eyebrow="Before you begin"
            title={appointment.status === 'BOOKED' ? 'Patient context is ready' : 'No consultation record'}
            copy={
              appointment.status === 'BOOKED'
                ? 'Starting creates one Doctor-owned encounter for this appointment. Patient-shared evidence remains authorization-controlled and Clinora support stays grounded in currently authorized data.'
                : 'This appointment is no longer booked, so a new consultation cannot be started.'
            }
          />
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <ContextMetric label="Reason" value={appointment.reason || 'Not provided'} />
            <ContextMetric label="Shared reports" value={String(appointment.sharedReports.length)} />
            <ContextMetric label="Mode" value={appointment.consultationMode === 'ONLINE' ? 'Online' : 'In-person'} />
          </div>
        </AppSurface>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1240px] space-y-4" data-density="compact">
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-2 border-b border-cyan-300/[0.08] pb-2">
        <Link
          to={`/doctor/appointments/${appointment.id}`}
          className="inline-flex min-h-8 items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white"
        >
          <ArrowLeft size={14} /> Back to appointment
        </Link>
        <div className="flex items-center gap-2">
          {dirty && editable ? (
            <span className="text-[10px] font-medium text-amber-200">Unsaved changes</span>
          ) : editable ? (
            <span className="text-[10px] text-slate-500">Draft saved</span>
          ) : null}
          <StatusPill tone={editable ? 'success' : 'neutral'} className="min-h-6 px-2 py-0.5 text-[10px]">
            {editable ? 'In progress' : 'Completed'}
          </StatusPill>
        </div>
      </div>

      <section className="relative overflow-hidden rounded-[16px] border border-cyan-300/[0.16] bg-[linear-gradient(105deg,#062238,#06263c_55%,#042036)] px-4 py-4 sm:px-5">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full border border-cyan-300/10"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-8 top-6 h-20 w-20 rounded-full border border-teal-300/10"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-[62%] opacity-80 [background:linear-gradient(140deg,transparent_24%,rgba(34,211,238,.14)_24.5%,transparent_25.5%,transparent_48%,rgba(45,212,191,.12)_48.5%,transparent_50%)]"
        />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <ProfileAvatar
              source={{ kind: 'doctor-patient', appointmentId: appointment.id }}
              name={appointment.patient.displayName}
              size="lg"
              className="rounded-full"
            />
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-[-0.03em] text-white sm:text-[1.4rem]">
                {appointment.patient.displayName}
              </h1>
              {patientDemographics(appointment.patient.dateOfBirth, appointment.patient.gender) ? (
                <p className="mt-1 text-[11px] font-medium text-slate-400">
                  {patientDemographics(appointment.patient.dateOfBirth, appointment.patient.gender)}
                </p>
              ) : null}
              <p className="mt-1.5 flex items-center gap-1.5 truncate text-[11px] text-slate-300">
                <CalendarDays size={12} aria-hidden="true" />
                {formatDoctorDateTime(appointment.scheduledStart, appointment.timezone)} ·{' '}
                {appointment.consultationMode === 'ONLINE' ? 'Online' : 'In-person'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to={`/doctor/patients/${appointment.patient.id}`}
              className={buttonVariants({ variant: 'appSecondary', size: 'sm' })}
            >
              Care history
            </Link>
          </div>
        </div>
      </section>

      {error ? <ErrorBanner message={error} onReload={() => void load()} /> : null}

      <div className="grid items-start gap-3 lg:grid-cols-[14rem_minmax(0,1fr)] xl:grid-cols-[18.5rem_minmax(0,1fr)]">
        <aside className="space-y-3">
          <AppSurface padding="compact" radius="compact" className="border-cyan-300/[0.14] bg-[#04131f]/82">
            <h2 className="text-xs font-semibold text-cyan-200">Patient context</h2>
            <div className="mt-3 divide-y divide-cyan-300/[0.07] text-xs [&>div]:py-3 [&>div:first-child]:pt-0 [&>div:last-child]:pb-0">
              <ContextMetric label="Reason for visit" value={appointment.reason || 'Not provided'} />
              <ClinicalChips label="Allergies" values={appointment.patient.allergies} empty="None recorded" />
              <ClinicalChips
                label="Ongoing conditions"
                values={appointment.patient.chronicConditions}
                empty="None recorded"
              />
              <ClinicalChips
                label="Current medicines"
                values={appointment.patient.currentMedications}
                empty="None recorded"
              />
            </div>
          </AppSurface>

          <AppSurface
            padding="none"
            radius="compact"
            className="overflow-hidden border-cyan-300/[0.14] bg-[#04131f]/82"
          >
            <div className="border-b border-[var(--clinora-border-subtle)] px-4 py-3">
              <h2 className="text-xs font-semibold text-white">Authorized evidence</h2>
              <p className="mt-1 text-[10px] leading-4 text-slate-500">
                {appointment.sharedReports.length} report{appointment.sharedReports.length === 1 ? '' : 's'} available
                for this consultation
              </p>
            </div>
            {appointment.reportAccessActive && appointment.sharedReports.length ? (
              <ul className="divide-y divide-[var(--clinora-border-subtle)]">
                {appointment.sharedReports.map((report) => (
                  <li key={report.reportId}>
                    <Link
                      to={`/doctor/appointments/${appointment.id}/reports/${report.reportId}`}
                      className="flex items-center gap-2.5 px-4 py-3 hover:bg-[var(--clinora-surface-hover)]"
                    >
                      <IconWell tone="success" className="h-8 w-8 rounded-lg">
                        <FileText size={13} />
                      </IconWell>
                      <span className="min-w-0 flex-1 truncate text-xs font-semibold text-white">
                        {report.displayName}
                        {report.reportDate ? (
                          <span className="mt-0.5 block text-[9px] font-normal text-slate-500">
                            {report.reportDate}
                          </span>
                        ) : null}
                      </span>
                      <span className="text-[10px] font-semibold text-cyan-200">View</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                className="p-4"
                icon={<FileText size={15} />}
                title={appointment.reportAccessActive ? 'No reports shared' : 'Report access closed'}
                copy="Consultation documentation remains available even when source report authorization is not."
              />
            )}
          </AppSurface>
        </aside>

        <div className="space-y-4">
          {editable && appointment.reportAccessActive ? (
            <ClinoraClinicalSupportPanel appointmentId={appointment.id} screen="APPOINTMENT" appointmentMode />
          ) : null}

          <AppSurface padding="compact" radius="compact" className="border-cyan-300/[0.14] bg-[#04131f]/82">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--clinora-info-foreground)]">
                  Doctor authored
                </p>
                <h2 className="mt-1 text-lg font-semibold tracking-[-0.025em] text-white">Clinical documentation</h2>
              </div>
              {editable ? <span className="text-[10px] text-[var(--clinora-text-faint)]">Draft workspace</span> : null}
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <NoteField
                label="History"
                value={historyNotes}
                editable={editable}
                onChange={(value) => {
                  setHistoryNotes(value);
                  markDirty();
                }}
                placeholder="Patient-reported symptoms, duration, relevant history…"
              />
              <NoteField
                label="Findings"
                value={findingsNotes}
                editable={editable}
                onChange={(value) => {
                  setFindingsNotes(value);
                  markDirty();
                }}
                placeholder="Relevant exam findings and verified evidence…"
              />
              <NoteField
                label="Assessment"
                value={assessment}
                editable={editable}
                onChange={(value) => {
                  setAssessment(value);
                  markDirty();
                }}
                placeholder="Your clinical assessment…"
              />
              <NoteField
                label="Plan"
                value={plan}
                editable={editable}
                onChange={(value) => {
                  setPlan(value);
                  markDirty();
                }}
                placeholder="Care plan, advice and next steps…"
              />
            </div>
          </AppSurface>

          <CarePlanBuilder
            editable={editable}
            prescriptions={prescriptions}
            prescriptionDocuments={consultation.prescriptionDocuments}
            investigations={investigations}
            followUp={followUp}
            documentBusy={documentBusy}
            documentError={documentError}
            onPrescriptions={(value) => {
              setPrescriptions(value);
              markDirty();
            }}
            onInvestigations={(value) => {
              setInvestigations(value);
              markDirty();
            }}
            onFollowUp={(value) => {
              setFollowUp(value);
              markDirty();
            }}
            onUploadDocument={uploadPrescriptionDocument}
            onRemoveDocument={removePrescriptionDocument}
            onOpenDocument={openPrescriptionDocument}
          />

          {editable ? (
            <AppSurface
              variant="elevated"
              padding="compact"
              radius="compact"
              className="sticky bottom-4 z-20 border-cyan-300/[0.15] bg-[#062038]/95 shadow-[0_18px_55px_rgba(0,0,0,.35)] backdrop-blur-xl"
            >
              {confirmComplete ? (
                <div>
                  <div className="flex items-start gap-3">
                    <IconWell tone="success" className="h-9 w-9 rounded-xl">
                      <CheckCircle2 size={15} />
                    </IconWell>
                    <div>
                      <h2 className="text-sm font-semibold text-white">Complete this consultation?</h2>
                      <p className="mt-1 text-xs leading-5 text-slate-400">
                        {hasDigitalContent
                          ? 'Are you sure you want to finish this consultation? Once completed, the consultation becomes read-only and any Doctor-authored information saved here will be finalized for the Patient workflow.'
                          : 'You have not added digital clinical notes or care actions to this consultation. You can still complete it. Are you sure you want to finish?'}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" variant="ghost" disabled={busy !== ''} onClick={() => setConfirmComplete(false)}>
                      Keep editing
                    </Button>
                    <Button size="sm" variant="appPrimary" disabled={busy !== ''} onClick={() => void complete()}>
                      {busy === 'complete' ? 'Completing…' : 'Complete consultation'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-white">Ready to finish?</h2>
                    <p className="mt-1 text-xs text-slate-400">
                      Completion is available with any amount of digital documentation, including none.
                    </p>
                    {prescriptions.some(hasLimitedMedicationInstructions) ? (
                      <p className="mt-1.5 text-[11px] text-amber-200">
                        One or more medications have only a name and limited instructions. Review them before
                        finalizing.
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="appSecondary"
                      disabled={busy !== '' || !dirty}
                      onClick={() => void save()}
                    >
                      <Save size={14} /> {busy === 'save' ? 'Saving…' : dirty ? 'Save draft' : 'Saved'}
                    </Button>
                    <Button
                      size="sm"
                      variant="appPrimary"
                      disabled={busy !== '' || documentBusy !== ''}
                      onClick={() => setConfirmComplete(true)}
                    >
                      Complete consultation
                    </Button>
                  </div>
                </div>
              )}
            </AppSurface>
          ) : (
            <AppSurface variant="elevated" padding="compact" radius="compact">
              <div className="flex items-center gap-3">
                <IconWell tone="success" className="h-9 w-9 rounded-xl">
                  <CheckCircle2 size={15} />
                </IconWell>
                <div>
                  <h2 className="text-sm font-semibold text-white">Consultation completed</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Completed {consultation.completedAt ? new Date(consultation.completedAt).toLocaleString() : ''}.
                    This record is read-only.
                  </p>
                </div>
              </div>
            </AppSurface>
          )}
        </div>
      </div>
    </div>
  );
}

function CarePlanBuilder({
  editable,
  prescriptions,
  prescriptionDocuments,
  investigations,
  followUp,
  documentBusy,
  documentError,
  onPrescriptions,
  onInvestigations,
  onFollowUp,
  onUploadDocument,
  onRemoveDocument,
  onOpenDocument,
}: {
  editable: boolean;
  prescriptions: PrescriptionRow[];
  prescriptionDocuments: PrescriptionDocumentView[];
  investigations: InvestigationRow[];
  followUp: FollowUpDraft | null;
  documentBusy: string;
  documentError: string;
  onPrescriptions: (value: PrescriptionRow[]) => void;
  onInvestigations: (value: InvestigationRow[]) => void;
  onFollowUp: (value: FollowUpDraft | null) => void;
  onUploadDocument: (file: File) => Promise<void>;
  onRemoveDocument: (documentId: string) => Promise<void>;
  onOpenDocument: (document: PrescriptionDocumentView, disposition: 'view' | 'download') => Promise<void>;
}) {
  return (
    <AppSurface padding="compact" radius="compact" data-density="compact">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-300">Care plan</p>
          <h2 className="mt-1 text-base font-semibold tracking-[-0.02em] text-white">Actions after the consultation</h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-[var(--clinora-text-muted)]">
            Add prescriptions, investigations and follow-up. These will be shared with the Patient after completion.
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <CarePlanAction
          icon={<Pill size={15} />}
          title="Prescription"
          description={
            prescriptions.length
              ? `${prescriptions.length} medication${prescriptions.length === 1 ? '' : 's'} added`
              : 'Structured medication or original prescription.'
          }
          actionLabel="Add medication"
          disabled={!editable || prescriptions.length >= 20}
          onClick={() => onPrescriptions([...prescriptions, emptyPrescription()])}
          secondaryAction={
            editable && prescriptionDocuments.length < 5 ? (
              <label className="inline-flex min-h-8 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-cyan-300/[0.12] bg-transparent px-2.5 text-[10px] font-semibold text-slate-300 hover:border-cyan-300/25 hover:text-white">
                <Upload size={12} /> {documentBusy === 'upload' ? 'Uploading…' : 'Upload prescription'}
                <input
                  type="file"
                  className="sr-only"
                  accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
                  disabled={documentBusy !== ''}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.currentTarget.value = '';
                    if (file) void onUploadDocument(file);
                  }}
                />
              </label>
            ) : null
          }
        />
        <CarePlanAction
          icon={<FlaskConical size={15} />}
          title="Investigations"
          description={
            investigations.length
              ? `${investigations.length} investigation${investigations.length === 1 ? '' : 's'} requested`
              : 'Request tests or investigations.'
          }
          actionLabel="Request investigation"
          disabled={!editable || investigations.length >= 20}
          onClick={() => onInvestigations([...investigations, emptyInvestigation()])}
        />
        <CarePlanAction
          icon={<ClipboardList size={15} />}
          title="Follow-up"
          description={
            followUp?.recommendedDate
              ? `Recommended ${localDate(followUp.recommendedDate)}`
              : 'Set recommended follow-up.'
          }
          actionLabel={followUp ? 'Follow-up added' : 'Add follow-up'}
          disabled={!editable || Boolean(followUp)}
          onClick={() => onFollowUp({ recommendedDate: '', reason: '', instructions: '' })}
        />
      </div>

      {prescriptions.length || prescriptionDocuments.length ? (
        <CareSection
          title="Prescription"
          icon={<Pill size={15} />}
          action={
            editable ? (
              <Button
                size="sm"
                variant="appSecondary"
                disabled={prescriptions.length >= 20}
                onClick={() => onPrescriptions([...prescriptions, emptyPrescription()])}
              >
                <Plus size={14} /> Add medication
              </Button>
            ) : null
          }
        >
          {prescriptions.length
            ? prescriptions.map((item, index) => (
                <div
                  key={item.key}
                  className="rounded-xl border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-nested)] p-4"
                >
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <MiniInput
                      label="Medication"
                      value={item.medicationName}
                      editable={editable}
                      onChange={(value) => onPrescriptions(updateAt(prescriptions, index, { medicationName: value }))}
                    />
                    <MiniInput
                      label="Strength"
                      value={item.strength}
                      editable={editable}
                      onChange={(value) => onPrescriptions(updateAt(prescriptions, index, { strength: value }))}
                    />
                    <MiniInput
                      label="Dose"
                      value={item.dose}
                      editable={editable}
                      onChange={(value) => onPrescriptions(updateAt(prescriptions, index, { dose: value }))}
                    />
                    <MiniInput
                      label="Route"
                      value={item.route}
                      editable={editable}
                      onChange={(value) => onPrescriptions(updateAt(prescriptions, index, { route: value }))}
                    />
                    <MiniInput
                      label="Frequency"
                      value={item.frequency}
                      editable={editable}
                      onChange={(value) => onPrescriptions(updateAt(prescriptions, index, { frequency: value }))}
                    />
                    <MiniInput
                      label="Duration"
                      value={item.duration}
                      editable={editable}
                      onChange={(value) => onPrescriptions(updateAt(prescriptions, index, { duration: value }))}
                    />
                  </div>
                  <MiniInput
                    className="mt-3"
                    label="Instructions"
                    value={item.instructions}
                    editable={editable}
                    onChange={(value) => onPrescriptions(updateAt(prescriptions, index, { instructions: value }))}
                  />
                  {hasLimitedMedicationInstructions(item) ? (
                    <p className="mt-2 text-xs text-amber-200">
                      Limited instructions: review strength, dose, frequency, duration or free-text instructions before
                      finalizing if clinically applicable.
                    </p>
                  ) : null}
                  {editable ? (
                    <Button
                      className="mt-3 text-rose-200"
                      size="sm"
                      variant="ghost"
                      onClick={() => onPrescriptions(prescriptions.filter((_, itemIndex) => itemIndex !== index))}
                    >
                      <Trash2 size={14} /> Remove
                    </Button>
                  ) : null}
                </div>
              ))
            : null}

          <div className="mt-4 rounded-xl border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-nested)] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Paperclip size={14} /> Original prescription documents{' '}
                  <span className="text-[11px] font-normal text-[var(--clinora-text-faint)]">Optional</span>
                </h4>
                <p className="mt-1 text-xs leading-5 text-[var(--clinora-text-muted)]">
                  Attach up to five Doctor-authored PDF, JPG or PNG prescription documents. Files become Patient-visible
                  and immutable only when the consultation is completed.
                </p>
              </div>
              {editable && prescriptionDocuments.length < 5 ? (
                <label className="inline-flex min-h-9 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-1)] px-3 text-xs font-semibold text-slate-200 hover:border-[var(--clinora-border-interactive)]">
                  <Upload size={13} /> {documentBusy === 'upload' ? 'Uploading...' : 'Upload prescription'}
                  <input
                    type="file"
                    className="sr-only"
                    accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
                    disabled={documentBusy !== ''}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.currentTarget.value = '';
                      if (file) void onUploadDocument(file);
                    }}
                  />
                </label>
              ) : null}
            </div>
            {documentError ? (
              <p role="alert" className="mt-3 text-xs text-amber-200">
                {documentError}
              </p>
            ) : null}
            {prescriptionDocuments.length ? (
              <ul className="mt-3 space-y-2">
                {prescriptionDocuments.map((document) => (
                  <li
                    key={document.id}
                    className="flex flex-col gap-2 rounded-lg border border-[var(--clinora-border-subtle)] bg-[var(--clinora-bg-chrome)]/50 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="min-w-0">
                      <strong className="block truncate text-xs font-semibold text-white">
                        {document.originalFilename}
                      </strong>
                      <span className="mt-1 block text-[11px] text-[var(--clinora-text-faint)]">
                        {prescriptionFileLabel(document.mimeType)} - {prescriptionFileSize(document.sizeBytes)}
                      </span>
                    </span>
                    <span className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="appSecondary"
                        disabled={documentBusy !== ''}
                        onClick={() => void onOpenDocument(document, 'view')}
                      >
                        <Eye size={13} /> View
                      </Button>
                      <Button
                        size="sm"
                        variant="appSecondary"
                        disabled={documentBusy !== ''}
                        onClick={() => void onOpenDocument(document, 'download')}
                      >
                        <Download size={13} /> Download
                      </Button>
                      {editable ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-rose-200"
                          disabled={documentBusy !== ''}
                          onClick={() => {
                            if (window.confirm('Remove this prescription document from the draft consultation?'))
                              void onRemoveDocument(document.id);
                          }}
                        >
                          <Trash2 size={13} /> Remove
                        </Button>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-[var(--clinora-text-faint)]">
                No original prescription document attached.
              </p>
            )}
            {prescriptionDocuments.length >= 5 ? (
              <p className="mt-2 text-[11px] text-[var(--clinora-text-faint)]">
                Maximum five prescription documents reached.
              </p>
            ) : null}
          </div>
        </CareSection>
      ) : null}

      {investigations.length ? (
        <CareSection
          title="Requested investigations"
          icon={<FlaskConical size={15} />}
          action={
            editable ? (
              <Button
                size="sm"
                variant="appSecondary"
                disabled={investigations.length >= 20}
                onClick={() => onInvestigations([...investigations, emptyInvestigation()])}
              >
                <Plus size={14} /> Request investigation
              </Button>
            ) : null
          }
        >
          {investigations.length
            ? investigations.map((item, index) => (
                <div
                  key={item.key}
                  className="rounded-xl border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-nested)] p-4"
                >
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
                    <MiniInput
                      label="Investigation"
                      value={item.testName}
                      editable={editable}
                      onChange={(value) => onInvestigations(updateAt(investigations, index, { testName: value }))}
                    />
                    <label className="text-xs font-semibold text-slate-400">
                      Priority
                      <select
                        disabled={!editable}
                        value={item.priority}
                        onChange={(event) =>
                          onInvestigations(
                            updateAt(investigations, index, {
                              priority: event.target.value as InvestigationDraft['priority'],
                            }),
                          )
                        }
                        className="mt-1.5 min-h-10 w-full rounded-lg border border-[var(--clinora-border-subtle)] bg-[var(--clinora-bg-chrome)] px-2.5 text-sm text-white disabled:opacity-70"
                      >
                        <option value="ROUTINE">Routine</option>
                        <option value="URGENT">Urgent</option>
                      </select>
                    </label>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <MiniInput
                      label="Reason"
                      value={item.reason}
                      editable={editable}
                      onChange={(value) => onInvestigations(updateAt(investigations, index, { reason: value }))}
                    />
                    <MiniInput
                      label="Patient instructions"
                      value={item.instructions}
                      editable={editable}
                      onChange={(value) => onInvestigations(updateAt(investigations, index, { instructions: value }))}
                    />
                  </div>
                  {editable ? (
                    <Button
                      className="mt-3 text-rose-200"
                      size="sm"
                      variant="ghost"
                      onClick={() => onInvestigations(investigations.filter((_, itemIndex) => itemIndex !== index))}
                    >
                      <Trash2 size={14} /> Remove
                    </Button>
                  ) : null}
                </div>
              ))
            : null}
        </CareSection>
      ) : null}

      {followUp ? (
        <CareSection
          title="Follow-up"
          icon={<ClipboardList size={15} />}
          action={
            editable && !followUp ? (
              <Button
                size="sm"
                variant="appSecondary"
                onClick={() => onFollowUp({ recommendedDate: '', reason: '', instructions: '' })}
              >
                <Plus size={14} /> Add follow-up
              </Button>
            ) : null
          }
        >
          <div className="rounded-xl border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-nested)] p-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-xs font-semibold text-slate-400">
                Recommended date
                <input
                  type="date"
                  min={localToday()}
                  disabled={!editable}
                  value={followUp.recommendedDate}
                  onChange={(event) => onFollowUp({ ...followUp, recommendedDate: event.target.value })}
                  className="mt-1.5 min-h-10 w-full rounded-lg border border-[var(--clinora-border-subtle)] bg-[var(--clinora-bg-chrome)] px-2.5 text-sm text-white disabled:opacity-70"
                />
              </label>
              <MiniInput
                label="Reason"
                value={followUp.reason}
                editable={editable}
                onChange={(value) => onFollowUp({ ...followUp, reason: value })}
              />
              <MiniInput
                label="Instructions"
                value={followUp.instructions}
                editable={editable}
                onChange={(value) => onFollowUp({ ...followUp, instructions: value })}
              />
            </div>
            {editable ? (
              <Button className="mt-3 text-rose-200" size="sm" variant="ghost" onClick={() => onFollowUp(null)}>
                <Trash2 size={14} /> Remove follow-up
              </Button>
            ) : null}
          </div>
        </CareSection>
      ) : null}
    </AppSurface>
  );
}

function CarePlanAction({
  icon,
  title,
  description,
  actionLabel,
  disabled,
  onClick,
  secondaryAction,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  disabled: boolean;
  onClick: () => void;
  secondaryAction?: ReactNode;
}) {
  return (
    <section className="flex min-h-[128px] flex-col rounded-xl border border-cyan-300/[0.12] bg-[#061927]/75 p-3">
      <h3 className="flex items-center gap-2 text-xs font-semibold text-white">
        <span className="text-cyan-300">{icon}</span> {title}
      </h3>
      <p className="mt-2 min-h-8 text-[10px] leading-4 text-slate-500">{description}</p>
      <div className="mt-auto grid gap-1.5">
        <Button className="w-full justify-start" size="sm" variant="appSecondary" disabled={disabled} onClick={onClick}>
          <Plus size={13} /> {actionLabel}
        </Button>
        {secondaryAction}
      </div>
    </section>
  );
}

function CareSection({
  title,
  icon,
  action,
  children,
}: {
  title: string;
  icon: ReactNode;
  action: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mt-4 border-t border-[var(--clinora-border-subtle)] pt-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-xs font-semibold text-white">
          {icon}
          {title}
        </h3>
        {action}
      </div>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

function NoteField({
  label,
  value,
  editable,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  editable: boolean;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="text-xs font-semibold text-slate-300">
      {label}
      <textarea
        value={value}
        disabled={!editable}
        maxLength={8000}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-1.5 min-h-[104px] w-full resize-y rounded-lg border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-nested)] p-2.5 text-xs font-normal leading-5 text-white outline-none placeholder:text-slate-600 focus:border-[var(--clinora-border-interactive)] focus:ring-4 focus:ring-[var(--clinora-focus-ring-soft)] disabled:opacity-80"
      />
    </label>
  );
}

function MiniInput({
  label,
  value,
  editable,
  onChange,
  className = '',
}: {
  label: string;
  value: string;
  editable: boolean;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <label className={`${className} text-[11px] font-semibold text-slate-400`}>
      {label}
      <input
        disabled={!editable}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 min-h-9 w-full rounded-lg border border-[var(--clinora-border-subtle)] bg-[var(--clinora-bg-chrome)] px-2.5 text-sm font-normal text-white outline-none focus:border-[var(--clinora-border-interactive)] disabled:opacity-70"
      />
    </label>
  );
}

function ContextMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-[11px] font-medium leading-5 text-slate-200">{value}</p>
    </div>
  );
}

function ClinicalChips({ label, values, empty }: { label: string; values: string[]; empty: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-slate-400">{label}</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {values.length ? (
          values.map((value) => (
            <span
              key={value}
              className="rounded-full border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-nested)] px-2 py-0.5 text-[10px] text-slate-300"
            >
              {value}
            </span>
          ))
        ) : (
          <span className="text-[10px] text-slate-600">{empty}</span>
        )}
      </div>
    </div>
  );
}

function ErrorBanner({ message, onReload }: { message: string; onReload?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-xl border border-amber-300/15 bg-amber-300/[0.05] px-4 py-3 text-sm text-amber-100 sm:flex-row sm:items-center sm:justify-between"
    >
      <span>{message}</span>
      {onReload ? (
        <Button size="sm" variant="appSecondary" onClick={onReload}>
          Reload workspace
        </Button>
      ) : null}
    </div>
  );
}

function hasLimitedMedicationInstructions(item: PrescriptionDraft) {
  return (
    Boolean(item.medicationName.trim()) &&
    ![item.strength, item.dose, item.frequency, item.duration, item.instructions].some((value) => value.trim())
  );
}

function isEmptyPrescriptionDraft(item: PrescriptionDraft) {
  return ![
    item.medicationName,
    item.strength,
    item.dose,
    item.route,
    item.frequency,
    item.duration,
    item.instructions,
  ].some((value) => value.trim());
}

function isEmptyInvestigationDraft(item: InvestigationDraft) {
  return ![item.testName, item.reason, item.instructions].some((value) => value.trim());
}

function isEmptyFollowUpDraft(item: FollowUpDraft) {
  return !item.recommendedDate && !item.reason.trim() && !item.instructions.trim();
}

function prescriptionFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function prescriptionFileLabel(mimeType: string) {
  if (mimeType === 'application/pdf') return 'PDF';
  if (mimeType === 'image/png') return 'PNG';
  return 'JPEG';
}

function localToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function localDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function patientDemographics(dateOfBirth: string | null, gender: string | null) {
  const values: string[] = [];
  if (dateOfBirth) {
    const birth = new Date(`${dateOfBirth}T00:00:00`);
    if (!Number.isNaN(birth.getTime())) {
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const beforeBirthday =
        today.getMonth() < birth.getMonth() ||
        (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
      if (beforeBirthday) age -= 1;
      if (age >= 0 && age < 130) values.push(`Age ${age}`);
    }
  }
  if (gender) {
    values.push(
      gender
        .toLowerCase()
        .replaceAll('_', ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase()),
    );
  }
  return values.join(' · ');
}

function consultationTimingWarning(appointment: DoctorAppointmentDetail) {
  if (appointment.status !== 'BOOKED') return null;
  const now = Date.now();
  const start = new Date(appointment.scheduledStart).getTime();
  const end = new Date(appointment.scheduledEnd).getTime();
  const day = 24 * 60 * 60 * 1000;
  if (Number.isFinite(start) && start - now > day) {
    return `This consultation is scheduled for ${formatDoctorDateTime(appointment.scheduledStart, appointment.timezone)}.`;
  }
  if (Number.isFinite(end) && now - end > day) {
    return `This appointment ended ${formatDoctorDateTime(appointment.scheduledEnd, appointment.timezone)}. Very old bookings are blocked by the server.`;
  }
  return null;
}

function emptyPrescription(): PrescriptionRow {
  return {
    key: localKey(),
    medicationName: '',
    strength: '',
    dose: '',
    route: '',
    frequency: '',
    duration: '',
    instructions: '',
  };
}

function emptyInvestigation(): InvestigationRow {
  return { key: localKey(), testName: '', reason: '', instructions: '', priority: 'ROUTINE' };
}

function updateAt<T>(items: T[], index: number, patch: Partial<T>) {
  return items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item));
}

function localKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
