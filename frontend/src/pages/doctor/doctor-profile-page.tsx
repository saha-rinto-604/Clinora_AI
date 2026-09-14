import {
  BadgeCheck,
  BriefcaseBusiness,
  CalendarClock,
  Download,
  ExternalLink,
  FileText,
  GraduationCap,
  MapPin,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router';
import { AppSectionHeader, AppSurface, EmptyState, StatusPill } from '../../components/app/app-ui';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/feedback';
import {
  doctorProfileApi,
  doctorProfileError,
  type DoctorEditableProfile,
  type DoctorProfessionalProfile,
} from '../../features/doctor/doctor-profile-api';
import { ProfileAvatar, ProfileImageEditor } from '../../features/profile/profile-image';

const blankEditable: DoctorEditableProfile = {
  professionalBio: null,
  professionalProfileUrl: null,
  displayTitle: null,
  currentOrganization: null,
  currentPosition: null,
  preferredTimezone: null,
  defaultConsultationMinutes: null,
};

export function DoctorProfilePage() {
  const [profile, setProfile] = useState<DoctorProfessionalProfile | null>(null);
  const [draft, setDraft] = useState<DoctorEditableProfile>(blankEditable);
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
      <div className="space-y-6" aria-label="Loading professional profile">
        <Skeleton className="h-52 rounded-[var(--radius-app-card)]" />
        <Skeleton className="h-96 rounded-[var(--radius-app-card)]" />
      </div>
    );
  }
  if (loadError || !profile) {
    return (
      <AppSurface variant="attention">
        <p role="alert" className="text-sm text-[var(--clinora-warning-foreground)]">{loadError || 'Your professional profile is unavailable.'}</p>
        <Button variant="appSecondary" className="mt-4" onClick={() => void load()}>Try again</Button>
      </AppSurface>
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
      setSaveError(doctorProfileError(requestError, 'We could not save your professional profile. Your changes are still here.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-7">
      <AppSurface as="section" variant="hero" className="overflow-hidden">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <ProfileImageEditor name={profile.displayName} compact />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">{profile.displayName}</h1>
                <StatusPill tone="success"><BadgeCheck size={13} aria-hidden="true" /> Clinora verified</StatusPill>
              </div>
              <p className="mt-2 text-base font-semibold text-[var(--clinora-info-foreground)]">{profile.specialization}</p>
              <p className="mt-2 text-sm text-[var(--clinora-text-muted)]">
                {draft.displayTitle || profile.credentials.verifiedProfessionalTitle || 'Medical professional'}
                {draft.currentOrganization ? ` · ${draft.currentOrganization}` : ''}
              </p>
            </div>
          </div>
          <div className="min-w-[16rem] rounded-2xl border border-white/[0.07] bg-black/10 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--clinora-info-foreground)]">Professional profile setup</p>
            <div className="mt-2 flex items-end justify-between gap-4">
              <span className="text-3xl font-semibold text-white">{profile.readiness.percent}%</span>
              <span className="text-xs text-[var(--clinora-text-faint)]">{profile.readiness.completedItems} of {profile.readiness.totalItems} optional items</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.06]" aria-label={`${profile.readiness.percent}% professional profile setup complete`}>
              <div className="h-full rounded-full bg-[var(--clinora-accent-teal)]" style={{ width: `${profile.readiness.percent}%` }} />
            </div>
            <p className="mt-3 text-xs leading-5 text-[var(--clinora-text-faint)]">Your medical approval is already complete. This only measures optional profile and booking setup.</p>
          </div>
        </div>
      </AppSurface>

      {profile.readiness.missingItems.length ? (
        <AppSurface as="section" variant="elevated" padding="compact" aria-labelledby="profile-next-title">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 id="profile-next-title" className="text-base font-semibold text-white">Finish your professional setup</h2>
              <p className="mt-1 text-sm text-[var(--clinora-text-muted)]">These are presentation and booking preferences, not credential requirements.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {profile.readiness.missingItems.slice(0, 4).map((item) => (
                <Link key={item.key} to={item.destination} className="rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-[var(--clinora-border-interactive)] hover:text-white">
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </AppSurface>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.75fr)]">
        <AppSurface as="section" aria-labelledby="professional-profile-title">
          <AppSectionHeader
            eyebrow="Patient-facing presentation"
            title="Professional profile"
            titleId="professional-profile-title"
            copy="Edit how you present your professional practice. Verified signup credentials below remain read-only."
          />
          {message ? <p role="status" className="mt-5 rounded-xl border border-teal-300/15 bg-teal-300/[0.05] px-4 py-3 text-sm text-teal-100">{message}</p> : null}
          {saveError ? <p role="alert" className="mt-5 rounded-xl border border-rose-300/15 bg-rose-300/[0.05] px-4 py-3 text-sm text-rose-200">{saveError}</p> : null}
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <Field label="Display title" hint="For example, Senior Consultant" value={draft.displayTitle ?? ''} maxLength={160} onChange={(value) => update('displayTitle', value || null)} />
            <Field label="Professional profile URL" type="url" placeholder="https://…" value={draft.professionalProfileUrl ?? ''} maxLength={500} onChange={(value) => update('professionalProfileUrl', value || null)} />
            <Field label="Current organization" value={draft.currentOrganization ?? ''} maxLength={220} onChange={(value) => update('currentOrganization', value || null)} />
            <Field label="Current position" value={draft.currentPosition ?? ''} maxLength={180} onChange={(value) => update('currentPosition', value || null)} />
            <TimezoneField
              value={draft.preferredTimezone ?? ''}
              onChange={(value) => update('preferredTimezone', value || null)}
            />
            <label className="grid gap-2 text-sm font-semibold text-white">
              Default consultation duration
              <select
                value={draft.defaultConsultationMinutes ?? ''}
                onChange={(event) => update('defaultConsultationMinutes', event.target.value ? Number(event.target.value) : null)}
                className="min-h-11 rounded-xl border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-nested)] px-3 text-sm font-normal text-white outline-none focus:border-[var(--clinora-border-interactive)] focus:ring-4 focus:ring-[var(--clinora-focus-ring-soft)]"
              >
                <option value="">Choose duration</option>
                {[15, 20, 30, 45, 60, 90, 120].map((minutes) => <option key={minutes} value={minutes}>{minutes} minutes</option>)}
              </select>
              <span className="text-xs font-normal leading-5 text-[var(--clinora-text-faint)]">Existing appointments keep their booked duration.</span>
            </label>
          </div>
          <label className="mt-5 grid gap-2 text-sm font-semibold text-white">
            Professional bio
            <textarea
              rows={6}
              maxLength={2000}
              value={draft.professionalBio ?? ''}
              onChange={(event) => update('professionalBio', event.target.value || null)}
              placeholder="Tell Patients about your clinical focus and professional experience."
              className="resize-y rounded-xl border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-nested)] px-3 py-3 text-sm font-normal leading-6 text-white outline-none placeholder:text-slate-600 focus:border-[var(--clinora-border-interactive)] focus:ring-4 focus:ring-[var(--clinora-focus-ring-soft)]"
            />
            <span className="text-right text-xs font-normal text-[var(--clinora-text-faint)]">{(draft.professionalBio ?? '').length}/2000</span>
          </label>
          <div className="mt-6 flex flex-col gap-3 border-t border-[var(--clinora-border-subtle)] pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className={`text-sm ${dirty ? 'text-amber-100' : 'text-[var(--clinora-text-faint)]'}`}>{dirty ? 'You have unsaved profile changes.' : 'All profile changes saved.'}</p>
            <div className="flex gap-2">
              <Button variant="appSecondary" disabled={!dirty || saving} onClick={() => { setDraft(profile.editable); setSaveError(''); setMessage(''); }}>Discard</Button>
              <Button variant="appPrimary" disabled={!dirty || saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save profile'}</Button>
            </div>
          </div>
        </AppSurface>

        <AppSurface as="aside" variant="elevated" aria-labelledby="patient-preview-title">
          <AppSectionHeader eyebrow="Preview" title="How Patients see you" titleId="patient-preview-title" />
          <div className="mt-5 rounded-2xl border border-white/[0.07] bg-[var(--clinora-surface-nested)] p-5">
            <div className="flex items-center gap-3">
              <ProfileAvatar source={{ kind: 'self' }} name={profile.displayName} size="md" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-semibold text-white">{profile.displayName}</p>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-200">
                    <ShieldCheck size={12} aria-hidden="true" /> Verified
                  </span>
                </div>
                <p className="text-xs text-[var(--clinora-info-foreground)]">{profile.specialization}</p>
              </div>
            </div>
            <p className="mt-4 text-sm font-medium text-slate-200">{draft.displayTitle || profile.credentials.verifiedProfessionalTitle || 'Medical professional'}</p>
            {(draft.currentPosition || draft.currentOrganization) ? (
              <p className="mt-2 flex items-start gap-2 text-xs leading-5 text-[var(--clinora-text-muted)]"><BriefcaseBusiness size={14} className="mt-0.5 shrink-0" aria-hidden="true" />{[draft.currentPosition, draft.currentOrganization].filter(Boolean).join(' · ')}</p>
            ) : null}
            <p className="mt-4 text-sm leading-6 text-[var(--clinora-text-muted)]">{draft.professionalBio || 'Add a short professional bio to help Patients understand your clinical focus before booking.'}</p>
            {safePublicUrl(draft.professionalProfileUrl) ? (
              <a
                href={safePublicUrl(draft.professionalProfileUrl) ?? undefined}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-[var(--clinora-info-foreground)] hover:underline"
              >
                <ExternalLink size={13} aria-hidden="true" /> Professional profile
              </a>
            ) : null}
          </div>
        </AppSurface>
      </div>

      <AppSurface as="section" aria-labelledby="verified-credentials-title">
        <AppSectionHeader
          eyebrow="Clinora verified"
          title="Verified credentials"
          titleId="verified-credentials-title"
          copy="These are the professional details and supporting documents reviewed during signup. They are visible to you here but cannot be edited, replaced or deleted from your profile."
        />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <CredentialFact icon={<ShieldCheck size={16} />} label="Verified name" value={`${profile.verifiedFirstName} ${profile.verifiedLastName}`.trim()} />
          <CredentialFact icon={<Stethoscope size={16} />} label="Specialization" value={profile.specialization} />
          <CredentialFact icon={<BriefcaseBusiness size={16} />} label="Approved experience" value={profile.approvedYearsExperience == null ? null : `${profile.approvedYearsExperience} years`} />
          <CredentialFact icon={<ShieldCheck size={16} />} label="Professional title at signup" value={profile.credentials.verifiedProfessionalTitle} />
          <CredentialFact icon={<BriefcaseBusiness size={16} />} label="Organization at signup" value={profile.credentials.verifiedCurrentOrganization} />
          <CredentialFact icon={<BriefcaseBusiness size={16} />} label="Position at signup" value={profile.credentials.verifiedCurrentPosition} />
          <CredentialFact icon={<MapPin size={16} />} label="Registration jurisdiction" value={profile.credentials.registrationJurisdiction} />
          <CredentialFact icon={<MapPin size={16} />} label="Registration authority" value={profile.credentials.registrationAuthority} />
          <CredentialFact icon={<BadgeCheck size={16} />} label="Registration number" value={profile.credentials.registrationNumber} privateValue />
          <CredentialFact icon={<BadgeCheck size={16} />} label="Registration type" value={profile.credentials.registrationType} />
          <CredentialFact icon={<CalendarClock size={16} />} label="Issued" value={formatDate(profile.credentials.registrationIssuedAt)} />
          <CredentialFact icon={<CalendarClock size={16} />} label="Valid until" value={formatDate(profile.credentials.registrationValidUntil)} />
        </div>

        <div className="mt-7 grid gap-6 xl:grid-cols-2">
          <section aria-labelledby="qualifications-title">
            <h3 id="qualifications-title" className="flex items-center gap-2 text-base font-semibold text-white"><GraduationCap size={17} aria-hidden="true" /> Qualifications</h3>
            {profile.credentials.qualifications.length ? (
              <div className="mt-3 divide-y divide-[var(--clinora-border-subtle)] rounded-2xl border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-nested)] px-4">
                {profile.credentials.qualifications.map((qualification) => (
                  <div key={qualification.id} className="py-4">
                    <p className="text-sm font-semibold text-white">{qualification.qualificationName}</p>
                    <p className="mt-1 text-xs leading-5 text-[var(--clinora-text-muted)]">{qualification.institution} · {qualification.countryCode} · {qualification.completionYear}</p>
                  </div>
                ))}
              </div>
            ) : <EmptyState className="mt-3" icon={<GraduationCap size={18} />} title="No structured qualifications available" copy="Your approved application does not currently contain structured qualification entries." />}
          </section>

          <section aria-labelledby="credential-files-title">
            <h3 id="credential-files-title" className="flex items-center gap-2 text-base font-semibold text-white"><FileText size={17} aria-hidden="true" /> Signup documents</h3>
            {profile.credentials.documents.length ? (
              <div className="mt-3 divide-y divide-[var(--clinora-border-subtle)] rounded-2xl border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-nested)] px-4">
                {profile.credentials.documents.map((document) => (
                  <CredentialDocument key={document.id} document={document} />
                ))}
              </div>
            ) : <EmptyState className="mt-3" icon={<FileText size={18} />} title="No signup documents available" copy="No approved supporting document metadata is available for this profile." />}
          </section>
        </div>
      </AppSurface>
    </div>
  );
}

function Field({ label, value, onChange, hint, ...props }: { label: string; value: string; onChange: (value: string) => void; hint?: string } & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-white">
      {label}
      <input
        {...props}
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 rounded-xl border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-nested)] px-3 text-sm font-normal text-white outline-none placeholder:text-slate-600 focus:border-[var(--clinora-border-interactive)] focus:ring-4 focus:ring-[var(--clinora-focus-ring-soft)]"
      />
      {hint ? <span className="text-xs font-normal leading-5 text-[var(--clinora-text-faint)]">{hint}</span> : null}
    </label>
  );
}

function TimezoneField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const options = timezoneOptions(value);
  return (
    <label className="grid gap-2 text-sm font-semibold text-white">
      Preferred timezone
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 rounded-xl border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-nested)] px-3 text-sm font-normal text-white outline-none focus:border-[var(--clinora-border-interactive)] focus:ring-4 focus:ring-[var(--clinora-focus-ring-soft)]"
      >
        <option value="">Choose timezone</option>
        {options.map((zone) => (
          <option key={zone} value={zone}>{timezoneLabel(zone)}</option>
        ))}
      </select>
      <span className="text-xs font-normal leading-5 text-[var(--clinora-text-faint)]">Used for your Doctor workspace and as the default when publishing future availability.</span>
    </label>
  );
}

