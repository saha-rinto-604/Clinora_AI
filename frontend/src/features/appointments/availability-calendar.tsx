import { Ban, CalendarDays, ChevronLeft, ChevronRight, Clock3, LockKeyhole } from 'lucide-react';
import { useState } from 'react';
import { AppSurface, IconWell } from '../../components/app/app-ui';
import type { AvailabilitySlot } from './appointment-api';
import { calendarDate, consultationLabels, dateKey } from './weekly-availability';

export function AvailabilityCalendar({
  slots,
  timezone,
  now,
  loading,
  error,
  onRetry,
}: {
  slots: AvailabilitySlot[];
  timezone: string;
  now: Date;
  loading: boolean;
  error: string;
  onRetry: () => void;
}) {
  const [week, setWeek] = useState(0);
  const [expanded, setExpanded] = useState<string[]>([]);
  // A new Doctor may not have selected a timezone yet. Never substitute the browser's timezone.
  if (!timezone)
    return (
      <AppSurface className="availability-card">
        <h2>Upcoming availability (next 2 weeks)</h2>
        <p>Save your timezone to preview upcoming availability.</p>
      </AppSurface>
    );
  const first = dateKey(now, timezone);
  const dates = Array.from({ length: 7 }, (_, i) => calendarDate(first, week * 7 + i));
  const formatDate = (date: Date) =>
    date.toLocaleDateString(undefined, { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
  const time = (value: string) =>
    new Date(value).toLocaleTimeString(undefined, { timeZone: timezone, hour: 'numeric', minute: '2-digit' });
  return (
    <AppSurface as="section" aria-labelledby="availability-calendar-title" padding="none" className="availability-card">
      <div className="availability-calendar-heading">
        <div className="availability-section-heading">
          <IconWell>
            <CalendarDays size={22} />
          </IconWell>
          <div>
            <h2 id="availability-calendar-title">Upcoming availability (next 2 weeks)</h2>
            <p>Preview your upcoming time slots, including booked appointments and available slots.</p>
            <p className="availability-calendar-zone">Times shown in {timezone}</p>
          </div>
        </div>
        <nav aria-label="Availability date range" className="availability-date-navigation">
          <button type="button" disabled={week === 0} aria-label="Previous week" onClick={() => setWeek(0)}>
            <ChevronLeft size={18} />
          </button>
          <span aria-live="polite">
            {formatDate(dates[0])} – {formatDate(dates[6])}
          </span>
          <button type="button" disabled={week === 1} aria-label="Next week" onClick={() => setWeek(1)}>
            <ChevronRight size={18} />
          </button>
        </nav>
      </div>
      {loading ? (
        <p role="status" className="availability-calendar-message">
          Loading upcoming availability...
        </p>
      ) : error ? (
        <div className="availability-calendar-message">
          <p role="alert" className="availability-error">
            {error}
          </p>
          <button type="button" className="availability-add" onClick={onRetry}>
            Retry preview
          </button>
        </div>
      ) : (
        <div className="availability-calendar-grid">
          {dates.map((date) => {
            const key = date.toISOString().slice(0, 10);
            const daySlots = slots
              .filter(
                (slot) =>
                  slot.status !== 'BLOCKED' &&
                  new Date(slot.startsAt) > now &&
                  dateKey(new Date(slot.startsAt), timezone) === key,
              )
              .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
            const isExpanded = expanded.includes(key);
            // Keep a booking visible even when the day's first three slots are all free.
            const preview = daySlots.slice(0, 3);
            const booked = daySlots.find((slot) => slot.status === 'BOOKED');
            if (booked && !preview.some((slot) => slot.status === 'BOOKED')) preview[preview.length - 1] = booked;
            const visible = isExpanded ? daySlots : preview;
            return (
              <section
                key={key}
                aria-label={date.toLocaleDateString(undefined, {
                  timeZone: 'UTC',
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
                className="availability-calendar-day"
              >
                <h3>
                  <span>{date.toLocaleDateString(undefined, { timeZone: 'UTC', weekday: 'short' })}</span>
                  <time dateTime={key}>
                    {date.toLocaleDateString(undefined, { timeZone: 'UTC', month: 'short', day: 'numeric' })}
                  </time>
                </h3>
                {daySlots.length ? (
                  <>
                    <ul>
                      {visible.map((slot) => {
                        const booked = slot.status === 'BOOKED';
                        const Icon = booked ? LockKeyhole : Clock3;
                        return (
                          <li
                            key={slot.id}
                            className={`availability-calendar-slot ${booked ? 'is-booked' : 'is-available'}`}
                            title={slot.consultationMode ? consultationLabels[slot.consultationMode] : undefined}
                          >
                            <Icon size={15} aria-hidden="true" />
                            <div>
                              <span>
                                {time(slot.startsAt)}–{time(slot.endsAt)}
                              </span>
                              <strong>{booked ? 'Booked' : 'Available'}</strong>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                    {daySlots.length > 3 && (
                      <button
                        type="button"
                        className="availability-more"
                        aria-expanded={isExpanded}
                        aria-label={`${isExpanded ? 'Show fewer slots' : `Show ${daySlots.length - 3} more slots`} for ${formatDate(date)}`}
                        onClick={() =>
                          setExpanded((current) =>
                            isExpanded ? current.filter((value) => value !== key) : [...current, key],
                          )
                        }
                      >
                        {isExpanded ? 'Show fewer slots' : `+${daySlots.length - 3} more slots`}
                      </button>
                    )}
                  </>
                ) : (
                  <p className="availability-calendar-empty">
                    <Ban size={21} aria-hidden="true" />
                    No availability
                  </p>
                )}
              </section>
            );
          })}
        </div>
      )}
    </AppSurface>
  );
}
