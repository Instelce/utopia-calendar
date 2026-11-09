import * as cheerio from "cheerio";

export type Session = {
  date: string;
  time: string;
  venue: string;
  title: string;
  filmId: string;
  url: string;
  durationMin: number | null;
  year: string | null;
  country: string | null;
  vost: boolean;
  labels: string[];
};

const BASE = "https://avignon.cinemas-utopia.org";
export const HEADERS = { "User-Agent": "utopia-calendar (+https://github.com/Instelce/utopia-calendar)" };

export type WeeksConfig = { ajaxurl: string; nonce: string; cinemaSlug: string; totalWeeks: number };

/** The page holds week 0 only; the site's gestion-horaires.js loads the others over AJAX with this config. */
export function parseWeeksConfig(html: string): WeeksConfig | null {
  const raw = cheerio.load(html)("#utopia-horaires-data").attr("data-utopia-horaires");
  return raw ? JSON.parse(raw) : null;
}

/** Sessions of the schedule page; selectors documented in specs/001-utopia-calendar-feed/research.md (R1). */
export function parseSessions(html: string): Session[] {
  const $ = cheerio.load(html);
  const sessions: Session[] = [];
  $("div.horaire_complet_container").each((_, el) => {
    const card = $(el);
    const right = card.find(".horaire_complet_inner_right");
    const link = right.find(".titre_horaire a").first();
    const bold = link.find("b").first();
    const pays = right.find(".pays_film").first();

    const date = /horaire_(\d{4}-\d{2}-\d{2})_date/.exec(card.attr("class") ?? "")?.[1] ?? "";
    const time = right.children("div").first().text().trim();
    const title = (bold.attr("title") || bold.text()).trim();
    const filmId = new URL(link.attr("href") ?? "", BASE).searchParams.get("id") ?? "";
    if (!date || !/^\d{2}:\d{2}$/.test(time) || !title || !filmId) {
      console.error(`::warning::séance ignorée (champ manquant) : ${date} ${time} ${title || "?"}`);
      return;
    }

    const duration = /(\d+)\s*mn/.exec(right.find("span.horaire_complet_vo").text())?.[1];
    const year = right.find("span.annefilm").text().trim();
    const country = pays.clone().children("span").remove().end().text().replace(/ /g, " ").trim();
    sessions.push({
      date,
      time,
      venue: right.find("h3.horaire_nom_cinema").text().trim(),
      title,
      filmId,
      url: `${BASE}/film?id=${filmId}`,
      durationMin: duration ? Number(duration) : null,
      year: year || null,
      country: country || null,
      vost: pays.text().includes("VOST"),
      labels: right.find("i.cycle_title").map((_, i) => $(i).text().trim()).get().filter(Boolean),
    });
  });
  return sessions;
}

/** Same request as the site's "Semaine suivante" button; throws when the site refuses it (e.g. expired nonce answers -1). */
export async function fetchWeek(weeks: WeeksConfig, index: number): Promise<Session[]> {
  const res = await fetch(weeks.ajaxurl, {
    method: "POST",
    headers: HEADERS,
    body: new URLSearchParams({
      action: "utopia_load_horaires_week",
      nonce: weeks.nonce,
      cinema_slug: weeks.cinemaSlug,
      week_index: String(index),
    }),
  });
  if (!res.ok) throw new Error(`${weeks.ajaxurl} a répondu ${res.status} ${res.statusText}`);
  const result = (await res.json().catch(() => null)) as { success?: boolean; data?: { html?: string } } | null;
  if (!result?.success || typeof result.data?.html !== "string") throw new Error(`réponse invalide de ${weeks.ajaxurl}`);
  return parseSessions(result.data.html);
}

/** The site can repeat cards (seen: week 202648 listed twice); same key = same .ics UID, keep one. */
export const uniqueSessions = (sessions: Session[]): Session[] => [
  ...new Map(sessions.map((s) => [`${s.date} ${s.time} ${s.filmId} ${s.venue}`, s])).values(),
];
