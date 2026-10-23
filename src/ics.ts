import type { Session } from "./scrape.ts";
import { VENUES, type Venue } from "./venues.ts";

const DEFAULT_DURATION_MIN = 120;

const VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  "TZID:Europe/Paris",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0200",
  "TZNAME:CEST",
  "DTSTART:19700329T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "TZNAME:CET",
  "DTSTART:19701025T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

const escape = (s: string) => s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, "\\n");

/** RFC 5545 folding: lines of at most 75 octets, never splitting a UTF-8 character. */
function fold(line: string): string {
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  for (const ch of line) {
    const size = Buffer.byteLength(ch);
    const limit = parts.length === 0 ? 75 : 74; // continuation lines start with a space
    if (bytes + size > limit) {
      parts.push(current);
      current = "";
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

/** Wall-clock arithmetic in Europe/Paris: Date.UTC is only used as a calendar calculator, no timezone conversion. */
function localStamp(date: string, time: string, plusMin = 0): string {
  const [y, m, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, h, mi + plusMin)).toISOString().replace(/[-:]/g, "").slice(0, 15);
}

function description(s: Session): string {
  const facts = [s.year, s.durationMin && `${s.durationMin} mn`, s.country, s.vost && "VOST"].filter(Boolean);
  return [facts.join(" · "), ...s.labels, s.url].filter(Boolean).join("\n");
}

export const byStart = (a: Session, b: Session) =>
  a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.title.localeCompare(b.title);

/** Sessions of venues missing from VENUES are skipped. */
export function toIcs(calendarName: string, sessions: Session[]): string {
  const events = [...sessions].sort(byStart).flatMap((s) => {
    const venue = VENUES.find((v) => v.name === s.venue);
    return venue ? eventLines(s, venue) : [];
  });
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//utopia-calendar//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escape(calendarName)}`,
    "X-WR-TIMEZONE:Europe/Paris",
    "REFRESH-INTERVAL;VALUE=DURATION:P1D",
    "X-PUBLISHED-TTL:P1D",
    ...VTIMEZONE,
    ...events,
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

function eventLines(s: Session, venue: Venue): string[] {
  return [
    "BEGIN:VEVENT",
    `UID:${s.date}T${s.time.replace(":", "")}-${s.filmId}-${venue.slug}@utopia-calendar`,
    `DTSTAMP:${s.date.replace(/-/g, "")}T000000Z`,
    `DTSTART;TZID=Europe/Paris:${localStamp(s.date, s.time)}`,
    `DTEND;TZID=Europe/Paris:${localStamp(s.date, s.time, s.durationMin ?? DEFAULT_DURATION_MIN)}`,
    `SUMMARY:${escape(s.title)}`,
    `LOCATION:${escape(`Utopia ${venue.name}, ${venue.address}`)}`,
    `DESCRIPTION:${escape(description(s))}`,
    `URL:${s.url}`,
    "END:VEVENT",
  ];
}
