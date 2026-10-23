import type { Session } from "./scrape.ts";
import { VENUES, type Venue } from "./venues.ts";

/** Grammar and messages: specs/002-calendar-filters/contracts/filter-syntax.md */
export class FilterError extends Error {}

export type Rule = { days?: Set<number>; startMin?: number; endMin?: number };
export type Filter = { venues: Venue[]; rules: Rule[] };

/** Indexed like Date.getUTCDay(): 0 = dimanche. */
const DAYS = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"];
const DAYS_LABEL = "lun mar mer jeu ven sam dim";
const SLUG_LABEL = VENUES.map((v) => v.slug).join(", ");

const normalize = (v: string) => v.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

function day(name: string, item: string): number {
  const i = DAYS.indexOf(name);
  if (i < 0) throw new FilterError(`Jour inconnu « ${name} » dans « ${item} ». Jours acceptés : ${DAYS_LABEL}.`);
  return i;
}

function minutes(h: string): number {
  const m = /^(\d{1,2})h(\d{2})?$/.exec(h);
  const hours = Number(m?.[1]);
  const mins = Number(m?.[2] ?? 0);
  if (!m || hours > 23 || mins > 59) throw new FilterError(`Heure invalide « ${h} ». Format : 17h, 17h30 (0h à 23h59).`);
  return hours * 60 + mins;
}

/** One entry per condition key; adding a key = adding an entry. */
const CONDITIONS: Record<string, (value: string, rule: Rule) => void> = {
  jours(value, rule) {
    rule.days = new Set();
    for (const item of value.split(",")) {
      const [from, to = from] = item.split("-");
      const start = day(from, item);
      const end = day(to, item);
      for (let i = start; ; i = (i + 1) % 7) {
        rule.days.add(i);
        if (i === end) break;
      }
    }
  },
  heure(value, rule) {
    const parts = value.split("-");
    if (parts.length !== 2) throw new FilterError(`Plage horaire invalide « ${value} ». Exemples : 17h-, -12h, 14h-18h30.`);
    const [from, to] = parts;
    if (!from && !to) throw new FilterError(`Plage horaire vide « ${value} ». Exemples : 17h-, -12h, 14h-18h30.`);
    if (from) rule.startMin = minutes(from);
    if (to) rule.endMin = minutes(to);
    if (rule.startMin !== undefined && rule.endMin !== undefined && rule.startMin >= rule.endMin)
      throw new FilterError(`Plage horaire « ${value} » vide : le début doit précéder la fin.`);
  },
};
const KEYS_LABEL = Object.keys(CONDITIONS).join(", ");

function parseRule(text: string): Rule {
  const rule: Rule = {};
  const seen = new Set<string>();
  const conditions = text.split(";").filter(Boolean);
  if (conditions.length === 0) throw new FilterError("Règle vide. Exemple : regle=jours:lun-ven;heure:17h-");
  for (const condition of conditions) {
    const sep = condition.indexOf(":");
    if (sep < 0) throw new FilterError(`Condition « ${condition} » invalide : attendu clé:valeur (ex. jours:lun-ven).`);
    const key = condition.slice(0, sep);
    if (!Object.hasOwn(CONDITIONS, key)) throw new FilterError(`Clé inconnue « ${key} ». Clés acceptées : ${KEYS_LABEL}.`);
    if (seen.has(key)) throw new FilterError(`Clé « ${key} » répétée dans la règle « ${text} ».`);
    seen.add(key);
    CONDITIONS[key](condition.slice(sep + 1), rule);
  }
  return rule;
}

export function parseFilter(params: URLSearchParams): Filter {
  const slugs: string[] = [];
  const rules: Rule[] = [];
  for (const [rawKey, rawValue] of params) {
    const key = normalize(rawKey);
    const value = normalize(rawValue);
    if (key === "cinema") slugs.push(...value.split(","));
    else if (key === "regle") rules.push(parseRule(value));
    else throw new FilterError(`Paramètre inconnu « ${rawKey} ». Paramètres acceptés : cinema, regle.`);
  }
  const venues = slugs.length === 0 ? VENUES : [];
  for (const slug of slugs) {
    const venue = VENUES.find((v) => v.slug === slug.trim());
    if (!venue) throw new FilterError(`Cinéma inconnu « ${slug} ». Cinémas acceptés : ${SLUG_LABEL}.`);
    if (!venues.includes(venue)) venues.push(venue);
  }
  return { venues, rules };
}

export function matches(filter: Filter, s: Session): boolean {
  if (!filter.venues.some((v) => v.name === s.venue)) return false;
  if (filter.rules.length === 0) return true;
  const weekday = new Date(`${s.date}T00:00:00Z`).getUTCDay();
  const [h, m] = s.time.split(":").map(Number);
  const t = h * 60 + m;
  return filter.rules.some(
    (r) =>
      (!r.days || r.days.has(weekday)) &&
      (r.startMin === undefined || t >= r.startMin) &&
      (r.endMin === undefined || t < r.endMin),
  );
}

export function calendarName(filter: Filter): string {
  return filter.venues.length === 1 ? `Utopia ${filter.venues[0].name}` : "Utopia Avignon";
}
