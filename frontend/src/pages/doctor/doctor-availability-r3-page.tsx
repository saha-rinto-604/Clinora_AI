import { ChevronLeft, ChevronRight, Clock3, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { StatusPill } from '../../components/app/app-ui';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../components/ui/dialog';
import { Skeleton } from '../../components/ui/feedback';
import {
  appointmentError,
  doctorAvailabilityApi,
  type AvailabilitySlot,
} from '../../features/appointments/appointment-api';
import { cn } from '../../lib/cn';

export function DoctorAvailabilityWorkspacePage() {
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [slotMinutes, setSlotMinutes] = useState(30);
  const [weekOffset, setWeekOffset] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [dialogError, setDialogError] = useState('');
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  const load = async () => {
    setSlots(await doctorAvailabilityApi.list());
  };

  useEffect(() => {
    let active = true;
    doctorAvailabilityApi
      .list()
      .then((items) => active && setSlots(items))
      .catch(
        (requestError) => active && setError(appointmentError(requestError, 'We could not load your availability.')),
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const weekStart = useMemo(() => addDays(startOfWeek(new Date()), weekOffset * 7), [weekOffset]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart]);
  const visibleDayKeys = useMemo(
    () => new Set(weekDays.map((day) => dateKeyInZone(day, timezone))),
    [timezone, weekDays],
  );
  const visibleSlots = useMemo(
    () => slots.filter((slot) => visibleDayKeys.has(dateKeyInZone(new Date(slot.startsAt), timezone))),
    [slots, timezone, visibleDayKeys],
  );

  const create = async () => {
    if (!startsAt || !endsAt) return;
    setBusy('create');
    setDialogError('');
    try {
      await doctorAvailabilityApi.create({
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        slotMinutes,
        timezone,
      });
      setStartsAt('');
      setEndsAt('');
      setDialogOpen(false);
      await load();
    } catch (requestError) {
      setDialogError(appointmentError(requestError, 'We could not add this availability window.'));
    } finally {
      setBusy('');
    }
  };

  const remove = async (slotId: string) => {
    setBusy(slotId);
    setError('');
    try {
      await doctorAvailabilityApi.remove(slotId);
      await load();
    } catch (requestError) {
      setError(appointmentError(requestError, 'Only future unbooked availability can be removed.'));
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-5 border-b border-white/[0.06] pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="clinora-r3-kicker">Practice schedule</p>
          <h1
            aria-label="Booking times"
            className="mt-1.5 text-3xl font-semibold tracking-[-0.045em] text-white sm:text-[2.15rem]"
          >
            Availability
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Publish the times Patients can book. Confirmed bookings stay protected and remain visible in your clinical
            schedule.
          </p>
        </div>
        <Button
          variant="appPrimary"
          onClick={() => {
            setDialogError('');
            setDialogOpen(true);
          }}
        >
          <Plus size={15} aria-hidden="true" /> Add availability
        </Button>
      </header>

      {error ? (
        <div className="rounded-[14px] border border-rose-300/[0.12] bg-rose-300/[0.045] px-4 py-3" role="alert">
          <p className="text-sm text-rose-200">{error}</p>
        </div>
      ) : null}

      <section className="clinora-r3-panel overflow-hidden" aria-labelledby="availability-week-title">
        <div className="flex flex-col gap-4 border-b border-white/[0.06] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="clinora-r3-kicker">Week view</p>
            <h2 id="availability-week-title" className="mt-1 text-lg font-semibold tracking-[-0.025em] text-white">
              {formatWeekRange(weekStart, addDays(weekStart, 6))}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={weekOffset === 0}
              aria-label="Previous week"
              onClick={() => setWeekOffset((value) => Math.max(0, value - 1))}
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </Button>
            <button
              type="button"
              onClick={() => setWeekOffset(0)}
              className="min-h-9 rounded-[9px] border border-white/[0.07] bg-white/[0.025] px-3 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.05] hover:text-white"
            >
              This week
            </button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="Next week"
              disabled={weekOffset >= 17}
              onClick={() => setWeekOffset((value) => Math.min(17, value + 1))}
            >
              <ChevronRight size={16} aria-hidden="true" />
            </Button>
          </div>
        </div>

        {loading ? (
          <div
            className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 sm:p-6"
            role="status"
            aria-label="Loading availability"
          >
            {Array.from({ length: 7 }, (_, index) => (
              <Skeleton key={index} className="h-64 rounded-[14px]" />
            ))}
          </div>
        ) : (
          <div className="clinora-r3-calendar-grid grid lg:grid-cols-7">
            {weekDays.map((day, dayIndex) => {
              const dayKey = dateKeyInZone(day, timezone);
              const daySlots = visibleSlots.filter(
                (slot) => dateKeyInZone(new Date(slot.startsAt), timezone) === dayKey,
              );
              const today = dayKey === dateKeyInZone(new Date(), timezone);
              return (
                <section
                  key={day.toISOString()}
                  className={cn(
                    'clinora-r3-calendar-day min-w-0 border-b border-white/[0.055] p-3.5 lg:border-b-0 lg:border-r lg:last:border-r-0',
                    today && 'bg-cyan-300/[0.018]',
                  )}
                  aria-labelledby={`availability-day-${dayIndex}`}
                >
                  <div className="flex items-center justify-between gap-3 lg:block">
                    <div>
                      <p
                        className={cn(
                          'text-[10px] font-bold uppercase tracking-[0.13em]',
                          today ? 'text-cyan-200' : 'text-slate-600',
                        )}
                      >
                        {day.toLocaleDateString(undefined, { weekday: 'short' })}
                      </p>
                      <h3
                        id={`availability-day-${dayIndex}`}
                        className="mt-1 text-lg font-semibold tabular-nums text-white"
                      >
                        {day.getDate()}
                      </h3>
                    </div>
                    {today ? (
                      <StatusPill tone="info" className="lg:mt-2">
                        Today
                      </StatusPill>
                    ) : null}
                  </div>

                  <div className="mt-4 grid gap-2">
                    {daySlots.length ? (
                      daySlots.map((slot) => (
                        <AvailabilityBlock
                          key={slot.id}
                          slot={slot}
                          busy={busy === slot.id}
                          onRemove={() => void remove(slot.id)}
                        />
                      ))
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setDialogError('');
                          setDialogOpen(true);
                        }}
                        className="min-h-20 rounded-[12px] border border-dashed border-white/[0.065] px-3 py-4 text-left transition hover:border-cyan-300/[0.14] hover:bg-cyan-300/[0.02]"
                      >
                        <span className="block text-xs font-medium text-slate-600">No published times</span>
                        <span className="mt-1 block text-[10px] text-slate-700">Add availability</span>
                      </button>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {!loading ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.055] px-5 py-3.5 text-xs text-slate-600 sm:px-6">
            <span>
              {visibleSlots.length} published slot{visibleSlots.length === 1 ? '' : 's'} this week
            </span>
            <span>Timezone · {timezone.replaceAll('_', ' ')}</span>
          </div>
        ) : null}
      </section>

      <Dialog
        open={dialogOpen}
        onOpenChange={(next) => {
          setDialogOpen(next);
          if (!next) setDialogError('');
        }}
      >
        <DialogContent className="max-w-lg overflow-hidden p-0">
          <div className="border-b border-white/[0.07] px-5 py-5 sm:px-6">
            <DialogTitle className="text-xl font-semibold tracking-[-0.025em] text-white">Add availability</DialogTitle>
            <DialogDescription className="mt-2 text-sm leading-6 text-slate-500">
              Publish a future time window. Clinora divides it into bookable appointments using the consultation length
              you choose.
            </DialogDescription>
          </div>
          <div className="space-y-4 px-5 py-5 sm:px-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Starts">
                <input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(event) => setStartsAt(event.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Ends">
                <input
                  type="datetime-local"
                  value={endsAt}
                  onChange={(event) => setEndsAt(event.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>
            <Field label="Appointment length">
              <select
                value={slotMinutes}
                onChange={(event) => setSlotMinutes(Number(event.target.value))}
                className={inputClass}
              >
                {[15, 20, 30, 45, 60, 90, 120].map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes} minutes
                  </option>
                ))}
              </select>
            </Field>
            {dialogError ? (
              <p
                role="alert"
                className="rounded-[11px] border border-rose-300/[0.12] bg-rose-300/[0.04] px-3.5 py-3 text-xs leading-5 text-rose-200"
              >
                {dialogError}
              </p>
            ) : null}
            <div className="rounded-[12px] border border-white/[0.06] bg-white/[0.025] px-3.5 py-3 text-xs leading-5 text-slate-500">
              <span className="font-semibold text-slate-300">Timezone:</span> {timezone.replaceAll('_', ' ')}. Booked
              times cannot be removed accidentally from this screen.
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2 border-t border-white/[0.07] bg-black/10 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            <Button
              type="button"
              variant="appSecondary"
              onClick={() => setDialogOpen(false)}
              disabled={busy === 'create'}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="appPrimary"
              onClick={() => void create()}
              disabled={!startsAt || !endsAt || busy === 'create'}
            >
              <Plus size={15} aria-hidden="true" /> {busy === 'create' ? 'Publishing…' : 'Publish availability'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AvailabilityBlock({ slot, busy, onRemove }: { slot: AvailabilitySlot; busy: boolean; onRemove: () => void }) {
  const available = slot.status === 'AVAILABLE';
  const booked = slot.status === 'BOOKED';
  return (
    <div
      className={cn(
        'group rounded-[12px] border px-3 py-2.5',
        available && 'border-teal-300/[0.11] bg-teal-300/[0.045]',
        booked && 'border-cyan-300/[0.11] bg-cyan-300/[0.045]',
        !available && !booked && 'border-white/[0.06] bg-white/[0.02]',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold tabular-nums text-slate-100">{formatSlotTime(slot)}</p>
          <p className="mt-1 text-[10px] text-slate-600">{slotDuration(slot)}</p>
        </div>
        {available ? (
          <button
            type="button"
            aria-label={`Remove availability at ${formatSlotTime(slot)}`}
            disabled={busy}
            onClick={onRemove}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] text-slate-600 opacity-100 transition hover:bg-rose-300/[0.06] hover:text-rose-200 disabled:opacity-40 lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100"
          >
            <Trash2 size={13} aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em]">
        <Clock3 size={11} aria-hidden="true" />
        <span className={available ? 'text-teal-200/80' : booked ? 'text-cyan-200/80' : 'text-slate-600'}>
          {available ? 'Available' : booked ? 'Booked' : 'Blocked'}
        </span>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2 text-xs font-semibold text-slate-300">
      {label}
      {children}
    </label>
  );
}

const inputClass =
  'min-h-11 w-full rounded-[11px] border border-white/[0.08] bg-white/[0.03] px-3 text-sm font-normal text-white outline-none transition focus:border-cyan-300/25 focus:ring-4 focus:ring-cyan-300/[0.045]';

function startOfWeek(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  const mondayDelta = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + mondayDelta);
  return date;
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function dateKeyInZone(value: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const year = parts.find((part) => part.type === 'year')?.value ?? '0000';
  const month = parts.find((part) => part.type === 'month')?.value ?? '00';
  const day = parts.find((part) => part.type === 'day')?.value ?? '00';
  return `${year}-${month}-${day}`;
}

function formatWeekRange(start: Date, end: Date) {
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  if (sameMonth) {
    return `${start.toLocaleDateString(undefined, { month: 'long' })} ${start.getDate()}–${end.getDate()}, ${end.getFullYear()}`;
  }
  return `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

function formatSlotTime(slot: AvailabilitySlot) {
  const format = (value: string) =>
    new Date(value).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: slot.timezone,
    });
  return `${format(slot.startsAt)}–${format(slot.endsAt)}`;
}

function slotDuration(slot: AvailabilitySlot) {
  const minutes = Math.round((new Date(slot.endsAt).getTime() - new Date(slot.startsAt).getTime()) / 60_000);
  if (!Number.isFinite(minutes) || minutes <= 0) return 'Invalid duration';
  return `${minutes} min`;
}
