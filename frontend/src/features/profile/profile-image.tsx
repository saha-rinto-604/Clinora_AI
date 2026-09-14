import { Camera, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Button } from '../../components/ui/button';
import { cn } from '../../lib/cn';
import { profileImageApi, profileImageError, type ProfileImageSource } from './profile-image-api';

const PROFILE_IMAGE_CHANGED = 'clinora:profile-image-changed';
const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function ProfileAvatar({
  source,
  name,
  size = 'md',
  className,
}: {
  source: ProfileImageSource;
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const sourceKey =
    source.kind === 'self'
      ? 'self'
      : source.kind === 'patient-doctor'
        ? `patient-doctor:${source.doctorId}`
        : `doctor-patient:${source.appointmentId}`;

  useEffect(() => {
    if (source.kind !== 'self') return;
    const refresh = () => setRefreshKey((current) => current + 1);
    window.addEventListener(PROFILE_IMAGE_CHANGED, refresh);
    return () => window.removeEventListener(PROFILE_IMAGE_CHANGED, refresh);
  }, [source.kind]);

  useEffect(() => {
    let active = true;
    let nextUrl: string | null = null;
    setImageUrl(null);
    profileImageApi
      .content(sourceFromKey(sourceKey))
      .then((blob) => {
        if (!active || !blob) return;
        nextUrl = URL.createObjectURL(blob);
        setImageUrl(nextUrl);
      })
      .catch(() => {
        if (active) setImageUrl(null);
      });
    return () => {
      active = false;
      if (nextUrl) URL.revokeObjectURL(nextUrl);
    };
  }, [sourceKey, refreshKey]);

  const dimensions = {
    sm: 'h-9 w-9 text-[11px]',
    md: 'h-12 w-12 text-sm',
    lg: 'h-16 w-16 text-base',
    xl: 'h-24 w-24 text-xl',
  }[size];

  return (
    <span
      className={cn(
        'relative grid shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/[0.08] bg-[var(--clinora-info-soft)] font-bold text-[var(--clinora-info-foreground)]',
        dimensions,
        className,
      )}
      aria-label={`${name} profile photo`}
    >
      {imageUrl ? <img src={imageUrl} alt="" className="h-full w-full object-cover" /> : initials(name)}
    </span>
  );
}

export function ProfileImageEditor({ name, compact = false }: { name: string; compact?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [hasImage, setHasImage] = useState<boolean | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    profileImageApi
      .metadata()
      .then((metadata) => {
        if (active) setHasImage(Boolean(metadata));
      })
      .catch(() => {
        if (active) setHasImage(null);
      });
    return () => {
      active = false;
    };
  }, []);

  const choose = () => inputRef.current?.click();
  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setMessage('');
    setError('');
    if (file.type && !ACCEPTED_TYPES.has(file.type)) {
      setError('Choose a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size <= 0 || file.size > MAX_BYTES) {
      setError('Profile photos must be 5 MB or smaller.');
      return;
    }
    setBusy(true);
    try {
      await profileImageApi.replace(file);
      setHasImage(true);
      setMessage('Profile photo updated.');
      window.dispatchEvent(new Event(PROFILE_IMAGE_CHANGED));
    } catch (requestError) {
      setError(profileImageError(requestError, 'We could not update your profile photo.'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setMessage('');
    setError('');
    try {
      await profileImageApi.remove();
      setHasImage(false);
      setMessage('Profile photo removed.');
      window.dispatchEvent(new Event(PROFILE_IMAGE_CHANGED));
    } catch (requestError) {
      setError(profileImageError(requestError, 'We could not remove your profile photo.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn('flex gap-4', compact ? 'items-center' : 'flex-col sm:flex-row sm:items-center')}>
      <div className="relative w-fit">
        <ProfileAvatar source={{ kind: 'self' }} name={name} size={compact ? 'lg' : 'xl'} />
        {!compact ? (
          <span className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-xl border border-white/10 bg-[var(--clinora-bg-chrome)] text-[var(--clinora-info-foreground)]">
            <Camera size={15} aria-hidden="true" />
          </span>
        ) : null}
      </div>
      <div className="min-w-0">
        <input
          ref={inputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
          className="sr-only"
          aria-label="Choose profile photo"
          onChange={(event) => void upload(event)}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="appSecondary" disabled={busy} onClick={choose}>
            <Upload size={15} aria-hidden="true" />
            {busy ? 'Working…' : hasImage ? 'Change photo' : 'Upload photo'}
          </Button>
          {hasImage ? (
            <Button type="button" variant="ghost" disabled={busy} className="text-slate-300" onClick={() => void remove()}>
              <Trash2 size={15} aria-hidden="true" /> Remove
            </Button>
          ) : null}
        </div>
        {!compact ? (
          <p className="mt-2 text-xs leading-5 text-[var(--clinora-text-faint)]">JPEG, PNG or WebP · up to 5 MB. Clinora removes unnecessary image metadata before serving supported raster photos.</p>
        ) : null}
        {message ? <p role="status" className="mt-2 text-xs text-teal-200">{message}</p> : null}
        {error ? <p role="alert" className="mt-2 text-xs text-rose-200">{error}</p> : null}
      </div>
    </div>
  );
}

function sourceFromKey(key: string): ProfileImageSource {
  if (key === 'self') return { kind: 'self' };
  if (key.startsWith('patient-doctor:')) return { kind: 'patient-doctor', doctorId: key.slice('patient-doctor:'.length) };
  if (key.startsWith('doctor-patient:')) return { kind: 'doctor-patient', appointmentId: key.slice('doctor-patient:'.length) };
  return { kind: 'self' };
}

function initials(name: string) {
  return name
    .replace(/^Dr\.\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || '?';
}
