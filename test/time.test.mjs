import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addDays, jdnToIsoDate, localDate, parsePublishAt, zonedIso } from '../scripts/lib/time.mjs';

const TZ = 'America/Chicago';

test('parsePublishAt honours explicit offsets', () => {
  assert.equal(parsePublishAt('2026-10-11T07:00:00-05:00', TZ).toISOString(), '2026-10-11T12:00:00.000Z');
  assert.equal(parsePublishAt('2026-10-11T12:00:00Z', TZ).toISOString(), '2026-10-11T12:00:00.000Z');
});

test('parsePublishAt treats offset-less values as parish-local time, across DST', () => {
  assert.equal(parsePublishAt('2026-10-11T07:00', TZ).toISOString(), '2026-10-11T12:00:00.000Z');
  assert.equal(parsePublishAt('2026-12-25T07:00:00', TZ).toISOString(), '2026-12-25T13:00:00.000Z');
});

test('parsePublishAt rejects dates without a time and junk', () => {
  assert.equal(parsePublishAt('2026-10-11', TZ), null);
  assert.equal(parsePublishAt('next sunday', TZ), null);
  assert.equal(parsePublishAt(undefined, TZ), null);
});

test('zonedIso includes the right offset for the date', () => {
  assert.equal(zonedIso('2026-10-11', '07:00', TZ), '2026-10-11T07:00:00-05:00');
  assert.equal(zonedIso('2026-12-25', '07:00', TZ), '2026-12-25T07:00:00-06:00');
});

test('localDate uses the parish timezone', () => {
  assert.equal(localDate(new Date('2026-10-12T03:00:00Z'), TZ), '2026-10-11');
});

test('date helpers', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(jdnToIsoDate(2461325), '2026-10-11');
});
