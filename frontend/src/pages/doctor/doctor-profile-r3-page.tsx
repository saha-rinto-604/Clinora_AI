import type { LucideIcon } from 'lucide-react';
import {
  BadgeCheck,
  BriefcaseBusiness,
  CalendarClock,
  ChevronDown,
  Download,
  ExternalLink,
  FileText,
  GraduationCap,
  MapPin,
  ShieldCheck,
  SlidersHorizontal,
  Stethoscope,
  UserRound,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router';
import { StatusPill } from '../../components/app/app-ui';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/feedback';
import {
  doctorProfileApi,
  doctorProfileError,
  type DoctorEditableProfile,
  type DoctorProfessionalProfile,
} from '../../features/doctor/doctor-profile-api';
import { ProfileAvatar, ProfileImageEditor } from '../../features/profile/profile-image';
import { cn } from '../../lib/cn';

const blankEditable: DoctorEditableProfile = {
  professionalBio: null,
  professionalProfileUrl: null,
  displayTitle: null,
  currentOrganization: null,
  currentPosition: null,
  preferredTimezone: null,
  defaultConsultationMinutes: null,
};

type ProfileTab = 'public' | 'preferences' | 'credentials';

const tabs: Array<{ id: ProfileTab; label: string; icon: LucideIcon }> = [
  { id: 'public', label: 'Public profile', icon: UserRound },
  { id: 'preferences', label: 'Practice preferences', icon: SlidersHorizontal },
  { id: 'credentials', label: 'Credentials & verification', icon: ShieldCheck },
];

export function DoctorProfilePage() {
  const [profile, setProfile] = useState<DoctorProfessionalProfile | null>(null);
  const [draft, setDraft] = useState<DoctorEditableProfile>(blankEditable);
  const [activeTab, setActiveTab] = useState<ProfileTab>('public');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const next = await doctorProfileApi.profile();
      setProfile(next);
      setDraft(next.editable);
    } catch (requestError) {
      setLoadError(doctorProfileError(requestError, 'We could not load your professional profile.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = useMemo(
    () => Boolean(profile) && JSON.stringify(draft) !== JSON.stringify(profile?.editable),
    [draft, profile],
  );

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  if (loading) {
    return (
      <div className="space-y-5" role="status" aria-label="Loading professional profile">
        <Skeleton className="h-28 rounded-[18px]" />
        <Skeleton className="h-12 rounded-[14px]" />
        <Skeleton className="h-[34rem] rounded-[18px]" />
      </div>
    );
  }

  if (loadError || !profile) {
    return (
      <section className="clinora-r3-panel p-5 sm:p-6">
        <p role="alert" className="text-sm text-amber-100">
          {loadError || 'Your professional profile is unavailable.'}
        </p>
        <Button variant="appSecondary" className="mt-4" onClick={() => void load()}>
          Try again
        </Button>
      </section>
    );
  }

  const update = <K extends keyof DoctorEditableProfile>(key: K, value: DoctorEditableProfile[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setMessage('');
    setSaveError('');
  };

  const save = async () => {
    setSaving(true);
    setSaveError('');
    setMessage('');
    try {
      const next = await doctorProfileApi.update({ version: profile.version, ...draft });
      setProfile(next);
      setDraft(next.editable);
      setMessage('Professional profile updated.');
    } catch (requestError) {
      setSaveError(
        doctorProfileError(requestError, 'We could not save your professional profile. Your changes are still here.'),
      );
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setDraft(profile.editable);
    setSaveError('');
    setMessage('');
  };

  return (
    <div className="space-y-6">
      <header className="clinora-r3-panel clinora-r3-panel--raised overflow-hidden">
        <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
            <ProfileImageEditor name={profile.displayName} compact />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-[-0.04em] text-white sm:text-3xl">
                  {profile.displayName}
                </h1>
                <StatusPill tone="success">
                  <BadgeCheck size={12} aria-hidden="true" /> Clinora verified
                </StatusPill>
              </div>
              <p className="mt-1.5 text-sm font-semibold text-cyan-200">{profile.specialization}</p>
              <p className="mt-1 text-sm text-slate-500">
                {[
                  draft.displayTitle || profile.credentials.verifiedProfessionalTitle,
                  draft.currentPosition,
                  draft.currentOrganization,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-[14px] border border-white/[0.06] bg-black/10 px-4 py-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600">Profile readiness</p>
              <p className="mt-1 text-sm font-semibold text-white">{profile.readiness.percent}% complete</p>
            </div>
            <div className="h-9 w-px bg-white/[0.06]" aria-hidden="true" />
            <p className="max-w-[11rem] text-[10px] leading-4 text-slate-600">
              Approval is complete. This measures optional presentation and booking setup only.
            </p>
          </div>
        </div>
      </header>

      <div
        className="flex max-w-full gap-1 overflow-x-auto border-b border-white/[0.06]"
        role="tablist"
        aria-label="Professional profile sections"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'relative inline-flex min-h-11 shrink-0 items-center gap-2 px-3 text-xs font-semibold transition-colors',
                active ? 'text-white' : 'text-slate-600 hover:text-slate-300',
              )}
            >
              <Icon size={14} aria-hidden="true" /> {tab.label}
              {active ? (
                <span
                  className="absolute inset-x-2 bottom-[-1px] h-[2px] rounded-full bg-cyan-300"
                  aria-hidden="true"
                />
              ) : null}
            </button>
          );
        })}
      </div>

      {message ? (
        <p
          role="status"
          className="rounded-[12px] border border-teal-300/[0.12] bg-teal-300/[0.045] px-4 py-3 text-sm text-teal-100"
        >
          {message}
        </p>
      ) : null}
      {saveError ? (
        <p
          role="alert"
          className="rounded-[12px] border border-rose-300/[0.12] bg-rose-300/[0.045] px-4 py-3 text-sm text-rose-200"
        >
          {saveError}
        </p>
      ) : null}

      {activeTab === 'public' ? <PublicProfileTab profile={profile} draft={draft} update={update} /> : null}

      {activeTab === 'preferences' ? <PreferencesTab draft={draft} update={update} /> : null}

      {activeTab === 'credentials' ? <CredentialsTab profile={profile} /> : null}

      {activeTab !== 'credentials' ? (
        <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 flex flex-col gap-3 rounded-[14px] border border-white/[0.08] bg-[#07111b]/95 px-4 py-3 shadow-[0_18px_50px_rgba(0,0,0,.28)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between lg:bottom-4">
          <p className={cn('text-xs', dirty ? 'text-amber-100' : 'text-slate-600')}>
            {dirty ? 'You have unsaved changes.' : `Last saved ${formatDate(profile.updatedAt)}`}
          </p>
          <div className="flex gap-2">
            <Button variant="appSecondary" size="sm" disabled={!dirty || saving} onClick={reset}>
              Discard
            </Button>
            <Button variant="appPrimary" size="sm" disabled={!dirty || saving} onClick={() => void save()}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PublicProfileTab({
  profile,
  draft,
  update,
}: {
  profile: DoctorProfessionalProfile;
  draft: DoctorEditableProfile;
  update: <K extends keyof DoctorEditableProfile>(key: K, value: DoctorEditableProfile[K]) => void;
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="clinora-r3-panel overflow-hidden" aria-labelledby="public-profile-title">
        <div className="border-b border-white/[0.06] px-5 py-4 sm:px-6">
          <p className="clinora-r3-kicker">Patient-facing presentation</p>
          <h2 id="public-profile-title" className="mt-1 clinora-r3-section-title">
            Public professional profile
          </h2>
          <p className="mt-1.5 max-w-2xl text-xs leading-5 text-slate-600">
            Edit presentation details only. Approved registration and credential evidence remain immutable.
          </p>
        </div>
        <div className="p-5 sm:p-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Display title"
              hint="For example, Senior Consultant"
              value={draft.displayTitle ?? ''}
              maxLength={160}
              onChange={(value) => update('displayTitle', value || null)}
            />
            <Field
              label="Professional profile URL"
              type="url"
              placeholder="https://…"
              value={draft.professionalProfileUrl ?? ''}
              maxLength={500}
              onChange={(value) => update('professionalProfileUrl', value || null)}
            />
            <Field
              label="Current organization"
              value={draft.currentOrganization ?? ''}
              maxLength={220}
              onChange={(value) => update('currentOrganization', value || null)}
            />
            <Field
              label="Current position"
              value={draft.currentPosition ?? ''}
              maxLength={180}
              onChange={(value) => update('currentPosition', value || null)}
            />
          </div>
          <label className="mt-5 grid gap-2 text-xs font-semibold text-slate-300">
            Professional bio
            <textarea
              rows={7}
              maxLength={2000}
              value={draft.professionalBio ?? ''}
              onChange={(event) => update('professionalBio', event.target.value || null)}
              placeholder="Describe your clinical focus and professional experience."
              className="resize-y rounded-[11px] border border-white/[0.08] bg-white/[0.025] px-3.5 py-3 text-sm font-normal leading-6 text-white outline-none placeholder:text-slate-700 focus:border-cyan-300/25 focus:ring-4 focus:ring-cyan-300/[0.045]"
            />
            <span className="text-right text-[10px] font-normal text-slate-700">
              {(draft.professionalBio ?? '').length}/2000
            </span>
          </label>
        </div>
      </section>

      <aside
        className="clinora-r3-panel h-fit overflow-hidden xl:sticky xl:top-8"
        aria-labelledby="patient-preview-title"
      >
        <div className="border-b border-white/[0.06] px-5 py-4">
          <p className="clinora-r3-kicker">Live preview</p>
          <h2 id="patient-preview-title" className="mt-1 text-base font-semibold text-white">
            Patient view
          </h2>
        </div>
        <div className="p-5">
          <div className="rounded-[16px] border border-white/[0.07] bg-[linear-gradient(160deg,rgba(14,165,233,.045),rgba(255,255,255,.016)_45%,rgba(20,184,166,.028))] p-4">
            <div className="flex items-center gap-3">
              <ProfileAvatar
                source={{ kind: 'self' }}
                name={profile.displayName}
                size="md"
                className="rounded-[13px]"
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="truncate text-sm font-semibold text-white">{profile.displayName}</p>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-teal-200">
                    <ShieldCheck size={11} aria-hidden="true" /> Verified
                  </span>
                </div>
                <p className="mt-0.5 text-xs font-medium text-cyan-200">{profile.specialization}</p>
              </div>
            </div>
            <p className="mt-4 text-sm font-semibold text-slate-200">
              {draft.displayTitle || profile.credentials.verifiedProfessionalTitle || 'Medical professional'}
            </p>
            {draft.currentPosition || draft.currentOrganization ? (
              <p className="mt-2 flex items-start gap-2 text-xs leading-5 text-slate-500">
                <BriefcaseBusiness size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                {[draft.currentPosition, draft.currentOrganization].filter(Boolean).join(' · ')}
              </p>
            ) : null}
            <p className="mt-4 line-clamp-5 text-xs leading-5 text-slate-500">
              {draft.professionalBio ||
                'Add a concise professional bio so Patients can understand your clinical focus before booking.'}
            </p>
            {safePublicUrl(draft.professionalProfileUrl) ? (
              <a
                href={safePublicUrl(draft.professionalProfileUrl) ?? undefined}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-200 hover:text-cyan-100"
              >
                Professional profile <ExternalLink size={12} aria-hidden="true" />
              </a>
            ) : null}
          </div>
          <p className="mt-3 text-[10px] leading-4 text-slate-700">
            Private registration numbers and uploaded credential documents are never shown in this Patient-facing view.
          </p>
        </div>
      </aside>
    </div>
  );
}

function PreferencesTab({
  draft,
  update,
}: {
  draft: DoctorEditableProfile;
  update: <K extends keyof DoctorEditableProfile>(key: K, value: DoctorEditableProfile[K]) => void;
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="clinora-r3-panel overflow-hidden" aria-labelledby="preferences-title">
        <div className="border-b border-white/[0.06] px-5 py-4 sm:px-6">
          <p className="clinora-r3-kicker">Practice defaults</p>
          <h2 id="preferences-title" className="mt-1 clinora-r3-section-title">
            Workspace preferences
          </h2>
          <p className="mt-1.5 text-xs leading-5 text-slate-600">
            These settings shape your workspace and future booking setup. Existing appointments are not changed.
          </p>
        </div>
        <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
          <TimezoneField
            value={draft.preferredTimezone ?? ''}
            onChange={(value) => update('preferredTimezone', value || null)}
          />
          <label className="grid gap-2 text-xs font-semibold text-slate-300">
            Default consultation duration
            <select
              value={draft.defaultConsultationMinutes ?? ''}
              onChange={(event) =>
                update('defaultConsultationMinutes', event.target.value ? Number(event.target.value) : null)
              }
              className={inputClass}
            >
              <option value="">Choose duration</option>
              {[15, 20, 30, 45, 60, 90, 120].map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes} minutes
                </option>
              ))}
            </select>
            <span className="text-[10px] font-normal leading-4 text-slate-700">
              Used as your preferred duration when setting future booking times.
            </span>
          </label>
        </div>
      </section>

      <aside className="clinora-r3-panel h-fit p-5 xl:sticky xl:top-8">
        <span className="grid h-10 w-10 place-items-center rounded-[12px] bg-cyan-300/[0.06] text-cyan-200 ring-1 ring-inset ring-cyan-300/[0.08]">
          <CalendarClock size={17} aria-hidden="true" />
        </span>
        <h2 className="mt-4 text-sm font-semibold text-white">Booking availability</h2>
        <p className="mt-1.5 text-xs leading-5 text-slate-500">
          Your actual Patient-bookable times are managed in the weekly availability workspace.
        </p>
        <Link
          to="/doctor/availability"
          className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-200 hover:text-cyan-100"
        >
          Manage availability
        </Link>
      </aside>
    </div>
  );
}

function CredentialsTab({ profile }: { profile: DoctorProfessionalProfile }) {
  return (
    <section className="clinora-r3-panel overflow-hidden" aria-labelledby="credentials-title">
      <div className="flex flex-col gap-4 border-b border-white/[0.06] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="clinora-r3-kicker">Clinora verified</p>
          <h2 id="credentials-title" className="mt-1 clinora-r3-section-title">
            Credential record
          </h2>
          <p className="mt-1.5 max-w-2xl text-xs leading-5 text-slate-600">
            Read-only professional evidence reviewed during onboarding. Presentation fields are managed separately.
          </p>
        </div>
        <StatusPill tone="success">
          <BadgeCheck size={12} aria-hidden="true" /> Verification complete
        </StatusPill>
      </div>

      <div className="grid gap-0 lg:grid-cols-2">
        <dl className="border-b border-white/[0.055] lg:border-b-0 lg:border-r">
          <CredentialRow
            icon={<ShieldCheck size={15} />}
            label="Verified name"
            value={`${profile.verifiedFirstName} ${profile.verifiedLastName}`.trim()}
          />
          <CredentialRow icon={<Stethoscope size={15} />} label="Specialization" value={profile.specialization} />
          <CredentialRow
            icon={<BriefcaseBusiness size={15} />}
            label="Approved experience"
            value={profile.approvedYearsExperience == null ? null : `${profile.approvedYearsExperience} years`}
          />
          <CredentialRow
            icon={<ShieldCheck size={15} />}
            label="Professional title at signup"
            value={profile.credentials.verifiedProfessionalTitle}
          />
          <CredentialRow
            icon={<BriefcaseBusiness size={15} />}
            label="Organization at signup"
            value={profile.credentials.verifiedCurrentOrganization}
          />
          <CredentialRow
            icon={<BriefcaseBusiness size={15} />}
            label="Position at signup"
            value={profile.credentials.verifiedCurrentPosition}
          />
        </dl>
        <dl>
          <CredentialRow
            icon={<MapPin size={15} />}
            label="Registration jurisdiction"
            value={profile.credentials.registrationJurisdiction}
          />
          <CredentialRow
            icon={<MapPin size={15} />}
            label="Registration authority"
            value={profile.credentials.registrationAuthority}
          />
          <CredentialRow
            icon={<BadgeCheck size={15} />}
            label="Registration number"
            value={profile.credentials.registrationNumber}
            privateValue
          />
          <CredentialRow
            icon={<BadgeCheck size={15} />}
            label="Registration type"
            value={profile.credentials.registrationType}
          />
          <CredentialRow
            icon={<CalendarClock size={15} />}
            label="Issued"
            value={formatDate(profile.credentials.registrationIssuedAt)}
          />
          <CredentialRow
            icon={<CalendarClock size={15} />}
            label="Valid until"
            value={formatDate(profile.credentials.registrationValidUntil)}
          />
        </dl>
      </div>

      <div className="border-t border-white/[0.06] p-4 sm:p-5">
        <details className="group rounded-[14px] border border-white/[0.06] bg-white/[0.018]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3.5 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300">
            <span className="inline-flex items-center gap-2">
              <GraduationCap size={16} className="text-cyan-200" aria-hidden="true" /> Qualifications{' '}
              <span className="text-xs font-normal text-slate-600">{profile.credentials.qualifications.length}</span>
            </span>
            <ChevronDown
              size={15}
              className="text-slate-600 transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <div className="border-t border-white/[0.055] px-4">
            {profile.credentials.qualifications.length ? (
              profile.credentials.qualifications.map((qualification) => (
                <div
                  key={qualification.id}
                  className="grid gap-1 border-b border-white/[0.045] py-3.5 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-200">{qualification.qualificationName}</p>
                    <p className="mt-0.5 text-xs text-slate-600">{qualification.institution}</p>
                  </div>
                  <p className="text-xs text-slate-600">
                    {qualification.countryCode} · {qualification.completionYear}
                  </p>
                </div>
              ))
            ) : (
              <p className="py-4 text-xs text-slate-600">No structured qualification entries are available.</p>
            )}
          </div>
        </details>

        <details className="group mt-3 rounded-[14px] border border-white/[0.06] bg-white/[0.018]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3.5 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300">
            <span className="inline-flex items-center gap-2">
              <FileText size={16} className="text-cyan-200" aria-hidden="true" /> Signup documents{' '}
              <span className="text-xs font-normal text-slate-600">{profile.credentials.documents.length}</span>
            </span>
            <ChevronDown
              size={15}
              className="text-slate-600 transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <div className="border-t border-white/[0.055] px-4">
            {profile.credentials.documents.length ? (
              profile.credentials.documents.map((document) => (
                <CredentialDocument key={document.id} document={document} />
              ))
            ) : (
              <p className="py-4 text-xs text-slate-600">No approved supporting document metadata is available.</p>
            )}
          </div>
        </details>
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  hint,
  ...props
}: { label: string; value: string; onChange: (value: string) => void; hint?: string } & Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange'
>) {
  return (
    <label className="grid gap-2 text-xs font-semibold text-slate-300">
      {label}
      <input
        {...props}
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass}
      />
      {hint ? <span className="text-[10px] font-normal leading-4 text-slate-700">{hint}</span> : null}
    </label>
  );
}

function TimezoneField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const options = timezoneOptions(value);
  return (
    <label className="grid gap-2 text-xs font-semibold text-slate-300">
      Preferred timezone
      <select value={value} onChange={(event) => onChange(event.target.value)} className={inputClass}>
        <option value="">Choose timezone</option>
        {options.map((zone) => (
          <option key={zone} value={zone}>
            {zone.replaceAll('_', ' ')}
          </option>
        ))}
      </select>
      <span className="text-[10px] font-normal leading-4 text-slate-700">
        Used in your Doctor workspace and when publishing future availability.
      </span>
    </label>
  );
}

