import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calendarName, FilterError, matches, parseFilter } from "../src/filter.ts";
import { parseSessions } from "../src/scrape.ts";

const sessions = parseSessions(readFileSync(new URL("./fixtures/horaires-2026-10-23.html", import.meta.url), "utf8"));
const keep = (q: string) => {
  const filter = parseFilter(new URLSearchParams(q));
  return sessions.filter((s) => matches(filter, s));
};
const has = (list: typeof sessions, title: string, date: string, time: string) =>
  list.some((s) => s.title === title && s.date === date && s.time === time);
const EXAMPLE = "cinema=manutention&regle=jours:lun-ven;heure:17h-&regle=jours:sam,dim";

// US1 — semantics, counts from the frozen page of 2026-10-23 (see tasks.md).
test("reference counts", () => {
  assert.equal(keep(EXAMPLE).length, 68);
  assert.equal(keep("regle=jours:lun-ven;heure:17h-&regle=jours:sam,dim").length, 79);
  assert.equal(keep("regle=jours:sam,dim").length, 51);
  assert.equal(keep("cinema=republique&regle=jours:dim;heure:14h-").length, 3);
  assert.equal(keep("regle=heure:-12h").length, 24);
  assert.equal(keep("").length, 124);
});

test("time bounds: start included, end excluded", () => {
  const example = keep(EXAMPLE);
  assert.ok(has(example, "La Gradiva", "2026-10-26", "17:00"));
  assert.ok(!has(example, "Le Corset", "2026-10-23", "10:30"));
  assert.ok(!has(keep("regle=heure:-12h"), "Le chant des oliviers", "2026-10-23", "12:00"));
});

test("day is the site's date, even after midnight", () => {
  assert.ok(has(keep("regle=jours:dim"), "Flush", "2026-10-25", "01:20"));
  assert.ok(!has(keep("regle=jours:sam"), "Flush", "2026-10-25", "01:20"));
});

test("day lists and ranges", () => {
  const days = (v: string) => [...(parseFilter(new URLSearchParams(`regle=jours:${v}`)).rules[0].days ?? [])].sort();
  assert.deepEqual(days("ven-lun"), [0, 1, 5, 6]);
  assert.deepEqual(days("lun,mer-ven"), [1, 3, 4, 5]);
  assert.deepEqual(days("dim-sam"), [0, 1, 2, 3, 4, 5, 6]);
});

test("time ranges in minutes", () => {
  const rule = parseFilter(new URLSearchParams("regle=heure:9h05-17h30")).rules[0];
  assert.equal(rule.startMin, 545);
  assert.equal(rule.endMin, 1050);
});

test("cinema lists", () => {
  const all = keep("").length;
  assert.equal(keep("cinema=manutention,republique").length, all);
  assert.equal(keep("cinema=manutention&cinema=republique").length, all);
  assert.equal(keep("cinema=manutention").length, 109);
});

test("order, case, accents and encoding have no effect", () => {
  const ref = keep(EXAMPLE);
  assert.deepEqual(keep("regle=jours:sam,dim&regle=jours:lun-ven;heure:17h-&cinema=manutention"), ref);
  assert.deepEqual(keep("cinema=manutention&regle=heure:17h-;jours:lun-ven&regle=jours:sam,dim"), ref);
  assert.deepEqual(keep("cinema=Manutention&regle=JOURS:Lun-Ven;Heure:17H-&regle=jours:SAM,dim"), ref);
  assert.deepEqual(keep("cinema=manutention&regle=jours%3Alun-ven%3Bheure%3A17h-&regle=jours%3Asam%2Cdim"), ref);
  assert.equal(keep("cinema=République").length, 15);
});

test("calendar name", () => {
  assert.equal(calendarName(parseFilter(new URLSearchParams("cinema=manutention"))), "Utopia Manutention");
  assert.equal(calendarName(parseFilter(new URLSearchParams("cinema=republique"))), "Utopia République");
  assert.equal(calendarName(parseFilter(new URLSearchParams(""))), "Utopia Avignon");
});

// US2 — exact error messages from contracts/filter-syntax.md.
const ERRORS: [string, string][] = [
  ["cinemas=manutention", "Paramètre inconnu « cinemas ». Paramètres acceptés : cinema, regle."],
  ["cinema=utopia", "Cinéma inconnu « utopia ». Cinémas acceptés : manutention, republique."],
  ["regle=", "Règle vide. Exemple : regle=jours:lun-ven;heure:17h-"],
  ["regle=lun-ven", "Condition « lun-ven » invalide : attendu clé:valeur (ex. jours:lun-ven)."],
  ["regle=vost:oui", "Clé inconnue « vost ». Clés acceptées : jours, heure."],
  ["regle=jours:lun;jours:mar", "Clé « jours » répétée dans la règle « jours:lun;jours:mar »."],
  ["regle=jours:lun-vdr", "Jour inconnu « vdr » dans « lun-vdr ». Jours acceptés : lun mar mer jeu ven sam dim."],
  ["regle=heure:25h-", "Heure invalide « 25h ». Format : 17h, 17h30 (0h à 23h59)."],
  ["regle=heure:-", "Plage horaire vide « - ». Exemples : 17h-, -12h, 14h-18h30."],
  ["regle=heure:20h-18h", "Plage horaire « 20h-18h » vide : le début doit précéder la fin."],
];

for (const [q, message] of ERRORS) {
  test(`error: ${q}`, () => {
    assert.throws(() => parseFilter(new URLSearchParams(q)), (e) => e instanceof FilterError && e.message === message);
  });
}

test("error: invalid minutes", () => {
  assert.throws(() => parseFilter(new URLSearchParams("regle=heure:17h60-")), FilterError);
});
