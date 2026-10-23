# Feature Specification: Filtres de séances dans l'adresse d'abonnement

**Feature Branch**: `002-calendar-filters`

**Created**: 2026-10-23

**Status**: Draft

**Input**: User description: "Maintenant, je souhaite améliorer le calendrier en ajoutant des query params optionel pour filtrer les films sur les horaires. Je pense qu'il faudras un serveur node pour permettre de récupérer les query params. Voici ce que je propose : https://instelce.github.io/utopia-calendar?cinema=manutention&... Un script qui gère tous et renvoie le calendrier. Voici un exemple filtre : de lundi à vendredi que les films qui commence à partir de 17h et tous les films le samedi et dimanche. Il faudra définir une syntaxe précise et extensible pour définir les filtres."

## Clarifications

### Session 2026-10-23

- Q: Où héberger le service qui calcule le calendrier filtré ? GitHub Pages ne sert que des fichiers fixes et ignore les paramètres d'une adresse. → A: Vercel (offre gratuite). L'adresse filtrée passe donc sur un domaine `vercel.app`, tandis que les adresses `github.io` existantes restent en place.

## Contexte

Aujourd'hui (feature 001), il existe un calendrier fixe par cinéma, publié sous forme de fichier statique. Une personne qui ne peut aller au cinéma qu'après le travail en semaine reçoit pourtant toutes les séances, y compris celles de 10:30 un mardi.

Cette feature ajoute une adresse d'abonnement **paramétrable**. Les paramètres de l'adresse décrivent quelles séances garder, et le calendrier renvoyé ne contient que celles-là.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - S'abonner à un calendrier filtré par jour et par heure (Priority: P1)

Une personne compose une adresse qui dit : « Manutention ; du lundi au vendredi, seulement les séances à partir de 17h ; le samedi et le dimanche, toutes les séances ». Elle s'abonne à cette adresse dans son application de calendrier. Elle ne voit que les séances compatibles avec ses disponibilités, et le calendrier se met à jour seul comme celui de la feature 001.

**Why this priority**: c'est la demande ; c'est ce qui rend le calendrier vraiment utile au quotidien.

**Independent Test**: s'abonner à l'adresse de l'exemple (voir FR-010), puis vérifier deux choses sur la semaine en cours. D'une part, aucune séance de semaine avant 17:00 n'apparaît. D'autre part, toutes les séances du week-end et toutes les séances de semaine à partir de 17:00 apparaissent, en même nombre que sur le site.

**Acceptance Scenarios**:

1. **Given** l'adresse de l'exemple, **When** l'application récupère le calendrier, **Then** une séance du mardi à 10:30 est absente, une séance du mardi à 17:00 est présente, une du mardi à 20:30 est présente, et une du samedi à 10:30 est présente.
2. **Given** une adresse avec seulement `cinema=manutention`, **When** l'application récupère le calendrier, **Then** il contient exactement les mêmes séances que le calendrier Manutention actuel.
3. **Given** une adresse sans aucun paramètre, **When** l'application récupère le calendrier, **Then** il contient toutes les séances des deux cinémas.

---

### User Story 2 - Des messages d'erreur clairs pour une adresse mal écrite (Priority: P1)

Une personne se trompe en écrivant son filtre (jour inconnu, heure invalide, mot-clé mal orthographié). Elle doit le savoir tout de suite, au moment de s'abonner ou d'ouvrir l'adresse dans un navigateur. Il ne faut pas qu'elle reçoive en silence un calendrier non filtré ou vide.

**Why this priority**: une faute de frappe qui passe inaperçue donnerait un calendrier faux pendant des semaines ; sans retour d'erreur, la syntaxe est inutilisable.

**Independent Test**: ouvrir dans un navigateur une adresse contenant `jours:lun-vdr`. La réponse est un refus, avec un message en français qui désigne la partie fautive (`lun-vdr`) et rappelle les valeurs permises.

**Acceptance Scenarios**:

1. **Given** une adresse avec `regle=jours:lun-vdr`, **When** on l'ouvre, **Then** la demande est refusée avec un message qui nomme `vdr` comme jour inconnu et liste `lun mar mer jeu ven sam dim`.
2. **Given** une adresse avec un mot-clé inconnu `regle=vost:oui` (pas encore pris en charge), **When** on l'ouvre, **Then** la demande est refusée : clé inconnue, avec la liste des clés acceptées.
3. **Given** une adresse avec `cinema=utopia`, **When** on l'ouvre, **Then** la demande est refusée avec la liste des cinémas acceptés.

---

### User Story 3 - Ne pas casser les abonnements existants (Priority: P1)

Les personnes déjà abonnées aux adresses de la feature 001 (`manutention.ics`, `republique.ics`) continuent de recevoir leur calendrier, sans rien changer.

**Why this priority**: l'utilisateur est déjà abonné sur son téléphone ; casser son abonnement serait une régression.

