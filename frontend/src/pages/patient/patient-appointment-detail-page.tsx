import { ArrowLeft, CalendarClock, FileText, RefreshCcw, ShieldCheck, Stethoscope, XCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { AppSectionHeader, AppSurface, EmptyState, IconWell, StatusPill } from '../../components/app/app-ui';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../components/ui/dialog';
import { Skeleton } from '../../components/ui/feedback';
import {
  appointmentApi,
  appointmentError,
  type Appointment,
  type AvailabilitySlot,
  type ReportShare,
} from '../../features/appointments/appointment-api';
import { patientReportApi } from '../../features/patient-reports/patient-report-api';
import type { PatientReport } from '../../features/patient-reports/patient-report-types';
import { cn } from '../../lib/cn';

export function PatientAppointmentDetailPage() {
  const { appointmentId } = useParams();
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [shares, setShares] = useState<ReportShare[]>([]);
  const [reports, setReports] = useState<PatientReport[]>([]);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState('');
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
      patientReportApi.list({ collection: 'ACTIVE', page: 1, size: 50 }),
    ]);
    setAppointment(detail);
    setShares(currentShares);
    setReports(reportPage.items);
    if (detail.status === 'BOOKED') setAvailability(await appointmentApi.availability(detail.doctorId));
  };

  useEffect(() => {
    let active = true;
    if (!appointmentId) return;
    setError('');
    Promise.all([
      appointmentApi.detail(appointmentId),
      appointmentApi.shares(appointmentId),
      patientReportApi.list({ collection: 'ACTIVE', page: 1, size: 50 }),
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
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || appointment?.bookingTimezone || 'UTC';

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
    if (!appointmentId || !selectedSlot) return;
    setBusy('reschedule');
    setError('');
    try {
      setAppointment(await appointmentApi.reschedule(appointmentId, selectedSlot, timezone));
      setSelectedSlot('');
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
    <div className="mx-auto w-full max-w-[1040px] pb-8">
      <Link
        to="/patient/appointments"
        className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--clinora-text-muted)] hover:text-white"
      >
        <ArrowLeft size={15} aria-hidden="true" />
        Back to appointments
      </Link>
      <AppSurface as="section" variant="hero" className="mt-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-4">
            <IconWell tone="info">
              <Stethoscope size={19} aria-hidden="true" />
            </IconWell>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold text-white sm:text-3xl">{appointment.doctorName}</h1>
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
          <p className="text-sm font-semibold text-white">{formatDateTime(appointment.scheduledStart)}</p>
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

      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <AppSurface as="section" aria-labelledby="appointment-information-title">
            <AppSectionHeader title="Appointment details" titleId="appointment-information-title" />
            <dl className="mt-5 divide-y divide-[var(--clinora-border-subtle)] border-y border-[var(--clinora-border-subtle)]">
              <Datum label="Doctor" value={appointment.doctorName} />
              <Datum label="Specialty" value={appointment.specialization} />
              <Datum label="Date & time" value={formatDateTime(appointment.scheduledStart)} />
              <Datum label="Timezone" value={appointment.bookingTimezone} />
              <Datum label="Reason for visit" value={appointment.reasonForVisit || 'No reason provided'} />
            </dl>
          </AppSurface>

          <AppSurface as="section" aria-labelledby="appointment-sharing-title">
            <AppSectionHeader
              eyebrow="Patient controlled"
              title="Shared medical reports"
              titleId="appointment-sharing-title"
              copy="Only the reports listed as shared are authorized for this appointment. Cancelling the appointment revokes active appointment-scoped access."
            />
            {activeShares.length ? (
              <ul className="mt-5 divide-y divide-[var(--clinora-border-subtle)] border-y border-[var(--clinora-border-subtle)]">
                {activeShares.map((share) => (
                  <li
                    key={share.reportId}
                    className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex gap-3">
                      <IconWell tone="neutral">
                        <FileText size={16} aria-hidden="true" />
                      </IconWell>
                      <div>
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
        </div>

        <div className="space-y-6 lg:col-span-5">
          <AppSurface as="section" variant="elevated" aria-labelledby="manage-appointment-title">
            <AppSectionHeader title="Manage appointment" titleId="manage-appointment-title" />
            {appointment.status === 'BOOKED' ? (
              <>
                <div className="mt-5">
                  <p className="text-sm font-semibold text-white">Choose another time with this Doctor</p>
                  {availability.length ? (
                    <div className="mt-3 flex max-h-48 flex-wrap gap-2 overflow-y-auto pr-1">
                      {availability.map((slot) => (
                        <button
                          key={slot.id}
                          type="button"
                          aria-pressed={selectedSlot === slot.id}
                          onClick={() => setSelectedSlot(slot.id)}
                          className={cn(
                            'min-h-10 rounded-xl border px-3 text-xs font-semibold transition',
                            selectedSlot === slot.id
                              ? 'border-[var(--clinora-border-interactive)] bg-[var(--clinora-info-soft)] text-[var(--clinora-info-foreground)]'
                              : 'border-[var(--clinora-border-subtle)] text-slate-300 hover:text-white',
                          )}
                        >
                          {new Date(slot.startsAt).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-[var(--clinora-text-muted)]">
                      No alternative times are currently published.
                    </p>
                  )}
                </div>
                <Button
                  variant="appSecondary"
                  className="mt-4 w-full"
                  disabled={!selectedSlot || busy === 'reschedule'}
                  onClick={() => void reschedule()}
                >
                  <RefreshCcw size={15} aria-hidden="true" />
                  {busy === 'reschedule' ? 'Rescheduling…' : 'Reschedule'}
                </Button>
                <div className="mt-5 border-t border-[var(--clinora-border-subtle)] pt-5">
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
                  Booked {formatShortDate(appointment.bookedAt)}. Appointment changes remain in your Health Timeline.
                </p>
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

function Datum({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-3.5">
      <dt className="text-xs text-[var(--clinora-text-faint)]">{label}</dt>
      <dd className="mt-1 text-sm font-semibold leading-6 text-white">{value}</dd>
    </div>
  );
}
function sentenceCase(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}
function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
