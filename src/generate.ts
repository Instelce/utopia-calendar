import { mkdirSync, writeFileSync } from "node:fs";
import { toIcs } from "./ics.ts";
import { parseSessions } from "./scrape.ts";
import { VENUES } from "./venues.ts";

const SOURCE = "https://avignon.cinemas-utopia.org/horaires/";
const OUT_DIR = "public";

function fail(message: string): never {
  console.error(`::error::${message}`);
  process.exit(1);
}

let html: string;
try {
  const res = await fetch(SOURCE, {
    headers: { "User-Agent": "utopia-calendar (+https://github.com/Instelce/utopia-calendar)" },
  });
  if (!res.ok) fail(`${SOURCE} a répondu ${res.status} ${res.statusText}`);
  html = await res.text();
} catch (err) {
  fail(`impossible de joindre ${SOURCE} : ${(err as Error).message}`);
}

const sessions = parseSessions(html);
// Nothing is written on failure, so the last good deployment stays online (FR-010).
if (sessions.length === 0) fail("aucune séance reconnue, structure de la page modifiée ?");

const known = new Set(VENUES.map((v) => v.name));
for (const s of sessions.filter((s) => !known.has(s.venue))) {
  console.error(`::warning::cinéma inconnu « ${s.venue} » : ${s.date} ${s.time} ${s.title}`);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const venue of VENUES) {
  const own = sessions.filter((s) => s.venue === venue.name);
  writeFileSync(`${OUT_DIR}/${venue.slug}.ics`, toIcs(venue, own));
  console.log(`${venue.slug}: ${own.length} séances`);
}
