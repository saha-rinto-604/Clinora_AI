import {
  ArrowLeft,
  CalendarClock,
  FileText,
  HeartPulse,
  Pill,
  ShieldCheck,
  Stethoscope,
  TestTube2,
  UserRound,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { AppSectionHeader, AppSurface, EmptyState, IconWell, StatusPill } from '../../components/app/app-ui';
import { Button } from '../../components/ui/button';
import { buttonVariants } from '../../components/ui/button-variants';
import { Skeleton } from '../../components/ui/feedback';
import { doctorAvailabilityApi, type AvailabilitySlot } from '../../features/appointments/appointment-api';
import { doctorApi, doctorError, type DoctorAppointmentDetail } from '../../features/doctor/doctor-api';
import {
  bloodGroupLabel,
  doctorStatusLabel,
  doctorStatusTone,
  formatDoctorDate,
  formatDoctorDateTime,
  genderLabel,
  reportTypeLabel,
} from '../../features/doctor/doctor-display';
import { ProfileAvatar } from '../../features/profile/profile-image';

export function DoctorAppointmentPage() {
  const { appointmentId = '' } = useParams();
  const [data, setData] = useState<DoctorAppointmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [action, setAction] = useState<'cancel' | 'reschedule' | null>(null);
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [leftReport, setLeftReport] = useState('');
  const [rightReport, setRightReport] = useState('');

  const load = useCallback(async () => {
    if (!appointmentId) return;
    setLoading(true);
    setError('');
    try {
      const appointment = await doctorApi.appointment(appointmentId);
      setData(appointment);
      if (appointment.sharedReports.length >= 2) {
        setLeftReport((current) => current || appointment.sharedReports[0].reportId);
        setRightReport((current) => current || appointment.sharedReports[1].reportId);
      }
    } catch (requestError) {
      setError(doctorError(requestError, 'We could not open this appointment.'));
    } finally {
      setLoading(false);
    }
  }, [appointmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openReschedule = async () => {
    setAction('reschedule');
    setActionError('');
    try {
      const slots = await doctorAvailabilityApi.list();
      setAvailability(
        slots.filter((slot) => slot.status === 'AVAILABLE' && new Date(slot.startsAt).getTime() > Date.now()),
      );
    } catch (requestError) {
      setActionError(doctorError(requestError, 'We could not load your available times.'));
    }
  };

  const cancelAppointment = async () => {
    if (!data) return;
    setBusy(true);
    setActionError('');
    try {
      setData(await doctorApi.cancelAppointment(data.id, cancelReason));
      setAction(null);
      setCancelReason('');
    } catch (requestError) {
      setActionError(doctorError(requestError, 'We could not cancel this appointment.'));
    } finally {
      setBusy(false);
    }
  };

  const rescheduleAppointment = async () => {
    if (!data || !selectedSlot) return;
    const slot = availability.find((item) => item.id === selectedSlot);
    if (!slot) return;
    setBusy(true);
    setActionError('');
    try {
      setData(await doctorApi.rescheduleAppointment(data.id, selectedSlot, slot.timezone));
      setAction(null);
      setSelectedSlot('');
      setAvailability([]);
    } catch (requestError) {
      setActionError(doctorError(requestError, 'We could not move this appointment.'));
    } finally {
      setBusy(false);
    }
  };

  const compareHref = useMemo(() => {
    if (!data || !leftReport || !rightReport || leftReport === rightReport) return '';
    const params = new URLSearchParams({ left: leftReport, right: rightReport });
    return `/doctor/appointments/${data.id}/reports/compare?${params.toString()}`;
  }, [data, leftReport, rightReport]);

  if (loading) {
    return (
      <div className="space-y-6" aria-label="Loading appointment">
        <Skeleton className="h-24 rounded-[var(--radius-app-card)]" />
        <Skeleton className="h-72 rounded-[var(--radius-app-card)]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <AppSurface as="section" variant="attention">
        <p role="alert" className="text-sm text-[var(--clinora-warning-foreground)]">
          {error || 'This appointment could not be found.'}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="appSecondary" onClick={() => void load()}>
            Try again
          </Button>
          <Link to="/doctor/schedule" className={buttonVariants({ variant: 'appSecondary' })}>
            Back to schedule
          </Link>
        </div>
      </AppSurface>
    );
  }

  return (
    <div className="space-y-7">
      <Link
        to="/doctor/schedule"
        className="inline-flex min-h-10 items-center gap-2 text-sm font-medium text-[var(--clinora-text-muted)] transition-colors hover:text-[var(--clinora-info-foreground)]"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Back to schedule
      </Link>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-center gap-4">
          <ProfileAvatar
            source={{ kind: 'doctor-patient', appointmentId: data.id }}
            name={data.patient.displayName}
            size="lg"
          />
          <AppSectionHeader eyebrow="Appointment" title={data.patient.displayName} copy={data.reason || 'Consultation'} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill tone={doctorStatusTone(data.status)}>{doctorStatusLabel(data.status)}</StatusPill>
          {data.canModify ? (
            <>
              <Button variant="appSecondary" onClick={() => void openReschedule()}>
                Reschedule
              </Button>
              <Button
                variant="ghost"
                className="text-rose-200"
                onClick={() => {
                  setAction('cancel');
                  setActionError('');
                }}
              >
                Cancel appointment
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {action === 'cancel' ? (
        <AppSurface as="section" variant="attention" aria-labelledby="cancel-appointment-title">
          <AppSectionHeader
            title="Cancel this appointment?"
            titleId="cancel-appointment-title"
            copy="The Patient will be notified and any reports shared for this appointment will no longer be available to you."
          />
          <label className="mt-5 block max-w-2xl text-sm font-semibold text-white">
            Note for the Patient <span className="font-normal text-[var(--clinora-text-faint)]">(optional)</span>
            <textarea
              value={cancelReason}
              maxLength={240}
              onChange={(event) => setCancelReason(event.target.value)}
              placeholder="For example: Clinic schedule changed"
              className="mt-2 min-h-24 w-full rounded-xl border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-nested)] px-3 py-2.5 text-sm font-normal text-white outline-none focus:border-[var(--clinora-border-interactive)] focus:ring-4 focus:ring-[var(--clinora-focus-ring-soft)]"
            />
          </label>
          {actionError ? (
            <p role="alert" className="mt-3 text-sm text-rose-200">
              {actionError}
            </p>
          ) : null}
          <div className="mt-5 flex flex-wrap gap-3">
            <Button variant="appPrimary" disabled={busy} onClick={() => void cancelAppointment()}>
              {busy ? 'Cancelling…' : 'Confirm cancellation'}
            </Button>
            <Button variant="appSecondary" disabled={busy} onClick={() => setAction(null)}>
              Keep appointment
            </Button>
          </div>
        </AppSurface>
      ) : null}

      {action === 'reschedule' ? (
        <AppSurface as="section" aria-labelledby="reschedule-title">
          <AppSectionHeader
            eyebrow="Schedule change"
            title="Choose another available time"
            titleId="reschedule-title"
            copy="The Patient will be notified of the new time. Any reports they already shared for this appointment remain attached to it."
          />
          {actionError ? (
            <p role="alert" className="mt-4 text-sm text-rose-200">
              {actionError}
            </p>
          ) : null}
          {availability.length ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {availability.slice(0, 18).map((slot) => (
                <label
                  key={slot.id}
                  className={`cursor-pointer rounded-[var(--radius-app-compact)] border p-4 transition-colors ${
                    selectedSlot === slot.id
                      ? 'border-[var(--clinora-border-interactive)] bg-[var(--clinora-info-soft)]'
                      : 'border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-nested)] hover:bg-[var(--clinora-surface-hover)]'
                  }`}
                >
                  <input
                    type="radio"
                    name="doctor-reschedule-slot"
                    value={slot.id}
                    checked={selectedSlot === slot.id}
                    onChange={() => setSelectedSlot(slot.id)}
                    className="sr-only"
                  />
                  <span className="block text-sm font-semibold text-white">
                    {formatDoctorDateTime(slot.startsAt, slot.timezone)}
                  </span>
                  <span className="mt-1 block text-xs text-[var(--clinora-text-faint)]">{slot.timezone}</span>
                </label>
              ))}
            </div>
          ) : !actionError ? (
            <EmptyState
              className="mt-5"
              icon={<CalendarClock size={18} />}
              title="No other available times"
              copy="Add availability first, then return here to move this appointment."
              action={
                <Link to="/doctor/availability" className={buttonVariants({ variant: 'appSecondary' })}>
                  Manage availability
                </Link>
              }
            />
          ) : null}
          <div className="mt-5 flex flex-wrap gap-3">
            <Button variant="appPrimary" disabled={busy || !selectedSlot} onClick={() => void rescheduleAppointment()}>
              {busy ? 'Updating…' : 'Confirm new time'}
            </Button>
            <Button variant="appSecondary" disabled={busy} onClick={() => setAction(null)}>
              Close
            </Button>
          </div>
        </AppSurface>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(18rem,0.72fr)_minmax(0,1.28fr)]">
        <div className="space-y-6">
          <AppSurface as="section" aria-labelledby="scheduled-care-title">
            <div className="flex items-center gap-3">
              <IconWell tone="info">
                <CalendarClock size={16} />
              </IconWell>
              <div>
                <h2 id="scheduled-care-title" className="text-base font-semibold text-white">
                  Scheduled care
                </h2>
                <p className="mt-1 text-xs text-[var(--clinora-text-muted)]">Confirmed Patient booking</p>
              </div>
            </div>
            <p className="mt-5 text-lg font-semibold text-white">
              {formatDoctorDateTime(data.scheduledStart, data.timezone)}
            </p>
            <p className="mt-1 text-xs text-[var(--clinora-text-faint)]">{data.timezone || 'Local time'}</p>
          </AppSurface>

          <AppSurface as="section" aria-labelledby="patient-context-title">
            <div className="flex items-center gap-3">
              <IconWell tone="info">
                <UserRound size={16} />
              </IconWell>
              <div>
                <h2 id="patient-context-title" className="text-base font-semibold text-white">
                  Patient context
                </h2>
                <p className="mt-1 text-xs text-[var(--clinora-text-muted)]">
                  Information relevant to this consultation
                </p>
              </div>
            </div>
            <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-3 xl:grid-cols-1">
              <ContextRow label="Date of birth" value={formatDoctorDate(data.patient.dateOfBirth)} />
              <ContextRow label="Gender" value={genderLabel(data.patient.gender)} />
              <ContextRow label="Blood group" value={bloodGroupLabel(data.patient.bloodGroup)} />
            </dl>
            <div className="mt-5 space-y-4 border-t border-[var(--clinora-border-subtle)] pt-5">
              <ClinicalList
                icon={<HeartPulse size={15} />}
                label="Allergies"
                values={data.patient.allergies}
                empty="None recorded"
              />
              <ClinicalList
                icon={<Stethoscope size={15} />}
                label="Ongoing conditions"
                values={data.patient.chronicConditions}
                empty="None recorded"
              />
              <ClinicalList
                icon={<Pill size={15} />}
                label="Current medicines"
                values={data.patient.currentMedications}
                empty="None recorded"
              />
            </div>
            <p className="mt-5 border-t border-[var(--clinora-border-subtle)] pt-4 text-xs leading-5 text-[var(--clinora-text-faint)]">
              Only clinical details relevant to this appointment are shown here.
            </p>
          </AppSurface>
        </div>

        <div className="space-y-6">
          <AppSurface as="section" padding="none" className="overflow-hidden" aria-labelledby="shared-reports-title">
            <div className="flex flex-col gap-3 border-b border-[var(--clinora-border-subtle)] px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
              <div>
                <h2 id="shared-reports-title" className="text-base font-semibold text-white">
                  Reports shared for this appointment
                </h2>
                <p className="mt-1.5 max-w-2xl text-xs leading-5 text-[var(--clinora-text-muted)]">
                  The Patient controls this list. Clinora does not reveal unshared reports, extracted values, or AI
                  results from them.
                </p>
              </div>
              <StatusPill tone={data.reportAccessActive && data.sharedReports.length ? 'success' : 'neutral'}>
                {data.reportAccessActive ? `${data.sharedReports.length} shared` : 'Access closed'}
              </StatusPill>
            </div>

            {!data.reportAccessActive ? (
              <EmptyState
                className="p-6 sm:p-8"
                icon={<ShieldCheck size={18} />}
                iconTone="neutral"
                title="Source report access is closed"
                copy="This appointment is no longer active, so Patient report files and extracted values are not available from this workspace. Finalized consultation evidence will be handled by the clinical record in the next phase."
              />
            ) : data.sharedReports.length === 0 ? (
              <EmptyState
                className="p-6 sm:p-8"
                icon={<ShieldCheck size={18} />}
                iconTone="success"
                title="No reports have been shared"
                copy="You can continue the consultation without uploaded files. If the Patient chooses to share a report later, it will appear here automatically."
              />
            ) : (
              <ul className="divide-y divide-[var(--clinora-border-subtle)]">
                {data.sharedReports.map((report) => (
                  <li key={report.reportId}>
                    <Link
                      to={`/doctor/appointments/${data.id}/reports/${report.reportId}`}
                      className="group flex min-h-20 items-center gap-4 px-5 py-4 transition-colors hover:bg-[var(--clinora-surface-hover)] focus-visible:outline-none sm:px-6"
                    >
                      <IconWell tone="success">
                        <FileText size={16} />
                      </IconWell>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-white">{report.displayName}</span>
                        <span className="mt-1 block text-xs text-[var(--clinora-text-muted)]">
                          {reportTypeLabel(report.reportType)} · {formatDoctorDate(report.reportDate)}
                          {report.providerLaboratory ? ` · ${report.providerLaboratory}` : ''}
                        </span>
                      </span>
                      <span className="text-xs font-semibold text-[var(--clinora-info-foreground)]">Review</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </AppSurface>

          {data.reportAccessActive && data.sharedReports.length >= 2 ? (
            <AppSurface as="section" aria-labelledby="compare-reports-title">
              <AppSectionHeader
                eyebrow="Shared evidence"
                title="Compare two reports"
                titleId="compare-reports-title"
                copy="Compare only reports the Patient has independently shared for this appointment."
              />
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <ReportSelect
                  label="First report"
                  value={leftReport}
                  onChange={setLeftReport}
                  reports={data.sharedReports}
                />
                <ReportSelect
                  label="Second report"
                  value={rightReport}
                  onChange={setRightReport}
                  reports={data.sharedReports}
                />
              </div>
              <div className="mt-4">
                {compareHref ? (
                  <Link to={compareHref} className={buttonVariants({ variant: 'appSecondary' })}>
                    <TestTube2 size={15} aria-hidden="true" /> Compare results
                  </Link>
                ) : (
                  <p className="text-xs text-[var(--clinora-warning-foreground)]">Choose two different reports.</p>
                )}
              </div>
            </AppSurface>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ContextRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[var(--clinora-surface-nested)] px-3.5 py-3">
      <dt className="text-[11px] font-medium text-[var(--clinora-text-faint)]">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-white">{value}</dd>
    </div>
  );
}

function ClinicalList({
  icon,
  label,
  values,
  empty,
}: {
  icon: ReactNode;
  label: string;
  values: string[];
  empty: string;
}) {
  return (
    <div>
      <p className="flex items-center gap-2 text-xs font-semibold text-slate-300">
        {icon}
        {label}
      </p>
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
          <span className="text-xs text-[var(--clinora-text-faint)]">{empty}</span>
        )}
      </div>
    </div>
  );
}

function ReportSelect({
  label,
  value,
  onChange,
  reports,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  reports: DoctorAppointmentDetail['sharedReports'];
}) {
  return (
    <label className="text-sm font-semibold text-white">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 min-h-11 w-full rounded-xl border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-nested)] px-3 text-sm font-normal text-white outline-none focus:border-[var(--clinora-border-interactive)] focus:ring-4 focus:ring-[var(--clinora-focus-ring-soft)]"
      >
        {reports.map((report) => (
          <option key={report.reportId} value={report.reportId}>
            {report.displayName}
          </option>
        ))}
      </select>
    </label>
  );
}
