import {
  ArrowLeft,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  Clock3,
  ExternalLink,
  FileText,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { AppSectionHeader, AppSurface, EmptyState, IconWell, StatusPill } from '../../components/app/app-ui';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/feedback';
import {
  appointmentApi,
  appointmentError,
  appointmentErrorCode,
  type AvailabilitySlot,
  type DoctorDetail,
} from '../../features/appointments/appointment-api';
import { patientFacingDoctorProfile, type PatientFacingDoctorProfile } from '../../features/doctor/doctor-profile-api';
import { patientReportApi } from '../../features/patient-reports/patient-report-api';
import { PatientReportPicker } from '../../features/patient-reports/patient-report-picker';
import {
  patientReportDisplayName,
  patientReportSecondaryContext,
  type PatientReport,
} from '../../features/patient-reports/patient-report-types';
import { ProfileAvatar } from '../../features/profile/profile-image';
import { cn } from '../../lib/cn';

export function PatientDoctorDetailPage() {
  const { doctorId } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<DoctorDetail | null>(null);
  const [professionalProfile, setProfessionalProfile] = useState<PatientFacingDoctorProfile | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [selectedDateKey, setSelectedDateKey] = useState('');
  const [reason, setReason] = useState('');
  const [selectedReports, setSelectedReports] = useState<PatientReport[]>([]);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState('');
  const bookingKeyRef = useRef<string | null>(null);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  useEffect(() => {
    let active = true;
    if (!doctorId) return;
    Promise.all([appointmentApi.doctor(doctorId), patientFacingDoctorProfile(doctorId).catch(() => null)])
      .then(([doctor, profile]) => {
        if (!active) return;
        setDetail(doctor);
        setProfessionalProfile(profile);
      })
      .catch((requestError) => active && setError(appointmentError(requestError, 'We could not load this Doctor.')));
    return () => {
      active = false;
    };
  }, [doctorId]);

  useEffect(() => {
    bookingKeyRef.current = null;
  }, [selectedSlot?.id]);

  const validAvailability = useMemo(
    () => (detail?.availability ?? []).filter((slot) => durationMinutes(slot) > 0),
    [detail],
  );
  const dateGroups = useMemo(() => groupSlots(validAvailability, timezone), [validAvailability, timezone]);
  const selectedGroup = dateGroups.find((group) => group.key === selectedDateKey) ?? dateGroups[0] ?? null;

  useEffect(() => {
    if (!dateGroups.length) {
      setSelectedDateKey('');
      setSelectedSlot(null);
      return;
    }
    if (!dateGroups.some((group) => group.key === selectedDateKey)) {
      setSelectedDateKey(dateGroups[0].key);
    }
  }, [dateGroups, selectedDateKey]);

  if (!detail && !error)
    return (
      <div className="mx-auto max-w-[1160px]" role="status" aria-label="Loading Doctor profile">
        <Skeleton className="h-52 rounded-[28px]" />
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_23rem]">
          <Skeleton className="h-[42rem] rounded-[28px]" />
          <Skeleton className="h-96 rounded-[28px]" />
        </div>
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
  const consultationMinutes =
    professionalProfile?.defaultConsultationMinutes ?? (selectedSlot ? durationMinutes(selectedSlot) : null);

  const chooseDate = (key: string) => {
    setSelectedDateKey(key);
    if (selectedSlot && localDateKey(selectedSlot.startsAt, timezone) !== key) setSelectedSlot(null);
    setError('');
  };

  const chooseSlot = (slot: AvailabilitySlot) => {
    setSelectedSlot(slot);
    setSelectedDateKey(localDateKey(slot.startsAt, timezone));
    setError('');
  };

  const book = async () => {
    if (!selectedSlot) return;
    setBooking(true);
    setError('');
    try {
      const idempotencyKey = bookingKeyRef.current ?? crypto.randomUUID();
      bookingKeyRef.current = idempotencyKey;
      const appointment = await appointmentApi.book(
        {
          slotId: selectedSlot.id,
          reasonForVisit: reason.trim() || undefined,
          timezone,
          reportIds: selectedReports.map((report) => report.id),
        },
        idempotencyKey,
      );
      navigate(`/patient/appointments/${appointment.id}`, { replace: true });
    } catch (requestError) {
      const code = appointmentErrorCode(requestError);
      if (code === 'REPORT_NOT_SHAREABLE') {
        const refreshedReports = await Promise.all(
          selectedReports.map(async (report) => {
            try {
              const refreshed = await patientReportApi.detail(report.id);
              return refreshed.archived ? null : refreshed;
            } catch {
              return report;
            }
          }),
        );
        const activeReports = refreshedReports.filter((report): report is PatientReport => report !== null);
        if (activeReports.length !== selectedReports.length) setSelectedReports(activeReports);
        setError(
          activeReports.length !== selectedReports.length
            ? 'A selected report is no longer active, so Clinora removed it from this booking. Your time and note are unchanged — review the remaining reports and confirm again.'
            : 'One of the selected reports can no longer be shared. Your time, note, and report choices are still here — review the report selection and try again.',
        );
      } else if (code === 'APPOINTMENT_SLOT_UNAVAILABLE' && doctorId) {
        try {
          const refreshed = await appointmentApi.doctor(doctorId);
          setDetail(refreshed);
          const replacement = refreshed.availability.find((slot) => slot.id === selectedSlot.id) ?? null;
          setSelectedSlot(replacement);
          if (!replacement) bookingKeyRef.current = null;
        } catch {
          // Keep the user's current form state even if the availability refresh also fails.
        }
        setError('That appointment time was just taken. Your reason and selected reports are still here — choose another available time.');
      } else {
        setError(
          appointmentError(
            requestError,
            'We could not confirm the appointment. Your selections are still here, so you can safely try again.',
          ),
        );
      }
    } finally {
      setBooking(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1160px] pb-8">
      <Link
        to="/patient/doctors"
        className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-[var(--clinora-text-muted)] transition hover:text-white"
      >
        <ArrowLeft size={15} aria-hidden="true" />
        Back to Doctors
      </Link>

      <AppSurface as="section" variant="hero" className="mt-4 overflow-hidden">
        <div className="grid gap-6 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center">
          <ProfileAvatar
            source={{ kind: 'patient-doctor', doctorId: doctor.id }}
            name={doctor.displayName}
            size="xl"
            className="rounded-[24px]"
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">{doctor.displayName}</h1>
              <StatusPill tone="success">
                <ShieldCheck size={12} aria-hidden="true" />
                Clinora verified
              </StatusPill>
            </div>
            <p className="mt-2 text-base font-semibold text-[var(--clinora-info-foreground)]">{doctor.specialization}</p>
            <p className="mt-2 text-sm leading-6 text-[var(--clinora-text-muted)]">
              <span>{professionalProfile?.displayTitle || doctor.professionalTitle || 'Medical professional'}</span>
              {professionalProfile?.yearsExperience != null
                ? ` · ${professionalProfile.yearsExperience} years experience`
                : doctor.yearsExperience != null
                  ? ` · ${doctor.yearsExperience} years experience`
                  : ''}
            </p>
            {professionalProfile?.currentPosition || professionalProfile?.currentOrganization || doctor.currentOrganization ? (
              <p className="mt-2 flex items-start gap-2 text-sm text-[var(--clinora-text-muted)]">
                <BriefcaseBusiness
                  size={15}
                  className="mt-0.5 shrink-0 text-[var(--clinora-info-foreground)]"
                  aria-hidden="true"
                />
                {[professionalProfile?.currentPosition, professionalProfile?.currentOrganization || doctor.currentOrganization]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            ) : null}
            {professionalProfile?.professionalBio ? (
              <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300">{professionalProfile.professionalBio}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2 lg:max-w-52 lg:flex-col lg:items-end">
            {professionalProfile?.defaultConsultationMinutes ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1.5 text-xs font-medium text-slate-300">
                <Clock3 size={13} aria-hidden="true" /> {professionalProfile.defaultConsultationMinutes} min consultation
              </span>
            ) : null}
            {safePublicUrl(professionalProfile?.professionalProfileUrl) ? (
              <a
                href={safePublicUrl(professionalProfile?.professionalProfileUrl) ?? undefined}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--clinora-info-foreground)] hover:underline"
              >
                Professional profile <ExternalLink size={13} aria-hidden="true" />
              </a>
            ) : null}
          </div>
        </div>
        <p className="mt-5 border-t border-[var(--clinora-border-subtle)] pt-4 text-xs leading-5 text-[var(--clinora-text-faint)]">
          Clinora reviewed this Doctor's professional registration and onboarding evidence. Private credential identifiers and uploaded documents are never shown to Patients.
        </p>
      </AppSurface>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="space-y-6">
          <AppSurface as="section" aria-labelledby="choose-time-title">
            <AppSectionHeader
              eyebrow="Step 1"
              title="Choose a date and time"
              titleId="choose-time-title"
              copy={`Times are shown in your timezone: ${timezone}.`}
            />

            {!dateGroups.length ? (
              <EmptyState
                className="mt-6"
                icon={<CalendarDays size={18} />}
                title="No appointments published yet"
                copy="This Doctor does not currently have future availability. You can go back and choose another Doctor or check again later."
              />
            ) : (
              <>
                <div className="mt-6 overflow-x-auto pb-2" aria-label="Available appointment dates">
                  <div className="flex min-w-max gap-2">
                    {dateGroups.map((group) => {
                      const active = selectedGroup?.key === group.key;
                      return (
                        <button
                          key={group.key}
                          type="button"
                          onClick={() => chooseDate(group.key)}
                          aria-pressed={active}
                          className={cn(
                            'min-w-28 rounded-2xl border px-4 py-3 text-left transition',
                            active
                              ? 'border-cyan-300/30 bg-cyan-300/[0.075] shadow-[0_12px_30px_rgba(34,211,238,.06)]'
                              : 'border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-nested)] hover:border-white/[0.14]',
                          )}
                        >
                          <span className={cn('block text-xs font-semibold', active ? 'text-cyan-100' : 'text-slate-300')}>
                            {group.shortLabel}
                          </span>
                          <span className="mt-1 block text-[11px] text-[var(--clinora-text-faint)]">
                            {group.slots.length} time{group.slots.length === 1 ? '' : 's'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {selectedGroup ? (
                  <div className="mt-4 rounded-2xl border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-nested)] p-4 sm:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-white">{selectedGroup.label}</h3>
                      <span className="text-xs text-[var(--clinora-text-faint)]">Select one appointment time</span>
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {selectedGroup.slots.map((slot) => {
                        const active = selectedSlot?.id === slot.id;
                        const duration = durationMinutes(slot);
                        return (
                          <button
                            key={slot.id}
                            type="button"
                            onClick={() => chooseSlot(slot)}
                            aria-pressed={active}
                            className={cn(
                              'rounded-xl border px-4 py-3 text-left transition',
                              active
                                ? 'border-[var(--clinora-border-interactive)] bg-[var(--clinora-info-soft)] text-white ring-1 ring-cyan-300/10'
                                : 'border-white/[0.07] bg-white/[0.02] text-slate-300 hover:border-[var(--clinora-border-interactive)] hover:bg-white/[0.035] hover:text-white',
                            )}
                          >
                            <span className="block text-sm font-semibold">{formatTime(slot.startsAt, timezone)}</span>
                            <span className="mt-1 block text-[11px] text-[var(--clinora-text-faint)]">
                              {duration} min · ends {formatTime(slot.endsAt, timezone)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </AppSurface>

          <AppSurface as="section" aria-labelledby="visit-reason-title">
            <AppSectionHeader
              eyebrow="Step 2"
              title="What would you like to discuss?"
              titleId="visit-reason-title"
              copy="A short note helps the Doctor prepare. This is optional and you can explain the full details during the appointment."
            />
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value.slice(0, 500))}
              rows={4}
              placeholder="For example: recurring headaches and recent blood-test results"
              className="mt-5 w-full resize-y rounded-xl border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-nested)] p-4 text-sm leading-6 text-white outline-none placeholder:text-slate-600 focus:border-[var(--clinora-border-interactive)] focus:ring-4 focus:ring-[var(--clinora-focus-ring-soft)]"
            />
            <div className="mt-2 flex items-center justify-between gap-3 text-xs text-[var(--clinora-text-faint)]">
              <span>Only the Doctor for this appointment will see this note in the appointment workspace.</span>
              <span className="shrink-0">{reason.length}/500</span>
            </div>
          </AppSurface>

          <AppSurface as="section" aria-labelledby="share-reports-title">
            <AppSectionHeader
              eyebrow="Step 3"
              title="Share relevant medical reports"
              titleId="share-reports-title"
              copy="Reports are optional. Choose only the documents you want this Doctor to access for this appointment."
            />
            <PatientReportPicker
              selectedReports={selectedReports}
              onChange={setSelectedReports}
              disabled={booking}
            />
            <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-[var(--clinora-text-faint)]">
              <ShieldCheck size={14} className="mt-0.5 shrink-0 text-[var(--clinora-info-foreground)]" aria-hidden="true" />
              You can revoke appointment-scoped report access later. Cancelling the appointment revokes active shares automatically.
            </p>
          </AppSurface>
        </div>

        <AppSurface
          as="aside"
          variant="elevated"
          className="h-fit lg:sticky lg:top-6"
          aria-labelledby="booking-review-title"
        >
          <div className="flex items-center gap-3">
            <ProfileAvatar
              source={{ kind: 'patient-doctor', doctorId: doctor.id }}
              name={doctor.displayName}
              size="md"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{doctor.displayName}</p>
              <p className="truncate text-xs text-[var(--clinora-info-foreground)]">{doctor.specialization}</p>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-2">
            <IconWell>
              <Stethoscope size={17} aria-hidden="true" />
            </IconWell>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--clinora-text-faint)]">Booking review</p>
              <h2 id="booking-review-title" className="text-lg font-semibold text-white">Your appointment</h2>
            </div>
          </div>

          <dl className="mt-5 divide-y divide-[var(--clinora-border-subtle)] border-y border-[var(--clinora-border-subtle)]">
            <Review
              label="Date & time"
              value={selectedSlot ? formatSlot(selectedSlot.startsAt, timezone) : 'Choose an appointment time'}
            />
            <Review
              label="Duration"
              value={selectedSlot ? `${durationMinutes(selectedSlot)} minutes` : consultationMinutes ? `${consultationMinutes} minutes` : 'Shown after you choose a time'}
            />
            <Review label="Timezone" value={timezone} />
            <Review label="Reason" value={reason.trim() || 'No note added'} muted={!reason.trim()} />
          </dl>

          <div className="mt-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold text-white">Reports</p>
              <span className="text-[11px] text-[var(--clinora-text-faint)]">{selectedReports.length} selected</span>
            </div>
            {selectedReports.length ? (
              <ul className="mt-2 grid gap-2">
                {selectedReports.slice(0, 3).map((report) => {
                  const secondary = patientReportSecondaryContext(report);
                  return (
                    <li key={report.id} className="flex items-start gap-2 rounded-lg bg-white/[0.025] px-2.5 py-2 text-xs text-slate-300">
                      <FileText
                        size={13}
                        className="mt-0.5 shrink-0 text-[var(--clinora-info-foreground)]"
                        aria-hidden="true"
                      />
                      <span className="min-w-0">
                        <span className="block truncate">{patientReportDisplayName(report)}</span>
                        {secondary.length ? (
                          <span className="mt-0.5 block truncate text-[10px] text-[var(--clinora-text-faint)]">
                            {secondary.join(' · ')}
                          </span>
                        ) : null}
                      </span>
                    </li>
                  );
                })}
                {selectedReports.length > 3 ? (
                  <li className="px-1 text-[11px] text-[var(--clinora-text-faint)]">+{selectedReports.length - 3} more</li>
                ) : null}
              </ul>
            ) : (
              <p className="mt-2 text-xs leading-5 text-[var(--clinora-text-faint)]">No reports selected. You can still book normally.</p>
            )}
          </div>

          {error ? (
            <p role="alert" className="mt-5 rounded-xl border border-rose-300/15 bg-rose-300/[0.05] p-3 text-sm leading-6 text-rose-200">
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
                <Check size={16} aria-hidden="true" /> Confirm appointment
              </>
            )}
          </Button>
          <p className="mt-3 text-xs leading-5 text-[var(--clinora-text-faint)]">
            Clinora verifies the selected time again when you confirm. If another Patient takes it first, your note and report selections stay here.
          </p>
        </AppSurface>
      </div>
    </div>
  );
}

function Review({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="py-3">
      <dt className="text-xs text-[var(--clinora-text-faint)]">{label}</dt>
      <dd className={cn('mt-1 text-sm font-semibold', muted ? 'text-slate-500' : 'text-white')}>{value}</dd>
    </div>
  );
}

type SlotGroup = {
  key: string;
  label: string;
  shortLabel: string;
  slots: AvailabilitySlot[];
};

function groupSlots(slots: AvailabilitySlot[], timezone: string): SlotGroup[] {
  const map = new Map<string, AvailabilitySlot[]>();
  for (const slot of slots) {
    const key = localDateKey(slot.startsAt, timezone);
    map.set(key, [...(map.get(key) ?? []), slot]);
  }
  return [...map.entries()].map(([key, group]) => {
    const date = new Date(group[0].startsAt);
    return {
      key,
      label: date.toLocaleDateString(undefined, {
        timeZone: timezone,
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      shortLabel: date.toLocaleDateString(undefined, {
        timeZone: timezone,
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      }),
      slots: group,
    };
  });
}

function localDateKey(value: string, timezone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(new Date(value));
  const year = parts.find((part) => part.type === 'year')?.value ?? '0000';
  const month = parts.find((part) => part.type === 'month')?.value ?? '00';
  const day = parts.find((part) => part.type === 'day')?.value ?? '00';
  return `${year}-${month}-${day}`;
}

function durationMinutes(slot: AvailabilitySlot) {
  const minutes = Math.round((new Date(slot.endsAt).getTime() - new Date(slot.startsAt).getTime()) / 60_000);
  return Math.max(0, minutes);
}

function formatTime(value: string, timezone: string) {
  return new Date(value).toLocaleTimeString(undefined, {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatSlot(value: string, timezone: string) {
  return new Date(value).toLocaleString(undefined, {
    timeZone: timezone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function safePublicUrl(value?: string | null) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}