**Independent Test**: après la mise en service, les deux adresses existantes répondent toujours, avec le même contenu qu'avant.

**Acceptance Scenarios**:

1. **Given** un abonnement existant à `manutention.ics`, **When** la feature est mise en service, **Then** l'abonnement continue de se mettre à jour, sans doublon ni disparition de séances.

---

### User Story 4 - Comprendre et composer un filtre (Priority: P2)

Une personne lit la documentation du projet et trouve la syntaxe, des exemples prêts à copier (soirs de semaine, week-end seulement, matinées) et la manière de les combiner.

**Why this priority**: sans documentation, personne d'autre que l'auteur ne pourra s'en servir ; mais le filtre fonctionne sans.

**Independent Test**: une personne qui ne connaît pas le projet compose, en moins de 5 minutes et à partir de la documentation seule, l'adresse « République, uniquement le dimanche après 14h ».

**Acceptance Scenarios**:

1. **Given** la documentation, **When** une personne copie un exemple, **Then** l'adresse fonctionne telle quelle.

---

### Edge Cases

- **Séance après minuit** (ex. « Flush » le dimanche 2026-10-25 à 01:20, pendant la nuit du samedi au dimanche) : le jour retenu pour le filtre est la date affichée par le site (ici dimanche).
- **Bornes horaires** : `heure:17h-` inclut une séance à 17:00 pile ; `heure:-12h` exclut une séance à 12:00 pile (voir FR-006).
- **Plage de jours qui fait le tour de la semaine** (`ven-lun`) : elle désigne vendredi, samedi, dimanche et lundi.
- **Plage horaire vide ou inversée** (`heure:20h-18h`) : erreur, et non une plage qui traverse minuit.
- **Paramètre `cinema` répété ou liste** (`cinema=manutention,republique`) : les deux cinémas sont inclus.
- **Filtre valide mais qui ne retient aucune séance cette semaine** : un calendrier vide valide est renvoyé, ce n'est pas une erreur.
- **Le même filtre écrit dans un ordre différent** (règles ou conditions permutées) : il donne le même calendrier.
- **Majuscules ou accents** (`Lun`, `République`) : acceptés comme leurs équivalents en minuscules sans accent.
- **Adresse encodée par l'application** (`;` → `%3B`, `:` → `%3A`) : elle est interprétée comme sa version non encodée.
- **Site source en panne** : l'adresse filtrée renvoie les dernières séances connues, comme dans la feature 001, et non une erreur ni un calendrier vide.

## Requirements *(mandatory)*

### Syntaxe des filtres

L'adresse accepte deux paramètres, tous deux optionnels :

| Paramètre | Rôle | Valeurs | Absent |
|-----------|------|---------|--------|
| `cinema` | cinémas à inclure | `manutention`, `republique` ; liste séparée par `,` | tous les cinémas |
| `regle` | une règle de sélection ; répétable | voir ci-dessous | toutes les séances |

**Règle** : une liste de **conditions** séparées par `;`. Chaque condition s'écrit `clé:valeur`.

**Combinaison** :
- une séance est gardée si elle satisfait **au moins une** règle (OU entre les règles) ;
- une règle est satisfaite si **toutes** ses conditions le sont (ET entre les conditions) ;
- une clé ne peut apparaître qu'une fois par règle.

**Clés de la version 1** :

| Clé | Valeur | Exemples | Sens |
|-----|--------|----------|------|
| `jours` | liste de jours ou de plages de jours, séparés par `,`. Jours : `lun mar mer jeu ven sam dim`. Plage : `a-b` | `lun-ven`, `sam,dim`, `lun,mer-ven`, `ven-lun` | le jour de la séance est dans l'ensemble |
| `heure` | plage `début-fin` d'heures de début de séance, chaque borne optionnelle (une seule peut manquer). Heure : `17h`, `17h30`, `9h05` | `17h-`, `-12h`, `14h-18h30` | début ≥ `début` (inclus) et début < `fin` (exclu) |

**Exemple de l'utilisateur** : Manutention, du lundi au vendredi à partir de 17h, et le week-end toute la journée.

```text
?cinema=manutention&regle=jours:lun-ven;heure:17h-&regle=jours:sam,dim
```

**Extensibilité** : de nouvelles clés pourront être ajoutées sans modifier la grammaire, par exemple `vost:oui`, `duree:-120`, `film:<texte>`, `mention:avant-premiere`. Une adresse valide aujourd'hui restera valide et gardera le même sens. Une clé inconnue est une erreur, pas une condition ignorée. Ainsi, une adresse écrite pour une version future n'est jamais servie en silence avec un filtre incomplet.

### Functional Requirements

