// Helpers for the orthocal.info liturgical calendar API.
import { addDays, jdnToIsoDate } from './time.mjs';

export const ORTHOCAL_API = 'https://orthocal.info/api';

/** Fetch every day of a civil month. Dates are normalised to civil "YYYY-MM-DD". */
export async function fetchMonth(source, year, month, fetchImpl = globalThis.fetch) {
  const url = `${ORTHOCAL_API}/${source}/${year}/${month}/`;
  for (let attempt = 0; ; attempt++) {
    const res = await fetchImpl(url, { headers: { Accept: 'application/json' } });
    if (res.ok) {
      const days = await res.json();
      // For the Julian calendar the API's year/month/day fields are Julian
      // dates; the Julian Day Number gives us the civil date in both cases.
      return days.map((day) => ({ ...day, date: jdnToIsoDate(day.julian_day_number) }));
    }
    if (attempt >= 2) throw new Error(`orthocal: ${url} returned HTTP ${res.status}`);
    await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
  }
}

/** Fetch all days in [start, end] (inclusive, civil "YYYY-MM-DD"). */
export async function fetchRange(source, start, end, fetchImpl) {
  const days = [];
  let [y, m] = start.split('-').map(Number);
  const [endY, endM] = end.split('-').map(Number);
  while (y < endY || (y === endY && m <= endM)) {
    days.push(...(await fetchMonth(source, y, m, fetchImpl)));
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return days.filter((d) => d.date >= start && d.date <= end);
}

const list = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);

/** Pick the days worth a post: Sundays and feasts at/above the configured level. */
export function selectCandidates(days, calendar) {
  return days.filter(
    (d) => (calendar.include_sundays && d.weekday === 0) || d.feast_level >= calendar.min_feast_level,
  );
}

const firstPart = (text) => String(text ?? '').split(';')[0].trim().replace(/\.$/, '');

const FEAST_RANKS = {
  8: 'Great Feast of the Lord',
  7: 'Great Feast of the Theotokos',
  6: 'Great Feast',
  5: 'Vigil-rank feast',
  4: 'Polyeleos-rank feast',
  3: 'Doxology-rank feast',
  2: 'Six-stichera-rank commemoration',
};

/** A short, human title for a calendar day. */
export function dayTitle(day) {
  const feasts = list(day.feasts);
  // Great feasts (incl. moveable ones like Palm Sunday) are named in the summary title.
  if (day.feast_level >= 6) return firstPart(day.summary_title);
  if (day.weekday === 0) {
    const sunday = list(day.titles)[0] ?? firstPart(day.summary_title);
    return feasts.length ? `${sunday}: ${firstPart(feasts[0])}` : sunday;
  }
  return firstPart(feasts[0] ?? day.summary_title);
}

/** Text for the filename slug: the feast, falling back to the day's title. */
export function daySlugSource(day) {
  if (day.feast_level >= 6) return firstPart(day.summary_title);
  const feast = list(day.feasts)[0];
  if (feast) return feast;
  return day.weekday === 0 ? (list(day.titles)[0] ?? firstPart(day.summary_title)) : firstPart(day.summary_title);
}

/** Compact, agent- and editor-friendly description of a calendar day. */
export function describeDay(day, source = 'gregorian') {
  return {
    date: day.date,
    weekday: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day.weekday],
    title: dayTitle(day),
    titles: list(day.titles),
    feast_level: day.feast_level,
    feast_rank: FEAST_RANKS[day.feast_level] ?? day.feast_level_description,
    feasts: list(day.feasts),
    saints: list(day.saints).slice(0, 6),
    tone: day.tone,
    fast: day.fast_exception_desc ? `${day.fast_level_desc} (${day.fast_exception_desc})` : day.fast_level_desc,
    readings: list(day.readings)
      .filter((r) => ['Epistle', 'Gospel'].includes(r.source))
      .map((r) => `${r.source}: ${r.display}`),
    orthocal_url: `https://orthocal.info/readings/${source}/${day.date.replaceAll('-', '/')}/`,
  };
}

export function dateRange(today, lookaheadDays) {
  return { start: addDays(today, 1), end: addDays(today, lookaheadDays) };
}
