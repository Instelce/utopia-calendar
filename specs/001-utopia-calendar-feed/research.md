# Research: Calendriers des séances Utopia Avignon

**Date**: 2026-10-23 · **Spec**: [spec.md](./spec.md)

Contraintes imposées par l'utilisateur : npm, Node.js, TypeScript ; SvelteKit seulement si un site est nécessaire ; Python seulement pour du tooling si nécessaire ; GitHub Actions.

## R1 — Structure de la page source

Observé sur https://avignon.cinemas-utopia.org/horaires/ le 2026-10-23 (page de ~350 Ko) :

- La page est rendue côté serveur (WordPress) : toutes les séances sont dans le HTML, sans JavaScript à exécuter.
- Une seule semaine est présente : `div.horaires_semaine.semaine_1`. Elle couvre du jour courant au mardi suivant (23→27 oct.). Les boutons « Semaine suivante/précédente » sont gérés en JS, et ces semaines sont hors périmètre (voir spec, Hypothèses).
- Une séance = `div.horaire_complet_container`, dont les classes contiennent :
  - `horaire_YYYY-MM-DD_date` → la date ;
  - `salle_1` (Manutention) / `salle_2` (République) ;
  - `cycle_<id>`, `evenement_<id>`, `derniere-chance` → les mentions.
- Dans `.horaire_complet_inner_right` :
  - premier `div` : l'heure `HH:MM` ;
  - `h3.horaire_nom_cinema` : le nom du cinéma ;
  - `.titre_horaire a[href]` : le lien vers le film, `/film?id=<id>[&src=…]` ;
  - `.titre_horaire b[title]` : le **titre complet**, alors que le texte du `b` peut être tronqué par « … » ;
  - `span.annefilm` : l'année ; `span.horaire_complet_vo` : la durée (« – 90 mn ») ; `.pays_film` : le pays, plus `<b>VOST</b>` si présent ;
  - `i.cycle_title` : les mentions en clair (« Mike Leigh en 3 films », « Avant-première + réalisateur », « Dernière chance »).
- Volume : 124 séances sur 5 jours dans la page figée (109 Manutention, 15 République, comptées sur `h3.horaire_nom_cinema`). Une séance n'a pas de durée : « Flush », le 2026-10-25 à 01:20.

**Decision** : un seul GET de la page par exécution, puis lecture des séances via les sélecteurs ci-dessus. Le cinéma est lu dans `h3.horaire_nom_cinema` (texte stable et lisible) plutôt que dans `salle_N`.
**Rationale** : satisfait FR-001, FR-002 et FR-012. Le titre complet vient de l'attribut `title`, ce qui règle le cas limite des titres tronqués.
**Alternatives considered** : un navigateur headless (Playwright), inutile puisque le HTML est statique ; l'API REST WordPress, qui n'expose pas les horaires.

## R2 — Environnement d'exécution TypeScript

**Decision** : Node.js ≥ 22.18, qui exécute directement le TypeScript (type stripping natif, sans transpileur). `typescript` sert uniquement à vérifier les types (`tsc --noEmit`, avec `erasableSyntaxOnly`).
**Rationale** : aucune étape de build ni de dépendance d'exécution comme `tsx` ou `ts-node`. Le poste local est en Node 22.21.
**Alternatives considered** : `tsx` (une dépendance de plus pour rien) ; une compilation `tsc` vers `dist/` (une étape de build inutile pour un script).

## R3 — Lecture du HTML

**Decision** : `cheerio` (sélecteurs CSS côté serveur).
**Rationale** : c'est le standard pour le scraping HTML statique en Node, et les sélecteurs de R1 s'y transposent tels quels. C'est la seule dépendance d'exécution.
**Alternatives considered** : `node-html-parser` (plus léger, mais moins robuste au HTML mal formé) ; des expressions régulières (fragiles).

## R4 — Génération iCalendar

**Decision** : un générateur écrit à la main (~50 lignes) avec :
- `DTSTART;TZID=Europe/Paris:YYYYMMDDTHHMMSS` et `DTEND` idem, plus un bloc `VTIMEZONE` Europe/Paris statique (règles CET/CEST) ;
- l'échappement RFC 5545 (`\`, `;`, `,`, retours à la ligne) et le pliage des lignes à 75 octets, avec des fins de ligne CRLF ;
- des en-têtes de calendrier : `X-WR-CALNAME`, `X-WR-TIMEZONE:Europe/Paris`, `REFRESH-INTERVAL;VALUE=DURATION:P1D`, `X-PUBLISHED-TTL:P1D`.

**Rationale** : comme les heures restent en heure locale d'Avignon, aucune conversion de fuseau n'est faite dans le code. Le changement d'heure (FR-006) est géré par le client grâce au `VTIMEZONE`. La fin d'événement se calcule sur l'heure murale : le passage après minuit est pris en compte, l'écart d'une heure possible la nuit du changement d'heure est négligeable (aucune séance à 2-3 h). La sortie est déterministe, ce qui satisfait SC-004.
**Alternatives considered** : le paquet `ics`, qui sort en UTC ou en heure « flottante » et imposerait une conversion Europe/Paris → UTC ; `ical-generator` + `@touch4it/ical-timezones` (deux dépendances pour ce que 50 lignes font).

