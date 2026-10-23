# Utopia Avignon — calendriers des séances

Les horaires des cinémas [Utopia Avignon](https://avignon.cinemas-utopia.org/horaires/), sous forme de calendriers auxquels s'abonner depuis n'importe quelle application de calendrier. Un calendrier par cinéma : abonnez-vous à celui que vous voulez, ou aux deux.

| Cinéma | URL d'abonnement |
|--------|------------------|
| Utopia Manutention — 4 Rue des Escaliers Sainte-Anne | `https://instelce.github.io/utopia-calendar/manutention.ics` |
| Utopia République — 5 rue Figuière | `https://instelce.github.io/utopia-calendar/republique.ics` |

## S'abonner

Copiez l'URL du cinéma, puis :

- **Apple Calendar (Mac)** : *Fichier* → *Nouvel abonnement à un calendrier…*, puis collez l'URL.
- **iPhone / iPad** : *Réglages* → *Calendrier* → *Comptes* → *Ajouter un compte* → *Autre* → *Ajouter un calendrier avec abonnement*, puis collez l'URL.
- **Google Agenda** (sur ordinateur) : dans la colonne de gauche, ouvrez *Autres agendas* → **+** → *À partir de l'URL*, puis collez l'URL. L'agenda apparaît ensuite aussi sur le téléphone.
- **Autres applications** (Thunderbird, Outlook…) : cherchez « s'abonner à un calendrier » ou « ajouter un calendrier par URL ». Si votre application le demande, remplacez `https://` par `webcal://`.

Chaque séance apparaît comme un événement, avec le titre du film, le début et la fin (calculée à partir de la durée du film), l'adresse du cinéma, la version (VOST), les mentions (avant-première, cycle…) et le lien vers la fiche du film.

Les calendriers sont mis à jour tous les deux jours, à partir de la semaine affichée sur le site. Votre application les rafraîchit ensuite à son rythme : Google Agenda peut mettre 24 h ou plus.

## Filtrer les séances

Pour ne recevoir que les séances qui vous conviennent, abonnez-vous à `https://utopia-calendar.vercel.app/` en ajoutant des paramètres à l'adresse.

| Paramètre | Rôle | Exemple |
|-----------|------|---------|
| `cinema` | un ou plusieurs cinémas : `manutention`, `republique` (absent = les deux) | `cinema=manutention` |
| `regle` | une règle de sélection ; peut être répété | `regle=jours:sam,dim` |

Une règle est une suite de conditions `clé:valeur` séparées par `;` :

| Clé | Valeur | Exemples |
|-----|--------|----------|
| `jours` | jours `lun mar mer jeu ven sam dim`, en liste (`,`) ou en plage (`-`) | `jours:lun-ven`, `jours:sam,dim`, `jours:ven-lun` |
| `heure` | plage d'heures de **début** de séance ; le début est inclus, la fin exclue | `heure:17h-`, `heure:-12h`, `heure:14h-18h30` |

**Une séance est gardée si elle respecte au moins une règle ; une règle est respectée si toutes ses conditions le sont.**

Exemples prêts à copier :

| Besoin | Adresse |
|--------|---------|
| Manutention : soirs de semaine dès 17h, week-end entier | `https://utopia-calendar.vercel.app/?cinema=manutention&regle=jours:lun-ven;heure:17h-&regle=jours:sam,dim` |
| Les deux cinémas, week-end seulement | `https://utopia-calendar.vercel.app/?regle=jours:sam,dim` |
| République, dimanche après 14h | `https://utopia-calendar.vercel.app/?cinema=republique&regle=jours:dim;heure:14h-` |
| Matinées (avant midi), tous les jours | `https://utopia-calendar.vercel.app/?regle=heure:-12h` |
| Manutention, toutes les séances | `https://utopia-calendar.vercel.app/?cinema=manutention` |

Une adresse mal écrite est refusée. Ouvrez-la dans un navigateur pour voir le message, qui indique la partie fautive. Les majuscules et les accents sont ignorés (`République` = `republique`).

Les adresses `https://instelce.github.io/utopia-calendar/*.ics` ci-dessus restent valables.

La syntaxe complète est décrite dans [specs/002-calendar-filters/contracts/filter-syntax.md](specs/002-calendar-filters/contracts/filter-syntax.md).

## Maintenance

Prérequis : Node.js ≥ 22.18.

```sh
npm ci
npm test            # tests hors ligne, sur une copie figée de la page (tests/fixtures/)
npm run typecheck
npm run generate    # écrit public/manutention.ics et public/republique.ics à partir du site
```

`npm run generate` sort en erreur (code 1), sans rien écrire, si le site est injoignable ou si aucune séance n'est reconnue (par exemple parce que la structure de la page a changé). Dans ce cas, les calendriers publiés restent ceux du dernier succès.

### Publication

Le workflow [`.github/workflows/publish.yml`](.github/workflows/publish.yml) teste, génère et publie les calendriers sur GitHub Pages. Il s'exécute tous les deux jours à 05:00 UTC, à chaque push sur `main`, et à la demande.

- **Première mise en place** : *Settings* → *Pages* → *Source* = **GitHub Actions**, puis *Actions* → *Publish calendars* → **Run workflow**.
- **Mise à jour immédiate** : *Actions* → *Publish calendars* → **Run workflow**.
- **En cas d'échec** : GitHub envoie un e-mail. Les calendriers en ligne ne sont pas touchés.
- **Après 60 jours sans activité sur le dépôt**, GitHub désactive les workflows planifiés et prévient par e-mail. Pour réactiver : *Actions* → *Publish calendars* → **Enable workflow**.

Ajouter un cinéma : une entrée dans [`src/venues.ts`](src/venues.ts). Le nom doit correspondre exactement à celui affiché sur la page Horaires.

### Calendriers filtrés (Vercel)

Le projet Vercel `utopia-calendar` se déploie automatiquement à chaque push sur `main`. Sa fonction [`api/calendar.ts`](api/calendar.ts) lit `https://instelce.github.io/utopia-calendar/sessions.json`, que le workflow ci-dessus publie à côté des `.ics`, puis applique le filtre de l'adresse. Le site Utopia n'est donc jamais consulté par Vercel. Chaque adresse est mise en cache une heure par le CDN de Vercel.
