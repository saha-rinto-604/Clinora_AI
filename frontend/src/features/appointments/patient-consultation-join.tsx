import { useCallback, useEffect, useState } from 'react';
import { Button } from '../../components/ui/button';
import { appointmentApi, appointmentError, type ConsultationJoinStatus } from './appointment-api';

/** Never consumes the legacy raw meetingUrl field. Each join is authorized anew on the server. */
export function PatientConsultationJoin({ appointmentId }: { appointmentId: string }) {
  const [status, setStatus] = useState<ConsultationJoinStatus | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    setError('');
    try {
      setStatus(await appointmentApi.joinStatus(appointmentId));
    } catch (e) {
      setError(appointmentError(e, 'We could not check the consultation room.'));
    }
  }, [appointmentId]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const join = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await appointmentApi.join(appointmentId);
      const url = new URL(result.meetingUrl);
      if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Unsafe room');
      window.location.assign(url.href);
    } catch (e) {
      setError(appointmentError(e, 'We could not open the consultation. Check availability and try again.'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-2 space-y-3 text-sm text-[var(--clinora-text-muted)]">
      {status?.roomReady ? (
        <p>Meeting room ready</p>
      ) : (
        <p>{status ? 'Meeting room is not available.' : 'Checking consultation room…'}</p>
      )}
      {status?.state === 'TOO_EARLY' ? (
        <p>Join will be available shortly. Access opens 15 minutes before your appointment.</p>
      ) : null}
      {status?.state === 'ENDED' ? <p>The scheduled join window has ended.</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button variant="appPrimary" disabled={!status?.canJoin || busy} onClick={() => void join()}>
          Join consultation
        </Button>
        <Button variant="appSecondary" disabled={busy} onClick={() => void refresh()}>
          Check availability
        </Button>
      </div>
      <p className="text-xs">Your meeting provider controls admission. Wait for your Doctor to admit you.</p>
    </div>
  );
}
