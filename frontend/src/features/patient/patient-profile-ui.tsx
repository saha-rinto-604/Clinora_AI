import { Check, ChevronRight, Circle, HeartPulse } from 'lucide-react';
import { Link } from 'react-router';
import { cn } from '../../lib/cn';
import { bloodGroupLabels, type PatientProfile } from './patient-types';
import { profileSections, sectionCompletion, type ProfileSectionId } from './patient-profile-state';

const sectionDescriptions: Record<ProfileSectionId, string> = {
  personal: 'Date of birth, gender, phone, and address',
  basic: 'Blood group, height, and weight',
  medical: 'Allergies, conditions, medications, and history',
  emergency: 'A trusted person Clinora can keep on record',
};

export function ProfileJourney({ profile }: { profile: PatientProfile }) {
  const completion = sectionCompletion(profile);
  const firstIncomplete = profileSections.find((section) => !completion[section.id])?.id ?? 'personal';

  return (
    <ol className="mt-7 divide-y divide-white/[0.07]" aria-label="Health profile setup steps">
      {profileSections.map(({ id, label }, index) => {
        const completed = completion[id];
        const current = id === firstIncomplete;
        return (
          <li key={id}>
            <Link
              to={`/patient/profile?section=${id}`}
              className="group grid min-h-[78px] grid-cols-[2.75rem_1fr_auto] items-center gap-3 py-3.5 outline-none transition hover:translate-x-0.5 motion-reduce:transform-none"
            >
              <span
                className={cn(
                  'grid h-9 w-9 place-items-center rounded-full border text-xs font-semibold tabular-nums transition',
                  completed
                    ? 'border-teal-300/30 bg-teal-300/[0.08] text-teal-200'
                    : current
                      ? 'border-cyan-300/50 bg-cyan-300/[0.08] text-cyan-100 shadow-[0_0_20px_rgba(14,165,233,.08)]'
                      : 'border-white/[0.09] bg-white/[0.025] text-slate-500',
                )}
              >
                {completed ? <Check size={15} aria-label="Completed" /> : String(index + 1).padStart(2, '0')}
              </span>
              <span className="min-w-0">
                <span
                  className={cn(
                    'block text-sm font-semibold',
                    completed || current ? 'text-slate-100' : 'text-slate-400',
                  )}
                >
                  {label}
                </span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">{sectionDescriptions[id]}</span>
              </span>
              <span className="flex items-center gap-2 pl-2 text-xs font-medium text-slate-500 group-hover:text-cyan-200">
                {completed ? 'Review' : current ? 'Continue' : 'Open'}
                <ChevronRight size={15} aria-hidden="true" />
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

export function ProfileSignalRail({
  profile,
  active,
  onSelect,
}: {
  profile: PatientProfile;
  active: ProfileSectionId | 'review';
  onSelect: (section: ProfileSectionId) => void;
}) {
  const completion = sectionCompletion(profile);

  return (
    <nav aria-label="Health profile steps" className="relative mt-7">
      <div className="absolute left-[10%] right-[10%] top-4 hidden h-px bg-white/[0.09] sm:block" aria-hidden="true" />
      <div className="grid grid-cols-4 gap-2 sm:gap-4">
        {profileSections.map(({ id, label }, index) => {
          const completed = completion[id];
          const current = active === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              aria-current={current ? 'step' : undefined}
              className="group relative z-10 flex min-h-16 flex-col items-center gap-2 rounded-xl px-1 text-center outline-none sm:min-h-20"
            >
              <span
                className={cn(
                  'grid h-8 w-8 place-items-center rounded-full border bg-[#07101f] text-xs font-semibold tabular-nums transition duration-200',
                  completed
                    ? 'border-teal-300/40 text-teal-200'
                    : current
                      ? 'border-cyan-300/70 text-cyan-100 shadow-[0_0_0_4px_rgba(14,165,233,.08)]'
                      : 'border-white/[0.11] text-slate-500 group-hover:border-white/20 group-hover:text-slate-300',
                )}
              >
                {completed ? <Check size={14} aria-label="Completed" /> : String(index + 1).padStart(2, '0')}
              </span>
              <span
                className={cn(
                  'text-[11px] font-medium leading-4 sm:text-xs',
                  current ? 'text-cyan-100' : 'text-slate-500',
                )}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function ProfileOverview({ profile }: { profile: PatientProfile }) {
  const rows = [
    ['Blood group', profile.bloodGroup ? bloodGroupLabels[profile.bloodGroup] : 'Not added'],
    ['Date of birth', formatDate(profile.dateOfBirth)],
    ['Height / weight', measurementValue(profile)],
    ['Allergies', listValue(profile.allergies, profile.profileCreated)],
    ['Conditions', listValue(profile.chronicConditions, profile.profileCreated)],
    ['Current medications', listValue(profile.currentMedications, profile.profileCreated)],
    [
      'Emergency contact',
      profile.emergencyContact.configured
        ? `${profile.emergencyContact.name} · ${profile.emergencyContact.relationship}`
        : 'Not added',
    ],
  ];

  return (
    <dl className="mt-7 grid gap-x-8 md:grid-cols-2">
      {rows.map(([label, value]) => (
        <div
          key={label}
          className="grid gap-1 border-t border-white/[0.07] py-4 first:border-t-0 md:first:border-t md:[&:nth-child(2)]:border-t-0"
        >
          <dt className="text-xs font-medium text-slate-500">{label}</dt>
          <dd className="break-words text-sm font-medium leading-6 text-slate-100">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ProfileCompletionMark({ complete }: { complete: boolean }) {
  return complete ? (
    <Check size={15} className="text-teal-200" aria-label="Completed" />
  ) : (
    <Circle size={11} className="text-slate-600" aria-label="Incomplete" />
  );
}

export function HealthMark() {
  return <HeartPulse size={18} aria-hidden="true" />;
}

export function listValue(items: string[], profileCreated: boolean) {
  if (items.length) return items.join(', ');
  return profileCreated ? 'None recorded' : 'Not added';
}

export function formatDate(value: string | null) {
  if (!value) return 'Not added';
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function measurementValue(profile: PatientProfile) {
  if (!profile.heightCm && !profile.weightKg) return 'Not added';
  const height = profile.heightCm ? `${profile.heightCm} cm` : 'Height not added';
  const weight = profile.weightKg ? `${profile.weightKg} kg` : 'Weight not added';
  return `${height} · ${weight}`;
}
