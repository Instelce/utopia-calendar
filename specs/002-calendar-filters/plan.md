# Implementation Plan: Filtres de séances dans l'adresse d'abonnement

**Branch**: `002-calendar-filters` | **Date**: 2026-10-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-calendar-filters/spec.md`

## Summary

Le workflow GitHub Actions de la feature 001 continue de lire le site Utopia tous les deux jours. En plus des `.ics`, il publie maintenant sur GitHub Pages un fichier `sessions.json`, qui contient toutes les séances.

Une fonction Vercel (projet `utopia-calendar`) sert `https://utopia-calendar.vercel.app/?cinema=…&regle=…`. Elle :
- lit ce JSON ;
- analyse la syntaxe de filtre (OU entre les règles, ET entre les conditions, clés `jours` et `heure`) ;
- renvoie un `.ics` construit avec le générateur existant.

Le CDN de Vercel met chaque adresse en cache une heure, ce qui fait que le site Utopia n'est jamais consulté plus souvent qu'aujourd'hui. Les flux `manutention.ics` et `republique.ics` restent identiques, octet pour octet.

## Technical Context

**Language/Version**: TypeScript ; Node.js ≥ 22.18 en local et sur GitHub Actions (exécution native) ; runtime Node.js de Vercel, avec la version tirée de `engines`.

**Primary Dependencies**: aucune nouvelle. La fonction n'utilise que `src/ics.ts`, `src/venues.ts` et le nouveau `src/filter.ts`. `cheerio` reste limité au scraper. En repli seulement (research R2) : `esbuild` en dev.

**Storage**: aucun. `sessions.json` est publié sur GitHub Pages ; le cache est celui du CDN de Vercel.

**Testing**: `node --test`. On ajoute `tests/filter.test.ts` et `tests/calendar.test.ts` (handler appelé directement, avec `fetch` simulé), plus un fichier de référence `.ics` pour la non-régression.

**Target Platform**: Vercel Functions (Node.js), GitHub Actions, GitHub Pages.

**Project Type**: une fonction HTTP sans état et un script de génération existant.

**Performance Goals**: réponse en moins de 3 s (SC-005). Une réponse en cache CDN arrive en environ 50 ms ; sans cache, il faut un `fetch` de JSON d'environ 30 Ko, plus le filtrage de quelque 125 séances.

**Constraints**:
- le site Utopia n'est pas lu plus souvent (FR-012) ;
- les `.ics` existants restent identiques (FR-011) ;
- erreurs explicites en 400, jamais de calendrier silencieusement faux (FR-007) ;
- offre gratuite de Vercel.

**Scale/Scope**: quelques abonnés et deux cinémas ; environ 4 fichiers modifiés et 4 créés.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` n'est toujours pas ratifié : aucune règle à vérifier. Principe appliqué par défaut : la simplicité, c'est-à-dire aucune nouvelle dépendance d'exécution, une seule fonction et un seul scraper.

- Pré-Phase 0 : **PASS**
- Post-Phase 1 : **PASS**. Le design ajoute un service (Vercel), mais c'est ce que demande l'utilisateur (spec, FR-015).

## Project Structure

### Documentation (this feature)

```text
specs/002-calendar-filters/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── filter-syntax.md       # grammaire, sémantique, erreurs, exemples
│   └── calendar-endpoint.md   # réponses HTTP, sessions.json, non-régression
└── tasks.md                   # /speckit-tasks
```

### Source Code (repository root)

```text
api/
└── calendar.ts        # NOUVEAU — export default { fetch } : parseFilter → fetch sessions.json → toIcs

src/
├── filter.ts          # NOUVEAU — parseFilter(URLSearchParams): Filter (lève FilterError), matches(), calendarName()
├── ics.ts             # MODIFIÉ — toIcs(calendarName, sessions) : cinéma cherché par séance dans VENUES
├── generate.ts        # MODIFIÉ — appelle toIcs("Utopia <nom>", …) et écrit en plus public/sessions.json
├── scrape.ts          # inchangé
└── venues.ts          # inchangé

tests/
├── fixtures/
│   ├── horaires-2026-10-23.html
│   ├── manutention-2026-10-23.ics   # NOUVEAU — références générées AVANT la modification de toIcs
│   └── republique-2026-10-23.ics
├── filter.test.ts     # NOUVEAU
├── calendar.test.ts   # NOUVEAU
├── ics.test.ts        # MODIFIÉ — nouvelle signature, comparaison avec la référence
└── scrape.test.ts     # inchangé

vercel.json            # NOUVEAU — rewrites "/" → "/api/calendar"
tsconfig.json          # MODIFIÉ — "include" + "api"
README.md              # MODIFIÉ — section « Filtrer », syntaxe et exemples
```

**Structure Decision**: on garde le projet unique à la racine. `api/` est la convention de Vercel pour les fonctions sans framework : elle n'interfère ni avec GitHub Actions ni avec Pages (`public/` est ignoré par git, Vercel ne le voit donc pas).

## Ordre conseillé (pour /speckit-tasks)

1. **Lever le risque de R2** : déployer une fonction minimale `api/calendar.ts` qui importe `src/ics.ts`, sur le projet Vercel `utopia-calendar` créé et relié au dépôt.
2. Générer le fichier de référence `.ics`, **puis** refactorer `toIcs`.
3. Écrire `filter.ts` et ses tests, puis le handler et ses tests.
4. Ajouter `sessions.json` à `generate.ts`, mettre à jour le README, déployer et dérouler le quickstart.

## Complexity Tracking

Aucune violation : section sans objet.
