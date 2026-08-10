import { z } from 'zod';
import type { Dispatch, SetStateAction } from 'react';
import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import type { AccessApplication, Qualification } from './application-types';
import { ApplicationDocumentManager } from './application-documents';
import { ApplicationReviewSummary } from './application-review';
import { ApplicationField, ApplicationSecondaryButton, ApplicationTextArea } from './application-ui';
import { Plus } from 'lucide-react';

export const profileSchema = z.object({
  firstName: z.string().trim().min(1, 'Enter your first name.'),
  lastName: z.string().trim().min(1, 'Enter your last name.'),
  phone: z.string().trim().min(5, 'Enter a phone number.'),
  countryCode: z.string().trim().min(2, 'Enter your country.'),
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

export type ProfileValues = z.infer<typeof profileSchema>;

export const doctorSteps = [
  'Identity & contact',
  'Professional practice',
  'Registration',
  'Qualifications',
  'Supporting documents',
  'Review',
];

export const researcherSteps = [
  'Identity & contact',
  'Institution & role',
  'Research profile',
  'Research purpose',
  'Supporting documents',
  'Review',
];

export function applicationStepDescription(application: AccessApplication, step: number) {
  const doctor = application.applicationType === 'DOCTOR';
  if (step === 0) return 'We’ll use these details for application updates and reviewer contact.';
  if (doctor && step === 1) return 'Tell us about your current clinical role and professional experience.';
  if (doctor && step === 2)
    return 'Provide the registration details reviewers can compare with the appropriate authority.';
  if (doctor && step === 3) return 'Add at least one professional qualification relevant to your clinical practice.';
  if (doctor && step === 4) return 'Add the documents required to support your professional credentials.';
  if (!doctor && step === 1) return 'Tell us where you work or study and the professional role you hold there.';
  if (!doctor && step === 2) return 'Describe your research area and add optional professional identifiers.';
  if (!doctor && step === 3) return 'Explain what you hope to do with professional access to Clinora.';
  if (!doctor && step === 4) return 'Supporting documents are optional unless they are relevant to your application.';
  return 'Check the information below before you submit your application.';
}

export function ApplicationStepFields({
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
        <div className="grid gap-4 sm:grid-cols-2">
          <ApplicationField label="First name" required {...register('firstName')} error={errors.firstName?.message} />
          <ApplicationField label="Last name" required {...register('lastName')} error={errors.lastName?.message} />
        </div>
        <ApplicationField
          label="Phone number"
          type="tel"
          required
          {...register('phone')}
          error={errors.phone?.message}
        />
        <ApplicationField label="Country" required {...register('countryCode')} error={errors.countryCode?.message} />
      </>
    );
  }

  if (doctor && step === 1) {
    return (
      <>
        <div className="grid gap-4 sm:grid-cols-2">
          <ApplicationField label="Professional title" required {...register('professionalTitle')} />
          <ApplicationField label="Specialization" required {...register('specialization')} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <ApplicationField
            label="Years of experience"
            type="number"
            min="0"
            required
            {...register('yearsExperience')}
          />
          <ApplicationField label="Current position" required {...register('currentPosition')} />
        </div>
        <ApplicationField label="Current organization or practice" required {...register('currentOrganization')} />
        <ApplicationField
          label="Professional profile URL"
          type="url"
          {...register('professionalProfileUrl')}
          hint="Optional"
        />
      </>
    );
  }

  if (doctor && step === 2) {
    return (
      <>
        <div className="grid gap-4 sm:grid-cols-2">
          <ApplicationField
            label="Registration country or jurisdiction"
            required
            {...register('registrationJurisdiction')}
            placeholder="Bangladesh"
          />
          <ApplicationField
            label="Registration authority"
            required
            {...register('registrationAuthority')}
            placeholder="Bangladesh Medical & Dental Council"
          />
        </div>
        <ApplicationField label="Registration number" required {...register('registrationNumber')} />
        <ApplicationField label="Registration type" {...register('registrationType')} hint="Optional" />
        <div className="grid gap-4 sm:grid-cols-2">
          <ApplicationField label="Issue date" type="date" {...register('registrationIssuedAt')} hint="Optional" />
          <ApplicationField label="Valid until" type="date" {...register('registrationValidUntil')} hint="Optional" />
        </div>
      </>
    );
  }

  if (doctor && step === 3) {
    return <QualificationEditor qualifications={qualifications} onChange={setQualifications} />;
  }

  if (doctor && step === 4) {
    return <ApplicationDocumentManager application={application} onReload={onReload} />;
  }

  if (!doctor && step === 1) {
    return (
      <>
        <ApplicationField label="Institution or organization" required {...register('institution')} />
        <div className="grid gap-4 sm:grid-cols-2">
          <ApplicationField label="Department" {...register('department')} hint="Optional" />
          <ApplicationField label="Professional title" required {...register('professionalTitle')} />
        </div>
        <ApplicationField
          label="Institutional profile URL"
          type="url"
          {...register('institutionalProfileUrl')}
          hint="Optional"
        />
      </>
    );
  }

  if (!doctor && step === 2) {
    return (
      <>
        <ApplicationField label="Research field" required {...register('researchField')} />
        <ApplicationTextArea label="Research summary" {...register('researchSummary')} hint="Optional" />
        <div className="grid gap-4 sm:grid-cols-2">
          <ApplicationField
            label="ORCID iD"
            {...register('orcid')}
            placeholder="0000-0000-0000-0000"
            hint="Optional identifier"
          />
          <ApplicationField
            label="Research profile URL"
            type="url"
            {...register('researchProfileUrl')}
            hint="Optional"
          />
        </div>
        <ApplicationField
          label="Publication profile URL"
          type="url"
          {...register('publicationProfileUrl')}
          hint="Optional"
        />
      </>
    );
  }

  if (!doctor && step === 3) {
    return (
      <>
        <ApplicationTextArea label="Research purpose" required {...register('researchPurpose')} />
        <div className="grid gap-4 sm:grid-cols-2">
          <ApplicationField
            label="Ethics reference"
            {...register('ethicsReference')}
            hint="Optional · Add if relevant to your project"
          />
          <ApplicationField
            label="Project approval reference"
            {...register('projectApprovalReference')}
            hint="Optional · Add if relevant to your project"
          />
        </div>
      </>
    );
  }

  if (!doctor && step === 4) {
    return <ApplicationDocumentManager application={application} onReload={onReload} />;
  }

  return <ApplicationReviewSummary application={application} qualifications={qualifications} />;
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
    <div className="grid gap-5">
      {qualifications.length ? (
        qualifications.map((item, index) => (
          <fieldset
            key={item.id ?? index}
            className="grid gap-4 border-b border-white/10 pb-5 last:border-b-0 last:pb-0"
          >
            <legend className="mb-1 text-sm font-semibold text-slate-200">Qualification {index + 1}</legend>
            <ApplicationField
              label="Degree or qualification"
              required
              value={item.qualificationName}
              onChange={(event) => update(index, 'qualificationName', event.target.value)}
            />
            <ApplicationField
              label="Institution"
              required
              value={item.institution}
              onChange={(event) => update(index, 'institution', event.target.value)}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <ApplicationField
                label="Country"
                required
                value={item.countryCode}
                onChange={(event) => update(index, 'countryCode', event.target.value)}
              />
              <ApplicationField
                label="Completion year"
                type="number"
                required
                value={item.completionYear ?? ''}
                onChange={(event) => update(index, 'completionYear', event.target.value)}
              />
            </div>
            <button
              type="button"
              className="justify-self-start text-xs font-medium text-rose-300 transition hover:text-rose-200"
              onClick={() => onChange((items) => items.filter((_, itemIndex) => itemIndex !== index))}
            >
              Remove qualification
            </button>
          </fieldset>
        ))
      ) : (
        <p className="text-sm leading-6 text-slate-400">
          Add at least one qualification before submitting your Doctor application.
        </p>
      )}
      <ApplicationSecondaryButton
        type="button"
        onClick={() =>
          onChange((items) => [
            ...items,
            { qualificationName: '', institution: '', countryCode: '', completionYear: undefined },
          ])
        }
        className="w-fit"
      >
        <Plus size={15} aria-hidden="true" /> Add qualification
      </ApplicationSecondaryButton>
    </div>
  );
}
