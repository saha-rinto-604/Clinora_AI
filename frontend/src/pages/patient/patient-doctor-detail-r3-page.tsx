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
import { StatusPill } from '../../components/app/app-ui';
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
import { PatientReportPicker } from '../../features/patient-reports/patient-report-picker-r3';
import { patientReportApi } from '../../features/patient-reports/patient-report-api';
import { patientReportDisplayName, type PatientReport } from '../../features/patient-reports/patient-report-types';
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
    if (!dateGroups.some((group) => group.key === selectedDateKey)) setSelectedDateKey(dateGroups[0].key);
  }, [dateGroups, selectedDateKey]);

  if (!detail && !error) {
    return (
      <div className="clinora-r3-patient mx-auto max-w-[1240px] pb-8" role="status" aria-label="Loading Doctor profile">
        <Skeleton className="h-32 rounded-[18px]" />
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
          <Skeleton className="h-[40rem] rounded-[18px]" />
          <Skeleton className="h-96 rounded-[18px]" />
        </div>
      </div>
    );
  }

  if (error && !detail) {
    return (
      <section className="clinora-r3-patient clinora-r3-panel mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-semibold text-white">Doctor unavailable</h1>
        <p className="mt-2 text-sm text-slate-500">{error}</p>
      </section>
    );
  }

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
          // Preserve the Patient's form state even if the availability refresh also fails.
        }
        setError(
          'That appointment time was just taken. Your reason and selected reports are still here — choose another available time.',
        );
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
    <div className="clinora-r3-patient mx-auto w-full max-w-[1240px] pb-8">
      <Link
        to="/patient/doctors"
        className="inline-flex min-h-9 items-center gap-2 text-xs font-semibold text-slate-500 transition hover:text-white"
      >
        <ArrowLeft size={14} aria-hidden="true" /> Back to Doctors
      </Link>

      <header className="clinora-r3-panel clinora-r3-panel--raised mt-3 overflow-hidden">
        <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center">
          <ProfileAvatar
            source={{ kind: 'patient-doctor', doctorId: doctor.id }}
            name={doctor.displayName}
            size="xl"
            className="rounded-[18px]"
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-[-0.04em] text-white sm:text-3xl">{doctor.displayName}</h1>
              <StatusPill tone="success">
                <ShieldCheck size={12} aria-hidden="true" /> Clinora verified
              </StatusPill>
            </div>
            <p className="mt-1.5 text-sm font-semibold text-cyan-200">{doctor.specialization}</p>
            <p className="mt-1.5 text-sm text-slate-500">
              {[professionalProfile?.displayTitle || doctor.professionalTitle, professionalProfile?.currentPosition]
                .filter(Boolean)
                .join(' · ')}
              {professionalProfile?.yearsExperience != null
                ? ` · ${professionalProfile.yearsExperience} years experience`
                : doctor.yearsExperience != null
                  ? ` · ${doctor.yearsExperience} years experience`
                  : ''}
            </p>
            {professionalProfile?.currentOrganization || doctor.currentOrganization ? (
              <p className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                <BriefcaseBusiness size={13} aria-hidden="true" />
                {professionalProfile?.currentOrganization || doctor.currentOrganization}
              </p>
            ) : null}
            {professionalProfile?.professionalBio ? (
              <p className="mt-3 line-clamp-2 max-w-3xl text-xs leading-5 text-slate-500">
                {professionalProfile.professionalBio}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2 lg:max-w-[13rem] lg:flex-col lg:items-end">
            {professionalProfile?.defaultConsultationMinutes ? (
              <span className="inline-flex items-center gap-1.5 rounded-[9px] border border-white/[0.065] bg-white/[0.02] px-2.5 py-1.5 text-[11px] font-medium text-slate-400">
                <Clock3 size={12} aria-hidden="true" /> {professionalProfile.defaultConsultationMinutes} min typical
                visit
              </span>
            ) : null}
            {safePublicUrl(professionalProfile?.professionalProfileUrl) ? (
              <a
                href={safePublicUrl(professionalProfile?.professionalProfileUrl) ?? undefined}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-cyan-200 hover:text-cyan-100"
              >
                Professional profile <ExternalLink size={12} aria-hidden="true" />
              </a>
            ) : null}
          </div>
        </div>
        <div className="border-t border-white/[0.055] px-5 py-3 text-[10px] leading-4 text-slate-700 sm:px-6">
          Clinora reviewed this Doctor's professional registration and onboarding evidence. Private credential
          identifiers and uploaded documents are never shown to Patients.
        </div>
      </header>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
        <main className="space-y-5">
          <section className="clinora-r3-panel overflow-hidden" aria-labelledby="choose-time-title">
            <div className="flex flex-col gap-3 border-b border-white/[0.055] px-5 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-6">
              <div>
                <p className="clinora-r3-kicker">Appointment time</p>
                <h2 id="choose-time-title" className="mt-1 text-xl font-semibold tracking-[-0.03em] text-white">
                  Choose a date and time
                </h2>
              </div>
              <p className="text-[11px] text-slate-600">Shown in {timezone.replaceAll('_', ' ')}</p>
            </div>

            {!dateGroups.length ? (
              <div className="px-5 py-10 text-center sm:px-6">
                <CalendarDays size={22} className="mx-auto text-slate-700" aria-hidden="true" />
                <p className="mt-3 text-sm font-semibold text-white">No appointments published yet</p>
                <p className="mx-auto mt-1.5 max-w-md text-xs leading-5 text-slate-600">
                  This Doctor does not currently have future availability. You can choose another Doctor or check again
                  later.
                </p>
              </div>
            ) : (
              <>
                <div
                  className="clinora-r3-date-strip overflow-x-auto border-b border-white/[0.055] px-4 py-3 sm:px-5"
                  aria-label="Available appointment dates"
                >
                  <div className="flex min-w-max gap-1.5">
                    {dateGroups.map((group) => {
                      const active = selectedGroup?.key === group.key;
                      return (
                        <button
                          key={group.key}
                          type="button"
                          onClick={() => chooseDate(group.key)}
                          aria-pressed={active}
                          className={cn(
                            'min-w-[6.25rem] rounded-[11px] border px-3 py-2.5 text-left transition',
                            active
                              ? 'border-cyan-300/[0.2] bg-cyan-300/[0.07] text-white'
                              : 'border-transparent bg-transparent text-slate-500 hover:border-white/[0.07] hover:bg-white/[0.025] hover:text-slate-300',
                          )}
                        >
                          <span className="block text-xs font-semibold">{group.shortLabel}</span>
                          <span className="mt-0.5 block text-[10px] text-slate-600">
                            {group.slots.length} available
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {selectedGroup ? (
                  <div className="p-5 sm:p-6">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-slate-200">{selectedGroup.label}</h3>
                      <span className="text-[10px] uppercase tracking-[0.1em] text-slate-700">Select one time</span>
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-3 xl:grid-cols-4">
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
                              'rounded-[11px] border px-3.5 py-3 text-left transition',
                              active
                                ? 'border-cyan-300/[0.26] bg-cyan-300/[0.08] shadow-[inset_0_0_0_1px_rgba(103,232,249,.035)]'
                                : 'border-white/[0.065] bg-white/[0.018] hover:border-cyan-300/[0.14] hover:bg-white/[0.03]',
                            )}
                          >
                            <span
                              className={cn('block text-sm font-semibold', active ? 'text-cyan-100' : 'text-slate-200')}
                            >
                              {formatTime(slot.startsAt, timezone)}
                            </span>
                            <span className="mt-1 block text-[10px] text-slate-600">
                              {duration} min · until {formatTime(slot.endsAt, timezone)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </section>

          <section className="clinora-r3-panel p-5 sm:p-6" aria-labelledby="appointment-context-title">
            <div>
              <p className="clinora-r3-kicker">Optional context</p>
              <h2 id="appointment-context-title" className="mt-1 text-lg font-semibold tracking-[-0.025em] text-white">
                Help the Doctor prepare
              </h2>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                Add a short visit note and share only the reports relevant to this appointment.
              </p>
            </div>

            <label className="mt-5 block text-xs font-semibold text-slate-300">
              Reason for visit <span className="font-normal text-slate-700">(optional)</span>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value.slice(0, 500))}
                rows={3}
                placeholder="For example: recurring headaches and recent blood-test results"
                className="mt-2 w-full resize-y rounded-[11px] border border-white/[0.07] bg-white/[0.02] p-3.5 text-sm leading-6 text-white outline-none placeholder:text-slate-700 focus:border-cyan-300/[0.24] focus:ring-4 focus:ring-cyan-300/[0.04]"
              />
              <span className="mt-1.5 block text-right text-[10px] font-normal text-slate-700">
                {reason.length}/500
              </span>
            </label>

            <div className="mt-4 border-t border-white/[0.055] pt-1">
              <PatientReportPicker selectedReports={selectedReports} onChange={setSelectedReports} disabled={booking} />
            </div>
            <p className="mt-3 flex items-start gap-2 text-[10px] leading-5 text-slate-700">
              <ShieldCheck size={12} className="mt-0.5 shrink-0 text-cyan-300" aria-hidden="true" />
              Report access is appointment-scoped. You can revoke it later, and cancelling the appointment revokes
              active shares automatically.
            </p>
          </section>
        </main>

        <aside className="h-fit lg:sticky lg:top-6" aria-labelledby="booking-review-title">
          <div className="clinora-r3-panel clinora-r3-panel--raised overflow-hidden">
            <div className="border-b border-white/[0.055] p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <ProfileAvatar
                  source={{ kind: 'patient-doctor', doctorId: doctor.id }}
                  name={doctor.displayName}
                  size="sm"
                  className="rounded-[10px]"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{doctor.displayName}</p>
                  <p className="mt-0.5 truncate text-[11px] text-cyan-200">{doctor.specialization}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <Stethoscope size={14} className="text-slate-500" aria-hidden="true" />
                <h2 id="booking-review-title" className="text-sm font-semibold text-white">
                  Appointment summary
                </h2>
              </div>
            </div>

            <dl className="divide-y divide-white/[0.055] px-4 sm:px-5">
              <Review
                label="Date & time"
                value={selectedSlot ? formatSlot(selectedSlot.startsAt, timezone) : 'Choose a time'}
                strong={Boolean(selectedSlot)}
              />
              <Review
                label="Duration"
                value={
                  selectedSlot
                    ? `${durationMinutes(selectedSlot)} minutes`
                    : consultationMinutes
                      ? `${consultationMinutes} minutes typical`
                      : 'Shown after time selection'
                }
              />
              <Review label="Visit note" value={reason.trim() || 'No note added'} muted={!reason.trim()} />
              <Review
                label="Reports"
                value={selectedReports.length ? `${selectedReports.length} selected` : 'None shared'}
                muted={!selectedReports.length}
              />
            </dl>

            {selectedReports.length ? (
              <div className="border-t border-white/[0.055] px-4 py-3 sm:px-5">
                <ul className="space-y-1.5">
                  {selectedReports.slice(0, 2).map((report) => (
                    <li key={report.id} className="flex min-w-0 items-center gap-2 text-[10px] text-slate-500">
                      <FileText size={11} className="shrink-0 text-cyan-300" aria-hidden="true" />
                      <span className="truncate">{patientReportDisplayName(report)}</span>
                    </li>
                  ))}
                  {selectedReports.length > 2 ? (
                    <li className="text-[10px] text-slate-700">+{selectedReports.length - 2} more</li>
                  ) : null}
                </ul>
              </div>
            ) : null}

            {error ? (
              <div
                role="alert"
                className="mx-4 mt-4 rounded-[10px] border border-rose-300/[0.12] bg-rose-300/[0.04] p-3 text-xs leading-5 text-rose-200 sm:mx-5"
              >
                {error}
              </div>
            ) : null}

            <div className="p-4 sm:p-5">
              <Button
                variant="appPrimary"
                className="w-full"
                disabled={!selectedSlot || booking}
                onClick={() => void book()}
              >
                {booking ? (
                  'Confirming…'
                ) : (
                  <>
                    <Check size={15} aria-hidden="true" /> Confirm appointment
                  </>
                )}
              </Button>
              <p className="mt-2.5 text-[10px] leading-4 text-slate-700">
                Clinora verifies the selected time again at confirmation. Your note and report choices stay here if that
                time is taken first.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Review({
  label,
  value,
  muted = false,
  strong = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="py-3.5">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-700">{label}</dt>
      <dd
        className={cn(
          'mt-1.5 text-xs',
          strong ? 'font-semibold text-white' : muted ? 'text-slate-700' : 'text-slate-400',
        )}
      >
        {value}
      </dd>
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
  return new Date(value).toLocaleTimeString(undefined, { timeZone: timezone, hour: 'numeric', minute: '2-digit' });
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
