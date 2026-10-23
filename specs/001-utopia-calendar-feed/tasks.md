---

description: "Task list for the Utopia Avignon calendar feeds"
---

# Tasks: Calendriers des séances Utopia Avignon

**Input**: Design documents from `/specs/001-utopia-calendar-feed/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/calendar-feed.md](./contracts/calendar-feed.md), [quickstart.md](./quickstart.md)

**Tests**: inclus. Le plan (research R8) prévoit `node --test` sur la page figée `tests/fixtures/horaires-2026-10-23.html`, déjà présente dans le dépôt. Les tests s'écrivent avant le code de chaque story et doivent échouer d'abord.

**Organization**: une phase par user story de la spec. Stack : Node ≥ 22.18, TypeScript exécuté nativement (pas de build), `cheerio`, `node:test`, GitHub Actions + Pages.

## Format: `[ID] [P?] [Story] Description`

- **[P]** : parallélisable (fichier différent, pas de dépendance sur une tâche non terminée).
- **[Story]** : US1, US2 ou US3 (voir spec.md).

## Path Conventions

Projet unique à la racine : `src/`, `tests/`, `.github/workflows/` (voir plan.md, Project Structure).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: initialiser le projet Node/TypeScript.

- [X] T001 Créer `package.json` à la racine avec :
  - `"name": "utopia-calendar"`, `"private": true`, `"type": "module"`, `"engines": { "node": ">=22.18" }` ;
  - les scripts `"generate": "node src/generate.ts"`, `"test": "node --test \"tests/**/*.test.ts\""` (Node 22 refuse un dossier en argument de `--test`) et `"typecheck": "tsc --noEmit"` ;
  - puis lancer `npm install cheerio` et `npm install -D typescript @types/node` pour générer `package-lock.json`.
- [X] T002 [P] Créer `tsconfig.json` avec `"target": "ES2023"`, `"module": "NodeNext"`, `"moduleResolution": "NodeNext"`, `"strict": true`, `"noEmit": true`, `"allowImportingTsExtensions": true`, `"erasableSyntaxOnly": true`, `"verbatimModuleSyntax": true`, `"types": ["node"]`, `"include": ["src", "tests"]`. Les imports locaux portent l'extension `.ts`.
- [X] T003 [P] Ajouter `node_modules/` et `public/` à `.gitignore`.
- [X] T004 Supprimer `main.py`, `pyproject.toml` et `.python-version` (restes de `uv init`, plus utilisés, research R7). **Demander d'abord confirmation à l'utilisateur** ; s'il refuse, sauter la tâche.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: les types et constantes partagés par toutes les stories.

- [X] T005 Créer `src/venues.ts` :
  - exporter `type Venue = { name: string; slug: string; address: string }` ;
  - exporter `VENUES: Venue[]` avec exactement `{ name: "Manutention", slug: "manutention", address: "4 Rue des Escaliers Sainte-Anne, 84000 Avignon" }` et `{ name: "République", slug: "republique", address: "5 rue Figuière, 84000 Avignon" }` (data-model.md, Venue).
- [X] T006 Dans `src/scrape.ts`, exporter `type Session` avec les champs de data-model.md :
  - `date: string` (`YYYY-MM-DD`), `time: string` (`HH:MM`), `venue: string`, `title: string`, `filmId: string`, `url: string` ;
  - `durationMin: number | null`, `year: string | null`, `country: string | null`, `vost: boolean`, `labels: string[]`.

  Pas encore d'implémentation.

**Checkpoint**: `npm run typecheck` passe.

---

## Phase 3: User Story 1 - S'abonner aux séances de Manutention (Priority: P1) 🎯 MVP

**Goal**: un flux `manutention.ics` publié à une URL stable, régénéré tous les deux jours, avec titre, début, fin et lieu pour chaque séance.

**Independent Test**: lancer `npm run generate`, puis importer `public/manutention.ics` dans Apple Calendar ou Google Agenda. Les séances doivent apparaître aux bonnes heures et aucune séance République ne doit y figurer. Après déploiement, l'abonnement `webcal://instelce.github.io/utopia-calendar/manutention.ics` fonctionne.

