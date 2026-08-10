import { Check, ChevronDown, ChevronUp, Circle, Info, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { AccessApplication, ApplicationEvent, ApplicationStatus, ApplicationType } from './application-types';
import { ApplicationPanel } from './application-ui';

type MilestoneState = 'complete' | 'current' | 'upcoming' | 'action-required' | 'not-applicable';

export interface ApplicationProgressMilestone {
  label: string;
  state: MilestoneState;
  detail?: string;
}

const applicantEventTypes = new Set([
  'APPLICATION_CREATED',
  'EMAIL_VERIFIED',
  'DOCUMENT_UPLOADED',
  'SUBMITTED',
  'UNDER_REVIEW',
  'MORE_INFO_REQUIRED',
  'MORE_INFO_RECEIVED',
  'INTERVIEW_REQUIRED',
  'INTERVIEW_SCHEDULED',
  'INTERVIEW_RESCHEDULED',
  'INTERVIEW_CANCELLED',
  'INTERVIEW_COMPLETED',
  'APPROVED',
  'REJECTED',
  'ACTIVATION_PENDING',
  'ACTIVATED',
  'WITHDRAWN',
]);

function milestoneLabels(type: ApplicationType) {
  return type === 'DOCTOR'
    ? ['Application submitted', 'Professional review', 'Mandatory interview', 'Decision', 'Account activation']
    : ['Application submitted', 'Professional review', 'Decision', 'Account activation'];
}

function setStates(labels: string[], current: number, actionRequired = false): ApplicationProgressMilestone[] {
  return labels.map((label, index) => ({
    label,
    state:
      index < current ? 'complete' : index === current ? (actionRequired ? 'action-required' : 'current') : 'upcoming',
  }));
}

export function applicationProgressFor(
  status: ApplicationStatus,
  applicationType: ApplicationType,
): ApplicationProgressMilestone[] {
  const labels = milestoneLabels(applicationType);
  const doctor = applicationType === 'DOCTOR';

  if (status === 'WITHDRAWN') {
    return labels.map((label) => ({ label, state: 'not-applicable' }));
  }

  if (status === 'EMAIL_PENDING' || status === 'DRAFT') {
    return labels.map((label) => ({ label, state: 'upcoming' }));
  }

  if (status === 'SUBMITTED') {
    return setStates(labels, 0).map((item, index) =>
      index === 0 ? { ...item, detail: 'Submitted and waiting for review' } : item,
    );
  }

  if (status === 'UNDER_REVIEW') {
    return setStates(labels, 1);
  }

  if (status === 'MORE_INFO_REQUIRED') {
    return setStates(labels, 1, true).map((item, index) =>
      index === 1 ? { ...item, detail: 'Additional information requested' } : item,
    );
  }

  if (doctor && (status === 'INTERVIEW_REQUIRED' || status === 'INTERVIEW_SCHEDULED')) {
    return setStates(labels, 2).map((item, index) =>
      index === 2
        ? {
            ...item,
            detail: status === 'INTERVIEW_SCHEDULED' ? 'Interview scheduled' : 'Interview required',
          }
        : item,
    );
  }

  if (doctor && status === 'INTERVIEW_COMPLETED') {
    return setStates(labels, 3).map((item, index) =>
      index === 2 ? { ...item, state: 'complete', detail: 'Interview completed' } : item,
    );
  }

  // Researcher applications do not have an interview stage. If an interview
  // status ever reaches the client for a Researcher, keep the applicant in
  // professional review rather than surfacing Doctor-only workflow copy.
  if (!doctor && status.startsWith('INTERVIEW_')) {
    return setStates(labels, 1);
  }

  const decisionIndex = doctor ? 3 : 2;
  const activationIndex = doctor ? 4 : 3;

  if (status === 'REJECTED') {
    return labels.map((label, index) => ({
      label,
      state: index < decisionIndex ? 'complete' : index === decisionIndex ? 'current' : 'not-applicable',
      detail:
        index === decisionIndex ? 'Application not approved' : index > decisionIndex ? 'Not applicable' : undefined,
    }));
  }

  if (status === 'APPROVED') {
    return labels.map((label, index) => ({
      label,
      state: index <= decisionIndex ? 'complete' : 'upcoming',
      detail: index === decisionIndex ? 'Approved' : undefined,
    }));
  }

  if (status === 'ACTIVATION_PENDING') {
    return setStates(labels, activationIndex).map((item, index) =>
      index === activationIndex ? { ...item, detail: 'Activation pending' } : item,
    );
  }

  if (status === 'ACTIVATED') {
    return labels.map((label, index) => ({
      label,
      state: 'complete',
      detail: index === activationIndex ? 'Account activated' : undefined,
    }));
  }

  return labels.map((label) => ({ label, state: 'upcoming' }));
}

interface DisplayUpdate {
  key: string;
  message: string;
  createdAt: string;
  count?: number;
}

function friendlyMessage(event: ApplicationEvent) {
  switch (event.type) {
    case 'APPLICATION_CREATED':
      return 'Application started';
    case 'EMAIL_VERIFIED':
      return 'Application email verified';
    case 'SUBMITTED':
      return 'Application submitted';
    case 'UNDER_REVIEW':
      return 'Professional review started';
    case 'MORE_INFO_REQUIRED':
      return 'Additional information requested';
    case 'MORE_INFO_RECEIVED':
      return 'Additional information received';
    case 'INTERVIEW_REQUIRED':
      return 'Mandatory interview required';
    case 'INTERVIEW_SCHEDULED':
      return 'Mandatory interview scheduled';
    case 'INTERVIEW_RESCHEDULED':
      return 'Mandatory interview rescheduled';
    case 'INTERVIEW_CANCELLED':
      return 'Mandatory interview cancelled';
    case 'INTERVIEW_COMPLETED':
      return 'Mandatory interview completed';
    case 'APPROVED':
      return 'Application approved';
    case 'REJECTED':
      return 'Application not approved';
    case 'ACTIVATION_PENDING':
      return 'Account activation pending';
    case 'ACTIVATED':
      return 'Professional account activated';
    case 'WITHDRAWN':
      return 'Application withdrawn';
    default:
      return event.message;
  }
}

export function buildApplicantUpdates(events: ApplicationEvent[]): DisplayUpdate[] {
  const sorted = [...events]
    .filter((event) => applicantEventTypes.has(event.type))
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));

  const grouped = new Map<string, DisplayUpdate>();
  const result: DisplayUpdate[] = [];

  for (const event of sorted) {
    if (event.type !== 'DOCUMENT_UPLOADED') {
      result.push({
        key: `${event.type}-${event.createdAt}`,
        message: friendlyMessage(event),
        createdAt: event.createdAt,
      });
      continue;
    }

    const day = event.createdAt.slice(0, 10);
    const key = `documents-${day}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.count = (existing.count ?? 1) + 1;
      existing.message = `Supporting evidence received · ${existing.count} documents`;
      continue;
    }

    const update: DisplayUpdate = {
      key,
      message: 'Supporting evidence received · 1 document',
      createdAt: event.createdAt,
      count: 1,
    };
    grouped.set(key, update);
    result.push(update);
  }

  return result.sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
}

function statusSummary(application: AccessApplication) {
  switch (application.status) {
    case 'SUBMITTED':
      return {
        title: 'Application submitted',
        copy: 'Your application has been received and is waiting for professional review.',
        action: false,
      };
    case 'UNDER_REVIEW':
      return {
        title: 'Professional review',
        copy: 'Your application is being reviewed. No action is required from you right now.',
        action: false,
      };
    case 'MORE_INFO_REQUIRED':
      return {
        title: 'Action required',
        copy: 'Clinora has requested additional information. Open your editable application and provide the requested details.',
        action: true,
      };
    case 'INTERVIEW_REQUIRED':
      return {
        title: application.applicationType === 'DOCTOR' ? 'Mandatory interview required' : 'Professional review',
        copy:
          application.applicationType === 'DOCTOR'
            ? 'Your professional review has reached the mandatory interview stage.'
            : 'Your Researcher application remains in professional review.',
        action: application.applicationType === 'DOCTOR',
      };
    case 'INTERVIEW_SCHEDULED':
      return {
        title: application.applicationType === 'DOCTOR' ? 'Interview scheduled' : 'Professional review',
        copy:
          application.applicationType === 'DOCTOR'
            ? 'Your mandatory Doctor interview has been scheduled. Check the latest application update for details.'
            : 'Your Researcher application remains in professional review.',
        action: application.applicationType === 'DOCTOR',
      };
    case 'INTERVIEW_COMPLETED':
      return {
        title: application.applicationType === 'DOCTOR' ? 'Interview completed' : 'Professional review',
        copy:
          application.applicationType === 'DOCTOR'
            ? 'Your interview is complete and the application is awaiting a decision.'
            : 'Your Researcher application remains in professional review.',
        action: false,
      };
    case 'APPROVED':
      return {
        title: 'Application approved',
        copy: 'Your professional application has been approved. Account activation is the next stage.',
        action: false,
      };
    case 'REJECTED':
      return {
        title: 'Application not approved',
        copy: 'The professional application review is complete and this application will not proceed to activation.',
        action: false,
      };
    case 'ACTIVATION_PENDING':
      return {
        title: 'Account activation pending',
        copy: 'Your application is approved and awaiting professional account activation.',
        action: false,
      };
    case 'ACTIVATED':
      return {
        title: 'Professional account activated',
        copy: 'The application lifecycle is complete. Use your activated Clinora account for platform access.',
        action: false,
      };
    case 'WITHDRAWN':
      return {
        title: 'Application withdrawn',
        copy: 'This application is no longer under review.',
        action: false,
      };
    default:
      return {
        title: 'Application in progress',
        copy: 'Continue completing your professional application before submission.',
        action: false,
      };
  }
}

export function ApplicationStatusTimeline({
  application,
  events,
}: {
  application: AccessApplication;
  events: ApplicationEvent[];
}) {
  const [expanded, setExpanded] = useState(false);
  const milestones = applicationProgressFor(application.status, application.applicationType);
  const updates = useMemo(() => buildApplicantUpdates(events), [events]);
  const visibleUpdates = expanded ? updates : updates.slice(0, 5);
  const summary = statusSummary(application);

  if (application.status === 'WITHDRAWN') {
    return (
      <ApplicationPanel className="self-start">
        <h2 className="text-lg font-semibold text-white">Application withdrawn</h2>
        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-400">
          This application is no longer under review. You can start a new professional application later if needed.
        </p>
      </ApplicationPanel>
    );
  }

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[0.85fr_1.15fr]">
      <div className="grid self-start gap-5">
        <ApplicationPanel className="self-start">
          <div className="flex items-start gap-3">
            {summary.action ? (
              <TriangleAlert size={18} className="mt-0.5 shrink-0 text-amber-200" aria-hidden="true" />
            ) : (
              <Info size={18} className="mt-0.5 shrink-0 text-cyan-200" aria-hidden="true" />
            )}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Current status</p>
              <h2 className="mt-1 text-lg font-semibold text-white">{summary.title}</h2>
              <p className="mt-1.5 text-sm leading-6 text-slate-400">{summary.copy}</p>
            </div>
          </div>
        </ApplicationPanel>

        <ApplicationPanel className="self-start">
          <h2 className="text-lg font-semibold text-white">Application progress</h2>
          <p className="mt-1.5 text-sm leading-6 text-slate-400">
            This reflects the current professional application lifecycle.
          </p>
          <ol className="mt-6 grid gap-4">
            {milestones.map((milestone, index) => {
              const complete = milestone.state === 'complete';
              const current = milestone.state === 'current' || milestone.state === 'action-required';
              const inactive = milestone.state === 'not-applicable';
              return (
                <li key={milestone.label} className="flex gap-3" aria-current={current ? 'step' : undefined}>
                  <div
                    className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[11px] ${
                      complete
                        ? 'border-teal-300/30 bg-teal-300/10 text-teal-200'
                        : milestone.state === 'action-required'
                          ? 'border-amber-300/35 bg-amber-300/10 text-amber-100'
                          : current
                            ? 'border-cyan-300/[0.35] bg-cyan-300/10 text-cyan-100'
                            : 'border-white/[0.12] text-slate-600'
                    }`}
                    aria-hidden="true"
                  >
                    {complete ? <Check size={13} /> : inactive ? '—' : current ? <Circle size={10} /> : index + 1}
                  </div>
                  <div>
                    <p
                      className={
                        complete || current
                          ? 'text-sm font-medium text-slate-100'
                          : inactive
                            ? 'text-sm text-slate-600'
                            : 'text-sm text-slate-500'
                      }
                    >
                      {milestone.label}
                    </p>
                    {milestone.state === 'action-required' ? (
                      <p className="mt-0.5 text-xs font-medium text-amber-200">Action required</p>
                    ) : current ? (
                      <p className="mt-0.5 text-xs text-cyan-200/75">Current stage</p>
                    ) : complete ? (
                      <p className="mt-0.5 text-xs text-teal-200/70">Completed</p>
                    ) : inactive ? (
                      <p className="mt-0.5 text-xs text-slate-600">Not applicable</p>
                    ) : null}
                    {milestone.detail ? <p className="mt-0.5 text-xs text-slate-500">{milestone.detail}</p> : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </ApplicationPanel>
      </div>

      <ApplicationPanel className="self-start">
        <h2 className="text-lg font-semibold text-white">Recent updates</h2>
        <p className="mt-1.5 text-sm leading-6 text-slate-400">
          Meaningful application milestones and supporting-evidence receipts.
        </p>
        <div className="mt-5 divide-y divide-white/[0.08] border-y border-white/[0.08]">
          {visibleUpdates.length ? (
            visibleUpdates.map((event) => (
              <div key={event.key} className="py-3.5">
                <p className="text-sm font-medium text-slate-200">{event.message}</p>
                <time className="mt-1 block text-xs text-slate-500" dateTime={event.createdAt}>
                  {new Date(event.createdAt).toLocaleString()}
                </time>
              </div>
            ))
          ) : (
            <p className="py-4 text-sm text-slate-400">No applicant-facing updates yet.</p>
          )}
        </div>

        {updates.length > 5 ? (
          <button
            type="button"
            className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-medium text-cyan-300 transition hover:bg-white/[0.04] hover:text-cyan-200"
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? <ChevronUp size={15} aria-hidden="true" /> : <ChevronDown size={15} aria-hidden="true" />}
            {expanded ? 'Show recent only' : 'View earlier activity'}
          </button>
        ) : null}
      </ApplicationPanel>
    </div>
  );
}
