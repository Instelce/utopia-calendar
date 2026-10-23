# Feature Specification: Calendriers des séances Utopia Avignon

**Feature Branch**: `001-utopia-calendar-feed`

**Created**: 2026-10-23

**Status**: Draft

**Input**: User description: "Je veux créer un script qui va scrapper ce site https://avignon.cinemas-utopia.org/horaires/ pour récupérer les horaires des films de la semaines. Je veux pouvoir consulter les horaires depuis mon application de calendrier donc j'imagine qu'il faut un fichier ics / ical que j'ouvre dans mon application, mais peut-être qu'il y a mieux. Je veux pouvoir appliquer un filtre sur les films, je ne veux voir que les films du ciména \"Manutention\"."

## Clarifications

### Session 2026-10-23

- Q: Comment le calendrier arrive-t-il dans l'application de calendrier ? → A: Par abonnement à une adresse en ligne, régénérée automatiquement (pas d'import manuel).
- Q: Comment filtrer par cinéma ? → A: Une adresse d'abonnement distincte par cinéma (Manutention, République) ; chaque personne s'abonne à celui ou ceux qu'elle veut.
- Q: Fréquence de régénération ? → A: Tous les deux jours (plus souvent ne sert à rien).
- Q: Adresses des cinémas ? → A: Manutention : 4 Rue des Escaliers Sainte-Anne, 84000 Avignon. République : 5 rue Figuière, 84000 Avignon.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - S'abonner aux séances de Manutention (Priority: P1)

Une personne ajoute l'adresse d'abonnement du cinéma Manutention dans son application de calendrier habituelle. Les séances de la semaine y apparaissent comme événements (titre du film, date, début, fin, lieu), à côté de ses autres rendez-vous. Ensuite, elle n'a plus rien à faire : le calendrier se met à jour tout seul, au fil des semaines.

**Why this priority**: C'est la valeur centrale : ne plus devoir consulter le site pour savoir ce qui passe à Manutention et quand.

**Independent Test**: S'abonner à l'adresse Manutention depuis une application de calendrier standard (Apple Calendar, Google Agenda, Thunderbird…) et vérifier que les séances apparaissent aux bons jours et heures, identiques à celles du site, et qu'aucune séance République n'y figure.

**Acceptance Scenarios**:

1. **Given** la page Horaires liste des séances pour la semaine en cours, **When** la personne s'abonne à l'adresse Manutention, **Then** son calendrier contient un événement par séance de Manutention, avec titre du film, début, fin et adresse du cinéma, et aucune séance de République.
2. **Given** une séance d'un film de 90 mn à 10:30, **When** le calendrier est affiché, **Then** l'événement va de 10:30 à 12:00, heure d'Avignon.
3. **Given** la personne est abonnée depuis une semaine, **When** le site publie les horaires de la semaine suivante, **Then** les nouvelles séances apparaissent sans action de sa part, sans doublon des séances déjà présentes.
4. **Given** une séance est déplacée ou retirée du site, **When** le calendrier publié est régénéré et que l'application se rafraîchit, **Then** l'événement est modifié ou disparaît.

---

### User Story 2 - Choisir son cinéma (Priority: P1)

