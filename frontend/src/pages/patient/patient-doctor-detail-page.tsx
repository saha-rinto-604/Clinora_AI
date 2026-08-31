import { ArrowLeft, CalendarDays, Check, FileText, ShieldCheck, Stethoscope } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { AppSectionHeader, AppSurface, EmptyState, IconWell, StatusPill } from '../../components/app/app-ui';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/feedback';
import {
  appointmentApi,
  appointmentError,
  type AvailabilitySlot,
  type DoctorDetail,
} from '../../features/appointments/appointment-api';
import { patientReportApi } from '../../features/patient-reports/patient-report-api';
import type { PatientReport } from '../../features/patient-reports/patient-report-types';
import { cn } from '../../lib/cn';

export function PatientDoctorDetailPage() {
  const { doctorId } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<DoctorDetail | null>(null);
  const [reports, setReports] = useState<PatientReport[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [reason, setReason] = useState('');
  const [selectedReports, setSelectedReports] = useState<string[]>([]);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState('');
  const bookingKeyRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!doctorId) return;
    Promise.all([appointmentApi.doctor(doctorId), patientReportApi.list({ collection: 'ACTIVE', page: 1, size: 20 })])
      .then(([doctor, reportPage]) => {
        if (!active) return;
        setDetail(doctor);
        setReports(reportPage.items);
      })
      .catch((requestError) => active && setError(appointmentError(requestError, 'We could not load this Doctor.')));
    return () => {
      active = false;
    };
  }, [doctorId]);

  useEffect(() => {
    bookingKeyRef.current = null;
  }, [selectedSlot?.id]);

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const dates = useMemo(() => groupSlots(detail?.availability ?? []), [detail]);

  if (!detail && !error)
    return (
      <div className="mx-auto max-w-[1080px]">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="mt-6 h-96 rounded-2xl" />
      </div>
    );
  if (error && !detail)
    return (
      <AppSurface variant="attention" className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold text-white">Doctor unavailable</h1>
        <p className="mt-2 text-sm text-[var(--clinora-text-muted)]">{error}</p>
      </AppSurface>
    );
  if (!detail) return null;
  const doctor = detail.doctor;

  const book = async () => {
    if (!selectedSlot) return;
    setBooking(true);
    setError('');
    try {
      const idempotencyKey = bookingKeyRef.current ?? crypto.randomUUID();
      bookingKeyRef.current = idempotencyKey;
      const appointment = await appointmentApi.book(
        { slotId: selectedSlot.id, reasonForVisit: reason.trim() || undefined, timezone, reportIds: selectedReports },
        idempotencyKey,
      );
      navigate(`/patient/appointments/${appointment.id}`, { replace: true });
    } catch (requestError) {
      setError(
        appointmentError(
          requestError,
          'We could not book this appointment. The selected time may no longer be available.',
        ),
      );
      if (doctorId)
        appointmentApi
          .doctor(doctorId)
          .then(setDetail)
          .catch(() => undefined);
    } finally {
      setBooking(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1080px] pb-8">
      <Link
        to="/patient/doctors"
        className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--clinora-text-muted)] hover:text-white"
      >
        <ArrowLeft size={15} />
        Back to Doctors
      </Link>
      <AppSurface as="section" variant="hero" className="mt-5">
        <div className="grid gap-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-[var(--clinora-info-soft)] text-lg font-bold text-[var(--clinora-info-foreground)]">
            {initials(doctor.displayName)}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white">{doctor.displayName}</h1>
              <StatusPill tone="success">
                <ShieldCheck size={12} />
                Clinora approved
              </StatusPill>
            </div>
            <p className="mt-2 text-base font-semibold text-[var(--clinora-info-foreground)]">
              {doctor.specialization}
            </p>
            <p className="mt-2 text-sm text-[var(--clinora-text-muted)]">
              {doctor.professionalTitle || 'Medical professional'}
              {doctor.yearsExperience != null ? ` · ${doctor.yearsExperience} years experience` : ''}
              {doctor.currentOrganization ? ` · ${doctor.currentOrganization}` : ''}
            </p>
          </div>
        </div>
        {doctor.registrationAuthority || doctor.registrationJurisdiction ? (
          <p className="mt-5 border-t border-[var(--clinora-border-subtle)] pt-4 text-xs leading-5 text-[var(--clinora-text-faint)]">
            Professional registration reviewed by Clinora
            {doctor.registrationAuthority ? ` · ${doctor.registrationAuthority}` : ''}
            {doctor.registrationJurisdiction ? ` · ${doctor.registrationJurisdiction}` : ''}. Private onboarding
            documents and registration numbers are not exposed here.
          </p>
        ) : null}
      </AppSurface>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <AppSurface as="section" aria-labelledby="choose-time-title">
            <AppSectionHeader
              eyebrow="Step 1"
              title="Choose an available time"
              titleId="choose-time-title"
              copy={`Times are shown in ${timezone}.`}
            />
            {!detail.availability.length ? (
              <EmptyState
                className="mt-6"
                icon={<CalendarDays size={18} />}
                title="No times published yet"
                copy="This Doctor does not currently have future availability. Check again later or choose another Doctor."
              />
            ) : (
              <div className="mt-6 space-y-5">
                {dates.map(([date, slots]) => (
                  <div key={date}>
                    <h3 className="text-sm font-semibold text-white">{date}</h3>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {slots.map((slot) => (
                        <button
                          key={slot.id}
                          type="button"
                          onClick={() => setSelectedSlot(slot)}
                          aria-pressed={selectedSlot?.id === slot.id}
                          className={cn(
                            'min-h-10 rounded-xl border px-4 text-sm font-semibold transition',
                            selectedSlot?.id === slot.id
                              ? 'border-[var(--clinora-border-interactive)] bg-[var(--clinora-info-soft)] text-[var(--clinora-info-foreground)]'
                              : 'border-[var(--clinora-border-subtle)] text-slate-300 hover:border-[var(--clinora-border-interactive)] hover:text-white',
                          )}
                        >
                          {formatTime(slot.startsAt)}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </AppSurface>

          <AppSurface as="section" aria-labelledby="visit-reason-title">
            <AppSectionHeader
              eyebrow="Step 2"
              title="Reason for appointment"
              titleId="visit-reason-title"
              copy="Briefly tell the Doctor what you would like to discuss. You can explain the details during your appointment."
            />
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value.slice(0, 500))}
              rows={4}
              placeholder="Optional short description"
              className="mt-5 w-full resize-y rounded-xl border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-nested)] p-4 text-sm leading-6 text-white outline-none placeholder:text-slate-600 focus:border-[var(--clinora-border-interactive)] focus:ring-4 focus:ring-[var(--clinora-focus-ring-soft)]"
            />
            <p className="mt-2 text-right text-xs text-[var(--clinora-text-faint)]">{reason.length}/500</p>
          </AppSurface>

          <AppSurface as="section" aria-labelledby="share-reports-title">
            <AppSectionHeader
              eyebrow="Step 3"
              title="Share medical reports"
              titleId="share-reports-title"
              copy="Nothing is shared by default. Choose only the reports you want this Doctor to access for this appointment."
            />
            {!reports.length ? (
              <EmptyState
                className="mt-6"
                icon={<FileText size={18} />}
                title="No active reports to share"
                copy="You can book without sharing a report, or add documents in Medical Reports first."
              />
            ) : (
              <ul className="mt-5 divide-y divide-[var(--clinora-border-subtle)] border-y border-[var(--clinora-border-subtle)]">
                {reports.map((report) => {
                  const selected = selectedReports.includes(report.id);
                  return (
                    <li key={report.id}>
                      <label className="flex cursor-pointer items-start gap-3 py-4">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() =>
                            setSelectedReports((current) =>
                              selected ? current.filter((id) => id !== report.id) : [...current, report.id],
                            )
                          }
                          className="mt-1 h-4 w-4 accent-cyan-400"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-white">{report.reportName}</span>
                          <span className="mt-1 block text-xs text-[var(--clinora-text-muted)]">
                            {report.reportDate ? formatDate(report.reportDate) : 'Date not provided'}
                            {report.providerLaboratory ? ` · ${report.providerLaboratory}` : ''}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-4 text-xs leading-5 text-[var(--clinora-text-faint)]">
              You can revoke appointment-scoped report access later. Cancelling the appointment revokes active shares
              automatically.
            </p>
          </AppSurface>
        </div>

        <AppSurface
          as="aside"
          variant="elevated"
          className="h-fit lg:sticky lg:top-6"
          aria-labelledby="booking-review-title"
        >
          <IconWell>
            <Stethoscope size={18} />
          </IconWell>
          <h2 id="booking-review-title" className="mt-4 text-xl font-semibold text-white">
            Review appointment
          </h2>
          <dl className="mt-5 divide-y divide-[var(--clinora-border-subtle)] border-y border-[var(--clinora-border-subtle)]">
            <Review label="Doctor" value={doctor.displayName} />
            <Review label="Specialty" value={doctor.specialization} />
            <Review label="Date & time" value={selectedSlot ? formatSlot(selectedSlot.startsAt) : 'Choose a time'} />
            <Review
              label="Reports shared"
              value={selectedReports.length ? `${selectedReports.length} selected` : 'None'}
            />
          </dl>
          {error ? (
            <p role="alert" className="mt-4 text-sm leading-6 text-rose-300">
              {error}
            </p>
          ) : null}
          <Button
            variant="appPrimary"
            className="mt-5 w-full"
            disabled={!selectedSlot || booking}
            onClick={() => void book()}
          >
            {booking ? (
              'Confirming…'
            ) : (
              <>
                <Check size={16} />
                Confirm appointment
              </>
            )}
          </Button>
          <p className="mt-3 text-xs leading-5 text-[var(--clinora-text-faint)]">
            We verify that the selected time is still available when you confirm.
          </p>
        </AppSurface>
      </div>
    </div>
  );
}

function Review({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-3">
      <dt className="text-xs text-[var(--clinora-text-faint)]">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-white">{value}</dd>
    </div>
  );
}
function groupSlots(slots: AvailabilitySlot[]) {
  const map = new Map<string, AvailabilitySlot[]>();
  for (const slot of slots) {
    const key = new Date(slot.startsAt).toLocaleDateString(undefined, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    map.set(key, [...(map.get(key) ?? []), slot]);
  }
  return [...map.entries()];
}
function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}
function formatTime(value: string) {
  return new Date(value).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
function formatSlot(value: string) {
  return new Date(value).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}
function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
