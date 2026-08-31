import { Check } from 'lucide-react';
import { cn } from '../../lib/cn';
import type { PatientProfile } from './patient-types';
import { profileSections, sectionCompletion, type ProfileSectionId } from './patient-profile-state';

const sectionDescriptions: Record<ProfileSectionId, string> = {
  personal: 'Date of birth, gender, phone, and address',
  basic: 'Blood group, height, and weight',
  medical: 'Allergies, conditions, medications, and history',
  emergency: 'A trusted person Clinora can keep on record',
};

export function ProfileSignalRail({
  profile,
  active,
  onSelect,
}: {
  profile: PatientProfile;
  active: ProfileSectionId;
  onSelect: (section: ProfileSectionId) => void;
}) {
  const completion = sectionCompletion(profile);

  return (
    <nav
      aria-label="Health Profile sections"
      className="rounded-[22px] border border-white/[0.08] bg-[#081221]/80 p-3 lg:sticky lg:top-6 lg:col-span-3 lg:p-4"
    >
      <label className="block lg:hidden">
        <span className="mb-2 block text-xs font-semibold text-slate-400">Profile section</span>
        <select
          value={active}
          onChange={(event) => onSelect(event.target.value as ProfileSectionId)}
          className="min-h-12 w-full rounded-xl border border-white/10 bg-[#0b1424] px-3 text-sm font-semibold text-white outline-none focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
        >
          {profileSections.map(({ id, label }, index) => (
            <option key={id} value={id}>
              {String(index + 1).padStart(2, '0')} {label}
            </option>
          ))}
        </select>
      </label>

      <div className="hidden lg:block">
        <p className="px-2 pb-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Health Profile</p>
        {profileSections.map(({ id, label }, index) => {
          const completed = completion[id];
          const current = active === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              aria-current={current ? 'step' : undefined}
              className={cn(
                'group flex w-full items-start gap-3 rounded-xl px-2 py-3 text-left outline-none transition',
                current ? 'bg-cyan-300/[0.07]' : 'hover:bg-white/[0.035]',
              )}
            >
              <span
                className={cn(
                  'grid h-8 w-8 shrink-0 place-items-center rounded-full border bg-[#07101f] text-xs font-semibold tabular-nums transition duration-200',
                  completed
                    ? 'border-teal-300/40 text-teal-200'
                    : current
                      ? 'border-cyan-300/70 text-cyan-100 shadow-[0_0_0_4px_rgba(14,165,233,.08)]'
                      : 'border-white/[0.11] text-slate-500 group-hover:border-white/20 group-hover:text-slate-300',
                )}
              >
                {completed ? <Check size={14} aria-label="Completed" /> : String(index + 1).padStart(2, '0')}
              </span>
              <span className="min-w-0 pt-0.5">
                <span className={cn('block text-sm font-semibold', current ? 'text-cyan-100' : 'text-slate-300')}>
                  {label}
                </span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">{sectionDescriptions[id]}</span>
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
