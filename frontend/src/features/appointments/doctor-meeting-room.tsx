import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { AppSurface } from '../../components/app/app-ui';
import { appointmentError, doctorAvailabilityApi } from './appointment-api';

export function DoctorMeetingRoom({
  currentUrl,
  onSaved,
}: {
  currentUrl: string | null;
  onSaved: (url: string) => void;
}) {
  const [url, setUrl] = useState(currentUrl || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const save = async () => {
    setError('');
    setMessage('');
    try {
      const parsed = new URL(url.trim());
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password || url.trim().length > 2048)
        throw new Error();
    } catch {
      setError('Use a valid HTTPS meeting URL without embedded credentials.');
      return;
    }
    setBusy(true);
    try {
      const saved = await doctorAvailabilityApi.saveMeetingRoom(url.trim());
      setUrl(saved.defaultMeetingUrl);
      onSaved(saved.defaultMeetingUrl);
      setMessage(
        `Meeting room saved. ${saved.updatedAppointments} future online appointment${saved.updatedAppointments === 1 ? '' : 's'} updated; affected Patients will be notified.`,
      );
    } catch (e) {
      setError(appointmentError(e, 'We could not save your meeting room.'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <AppSurface padding="compact">
      <h2 className="text-base font-semibold text-white">Online consultation</h2>
      <p className="mt-1 text-xs text-slate-400">
        Used automatically for new online appointments. Changing it updates future booked online appointments.
      </p>
      <label className="mt-4 grid gap-2 text-sm text-slate-300">
        Default meeting room
        <input
          type="url"
          maxLength={2048}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="min-h-10 rounded-lg border border-white/10 bg-[#061b29] px-3 text-sm text-white"
          autoComplete="off"
        />
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button
          variant="appPrimary"
          disabled={busy || !url.trim() || url.trim() === currentUrl}
          onClick={() => void save()}
        >
          {busy ? 'Saving…' : currentUrl ? 'Change meeting URL' : 'Save meeting URL'}
        </Button>
        {currentUrl ? (
          <a className="text-sm text-cyan-300" href={currentUrl} target="_blank" rel="noreferrer">
            Test your meeting room
          </a>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-amber-200">
          {error}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="mt-3 text-sm text-teal-200">
          {message}
        </p>
      ) : null}
      <p className="mt-4 text-xs leading-5 text-slate-400">
        Meeting admission is controlled by your meeting provider. Configure this room so Patients wait for host
        approval. Enable waiting room/host approval and passcode protection; disable join-before-host where supported
        and prevent participants from admitting others. Clinora does not create meeting links or verify these provider
        settings.
      </p>
    </AppSurface>
  );
}
