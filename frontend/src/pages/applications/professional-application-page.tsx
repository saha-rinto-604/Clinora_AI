import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, CheckCircle2, FileCheck2, MailCheck, Save, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { z } from 'zod';
import { applicationApi, applicationErrorMessage } from '../../features/access-applications/application-api';
import type { ApplicationType } from '../../features/access-applications/application-types';
import { AuthCard, Field, FormNotice, SubmitButton } from '../../features/auth/auth-ui';

const schema = z.object({
  firstName: z.string().trim().min(1, 'First name is required.'),
  lastName: z.string().trim().min(1, 'Last name is required.'),
  email: z.string().trim().email('Enter a valid email address.'),
  phone: z.string().trim().min(5, 'Enter a phone or contact number.'),
  countryCode: z.string().trim().min(2, 'Enter your country or jurisdiction.'),
  consentToApplicationProcessing: z
    .boolean()
    .refine(Boolean, 'Consent is required to start a professional application.'),
});

type FormValues = z.infer<typeof schema>;

const doctorRequirements = [
  'Professional practice and specialization details',
  'Registration authority and license / registration number',
  'At least one structured qualification',
  'CV, registration evidence, and qualification evidence',
  'Mandatory onboarding interview later in the review process',
];

const researcherRequirements = [
  'Institution / organization and professional role',
  'Research field, purpose, and supporting context',
  'Institutional or project evidence when relevant',
  'Optional ORCID and professional / publication profile links',
  'Professional review, decision, and activation path',
];

export function ProfessionalApplicationPage({ type }: { type: ApplicationType }) {
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [error, setError] = useState('');
  const requirements = type === 'DOCTOR' ? doctorRequirements : researcherRequirements;
  const roleName = type === 'DOCTOR' ? 'Doctor' : 'Researcher';
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { consentToApplicationProcessing: false } });

  async function onSubmit(values: FormValues) {
    setError('');
    try {
      await applicationApi.create(type, values);
      setSubmittedEmail(values.email);
    } catch (caught) {
      setError(applicationErrorMessage(caught, 'The application could not be started.'));
    }
  }

  if (submittedEmail) {
    return (
      <AuthCard>
        <div className="grid gap-6 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-emerald-300/20 bg-emerald-300/10">
            <MailCheck className="text-emerald-200" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Email verification</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em]">Check your inbox</h1>
            <p className="mt-3 leading-7 text-slate-300">
              We sent a single-use verification link to <strong className="text-white">{submittedEmail}</strong>.
              Professional information and documents are collected only after email ownership is verified.
            </p>
          </div>
          <FormNotice>
            Verification confirms control of the email address only. It does not approve professional credentials or
            grant a Clinora role.
          </FormNotice>
          <Link className="font-semibold text-cyan-300 hover:text-cyan-200" to="/application/status">
            Already verified? Resume your application
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <div className="grid gap-7 xl:grid-cols-[0.88fr_1.12fr]">
      <section className="rounded-[30px] border border-white/10 bg-white/[0.035] p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Before you begin</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Apply for {roleName} access</h1>
        <p className="mt-4 leading-7 text-slate-300">
          Start with contact ownership. After verification, Clinora opens a private, resumable professional application
          workspace.
        </p>
        <div className="mt-7 grid gap-3">
          {requirements.map((item) => (
            <div
              key={item}
              className="flex gap-3 rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3 text-sm text-slate-300"
            >
              <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-teal-300" aria-hidden="true" />
              {item}
            </div>
          ))}
        </div>
        <div className="mt-7 grid gap-3 text-sm text-slate-400">
          <span className="flex gap-3">
            <Save size={17} className="text-cyan-300" />
            Save and resume later
          </span>
          <span className="flex gap-3">
            <FileCheck2 size={17} className="text-cyan-300" />
            Private evidence upload after verification
          </span>
          <span className="flex gap-3">
            <ShieldCheck size={17} className="text-cyan-300" />
            No professional role before review and activation
          </span>
        </div>
      </section>

      <AuthCard>
        <header className="mb-7">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Step 1 · Identity & contact</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em]">Start your application</h2>
          <p className="mt-3 leading-7 text-slate-300">
            Use an email address you control. Researchers should prefer an institutional address when available.
          </p>
        </header>
        <form className="grid gap-5" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="First name"
              autoComplete="given-name"
              {...register('firstName')}
              error={errors.firstName?.message}
            />
            <Field
              label="Last name"
              autoComplete="family-name"
              {...register('lastName')}
              error={errors.lastName?.message}
            />
          </div>
          <Field label="Email" type="email" autoComplete="email" {...register('email')} error={errors.email?.message} />
          <Field
            label="Phone / contact number"
            type="tel"
            autoComplete="tel"
            {...register('phone')}
            error={errors.phone?.message}
          />
          <Field
            label="Country / jurisdiction"
            {...register('countryCode')}
            error={errors.countryCode?.message}
            placeholder="Bangladesh"
          />
          <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/35 p-4 text-sm leading-6 text-slate-300">
            <input className="mt-1" type="checkbox" {...register('consentToApplicationProcessing')} />
            <span>
              I agree that Clinora may process the information I submit for professional access review. This does not
              grant or certify a professional role.
              {errors.consentToApplicationProcessing?.message ? (
                <span className="mt-1 block text-xs font-medium text-rose-300">
                  {errors.consentToApplicationProcessing.message}
                </span>
              ) : null}
            </span>
          </label>
          {error ? <FormNotice tone="error">{error}</FormNotice> : null}
          <SubmitButton loading={isSubmitting}>
            Verify email and continue <ArrowRight size={17} aria-hidden="true" />
          </SubmitButton>
        </form>
      </AuthCard>
    </div>
  );
}
