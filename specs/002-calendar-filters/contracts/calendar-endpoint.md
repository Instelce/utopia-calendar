# Contract: adresse paramétrable et données publiées

## `GET https://utopia-calendar.vercel.app/`

Réécrite vers la fonction `api/calendar` (l'adresse `/api/calendar` répond aussi, avec le même contenu). Paramètres : voir [filter-syntax.md](./filter-syntax.md).

| Cas | Statut | En-têtes | Corps |
|-----|--------|----------|-------|
| filtre valide | `200` | `Content-Type: text/calendar; charset=utf-8`<br>`Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400, stale-if-error=604800` | iCalendar, même format que [001/calendar-feed.md](../../001-utopia-calendar-feed/contracts/calendar-feed.md). `X-WR-CALNAME` vaut `Utopia <nom>` si un seul cinéma, `Utopia Avignon` sinon. 0..n `VEVENT` dont `UID`, `DTSTART`, `DTEND`, `SUMMARY`, `LOCATION`, `DESCRIPTION` et `URL` sont identiques à ceux des flux par cinéma |
| filtre invalide | `400` | `Content-Type: text/plain; charset=utf-8`<br>`Cache-Control: no-store` | message en français, voir le tableau des erreurs |
| `sessions.json` illisible | `502` | `Content-Type: text/plain; charset=utf-8`<br>`Cache-Control: no-store` | `Données des séances indisponibles, réessayez plus tard.` Le CDN continue de servir la dernière réponse 200 tant qu'elle est couverte par `stale-if-error` |
| méthode autre que GET/HEAD | `405` | `Allow: GET, HEAD` | — |

Garanties :
- **Déterminisme** : même adresse et même `sessions.json` donnent une réponse identique, octet pour octet.
- **Mêmes événements** : un événement filtré est identique à son équivalent dans `manutention.ics` ou `republique.ics`. Passer d'un flux à l'autre ne crée donc jamais de doublon.

## `GET https://instelce.github.io/utopia-calendar/sessions.json`

Publié par le workflow de la feature 001, à côté des `.ics`. C'est une interface interne entre GitHub Actions et Vercel ; elle n'est pas destinée aux abonnés.

- Corps : un tableau JSON de `Session` (champs : [001/data-model.md](../../001-utopia-calendar-feed/data-model.md)), limité aux cinémas de `VENUES`, trié par `date`, `time`, `title`.
- Garantie : il n'est jamais remplacé par un tableau vide à la suite d'une panne du site Utopia, car il obéit à la même règle que les `.ics` (FR-010 de 001).

## Adresses inchangées (FR-011)

`https://instelce.github.io/utopia-calendar/manutention.ics` et `…/republique.ics` gardent un contenu identique, octet pour octet, à celui produit avant cette feature.
