import type { WeeklyAvailabilityBlock, WeeklyRoutine } from './appointment-api';

export const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const consultationLabels = { ONLINE: 'Online', IN_PERSON: 'In-person', BOTH: 'Online + In-person' };
// Matches WeeklyAvailabilityService's supported appointment lengths.
export const appointmentDurations = Array.from({ length: 22 }, (_, i) => 15 + i * 5);

export function emptyBlock(weekday: number): WeeklyAvailabilityBlock {
  return { weekday, start: '', end: '', consultationMode: 'IN_PERSON', enabled: true };
}

export function routineInput(routine: WeeklyRoutine) {
  return {
    version: routine.version,
    slotMinutes: routine.slotMinutes,
    timezone: routine.timezone,
    // Disabled days retain their drafts locally; only enabled blocks are published.
    blocks: routine.blocks.filter((b) => b.enabled),
  };
}

export function routineValidation(routine: WeeklyRoutine) {
  const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
  const blocks = routine.blocks.map((block, index) => {
    if (!block.enabled) return '';
    if (!block.start || !block.end) return 'Choose a start and end time.';
    if (minutes(block.end) <= minutes(block.start)) return 'End time must be after start time.';
    if (minutes(block.end) - minutes(block.start) < routine.slotMinutes)
      return 'This block must fit at least one appointment.';
    if (
      routine.blocks.some(
        (other, i) =>
          i !== index &&
          other.enabled &&
          other.weekday === block.weekday &&
          other.start &&
          other.end &&
          minutes(block.start) < minutes(other.end) &&
          minutes(other.start) < minutes(block.end),
      )
    )
      return 'Time blocks on this day must not overlap.';
    if (block.consultationMode !== 'IN_PERSON' && !routine.defaultMeetingUrl)
      return 'Save your default meeting room before enabling online availability.';
    return '';
  });
  let timezone = '';
  try {
    if (!routine.timezone) throw new Error();
    new Intl.DateTimeFormat('en', { timeZone: routine.timezone });
  } catch {
    timezone = 'Choose a valid timezone.';
  }
  return {
    blocks,
    timezone,
    limit: routineInput(routine).blocks.length > 35 ? 'Choose up to 35 weekly time blocks.' : '',
  };
}

export function dateKey(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  return ['year', 'month', 'day'].map((type) => parts.find((p) => p.type === type)?.value).join('-');
}

export function calendarDate(first: string, offset: number) {
  const date = new Date(first + 'T12:00:00Z');
  date.setUTCDate(date.getUTCDate() + offset);
  return date;
}

// A 15-day instant window covers all 14 local calendar dates, including a DST transition.
export function previewRange(now: Date) {
  return { from: now.toISOString(), until: new Date(now.getTime() + 15 * 86_400_000).toISOString() };
}
