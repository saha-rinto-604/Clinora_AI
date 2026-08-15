import { CalendarClock, CheckCircle2, LoaderCircle, RotateCcw, UserX, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../components/ui/dialog';
import { FormField, Input, Label, Select, Textarea } from '../../components/ui/form';
import type { ApplicationStatus } from '../access-applications/application-types';
import type {
  DoctorInterview,
  DoctorInterviewScheduleInput,
  InterviewMeetingProvider,
} from '../access-applications/doctor-interview-types';
import { adminAccessReviewApi, reviewErrorMessage } from './admin-access-review-api';

const providers: InterviewMeetingProvider[] = ['GOOGLE_MEET', 'ZOOM', 'OTHER'];

export function DoctorInterviewAdminPanel({
  applicationId,
  applicationStatus,
  onChanged,
}: {
  applicationId: string;
  applicationStatus: ApplicationStatus;
  onChanged: () => Promise<void>;
}) {
  const [interview, setInterview] = useState<DoctorInterview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [rescheduleMode, setRescheduleMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'cancel' | 'complete' | 'no-show' | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const loadInterview = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setInterview(await adminAccessReviewApi.interview(applicationId));
    } catch (caught) {
      setError(reviewErrorMessage(caught, 'Doctor interview details could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    void loadInterview();
  }, [loadInterview]);

  async function refresh(messageText: string) {
    setMessage(messageText);
    await Promise.all([loadInterview(), onChanged()]);
  }

  async function requireInterview() {
    setSaving(true);
    setError('');
    try {
      await adminAccessReviewApi.requireInterview(applicationId);
      await refresh('Mandatory Doctor interview is now required.');
    } catch (caught) {
      setError(reviewErrorMessage(caught, 'Interview requirement could not be recorded.'));
    } finally {
      setSaving(false);
    }
  }

  async function saveSchedule(input: DoctorInterviewScheduleInput) {
    setSaving(true);
    setError('');
    try {
      if (rescheduleMode) {
        await adminAccessReviewApi.rescheduleInterview(applicationId, input);
        await refresh('Doctor interview rescheduled.');
      } else {
        await adminAccessReviewApi.scheduleInterview(applicationId, input);
        await refresh('Doctor interview scheduled.');
      }
      setScheduleOpen(false);
    } catch (caught) {
      setError(
        reviewErrorMessage(
          caught,
          rescheduleMode ? 'Interview could not be rescheduled.' : 'Interview could not be scheduled.',
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  async function runConfirmedAction() {
    if (!confirmAction) return;
    setSaving(true);
    setError('');
    try {
      if (confirmAction === 'cancel') {
        await adminAccessReviewApi.cancelInterview(applicationId, cancelReason);
        await refresh('Doctor interview cancelled.');
      } else if (confirmAction === 'complete') {
        await adminAccessReviewApi.completeInterview(applicationId);
        await refresh('Doctor interview completed.');
      } else {
        await adminAccessReviewApi.markInterviewNoShow(applicationId);
        await refresh('Doctor interview marked as no-show.');
      }
      setConfirmAction(null);
      setCancelReason('');
    } catch (caught) {
      setError(reviewErrorMessage(caught, 'Interview action could not be completed.'));
    } finally {
      setSaving(false);
    }
  }

  const canRequire = applicationStatus === 'UNDER_REVIEW';
  const canSchedule = applicationStatus === 'INTERVIEW_REQUIRED';
  const canManage = applicationStatus === 'INTERVIEW_SCHEDULED' && Boolean(interview);

  return (
    <section className="grid gap-4 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.035] p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-300">Doctor only</p>
          <h3 className="mt-1 text-lg font-semibold text-white">Mandatory Onboarding Interview</h3>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
            Schedule and manage the Doctor onboarding interview. Meeting details are private to System Admin and this
            Doctor applicant.
          </p>
        </div>
        {interview ? <Badge variant="info">{label(interview.status)}</Badge> : null}
      </div>

      {loading ? (
        <p className="inline-flex items-center gap-2 text-sm text-slate-400" role="status">
          <LoaderCircle size={15} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> Loading
          interview…
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-rose-300/20 bg-rose-300/[0.08] p-3 text-sm text-rose-100" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p
          className="rounded-xl border border-emerald-300/20 bg-emerald-300/[0.08] p-3 text-sm text-emerald-100"
          role="status"
        >
          {message}
        </p>
      ) : null}

      {interview?.scheduledStartUtc ? (
        <dl className="grid gap-3 rounded-xl border border-white/10 bg-slate-950/35 p-4 sm:grid-cols-2">
          <Info label="Date & time" value={formatInterviewTime(interview)} />
          <Info label="Timezone" value={interview.timezone} />
          <Info label="Duration" value={interview.durationMinutes ? `${interview.durationMinutes} minutes` : null} />
          <Info label="Provider" value={interview.meetingProvider ? label(interview.meetingProvider) : null} />
          <Info label="Meeting URL" value={interview.meetingUrl} privateValue />
          <Info label="Instructions" value={interview.instructions} />
          {interview.rescheduleRequestMessage ? (
            <div className="sm:col-span-2 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-3">
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-200">
                Applicant reschedule request
              </dt>
              <dd className="mt-1 text-sm leading-6 text-slate-200">{interview.rescheduleRequestMessage}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {canRequire ? (
          <Button onClick={() => void requireInterview()} disabled={saving}>
            <CalendarClock size={16} aria-hidden="true" /> Require Interview
          </Button>
        ) : null}
        {canSchedule ? (
          <Button
            onClick={() => {
              setRescheduleMode(false);
              setScheduleOpen(true);
            }}
          >
            <CalendarClock size={16} aria-hidden="true" /> Schedule Interview
          </Button>
        ) : null}
        {canManage ? (
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setRescheduleMode(true);
                setScheduleOpen(true);
              }}
            >
              <RotateCcw size={16} aria-hidden="true" /> Reschedule
            </Button>
            <Button variant="secondary" onClick={() => setConfirmAction('complete')}>
              <CheckCircle2 size={16} aria-hidden="true" /> Mark Completed
            </Button>
            <Button variant="secondary" onClick={() => setConfirmAction('no-show')}>
              <UserX size={16} aria-hidden="true" /> Mark No Show
            </Button>
            <Button variant="danger" onClick={() => setConfirmAction('cancel')}>
              <XCircle size={16} aria-hidden="true" /> Cancel Interview
            </Button>
          </>
        ) : null}
      </div>

      {applicationStatus === 'INTERVIEW_COMPLETED' ? (
        <p className="text-sm leading-6 text-slate-300">
          Interview completed. Final approval/rejection and account activation are intentionally deferred to a later
          Phase 4D batch.
        </p>
      ) : null}

      <ScheduleDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        mode={rescheduleMode ? 'reschedule' : 'schedule'}
        interview={interview}
        saving={saving}
        onSubmit={saveSchedule}
      />

      <Dialog open={Boolean(confirmAction)} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <DialogContent>
          <DialogTitle>{confirmTitle(confirmAction)}</DialogTitle>
          <DialogDescription className="text-sm leading-6 text-slate-400">
            {confirmDescription(confirmAction)}
          </DialogDescription>
          {confirmAction === 'cancel' ? (
            <FormField>
              <Label htmlFor="interview-cancel-reason">Applicant-safe cancellation reason (optional)</Label>
              <Textarea
                id="interview-cancel-reason"
                maxLength={500}
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
              />
            </FormField>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmAction(null)}>
              Back
            </Button>
            <Button
              variant={confirmAction === 'cancel' ? 'danger' : 'primary'}
              disabled={saving}
              onClick={() => void runConfirmedAction()}
            >
              {saving ? (
                <LoaderCircle size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
              ) : null}
              Confirm
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function ScheduleDialog({
  open,
  onOpenChange,
  mode,
  interview,
  saving,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'schedule' | 'reschedule';
  interview: DoctorInterview | null;
  saving: boolean;
  onSubmit: (input: DoctorInterviewScheduleInput) => Promise<void>;
}) {
  const [scheduledLocalDateTime, setScheduledLocalDateTime] = useState('');
  const [timezone, setTimezone] = useState(interview?.timezone || browserTimezone());
  const [durationMinutes, setDurationMinutes] = useState(interview?.durationMinutes ?? 30);
  const [meetingProvider, setMeetingProvider] = useState<InterviewMeetingProvider>(
    interview?.meetingProvider ?? 'GOOGLE_MEET',
  );
  const [meetingUrl, setMeetingUrl] = useState(interview?.meetingUrl ?? '');
  const [instructions, setInstructions] = useState(interview?.instructions ?? '');
  const [validation, setValidation] = useState('');

  useEffect(() => {
    if (!open) return;
    setScheduledLocalDateTime('');
    setTimezone(interview?.timezone || browserTimezone());
    setDurationMinutes(interview?.durationMinutes ?? 30);
    setMeetingProvider(interview?.meetingProvider ?? 'GOOGLE_MEET');
    setMeetingUrl(interview?.meetingUrl ?? '');
    setInstructions(interview?.instructions ?? '');
    setValidation('');
  }, [interview, open]);

  async function submit() {
    if (!scheduledLocalDateTime || !timezone.trim() || !meetingUrl.trim()) {
      setValidation('Date/time, timezone, and private HTTPS meeting URL are required.');
      return;
    }
    if (!meetingUrl.trim().toLowerCase().startsWith('https://')) {
      setValidation('Meeting URL must use HTTPS.');
      return;
    }
    if (durationMinutes < 15 || durationMinutes > 180) {
      setValidation('Duration must be between 15 and 180 minutes.');
      return;
    }
    setValidation('');
    await onSubmit({
      scheduledLocalDateTime,
      timezone: timezone.trim(),
      durationMinutes,
      meetingProvider,
      meetingUrl: meetingUrl.trim(),
      instructions: instructions.trim() || undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{mode === 'reschedule' ? 'Reschedule Doctor Interview' : 'Schedule Doctor Interview'}</DialogTitle>
        <DialogDescription className="text-sm leading-6 text-slate-400">
          Enter the applicant&apos;s local interview time and an explicit IANA timezone. The backend stores the
          authoritative start instant in UTC.
        </DialogDescription>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField>
            <Label htmlFor="interview-date-time">Local date & time</Label>
            <Input
              id="interview-date-time"
              type="datetime-local"
              value={scheduledLocalDateTime}
              onChange={(event) => setScheduledLocalDateTime(event.target.value)}
            />
          </FormField>
          <FormField>
            <Label htmlFor="interview-timezone">IANA timezone</Label>
            <Input
              id="interview-timezone"
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
              placeholder="Asia/Dhaka"
            />
          </FormField>
          <FormField>
            <Label htmlFor="interview-duration">Duration (minutes)</Label>
            <Input
              id="interview-duration"
              type="number"
              min={15}
              max={180}
              value={durationMinutes}
              onChange={(event) => setDurationMinutes(Number(event.target.value))}
            />
          </FormField>
          <FormField>
            <Label htmlFor="interview-provider">Meeting provider</Label>
            <Select
              id="interview-provider"
              value={meetingProvider}
              onChange={(event) => setMeetingProvider(event.target.value as InterviewMeetingProvider)}
            >
              {providers.map((provider) => (
                <option key={provider} value={provider}>
                  {label(provider)}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField className="sm:col-span-2">
            <Label htmlFor="interview-url">Private meeting URL</Label>
            <Input
              id="interview-url"
              type="url"
              value={meetingUrl}
              onChange={(event) => setMeetingUrl(event.target.value)}
              placeholder="https://meet.google.com/..."
            />
          </FormField>
          <FormField className="sm:col-span-2">
            <Label htmlFor="interview-instructions">Applicant instructions</Label>
            <Textarea
              id="interview-instructions"
              maxLength={2000}
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
            />
          </FormField>
        </div>
        {validation ? (
          <p className="text-sm text-rose-200" role="alert">
            {validation}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={saving} onClick={() => void submit()}>
            {saving ? (
              <LoaderCircle size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
            ) : null}
            {mode === 'reschedule' ? 'Save New Schedule' : 'Schedule Interview'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Info({
  label: name,
  value,
  privateValue = false,
}: {
  label: string;
  value?: string | null;
  privateValue?: boolean;
}) {
  return (
    <div className="grid gap-1">
      <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{name}</dt>
      <dd className="break-all text-sm leading-6 text-slate-200">
        {value || 'Not available'}
        {privateValue && value ? (
          <span className="ml-2 text-[10px] uppercase tracking-[0.12em] text-amber-200">Private</span>
        ) : null}
      </dd>
    </div>
  );
}

function browserTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

function formatInterviewTime(interview: DoctorInterview) {
  if (!interview.scheduledStartUtc) return 'Not scheduled';
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: interview.timezone || 'UTC',
    }).format(new Date(interview.scheduledStartUtc));
  } catch {
    return new Date(interview.scheduledStartUtc).toLocaleString();
  }
}

function label(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function confirmTitle(action: 'cancel' | 'complete' | 'no-show' | null) {
  if (action === 'cancel') return 'Cancel Doctor interview?';
  if (action === 'complete') return 'Mark interview completed?';
  if (action === 'no-show') return 'Mark applicant as no-show?';
  return 'Confirm interview action';
}

function confirmDescription(action: 'cancel' | 'complete' | 'no-show' | null) {
  if (action === 'cancel') return 'The application returns to Interview Required and pending reminders are cancelled.';
  if (action === 'complete')
    return 'This moves the Doctor application to Interview Completed. Approval remains a later action.';
  if (action === 'no-show')
    return 'This records a no-show and returns the Doctor application to Interview Required for later handling.';
  return '';
}