### Tests for User Story 1 ⚠️

- [X] T007 [P] [US1] Écrire `tests/scrape.test.ts` (`node:test` + `node:assert/strict`). Lire `tests/fixtures/horaires-2026-10-23.html`, appeler `parseSessions(html)` et vérifier :
  - (a) 124 séances au total, dont 109 avec `venue === "Manutention"` et 15 avec `venue === "République"` ;
  - (b) la séance du `2026-10-23` à `10:30` a `title === "Le Corset"`, `filmId === "local_5075"`, `durationMin === 90` et `url === "https://avignon.cinemas-utopia.org/film?id=local_5075"` ;
  - (c) le titre est complet : une séance a `title === "Muyi, la légende du village des femmes"`, et aucun titre ne se termine par « … » ;
  - (d) la séance « Flush » du `2026-10-25` à `01:20` a `durationMin === null` ;
  - (e) la séance « Le Corset » du 2026-10-23 a `vost === false` et `country === "France"` ;
  - (f) une séance « High Hopes » a `vost === true`, `country === "Royaume-Uni"` et `labels` contenant `"Mike Leigh en 3 films"` ;
  - (g) `parseSessions("<html></html>")` renvoie `[]`.
- [X] T008 [P] [US1] Écrire `tests/ics.test.ts`. Construire des `Session` à la main, puis vérifier que `toIcs(venue, sessions)` respecte [contracts/calendar-feed.md](./contracts/calendar-feed.md).

  Structure du calendrier :
  - (a) la sortie commence par `BEGIN:VCALENDAR\r\n` et finit par `END:VCALENDAR\r\n` ;
  - (b) elle contient `X-WR-CALNAME:Utopia Manutention`, `X-WR-TIMEZONE:Europe/Paris`, `REFRESH-INTERVAL;VALUE=DURATION:P1D` et un bloc `BEGIN:VTIMEZONE` … `TZID:Europe/Paris` … `END:VTIMEZONE` ;
  - (h) un calendrier sans séance reste valide : `VCALENDAR` et `VTIMEZONE` présents, aucun `BEGIN:VEVENT`.

  Calcul des heures :
  - (c) 2026-10-23 10:30, 90 mn → `DTSTART;TZID=Europe/Paris:20261023T103000` et `DTEND;TZID=Europe/Paris:20261023T120000` ;
  - (d) 2026-10-24 22:30, 156 mn (« Hope ») → `DTEND;TZID=Europe/Paris:20261025T010600` ;
  - (e) `durationMin: null` à 01:20 le 2026-10-25 → `DTEND;TZID=Europe/Paris:20261025T032000` (fin par défaut à +120 mn) ;
  - (f) `UID:2026-10-23T1030-local_5075-manutention@utopia-calendar` et `DTSTAMP:20261023T000000Z`.

  Format :
  - (g) `LOCATION:Utopia Manutention\, 4 Rue des Escaliers Sainte-Anne\, 84000 Avignon` : les virgules sont échappées ;
  - (i) aucune ligne ne dépasse 75 octets en UTF-8, et une ligne de continuation commence par un espace ;
  - (j) deux appels identiques donnent deux chaînes identiques.

### Implementation for User Story 1

