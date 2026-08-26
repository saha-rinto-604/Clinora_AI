import { CalendarClock, ExternalLink, LoaderCircle, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../components/ui/dialog';
import type { AccessApplication } from './application-types';
import { applicationApi, applicationErrorMessage } from './application-api';
import type { DoctorInterview } from './doctor-interview-types';
import {
  ApplicationNotice,
  ApplicationPanel,
  ApplicationPrimaryButton,
  ApplicationSecondaryButton,
} from './application-ui';
import { Textarea } from '../../components/ui/form';

export function DoctorInterviewApplicantPanel({ application }: { application: AccessApplication }) {
  const [interview, setInterview] = useState<DoctorInterview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleMessage, setRescheduleMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (application.applicationType !== 'DOCTOR' || !application.status.startsWith('INTERVIEW_')) {
      setLoading(false);
      return;
    }
    let active = true;
    applicationApi
      .interview()
      .then((value) => active && setInterview(value))
      .catch((caught) => active && setError(applicationErrorMessage(caught, 'Interview details could not be loaded.')))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [application.applicationType, application.status]);

  if (application.applicationType !== 'DOCTOR' || !application.status.startsWith('INTERVIEW_')) return null;

  async function requestReschedule() {
    if (!rescheduleMessage.trim()) return;
    setSaving(true);
    setError('');
    try {
      setInterview(await applicationApi.requestInterviewReschedule(rescheduleMessage.trim()));
      setRescheduleMessage('');
      setRescheduleOpen(false);
    } catch (caught) {
      setError(applicationErrorMessage(caught, 'Interview reschedule request could not be sent.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ApplicationPanel className="mb-5 self-start border-cyan-300/[0.16] bg-cyan-300/[0.035]">
      <div className="flex items-start gap-3">
        <CalendarClock size={19} className="mt-0.5 shrink-0 text-cyan-200" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-300">Doctor interview</p>
          <h2 className="mt-1 text-lg font-semibold text-white">Mandatory onboarding interview</h2>
          {loading ? (
            <p className="mt-3 inline-flex items-center gap-2 text-sm text-slate-400" role="status">
              <LoaderCircle size={15} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> Loading
              private interview details…
            </p>
          ) : null}
          {error ? (
            <ApplicationNotice tone="error" className="mt-3">
              {error}
            </ApplicationNotice>
          ) : null}
          {!loading && !interview && application.status === 'INTERVIEW_REQUIRED' ? (
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Your interview is required but has not yet been scheduled. Clinora will provide private meeting details
              after scheduling.
            </p>
          ) : null}
          {interview?.scheduledStartUtc ? (
            <div className="mt-4 grid gap-3 rounded-xl border border-white/[0.08] bg-slate-950/[0.28] p-4 sm:grid-cols-2">
              <Info label="Date & time" value={formatInterviewTime(interview)} />
              <Info label="Timezone" value={interview.timezone} />
              <Info
                label="Duration"
                value={interview.durationMinutes ? `${interview.durationMinutes} minutes` : null}
              />
              <Info label="Provider" value={interview.meetingProvider ? label(interview.meetingProvider) : null} />
              <Info label="Status" value={label(interview.status)} />
              <Info label="Instructions" value={interview.instructions} />
              {interview.meetingUrl && application.status === 'INTERVIEW_SCHEDULED' ? (
                <div className="sm:col-span-2 flex flex-wrap items-center gap-3 pt-1">
                  <a
                    href={interview.meetingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-cyan-300 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-200/70"
                  >
                    Join Interview <ExternalLink size={14} aria-hidden="true" />
                  </a>
                  {interview.status === 'RESCHEDULE_REQUESTED' ? (
                    <span className="text-sm text-amber-200">
                      Reschedule request pending. Current schedule remains active.
                    </span>
                  ) : (
                    <ApplicationSecondaryButton onClick={() => setRescheduleOpen(true)}>
                      <RotateCcw size={14} aria-hidden="true" /> Request reschedule
                    </ApplicationSecondaryButton>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}
          {application.status === 'INTERVIEW_COMPLETED' ? (
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Your interview is complete. Your application remains under Clinora review; no professional account has
              been created yet.
            </p>
          ) : null}
        </div>
      </div>

      <Dialog open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
        <DialogContent>
          <DialogTitle>Request interview reschedule</DialogTitle>
          <DialogDescription className="text-sm leading-6 text-slate-400">
            Tell the review team why you need another time. This request does not change the current schedule until a
            System Admin reschedules it.
          </DialogDescription>
          <Textarea
            aria-label="Interview reschedule request"
            maxLength={500}
            value={rescheduleMessage}
            onChange={(event) => setRescheduleMessage(event.target.value)}
            placeholder="Please describe your availability or scheduling constraint."
          />
          <div className="flex justify-end gap-2">
            <ApplicationSecondaryButton onClick={() => setRescheduleOpen(false)}>Cancel</ApplicationSecondaryButton>
            <ApplicationPrimaryButton
              loading={saving}
              disabled={!rescheduleMessage.trim()}
              onClick={() => void requestReschedule()}
            >
              Send request
            </ApplicationPrimaryButton>
          </div>
        </DialogContent>
      </Dialog>
    </ApplicationPanel>
  );
}

function Info({ label: name, value }: { label: string; value?: string | null }) {
  return (
    <div className="grid gap-1">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{name}</dt>
      <dd className="text-sm leading-6 text-slate-200">{value || 'Not available'}</dd>
    </div>
  );
}

function formatInterviewTime(interview: DoctorInterview) {
  if (!interview.scheduledStartUtc) return 'Not scheduled';
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'full',
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
