# Data Model: Filtres de séances

`Session` et `Venue` ne changent pas (voir [feature 001](../001-utopia-calendar-feed/data-model.md)). Rien n'est stocké côté Vercel : chaque demande est calculée à partir de `sessions.json`.

## Filter

Le résultat de l'analyse des paramètres d'une adresse.

| Champ | Type | Règle |
|-------|------|-------|
| `venues` | `Venue[]` | issu de `cinema` ; absent → tous les `VENUES` ; slug inconnu → erreur |
| `rules` | `Rule[]` | un élément par paramètre `regle` ; vide → toute séance passe |

Une séance passe le filtre si son cinéma est dans `venues` **et** si `rules` est vide **ou** qu'au moins une règle la retient.

## Rule

| Champ | Type | Règle |
|-------|------|-------|
| `days` | `Set<0..6>` \| absent | issu de `jours` ; 0 = dimanche (convention `getUTCDay`) |
| `startMin` | `number` (0–1439) \| absent | borne basse incluse de `heure`, en minutes depuis minuit |
| `endMin` | `number` (1–1439) \| absent | borne haute exclue de `heure` |

Une règle retient une séance si chaque condition présente est vraie.

Validation (FR-007) :
- une règle vide (`regle=`) est une erreur ;
- chaque clé ne peut apparaître qu'une fois dans une règle ;
- dans `heure`, au moins une des deux bornes est présente, et si les deux le sont, `startMin < endMin`.

## Condition (clés de la version 1)

| Clé | Analyseur | Produit |
|-----|-----------|---------|
| `jours` | liste `,` d'éléments `jour` ou `jour-jour` (plage qui peut faire le tour de la semaine) | `days` |
| `heure` | `[H] "-" [H]` avec `H = \d{1,2}h(\d{2})?`, heures 0–23 et minutes 0–59 | `startMin`, `endMin` |

Grammaire complète : [contracts/filter-syntax.md](./contracts/filter-syntax.md).

## Nom du calendrier

| `venues` | `X-WR-CALNAME` |
|----------|----------------|
| un cinéma | `Utopia <name>` |
| plusieurs | `Utopia Avignon` |

## sessions.json

Un tableau de `Session`, avec les seules séances des cinémas présents dans `VENUES`, trié par `date`, `time`, `title`. Il est produit par `npm run generate` à côté des `.ics` et publié sur Pages.

## Cycle d'une demande

```text
GET /?cinema=…&regle=…
  │
parseFilter(searchParams) ──FilterError──▶ 400 text/plain (message FR), no-store
  │ ok
fetch sessions.json ──échec──▶ 502 text/plain (le CDN sert l'ancienne réponse si stale-if-error)
  │ ok
sessions.filter(matches) → toIcs(calendarName, …)
  │
200 text/calendar, s-maxage=3600
```
