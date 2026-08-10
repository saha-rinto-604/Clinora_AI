import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, ArrowLeft, ArrowRight, Check, Circle, LoaderCircle, LogOut, Send } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '../../components/ui/dialog';
import { applicationApi, applicationErrorMessage, type ApplicationUpdate } from './application-api';
import {
  applicationStepDescription,
  ApplicationStepFields,
  doctorSteps,
  profileSchema,
  researcherSteps,
  type ProfileValues,
} from './application-form-fields';
import { ApplicationStatusTimeline } from './application-status';
import type { AccessApplication, ApplicationEvent, ApplicationStatus, Qualification } from './application-types';
import {
  ApplicationNotice,
  ApplicationPanel,
  ApplicationPrimaryButton,
  ApplicationSecondaryButton,
} from './application-ui';

type SaveState = 'saved' | 'saving' | 'error';

const statusLabels: Record<ApplicationStatus, string> = {
  EMAIL_PENDING: 'Email verification pending',
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under review',
  MORE_INFO_REQUIRED: 'Action required',
  INTERVIEW_REQUIRED: 'Interview required',
  INTERVIEW_SCHEDULED: 'Interview scheduled',
  INTERVIEW_COMPLETED: 'Interview completed',
  APPROVED: 'Approved',
  REJECTED: 'Not approved',
  ACTIVATION_PENDING: 'Activation pending',
  ACTIVATED: 'Account activated',
  WITHDRAWN: 'Withdrawn',
};

function statusLabelFor(application: AccessApplication) {
  if (application.applicationType === 'RESEARCHER' && application.status.startsWith('INTERVIEW_')) {
    return 'Under review';
  }
  return statusLabels[application.status];
}

function SaveIndicator({ state }: { state: SaveState }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-400" role="status" aria-live="polite">
      {state === 'saving' ? (
        <LoaderCircle size={13} className="animate-spin text-cyan-300 motion-reduce:animate-none" aria-hidden="true" />
      ) : state === 'error' ? (
        <AlertCircle size={13} className="text-rose-300" aria-hidden="true" />
      ) : (
        <Check size={13} className="text-teal-300" aria-hidden="true" />
      )}
      {state === 'saving' ? 'Saving…' : state === 'error' ? 'Not saved' : 'Saved'}
    </span>
  );
}

