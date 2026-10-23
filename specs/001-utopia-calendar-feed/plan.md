# Implementation Plan: Calendriers des séances Utopia Avignon

**Branch**: `001-utopia-calendar-feed` | **Date**: 2026-10-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-utopia-calendar-feed/spec.md`

## Summary

Un script Node/TypeScript :
- lit la page Horaires d'Utopia Avignon, une requête par exécution ;
- en extrait les séances de la semaine ;
- écrit un fichier iCalendar par cinéma (`manutention.ics`, `republique.ics`).

Un workflow GitHub Actions lance le script tous les deux jours et publie les fichiers sur GitHub Pages, à des URLs stables auxquelles on s'abonne en `webcal://`. Si le script échoue, rien n'est déployé : le dernier flux valide reste en ligne. Pas de site SvelteKit ni de Python : le README suffit pour les liens d'abonnement (research R7).

## Technical Context

**Language/Version**: TypeScript exécuté directement par Node.js ≥ 22.18 (type stripping natif, pas de build) ; `tsc --noEmit` pour la vérification des types.

**Primary Dependencies**: `cheerio` (lecture HTML) ; dev : `typescript`, `@types/node`. ICS écrit à la main (research R4).

**Storage**: aucun. Fichiers générés dans `public/` (non versionné), publiés par GitHub Pages.

**Testing**: `node --test` (runner natif) avec la page figée `tests/fixtures/horaires-2026-10-23.html`.

**Target Platform**: runner GitHub Actions `ubuntu-latest` ; exécution locale sur macOS/Linux.

**Project Type**: script CLI + workflow de publication (site statique de 2 fichiers).

**Performance Goals**: une génération en moins de 30 s (SC-004 de la spec). En réalité, environ 1 s : une requête HTTP et ~125 séances.

**Constraints**: une seule requête au site par exécution (FR-012) ; sortie déterministe (SC-004) ; heures Europe/Paris (FR-006) ; ne jamais publier un flux vide à la suite d'une panne (FR-010).

**Scale/Scope**: 2 cinémas, ~125 séances par semaine, un petit nombre d'abonnés ; 4 fichiers source.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` est encore le modèle vierge (aucun principe ratifié) : aucune contrainte à vérifier. Principe appliqué par défaut : simplicité. Une seule dépendance d'exécution, pas d'étape de build, pas de service en plus de GitHub.

- Pré-Phase 0 : **PASS** (aucune règle).
- Post-Phase 1 : **PASS**. Le design n'ajoute ni projet, ni couche, ni dépendance au-delà de `cheerio`.

## Project Structure

### Documentation (this feature)

```text
specs/001-utopia-calendar-feed/
├── plan.md              # This file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   └── calendar-feed.md # Phase 1 — URLs et format des flux publics
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── venues.ts       # constantes Manutention / République (nom, slug, adresse)
├── scrape.ts       # parseSessions(html): Session[]  — sélecteurs de research R1
├── ics.ts          # toIcs(venue, sessions): string — VTIMEZONE, échappement, pliage
└── generate.ts     # point d'entrée : fetch → parse → écrit public/<slug>.ics ; exit 1 si panne

tests/
├── fixtures/
│   └── horaires-2026-10-23.html
├── scrape.test.ts
└── ics.test.ts

.github/workflows/
└── publish.yml     # schedule tous les 2 jours (0 5 */2 * *) + workflow_dispatch + push main → test → generate → deploy-pages

package.json        # "type": "module", engines node >=22.18, scripts generate/test/typecheck
tsconfig.json       # noEmit, allowImportingTsExtensions, erasableSyntaxOnly, verbatimModuleSyntax
README.md           # liens webcal:// par cinéma, mode d'emploi Apple/Google, note sur la désactivation après 60 jours
.gitignore          # + node_modules/, public/
```

**Structure Decision**: un projet unique à la racine. Les fichiers `main.py`, `pyproject.toml` et `.python-version` (issus de `uv init`) ne servent plus. Leur suppression sera une tâche, à confirmer par l'utilisateur.

## Complexity Tracking

Aucune violation : section sans objet.
