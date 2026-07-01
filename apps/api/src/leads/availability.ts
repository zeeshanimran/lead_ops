import { DateTime } from 'luxon';

export type BusyPeriod = {
  start: Date;
  end: Date;
};

export type AvailabilitySlot = {
  start: string;
  end: string;
  label: string;
};

export type AvailabilityConfig = {
  timezone: string;
  start: string;
  end: string;
  workingDays: string[];
  slotIntervalMinutes: number;
  bufferAfterMinutes: number;
};

export const defaultAvailabilityConfig: AvailabilityConfig = {
  timezone: 'Asia/Karachi',
  start: '12:00',
  end: '24:00',
  workingDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
  slotIntervalMinutes: 30,
  bufferAfterMinutes: 30,
};

export function buildAvailabilitySlots(
  date: string,
  durationMinutes: number,
  config: AvailabilityConfig,
  busyPeriods: BusyPeriod[],
) {
  const day = parsePakistanDate(date, config.timezone);
  const weekday = day.weekdayLong.toUpperCase();
  const windowStart = timeOnDay(day, config.start);
  const windowEnd = timeOnDay(day, config.end);

  if (!config.workingDays.includes(weekday)) {
    return {
      windowStart,
      windowEnd,
      availableSlots: [] as AvailabilitySlot[],
      reason: 'Calls can only be scheduled Monday through Friday.',
    };
  }

  const slots: AvailabilitySlot[] = [];
  for (let cursor = windowStart; cursor.plus({ minutes: durationMinutes }) <= windowEnd; cursor = cursor.plus({ minutes: config.slotIntervalMinutes })) {
    const end = cursor.plus({ minutes: durationMinutes });
    const conflict = busyPeriods.some((busy) => hasBufferConflict(cursor.toJSDate(), end.toJSDate(), busy, config.bufferAfterMinutes));
    if (!conflict) {
      slots.push({
        start: toOffsetIso(cursor),
        end: toOffsetIso(end),
        label: `${cursor.toFormat('h:mm a')} to ${end.toFormat('h:mm a')}`,
      });
    }
  }

  return { windowStart, windowEnd, availableSlots: slots };
}

export function hasBufferConflict(proposedStart: Date, proposedEnd: Date, existing: BusyPeriod, bufferAfterMinutes: number) {
  return proposedStart.getTime() < addMinutes(existing.end, bufferAfterMinutes).getTime()
    && addMinutes(proposedEnd, bufferAfterMinutes).getTime() > existing.start.getTime();
}

export function slotMatches(slotStartIso: string, proposedStart: Date) {
  return Math.abs(DateTime.fromISO(slotStartIso, { setZone: true }).toMillis() - proposedStart.getTime()) < 1000;
}

export function parsePakistanDate(date: string, timezone = defaultAvailabilityConfig.timezone) {
  const parsed = DateTime.fromISO(date, { zone: timezone });
  if (!parsed.isValid || date !== parsed.toFormat('yyyy-MM-dd')) throw new Error('Invalid Pakistan date');
  return parsed.startOf('day');
}

export function parseScheduledAt(value: string, timezone = defaultAvailabilityConfig.timezone) {
  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(value)) return DateTime.fromISO(value, { setZone: true }).toUTC().toJSDate();
  return DateTime.fromISO(value, { zone: timezone }).toUTC().toJSDate();
}

export function toOffsetIso(value: DateTime) {
  return value.toFormat("yyyy-MM-dd'T'HH:mm:ssZZ");
}

export function timeOnDay(day: DateTime, time: string) {
  if (time === '24:00') return day.plus({ days: 1 });
  const [hour, minute] = time.split(':').map(Number);
  return day.set({ hour, minute, second: 0, millisecond: 0 });
}

function addMinutes(value: Date, minutes: number) {
  return new Date(value.getTime() + minutes * 60 * 1000);
}
