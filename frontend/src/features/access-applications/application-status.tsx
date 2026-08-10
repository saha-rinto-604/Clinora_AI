import { Check } from 'lucide-react';
import type { AccessApplication, ApplicationEvent } from './application-types';
import { ApplicationPanel } from './application-ui';

function milestoneIndex(application: AccessApplication) {
  const doctor = application.applicationType === 'DOCTOR';
  const status = application.status;
  if (status === 'SUBMITTED') return 0;
  if (status === 'UNDER_REVIEW' || status === 'MORE_INFO_REQUIRED') return 1;
  if (doctor && status.startsWith('INTERVIEW_')) return 2;
  if (status === 'APPROVED' || status === 'REJECTED') return doctor ? 3 : 2;
  if (status === 'ACTIVATION_PENDING' || status === 'ACTIVATED') return doctor ? 4 : 3;
  return 0;
}

export function ApplicationStatusTimeline({
  application,
  events,
}: {
  application: AccessApplication;
  events: ApplicationEvent[];
}) {
  const doctor = application.applicationType === 'DOCTOR';
  const milestones = doctor
    ? ['Application submitted', 'Professional review', 'Mandatory interview', 'Decision', 'Account activation']
    : ['Application submitted', 'Professional review', 'Decision', 'Account activation'];
  const activeIndex = milestoneIndex(application);

  if (application.status === 'WITHDRAWN') {
    return (
      <ApplicationPanel>
        <h2 className="text-lg font-semibold text-white">Application withdrawn</h2>
        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-400">
          This application is no longer under review. You can start a new professional application later if needed.
        </p>
      </ApplicationPanel>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
      <ApplicationPanel>
        <h2 className="text-lg font-semibold text-white">Application progress</h2>
        <p className="mt-1.5 text-sm leading-6 text-slate-400">
          We’ll update this page as your application moves through review.
        </p>
        <ol className="mt-6 grid gap-4">
          {milestones.map((milestone, index) => {
            const complete = index < activeIndex || application.status === 'ACTIVATED';
            const current = index === activeIndex && application.status !== 'ACTIVATED';
            return (
              <li key={milestone} className="flex gap-3">
                <div
                  className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[11px] ${complete ? 'border-teal-300/30 bg-teal-300/10 text-teal-200' : current ? 'border-cyan-300/[0.35] bg-cyan-300/10 text-cyan-100' : 'border-white/[0.12] text-slate-600'}`}
                >
                  {complete ? <Check size={13} aria-hidden="true" /> : index + 1}
                </div>
                <div>
                  <p className={current || complete ? 'text-sm font-medium text-slate-100' : 'text-sm text-slate-500'}>
                    {milestone}
                  </p>
                  {current ? <p className="mt-0.5 text-xs text-cyan-200/75">Current stage</p> : null}
                </div>
              </li>
            );
          })}
        </ol>
      </ApplicationPanel>

      <ApplicationPanel>
        <h2 className="text-lg font-semibold text-white">Updates</h2>
        <p className="mt-1.5 text-sm leading-6 text-slate-400">Recent activity related to your application.</p>
        <div className="mt-5 divide-y divide-white/[0.08] border-y border-white/[0.08]">
          {events.length ? (
            events.map((event) => (
              <div key={`${event.type}-${event.createdAt}`} className="py-3.5">
                <p className="text-sm font-medium text-slate-200">{event.message}</p>
                <time className="mt-1 block text-xs text-slate-500">{new Date(event.createdAt).toLocaleString()}</time>
              </div>
            ))
          ) : (
            <p className="py-4 text-sm text-slate-400">No updates yet.</p>
          )}
        </div>
      </ApplicationPanel>
    </div>
  );
}
