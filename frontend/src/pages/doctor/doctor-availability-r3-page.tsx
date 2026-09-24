import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/button';
import { AppSurface } from '../../components/app/app-ui';
import { DoctorMeetingRoom } from '../../features/appointments/doctor-meeting-room';
import {
  appointmentError,
  doctorAvailabilityApi,
  type AvailabilitySlot,
  type WeeklyRoutine,
  type WeeklyAvailabilityBlock,
} from '../../features/appointments/appointment-api';

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const inputClass = 'min-h-10 w-full rounded-lg border border-white/10 bg-[#061b29] px-3 text-sm text-white';
export function DoctorAvailabilityWorkspacePage() {
  const [routine, setRoutine] = useState<WeeklyRoutine | null>(null);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    Promise.all([doctorAvailabilityApi.weekly(), doctorAvailabilityApi.list()])
      .then(([loaded, inventory]) => {
        if (active) {
          setRoutine({ ...loaded, timezone: loaded.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone });
          setSlots(inventory);
        }
      })
      .catch((e: unknown) => {
        if (active) setError(appointmentError(e, 'We could not load your routine.'));
      });
    return () => {
      active = false;
    };
  }, []);
  const updateBlock = (index: number, patch: Partial<WeeklyAvailabilityBlock>) => {
    setRoutine((current) =>
      current ? { ...current, blocks: current.blocks.map((b, i) => (i === index ? { ...b, ...patch } : b)) } : current,
    );
    setMessage('');
  };
  const save = async () => {
    if (!routine) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const saved = await doctorAvailabilityApi.saveWeekly({
        version: routine.version,
        timezone: routine.timezone,
        slotMinutes: routine.slotMinutes,
        blocks: routine.blocks,
      });
      setRoutine(saved);
      setSlots(await doctorAvailabilityApi.list());
      setMessage('Weekly routine saved. Your booked appointments are preserved.');
    } catch (e) {
      setError(appointmentError(e, 'We could not save your weekly routine.'));
    } finally {
      setBusy(false);
    }
  };
  const onlineWithoutRoom =
    routine?.blocks.some((b) => b.enabled && b.consultationMode !== 'IN_PERSON') && !routine.defaultMeetingUrl;
  return (
    <div className="mx-auto max-w-[1100px] space-y-5">
      <header>
        <p className="clinora-r3-kicker">Practice schedule</p>
        <h1 className="mt-1 text-3xl font-semibold text-white">
          Weekly availability
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Repeats every week until you change it. Existing booked appointments stay in place.
        </p>
      </header>
      {error ? (
        <p role="alert" className="text-sm text-amber-200">
          {error}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="text-sm text-teal-200">
          {message}
        </p>
      ) : null}
      {routine ? (
        <>
          <DoctorMeetingRoom
            currentUrl={routine.defaultMeetingUrl}
            onSaved={(url) => setRoutine((current) => (current ? { ...current, defaultMeetingUrl: url } : current))}
          />
          <AppSurface padding="compact">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-xs text-slate-300">
                Appointment duration
                <select
                  aria-label="Appointment duration"
                  className={inputClass}
                  value={routine.slotMinutes}
                  onChange={(e) => setRoutine({ ...routine, slotMinutes: Number(e.target.value) })}
                >
                  {[15, 20, 30, 45, 60, 90, 120].map((n) => (
                    <option key={n} value={n}>
                      {n} minutes
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-xs text-slate-300">
                Timezone
                <input
                  className={inputClass}
                  value={routine.timezone}
                  onChange={(e) => setRoutine({ ...routine, timezone: e.target.value })}
                  placeholder="IANA timezone"
                />
              </label>
            </div>
            <div className="mt-4 divide-y divide-white/10">
              {days.map((day, dayIndex) => (
                <section key={day} aria-label={day} className="py-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-white">{day}</h2>
                    <Button
                      aria-label={'Add block for ' + day}
                      size="sm"
                      variant="appSecondary"
                      disabled={busy}
                      onClick={() =>
                        setRoutine({
                          ...routine,
                          blocks: [
                            ...routine.blocks,
                            { weekday: dayIndex + 1, start: '', end: '', consultationMode: 'IN_PERSON', enabled: true },
                          ],
                        })
                      }
                    >
                      <Plus size={14} />
                      Add block
                    </Button>
                  </div>
                  {!routine.blocks.some((b) => b.weekday === dayIndex + 1) ? (
                    <p className="text-xs text-slate-500">Unavailable</p>
                  ) : null}
                  <div className="space-y-3">
                    {routine.blocks.map((block, index) =>
                      block.weekday !== dayIndex + 1 ? null : (
                        <div key={index} className="grid items-end gap-3 sm:grid-cols-[85px_1fr_1fr_1.5fr_40px]">
                          <label className="flex min-h-10 items-center gap-2 text-xs text-slate-300">
                            <input
                              type="checkbox"
                              checked={block.enabled}
                              onChange={(e) => updateBlock(index, { enabled: e.target.checked })}
                              aria-label={day + ' block ' + (index + 1) + ' enabled'}
                            />
                            Enabled
                          </label>
                          <label className="grid gap-1 text-xs text-slate-400">
                            From
                            <input
                              type="time"
                              className={inputClass}
                              value={block.start}
                              onChange={(e) => updateBlock(index, { start: e.target.value })}
                            />
                          </label>
                          <label className="grid gap-1 text-xs text-slate-400">
                            To
                            <input
                              type="time"
                              className={inputClass}
                              value={block.end}
                              onChange={(e) => updateBlock(index, { end: e.target.value })}
                            />
                          </label>
                          <label className="grid gap-1 text-xs text-slate-400">
                            Mode
                            <select
                              className={inputClass}
                              value={block.consultationMode}
                              onChange={(e) =>
                                updateBlock(index, {
                                  consultationMode: e.target.value as WeeklyAvailabilityBlock['consultationMode'],
                                })
                              }
                            >
                              <option value="IN_PERSON">In-person</option>
                              <option value="ONLINE">Online</option>
                              <option value="BOTH">Online + In-person</option>
                            </select>
                          </label>
                          <button
                            type="button"
                            className="grid min-h-10 place-items-center text-slate-400 hover:text-rose-200"
                            aria-label={'Remove ' + day + ' block ' + (index + 1)}
                            onClick={() =>
                              setRoutine({ ...routine, blocks: routine.blocks.filter((_, i) => i !== index) })
                            }
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ),
                    )}
                  </div>
                </section>
              ))}
            </div>
            {onlineWithoutRoom ? (
              <p className="my-3 text-xs text-amber-200">
                Add your online consultation room before enabling Online availability.
              </p>
            ) : null}
            <Button
              variant="appPrimary"
              disabled={
                busy || Boolean(onlineWithoutRoom) || routine.blocks.some((b) => !b.start || !b.end || b.end <= b.start)
              }
              onClick={() => void save()}
            >
              {busy ? 'Saving…' : 'Save weekly routine'}
            </Button>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              Clinora maintains approximately 12 weeks of bookable times and refreshes the horizon automatically.
              Changes regenerate only free times from your routine.
            </p>
          </AppSurface>
          <AppSurface padding="compact">
            <h2 className="text-base font-semibold text-white">Upcoming concrete availability</h2>
            <p className="mt-1 text-xs text-slate-400">
              The next published times, including preserved bookings and existing one-off slots.
            </p>
            <ul className="mt-3 divide-y divide-white/10">
              {slots.slice(0, 21).map((slot) => (
                <li key={slot.id} className="flex flex-wrap justify-between gap-2 py-2 text-xs text-slate-300">
                  <span>
                    {new Date(slot.startsAt).toLocaleString(undefined, { timeZone: slot.timezone })} · {slot.timezone}
                  </span>
                  <span>
                    {slot.consultationMode === 'BOTH'
                      ? 'Online + In-person'
                      : slot.consultationMode === 'ONLINE'
                        ? 'Online'
                        : 'In-person'}{' '}
                    · {slot.status.toLowerCase()}
                  </span>
                </li>
              ))}
            </ul>
            {slots.length === 0 ? <p className="mt-3 text-xs text-slate-500">No published times yet.</p> : null}
          </AppSurface>
        </>
      ) : !error ? (
        <p role="status" className="text-sm text-slate-400">
          Loading weekly routine…
        </p>
      ) : null}
    </div>
  );
}