- [X] T009 [US1] Implémenter `parseSessions(html: string): Session[]` dans `src/scrape.ts` avec `cheerio`. Pour chaque `div.horaire_complet_container` :
  - `date` : le groupe 1 de `/horaire_(\d{4}-\d{2}-\d{2})_date/` sur l'attribut `class` ;
  - `time` : le texte du premier `div` enfant de `.horaire_complet_inner_right`, au format `/^\d{2}:\d{2}$/` ;
  - `venue` : le texte de `h3.horaire_nom_cinema`, trim ;
  - `title` : l'attribut `title` de `.titre_horaire b`, sinon son texte ;
  - `filmId` : le paramètre `id` du `href` de `.titre_horaire a` ;
  - `url` : `https://avignon.cinemas-utopia.org/film?id=<filmId>`, sans le paramètre `src` ;
  - `durationMin` : `/(\d+)\s*mn/` sur `span.horaire_complet_vo`, sinon `null` ;
  - `year` : `span.annefilm`, trim, ou `null` ;
  - `country` : le texte de `.pays_film` sans `VOST`, avec les `&nbsp;` normalisés et trim, ou `null` ;
  - `vost` : `true` si `.pays_film` contient `VOST` ;
  - `labels` : les textes trim de `i.cycle_title`.

  Règle de data-model.md : « Une séance sans `date`, `time`, `title` ou `filmId` est **rejetée**, avec un avertissement ». Écrire cet avertissement sur stderr avec le préfixe `::warning::`. La fonction est pure (pas de réseau). T007 doit passer.