export function ApplicationWorkspace({
  application,
  events,
  onApplication,
  onReload,
}: {
  application: AccessApplication;
  events: ApplicationEvent[];
  onApplication: (application: AccessApplication) => void;
  onReload: () => Promise<void>;
}) {
  const [step, setStep] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [error, setError] = useState('');
  const [attested, setAttested] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [signingOut, setSigningOut] = useState<'current' | 'all' | ''>('');
  const [qualifications, setQualifications] = useState<Qualification[]>(application.qualifications);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const reduceMotion = useReducedMotion();
  const steps = application.applicationType === 'DOCTOR' ? doctorSteps : researcherSteps;
  const roleName = application.applicationType === 'DOCTOR' ? 'Doctor' : 'Researcher';
  const editable = application.status === 'DRAFT' || application.status === 'MORE_INFO_REQUIRED';
  const canWithdraw = application.status === 'SUBMITTED' || application.status === 'MORE_INFO_REQUIRED';

  useEffect(() => {
    stepHeadingRef.current?.focus();
  }, [step]);

  const defaultValues = useMemo<ProfileValues>(
    () => ({
      firstName: application.firstName,
      lastName: application.lastName,
      phone: application.phone ?? '',
      countryCode: application.countryCode ?? '',
      professionalTitle: application.doctor?.professionalTitle ?? application.researcher?.professionalTitle ?? '',
      specialization: application.doctor?.specialization ?? '',
      yearsExperience: application.doctor?.yearsExperience == null ? '' : String(application.doctor.yearsExperience),
      currentOrganization: application.doctor?.currentOrganization ?? '',
      currentPosition: application.doctor?.currentPosition ?? '',
      professionalProfileUrl: application.doctor?.professionalProfileUrl ?? '',
      registrationJurisdiction: application.doctor?.registrationJurisdiction ?? '',
      registrationAuthority: application.doctor?.registrationAuthority ?? '',
      registrationNumber: application.doctor?.registrationNumber ?? '',
      registrationType: application.doctor?.registrationType ?? '',
      registrationIssuedAt: application.doctor?.registrationIssuedAt ?? '',
      registrationValidUntil: application.doctor?.registrationValidUntil ?? '',
      institution: application.researcher?.institution ?? '',
      department: application.researcher?.department ?? '',
      institutionalProfileUrl: application.researcher?.institutionalProfileUrl ?? '',
      researchField: application.researcher?.researchField ?? '',
      researchPurpose: application.researcher?.researchPurpose ?? '',
      researchSummary: application.researcher?.researchSummary ?? '',
      orcid: application.researcher?.orcid ?? '',
      researchProfileUrl: application.researcher?.researchProfileUrl ?? '',
      publicationProfileUrl: application.researcher?.publicationProfileUrl ?? '',
      ethicsReference: application.researcher?.ethicsReference ?? '',
      projectApprovalReference: application.researcher?.projectApprovalReference ?? '',
    }),
    [application],
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    getValues,
  } = useForm<ProfileValues>({ resolver: zodResolver(profileSchema), defaultValues });

  async function save(values: ProfileValues, advance = false) {
    setError('');
    setSaveState('saving');
    const payload: ApplicationUpdate = {
      ...values,
      yearsExperience: values.yearsExperience ? Number(values.yearsExperience) : undefined,
      qualifications: application.applicationType === 'DOCTOR' ? qualifications : undefined,
    };
    try {
      const updated = await applicationApi.update(payload);
      onApplication(updated);
      setSaveState('saved');
      if (advance) setStep((current) => Math.min(current + 1, steps.length - 1));
      return true;
    } catch (caught) {
      setSaveState('error');
      setError(applicationErrorMessage(caught, 'We could not save your changes. Please try again.'));
      return false;
    }
  }

  async function submitApplication() {
    setError('');
    try {
      const saved = await save(getValues());
      if (!saved) return;
      const submitted = await applicationApi.submit(attested);
      onApplication(submitted);
      await onReload();
    } catch (caught) {
      setError(applicationErrorMessage(caught, 'Your application is not ready to submit yet.'));
    }
  }

  async function withdrawApplication() {
    try {
      onApplication(await applicationApi.withdraw());
      setWithdrawOpen(false);
      await onReload();
    } catch (caught) {
      setError(applicationErrorMessage(caught, 'We could not withdraw the application. Please try again.'));
    }
  }

  async function prepareToSignOut() {
    if (!editable) return true;
    return save(getValues());
  }

  async function signOut(scope: 'current' | 'all') {
    setError('');
    setSigningOut(scope);
    try {
      const ready = await prepareToSignOut();
      if (!ready) return;
      if (scope === 'all') {
        await applicationApi.logoutAll();
      } else {
        await applicationApi.logout();
      }
      window.location.assign('/professional-access');
    } catch (caught) {
      setError(applicationErrorMessage(caught, 'We could not end your application session. Please try again.'));
    } finally {
      setSigningOut('');
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1120px]">
      <header className="mb-7 flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-[-0.025em] text-white sm:text-[28px]">
              {roleName} application
            </h1>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-slate-300">
              {statusLabelFor(application)}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-400">
            <span>
              {application.firstName} {application.lastName}
            </span>
            <span aria-hidden="true" className="text-slate-700">
              •
            </span>
            {editable ? <SaveIndicator state={saveState} /> : <span>{application.email}</span>}
          </div>
        </div>
        <div className="flex max-w-xs flex-col items-start gap-1.5 sm:items-end">
          <button
            type="button"
            disabled={Boolean(signingOut)}
            onClick={() => void signOut('current')}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-medium text-slate-300 transition hover:bg-white/[0.04] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {signingOut === 'current' ? (
              <LoaderCircle size={15} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
            ) : (
              <LogOut size={15} aria-hidden="true" />
            )}
            {editable ? 'Save & sign out' : 'Sign out'}
          </button>
          <button
            type="button"
            disabled={Boolean(signingOut)}
            onClick={() => void signOut('all')}
            className="rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-white/[0.04] hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {signingOut === 'all' ? 'Signing out everywhere…' : 'Sign out all devices'}
          </button>
          <p className="text-left text-[11px] leading-4 text-slate-600 sm:text-right">
            Using a shared device? Sign out when you&apos;re finished.
          </p>
        </div>
      </header>

      {application.status === 'MORE_INFO_REQUIRED' ? (
        <ApplicationNotice className="mb-1">
          Additional information is required before review can continue. Update the requested details, save your
          changes, and resubmit when the application is ready.
        </ApplicationNotice>
      ) : null}

      {editable ? (
        <div className="grid gap-7 lg:grid-cols-[184px_minmax(0,760px)] lg:justify-center lg:gap-9">
          <ApplicationStepper steps={steps} step={step} />

          <ApplicationPanel className="min-w-0">
            <form onSubmit={handleSubmit((values) => save(values, true))} className="grid gap-6">
              <header className="border-b border-white/[0.08] pb-5">
                <div className="mb-3 lg:hidden">
                  <MobileProgress step={step} total={steps.length} reduceMotion={Boolean(reduceMotion)} />
                </div>
                <p className="hidden text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-300 lg:block">
                  Step {step + 1} of {steps.length}
                </p>
                <h2
                  ref={stepHeadingRef}
                  tabIndex={-1}
                  className="mt-1 text-2xl font-semibold tracking-[-0.02em] text-white outline-none"
                >
                  {steps[step]}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                  {applicationStepDescription(application, step)}
                </p>
              </header>

              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={step}
                  initial={reduceMotion ? { opacity: 1 } : { opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -6 }}
                  transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                  className="grid gap-5 motion-reduce:transform-none"
                >
                  <ApplicationStepFields
                    application={application}
                    step={step}
                    register={register}
                    errors={errors}
                    qualifications={qualifications}
                    setQualifications={setQualifications}
                    onReload={onReload}
                  />
                </motion.div>
              </AnimatePresence>

              {error ? <ApplicationNotice tone="error">{error}</ApplicationNotice> : null}

              {step === steps.length - 1 ? (
                <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-slate-950/[0.25] p-3.5 text-sm leading-6 text-slate-300">
                  <input
                    className="mt-1 h-4 w-4 shrink-0 accent-cyan-400"
                    type="checkbox"
                    checked={attested}
                    onChange={(event) => setAttested(event.target.checked)}
                  />
                  <span>
                    I confirm that the information and documents I’ve provided are accurate to the best of my knowledge.
                  </span>
                </label>
              ) : null}

              <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <ApplicationSecondaryButton
                  type="button"
                  disabled={step === 0}
                  onClick={() => setStep((value) => Math.max(0, value - 1))}
                  className="w-full sm:w-auto"
                >
                  <ArrowLeft size={15} aria-hidden="true" /> Back
                </ApplicationSecondaryButton>

                {step === steps.length - 1 ? (
                  <ApplicationPrimaryButton
                    type="button"
                    onClick={() => void submitApplication()}
                    disabled={!attested}
                    className="w-full sm:w-auto sm:min-w-48"
                  >
                    <Send size={16} aria-hidden="true" /> Submit application
                  </ApplicationPrimaryButton>
                ) : (
                  <ApplicationPrimaryButton
                    type="submit"
                    loading={isSubmitting}
                    className="w-full sm:w-auto sm:min-w-40"
                  >
                    Continue <ArrowRight size={15} aria-hidden="true" />
                  </ApplicationPrimaryButton>
                )}
              </div>
            </form>
          </ApplicationPanel>
        </div>
      ) : (
        <ApplicationStatusTimeline application={application} events={events} />
      )}

      {canWithdraw ? (
        <div className="mt-6 flex justify-end border-t border-white/[0.08] pt-5">
          <button
            type="button"
            onClick={() => setWithdrawOpen(true)}
            className="text-sm font-medium text-rose-300 transition hover:text-rose-200"
          >
            Withdraw application
          </button>
        </div>
      ) : null}

      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent className="rounded-[20px]">
          <DialogTitle>Withdraw application?</DialogTitle>
          <DialogDescription>
            Your submitted application will be closed and removed from active review. You can start a new application
            later.
          </DialogDescription>
          {error ? <ApplicationNotice tone="error">{error}</ApplicationNotice> : null}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <DialogClose asChild>
              <ApplicationSecondaryButton>Keep application</ApplicationSecondaryButton>
            </DialogClose>
            <button
              type="button"
              onClick={() => void withdrawApplication()}
              className="inline-flex min-h-10 items-center justify-center rounded-xl bg-rose-300 px-4 text-sm font-semibold text-rose-950 transition hover:bg-rose-200"
            >
              Withdraw application
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ApplicationStepper({ steps, step }: { steps: string[]; step: number }) {
  return (
    <nav aria-label="Application progress" className="hidden lg:block lg:sticky lg:top-6 lg:self-start">
      <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Progress</p>
      <ol className="grid gap-1" role="list">
        {steps.map((label, index) => (
          <li key={label}>
            <div
              aria-current={index === step ? 'step' : undefined}
              className={`grid grid-cols-[20px_1fr] items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-[13px] transition ${index === step ? 'bg-cyan-300/[0.07] text-cyan-100' : 'text-slate-500'}`}
            >
              <span className="grid h-5 w-5 place-items-center">
                {index < step ? (
                  <Check size={14} className="text-teal-300" aria-hidden="true" />
                ) : index === step ? (
                  <span
                    className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_14px_rgba(103,232,249,.45)]"
                    aria-hidden="true"
                  />
                ) : (
                  <Circle size={12} aria-hidden="true" />
                )}
              </span>
              <span>{label}</span>
            </div>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function MobileProgress({ step, total, reduceMotion }: { step: number; total: number; reduceMotion: boolean }) {
  const progress = ((step + 1) / total) * 100;
  return (
    <div
      role="progressbar"
      aria-label="Application progress"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={step + 1}
      aria-valuetext={`Step ${step + 1} of ${total}`}
    >
      <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        <span>
          Step {step + 1} of {total}
        </span>
        <span>{Math.round(progress)}%</span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden="true">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-teal-300"
          initial={false}
          animate={{ width: `${progress}%` }}
          transition={{ duration: reduceMotion ? 0 : 0.3, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}
