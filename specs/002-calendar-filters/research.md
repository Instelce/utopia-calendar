# Research: Filtres de séances dans l'adresse d'abonnement

**Date**: 2026-10-23 · **Spec**: [spec.md](./spec.md)

Ce qui est imposé :
- par l'utilisateur : Vercel, projet `utopia-calendar` ; npm, Node.js, TypeScript ;
- par la feature 001 : on garde la lecture du site tous les deux jours par GitHub Actions, et le site Utopia ne doit pas être consulté plus souvent.

## R1 — Architecture : qui lit le site, qui filtre

**Decision** : on sépare la collecte et le filtrage.

1. Le workflow GitHub Actions existant (feature 001) écrit, en plus des `.ics`, un fichier `public/sessions.json`, publié sur GitHub Pages : `https://instelce.github.io/utopia-calendar/sessions.json`.
2. Une fonction Vercel lit ce JSON à chaque demande qui n'est pas en cache, applique le filtre de l'adresse et renvoie un `.ics`.

**Rationale** :
- **FR-012** : le site Utopia est lu une fois tous les deux jours, quel que soit le nombre d'abonnés ou de demandes.
- **FR-013** : si le site Utopia est en panne, le workflow ne publie rien (comportement de 001) et le JSON garde les dernières séances connues.
- **FR-011** : les `.ics` existants ne changent pas.
- **Code** : un seul scraper (`src/scrape.ts`) et un seul générateur ICS (`src/ics.ts`), partagés.

**Alternatives considered** :
- La fonction Vercel lit le site Utopia elle-même, avec un cache. On aurait deux lecteurs du site, une panne du site visible côté Vercel quand le cache expire, et cheerio embarqué dans la fonction.
- Vercel Cron + Vercel Blob pour stocker les séances : un service de plus, alors que GitHub Pages sert déjà les fichiers.
- Écrire les séances dans le dépôt et redéployer Vercel tous les deux jours : un commit de bot à chaque fois, ce que la feature 001 évitait.

## R2 — Forme de la fonction Vercel

**Decision** :
- `api/calendar.ts`, qui exporte `export default { async fetch(request: Request) }` (signature Web standard, runtime Node.js, sans dépendance) ;
- `vercel.json` réécrit `/` vers `/api/calendar`, pour que l'adresse publique soit `https://utopia-calendar.vercel.app/?cinema=…&regle=…`, comme l'utilisateur l'a demandé.

**Rationale** : la doc Vercel le confirme, un fichier `api/*.ts` avec un `fetch` exporté par défaut se déploie sans configuration. La réécriture garde les paramètres de l'adresse.
**Alternatives considered** : Hono ou Express, une dépendance pour une seule route ; Next.js ou SvelteKit, un framework entier pour une seule réponse texte.

**Risque à lever en premier** : la feature 001 importe ses modules avec l'extension `.ts` (`import … from "./ics.ts"`), ce qui est possible grâce à l'exécution native du TypeScript par Node. La doc Vercel ne dit pas si son compilateur `@vercel/node` accepte ces imports.
- **Test** : déployer d'abord une fonction minimale qui importe `src/ics.ts`.
- **Repli si ça échoue** : activer `rewriteRelativeImportExtensions` dans `tsconfig.json` (TS ≥ 5.7, qui réécrit `.ts` en `.js` à la compilation). Si ça ne suffit toujours pas, faire un `buildCommand` qui assemble `api/calendar.ts` en un seul `.js` (esbuild, installé en dev uniquement).

## R3 — Cache et fraîcheur

**Decision** :
- **Réponse `.ics`** : `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400, stale-if-error=604800`.
- **Lecture de `sessions.json` par la fonction** : `fetch` simple, sans cache applicatif.
- **Réponse d'erreur 400** : `Cache-Control: no-store`.

**Rationale** :
- Le CDN Vercel met en cache par adresse complète, paramètres compris. Une adresse donnée appelle donc la fonction au plus une fois par heure. Avec quelques abonnés, on reste très loin des limites gratuites.
- Les séances changent tous les deux jours : un cache d'une heure garantit qu'elles ont moins de 48 h + 1 h (FR-012).
- `stale-if-error` : si GitHub Pages ne répond pas, le CDN continue de servir la dernière réponse pendant 7 jours.
- Une adresse corrigée par l'utilisateur doit être réévaluée tout de suite, d'où le `no-store` sur les erreurs.

**Alternatives considered** : un cache en mémoire dans la fonction, inutile puisque le CDN joue ce rôle et qu'une instance peut s'arrêter à tout moment.

## R4 — Grammaire et analyse du filtre

