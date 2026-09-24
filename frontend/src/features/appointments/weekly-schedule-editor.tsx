import { CalendarDays, Globe2, Plus, RefreshCw, Trash2, UserRound } from 'lucide-react';
import { AppSurface, IconWell } from '../../components/app/app-ui';
import { Button } from '../../components/ui/button';
import type { WeeklyAvailabilityBlock, WeeklyRoutine } from './appointment-api';
import {
  appointmentDurations,
  consultationLabels,
  emptyBlock,
  routineValidation,
  weekdays,
} from './weekly-availability';

export function WeeklyScheduleEditor({
  routine,
  onChange,
  onSave,
  busy,
  roomBusy = false,
  dirty,
  saved,
  error,
}: {
  routine: WeeklyRoutine;
  onChange: (routine: WeeklyRoutine) => void;
  onSave: () => void;
  busy: boolean;
  roomBusy?: boolean;
  dirty: boolean;
  saved: boolean;
  error: string;
}) {
  const disabled = busy || roomBusy;
  const validation = routineValidation(routine);
  const invalid = Boolean(validation.timezone || validation.limit || validation.blocks.some(Boolean));
  const updateBlock = (index: number, patch: Partial<WeeklyAvailabilityBlock>) =>
    onChange({
      ...routine,
      blocks: routine.blocks.map((block, i) => (i === index ? { ...block, ...patch } : block)),
    });
  const toggle = (weekday: number, enabled: boolean) =>
    onChange({
      ...routine,
      blocks: routine.blocks.some((b) => b.weekday === weekday)
        ? routine.blocks.map((b) => (b.weekday === weekday ? { ...b, enabled } : b))
        : [...routine.blocks, emptyBlock(weekday)],
    });
  return (
    <AppSurface as="section" aria-labelledby="weekly-schedule-title" padding="none" className="availability-card">
      <div className="availability-schedule-heading">
        <div className="availability-section-heading">
          <IconWell>
            <CalendarDays size={22} />
          </IconWell>
          <div>
            <h2 id="weekly-schedule-title">Weekly schedule</h2>
            <p>Define your regular availability. These time slots repeat every week until you update them.</p>
          </div>
        </div>
        <div className="availability-settings">
          <label>
            Appointment duration
            <select
              value={routine.slotMinutes}
              disabled={disabled}
              onChange={(e) => onChange({ ...routine, slotMinutes: Number(e.target.value) })}
            >
              {appointmentDurations.map((n) => (
                <option key={n} value={n}>
                  {n} minutes
                </option>
              ))}
            </select>
          </label>
          <label>
            Timezone
            <input
              value={routine.timezone ?? ''}
              disabled={disabled}
              aria-invalid={Boolean(validation.timezone)}
              aria-describedby={validation.timezone ? 'availability-timezone-error' : undefined}
              onChange={(e) => onChange({ ...routine, timezone: e.target.value })}
            />
          </label>
          {validation.timezone && (
            <p id="availability-timezone-error" className="availability-error">
              {validation.timezone}
            </p>
          )}
        </div>
      </div>
      <div className="availability-weekdays">
        {weekdays.map((day, dayIndex) => {
          const weekday = dayIndex + 1;
          const blocks = routine.blocks
            .map((block, index) => ({ block, index }))
            .filter(({ block }) => block.weekday === weekday && block.enabled);
          const enabled = blocks.length > 0;
          return (
            <section key={day} aria-label={day} className="availability-weekday">
              <div className="availability-day-label">
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  aria-label={`${day} availability`}
                  className="availability-toggle"
                  disabled={disabled}
                  onClick={() => toggle(weekday, !enabled)}
                >
                  <span />
                </button>
                <h3>{day}</h3>
              </div>
              {!enabled ? (
                <p className="availability-unavailable">Unavailable</p>
              ) : (
                <div className="availability-blocks">
                  {blocks.map(({ block, index }, ordinal) => {
                    const prefix = `${day} block ${ordinal + 1}`;
                    const errorId = `availability-block-${weekday}-${ordinal}-error`;
                    const message = validation.blocks[index];
                    const ModeIcon = block.consultationMode === 'IN_PERSON' ? UserRound : Globe2;
                    return (
                      <div key={index} className="availability-block">
                        <div className="availability-time-range">
                          <input
                            type="time"
                            aria-label={`${prefix} start`}
                            value={block.start}
                            disabled={disabled}
                            aria-invalid={Boolean(message)}
                            aria-describedby={message ? errorId : undefined}
                            onChange={(e) => updateBlock(index, { start: e.target.value })}
                          />
                          <span aria-hidden="true">–</span>
                          <input
                            type="time"
                            aria-label={`${prefix} end`}
                            value={block.end}
                            disabled={disabled}
                            aria-invalid={Boolean(message)}
                            aria-describedby={message ? errorId : undefined}
                            onChange={(e) => updateBlock(index, { end: e.target.value })}
                          />
                        </div>
                        <div className="availability-mode">
                          <ModeIcon size={16} aria-hidden="true" />
                          <select
                            aria-label={`${prefix} consultation mode`}
                            value={block.consultationMode}
                            disabled={disabled}
                            aria-describedby={message ? errorId : undefined}
                            onChange={(e) =>
                              updateBlock(index, {
                                consultationMode: e.target.value as WeeklyAvailabilityBlock['consultationMode'],
                              })
                            }
                          >
                            {Object.entries(consultationLabels).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </div>
                        {ordinal === blocks.length - 1 ? (
                          <button
                            type="button"
                            className="availability-add"
                            aria-label={`Add time block for ${day}`}
                            disabled={disabled || routine.blocks.filter((b) => b.enabled).length >= 35}
                            onClick={() => onChange({ ...routine, blocks: [...routine.blocks, emptyBlock(weekday)] })}
                          >
                            <Plus size={14} />
                            Add time block
                          </button>
                        ) : (
                          <span className="availability-add-spacer" />
                        )}
                        <button
                          type="button"
                          className="availability-remove"
                          aria-label={`Remove ${prefix}`}
                          disabled={disabled}
                          onClick={() => onChange({ ...routine, blocks: routine.blocks.filter((_, i) => i !== index) })}
                        >
                          <Trash2 size={17} />
                        </button>
                        {message && (
                          <p id={errorId} className="availability-error availability-block-error">
                            {message}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
      {validation.limit && <p className="availability-error">{validation.limit}</p>}
      {error && (
        <p role="alert" className="availability-error">
          {error}
        </p>
      )}
      <footer className="availability-save-bar">
        <Button variant="appPrimary" disabled={disabled || invalid || !dirty} onClick={onSave}>
          {busy ? 'Saving...' : saved && !dirty ? 'Saved' : 'Save weekly routine'}
        </Button>
        <span role="status" className="availability-save-status">
          {dirty ? 'Unsaved changes' : saved ? 'Weekly routine saved. Booked appointments are preserved.' : ''}
        </span>
        <p>
          <RefreshCw size={15} aria-hidden="true" />
          Clinora maintains approximately 12 weeks of bookable times and refreshes automatically.
        </p>
      </footer>
    </AppSurface>
  );
}
