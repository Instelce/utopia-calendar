# Data Model: Calendriers des séances Utopia Avignon

Pas de stockage persistant : les données vivent le temps d'une exécution (page HTML → séances → fichiers `.ics`). Les types ci-dessous sont des types TypeScript simples.

## Venue (cinéma)

Constante, définie dans le code.

| Champ | Type | Exemple |
|-------|------|---------|
| `name` | string | `Manutention` (identique au texte de `h3.horaire_nom_cinema`) |
| `slug` | string | `manutention` (nom du fichier publié, segment de l'UID) |
| `address` | string | `4 Rue des Escaliers Sainte-Anne, 84000 Avignon` |

Valeurs :

| name | slug | address |
|------|------|---------|
| Manutention | `manutention` | 4 Rue des Escaliers Sainte-Anne, 84000 Avignon |
| République | `republique` | 5 rue Figuière, 84000 Avignon |

## Session (séance)

Produite par le scraper, une par `div.horaire_complet_container`.

| Champ | Type | Source (voir research R1) | Règle |
|-------|------|---------------------------|-------|
| `date` | `YYYY-MM-DD` | classe `horaire_<date>_date` | obligatoire |
| `time` | `HH:MM` | premier `div` de `.horaire_complet_inner_right` | obligatoire, 00:00–23:59 |
| `venue` | string | `h3.horaire_nom_cinema` (texte, trim) | obligatoire ; inconnu → avertissement, séance ignorée |
| `title` | string | `b[title]`, sinon le texte du `b` | obligatoire, non vide |
| `filmId` | string | `id` dans `/film?id=…` | obligatoire (pour l'UID) |
| `url` | string | lien absolu vers la fiche du film, sans `src=` | obligatoire |
| `durationMin` | number \| null | `span.horaire_complet_vo` (« – 90 mn ») | null si absent |
| `year` | string \| null | `span.annefilm` | optionnel |
| `country` | string \| null | `.pays_film`, sans le `VOST` | optionnel |
| `vost` | boolean | présence de `VOST` dans `.pays_film` | — |
| `labels` | string[] | textes de `i.cycle_title` | peut être vide |

Une séance sans `date`, `time`, `title` ou `filmId` est **rejetée**, avec un avertissement.

## Dérivations vers l'événement iCalendar

| Propriété ICS | Valeur |
|---------------|--------|
| `UID` | `<date>T<HHMM>-<filmId>-<slug>@utopia-calendar` |
| `DTSTAMP` | `<date sans tirets>T000000Z` |
| `DTSTART;TZID=Europe/Paris` | `date` + `time` |
| `DTEND;TZID=Europe/Paris` | début + (`durationMin` ?? 120) min, sur l'heure murale (peut passer au lendemain) |
| `SUMMARY` | `title` |
| `LOCATION` | `Utopia <venue.name>, <venue.address>` |
| `DESCRIPTION` | lignes : `year · durationMin mn · country · VOST`, puis `labels`, puis `url` |
| `URL` | `url` |

## Calendar (un par cinéma)

| Champ | Valeur |
|-------|--------|
| fichier | `public/<slug>.ics` |
| `X-WR-CALNAME` | `Utopia <name>` |
| événements | toutes les sessions dont `venue === name`, triées par `date`, `time`, `title` (ordre déterministe) |

## Cycle de vie d'une exécution

```text
fetch page ──fail──▶ exit 1 (rien publié)
   │ ok
parse ──0 séance──▶ exit 1 (rien publié)
   │ ≥1
group by venue (inconnu → warning)
   │
write public/<slug>.ics pour chaque Venue (vide si 0 séance)
   │
deploy (workflow)
```