**Decision** : un analyseur écrit à la main dans `src/filter.ts` (environ 80 lignes), qui travaille sur `URLSearchParams`. Grammaire complète dans [contracts/filter-syntax.md](./contracts/filter-syntax.md).
- `URLSearchParams` décode déjà `%3B`, `%3A` et `%2C`, ce qui couvre le cas limite « adresse encodée par l'application ».
- **Normalisation** : NFD, suppression des diacritiques, minuscules (FR-008).
- **Dispatch des clés** : une table `clé → analyseur de valeur`. Ajouter une clé, c'est ajouter une entrée (extensibilité). Une clé absente de la table est une erreur (FR-007).
- **Erreurs** : une classe `FilterError(message)` dont le message est en français et cite le fragment fautif ainsi que les valeurs permises.

**Rationale** : la grammaire est petite et régulière ; une bibliothèque de parsing ou un schéma (zod) coûterait plus qu'il ne rapporterait.
**Alternatives considered** : `zod` (une dépendance pour valider trois formes de chaîne) ; une syntaxe JSON encodée dans l'adresse (illisible, et pénible à écrire à la main).

## R5 — Jour et heure d'une séance

**Decision** :
- **Jour** : `new Date(date + "T00:00:00Z").getUTCDay()`, appliqué à la `date` du site (FR-005). Pas de fuseau horaire en jeu, puisque la date est une date du calendrier.
- **Heure** : on compare `time` (`HH:MM`) en minutes depuis minuit avec les bornes : `début ≤ t < fin` (FR-006).

**Rationale** : les champs de `Session` (feature 001) suffisent, sans conversion. Une séance à 01:20 le dimanche est un dimanche, comme le veut la spec.

## R6 — Calendrier multi-cinéma et identité des événements

**Decision** : `toIcs(venue, sessions)` devient `toIcs(calendarName, sessions)`. Le cinéma, et donc `LOCATION` et le slug de l'UID, est recherché pour chaque séance dans `VENUES` grâce à `session.venue`.
- `generate.ts` appelle `toIcs("Utopia Manutention", …)`.
- La fonction Vercel donne « Utopia <nom> » pour un seul cinéma, et « Utopia Avignon » pour plusieurs (FR-014).

**Rationale** :
- Un calendrier filtré peut mélanger les deux cinémas. Avec un UID et un `LOCATION` par séance, les événements sont identiques à ceux des flux non filtrés (FR-009).
- Les `.ics` actuels doivent rester **octet pour octet** identiques (FR-011) : un fichier de référence, généré avant la modification, le vérifie.

**Alternatives considered** : générer un calendrier par cinéma puis concaténer leurs événements, ce qui demanderait de dupliquer l'en-tête et le `VTIMEZONE`.

## R7 — Format de `sessions.json`

**Decision** : un tableau JSON de `Session` (le type de la feature 001, inchangé), limité aux cinémas connus de `VENUES`, trié par `date`, `time`, `title`. Pas d'horodatage, pour que le fichier reste identique tant que le site ne change pas.
**Rationale** : on réutilise le type existant, sans couche de conversion. Le tri rend la sortie déterministe.
**Risque** : GitHub Pages et Vercel se déploient séparément à partir du même push. Si un jour le type `Session` change, pendant quelques minutes la fonction peut lire un JSON à l'ancien format. Aujourd'hui le type ne change pas ; à garder en tête pour plus tard.

## R8 — Projet Vercel

**Decision** :
- un projet `utopia-calendar`, relié au dépôt GitHub `Instelce/utopia-calendar`, avec la branche de production `main` ;
- framework « Other », sans build command (sauf repli R2) ;
- version de Node prise dans `engines` de `package.json` (`>=22.18`, soit 22.x ou plus chez Vercel).

On crée le projet avec le MCP Vercel (`create_git_project`). Si l'application GitHub de Vercel n'est pas installée sur le dépôt, l'utilisateur doit l'autoriser depuis le tableau de bord.
**Rationale** : un push sur `main` déploie Vercel et GitHub Pages en même temps (FR-015).

## R9 — Tests

**Decision** : on garde `node --test`. On ajoute :
- `tests/filter.test.ts` : la grammaire, chaque cas d'erreur de FR-007, la normalisation et l'ordre sans effet ;
- `tests/calendar.test.ts` : la fonction `api/calendar.ts` appelée directement avec un `Request`, avec `globalThis.fetch` remplacé pour renvoyer les séances de la page figée. On y vérifie l'exemple de l'utilisateur, l'erreur 400 et les en-têtes ;
- `tests/fixtures/manutention-2026-10-23.ics` : la sortie de référence des flux 001, générée avant le changement de `toIcs`.

**Rationale** : tout se teste hors ligne et sans compte Vercel. Le déploiement réel est vérifié dans le quickstart.
