import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseSessions } from "../src/scrape.ts";

const html = readFileSync(new URL("./fixtures/horaires-2026-10-23.html", import.meta.url), "utf8");
const sessions = parseSessions(html);
const find = (title: string, date?: string, time?: string) =>
  sessions.find((s) => s.title === title && (!date || s.date === date) && (!time || s.time === time));

test("counts sessions per venue", () => {
  assert.equal(sessions.length, 124);
  assert.equal(sessions.filter((s) => s.venue === "Manutention").length, 109);
  assert.equal(sessions.filter((s) => s.venue === "République").length, 15);
});

test("extracts core fields", () => {
  const s = find("Le Corset", "2026-10-23", "10:30");
  assert.ok(s);
  assert.equal(s.filmId, "local_5075");
  assert.equal(s.durationMin, 90);
  assert.equal(s.url, "https://avignon.cinemas-utopia.org/film?id=local_5075");
  assert.equal(s.vost, false);
  assert.equal(s.country, "France");
  assert.equal(s.year, "2026");
});

test("uses the full title, not the truncated one", () => {
  assert.ok(find("Muyi, la légende du village des femmes"));
  assert.ok(sessions.every((s) => !s.title.endsWith("…")));
});

test("missing duration is null", () => {
  assert.equal(find("Flush", "2026-10-25", "01:20")?.durationMin, null);
});

test("VOST and labels", () => {
  const s = find("High Hopes");
  assert.ok(s);
  assert.equal(s.vost, true);
  assert.equal(s.country, "Royaume-Uni");
  assert.ok(s.labels.includes("Mike Leigh en 3 films"));
});

test("empty page gives no sessions", () => {
  assert.deepEqual(parseSessions("<html></html>"), []);
});
