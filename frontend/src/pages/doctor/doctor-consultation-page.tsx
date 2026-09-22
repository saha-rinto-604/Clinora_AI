import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  FileText,
  FlaskConical,
  Pill,
  Plus,
  Save,
  Stethoscope,
  Trash2,
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
} from '../../features/consultations/consultation-api';

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
      prescriptions: prescriptions.map((item) => ({
        medicationName: item.medicationName,
        strength: item.strength,
        dose: item.dose,
        route: item.route,
        frequency: item.frequency,
        duration: item.duration,
        instructions: item.instructions,
      })),
      investigations: investigations.map((item) => ({
        testName: item.testName,
        reason: item.reason,
        instructions: item.instructions,
        priority: item.priority,
      })),
      followUp,
    };
  }, [assessment, consultation, findingsNotes, followUp, historyNotes, investigations, plan, prescriptions]);

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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to={`/doctor/appointments/${appointment.id}`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400 hover:text-white"
        >
          <ArrowLeft size={15} /> Back to appointment
        </Link>
        <div className="flex items-center gap-2">
          {dirty && editable ? <span className="text-xs font-medium text-amber-200">Unsaved changes</span> : null}
          <StatusPill tone={editable ? 'success' : 'neutral'}>{editable ? 'In progress' : 'Completed'}</StatusPill>
        </div>
      </div>

      <AppSurface variant="hero">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-center gap-4">
            <ProfileAvatar
              source={{ kind: 'doctor-patient', appointmentId: appointment.id }}
              name={appointment.patient.displayName}
              size="lg"
            />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-200">Consultation workspace</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-white sm:text-3xl">
                {appointment.patient.displayName}
              </h1>
              <p className="mt-2 text-sm text-slate-400">
                {appointment.reason || 'Consultation'} ·{' '}
                {formatDoctorDateTime(appointment.scheduledStart, appointment.timezone)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {editable ? (
              <Button variant="appSecondary" disabled={busy !== '' || !dirty} onClick={() => void save()}>
                <Save size={15} /> {busy === 'save' ? 'Saving…' : dirty ? 'Save draft' : 'Saved'}
              </Button>
            ) : null}
            <Link
              to={`/doctor/patients/${appointment.patient.id}`}
              className={buttonVariants({ variant: 'appSecondary' })}
            >
              Care history
            </Link>
          </div>
        </div>
      </AppSurface>

      {error ? <ErrorBanner message={error} onReload={() => void load()} /> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(18rem,0.72fr)_minmax(0,1.28fr)]">
        <div className="space-y-6">
          <AppSurface>
            <AppSectionHeader eyebrow="Patient context" title="What matters for this encounter" />
            <div className="mt-5 space-y-4 text-sm">
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

          <AppSurface padding="none" className="overflow-hidden">
            <div className="border-b border-[var(--clinora-border-subtle)] px-5 py-4 sm:px-6">
              <h2 className="text-sm font-semibold text-white">Currently authorized evidence</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">Patient-controlled and appointment-scoped.</p>
            </div>
            {appointment.reportAccessActive && appointment.sharedReports.length ? (
              <ul className="divide-y divide-[var(--clinora-border-subtle)]">
                {appointment.sharedReports.map((report) => (
                  <li key={report.reportId}>
                    <Link
                      to={`/doctor/appointments/${appointment.id}/reports/${report.reportId}`}
                      className="flex items-center gap-3 px-5 py-4 hover:bg-[var(--clinora-surface-hover)] sm:px-6"
                    >
                      <IconWell tone="success">
                        <FileText size={15} />
                      </IconWell>
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">
                        {report.displayName}
                      </span>
                      <span className="text-xs text-cyan-200">Review</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                className="p-6"
                icon={<FileText size={17} />}
                title={appointment.reportAccessActive ? 'No reports shared' : 'Report access closed'}
                copy="Consultation documentation remains available even when source report authorization is not."
              />
            )}
          </AppSurface>
        </div>

        <div className="space-y-6">
          {editable && appointment.reportAccessActive ? (
            <ClinoraClinicalSupportPanel appointmentId={appointment.id} screen="APPOINTMENT" appointmentMode />
          ) : null}

          <AppSurface>
            <AppSectionHeader
              eyebrow="Doctor authored"
              title="Clinical documentation"
              copy="Clinora can support reasoning, but only your reviewed text becomes part of this consultation record."
            />
            <div className="mt-5 grid gap-5">
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
            investigations={investigations}
            followUp={followUp}
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
          />

          {editable ? (
            <AppSurface variant="elevated">
              {confirmComplete ? (
                <div>
                  <div className="flex items-start gap-3">
                    <IconWell tone="success">
                      <CheckCircle2 size={16} />
                    </IconWell>
                    <div>
                      <h2 className="text-base font-semibold text-white">Finalize this consultation?</h2>
                      <p className="mt-1 text-sm leading-6 text-slate-400">
                        Completion makes the Doctor-authored record read-only and publishes the assessment, plan and
                        structured care actions to the Patient.
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Button variant="appPrimary" disabled={busy !== ''} onClick={() => void complete()}>
                      {busy === 'complete' ? 'Completing…' : 'Complete consultation'}
                    </Button>
                    <Button variant="ghost" disabled={busy !== ''} onClick={() => setConfirmComplete(false)}>
                      Keep editing
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-white">Ready to finish?</h2>
                    <p className="mt-1 text-sm text-slate-400">Assessment or plan is required before completion.</p>
                  </div>
                  <Button
                    variant="appPrimary"
                    disabled={!assessment.trim() && !plan.trim()}
                    onClick={() => setConfirmComplete(true)}
                  >
                    Complete consultation
                  </Button>
                </div>
              )}
            </AppSurface>
          ) : (
            <AppSurface variant="elevated">
              <div className="flex items-center gap-3">
                <IconWell tone="success">
                  <CheckCircle2 size={16} />
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
  investigations,
  followUp,
  onPrescriptions,
  onInvestigations,
  onFollowUp,
}: {
  editable: boolean;
  prescriptions: PrescriptionRow[];
  investigations: InvestigationRow[];
  followUp: FollowUpDraft | null;
  onPrescriptions: (value: PrescriptionRow[]) => void;
  onInvestigations: (value: InvestigationRow[]) => void;
  onFollowUp: (value: FollowUpDraft | null) => void;
}) {
  return (
    <AppSurface>
      <AppSectionHeader
        eyebrow="Care plan"
        title="Structured care plan"
        copy="Doctor-authored medication instructions, investigations and follow-up. Clinora does not autonomously prescribe or determine dosage."
      />

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
        {prescriptions.length ? (
          prescriptions.map((item, index) => (
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
        ) : (
          <p className="text-sm text-slate-500">No medication instructions added.</p>
        )}
      </CareSection>

      <CareSection
        title="Investigations"
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
        {investigations.length ? (
          investigations.map((item, index) => (
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
        ) : (
          <p className="text-sm text-slate-500">No investigations requested.</p>
        )}
      </CareSection>

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
        {followUp ? (
          <div className="rounded-xl border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-nested)] p-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-xs font-semibold text-slate-400">
                Recommended date
                <input
                  type="date"
                  min={new Date().toISOString().slice(0, 10)}
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
        ) : (
          <p className="text-sm text-slate-500">No follow-up recommendation added.</p>
        )}
      </CareSection>
    </AppSurface>
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
    <section className="mt-6 border-t border-[var(--clinora-border-subtle)] pt-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
          {icon}
          {title}
        </h3>
        {action}
      </div>
      <div className="space-y-3">{children}</div>
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
    <label className="text-sm font-semibold text-white">
      {label}
      <textarea
        value={value}
        disabled={!editable}
        maxLength={8000}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 min-h-28 w-full resize-y rounded-xl border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-nested)] p-3 text-sm font-normal leading-6 text-white outline-none placeholder:text-slate-600 focus:border-[var(--clinora-border-interactive)] focus:ring-4 focus:ring-[var(--clinora-focus-ring-soft)] disabled:opacity-80"
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
    <label className={`${className} text-xs font-semibold text-slate-400`}>
      {label}
      <input
        disabled={!editable}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 min-h-10 w-full rounded-lg border border-[var(--clinora-border-subtle)] bg-[var(--clinora-bg-chrome)] px-2.5 text-sm font-normal text-white outline-none focus:border-[var(--clinora-border-interactive)] disabled:opacity-70"
      />
    </label>
  );
}

function ContextMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[var(--clinora-surface-nested)] p-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">{label}</p>
      <p className="mt-1.5 text-sm font-semibold leading-6 text-white">{value}</p>
    </div>
  );
}

function ClinicalChips({ label, values, empty }: { label: string; values: string[]; empty: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-400">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {values.length ? (
          values.map((value) => (
            <span
              key={value}
              className="rounded-full border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-nested)] px-2.5 py-1 text-xs text-slate-300"
            >
              {value}
            </span>
          ))
        ) : (
          <span className="text-xs text-slate-600">{empty}</span>
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
