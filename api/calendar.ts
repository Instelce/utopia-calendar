import { calendarName, FilterError, matches, parseFilter } from "../src/filter.ts";
import { toIcs } from "../src/ics.ts";
import type { Session } from "../src/scrape.ts";

/** Published every two days by the GitHub Actions workflow (src/generate.ts). */
const SESSIONS_URL = "https://instelce.github.io/utopia-calendar/sessions.json";

const text = (status: number, body: string) =>
  new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

async function loadSessions(): Promise<Session[] | null> {
  try {
    const res = await fetch(SESSIONS_URL);
    return res.ok ? ((await res.json()) as Session[]) : null;
  } catch {
    return null;
  }
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
    }
    let filter;
    try {
      filter = parseFilter(new URL(request.url).searchParams);
    } catch (err) {
      if (err instanceof FilterError) return text(400, err.message);
      throw err;
    }
    const sessions = await loadSessions();
    if (!sessions) return text(502, "Données des séances indisponibles, réessayez plus tard.");
    return new Response(toIcs(calendarName(filter), sessions.filter((s) => matches(filter, s))), {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        // One upstream read per URL per hour; stale copies cover a GitHub Pages outage.
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400, stale-if-error=604800",
      },
    });
  },
};