const inputClass =
  'min-h-11 rounded-[11px] border border-white/[0.08] bg-white/[0.025] px-3.5 text-sm font-normal text-white outline-none placeholder:text-slate-700 focus:border-cyan-300/25 focus:ring-4 focus:ring-cyan-300/[0.045]';

function CredentialRow({
  icon,
  label,
  value,
  privateValue = false,
}: {
  icon: ReactNode;
  label: string;
  value: string | null;
  privateValue?: boolean;
}) {
  return (
    <div className="grid gap-2 border-b border-white/[0.05] px-5 py-3.5 last:border-b-0 sm:grid-cols-[190px_minmax(0,1fr)] sm:items-start sm:px-6">
      <dt className="flex items-center gap-2 text-xs text-slate-600">
        <span className="text-cyan-200/70">{icon}</span>
        {label}
      </dt>
      <dd className="min-w-0 break-words text-sm font-medium text-slate-200">
        {value || 'Not provided in approved application'}
        {privateValue && value ? (
          <span className="mt-1 block text-[10px] font-normal text-slate-700">
            Private · visible only in your authenticated Doctor profile
          </span>
        ) : null}
      </dd>
    </div>
  );
}

function CredentialDocument({ document }: { document: DoctorProfessionalProfile['credentials']['documents'][number] }) {
  const [busy, setBusy] = useState<'view' | 'download' | null>(null);
  const [error, setError] = useState('');

  const open = async () => {
    setBusy('view');
    setError('');
    const previewWindow = window.open('about:blank', '_blank');
    if (previewWindow) previewWindow.opener = null;
    try {
      const blob = await doctorProfileApi.credentialContent(document.id);
      const url = URL.createObjectURL(blob);
      if (previewWindow) previewWindow.location.replace(url);
      else throw new Error('Preview window blocked');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (requestError) {
      previewWindow?.close();
      setError(
        doctorProfileError(requestError, 'Document preview is unavailable. Allow pop-ups for Clinora and try again.'),
      );
    } finally {
      setBusy(null);
    }
  };

  const download = async () => {
    setBusy('download');
    setError('');
    try {
      const blob = await doctorProfileApi.credentialDownload(document.id);
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement('a');
      anchor.href = url;
      anchor.download = document.originalFilename || 'credential-document';
      anchor.style.display = 'none';
      window.document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (requestError) {
      setError(doctorProfileError(requestError, 'Document download is unavailable.'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="border-b border-white/[0.045] py-3.5 last:border-b-0">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-cyan-200/70">
            {documentType(document.documentType)}
          </p>
          <p className="mt-1 truncate text-sm font-medium text-slate-200" title={document.originalFilename}>
            {document.originalFilename}
          </p>
          <p className="mt-1 text-[10px] text-slate-700">
            Uploaded {formatDate(document.uploadedAt)} · {formatBytes(document.sizeBytes)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="appSecondary" size="sm" disabled={busy !== null} onClick={() => void open()}>
            {busy === 'view' ? 'Opening…' : 'View'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy !== null}
            aria-label={`Download ${document.originalFilename}`}
            onClick={() => void download()}
          >
            <Download size={15} aria-hidden="true" />
          </Button>
        </div>
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-xs text-rose-200">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function timezoneOptions(current: string) {
  const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const supportedValuesOf = (Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf;
  const supported = supportedValuesOf ? supportedValuesOf('timeZone') : [];
  return [...new Set([current, browserZone, 'Asia/Dhaka', 'UTC', ...supported].filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}

function documentType(value: string) {
  return value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string | null) {
  if (!value) return 'Not provided';
  const parsed = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(parsed.getTime())) return 'Not provided';
  return parsed.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function safePublicUrl(value?: string | null) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}
