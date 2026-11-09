import { mkdirSync, writeFileSync } from "node:fs";
import { byStart, toIcs } from "./ics.ts";
import { fetchWeek, HEADERS, parseSessions, parseWeeksConfig, uniqueSessions } from "./scrape.ts";
import { VENUES } from "./venues.ts";

const SOURCE = "https://avignon.cinemas-utopia.org/horaires/";
const OUT_DIR = "public";

function fail(message: string): never {
  console.error(`::error::${message}`);
  process.exit(1);
}

async function get(url: string): Promise<Response> {
  try {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) fail(`${url} a répondu ${res.status} ${res.statusText}`);
    return res;
  } catch (err) {
    fail(`impossible de joindre ${url} : ${(err as Error).message}`);
  }
}

const html = await (await get(SOURCE)).text();
const sessions = parseSessions(html);
// Nothing is written on failure, so the last good deployment stays online (FR-010).
if (sessions.length === 0) fail("aucune séance reconnue, structure de la page modifiée ?");

const weeks = parseWeeksConfig(html);
if (!weeks) console.error("::warning::configuration des semaines introuvable, seule la semaine affichée est publiée");
for (let index = 1; index < (weeks?.totalWeeks ?? 0); index++) {
  try {
    const own = await fetchWeek(weeks!, index);
    console.log(`semaine ${index}: ${own.length} séances`);
    sessions.push(...own);
  } catch (err) {
    fail(`semaine ${index} : ${(err as Error).message}`);
  }
}

const unique = uniqueSessions(sessions);

const known = new Set(VENUES.map((v) => v.name));
for (const s of unique.filter((s) => !known.has(s.venue))) {
  console.error(`::warning::cinéma inconnu « ${s.venue} » : ${s.date} ${s.time} ${s.title}`);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const venue of VENUES) {
  const own = unique.filter((s) => s.venue === venue.name);
  writeFileSync(`${OUT_DIR}/${venue.slug}.ics`, toIcs(`Utopia ${venue.name}`, own));
  console.log(`${venue.slug}: ${own.length} séances`);
}

// Read by the Vercel function (api/calendar.ts) to serve filtered calendars.
const published = unique.filter((s) => known.has(s.venue)).sort(byStart);
writeFileSync(`${OUT_DIR}/sessions.json`, JSON.stringify(published));
console.log(`sessions.json: ${published.length} séances`);