Chaque cinéma (Manutention, République) a sa propre adresse d'abonnement. Une personne s'abonne à un seul cinéma, ou aux deux (deux calendriers distincts, qu'elle peut afficher ou masquer séparément).

**Why this priority**: Le filtre par cinéma est explicitement demandé, et l'outil sera partagé avec d'autres personnes aux préférences différentes.

**Independent Test**: S'abonner à l'adresse République et vérifier qu'elle ne contient que les séances République, en même nombre que sur le site.

**Acceptance Scenarios**:

1. **Given** la semaine contient des séances dans les deux cinémas, **When** on consulte l'adresse République, **Then** seules les séances République y figurent.
2. **Given** une personne est abonnée aux deux adresses, **When** elle masque le calendrier République dans son application, **Then** seules les séances Manutention restent visibles.
3. **Given** une personne veut s'abonner, **When** elle consulte le dépôt du projet, **Then** elle y trouve les deux adresses d'abonnement et comment les ajouter.

---

### User Story 3 - Informations utiles dans chaque événement (Priority: P3)

En ouvrant un événement, la personne voit les informations affichées sur le site pour la séance : année, durée, pays, version (ex. VOST), mentions particulières (ex. « Avant-première », « Dernière chance », cycle) et un lien vers la page du film.

**Why this priority**: Confort : on choisit sans retourner sur le site. Le calendrier reste utile sans ces informations.

**Independent Test**: Ouvrir un événement et comparer ses détails à la ligne correspondante du site.

**Acceptance Scenarios**:

1. **Given** une séance marquée « VOST » et « Avant-première + réalisateur », **When** la personne ouvre l'événement, **Then** ces mentions figurent dans l'événement.

---

### Edge Cases

- Le site est injoignable ou renvoie une erreur : la régénération échoue de façon visible pour le mainteneur, et les calendriers publiés restent ceux de la dernière régénération réussie (jamais remplacés par des calendriers vides).
- La structure de la page change et aucune séance n'est reconnue : traité comme une erreur (même comportement que ci-dessus), pas comme une semaine vide.
- Un cinéma n'a aucune séance cette semaine alors que l'autre en a (fermeture) : son calendrier est publié vide, c'est un état normal.
- Une séance est attribuée à un cinéma inconnu (nouveau lieu) : elle n'apparaît dans aucun des deux calendriers, et l'anomalie est signalée au mainteneur.
- Titre tronqué sur la page horaires (ex. « Muyi, la légende du village des… ») : utiliser le titre complet s'il est disponible, sinon le titre tronqué.
- Durée absente pour une séance : une durée par défaut s'applique (voir Hypothèses).
- Séance qui finit après minuit : la fin tombe le lendemain.
- Changement d'heure (fin octobre / fin mars) : les heures restent correctes en heure locale d'Avignon.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Le système DOIT récupérer toutes les séances de la semaine affichée par défaut sur https://avignon.cinemas-utopia.org/horaires/.
- **FR-002**: Pour chaque séance, le système DOIT extraire au minimum le titre du film, la date, l'heure de début et le cinéma ; et, quand ils sont présents, la durée, l'année, le pays, la version, les mentions particulières et le lien vers la fiche du film.
- **FR-003**: Le système DOIT produire un calendrier distinct par cinéma : un pour Manutention, un pour République. Chacun ne contient que les séances de son cinéma.
- **FR-004**: Chaque calendrier DOIT être au format standard iCalendar, lisible par les applications de calendrier courantes, et porter un nom explicite (ex. « Utopia Manutention »).
- **FR-005**: Chaque événement DOIT avoir pour titre le nom du film, pour début l'heure de la séance, pour fin le début plus la durée du film, et pour lieu le nom et l'adresse du cinéma.
- **FR-006**: Les heures DOIVENT être exprimées dans le fuseau horaire Europe/Paris.
- **FR-007**: Chaque séance DOIT avoir un identifiant stable d'une régénération à l'autre, pour qu'une mise à jour modifie les événements existants au lieu de les dupliquer.
- **FR-008**: Chaque calendrier DOIT être publié à une adresse d'abonnement publique et stable (qui ne change pas d'une régénération à l'autre), utilisable dans les applications de calendrier courantes.
- **FR-009**: Les calendriers publiés DOIVENT être régénérés automatiquement, sans intervention humaine, au moins tous les deux jours.
- **FR-010**: Si la récupération échoue ou si aucune séance n'est reconnue, le système NE DOIT PAS remplacer les calendriers publiés, et l'échec DOIT être visible pour le mainteneur.
- **FR-011**: Le dépôt du projet DOIT indiquer les adresses d'abonnement de chaque cinéma et comment s'y abonner.
- **FR-012**: Chaque régénération DOIT interroger le site une seule fois par page nécessaire, et pas plus (usage respectueux du site).

### Key Entities

- **Séance** : une projection d'un film à une date et une heure, dans un cinéma. Attributs : film, début, fin, cinéma, version, mentions.
- **Film** : titre, année, durée, pays, lien vers sa fiche.
- **Cinéma** : Manutention (4 Rue des Escaliers Sainte-Anne, 84000 Avignon) ou République (5 rue Figuière, 84000 Avignon).
- **Calendrier publié** : l'ensemble des séances d'un cinéma, disponible à une adresse d'abonnement propre à ce cinéma.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100 % des séances de la semaine affichées sur le site figurent dans le calendrier de leur cinéma, avec la même date et la même heure ; aucune séance n'apparaît dans le calendrier de l'autre cinéma.
- **SC-002**: On peut s'abonner à chaque adresse sans erreur depuis au moins deux applications de calendrier courantes (ex. Apple Calendar et Google Agenda).
- **SC-003**: Une séance ajoutée sur le site apparaît dans le calendrier publié en moins de 48 h.
- **SC-004**: Deux régénérations successives sans changement sur le site produisent des calendriers identiques ; l'application ne montre aucun doublon.
- **SC-005**: Une personne nouvelle s'abonne à un cinéma en moins de 2 minutes en suivant les indications du dépôt.
- **SC-006**: Après l'abonnement initial, aucune action n'est nécessaire pendant au moins 4 semaines consécutives pour voir les séances à jour.

## Assumptions

- « Les films de la semaine » = la semaine affichée par défaut sur la page Horaires ; les semaines suivantes sont hors périmètre pour cette version.
- Le dépôt https://github.com/Instelce/utopia-calendar est public. Il héberge le code, la régénération planifiée et la publication des calendriers, gratuitement.
- Les adresses d'abonnement sont publiques mais ne contiennent aucune donnée personnelle : seulement les horaires publics du site.
- Les deux cinémas connus sont « Manutention » et « République », identifiés par le nom affiché sur le site.
- Si la durée d'un film est absente, la fin de l'événement est fixée au début plus 2 h.
- Le délai de rafraîchissement côté application dépend de chaque application (Google Agenda peut mettre jusqu'à 24 h ou plus) ; il échappe au système.
- Pas de rappels ni d'alarmes sur les événements dans cette version.
- Pas de calendrier « tous cinémas » combiné : s'abonner aux deux adresses produit le même résultat.
- Le site ne propose aucun export calendrier (aucun lien .ics ou webcal trouvé sur la page Horaires au 2026-10-23).
