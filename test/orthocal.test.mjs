import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parsePost, validatePost } from '../scripts/lib/posts.mjs';
import { dayTitle, daySlugSource, describeDay, fetchRange, selectCandidates } from '../scripts/lib/orthocal.mjs';
import { skeletonPost } from '../scripts/hydrate-calendar.mjs';
import { config } from './helpers.mjs';

const day = (overrides) => ({
  julian_day_number: 2461325,
  weekday: 0,
  titles: ['19th Sunday after Pentecost'],
  summary_title: '19th Sunday after Pentecost',
  feast_level: 0,
  feast_level_description: 'Liturgy',
  feasts: ['Fathers of the Seventh Ecumenical Council'],
  saints: ['Apostle Philip of the Seventy'],
  tone: 2,
  fast_level_desc: 'No Fast',
  fast_exception_desc: '',
  readings: [
    { source: 'Matins Gospel', display: 'Luke 24.36-53' },
    { source: 'Epistle', display: 'Hebrews 13.7-16' },
    { source: 'Gospel', display: 'Luke 8.5-15' },
  ],
  date: '2026-10-11',
  ...overrides,
});

test('titles and slugs for Sundays, great feasts and weekday saints', () => {
  assert.equal(dayTitle(day()), '19th Sunday after Pentecost: Fathers of the Seventh Ecumenical Council');
  assert.equal(daySlugSource(day()), 'Fathers of the Seventh Ecumenical Council');

  const palm = day({ feast_level: 8, titles: ['Palm Sunday: Entrance of Our Lord into Jerusalem'], summary_title: 'Palm Sunday: Entrance of Our Lord into Jerusalem', feasts: ['Holy Apostle and Evangelist Mark'] });
  assert.equal(dayTitle(palm), 'Palm Sunday: Entrance of Our Lord into Jerusalem');

  const thomas = day({ weekday: 2, feast_level: 5, feasts: null, titles: ['Tuesday of the 19th week after Pentecost'], summary_title: 'Holy Apostle Thomas; Repose of St Innocent' });
  assert.equal(dayTitle(thomas), 'Holy Apostle Thomas');
  assert.equal(daySlugSource(thomas), 'Holy Apostle Thomas');
});

test('selectCandidates keeps Sundays and high feasts', () => {
  const days = [day(), day({ weekday: 3, feast_level: 3 }), day({ weekday: 5, feast_level: 8 })];
  assert.equal(selectCandidates(days, { include_sundays: true, min_feast_level: 5 }).length, 2);
  assert.equal(selectCandidates(days, { include_sundays: false, min_feast_level: 5 }).length, 1);
});

test('describeDay keeps the liturgical readings only', () => {
  const info = describeDay(day());
  assert.deepEqual(info.readings, ['Epistle: Hebrews 13.7-16', 'Gospel: Luke 8.5-15']);
  assert.equal(info.orthocal_url, 'https://orthocal.info/readings/gregorian/2026/10/11/');
});

test('fetchRange maps Julian Day Numbers to civil dates and trims the range', async () => {
  const calls = [];
  const fakeFetch = async (url) => {
    calls.push(url);
    const [, , year, month] = url.match(/api\/(\w+)\/(\d+)\/(\d+)\//);
    const first = Date.UTC(+year, +month - 1, 1) / 86_400_000 + 2_440_588;
    return { ok: true, json: async () => [0, 1, 2].map((i) => ({ julian_day_number: first + i, year: 1900 })) };
  };
  const days = await fetchRange('julian', '2026-12-02', '2027-01-01', fakeFetch);
  assert.deepEqual(calls, ['https://orthocal.info/api/julian/2026/12/', 'https://orthocal.info/api/julian/2027/1/']);
  assert.deepEqual(days.map((d) => d.date), ['2026-12-02', '2026-12-03', '2027-01-01']);
});

test('skeleton posts are valid drafts with a caption placeholder', () => {
  const d = day();
  const text = skeletonPost(d, describeDay(d), config);
  const post = parsePost(text, '2026-10-11-fathers-of-the-seventh-ecumenical-council.md');
  assert.equal(post.data.status, 'draft');
  assert.equal(post.data.publish_at, '2026-10-11T07:00:00-05:00');
  assert.equal(post.data.orthocal_date, '2026-10-11');
  assert.deepEqual(validatePost(post, config).errors, []);
  assert.equal(validatePost(post, config, { forbidPlaceholders: true }).errors.length, 1);
});
