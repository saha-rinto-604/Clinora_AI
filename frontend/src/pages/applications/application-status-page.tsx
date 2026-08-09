import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Circle,
  Download,
  FileText,
  LoaderCircle,
  LogOut,
  Plus,
  Send,
  Trash2,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
  type TextareaHTMLAttributes,
} from 'react';
import { useForm, type FieldErrors, type UseFormRegister } from 'react-hook-form';
import { useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import {
  applicationApi,
  applicationErrorMessage,
  type ApplicationUpdate,
} from '../../features/access-applications/application-api';
import type {
  AccessApplication,
  ApplicationDocumentType,
  ApplicationEvent,
  ApplicationStatus,
  Qualification,
} from '../../features/access-applications/application-types';
import { AuthCard, Field, FormNotice, SubmitButton } from '../../features/auth/auth-ui';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '../../components/ui/dialog';

const profileSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required.'),
  lastName: z.string().trim().min(1, 'Last name is required.'),
  phone: z.string().trim().min(5, 'Enter a phone or contact number.'),
  countryCode: z.string().trim().min(2, 'Country / jurisdiction is required.'),
  professionalTitle: z.string().optional(),
  specialization: z.string().optional(),
  yearsExperience: z.string().optional(),
  currentOrganization: z.string().optional(),
  currentPosition: z.string().optional(),
  professionalProfileUrl: z.string().optional(),
  registrationJurisdiction: z.string().optional(),
  registrationAuthority: z.string().optional(),
  registrationNumber: z.string().optional(),
  registrationType: z.string().optional(),
  registrationIssuedAt: z.string().optional(),
  registrationValidUntil: z.string().optional(),
  institution: z.string().optional(),
  department: z.string().optional(),
  institutionalProfileUrl: z.string().optional(),
  researchField: z.string().optional(),
  researchPurpose: z.string().optional(),
  researchSummary: z.string().optional(),
  orcid: z.string().optional(),
  researchProfileUrl: z.string().optional(),
  publicationProfileUrl: z.string().optional(),
  ethicsReference: z.string().optional(),
  projectApprovalReference: z.string().optional(),
});

type ProfileValues = z.infer<typeof profileSchema>;

const doctorSteps = [
  'Identity & contact',
  'Professional practice',
  'Registration',
  'Qualifications',
  'Documents',
  'Review',
];
const researcherSteps = [
  'Identity & contact',
  'Institution & role',
  'Research profile',
  'Research purpose',
  'Evidence',
  'Review',
];

const statusLabels: Record<string, string> = {
  EMAIL_PENDING: 'Email verification pending',
  DRAFT: 'Application in progress',
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Professional review',
  MORE_INFO_REQUIRED: 'Action required',
  INTERVIEW_REQUIRED: 'Interview required',
  INTERVIEW_SCHEDULED: 'Interview scheduled',
  INTERVIEW_COMPLETED: 'Interview completed',
  APPROVED: 'Approved',
  REJECTED: 'Not approved',
  ACTIVATION_PENDING: 'Account activation pending',
  ACTIVATED: 'Professional account activated',
  WITHDRAWN: 'Withdrawn',
};

function statusLabelFor(application: AccessApplication) {
  if (application.applicationType === 'RESEARCHER' && application.status.startsWith('INTERVIEW_')) {
    return 'Professional review';
  }
  return statusLabels[application.status] ?? 'Application status';
}

function draftLabel(status: ApplicationStatus) {
  return status === 'DRAFT' || status === 'MORE_INFO_REQUIRED' ? 'Draft saved' : statusLabels[status];
}

function TextAreaField({
  label,
  error,
  id,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string }) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  return (
    <label htmlFor={inputId} className="grid gap-2 text-sm font-medium text-slate-200">
      <span>{label}</span>
      <textarea
        {...props}
        id={inputId}
        className="min-h-32 w-full resize-y rounded-2xl border border-white/15 bg-slate-950/55 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 hover:border-white/25 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-400/15"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : props['aria-describedby']}
      />
      {error ? (
        <span id={errorId} className="text-xs font-medium text-rose-300">
          {error}
        </span>
      ) : null}
    </label>
  );
}

