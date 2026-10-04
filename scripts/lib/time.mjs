// Timezone helpers built on Intl so we avoid a date library dependency.

const DAY_MS = 86_400_000;

function zonedParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

/** Offset of `timeZone` from UTC at `date`, in minutes (e.g. -300 for CDT). */
export function offsetMinutes(date, timeZone) {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60_000);
}

/** Interpret a wall-clock time in `timeZone` and return the UTC instant. */
export function zonedToUtc({ year, month, day, hour = 0, minute = 0, second = 0 }, timeZone) {
  const guess = Date.UTC(year, month - 1, day, hour, minute, second);
  let result = guess - offsetMinutes(new Date(guess), timeZone) * 60_000;
  // Re-check once in case the guess crossed a DST boundary.
  const corrected = guess - offsetMinutes(new Date(result), timeZone) * 60_000;
  if (corrected !== result) result = corrected;
  return new Date(result);
}

/**
 * Parse a post's publish_at value. Values with an explicit offset ("Z" or
 * "-05:00") are absolute; values without one are wall-clock time in the
 * parish timezone. Returns null when the value is not a usable date-time.
 */
export function parsePublishAt(value, timeZone) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== 'string') return null;
  const text = value.trim();
  const m = text.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?\s*(Z|[+-]\d{2}:?\d{2})?$/i,
  );
  if (!m) return null;
  const [, y, mo, d, h, mi, s, tz] = m;
  if (h === undefined) return null;
  if (tz) {
    const date = new Date(text.replace(' ', 'T'));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return zonedToUtc(
    { year: +y, month: +mo, day: +d, hour: +h, minute: +mi, second: +(s ?? 0) },
    timeZone,
  );
}

/** "YYYY-MM-DD" of `date` as seen in `timeZone`. */
export function localDate(date, timeZone) {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

function formatOffset(minutes) {
  const sign = minutes < 0 ? '-' : '+';
  const abs = Math.abs(minutes);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

/** Build "YYYY-MM-DDTHH:mm:00-05:00" for a local date + "HH:mm" in `timeZone`. */
export function zonedIso(dateStr, timeStr, timeZone) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);
  const instant = zonedToUtc({ year, month, day, hour, minute }, timeZone);
  return `${dateStr}T${timeStr}:00${formatOffset(offsetMinutes(instant, timeZone))}`;
}

/** Add whole days to a "YYYY-MM-DD" string. */
export function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Convert an astronomical Julian Day Number to a civil (Gregorian) "YYYY-MM-DD". */
export function jdnToIsoDate(jdn) {
  return new Date((jdn - 2_440_588) * DAY_MS).toISOString().slice(0, 10);
}

export { DAY_MS };
