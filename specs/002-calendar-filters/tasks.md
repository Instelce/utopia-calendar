---

description: "Task list for calendar filters (Vercel function)"
---

# Tasks: Filtres de séances dans l'adresse d'abonnement

**Input**: Design documents from `/specs/002-calendar-filters/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/filter-syntax.md](./contracts/filter-syntax.md), [contracts/calendar-endpoint.md](./contracts/calendar-endpoint.md), [quickstart.md](./quickstart.md)

**Tests**: inclus. Le plan (research R9) prévoit `node --test`, hors ligne, sur la page figée `tests/fixtures/horaires-2026-10-23.html`. Les tests s'écrivent avant le code et doivent échouer d'abord.

**Organization**: une phase par user story de la spec (US1 à US4). Stack : celle de la feature 001, plus une fonction Vercel `api/calendar.ts` sans dépendance.

## Format: `[ID] [P?] [Story] Description`

- **[P]** : parallélisable (fichier différent, pas de dépendance sur une tâche non terminée).
- **[Story]** : US1 à US4 (voir spec.md).

## Valeurs de référence (page figée du 2026-10-23)

Dates : ven 23, sam 24, dim 25, lun 26, mar 27 octobre 2026. Séances : 124 au total, 109 Manutention et 15 République (feature 001).

| Filtre | Séances attendues |
|--------|-------------------|
| `cinema=manutention&regle=jours:lun-ven;heure:17h-&regle=jours:sam,dim` | 68 (45 le week-end + 23 en semaine à partir de 17:00) |
| `regle=jours:lun-ven;heure:17h-&regle=jours:sam,dim` (les deux cinémas) | 79 |
| `regle=jours:sam,dim` | 51 |
| `cinema=republique&regle=jours:dim;heure:14h-` | 3 |
| `regle=heure:-12h` | 24 |

Bornes à vérifier :
- « La Gradiva », lun 26 à 17:00, est **gardée** par l'exemple de l'utilisateur ;
- « Le Corset », ven 23 à 10:30, est **exclue** par l'exemple de l'utilisateur ;
- « Le chant des oliviers », ven 23 à 12:00, est **exclue** par `heure:-12h`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: créer le projet Vercel et lever le risque des imports `.ts` (research R2) avant d'écrire la logique.

- [X] T001 Créer le projet Vercel `utopia-calendar` relié au dépôt GitHub `Instelce/utopia-calendar`, avec l'outil MCP `mcp__vercel__create_git_project` (le charger via ToolSearch) :
  - framework « Other », sans build command, branche de production `main` ;
  - vérifier ensuite avec `mcp__vercel__list_projects` (`search: "utopia"`).

  Si l'outil renvoie `requires_user_action` (application GitHub de Vercel non installée), donner l'URL du tableau de bord à l'utilisateur et attendre. Noter l'ID du projet et du team en tête de `specs/002-calendar-filters/quickstart.md`.
- [X] T002 [P] Dans `tsconfig.json`, ajouter `"api"` à `"include"` (qui devient `["src", "tests", "api"]`).
- [X] T003 [P] Créer `vercel.json` à la racine :

  ```json
  { "$schema": "https://openapi.vercel.sh/vercel.json", "rewrites": [{ "source": "/", "destination": "/api/calendar" }] }
  ```
- [X] T004 Créer un squelette `api/calendar.ts` qui importe `import { toIcs } from "../src/ics.ts";` et `import { VENUES } from "../src/venues.ts";`, et exporte `export default { fetch() { return new Response(toIcs(VENUES[0], []), { headers: { "Content-Type": "text/calendar; charset=utf-8" } }); } }`.
  1. **Demander à l'utilisateur l'autorisation** de commiter sur une branche `002-calendar-filters` et de la pousser (Vercel crée alors un déploiement de preview).
  2. Vérifier avec `mcp__vercel__list_deployments` puis `mcp__vercel__get_deployment` que le build réussit, et avec `mcp__vercel__web_fetch_vercel_url` sur l'URL de preview (chemin `/`) qu'il renvoie un `VCALENDAR`.

  **Si le build échoue sur les imports `.ts`** : ajouter `"rewriteRelativeImportExtensions": true` dans `tsconfig.json` et redéployer. Si ça échoue encore, ajouter `esbuild` en dev et `"buildCommand": "esbuild api/calendar.ts --bundle --platform=node --format=esm --outfile=api/calendar.js"` dans `vercel.json` (research R2). Consigner la solution retenue dans `specs/002-calendar-filters/research.md` (R2).

**Checkpoint**: une URL de preview Vercel renvoie un calendrier vide valide, et la question des imports `.ts` est tranchée.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: un `toIcs` capable de traiter plusieurs cinémas, sans changer les flux existants, et les données `sessions.json`.

**⚠️ CRITICAL**: T005 doit être fait **avant** T006.

- [X] T005 Générer les fichiers de référence avec le code **actuel**, avant toute modification de `src/ics.ts` :

  ```sh
  node -e 'import("./src/scrape.ts").then(async ({parseSessions}) => { const {toIcs} = await import("./src/ics.ts"); const {VENUES} = await import("./src/venues.ts"); const fs = await import("node:fs"); const s = parseSessions(fs.readFileSync("tests/fixtures/horaires-2026-10-23.html","utf8")); for (const v of VENUES) fs.writeFileSync(`tests/fixtures/${v.slug}-2026-10-23.ics`, toIcs(v, s.filter(x => x.venue === v.name))); })'
  ```

  Vérifier que `tests/fixtures/manutention-2026-10-23.ics` contient 109 `BEGIN:VEVENT`, et `tests/fixtures/republique-2026-10-23.ics` 15.
- [X] T006 Changer la signature en `toIcs(calendarName: string, sessions: Session[]): string` dans `src/ics.ts` (research R6) :
  - pour chaque séance, trouver le cinéma par `VENUES.find(v => v.name === s.venue)`. Une séance sans cinéma connu est ignorée, comme `generate.ts` le faisait déjà ;
  - `UID` et `LOCATION` utilisent ce cinéma ;
  - `X-WR-CALNAME:${escape(calendarName)}`.

  Mettre à jour les appelants :
  - `src/generate.ts` : `toIcs(\`Utopia ${venue.name}\`, own)` ;
  - `tests/ics.test.ts` : tous les `toIcs(manutention, …)` deviennent `toIcs("Utopia Manutention", …)` ; `X-WR-CALNAME:Utopia République` reste attendu pour `toIcs("Utopia République", …)`.

  Ajouter dans `tests/ics.test.ts` un test « flux identiques à la référence » : pour chaque `v` de `VENUES`, `toIcs(\`Utopia ${v.name}\`, sessions du fixture de ce cinéma)` est **strictement égal** au contenu de `tests/fixtures/${v.slug}-2026-10-23.ics` (FR-011). `npm test` doit passer.
- [X] T007 Dans `src/generate.ts`, après l'écriture des `.ics`, écrire `public/sessions.json` (research R7, contracts/calendar-endpoint.md) :
  - contenu : `JSON.stringify(sessions)` des seules séances dont `venue` est dans `VENUES` ;
  - triées par `date`, `time`, `title` (même tri que `toIcs` ; l'exporter depuis `src/ics.ts` si besoin, sans le dupliquer) ;
  - le fichier n'est écrit que si la génération a réussi, comme les `.ics`.

  Ajouter `sessions.json: N séances` au résumé affiché.

**Checkpoint**: `npm test` est vert ; `npm run generate` produit les deux `.ics` (identiques à avant) et `public/sessions.json`.

---

## Phase 3: User Story 1 - S'abonner à un calendrier filtré par jour et par heure (Priority: P1) 🎯 MVP

**Goal**: `https://utopia-calendar.vercel.app/?cinema=manutention&regle=jours:lun-ven;heure:17h-&regle=jours:sam,dim` renvoie les seules séances voulues.

**Independent Test**: appeler le handler avec l'exemple de l'utilisateur, sur les séances de la page figée. On attend 68 `VEVENT`, « La Gradiva » (lun 26, 17:00) présente et « Le Corset » (ven 23, 10:30) absente.

### Tests for User Story 1 ⚠️

- [X] T008 [P] [US1] Écrire `tests/filter.test.ts` (`node:test`). Construire les séances avec `parseSessions` sur la page figée, puis vérifier `parseFilter(new URLSearchParams(q))` et `matches(filter, s)`. Pour chaque ligne du tableau « Valeurs de référence », le nombre de séances retenues est le bon. Cas à couvrir :
  - les bornes : La Gradiva gardée, Le Corset exclu, Le chant des oliviers exclu par `heure:-12h` ;
  - « Flush » (dim 25 à 01:20) retenue par `jours:dim` et non par `jours:sam` ;
  - `jours:ven-lun` donne `days` égal à {5, 6, 0, 1} ;
  - `jours:lun,mer-ven` donne {1, 3, 4, 5} ;
  - `heure:9h05-17h30` donne `startMin` 545 et `endMin` 1050 ;
  - `cinema=manutention,republique` et `cinema=manutention&cinema=republique` équivalent à l'absence de `cinema` ;
  - pas de paramètre : 124 séances ;
  - l'ordre est sans effet : les deux règles de l'exemple inversées, et les conditions `heure:17h-;jours:lun-ven` inversées, donnent le même résultat ;
  - la normalisation : `cinema=République&regle=JOURS:Sam,Dim` est accepté ;
  - `;` et `:` encodés (`regle=jours%3Alun-ven%3Bheure%3A17h-`) donnent le même résultat ;
  - `calendarName` vaut « Utopia Manutention » pour un cinéma, « Utopia Avignon » pour deux.
- [X] T009 [P] [US1] Écrire `tests/calendar.test.ts`. Remplacer `globalThis.fetch` par une fonction qui renvoie `Response.json(sessions)`, avec les séances de la page figée triées. Appeler `(await import("../api/calendar.ts")).default.fetch(new Request(url))` et vérifier :
  - l'exemple de l'utilisateur : statut 200, `Content-Type` qui commence par `text/calendar`, `Cache-Control` égal à `public, s-maxage=3600, stale-while-revalidate=86400, stale-if-error=604800`, 68 `BEGIN:VEVENT` et `X-WR-CALNAME:Utopia Manutention` ;
  - aucun paramètre : 124 `VEVENT` et `X-WR-CALNAME:Utopia Avignon` ;
  - le `fetch` simulé a été appelé avec `https://instelce.github.io/utopia-calendar/sessions.json` ;
  - restaurer le `fetch` d'origine à la fin.

### Implementation for User Story 1

- [X] T010 [US1] Créer `src/filter.ts` selon [contracts/filter-syntax.md](./contracts/filter-syntax.md) et data-model.md.
  - **Exports** : `class FilterError extends Error` ; `type Filter = { venues: Venue[]; rules: Rule[] }` ; `type Rule = { days?: Set<number>; startMin?: number; endMin?: number }` ; `parseFilter(params: URLSearchParams): Filter` ; `matches(filter: Filter, s: Session): boolean` ; `calendarName(filter: Filter): string`.
  - **Normalisation** : `v.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim()`.
  - **Table des clés** : un objet `CONDITIONS: Record<string, (value: string, rule: Rule) => void>` avec `jours` et `heure`. Ajouter une clé, c'est ajouter une entrée.
  - **`jours`** : `DAYS = ["dim","lun","mar","mer","jeu","ven","sam"]`, dans l'ordre de `getUTCDay`. Une plage `a-b` avance de `a` à `b`, modulo 7, en partant de `a`.
  - **`heure`** : `H = /^(\d{1,2})h(\d{2})?$/`, heures 0–23 et minutes 0–59. Data-model : « au moins une des deux bornes est présente, et si les deux le sont, `startMin < endMin` ».
  - **`matches`** : le cinéma de `s` est dans `filter.venues` **et** (`rules` est vide **ou** `rules.some(r => toutes ses conditions présentes sont vraies)`). Jour : `new Date(s.date + "T00:00:00Z").getUTCDay()`. Heure : `HH*60+MM`, avec `startMin ≤ t < endMin`.

  T008 doit passer.
- [X] T011 [US1] Remplacer le squelette par le vrai handler dans `api/calendar.ts` (contracts/calendar-endpoint.md, cycle d'une demande dans data-model.md) :
  - `export default { async fetch(request: Request) }` ;
  - méthode autre que `GET`/`HEAD` → 405 avec `Allow: GET, HEAD` ;
  - `parseFilter(new URL(request.url).searchParams)` ; une `FilterError` → 400 (traitée en US2) ;
  - `fetch("https://instelce.github.io/utopia-calendar/sessions.json")`. Si la réponse n'est pas ok, ou en cas d'exception ou de JSON invalide → 502, corps `Données des séances indisponibles, réessayez plus tard.`, avec `Content-Type: text/plain; charset=utf-8` et `Cache-Control: no-store` ;
  - sinon 200 avec `toIcs(calendarName(filter), sessions.filter(s => matches(filter, s)))`, `Content-Type: text/calendar; charset=utf-8` et `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400, stale-if-error=604800`.

  T009 doit passer.

**Checkpoint**: `npm test` est vert ; l'exemple de l'utilisateur donne 68 séances via le handler.

---

## Phase 4: User Story 2 - Des messages d'erreur clairs (Priority: P1)

**Goal**: toute adresse invalide est refusée en 400, avec le message exact du contrat.

**Independent Test**: `?regle=jours:lun-vdr` → 400, et le corps contient `vdr` et `lun mar mer jeu ven sam dim`.

### Tests for User Story 2 ⚠️

- [X] T012 [P] [US2] Ajouter à `tests/filter.test.ts` un test par ligne du tableau « Erreurs » de [contracts/filter-syntax.md](./contracts/filter-syntax.md) (10 cas) :
  - `assert.throws(() => parseFilter(new URLSearchParams(q)), (e) => e instanceof FilterError && e.message === "<message exact du contrat>")` ;
  - les cas : `cinemas=manutention`, `cinema=utopia`, `regle=`, `regle=lun-ven`, `regle=vost:oui`, `regle=jours:lun;jours:mar`, `regle=jours:lun-vdr`, `regle=heure:25h-`, `regle=heure:-`, `regle=heure:20h-18h` ;
  - plus `regle=heure:17h60-` (minutes invalides), qui doit lever `FilterError`.
- [X] T013 [P] [US2] Ajouter à `tests/calendar.test.ts` :
  - `?regle=jours:lun-vdr` → statut 400, `Content-Type: text/plain; charset=utf-8`, `Cache-Control: no-store`, un corps qui contient `vdr`, et le `fetch` simulé **n'a pas** été appelé (on valide avant de lire les données) ;
  - un `fetch` simulé qui renvoie 500 → statut 502 avec le message du contrat ;
  - `new Request(url, { method: "POST" })` → statut 405 avec `Allow: GET, HEAD`.

### Implementation for User Story 2

- [X] T014 [US2] Dans `src/filter.ts`, aligner les messages de `FilterError` **mot pour mot** sur la colonne « Message » du contrat, en remplaçant l'exemple par le fragment réel. Rejeter tout paramètre autre que `cinema` et `regle`. Dans `api/calendar.ts`, transformer une `FilterError` en 400 avec `Content-Type: text/plain; charset=utf-8` et `Cache-Control: no-store` ; toute autre exception est relancée. T012 et T013 doivent passer.

**Checkpoint**: les 10 cas d'erreur du contrat sont couverts et passent.

---

## Phase 5: User Story 3 - Ne pas casser les abonnements existants (Priority: P1)

**Goal**: `manutention.ics` et `republique.ics` restent identiques ; les événements filtrés sont les mêmes que ceux des flux par cinéma.

**Independent Test**: le test « flux identiques à la référence » (T006) passe. Après déploiement, l'empreinte md5 du `manutention.ics` publié est identique à celle d'une génération faite avec le code d'avant la feature, sur les mêmes données.

### Tests for User Story 3 ⚠️

- [X] T015 [US3] Ajouter à `tests/calendar.test.ts` un test d'identité des événements (FR-009) :
  1. découper la réponse de `?cinema=manutention&regle=jours:sam,dim` en blocs `BEGIN:VEVENT…END:VEVENT` ;
  2. découper de la même façon `tests/fixtures/manutention-2026-10-23.ics` ;
  3. vérifier que chaque bloc filtré se retrouve **à l'identique** dans la référence.

  Vérifier aussi que `?cinema=manutention` donne exactement les mêmes blocs `VEVENT`, dans le même ordre, que la référence.

### Implementation for User Story 3

- [X] T016 [US3] Aucun code supplémentaire attendu : si T015 échoue, corriger `src/ics.ts` (et non le test ni la référence) jusqu'à ce que T006 et T015 passent.

**Checkpoint**: la non-régression est prouvée hors ligne.

---

## Phase 6: User Story 4 - Comprendre et composer un filtre (Priority: P2)

**Goal**: le README permet de composer une adresse en moins de 5 minutes (SC-004).

**Independent Test**: chaque adresse d'exemple du README, collée telle quelle après déploiement, renvoie un statut 200.

- [X] T017 [US4] Ajouter à `README.md` une section « Filtrer les séances », entre « S'abonner » et « Maintenance ». Elle contient :
  - l'adresse de base `https://utopia-calendar.vercel.app/` ;
  - un tableau des paramètres (`cinema`, `regle`) et des clés (`jours`, `heure`) avec leurs formats ;
  - la règle de combinaison en une phrase : « une séance est gardée si elle respecte au moins une règle ; une règle est respectée si toutes ses conditions le sont » ;
  - les 5 exemples du tableau « Exemples » de [contracts/filter-syntax.md](./contracts/filter-syntax.md), en adresses complètes à copier ;
  - une note : une erreur dans l'adresse affiche un message explicatif quand on l'ouvre dans un navigateur ;
  - une note : les adresses `github.io` restent valables.

  Dans « Maintenance », ajouter le déploiement Vercel (automatique à chaque push sur `main`) et `sessions.json`.

**Checkpoint**: le README est à jour.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T018 Lancer `npm run typecheck` et `npm test`, et corriger toute erreur dans `src/`, `api/` et `tests/`.
- [ ] T019 Avant de pousser, noter l'empreinte md5 du `manutention.ics` publié (`curl -s https://instelce.github.io/utopia-calendar/manutention.ics | md5`). **Demander à l'utilisateur l'autorisation** de fusionner sur `main` et de pousser. Ensuite :
  - suivre le workflow GitHub Actions et le déploiement de production Vercel (`mcp__vercel__list_deployments`) ;
  - dérouler [quickstart.md](./quickstart.md), section 4 ;
  - vérifier que `sessions.json` est publié ;
  - vérifier statut, en-têtes et nombre de `VEVENT` sur `https://utopia-calendar.vercel.app/?cinema=manutention` (même nombre que `manutention.ics`) ;
  - vérifier que le `;` encodé donne le même résultat ;
  - le md5 de `manutention.ics` doit être inchangé si le site n'a pas changé entre-temps. Sinon, comparer `npm run generate` lancé sur le commit précédent et sur le nouveau, avec la même page.

  En cas d'erreur à l'exécution : `mcp__vercel__get_runtime_errors`, puis `mcp__vercel__get_runtime_logs`.
- [ ] T020 Demander à l'utilisateur de s'abonner sur son téléphone à l'adresse de [quickstart.md](./quickstart.md), section 5, et si possible dans une deuxième application (SC-002). Lui faire vérifier qu'aucune séance de semaine avant 17:00 n'apparaît et que l'application n'a ajouté aucun paramètre qui provoquerait un refus (plan, risque « paramètres inconnus »).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** :
  - T002 et T003 sont indépendantes ;
  - T004 dépend de T001, T002 et T003, et de l'accord de l'utilisateur pour pousser.
- **Foundational (Phase 2)** : T005 → T006 → T007, dans cet ordre strict (la référence doit précéder la refactorisation).
- **US1 (Phase 3)** : dépend de la Phase 2. C'est le MVP.
- **US2 (Phase 4)** : dépend de T010 et T011 (mêmes fichiers).
- **US3 (Phase 5)** : dépend de T006 et T011.
- **US4 (Phase 6)** : indépendante du code, possible dès que les contrats existent.
- **Polish (Phase 7)** : dépend de tout le reste ; T019 et T020 demandent une action de l'utilisateur.

### Within User Story 1

T008 et T009 (tests) → T010 (`filter.ts`) → T011 (handler).

### Parallel Opportunities

- T002 et T003.
- T008 et T009 (fichiers de test différents).
- T012 et T013 (fichiers de test différents).
- T017 (README) à tout moment.

---

## Parallel Example: User Story 1

```bash
Task: "T008 tests/filter.test.ts — comptes 68/79/51/3/24, bornes, normalisation, ordre"
Task: "T009 tests/calendar.test.ts — handler, en-têtes, fetch simulé de sessions.json"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 : le projet Vercel et le déploiement preview qui tranche la question des imports `.ts`.
2. Phase 2 : la référence, le refactor `toIcs` et `sessions.json`.
3. Phase 3 : `filter.ts` et le handler.
4. **Valider** : `npm test`, puis le déploiement et l'abonnement à l'exemple de l'utilisateur.

### Incremental Delivery

1. MVP (US1) : le filtre fonctionne.
2. US2 : les erreurs sont exactes et testées.
3. US3 : la non-régression est prouvée.
4. US4 : README.
5. Polish : production et vrai abonnement.

---

## Notes

- Les comptes du tableau « Valeurs de référence » ne valent que pour la page figée du 2026-10-23.
- `sessions.json` n'existe sur Pages qu'après le premier push de T007 sur `main`. Avant, le handler déployé en preview renvoie 502 sur une vraie demande ; c'est normal.
- Committer ou pousser uniquement avec l'accord de l'utilisateur (T004, T019).
