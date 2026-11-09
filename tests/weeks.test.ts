import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fetchWeek, parseSessions, parseWeeksConfig, uniqueSessions, type WeeksConfig } from "../src/scrape.ts";

const html = readFileSync(new URL("./fixtures/horaires-2026-10-23.html", import.meta.url), "utf8");
const sessions = parseSessions(html);
const weeks = parseWeeksConfig(html) as WeeksConfig;

const realFetch = globalThis.fetch;
let requests: Request[] = [];
let upstream: () => Response = () => Response.json({ success: true, data: { html } });
beforeEach(() => {
  requests = [];
  upstream = () => Response.json({ success: true, data: { html } });
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    requests.push(new Request(input, init));
    return upstream();
  }) as typeof fetch;
});
after(() => {
  globalThis.fetch = realFetch;
});

test("reads the AJAX config from the page", () => {
  assert.equal(weeks.ajaxurl, "https://avignon.cinemas-utopia.org/wp-admin/admin-ajax.php");
  assert.equal(weeks.nonce, "13e7151634");
  assert.equal(weeks.cinemaSlug, "horaire_avignon");
  assert.equal(weeks.totalWeeks, 4);
});

test("page without config gives null", () => {
  assert.equal(parseWeeksConfig("<html></html>"), null);
});

test("sends the same request as the site's next-week button", async () => {
  await fetchWeek(weeks, 2);
  assert.equal(requests.length, 1);
  const req = requests[0];
  assert.equal(req.url, weeks.ajaxurl);
  assert.equal(req.method, "POST");
  assert.match(req.headers.get("user-agent") ?? "", /^utopia-calendar/);
  assert.match(req.headers.get("content-type") ?? "", /^application\/x-www-form-urlencoded/);
  assert.deepEqual(Object.fromEntries(new URLSearchParams(await req.text())), {
    action: "utopia_load_horaires_week",
    nonce: "13e7151634",
    cinema_slug: "horaire_avignon",
    week_index: "2",
  });
});

test("parses the sessions of the returned HTML", async () => {
  assert.deepEqual(await fetchWeek(weeks, 1), sessions);
});

test("week without sessions is empty, not an error", async () => {
  upstream = () => Response.json({ success: true, data: { html: "" } });
  assert.deepEqual(await fetchWeek(weeks, 1), []);
});

test("expired nonce (-1) throws", async () => {
  upstream = () => new Response("-1");
  await assert.rejects(fetchWeek(weeks, 1), /réponse invalide/);
});

test("success: false throws", async () => {
  upstream = () => Response.json({ success: false, data: "bad week" });
  await assert.rejects(fetchWeek(weeks, 1), /réponse invalide/);
});

test("HTTP error throws", async () => {
  upstream = () => new Response("", { status: 503, statusText: "Service Unavailable" });
  await assert.rejects(fetchWeek(weeks, 1), /a répondu 503 Service Unavailable/);
});

test("network error propagates", async () => {
  globalThis.fetch = (async () => {
    throw new TypeError("fetch failed");
  }) as typeof fetch;
  await assert.rejects(fetchWeek(weeks, 1), /fetch failed/);
});

test("cards listed twice by the site are kept once", async () => {
  upstream = () => Response.json({ success: true, data: { html: html + html } });
  const week = await fetchWeek(weeks, 1);
  assert.equal(week.length, 2 * sessions.length);
  assert.deepEqual(uniqueSessions(week), sessions);
});

test("sessions differing only by time or venue are all kept", () => {
  const s = sessions[0];
  const other = [s, { ...s, time: "23:59" }, { ...s, venue: "République" }, { ...s }];
  assert.equal(uniqueSessions(other).length, 3);
});