function ResumeApplication({ onReady }: { onReady: () => Promise<void> }) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function sendLink(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      await applicationApi.requestAccessLink(email);
      setMessage('If a verified application exists for that email, a secure resume link has been sent.');
    } catch (error) {
      setMessage(applicationErrorMessage(error, 'The request could not be completed.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <AuthCard>
        <header className="mb-7">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Applicant portal</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em]">Resume your professional application</h1>
          <p className="mt-3 leading-7 text-slate-300">
            Enter the email from a verified professional application. Applicant access is separate from your normal
            Clinora login.
          </p>
        </header>
        <form onSubmit={sendLink} className="grid gap-5">
          <Field
            label="Application email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          {message ? <FormNotice>{message}</FormNotice> : null}
          <SubmitButton loading={loading}>Send secure resume link</SubmitButton>
        </form>
        <button
          className="mt-5 text-sm font-semibold text-slate-400 hover:text-white"
          type="button"
          onClick={() => void onReady()}
        >
          I already have an active applicant session
        </button>
      </AuthCard>
    </div>
  );
}

export function ApplicationStatusPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [application, setApplication] = useState<AccessApplication | null>(null);
  const [events, setEvents] = useState<ApplicationEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsAccess, setNeedsAccess] = useState(false);
  const [error, setError] = useState('');
  const sessionBootStarted = useRef(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const app = await applicationApi.me();
      setApplication(app);
      setEvents(await applicationApi.events());
      setNeedsAccess(false);
    } catch {
      setNeedsAccess(true);
      setApplication(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const token = searchParams.get('token');
    async function boot() {
      if (token) {
        if (sessionBootStarted.current) return;
        sessionBootStarted.current = true;
        try {
          await applicationApi.establishSession(token);
          navigate('/application/status', { replace: true });
        } catch (caught) {
          setError(applicationErrorMessage(caught, 'The secure resume link could not be used.'));
          setNeedsAccess(true);
          setLoading(false);
          return;
        }
      }
      await load();
    }
    void boot();
    // The token is intentionally consumed once and then removed from the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <LoaderCircle className="animate-spin text-cyan-300 motion-reduce:animate-none" />
      </div>
    );
  }
  if (needsAccess || !application) {
    return (
      <>
        <ResumeApplication onReady={load} />
        {error ? (
          <div className="mx-auto mt-4 max-w-xl">
            <FormNotice tone="error">{error}</FormNotice>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <ApplicationWorkspace application={application} events={events} onApplication={setApplication} onReload={load} />
  );
}

function ApplicationWorkspace({
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
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [attested, setAttested] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [qualifications, setQualifications] = useState<Qualification[]>(application.qualifications);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const reduceMotion = useReducedMotion();
  const steps = application.applicationType === 'DOCTOR' ? doctorSteps : researcherSteps;
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
    setNotice('');
    const payload: ApplicationUpdate = {
      ...values,
      yearsExperience: values.yearsExperience ? Number(values.yearsExperience) : undefined,
      qualifications: application.applicationType === 'DOCTOR' ? qualifications : undefined,
    };
    try {
      const updated = await applicationApi.update(payload);
      onApplication(updated);
      setNotice('Progress saved securely.');
      if (advance) setStep((current) => Math.min(current + 1, steps.length - 1));
      return true;
    } catch (caught) {
      setError(applicationErrorMessage(caught, 'Your application progress could not be saved.'));
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
      setError(applicationErrorMessage(caught, 'The application is not ready to submit.'));
    }
  }

  async function withdrawApplication() {
    try {
      onApplication(await applicationApi.withdraw());
      setWithdrawOpen(false);
      await onReload();
    } catch (caught) {
      setError(applicationErrorMessage(caught, 'The application could not be withdrawn.'));
    }
  }

  async function saveAndExit() {
    if (editable) {
      const saved = await save(getValues());
      if (!saved) return;
    }
    await applicationApi.logout();
    window.location.assign('/application/status');
  }

  return (
    <div className="mx-auto grid max-w-[1280px] gap-6">
      <header className="flex flex-col gap-5 rounded-3xl border border-white/10 bg-white/[0.045] p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">
            {application.applicationType === 'DOCTOR' ? 'Doctor' : 'Researcher'} access application
          </p>
          <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">{statusLabelFor(application)}</h1>
          <p className="mt-3 text-slate-300">
            {draftLabel(application.status)} / {application.firstName} {application.lastName} / {application.email}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void saveAndExit()}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400 hover:text-white"
        >
          <LogOut size={16} aria-hidden="true" /> Save & exit
        </button>
      </header>

      {editable ? (
        <div className="grid gap-5 lg:grid-cols-[190px_minmax(0,1fr)] xl:grid-cols-[210px_minmax(0,850px)] xl:justify-center">
          <nav
            aria-label="Application progress"
            aria-describedby="application-step-summary"
            className="rounded-3xl border border-white/10 bg-white/[0.035] p-4 lg:sticky lg:top-6 lg:self-start"
          >
            <p
              id="application-step-summary"
              className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-cyan-300"
            >
              Step {step + 1} of {steps.length}
            </p>
            <ol className="grid gap-2" role="list">
              {steps.map((label, index) => (
                <li key={label}>
                  <div
                    aria-current={index === step ? 'step' : undefined}
                    className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm ${index === step ? 'bg-cyan-300/10 text-cyan-100' : 'text-slate-400'}`}
                  >
                    {index < step ? (
                      <Check size={16} className="text-teal-300" aria-hidden="true" />
                    ) : (
                      <Circle size={14} aria-hidden="true" />
                    )}
                    <span>
                      <span className="block text-[10px] uppercase tracking-[0.16em] opacity-60">Step {index + 1}</span>
                      {label}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </nav>

          <AuthCard>
            <form onSubmit={handleSubmit((values) => save(values, true))} className="grid gap-5">
              <header>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">
                  Step {step + 1} of {steps.length}
                </p>
                <h2 ref={stepHeadingRef} tabIndex={-1} className="mt-2 text-2xl font-semibold outline-none">
                  {steps[step]}
                </h2>
              </header>
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -6 }}
                  transition={{ duration: 0.24, ease: 'easeOut' }}
                  className="grid gap-5 motion-reduce:transform-none"
                >
                  <StepFields
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
              {notice ? <FormNotice tone="success">{notice}</FormNotice> : null}
              {error ? <FormNotice tone="error">{error}</FormNotice> : null}
              <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:justify-between">
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={step === 0}
                    onClick={() => setStep((value) => Math.max(0, value - 1))}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/15 px-4 text-sm font-semibold text-slate-200 disabled:opacity-40"
                  >
                    <ArrowLeft size={16} aria-hidden="true" /> Back
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveAndExit()}
                    className="inline-flex min-h-11 items-center justify-center rounded-2xl px-4 text-sm font-semibold text-slate-400 hover:text-white"
                  >
                    Save & exit
                  </button>
                </div>
                {step === steps.length - 1 ? (
                  <div className="grid gap-3 sm:min-w-72">
                    <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/35 p-4 text-sm leading-6 text-slate-300">
                      <input
                        className="mt-1"
                        type="checkbox"
                        checked={attested}
                        onChange={(event) => setAttested(event.target.checked)}
                      />
                      I confirm the information and documents are accurate to the best of my knowledge and may be
                      reviewed as part of Clinora&apos;s professional access process.
                    </label>
                    <button
                      type="button"
                      onClick={() => void submitApplication()}
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-teal-400 px-5 font-bold text-slate-950"
                    >
                      <Send size={17} aria-hidden="true" /> Submit for review
                    </button>
                  </div>
                ) : (
                  <SubmitButton loading={isSubmitting}>
                    Save & continue <ArrowRight size={16} aria-hidden="true" />
                  </SubmitButton>
                )}
              </div>
            </form>
          </AuthCard>
        </div>
      ) : (
        <StatusTimeline application={application} events={events} />
      )}

      {canWithdraw ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setWithdrawOpen(true)}
            className="text-sm font-semibold text-rose-300 hover:text-rose-200"
          >
            Withdraw application
          </button>
        </div>
      ) : null}
      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent>
          <DialogTitle>Withdraw application?</DialogTitle>
          <DialogDescription>
            This closes the current professional access application. You can start a new application later if needed.
          </DialogDescription>
          {error ? <FormNotice tone="error">{error}</FormNotice> : null}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <DialogClose asChild>
              <button
                type="button"
                className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-white/15 px-4 text-sm font-semibold text-slate-200"
              >
                Keep application
              </button>
            </DialogClose>
            <button
              type="button"
              onClick={() => void withdrawApplication()}
              className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-rose-300 px-4 text-sm font-bold text-rose-950"
            >
              Withdraw application
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StepFields({
  application,
  step,
  register,
  errors,
  qualifications,
  setQualifications,
  onReload,
}: {
  application: AccessApplication;
  step: number;
  register: UseFormRegister<ProfileValues>;
  errors: FieldErrors<ProfileValues>;
  qualifications: Qualification[];
  setQualifications: Dispatch<SetStateAction<Qualification[]>>;
  onReload: () => Promise<void>;
}) {
  const doctor = application.applicationType === 'DOCTOR';
  if (step === 0) {
    return (
      <>
        <SectionHeading
          title="Identity & contact"
          description="Keep your professional application contact details current."
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="First name" {...register('firstName')} error={errors.firstName?.message} />
          <Field label="Last name" {...register('lastName')} error={errors.lastName?.message} />
        </div>
        <Field label="Phone / contact" {...register('phone')} error={errors.phone?.message} />
        <Field label="Country / jurisdiction" {...register('countryCode')} error={errors.countryCode?.message} />
      </>
    );
  }
  if (doctor && step === 1) {
    return (
      <>
        <SectionHeading
          title="Professional practice"
          description="Tell reviewers about your current professional context."
        />
        <Field label="Professional title" {...register('professionalTitle')} />
        <Field label="Specialization" {...register('specialization')} />
        <Field label="Years of experience" type="number" min="0" {...register('yearsExperience')} />
        <Field label="Current organization / practice" {...register('currentOrganization')} />
        <Field label="Current position" {...register('currentPosition')} />
        <Field label="Professional profile URL (optional)" type="url" {...register('professionalProfileUrl')} />
      </>
    );
  }
  if (doctor && step === 2) {
    return (
      <>
        <SectionHeading
          title="Registration & licensing"
          description="Collecting registration evidence does not mean Clinora has legally validated it."
        />
        <Field label="Registration jurisdiction" {...register('registrationJurisdiction')} placeholder="Bangladesh" />
        <Field
          label="Registration authority / medical council"
          {...register('registrationAuthority')}
          placeholder="Bangladesh Medical & Dental Council"
        />
        <Field label="Registration / license number" {...register('registrationNumber')} />
        <Field label="Registration type (optional)" {...register('registrationType')} />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Issue date (optional)" type="date" {...register('registrationIssuedAt')} />
          <Field label="Valid until (optional)" type="date" {...register('registrationValidUntil')} />
        </div>
      </>
    );
  }
  if (doctor && step === 3) {
    return <QualificationEditor qualifications={qualifications} onChange={setQualifications} />;
  }
  if (doctor && step === 4) {
    return <DocumentManager application={application} onReload={onReload} />;
  }
  if (!doctor && step === 1) {
    return (
      <>
        <SectionHeading
          title="Institution & professional role"
          description="Institutional affiliation is a review signal, not automatic proof of identity or eligibility."
        />
        <Field label="Institution / organization" {...register('institution')} />
        <Field label="Department (optional)" {...register('department')} />
        <Field label="Professional title" {...register('professionalTitle')} />
        <Field label="Institutional profile URL (optional)" type="url" {...register('institutionalProfileUrl')} />
      </>
    );
  }
  if (!doctor && step === 2) {
    return (
      <>
        <SectionHeading
          title="Research profile"
          description="Describe your research area and optional professional identifiers."
        />
        <Field label="Research field" {...register('researchField')} />
        <TextAreaField label="Research summary (optional)" {...register('researchSummary')} />
        <Field label="ORCID iD (optional)" {...register('orcid')} placeholder="0000-0000-0000-0000" />
        <Field label="Research profile URL (optional)" type="url" {...register('researchProfileUrl')} />
        <Field label="Publication profile URL (optional)" type="url" {...register('publicationProfileUrl')} />
      </>
    );
  }
  if (!doctor && step === 3) {
    return (
      <>
        <SectionHeading
          title="Research purpose"
          description="Explain why professional access to Clinora is being requested."
        />
        <TextAreaField label="Research purpose" {...register('researchPurpose')} />
        <Field label="Ethics reference (when relevant)" {...register('ethicsReference')} />
        <Field label="Project approval reference (when relevant)" {...register('projectApprovalReference')} />
      </>
    );
  }
  if (!doctor && step === 4) {
    return <DocumentManager application={application} onReload={onReload} />;
  }
  return <ReviewSummary application={application} qualifications={qualifications} />;
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <header className="mb-2">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">Professional application</p>
      <h3 className="mt-2 text-xl font-semibold">{title}</h3>
      <p className="mt-2 leading-6 text-slate-400">{description}</p>
    </header>
  );
}

function QualificationEditor({
  qualifications,
  onChange,
}: {
  qualifications: Qualification[];
  onChange: Dispatch<SetStateAction<Qualification[]>>;
}) {
  function update(index: number, field: keyof Qualification, value: string) {
    onChange((items) =>
      items.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, [field]: field === 'completionYear' ? Number(value) || undefined : value }
          : item,
      ),
    );
  }
  return (
    <>
      <SectionHeading
        title="Qualifications"
        description="At least one structured qualification and corresponding evidence are required for Doctor submission."
      />
      {qualifications.map((item, index) => (
        <div key={item.id ?? index} className="grid gap-4 rounded-2xl border border-white/10 bg-slate-950/35 p-4">
          <Field
            label="Degree / qualification"
            value={item.qualificationName}
            onChange={(event) => update(index, 'qualificationName', event.target.value)}
          />
          <Field
            label="Institution"
            value={item.institution}
            onChange={(event) => update(index, 'institution', event.target.value)}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Country"
              value={item.countryCode}
              onChange={(event) => update(index, 'countryCode', event.target.value)}
            />
            <Field
              label="Completion year"
              type="number"
              value={item.completionYear ?? ''}
              onChange={(event) => update(index, 'completionYear', event.target.value)}
            />
          </div>
          <button
            type="button"
            className="justify-self-start text-sm font-semibold text-rose-300"
            onClick={() => onChange((items) => items.filter((_, itemIndex) => itemIndex !== index))}
          >
            Remove qualification
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          onChange((items) => [
            ...items,
            { qualificationName: '', institution: '', countryCode: '', completionYear: undefined },
          ])
        }
        className="inline-flex w-fit items-center gap-2 rounded-2xl border border-white/15 px-4 py-3 text-sm font-semibold"
      >
        <Plus size={16} /> Add qualification
      </button>
    </>
  );
}

function DocumentManager({ application, onReload }: { application: AccessApplication; onReload: () => Promise<void> }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const doctor = application.applicationType === 'DOCTOR';
  const types: { type: ApplicationDocumentType; label: string; requirement: string }[] = doctor
    ? [
        { type: 'CV', label: 'Curriculum vitae', requirement: 'Required' },
        { type: 'MEDICAL_LICENSE', label: 'Medical registration evidence', requirement: 'Required' },
        { type: 'QUALIFICATION', label: 'Qualification evidence', requirement: 'At least one required' },
        { type: 'OTHER', label: 'Additional evidence', requirement: 'Optional' },
      ]
    : [
        { type: 'INSTITUTIONAL_EVIDENCE', label: 'Institutional evidence', requirement: 'When relevant' },
        { type: 'ETHICS_OR_PROJECT_APPROVAL', label: 'Ethics / project approval', requirement: 'When relevant' },
        { type: 'CV', label: 'Curriculum vitae', requirement: 'Optional' },
        { type: 'OTHER', label: 'Other supporting evidence', requirement: 'Optional' },
      ];

  async function upload(type: ApplicationDocumentType, file?: File) {
    if (!file) return;
    setBusy(type);
    setError('');
    try {
      await applicationApi.upload(type, file);
      await onReload();
    } catch (caught) {
      setError(applicationErrorMessage(caught, 'The document could not be uploaded.'));
    } finally {
      setBusy('');
    }
  }
  async function remove(id: string) {
    setBusy(id);
    setError('');
    try {
      await applicationApi.deleteDocument(id);
      await onReload();
    } catch (caught) {
      setError(applicationErrorMessage(caught, 'The document could not be removed.'));
    } finally {
      setBusy('');
    }
  }

  return (
    <>
      <SectionHeading
        title="Supporting evidence"
        description="PDF, JPEG, and PNG only. Files are private and accessed through the Clinora backend."
      />
      {error ? <FormNotice tone="error">{error}</FormNotice> : null}
      <div className="grid gap-4">
        {types.map((definition) => {
          const matching = application.documents.filter((document) => document.documentType === definition.type);
          return (
            <div key={definition.type} className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-white">{definition.label}</h3>
                  <p className="mt-1 text-xs text-slate-400">{definition.requirement}</p>
                </div>
                <label className="cursor-pointer rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-bold text-cyan-100">
                  <input
                    className="sr-only"
                    type="file"
                    accept="application/pdf,image/jpeg,image/png"
                    disabled={Boolean(busy)}
                    onChange={(event) => void upload(definition.type, event.target.files?.[0])}
                  />
                  {busy === definition.type ? 'Uploading…' : 'Upload'}
                </label>
              </div>
              {matching.map((document) => (
                <div
                  key={document.id}
                  className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 px-3 py-2 text-sm"
                >
                  <FileText size={16} className="text-cyan-300" />
                  <span className="min-w-0 flex-1 truncate text-slate-300">{document.originalFilename}</span>
                  <a
                    title="Download document"
                    className="text-slate-400 hover:text-white"
                    href={applicationApi.documentUrl(document.id)}
                  >
                    <Download size={16} />
                  </a>
                  <button
                    type="button"
                    title="Remove document"
                    className="text-rose-300"
                    onClick={() => void remove(document.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </>
  );
}

function ReviewSummary({
  application,
  qualifications,
}: {
  application: AccessApplication;
  qualifications: Qualification[];
}) {
  const doctor = application.applicationType === 'DOCTOR';
  const requiredDocs = doctor ? ['CV', 'MEDICAL_LICENSE', 'QUALIFICATION'] : [];
  return (
    <>
      <SectionHeading
        title="Review & declaration"
        description="Review the evidence before submitting. Submission starts review; it does not activate a professional role."
      />
      <div className="grid gap-3 text-sm">
        {[
          ['Email ownership', application.emailVerifiedAt ? 'Verified' : 'Not verified'],
          ['Professional path', doctor ? 'Doctor' : 'Researcher'],
          ['Qualifications', doctor ? `${qualifications.length} recorded` : 'Not required as a structured list'],
          ['Documents', `${application.documents.length} uploaded`],
          [
            'Required evidence',
            requiredDocs.length
              ? requiredDocs
                  .map((type) =>
                    application.documents.some((document) => document.documentType === type)
                      ? `✓ ${type}`
                      : `Missing ${type}`,
                  )
                  .join(' · ')
              : 'Policy-dependent',
          ],
        ].map(([label, value]) => (
          <div
            key={label}
            className="flex flex-col justify-between gap-1 rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3 sm:flex-row"
          >
            <span className="text-slate-400">{label}</span>
            <span className="font-medium text-slate-100">{value}</span>
          </div>
        ))}
      </div>
      {doctor ? (
        <FormNotice>
          Doctor approval later requires completion of the mandatory onboarding interview. Interview scheduling is
          handled during the review phase.
        </FormNotice>
      ) : (
        <FormNotice>
          Researcher applications move through professional review, decision, and activation. Submitted evidence
          supports review but does not grant dataset access or a Clinora role.
        </FormNotice>
      )}
    </>
  );
}

function StatusTimeline({ application, events }: { application: AccessApplication; events: ApplicationEvent[] }) {
  const doctor = application.applicationType === 'DOCTOR';
  const milestones = doctor
    ? ['Application submitted', 'Professional review', 'Mandatory interview', 'Decision', 'Account activation']
    : ['Application submitted', 'Professional review', 'Decision', 'Account activation'];
  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <AuthCard>
        <SectionHeading
          title="Application progress"
          description="Professional access remains inactive until review and later account activation are complete."
        />
        <ol className="mt-6 grid gap-4">
          {milestones.map((milestone, index) => (
            <li key={milestone} className="flex gap-3">
              <div
                className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border ${index === 0 ? 'border-teal-300/30 bg-teal-300/10 text-teal-200' : 'border-white/15 text-slate-500'}`}
              >
                {index === 0 ? <Check size={14} /> : index + 1}
              </div>
              <span className={index === 0 ? 'font-semibold text-white' : 'text-slate-400'}>{milestone}</span>
            </li>
          ))}
        </ol>
      </AuthCard>
      <AuthCard>
        <SectionHeading title="Updates" description="A non-sensitive history of activity on this application." />
        <div className="mt-5 grid gap-3">
          {events.length ? (
            events.map((event) => (
              <div
                key={`${event.type}-${event.createdAt}`}
                className="rounded-2xl border border-white/10 bg-slate-950/35 p-4"
              >
                <p className="font-medium text-slate-100">{event.message}</p>
                <time className="mt-1 block text-xs text-slate-500">{new Date(event.createdAt).toLocaleString()}</time>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-400">No updates yet.</p>
          )}
        </div>
      </AuthCard>
    </div>
  );
}
