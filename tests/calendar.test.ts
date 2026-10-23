import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import handler from "../api/calendar.ts";
import { byStart } from "../src/ics.ts";
import { parseSessions } from "../src/scrape.ts";

const sessions = parseSessions(readFileSync(new URL("./fixtures/horaires-2026-10-23.html", import.meta.url), "utf8")).sort(byStart);
const reference = readFileSync(new URL("./fixtures/manutention-2026-10-23.ics", import.meta.url), "utf8");
const events = (ics: string): string[] => ics.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT\r\n/g) ?? [];

const realFetch = globalThis.fetch;
let fetched: string[] = [];
let upstream: () => Response = () => Response.json(sessions);
beforeEach(() => {
  fetched = [];
  upstream = () => Response.json(sessions);
  globalThis.fetch = (async (input: string | URL | Request) => {
    fetched.push(String(input));
    return upstream();
  }) as typeof fetch;
});
after(() => {
  globalThis.fetch = realFetch;
});

const get = (q: string, init?: RequestInit) => handler.fetch(new Request(`https://utopia-calendar.vercel.app/${q}`, init));

// US1
test("user example: 200, calendar headers, 68 events", async () => {
  const res = await get("?cinema=manutention&regle=jours:lun-ven;heure:17h-&regle=jours:sam,dim");
  assert.equal(res.status, 200);
  assert.ok(res.headers.get("content-type")?.startsWith("text/calendar"));
  assert.equal(res.headers.get("cache-control"), "public, s-maxage=3600, stale-while-revalidate=86400, stale-if-error=604800");
  const body = await res.text();
  assert.equal(events(body).length, 68);
  assert.ok(body.includes("X-WR-CALNAME:Utopia Manutention\r\n"));
  assert.deepEqual(fetched, ["https://instelce.github.io/utopia-calendar/sessions.json"]);
});

test("no parameter: every session, Utopia Avignon", async () => {
  const body = await (await get("")).text();
  assert.equal(events(body).length, 124);
  assert.ok(body.includes("X-WR-CALNAME:Utopia Avignon\r\n"));
});

// US2
test("invalid filter: 400 before reading data", async () => {
  const res = await get("?regle=jours:lun-vdr");
  assert.equal(res.status, 400);
  assert.equal(res.headers.get("content-type"), "text/plain; charset=utf-8");
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.ok((await res.text()).includes("vdr"));
  assert.deepEqual(fetched, []);
});

test("data unavailable: 502", async () => {
  upstream = () => new Response("oops", { status: 500 });
  const res = await get("?cinema=manutention");
  assert.equal(res.status, 502);
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.equal(await res.text(), "Données des séances indisponibles, réessayez plus tard.");
});

test("method not allowed: 405", async () => {
  const res = await get("", { method: "POST" });
  assert.equal(res.status, 405);
  assert.equal(res.headers.get("allow"), "GET, HEAD");
});

// US3 — filtered events are identical to the per-venue feed (FR-009).
test("filtered events are identical to the reference feed", async () => {
  const ref = events(reference);
  const weekend = events(await (await get("?cinema=manutention&regle=jours:sam,dim")).text());
  assert.equal(weekend.length, 45);
  assert.ok(weekend.every((e) => ref.includes(e)));
  assert.deepEqual(events(await (await get("?cinema=manutention")).text()), ref);
});
