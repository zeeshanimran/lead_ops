import assert from 'node:assert/strict';
import { buildAvailabilitySlots, defaultAvailabilityConfig, hasBufferConflict, parseScheduledAt, slotMatches, type BusyPeriod } from '../src/leads/availability';

const cfg = defaultAvailabilityConfig;

function busy(start: string, end: string): BusyPeriod {
  return { start: parseScheduledAt(start), end: parseScheduledAt(end) };
}

function slotStarts(date: string, durationMinutes: number, periods: BusyPeriod[] = []) {
  return buildAvailabilitySlots(date, durationMinutes, cfg, periods).availableSlots.map((slot) => slot.start);
}

function hasSlot(date: string, durationMinutes: number, start: string, periods: BusyPeriod[] = []) {
  return slotStarts(date, durationMinutes, periods).includes(start);
}

{
  const periods = [busy('2026-07-06T17:00:00+05:00', '2026-07-06T18:00:00+05:00')];
  assert.equal(hasSlot('2026-07-06', 60, '2026-07-06T18:00:00+05:00', periods), false);
  assert.equal(hasBufferConflict(parseScheduledAt('2026-07-06T18:15:00+05:00'), parseScheduledAt('2026-07-06T19:15:00+05:00'), periods[0], 30), true);
  assert.equal(hasSlot('2026-07-06', 60, '2026-07-06T18:30:00+05:00', periods), true);
}

{
  const periods = [busy('2026-07-06T18:30:00+05:00', '2026-07-06T19:30:00+05:00')];
  assert.equal(hasBufferConflict(parseScheduledAt('2026-07-06T17:00:00+05:00'), parseScheduledAt('2026-07-06T18:00:00+05:00'), periods[0], 30), false);
  assert.equal(hasBufferConflict(parseScheduledAt('2026-07-06T17:30:00+05:00'), parseScheduledAt('2026-07-06T18:30:00+05:00'), periods[0], 30), true);
}

{
  assert.deepEqual(slotStarts('2026-07-04', 60), []);
  assert.deepEqual(slotStarts('2026-07-05', 60), []);
  assert.equal(hasSlot('2026-07-06', 60, '2026-07-06T11:30:00+05:00'), false);
  assert.equal(hasSlot('2026-07-06', 90, '2026-07-06T23:00:00+05:00'), false);
  assert.equal(hasSlot('2026-07-06', 90, '2026-07-06T22:30:00+05:00'), true);
}

{
  const leadOpsBusy = busy('2026-07-06T12:00:00+05:00', '2026-07-06T13:00:00+05:00');
  const googleBusy = busy('2026-07-06T14:00:00+05:00', '2026-07-06T15:00:00+05:00');
  const available = slotStarts('2026-07-06', 60, [leadOpsBusy, googleBusy]);
  assert.equal(available.includes('2026-07-06T12:00:00+05:00'), false);
  assert.equal(available.includes('2026-07-06T14:00:00+05:00'), false);
  assert.equal(available.includes('2026-07-06T15:30:00+05:00'), true);
}

{
  const available = buildAvailabilitySlots('2026-07-06', 45, cfg, []).availableSlots;
  assert.equal(available[0]?.label, '12:00 PM to 12:45 PM');
  assert.equal(available[available.length - 1]?.label, '11:00 PM to 11:45 PM');
  assert.equal(buildAvailabilitySlots('2026-07-06', 60, cfg, []).availableSlots[0]?.label, '12:00 PM to 1:00 PM');
  assert.equal(slotMatches('2026-07-06T12:00:00+05:00', parseScheduledAt('2026-07-06T12:00:00+05:00')), true);
  assert.equal(parseScheduledAt('2026-07-06T12:00').toISOString(), '2026-07-06T07:00:00.000Z');
}

console.log('availability tests passed');
