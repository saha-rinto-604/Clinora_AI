import { ArrowLeft, CalendarClock, Clock3, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { AppSectionHeader, AppSurface, EmptyState, IconWell, StatusPill } from '../../components/app/app-ui';
import { Button } from '../../components/ui/button';
import { buttonVariants } from '../../components/ui/button-variants';
import { Skeleton } from '../../components/ui/feedback';
import {
  appointmentError,
  doctorAvailabilityApi,
  type AvailabilitySlot,
} from '../../features/appointments/appointment-api';

export function DoctorAvailabilityPage() {
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [slotMinutes, setSlotMinutes] = useState(30);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
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

  const create = async () => {
    if (!startsAt || !endsAt) return;
    setBusy('create');
    setError('');
    try {
      await doctorAvailabilityApi.create({
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        slotMinutes,
        timezone,
      });
      setStartsAt('');
      setEndsAt('');
      await load();
    } catch (requestError) {
      setError(appointmentError(requestError, 'We could not add this availability window.'));
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
    <main className="min-h-screen bg-[var(--clinora-bg-canvas)] px-4 py-8 text-white sm:px-7 lg:px-10">
      <div className="mx-auto w-full max-w-[1000px]">
        <Link to="/account" className={buttonVariants({ variant: 'appSecondary' })}>
          <ArrowLeft size={15} />
          Account
        </Link>
        <header className="mt-7">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--clinora-info-foreground)]">
            Clinora Doctor
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">My availability</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--clinora-text-muted)]">
            Set the future times when Patients can book an appointment with you.
          </p>
        </header>

        <div className="mt-7 grid gap-6 lg:grid-cols-[23rem_minmax(0,1fr)]">
          <AppSurface as="section" variant="elevated" className="h-fit" aria-labelledby="add-availability-title">
            <AppSectionHeader
              eyebrow="Booking availability"
              title="Add a time window"
              titleId="add-availability-title"
              copy={`Times are entered in ${timezone}. Clinora divides the window into appointment slots.`}
            />
            <div className="mt-5 space-y-4">
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
              <Button
                variant="appPrimary"
                className="w-full"
                onClick={() => void create()}
                disabled={!startsAt || !endsAt || busy === 'create'}
              >
                <Plus size={15} />
                {busy === 'create' ? 'Adding…' : 'Add availability'}
              </Button>
            </div>
          </AppSurface>

          <AppSurface as="section" aria-labelledby="published-times-title">
            <AppSectionHeader
              title="Published times"
              titleId="published-times-title"
              copy="Booked times stay reserved. You can remove future availability that has not been booked."
            />
            {error ? (
              <p role="alert" className="mt-4 text-sm text-rose-300">
                {error}
              </p>
            ) : null}
            {loading ? (
              <div className="mt-5 space-y-3">
                <Skeleton className="h-20 rounded-xl" />
                <Skeleton className="h-20 rounded-xl" />
              </div>
            ) : null}
            {!loading && !slots.length ? (
              <EmptyState
                className="mt-5"
                icon={<CalendarClock size={18} />}
                title="No future availability"
                copy="Add a future time window when you are ready to accept Patient bookings."
              />
            ) : null}
            {slots.length ? (
              <ul className="mt-5 divide-y divide-[var(--clinora-border-subtle)] border-y border-[var(--clinora-border-subtle)]">
                {slots.map((slot) => (
                  <li key={slot.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex gap-3">
                      <IconWell tone="info">
                        <Clock3 size={16} />
                      </IconWell>
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {new Date(slot.startsAt).toLocaleString(undefined, {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </p>
                        <p className="mt-1 text-xs text-[var(--clinora-text-muted)]">
                          to{' '}
                          {new Date(slot.endsAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}{' '}
                          · {slot.timezone}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusPill tone={slot.status === 'AVAILABLE' ? 'success' : 'info'}>
                        {slot.status === 'AVAILABLE' ? 'Available' : 'Booked'}
                      </StatusPill>
                      {slot.status === 'AVAILABLE' ? (
                        <Button
                          variant="ghost"
                          className="text-rose-200"
                          disabled={busy === slot.id}
                          onClick={() => void remove(slot.id)}
                          aria-label="Remove available time"
                        >
                          <Trash2 size={15} />
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </AppSurface>
        </div>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm font-semibold text-white">
      {label}
      <span className="mt-2 block">{children}</span>
    </label>
  );
}
const inputClass =
  'min-h-11 w-full rounded-xl border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-nested)] px-3 text-sm font-normal text-white outline-none focus:border-[var(--clinora-border-interactive)] focus:ring-4 focus:ring-[var(--clinora-focus-ring-soft)]';
