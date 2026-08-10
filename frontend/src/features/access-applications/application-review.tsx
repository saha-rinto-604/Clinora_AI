import type { ReactNode } from 'react';
import type { AccessApplication, Qualification } from './application-types';

export function ApplicationReviewSummary({
  application,
  qualifications,
}: {
  application: AccessApplication;
  qualifications: Qualification[];
}) {
  const doctor = application.applicationType === 'DOCTOR';

  if (!doctor) {
    return (
      <div className="grid gap-5">
        <ReviewGroup title="Contact">
          <ReviewRow
            label="Email"
            value={application.emailVerifiedAt ? 'Verified' : 'Not verified'}
            good={Boolean(application.emailVerifiedAt)}
          />
          <ReviewRow label="Name" value={`${application.firstName} ${application.lastName}`} />
        </ReviewGroup>
        <ReviewGroup title="Research profile">
          <ReviewRow label="Institution" value={application.researcher?.institution || 'Not provided'} />
          <ReviewRow label="Research field" value={application.researcher?.researchField || 'Not provided'} />
          <ReviewRow
            label="Research purpose"
            value={application.researcher?.researchPurpose ? 'Provided' : 'Not provided'}
          />
        </ReviewGroup>
        <ReviewGroup title="Supporting documents">
          <ReviewRow
            label="Documents"
            value={application.documents.length ? `${application.documents.length} added` : 'None added · optional'}
          />
        </ReviewGroup>
        <div className="border-l-2 border-cyan-300/40 pl-4">
          <h3 className="text-sm font-semibold text-slate-100">What happens next?</h3>
          <p className="mt-1.5 text-sm leading-6 text-slate-400">
            After you submit, our team will review your application. If we need more information, we’ll contact you by
            email. Approval does not automatically provide access to research datasets.
          </p>
        </div>
      </div>
    );
  }

  const requiredDocuments = [
    { type: 'CV' as const, label: 'Curriculum vitae' },
    { type: 'MEDICAL_LICENSE' as const, label: 'Medical registration evidence' },
    { type: 'QUALIFICATION' as const, label: 'Qualification evidence' },
  ];

  return (
    <div className="grid gap-5">
      <ReviewGroup title="Contact">
        <ReviewRow
          label="Email"
          value={application.emailVerifiedAt ? 'Verified' : 'Not verified'}
          good={Boolean(application.emailVerifiedAt)}
        />
        <ReviewRow label="Name" value={`${application.firstName} ${application.lastName}`} />
      </ReviewGroup>
      <ReviewGroup title="Professional profile">
        <ReviewRow label="Professional title" value={application.doctor?.professionalTitle || 'Not provided'} />
        <ReviewRow label="Specialization" value={application.doctor?.specialization || 'Not provided'} />
      </ReviewGroup>
      <ReviewGroup title="Medical registration">
        <ReviewRow label="Authority" value={application.doctor?.registrationAuthority || 'Not provided'} />
        <ReviewRow label="Registration number" value={application.doctor?.registrationNumber || 'Not provided'} />
      </ReviewGroup>
      <ReviewGroup title="Qualifications & documents">
        <ReviewRow
          label="Qualifications"
          value={`${qualifications.length} recorded`}
          good={qualifications.length > 0}
        />
        {requiredDocuments.map((definition) => {
          const present = application.documents.some((document) => document.documentType === definition.type);
          return (
            <ReviewRow
              key={definition.type}
              label={definition.label}
              value={present ? 'Added' : 'Missing'}
              good={present}
              warn={!present}
            />
          );
        })}
      </ReviewGroup>
      <div className="border-l-2 border-cyan-300/40 pl-4">
        <h3 className="text-sm font-semibold text-slate-100">What happens next?</h3>
        <p className="mt-1.5 text-sm leading-6 text-slate-400">
          After submission, your credentials will be reviewed. Doctor approval later requires the mandatory onboarding
          interview before account activation.
        </p>
      </div>
    </div>
  );
}

function ReviewGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{title}</h3>
      <dl className="divide-y divide-white/[0.08] border-y border-white/[0.08]">{children}</dl>
    </section>
  );
}

function ReviewRow({
  label,
  value,
  good = false,
  warn = false,
}: {
  label: string;
  value: string;
  good?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <dt className="text-slate-400">{label}</dt>
      <dd
        className={
          warn ? 'font-medium text-amber-200' : good ? 'font-medium text-teal-200' : 'font-medium text-slate-200'
        }
      >
        {value}
      </dd>
    </div>
  );
}
