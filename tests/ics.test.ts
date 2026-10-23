import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { toIcs } from "../src/ics.ts";
import { parseSessions, type Session } from "../src/scrape.ts";
import { VENUES } from "../src/venues.ts";

const [manutention, republique] = VENUES;
const session = (over: Partial<Session> = {}): Session => ({
  date: "2026-10-23",
  time: "10:30",
  venue: "Manutention",
  title: "Le Corset",
  filmId: "local_5075",
  url: "https://avignon.cinemas-utopia.org/film?id=local_5075",
  durationMin: 90,
  year: "2026",
  country: "France",
  vost: false,
  labels: [],
  ...over,
});
const unfold = (ics: string) => ics.replace(/\r\n /g, "");

test("calendar envelope and headers", () => {
  const ics = toIcs("Utopia Manutention", [session()]);
  assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n"));
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
  for (const line of [
    "X-WR-CALNAME:Utopia Manutention",
    "X-WR-TIMEZONE:Europe/Paris",
    "REFRESH-INTERVAL;VALUE=DURATION:P1D",
    "BEGIN:VTIMEZONE",
    "TZID:Europe/Paris",
    "END:VTIMEZONE",
  ]) assert.ok(ics.includes(`${line}\r\n`), line);
});

test("start, end, uid, dtstamp", () => {
  const ics = toIcs("Utopia Manutention", [session()]);
  assert.ok(ics.includes("DTSTART;TZID=Europe/Paris:20261023T103000\r\n"));
  assert.ok(ics.includes("DTEND;TZID=Europe/Paris:20261023T120000\r\n"));
  assert.ok(ics.includes("UID:2026-10-23T1030-local_5075-manutention@utopia-calendar\r\n"));
  assert.ok(ics.includes("DTSTAMP:20261023T000000Z\r\n"));
});

test("end past midnight rolls to next day", () => {
  const ics = toIcs("Utopia Manutention", [session({ date: "2026-10-24", time: "22:30", durationMin: 156, title: "Hope" })]);
  assert.ok(ics.includes("DTEND;TZID=Europe/Paris:20261025T010600\r\n"));
});

test("missing duration defaults to 120 min", () => {
  const ics = toIcs("Utopia Manutention", [session({ date: "2026-10-25", time: "01:20", durationMin: null, title: "Flush" })]);
  assert.ok(ics.includes("DTEND;TZID=Europe/Paris:20261025T032000\r\n"));
});

test("escapes text values", () => {
  const ics = toIcs("Utopia Manutention", [session()]);
  assert.ok(unfold(ics).includes("LOCATION:Utopia Manutention\\, 4 Rue des Escaliers Sainte-Anne\\, 84000 Avignon\r\n"));
});

test("empty calendar is valid", () => {
  const ics = toIcs("Utopia Manutention", []);
  assert.ok(ics.includes("BEGIN:VTIMEZONE"));
  assert.ok(!ics.includes("BEGIN:VEVENT"));
});

test("lines are folded at 75 octets", () => {
  const long = "Un titre très très long avec des accents éèàù pour forcer le pliage de la ligne en plusieurs morceaux";
  const ics = toIcs("Utopia Manutention", [session({ title: long, labels: [long] })]);
  const lines = ics.split("\r\n");
  assert.ok(lines.every((l) => Buffer.byteLength(l) <= 75));
  assert.ok(lines.some((l) => l.startsWith(" ")));
  assert.ok(!ics.includes("�"));
  assert.ok(unfold(ics).includes(`SUMMARY:${long}\r\n`));
});

test("output is deterministic", () => {
  assert.equal(toIcs("Utopia Manutention", [session()]), toIcs("Utopia Manutention", [session()]));
});

// Integration on the frozen page (US2, US3).
const fixture = parseSessions(readFileSync(new URL("./fixtures/horaires-2026-10-23.html", import.meta.url), "utf8"));
const feed = (v: typeof manutention) => unfold(toIcs(`Utopia ${v.name}`, fixture.filter((s) => s.venue === v.name)));

test("one feed per venue, filtered", () => {
  const m = feed(manutention);
  const r = feed(republique);
  assert.equal(m.match(/BEGIN:VEVENT/g)?.length, 109);
  assert.equal(r.match(/BEGIN:VEVENT/g)?.length, 15);
  assert.ok(!r.includes("Escaliers Sainte-Anne"));
  assert.ok(!m.includes("Figuière"));
  assert.ok(r.includes("X-WR-CALNAME:Utopia République\r\n"));
});

test("description carries labels, VOST and film link", () => {
  const events = feed(manutention).split("BEGIN:VEVENT");
  const muyi = events.find((e) => e.includes("SUMMARY:Muyi\\, la légende du village des femmes"));
  assert.ok(muyi?.includes("Avant-première + réalisateur"));
  const hopes = events.find((e) => e.includes("SUMMARY:High Hopes"));
  assert.ok(hopes?.includes("VOST"));
  assert.ok(hopes?.includes("Mike Leigh en 3 films"));
  assert.ok(hopes?.includes("URL:https://avignon.cinemas-utopia.org/film?id=8621\r\n"));
});

test("per-venue feeds are byte-identical to the reference (FR-011)", () => {
  for (const v of VENUES) {
    const expected = readFileSync(new URL(`./fixtures/${v.slug}-2026-10-23.ics`, import.meta.url), "utf8");
    assert.equal(toIcs(`Utopia ${v.name}`, fixture.filter((s) => s.venue === v.name)), expected, v.slug);
  }
});