- [X] T010 [P] [US1] Implémenter `toIcs(venue: Venue, sessions: Session[]): string` dans `src/ics.ts`, en suivant data-model.md (« Dérivations vers l'événement iCalendar ») et le contrat.
  - **En-têtes** : `PRODID:-//utopia-calendar//FR`, `CALSCALE:GREGORIAN`, `METHOD:PUBLISH`, `X-WR-CALNAME:Utopia <name>`, `X-WR-TIMEZONE:Europe/Paris`, `REFRESH-INTERVAL;VALUE=DURATION:P1D`, `X-PUBLISHED-TTL:P1D`.
  - **Fuseau** : un `VTIMEZONE` Europe/Paris statique, avec un `STANDARD` (CET, +0100, `RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU`, `DTSTART:19701025T030000`) et un `DAYLIGHT` (CEST, +0200, `RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU`, `DTSTART:19700329T020000`).
  - **Heures** : la fin se calcule sur l'heure murale, avec `Date.UTC` comme calculatrice naïve, sans conversion de fuseau. Durée par défaut : 120 mn.
  - **Événements** : triés par `date`, `time`, `title`. `DESCRIPTION` = `year · <durationMin> mn · country · VOST` (en omettant les parties absentes), puis une ligne par label, puis `url`, séparés par `\n`.
  - **Format** : échapper `\`, `;`, `,` et les retours à la ligne. Plier les lignes à 75 octets UTF-8 sans couper un caractère multi-octets. Utiliser des fins de ligne CRLF.

  T008 doit passer.
- [X] T011 [US1] Créer `src/generate.ts`, le point d'entrée de `npm run generate`, en suivant contracts/calendar-feed.md (« Commande de génération »).
  1. Faire **un seul** `fetch("https://avignon.cinemas-utopia.org/horaires/")` avec `User-Agent: utopia-calendar (+https://github.com/Instelce/utopia-calendar)`.
  2. Si la réponse n'est pas 2xx ou si le réseau est en erreur, écrire un message sur stderr et faire `process.exit(1)`.
  3. Appeler `parseSessions`. Si le résultat est vide, écrire « aucune séance reconnue, structure de la page modifiée ? » sur stderr et faire `process.exit(1)`.
  4. Pour chaque séance dont `venue` n'est dans aucun `VENUES[].name`, écrire `::warning::` sur stderr.
  5. Pour chaque `Venue`, écrire `public/<slug>.ics` (créer `public/` si besoin), même vide.

  Rien n'est écrit avant que les étapes 2 et 3 aient réussi. Afficher en fin d'exécution un résumé `manutention: N séances` par cinéma.
- [X] T012 [US1] Créer `.github/workflows/publish.yml`, nommé « Publish calendars » :
  - **déclencheurs** : `schedule: - cron: "0 5 */2 * *"`, `workflow_dispatch`, et `push` sur `main` ;
  - **permissions** : `contents: read`, `pages: write`, `id-token: write` ;
  - **concurrence** : `concurrency: { group: pages, cancel-in-progress: false }` ;
  - **job `build`** : `actions/checkout@v4`, `actions/setup-node@v4` (`node-version: 22`, `cache: npm`), `npm ci`, `npm run typecheck`, `npm test`, `npm run generate`, `actions/upload-pages-artifact@v3` (`path: public`) ;
  - **job `deploy`** : `needs: build`, `environment: { name: github-pages, url: ${{ steps.deployment.outputs.page_url }} }`, `actions/deploy-pages@v4` (`id: deployment`).

  Si une étape de `build` échoue, rien n'est déployé et Pages garde la version précédente (FR-010).

**Checkpoint**:
- `npm test` passe ;
- `npm run generate` produit `public/manutention.ics`, et son nombre de `BEGIN:VEVENT` est égal au nombre de séances Manutention affichées sur le site ;
- après un push et l'activation de Pages, l'abonnement `webcal://` Manutention fonctionne.

---

## Phase 4: User Story 2 - Choisir son cinéma (Priority: P1)

**Goal**: un flux `republique.ics` distinct, et des adresses d'abonnement documentées dans le README.

**Independent Test**: `public/republique.ics` ne contient que des séances République (aucune occurrence de `Escaliers Sainte-Anne`). S'abonner aux deux flux donne deux calendriers qu'on masque séparément. Le README permet de s'abonner en moins de 2 minutes (SC-005).

### Tests for User Story 2 ⚠️

- [X] T013 [US2] Ajouter à `tests/ics.test.ts` un test d'intégration sur la page figée. Pour chaque `v` de `VENUES`, appeler `toIcs(v, sessions.filter(s => s.venue === v.name))` et vérifier :
  - le flux Manutention contient 109 `BEGIN:VEVENT` et le flux République 15 ;
  - le flux République ne contient pas `Escaliers Sainte-Anne`, et le flux Manutention ne contient pas `Figuière` (FR-003, SC-001) ;
  - `X-WR-CALNAME:Utopia République` est présent.

  Si le filtrage ne vit pas dans `toIcs`, vérifier que T011 utilise exactement ce filtre.

### Implementation for User Story 2

- [X] T014 [US2] Réécrire `README.md`. Le contenu :
  - le but en une phrase ;
  - un tableau des deux cinémas avec les liens `webcal://instelce.github.io/utopia-calendar/manutention.ics` et `webcal://instelce.github.io/utopia-calendar/republique.ics`, plus les URLs `https://` équivalentes ;
  - comment s'abonner : Apple Calendar (clic sur le lien webcal) et Google Agenda (Autres agendas → À partir de l'URL → coller l'URL https) ;
  - une note : mise à jour tous les deux jours, et Google peut mettre 24 h ou plus à rafraîchir ;
  - une section mainteneur : `npm ci`, `npm test`, `npm run generate`, l'activation de Pages (Settings → Pages → Source = GitHub Actions), le lancement manuel du workflow, et la réactivation du cron si GitHub l'a désactivé après 60 jours sans activité (research R6).

**Checkpoint**: les deux flux sont générés et filtrés, et le README est à jour.

---

## Phase 5: User Story 3 - Informations utiles dans chaque événement (Priority: P3)

**Goal**: la `DESCRIPTION` et l'`URL` de l'événement reprennent l'année, la durée, le pays, VOST, les mentions et le lien du film.

**Independent Test**: dans `public/manutention.ics`, l'événement « Muyi, la légende du village des femmes » contient « Avant-première + réalisateur » et le lien de la fiche du film.

### Tests for User Story 3 ⚠️

- [X] T015 [US3] Ajouter à `tests/ics.test.ts`, à partir de la page figée :
  - la `DESCRIPTION` de l'événement « Muyi, la légende du village des femmes » contient `Avant-première + réalisateur` ;
  - un événement « High Hopes » contient `VOST` et `Mike Leigh en 3 films` dans sa `DESCRIPTION`, et une ligne `URL:https://avignon.cinemas-utopia.org/film?id=8621`.

  Pour ces vérifications, déplier les lignes (retirer `\r\n ` avant de chercher).

### Implementation for User Story 3

- [X] T016 [US3] Compléter `src/ics.ts` si T015 échoue, pour que `DESCRIPTION` et `URL` suivent exactement data-model.md : « lignes : `year · durationMin mn · country · VOST`, puis `labels`, puis `url` ». Les champs absents sont omis, sans séparateur orphelin.

**Checkpoint**: toutes les stories fonctionnent, et `npm test` est vert.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T017 Lancer `npm run typecheck` et `npm test`, et corriger toute erreur dans `src/` et `tests/`.
- [X] T018 Dérouler [quickstart.md](./quickstart.md), sections 2 à 4, en local :
  - génération en direct, avec un nombre de `VEVENT` par cinéma égal au site ;
  - deux générations successives identiques (`cmp`) ;
  - panne simulée qui renvoie le code de sortie 1 et laisse `public/` inchangé.

  Consigner les écarts éventuels.
- [X] T019 Après le premier déploiement, dérouler quickstart.md sections 5 et 6 : vérifier que le `Content-Type` est `text/calendar` (`curl -sI`) et que l'abonnement fonctionne dans Apple Calendar et Google Agenda (SC-002). Cette tâche demande à l'utilisateur d'activer Pages et de pousser sur `main`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** : aucune dépendance. T004 attend la confirmation de l'utilisateur.
- **Foundational (Phase 2)** : dépend de T001 et T002.
- **US1 (Phase 3)** : dépend de la Phase 2. Elle constitue le MVP.
- **US2 (Phase 4)** : T013 dépend de T009 et T010 ; T014 est indépendante du code.
- **US3 (Phase 5)** : dépend de T010.
- **Polish (Phase 6)** : dépend de toutes les stories. T019 dépend en plus d'un push sur `main` et de l'activation de Pages.

### Within User Story 1

T007 et T008 (tests) → T009 (scrape) et T010 (ics), en parallèle → T011 (generate) → T012 (workflow).

### Parallel Opportunities

- T002 et T003 en parallèle de T001.
- T007 et T008 en parallèle (deux fichiers de test).
- T009 et T010 en parallèle (`src/scrape.ts` et `src/ics.ts`, qui ne partagent que les types de la Phase 2).
- T014 (README) dès que les URLs du contrat sont connues, donc à tout moment.

---

## Parallel Example: User Story 1

```bash
# Tests d'abord, en parallèle :
Task: "T007 tests/scrape.test.ts (comptes 109/15, titres complets, Flush sans durée)"
Task: "T008 tests/ics.test.ts (DTEND, après minuit, échappement, pliage, déterminisme)"

# Puis les deux modules, en parallèle :
Task: "T009 parseSessions dans src/scrape.ts"
Task: "T010 toIcs dans src/ics.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 et Phase 2.
2. Phase 3 (T007 → T012).
3. **Valider** : `npm test`, `npm run generate`, import de `public/manutention.ics`.
4. Push sur `main`, activation de Pages : l'abonnement Manutention est en ligne.

Comme T011 écrit déjà un fichier par `VENUES`, `republique.ics` est publié dès le MVP. US2 ajoute le test de filtrage et le README.

### Incremental Delivery

1. MVP (US1) : flux Manutention en ligne.
2. US2 : filtrage vérifié par test, et README avec les deux liens.
3. US3 : descriptions enrichies.
4. Polish : validation de bout en bout dans de vraies applications de calendrier.

---

## Notes

- La page figée date du 2026-10-23. Les comptes 109/15 et les séances citées (Le Corset, Muyi, Hope, Flush, High Hopes) ne valent que pour elle. Ne pas la remplacer sans mettre les tests à jour.
- Le 2026-10-25 est la nuit du passage à l'heure d'hiver. « Flush » (01:20, sans durée) donne `DTEND` 03:20 en heure murale. Ce choix est assumé (research R4).
- Committer après chaque tâche ou groupe logique, uniquement si l'utilisateur le demande.
