import {
  ArrowLeft,
  CalendarClock,
  FileText,
  RefreshCcw,
  ShieldCheck,
  Stethoscope,
  XCircle,
  Clock3,
  UserRound,
  Video,
  MapPin,
  HeartPulse,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { AppSectionHeader, AppSurface, EmptyState, IconWell, StatusPill } from '../../components/app/app-ui';
import { PatientConsultationSummary } from '../../components/patient/patient-consultation-summary';
import { PatientConsultationJoin } from '../../features/appointments/patient-consultation-join';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../components/ui/dialog';
import { Skeleton } from '../../components/ui/feedback';
import {
  appointmentApi,
  appointmentError,
  type Appointment,
  type AvailabilitySlot,
  type ConsultationMode,
  type ReportShare,
} from '../../features/appointments/appointment-api';
import { patientReportApi } from '../../features/patient-reports/patient-report-api';
import type { PatientReport } from '../../features/patient-reports/patient-report-types';
import { cn } from '../../lib/cn';
import '../../styles/patient-care.css';

export function PatientAppointmentDetailPage() {
  const { appointmentId } = useParams();
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [shares, setShares] = useState<ReportShare[]>([]);
  const [reports, setReports] = useState<PatientReport[]>([]);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [rescheduleMode, setRescheduleMode] = useState<ConsultationMode | null>(null);
  const [selectedReport, setSelectedReport] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const reload = async () => {
    if (!appointmentId) return;
    const [detail, currentShares, reportPage] = await Promise.all([
      appointmentApi.detail(appointmentId),
      appointmentApi.shares(appointmentId),
      patientReportApi.list({ collection: 'ACTIVE', subjectType: 'SELF', page: 1, size: 50 }),
    ]);
    setAppointment(detail);
    setShares(currentShares);
    setReports(reportPage.items);
    setAvailability(detail.status === 'BOOKED' ? await appointmentApi.availability(detail.doctorId) : []);
  };

  useEffect(() => {
    let active = true;
    if (!appointmentId) return;
    setError('');
    Promise.all([
      appointmentApi.detail(appointmentId),
      appointmentApi.shares(appointmentId),
      patientReportApi.list({ collection: 'ACTIVE', subjectType: 'SELF', page: 1, size: 50 }),
    ])
      .then(async ([detail, currentShares, reportPage]) => {
        if (!active) return;
        setAppointment(detail);
        setShares(currentShares);
        setReports(reportPage.items);
        if (detail.status === 'BOOKED') {
          const slots = await appointmentApi.availability(detail.doctorId);
          if (active) setAvailability(slots);
        }
      })
      .catch(
        (requestError) => active && setError(appointmentError(requestError, 'We could not load this appointment.')),
      );
    return () => {
      active = false;
    };
  }, [appointmentId]);

  const activeShares = shares.filter((share) => !share.revokedAt);
  const shareableReports = useMemo(
    () => reports.filter((report) => !activeShares.some((share) => share.reportId === report.id)),
    [activeShares, reports],
  );
  const timezone = appointment?.bookingTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const slotDays = useMemo(() => {
    const days = new Map<string, AvailabilitySlot[]>();
    [...availability]
      .filter((slot) => slot.status === 'AVAILABLE')
      .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
      .forEach((slot) => {
        const day = new Date(slot.startsAt).toLocaleDateString('en-CA', { timeZone: timezone });
        days.set(day, [...(days.get(day) ?? []), slot]);
      });
    return days;
  }, [availability, timezone]);
  const activeDate = slotDays.has(selectedDate) ? selectedDate : ([...slotDays.keys()][0] ?? '');
  const visibleSlots = slotDays.get(activeDate) ?? [];

  if (!appointment && !error)
    return (
      <div className="mx-auto max-w-[1040px]">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="mt-6 h-96 rounded-2xl" />
      </div>
    );
  if (!appointment)
    return (
      <AppSurface variant="attention" className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold text-white">Appointment unavailable</h1>
        <p className="mt-2 text-sm text-[var(--clinora-text-muted)]">{error}</p>
      </AppSurface>
    );

  const reschedule = async () => {
    if (!appointmentId || !selectedSlot || !rescheduleMode) return;
    setBusy('reschedule');
    setError('');
    try {
      setAppointment(await appointmentApi.reschedule(appointmentId, selectedSlot, timezone, rescheduleMode));
      setSelectedSlot('');
      setRescheduleMode(null);
      await reload();
    } catch (requestError) {
      setError(
        appointmentError(
          requestError,
          'We could not reschedule this appointment. The selected time may no longer be available.',
        ),
      );
    } finally {
      setBusy('');
    }
  };
  const cancel = async () => {
    if (!appointmentId) return;
    setBusy('cancel');
    setError('');
    try {
      setAppointment(await appointmentApi.cancel(appointmentId, cancelReason.trim() || undefined));
      setCancelOpen(false);
      await reload();
    } catch (requestError) {
      setError(appointmentError(requestError, 'We could not cancel this appointment.'));
    } finally {
      setBusy('');
    }
  };
  const addShare = async () => {
    if (!appointmentId || !selectedReport) return;
    setBusy('share');
    setError('');
    try {
      await appointmentApi.share(appointmentId, selectedReport);
      setSelectedReport('');
      await reload();
    } catch (requestError) {
      setError(appointmentError(requestError, 'We could not share this report.'));
    } finally {
      setBusy('');
    }
  };
  const revoke = async (reportId: string) => {
    if (!appointmentId) return;
    setBusy(`revoke:${reportId}`);
    setError('');
    try {
      await appointmentApi.revokeShare(appointmentId, reportId);
      await reload();
    } catch (requestError) {
      setError(appointmentError(requestError, 'We could not revoke this report share.'));
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="patient-care">
      <Link
        to="/patient/appointments"
        className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--clinora-text-muted)] hover:text-white"
      >
        <ArrowLeft size={15} aria-hidden="true" />
        Back to appointments
      </Link>
      <AppSurface as="section" variant="hero" padding="compact" className="patient-care-art mt-4">
        <div className="patient-care-identity">
          <div className="flex min-w-0 items-center gap-3">
            <IconWell tone="info">
              <Stethoscope size={19} aria-hidden="true" />
            </IconWell>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold text-white">{appointment.doctorName}</h1>
                <StatusPill
                  tone={
                    appointment.status === 'BOOKED'
                      ? 'success'
                      : appointment.status === 'CANCELLED'
                        ? 'warning'
                        : 'neutral'
                  }
                >
                  {appointment.status === 'BOOKED' ? 'Confirmed' : sentenceCase(appointment.status)}
                </StatusPill>
              </div>
              <p className="mt-1 text-sm font-semibold text-[var(--clinora-info-foreground)]">
                {appointment.specialization}
              </p>
            </div>
          </div>
          <div className="patient-care-identity-meta">
            <CalendarClock size={21} className="shrink-0 text-[var(--clinora-info-foreground)]" aria-hidden="true" />
            <div>
              <p className="text-xs text-[var(--clinora-text-muted)]">Appointment date</p>
              <p className="mt-1 text-sm font-semibold">
                {new Date(appointment.scheduledStart).toLocaleDateString(undefined, {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  timeZone: timezone,
                })}
              </p>
              <p className="mt-0.5 text-xs text-[var(--clinora-text-muted)]">
                {new Date(appointment.scheduledStart).toLocaleTimeString(undefined, {
                  hour: 'numeric',
                  minute: '2-digit',
                  timeZone: timezone,
                  timeZoneName: 'short',
                })}
              </p>
            </div>
          </div>
          <div className="patient-care-identity-meta">
            {appointment.consultationMode === 'ONLINE' ? (
              <Video size={21} className="shrink-0 text-[var(--clinora-info-foreground)]" aria-hidden="true" />
            ) : (
              <MapPin size={21} className="shrink-0 text-[var(--clinora-info-foreground)]" aria-hidden="true" />
            )}
            <div>
              <p className="text-xs text-[var(--clinora-text-muted)]">Consultation type</p>
              <p className="mt-1 text-sm font-semibold">{modeLabel(appointment.consultationMode)}</p>
            </div>
          </div>
        </div>
      </AppSurface>

      {error ? (
        <p
          role="alert"
          className="mt-5 rounded-xl border border-rose-300/20 bg-rose-300/[0.06] px-4 py-3 text-sm text-rose-200"
        >
          {error}
        </p>
      ) : null}

      <div className="patient-care-details">
        <div className="min-w-0 space-y-4">
          <AppSurface as="section" padding="compact" aria-labelledby="appointment-information-title">
            <AppSectionHeader
              className="patient-care-section-heading"
              title="Appointment details"
              titleId="appointment-information-title"
            />
            <dl className="mt-3 divide-y divide-[var(--clinora-border-subtle)] border-t border-[var(--clinora-border-subtle)]">
              <Datum icon={UserRound} label="Doctor" value={appointment.doctorName} />
              <Datum icon={HeartPulse} label="Specialty" value={appointment.specialization} />
              <Datum
                icon={CalendarClock}
                label="Date & time"
                value={formatDateTime(appointment.scheduledStart, timezone)}
              />
              <Datum icon={Clock3} label="Timezone" value={timezone} />
              <Datum icon={Video} label="Consultation type" value={modeLabel(appointment.consultationMode)} />
              <Datum
                icon={FileText}
                label="Reason for visit"
                value={appointment.reasonForVisit || 'No reason provided'}
              />
              <Datum
                icon={FileText}
                label="Reports shared"
                value={
                  <a
                    href="#appointment-sharing-title"
                    className="text-[var(--clinora-info-foreground)] hover:underline"
                  >
                    {activeShares.length} report{activeShares.length === 1 ? '' : 's'} shared
                  </a>
                }
              />
            </dl>
          </AppSurface>
          {appointment.consultationMode === 'ONLINE' ? (
            <AppSurface as="section" variant="hero" padding="compact">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
                <Video size={18} className="text-[var(--clinora-success-foreground)]" aria-hidden="true" />
                Online consultation
              </h2>
              {appointment.status === 'BOOKED' ? (
                <PatientConsultationJoin key={appointment.scheduledStart} appointmentId={appointment.id} />
              ) : (
                <p className="mt-2 text-sm text-[var(--clinora-text-muted)]">This appointment is no longer active.</p>
              )}
            </AppSurface>
          ) : appointment.consultationMode === 'IN_PERSON' ? (
            <AppSurface as="section" padding="compact">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
                <MapPin size={18} aria-hidden="true" />
                In-person consultation
              </h2>
              {appointment.visitLocation ? (
                <p className="mt-2 text-sm text-[var(--clinora-text-muted)]">{appointment.visitLocation}</p>
              ) : null}
            </AppSurface>
          ) : null}

          <AppSurface as="section" padding="compact" aria-labelledby="appointment-sharing-title">
            <AppSectionHeader
              className="patient-care-section-heading"
              title="Shared medical reports"
              titleId="appointment-sharing-title"
              copy="Only the reports listed as shared are authorized for this appointment. Cancelling the appointment revokes active appointment-scoped access."
            />
            {activeShares.length ? (
              <ul className="mt-3 divide-y divide-[var(--clinora-border-subtle)] border-y border-[var(--clinora-border-subtle)]">
                {activeShares.map((share) => (
                  <li
                    key={share.reportId}
                    className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 flex-1 gap-3">
                      <IconWell tone="neutral">
                        <FileText size={16} aria-hidden="true" />
                      </IconWell>
                      <div className="min-w-0 break-words">
                        <Link
                          to={`/patient/reports/${share.reportId}`}
                          className="text-sm font-semibold text-white hover:text-[var(--clinora-info-foreground)]"
                        >
                          {share.reportName}
                        </Link>
                        <p className="mt-1 text-xs text-[var(--clinora-text-muted)]">
                          Shared {formatShortDate(share.sharedAt)}
                        </p>
                      </div>
                    </div>
                    {appointment.status === 'BOOKED' ? (
                      <Button
                        variant="ghost"
                        className="text-rose-200"
                        disabled={busy === `revoke:${share.reportId}`}
                        onClick={() => void revoke(share.reportId)}
                      >
                        {busy === `revoke:${share.reportId}` ? 'Stopping access…' : 'Stop sharing'}
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                className="mt-5"
                icon={<ShieldCheck size={18} aria-hidden="true" />}
                title="No reports shared"
                copy="This Doctor does not currently have appointment-scoped access to any of your reports."
              />
            )}
            {appointment.status === 'BOOKED' && shareableReports.length ? (
              <div className="mt-5 flex flex-col gap-3 rounded-xl bg-[var(--clinora-surface-nested)] p-4 sm:flex-row sm:items-end">
                <label className="min-w-0 flex-1 text-sm font-semibold text-white">
                  Share another report
                  <select
                    value={selectedReport}
                    onChange={(event) => setSelectedReport(event.target.value)}
                    className="mt-2 min-h-11 w-full rounded-xl border border-[var(--clinora-border-subtle)] bg-[var(--clinora-bg-chrome)] px-3 text-sm text-white"
                  >
                    <option value="">Choose a report</option>
                    {shareableReports.map((report) => (
                      <option key={report.id} value={report.id}>
                        {report.reportName}
                      </option>
                    ))}
                  </select>
                </label>
                <Button
                  variant="appSecondary"
                  disabled={!selectedReport || busy === 'share'}
                  onClick={() => void addShare()}
                >
                  {busy === 'share' ? 'Sharing…' : 'Share report'}
                </Button>
              </div>
            ) : null}
          </AppSurface>
          <PatientConsultationSummary appointmentId={appointment.id} />
        </div>

        <div className="min-w-0 space-y-4">
          <AppSurface as="section" padding="compact" aria-labelledby="manage-appointment-title">
            <AppSectionHeader
              className="patient-care-section-heading"
              title="Manage appointment"
              titleId="manage-appointment-title"
            />
            {appointment.status === 'BOOKED' ? (
              <>
                <div className="mt-3">
                  <p className="text-sm text-[var(--clinora-text-muted)]">Choose another time with this Doctor</p>
                  {slotDays.size ? (
                    <>
                      <label className="mt-3 block text-xs text-[var(--clinora-text-muted)]">
                        Appointment date <span>({timezone})</span>
                        <select
                          className="patient-care-control mt-2 w-full"
                          value={activeDate}
                          onChange={(event) => {
                            setSelectedDate(event.target.value);
                            setSelectedSlot('');
                            setRescheduleMode(null);
                          }}
                        >
                          {[...slotDays.entries()].map(([day, slots]) => (
                            <option key={day} value={day}>
                              {new Date(slots[0].startsAt).toLocaleDateString(undefined, {
                                weekday: 'short',
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                                timeZone: timezone,
                              })}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="mt-3 grid grid-cols-3 gap-2" role="group" aria-label="Available times">
                        {visibleSlots.map((slot) => (
                          <button
                            key={slot.id}
                            type="button"
                            aria-pressed={selectedSlot === slot.id}
                            onClick={() => {
                              setSelectedSlot(slot.id);
                              setRescheduleMode(
                                appointment.consultationMode && slotSupportsMode(slot, appointment.consultationMode)
                                  ? appointment.consultationMode
                                  : null,
                              );
                            }}
                            className={cn(
                              'min-h-10 rounded-xl border px-1.5 text-xs font-semibold transition',
                              selectedSlot === slot.id
                                ? 'border-[var(--clinora-border-interactive)] bg-[var(--clinora-info-soft)] text-[var(--clinora-info-foreground)]'
                                : 'border-[var(--clinora-border-subtle)] text-slate-300 hover:text-white',
                            )}
                          >
                            {new Date(slot.startsAt).toLocaleTimeString(undefined, {
                              hour: 'numeric',
                              minute: '2-digit',
                              timeZone: timezone,
                            })}
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-[var(--clinora-text-muted)]">
                      No alternative times are currently published.
                    </p>
                  )}
                  {selectedSlot ? (
                    <div className="mt-4">
                      <p className="text-xs font-semibold text-slate-300">Consultation type for the new time</p>
                      <div className="mt-2 flex gap-2">
                        {availableModes(availability.find((slot) => slot.id === selectedSlot)).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            aria-pressed={rescheduleMode === mode}
                            onClick={() => setRescheduleMode(mode)}
                            className={cn(
                              'min-h-10 rounded-xl border px-3 text-xs font-semibold',
                              rescheduleMode === mode
                                ? 'border-[var(--clinora-border-interactive)] bg-[var(--clinora-info-soft)] text-[var(--clinora-info-foreground)]'
                                : 'border-[var(--clinora-border-subtle)] text-slate-300',
                            )}
                          >
                            {modeLabel(mode)}
                          </button>
                        ))}
                      </div>
                      {!rescheduleMode ? (
                        <p className="mt-2 text-xs text-amber-200">Choose a valid consultation type for this time.</p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <Button
                  variant="appPrimary"
                  className="mt-4 w-full"
                  disabled={!selectedSlot || !rescheduleMode || busy === 'reschedule'}
                  onClick={() => void reschedule()}
                >
                  <RefreshCcw size={15} aria-hidden="true" />
                  {busy === 'reschedule' ? 'Rescheduling…' : 'Reschedule appointment'}
                </Button>
                <div className="mt-4 border-t border-[var(--clinora-border-subtle)] pt-3">
                  <Button
                    variant="ghost"
                    className="w-full justify-center text-rose-200"
                    onClick={() => setCancelOpen(true)}
                  >
                    <XCircle size={15} aria-hidden="true" />
                    Cancel appointment
                  </Button>
                </div>
              </>
            ) : (
              <p className="mt-4 text-sm leading-6 text-[var(--clinora-text-muted)]">
                This appointment is {appointment.status.toLowerCase()} and can no longer be changed from this Patient
                workflow.
              </p>
            )}
          </AppSurface>

          <AppSurface as="section" padding="compact">
            <div className="flex gap-3">
              <IconWell tone="neutral">
                <CalendarClock size={16} />
              </IconWell>
              <div>
                <h2 className="text-sm font-semibold text-white">Booking record</h2>
                <p className="mt-1 text-xs leading-5 text-[var(--clinora-text-muted)]">
                  Booked {formatDateTime(appointment.bookedAt, timezone)}.
                </p>
                <Link
                  to="/patient/history"
                  className="mt-1 inline-block text-xs text-[var(--clinora-info-foreground)] hover:underline"
                >
                  View your Health Record
                </Link>
              </div>
            </div>
          </AppSurface>
        </div>
      </div>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogTitle>Cancel appointment?</DialogTitle>
          <DialogDescription>
            Cancelling keeps the appointment in your history and revokes active report shares for this booking.
          </DialogDescription>
          <label className="mt-5 block text-sm font-semibold text-white">
            Reason (optional)
            <textarea
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value.slice(0, 240))}
              rows={3}
              className="mt-2 w-full resize-y rounded-xl border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-nested)] p-3 text-sm font-normal text-white outline-none focus:border-[var(--clinora-border-interactive)]"
            />
          </label>
          <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setCancelOpen(false)} disabled={busy === 'cancel'}>
              Keep appointment
            </Button>
            <Button
              variant="appSecondary"
              className="text-rose-100"
              onClick={() => void cancel()}
              disabled={busy === 'cancel'}
            >
              {busy === 'cancel' ? 'Cancelling…' : 'Cancel appointment'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Datum({ label, value, icon: Icon }: { label: string; value: ReactNode; icon: LucideIcon }) {
  return (
    <div className="patient-care-datum">
      <dt className="flex items-center gap-2 text-xs text-[var(--clinora-text-muted)]">
        <Icon size={17} className="shrink-0" aria-hidden="true" />
        {label}
      </dt>
      <dd className="text-sm leading-5 text-white">{value}</dd>
    </div>
  );
}
function sentenceCase(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}
function formatDateTime(value: string, timeZone: string) {
  return new Date(value).toLocaleString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  });
}
function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function modeLabel(mode?: ConsultationMode | null) {
  if (mode === 'ONLINE') return 'Online';
  if (mode === 'IN_PERSON') return 'In-person';
  return 'Not recorded (legacy appointment)';
}

function slotSupportsMode(slot: AvailabilitySlot, mode: ConsultationMode) {
  return !slot.consultationMode || slot.consultationMode === 'BOTH' || slot.consultationMode === mode;
}

function availableModes(slot?: AvailabilitySlot): ConsultationMode[] {
  if (!slot || slot.consultationMode === 'BOTH') return ['ONLINE', 'IN_PERSON'];
  return slot.consultationMode ? [slot.consultationMode] : ['ONLINE', 'IN_PERSON'];
}
