# Quickstart: valider les filtres

Projet Vercel : `instelces-projects/utopia-calendar` (`prj_OgRtDcjPstANmGLcF3dpc3qVMVqJ`, team `team_SaPChyiylbjKRH0kd3PxPeV4`). Il a été créé avec la CLI (`vercel link`), car le MCP Vercel n'a pas les droits sur cette équipe (403/404). Les previews sont protégées : pour les tester, utiliser `npx vercel curl <chemin> --deployment <url> --scope instelces-projects`.

Contrats : [filter-syntax.md](./contracts/filter-syntax.md), [calendar-endpoint.md](./contracts/calendar-endpoint.md).

## 1. Hors ligne

```sh
npm ci
npm test
npm run typecheck
```

Attendu :
- tous les tests passent, y compris ceux de la feature 001 ;
- les flux `manutention.ics` et `republique.ics` générés depuis la page figée sont identiques au fichier de référence `tests/fixtures/manutention-2026-10-23.ics` ;
- l'exemple de l'utilisateur appliqué à la page figée garde :
  - toutes les séances du samedi 24 et du dimanche 25 ;
  - les séances du vendredi 23, du lundi 26 et du mardi 27 seulement si elles commencent à 17:00 ou après ;
- chaque cas d'erreur du contrat renvoie 400 avec son message.

## 2. Génération des données

```sh
npm run generate
ls public/                  # manutention.ics  republique.ics  sessions.json
node -e 'console.log(JSON.parse(require("fs").readFileSync("public/sessions.json","utf8")).length)'   # = séances Manutention + République
```

## 3. Fonction en local

```sh
npx vercel dev              # demande de lier le projet utopia-calendar la première fois
curl -s 'http://localhost:3000/?cinema=manutention&regle=jours:lun-ven;heure:17h-&regle=jours:sam,dim' | grep -c BEGIN:VEVENT
curl -si 'http://localhost:3000/?regle=jours:lun-vdr' | head -5     # 400 + message citant « vdr »
```

En local, la fonction lit `sessions.json` en ligne, sur GitHub Pages. Il faut donc que la section 2 ait d'abord été publiée.

## 4. Après déploiement

```sh
U=https://utopia-calendar.vercel.app
curl -sI "$U/?cinema=manutention" | grep -iE '^HTTP|content-type|cache-control'
curl -s "$U/?cinema=manutention" | grep -c BEGIN:VEVENT            # = grep -c BEGIN:VEVENT sur manutention.ics publié
curl -s "$U/?cinema=manutention&regle=jours:lun-ven%3Bheure:17h-" | grep -c BEGIN:VEVENT   # ; encodé : même résultat qu'avec ;
curl -s https://instelce.github.io/utopia-calendar/manutention.ics | md5   # inchangé par rapport à avant la feature
```

## 5. Abonnement (SC-002)

Abonnez-vous sur le téléphone à :

```text
https://utopia-calendar.vercel.app/?cinema=manutention&regle=jours:lun-ven;heure:17h-&regle=jours:sam,dim
```

Attendu : un calendrier « Utopia Manutention » sans aucune séance de semaine avant 17:00. Faire de même dans une deuxième application, par exemple Google Agenda (« À partir de l'URL »).
