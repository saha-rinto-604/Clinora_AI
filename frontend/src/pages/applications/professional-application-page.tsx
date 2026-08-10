import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Check, MailCheck } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { z } from 'zod';
import { applicationApi, applicationErrorMessage } from '../../features/access-applications/application-api';
import type { ApplicationType } from '../../features/access-applications/application-types';
import {
  ApplicationField,
  ApplicationNotice,
  ApplicationPanel,
  ApplicationPrimaryButton,
} from '../../features/access-applications/application-ui';

const schema = z.object({
  firstName: z.string().trim().min(1, 'Enter your first name.'),
  lastName: z.string().trim().min(1, 'Enter your last name.'),
  email: z.string().trim().email('Enter a valid email address.'),
  phone: z.string().trim().min(5, 'Enter a phone number.'),
  countryCode: z.string().trim().min(2, 'Enter your country.'),
  consentToApplicationProcessing: z.boolean().refine(Boolean, 'Please confirm before continuing.'),
});

type FormValues = z.infer<typeof schema>;

const doctorRequirements = [
  'Professional role and specialization',
  'Medical registration details',
  'At least one qualification',
  'CV, registration, and qualification documents',
  'Mandatory onboarding interview during the later review process',
];

const researcherRequirements = [
  'Institution / organization and professional role',
  'Research field and intended use of Clinora',
  'Optional ORCID and professional profile links',
  'Supporting institutional or project documents when relevant',
  'Professional review before account activation',
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
      setError(applicationErrorMessage(caught, 'We could not start your application. Please try again.'));
    }
  }

  if (submittedEmail) {
    return (
      <div className="mx-auto max-w-lg pt-6 sm:pt-10">
        <ApplicationPanel className="text-center">
          <div className="mx-auto grid h-11 w-11 place-items-center rounded-xl border border-emerald-300/[0.18] bg-emerald-300/[0.07]">
            <MailCheck size={20} className="text-emerald-200" aria-hidden="true" />
          </div>
          <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-300">Email verification</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-white">Check your inbox</h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
            We sent a single-use verification link to{' '}
            <strong className="font-medium text-slate-200">{submittedEmail}</strong>. Once your email is verified, you
            can continue your private {roleName.toLowerCase()} application.
          </p>
          <ApplicationNotice className="mt-5 text-left">
            Verifying your email confirms that you control the address. Professional access is granted only after review
            and activation.
          </ApplicationNotice>
          <Link
            className="mt-5 inline-flex text-sm font-medium text-cyan-300 transition hover:text-cyan-200"
            to="/application/status"
          >
            Already verified? Resume your application
          </Link>
        </ApplicationPanel>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-[1080px] gap-10 py-3 lg:grid-cols-[0.78fr_1.22fr] lg:items-start lg:gap-14 lg:py-7">
      <section className="pt-2 lg:sticky lg:top-24">
        <p className="text-[11px] font-semibold uppercase tracking-[0.17em] text-cyan-300">Professional access</p>
        <h1 className="mt-3 max-w-md text-3xl font-semibold tracking-[-0.035em] text-white sm:text-4xl">
          Apply for {roleName} access
        </h1>
        <p className="mt-4 max-w-md text-sm leading-7 text-slate-400">
          Start with your contact details. We’ll verify your email before asking for professional information or
          documents.
        </p>

        <div className="mt-7 border-y border-white/[0.08] py-2">
          {requirements.map((item) => (
            <div
              key={item}
              className="flex gap-3 border-b border-white/[0.06] py-3 text-sm leading-6 text-slate-400 last:border-b-0"
            >
              <Check size={15} className="mt-1 shrink-0 text-teal-300" aria-hidden="true" />
              <span>{item}</span>
            </div>
          ))}
        </div>

        <p className="mt-5 max-w-md text-xs leading-5 text-slate-500">
          You can save and resume later. Submitting an application does not create or activate a professional Clinora
          role.
        </p>
        <div className="mt-5 border-t border-white/[0.08] pt-4">
          <p className="text-xs text-slate-500">Already started or submitted an application?</p>
          <Link
            to="/application/status"
            className="mt-1 inline-flex text-sm font-medium text-cyan-300 transition hover:text-cyan-200"
          >
            Continue your application
          </Link>
        </div>
      </section>

      <ApplicationPanel>
        <header className="mb-6 border-b border-white/[0.08] pb-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-300">Start application</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-white">Identity & contact</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Use an email address you can access. Researchers may use an institutional address when available.
          </p>
        </header>

        <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <ApplicationField
              label="First name"
              required
              autoComplete="given-name"
              {...register('firstName')}
              error={errors.firstName?.message}
            />
            <ApplicationField
              label="Last name"
              required
              autoComplete="family-name"
              {...register('lastName')}
              error={errors.lastName?.message}
            />
          </div>
          <ApplicationField
            label="Email"
            type="email"
            required
            autoComplete="email"
            {...register('email')}
            error={errors.email?.message}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <ApplicationField
              label="Phone number"
              type="tel"
              required
              autoComplete="tel"
              {...register('phone')}
              error={errors.phone?.message}
            />
            <ApplicationField
              label="Country"
              required
              {...register('countryCode')}
              error={errors.countryCode?.message}
              placeholder="Bangladesh"
            />
          </div>

          <label className="flex items-start gap-3 border-t border-white/[0.08] pt-4 text-sm leading-6 text-slate-400">
            <input
              className="mt-1 h-4 w-4 shrink-0 accent-cyan-400"
              type="checkbox"
              {...register('consentToApplicationProcessing')}
            />
            <span>
              I agree that Clinora may use the information I submit to review this professional access application.
              {errors.consentToApplicationProcessing?.message ? (
                <span className="mt-1 block text-xs font-medium text-rose-300">
                  {errors.consentToApplicationProcessing.message}
                </span>
              ) : null}
            </span>
          </label>

          {error ? <ApplicationNotice tone="error">{error}</ApplicationNotice> : null}

          <div className="flex justify-end pt-1">
            <ApplicationPrimaryButton loading={isSubmitting} type="submit" className="w-full sm:w-auto sm:min-w-48">
              Verify email <ArrowRight size={15} aria-hidden="true" />
            </ApplicationPrimaryButton>
          </div>
        </form>
      </ApplicationPanel>
    </div>
  );
}
