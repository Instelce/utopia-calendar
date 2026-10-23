# Quickstart: valider les calendriers Utopia

Voir [contracts/calendar-feed.md](./contracts/calendar-feed.md) pour le format et les URLs, et [data-model.md](./data-model.md) pour les règles de dérivation.

## Prérequis

- Node.js ≥ 22.18 (`node -v`)
- Accès réseau à avignon.cinemas-utopia.org (pour la génération en direct)

## 1. Installer et tester (hors ligne)

```sh
npm ci
npm test          # node --test sur tests/*.test.ts, avec la page figée tests/fixtures/
npm run typecheck # tsc --noEmit
```

Attendu : tous les tests passent. Ils vérifient au minimum :
- le nombre de séances Manutention et République de la page figée ;
- « Muyi, la légende du village des… » → titre complet ;
- 10:30 + 90 mn → `DTEND` 12:00 ;
- une séance tardive qui finit le lendemain ;
- les mentions « Avant-première + réalisateur » et VOST présentes dans `DESCRIPTION` ;
- deux générations identiques octet pour octet ;
- une page sans séance → erreur.

## 2. Générer en direct

```sh
npm run generate
ls public/        # manutention.ics  republique.ics
grep -c BEGIN:VEVENT public/manutention.ics public/republique.ics
```

Attendu : code de sortie 0, et les deux comptes égaux au nombre de séances par cinéma affichées sur https://avignon.cinemas-utopia.org/horaires/ (SC-001). Aucun `LOCATION` République dans `manutention.ics` :

```sh
grep -c 'Figuière' public/manutention.ics   # 0
```

## 3. Déterminisme

```sh
npm run generate && cp public/manutention.ics /tmp/a.ics
npm run generate && cmp /tmp/a.ics public/manutention.ics   # aucune différence (si le site n'a pas changé entre-temps)
```

## 4. Panne

Couper le réseau (ou pointer vers une URL invalide dans un test), puis lancer `npm run generate`. Attendu : code de sortie 1, un message clair, et `public/` inchangé.

## 5. Publication

1. Dans le dépôt GitHub : Settings → Pages → Source = **GitHub Actions**.
2. Actions → workflow « Publish calendars » → **Run workflow**.
3. Une fois le job vert :

```sh
curl -sI https://instelce.github.io/utopia-calendar/manutention.ics | grep -i content-type   # text/calendar
```

## 6. Abonnement (SC-002, SC-005)

- **Apple Calendar** (macOS/iOS) : ouvrir `webcal://instelce.github.io/utopia-calendar/manutention.ics`, puis confirmer.
- **Google Agenda** (web) : Autres agendas → « + » → À partir de l'URL → coller l'URL `https://…/manutention.ics`.

Attendu : un calendrier « Utopia Manutention » avec les séances aux bonnes heures (heure d'Avignon). Faire de même avec `republique.ics` : on obtient un deuxième calendrier, qu'on peut masquer séparément.