- **FR-001**: Le système DOIT servir, à une adresse d'abonnement unique, un calendrier dont le contenu dépend des paramètres `cinema` et `regle` décrits ci-dessus.
- **FR-002**: Sans paramètre, le calendrier DOIT contenir toutes les séances de tous les cinémas. Avec seulement `cinema`, il DOIT contenir toutes les séances des cinémas demandés.
- **FR-003**: Le système DOIT appliquer exactement la sémantique de combinaison décrite : OU entre les règles, ET entre les conditions d'une règle.
- **FR-004**: La clé `jours` DOIT accepter les noms `lun mar mer jeu ven sam dim`, les listes (`,`) et les plages (`a-b`), y compris les plages qui font le tour de la semaine.
- **FR-005**: Le jour d'une séance DOIT être celui de sa date sur le site, y compris pour les séances après minuit.
- **FR-006**: La clé `heure` DOIT filtrer sur l'heure de **début** de la séance, en heure d'Avignon, avec une borne de début incluse et une borne de fin exclue.
- **FR-007**: Le système DOIT refuser toute adresse invalide : clé inconnue, valeur invalide, clé répétée dans une règle, plage horaire vide ou inversée, cinéma inconnu, règle vide. Le refus DOIT porter un message en français qui désigne l'élément fautif et rappelle les valeurs acceptées. Le système NE DOIT PAS renvoyer de calendrier dans ce cas.
- **FR-008**: L'interprétation DOIT ignorer la casse et les accents, et l'ordre des règles et des conditions DOIT être sans effet sur le résultat.
- **FR-009**: Les événements renvoyés DOIVENT être identiques (même identifiant, mêmes informations) à ceux du calendrier non filtré. Changer de filtre ne crée donc jamais de doublon.
- **FR-010**: La documentation du projet DOIT décrire la syntaxe et contenir au moins quatre exemples prêts à copier, dont l'exemple de l'utilisateur ci-dessus.
- **FR-011**: Les adresses existantes `manutention.ics` et `republique.ics` DOIVENT continuer de fonctionner avec le même contenu.
- **FR-012**: Les séances servies DOIVENT avoir été lues sur le site il y a moins de 48 h, comme dans la feature 001. Le nombre de consultations du site source NE DOIT PAS dépendre du nombre d'abonnés ni de demandes (au plus une consultation par période de mise à jour).
- **FR-013**: Si le site source est indisponible, le système DOIT continuer de servir les dernières séances connues.
- **FR-014**: Le nom du calendrier affiché dans l'application DOIT indiquer le ou les cinémas concernés, par exemple « Utopia Manutention », ou « Utopia Avignon » pour les deux cinémas.
- **FR-015**: L'adresse paramétrable DOIT être hébergée sur Vercel, avec l'offre gratuite. Elle aura la forme `https://<projet>.vercel.app/?cinema=…&regle=…`, et le nom définitif sera fixé au premier déploiement. Elle DOIT être déployée automatiquement à chaque mise à jour du dépôt `Instelce/utopia-calendar`.

### Key Entities

- **Filtre** : l'ensemble des paramètres d'une adresse, c'est-à-dire des cinémas et des règles.
- **Règle** : une conjonction de conditions. Le filtre retient l'union de ses règles.
- **Condition** : une paire `clé:valeur`. La version 1 a deux clés, `jours` et `heure`.
- **Séance**, **Cinéma** : inchangés par rapport à la feature 001.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Pour l'adresse de l'exemple, sur la semaine en cours, 100 % des séances qui remplissent les conditions figurent dans le calendrier, et 0 % des autres.
- **SC-002**: Un abonnement à une adresse filtrée fonctionne dans au moins deux applications de calendrier courantes, dont celle du téléphone de l'utilisateur.
- **SC-003**: Pour une adresse invalide, 100 % des cas d'erreur listés en FR-007 renvoient un message qui nomme l'élément fautif.
- **SC-004**: Une personne qui découvre le projet compose une adresse filtrée valide en moins de 5 minutes, à partir de la documentation seule.
- **SC-005**: Le calendrier filtré arrive en moins de 3 secondes, dans 95 % des cas.
- **SC-006**: Les abonnements existants (feature 001) ne subissent aucune interruption lors de la mise en service.

## Assumptions

- Les jours et les heures suffisent pour la version 1. Les autres critères (VOST, durée, titre, mentions) sont prévus par la syntaxe, mais hors périmètre.
- Les noms de paramètres et de clés sont en français, comme le site et le public visé.
- Aucun outil de composition d'adresse (formulaire, page web) n'est prévu dans cette version ; la documentation suffit.
- Il n'y a pas de compte ni d'authentification : les adresses sont publiques, comme les horaires.
- Un filtre avec plusieurs cinémas renvoie un seul calendrier. Pour des calendriers séparés par cinéma, on prend une adresse par cinéma.
- La fréquence de mise à jour des données reste celle de la feature 001 : tous les deux jours.
- Le service reste gratuit ou quasi gratuit à faire fonctionner, pour un petit nombre d'abonnés.
