import { CheckCircle2, ExternalLink, ShieldCheck, Video } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { AppSurface, IconWell } from '../../components/app/app-ui';
import { appointmentError, doctorAvailabilityApi } from './appointment-api';

export function DoctorMeetingRoom({
  currentUrl,
  onSaved,
  disabled = false,
  onBusyChange,
}: {
  currentUrl: string | null;
  onSaved: (url: string) => void;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [url, setUrl] = useState(currentUrl || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const save = async () => {
    setError('');
    setMessage('');
    setBusy(true);
    onBusyChange?.(true);
    try {
      // The backend owns HTTPS, host, credentials and length validation.
      const saved = await doctorAvailabilityApi.saveMeetingRoom(url.trim());
      setUrl(saved.defaultMeetingUrl);
      onSaved(saved.defaultMeetingUrl);
      setMessage(
        saved.updatedAppointments
          ? `Meeting room saved. ${saved.updatedAppointments} future online appointment${saved.updatedAppointments === 1 ? '' : 's'} updated; affected Patients will be notified.`
          : 'Meeting room saved. It will be used for new online bookings.',
      );
    } catch (e) {
      setError(appointmentError(e, 'We could not save your meeting room.'));
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  };
  const unchanged = Boolean(currentUrl && url.trim() === currentUrl);
  return (
    <AppSurface
      as="section"
      aria-labelledby="meeting-room-title"
      padding="none"
      className="availability-card availability-meeting-card"
    >
      <div className="availability-meeting-main">
        <div className="availability-section-heading">
          <IconWell>
            <Video size={23} />
          </IconWell>
          <div>
            <h2 id="meeting-room-title">Online consultation</h2>
            <p>
              Use a single meeting room for all online appointments. Changing it updates future booked online
              appointments.
            </p>
          </div>
        </div>
        <div className="availability-meeting-form">
          <label htmlFor="availability-meeting-url">
            Default meeting room <span>(e.g. Zoom, Google Meet, Teams)</span>
          </label>
          <div className="availability-meeting-controls">
            <div className="availability-meeting-input">
              <input
                id="availability-meeting-url"
                aria-label="Default meeting room"
                type="url"
                value={url}
                disabled={busy || disabled}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setError('');
                  setMessage('');
                }}
                autoComplete="off"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'availability-meeting-error' : undefined}
              />
              {unchanged && <CheckCircle2 size={18} aria-label="Saved meeting room" />}
            </div>
            <Button
              variant="appPrimary"
              disabled={busy || disabled || !url.trim() || unchanged}
              onClick={() => void save()}
            >
              {busy ? 'Saving...' : currentUrl ? 'Change meeting URL' : 'Save meeting URL'}
            </Button>
          </div>
          {currentUrl && (
            <a className="availability-test-room" href={currentUrl} target="_blank" rel="noopener noreferrer">
              Test your meeting room <ExternalLink size={14} />
            </a>
          )}
          {error && (
            <p id="availability-meeting-error" role="alert" className="availability-error">
              {error}
            </p>
          )}
          {message && (
            <p role="status" className="availability-room-status">
              {message}
            </p>
          )}
        </div>
      </div>
      <aside className="availability-security" aria-labelledby="availability-security-title">
        <ShieldCheck size={24} aria-hidden="true" />
        <div>
          <h3 id="availability-security-title">Security requirement</h3>
          <ul>
            <li>Use a waiting room and host admission.</li>
            <li>Enable passcode and security controls; disable join-before-host where supported.</li>
            <li>Participants should not admit others.</li>
            <li>Meeting access is controlled by your provider, not Clinora.</li>
          </ul>
        </div>
      </aside>
    </AppSurface>
  );
}