## R5 — Identifiant stable et horodatage

**Decision** :
- `UID` = `<date>T<HHMM>-<filmId>-<slug cinéma>@utopia-calendar` ;
- `DTSTAMP` = la date de la séance à `T000000Z`, déterministe.

**Rationale** : un même UID d'une régénération à l'autre évite les doublons (FR-007). Un `DTSTAMP` fixe garde la sortie identique tant que le site ne change pas (SC-004). Pour un abonnement, les clients remplacent le flux en entier : un événement absent du flux disparaît (US1, scénario 4).
**Alternatives considered** : `DTSTAMP` = l'heure de génération, qui casse SC-004 ; un hash du contenu dans l'UID, qui change à chaque correction de titre et provoque un doublon.

## R6 — Hébergement et régénération

**Decision** : GitHub Actions + GitHub Pages sur `Instelce/utopia-calendar`, avec :
- un workflow `on: schedule` tous les deux jours (`0 5 */2 * *`, 05:00 UTC les jours impairs du mois), `workflow_dispatch` et `push` sur `main` ;
- les étapes : `npm ci` → tests → génération dans `public/` → `actions/upload-pages-artifact` → `actions/deploy-pages`.

Les adresses publiées :
- `https://instelce.github.io/utopia-calendar/manutention.ics`
- `https://instelce.github.io/utopia-calendar/republique.ics`

Elles sont publiées en `webcal://` dans le README, pour l'abonnement en un clic sur Apple et Thunderbird.

**Rationale** :
- FR-008 et FR-009 : l'URL est stable, la régénération automatique et gratuite.
- FR-010 : si la génération échoue, le job s'arrête avant le déploiement et Pages continue de servir le dernier déploiement réussi. GitHub envoie un e-mail en cas d'échec d'un workflow planifié.
- Une exécution tous les deux jours satisfait SC-003 (< 48 h). Les horaires d'une semaine sont publiés d'un bloc, donc régénérer plus souvent n'apporte rien. Avec `*/2` sur le jour du mois, deux exécutions s'enchaînent sur deux jours de suite en fin de mois impair (le 31 puis le 1er), ce qui est sans conséquence. Si GitHub saute une exécution planifiée (cela arrive en cas de charge), l'écart peut atteindre 4 jours ; on corrige avec un lancement manuel (`workflow_dispatch`).
- Rien n'est commité par le bot : pas de pollution de l'historique.

**Alternatives considered** :
- commiter les `.ics` sur une branche `gh-pages`, ce qui ajoute un commit quotidien ;
- Cloudflare Workers / Netlify Functions générant à la demande : un deuxième service à gérer.

**Risque connu** : GitHub désactive les workflows planifiés d'un dépôt public après 60 jours sans activité. Il envoie un e-mail d'avertissement avant, et un clic suffit pour les réactiver. C'est documenté dans le README. SC-006 (4 semaines) n'est pas menacé.

## R7 — Site SvelteKit / Python

**Decision** : ni l'un ni l'autre.
**Rationale** : FR-011 se satisfait avec le README du dépôt (liens d'abonnement). Le seul tooling nécessaire (tests, typecheck) est couvert par Node. Les fichiers `main.py`, `pyproject.toml` et `.python-version` générés par `uv init` deviennent inutiles et peuvent être supprimés, après confirmation de l'utilisateur.
**Alternatives considered** : une page SvelteKit statique avec les boutons « S'abonner » et l'aperçu des séances. C'est un ajout possible plus tard, sur le même déploiement Pages, sans changer les URLs `.ics`.

## R8 — Tests

**Decision** :
- `node --test` (runner natif) sur des fichiers `.test.ts` ;
- une copie figée de la page du 2026-10-23 dans `tests/fixtures/` comme entrée.

Ce qui est vérifié :
- le nombre de séances par cinéma ;
- un titre tronqué → titre complet ;
- la durée → la fin, y compris le passage après minuit ;
- les mentions et VOST ;
- l'échappement et le pliage ICS ;
- le déterminisme (deux générations identiques) ;
- une page sans séance → erreur.

**Rationale** : aucune dépendance de test, et des tests hors ligne et reproductibles.
**Alternatives considered** : Vitest, qui n'apporte rien ici.

## R9 — Détection de panne et d'anomalie

**Decision** :
- 0 séance reconnue, ou une réponse HTTP différente de 2xx, entraîne un code de sortie 1 et un message sur stderr ;
- une séance d'un cinéma inconnu entraîne un avertissement (`::warning::` dans Actions) mais pas d'échec ;
- un cinéma sans séance produit un calendrier vide valide.

Le `fetch` envoie un `User-Agent` identifiant le projet et son URL.
**Rationale** : cela couvre les cas limites de la spec, sans transformer une fermeture de salle en panne.