function timezoneOptions(current: string) {
  const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const supportedValuesOf = (Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf;
  const supported = supportedValuesOf ? supportedValuesOf('timeZone') : [];
  return [...new Set([current, browserZone, 'Asia/Dhaka', 'UTC', ...supported].filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function timezoneLabel(value: string) {
  return value.replaceAll('_', ' ');
}

function CredentialFact({ icon, label, value, privateValue = false }: { icon: ReactNode; label: string; value: string | null; privateValue?: boolean }) {
  return (
    <div className="rounded-2xl border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-nested)] p-4">
      <div className="flex items-center gap-2 text-[var(--clinora-info-foreground)]">{icon}<span className="text-xs font-bold uppercase tracking-[0.12em]">{label}</span></div>
      <p className="mt-3 break-words text-sm font-semibold text-white">{value || 'Not provided in approved application'}</p>
      {privateValue && value ? <p className="mt-2 text-xs text-[var(--clinora-text-faint)]">Private credential · visible only in your authenticated Doctor profile.</p> : null}
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
      if (previewWindow) {
        previewWindow.location.replace(url);
      } else {
        throw new Error('Preview window blocked');
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (requestError) {
      previewWindow?.close();
      setError(doctorProfileError(requestError, 'Document preview is unavailable. Allow pop-ups for Clinora and try again.'));
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
    <div className="py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--clinora-info-foreground)]">{documentType(document.documentType)}</p>
          <p className="mt-1 truncate text-sm font-semibold text-white" title={document.originalFilename}>{document.originalFilename}</p>
          <p className="mt-1 text-xs text-[var(--clinora-text-faint)]">Uploaded {formatDate(document.uploadedAt)} · {formatBytes(document.sizeBytes)}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="appSecondary" disabled={busy !== null} onClick={() => void open()}>{busy === 'view' ? 'Opening…' : 'View'}</Button>
          <Button variant="ghost" disabled={busy !== null} aria-label={`Download ${document.originalFilename}`} onClick={() => void download()}><Download size={16} aria-hidden="true" /></Button>
        </div>
      </div>
      {error ? <p role="alert" className="mt-2 text-xs text-rose-200">{error}</p> : null}
    </div>
  );
}

function documentType(value: string) {
  return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
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
