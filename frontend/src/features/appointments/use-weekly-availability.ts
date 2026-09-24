import { useEffect, useState } from 'react';
import { appointmentError, doctorAvailabilityApi, type AvailabilitySlot, type WeeklyRoutine } from './appointment-api';
import { previewRange, routineInput } from './weekly-availability';

export function useWeeklyAvailability() {
  const [routine, setRoutine] = useState<WeeklyRoutine | null>(null);
  const [persisted, setPersisted] = useState<WeeklyRoutine | null>(null);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [now, setNow] = useState(() => new Date());
  const [error, setError] = useState('');
  const [calendarError, setCalendarError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(true);
  useEffect(() => {
    let active = true;
    doctorAvailabilityApi
      .weekly()
      .then((loaded) => {
        if (active) {
          setRoutine(loaded);
          setPersisted(loaded);
        }
      })
      .catch((e: unknown) => {
        if (active) setError(appointmentError(e, 'We could not load your routine.'));
      });
    doctorAvailabilityApi
      .list(previewRange(new Date()))
      .then((inventory) => {
        if (active) setSlots(inventory);
      })
      .catch((e: unknown) => {
        if (active) setCalendarError(appointmentError(e, 'We could not load upcoming availability.'));
      })
      .finally(() => {
        if (active) setLoadingSlots(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const dirty = Boolean(
    routine && persisted && JSON.stringify(routineInput(routine)) !== JSON.stringify(routineInput(persisted)),
  );
  const update = (next: WeeklyRoutine) => {
    setRoutine(next);
    setSaved(false);
    setError('');
  };
  const refreshSlots = async () => {
    setLoadingSlots(true);
    setCalendarError('');
    const current = new Date();
    try {
      const inventory = await doctorAvailabilityApi.list(previewRange(current));
      setSlots(inventory);
      setNow(current);
    } catch (e) {
      setCalendarError(appointmentError(e, 'The preview could not refresh. Please retry.'));
    } finally {
      setLoadingSlots(false);
    }
  };
  const save = async () => {
    if (!routine) return;
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      const result = await doctorAvailabilityApi.saveWeekly(routineInput(routine));
      setRoutine(result);
      setPersisted(result);
      setSaved(true);
      await refreshSlots();
    } catch (e) {
      setError(appointmentError(e, 'We could not save your weekly routine. Your changes are still here.'));
    } finally {
      setBusy(false);
    }
  };
  const roomSaved = (url: string) => {
    setRoutine((current) => (current ? { ...current, defaultMeetingUrl: url } : current));
    setPersisted((current) => (current ? { ...current, defaultMeetingUrl: url } : current));
  };
  return {
    routine,
    persisted,
    slots,
    now,
    error,
    calendarError,
    busy,
    saved,
    dirty,
    loadingSlots,
    update,
    save,
    roomSaved,
    refreshSlots,
  };
}
