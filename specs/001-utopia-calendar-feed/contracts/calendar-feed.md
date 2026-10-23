# Contract: flux d'abonnement iCalendar

Interface publique du projet : ce que les abonnés et leurs applications de calendrier consomment.

## URLs (stables, FR-008)

| Cinéma | HTTPS | Abonnement |
|--------|-------|------------|
| Manutention | `https://instelce.github.io/utopia-calendar/manutention.ics` | `webcal://instelce.github.io/utopia-calendar/manutention.ics` |
| République | `https://instelce.github.io/utopia-calendar/republique.ics` | `webcal://instelce.github.io/utopia-calendar/republique.ics` |

Ces chemins ne changent pas tant que le projet existe. Ajouter un cinéma, c'est ajouter un nouveau `<slug>.ics` ; les URLs existantes ne sont jamais renommées.

## Réponse

- `200`, `Content-Type: text/calendar` (déduit de l'extension par GitHub Pages).
- Encodage UTF-8, fins de ligne CRLF, lignes pliées à 75 octets (RFC 5545).

## Structure

```text
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//utopia-calendar//FR
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:Utopia Manutention
X-WR-TIMEZONE:Europe/Paris
REFRESH-INTERVAL;VALUE=DURATION:P1D
X-PUBLISHED-TTL:P1D
BEGIN:VTIMEZONE            ← Europe/Paris, règles CET/CEST statiques
...
END:VTIMEZONE
BEGIN:VEVENT               ← 0..n, triés par début puis titre
UID:2026-10-23T1030-local_5075-manutention@utopia-calendar
DTSTAMP:20261023T000000Z
DTSTART;TZID=Europe/Paris:20261023T103000
DTEND;TZID=Europe/Paris:20261023T120000
SUMMARY:Le Corset
LOCATION:Utopia Manutention\, 4 Rue des Escaliers Sainte-Anne\, 84000 Avignon
DESCRIPTION:2026 · 90 mn · France\nhttps://avignon.cinemas-utopia.org/film?id=local_5075
URL:https://avignon.cinemas-utopia.org/film?id=local_5075
END:VEVENT
END:VCALENDAR
```

## Garanties

1. **Filtrage** : un flux ne contient que les séances de son cinéma (FR-003).
2. **UID stable** : la même séance (date, heure, film, cinéma) garde le même `UID` d'une régénération à l'autre (FR-007).
3. **Déterminisme** : à page source identique, le fichier est identique octet pour octet (SC-004).
4. **Fraîcheur** : régénéré au moins tous les deux jours (FR-009). Le flux couvre la semaine affichée par le site ; les séances passées en sortent.
5. **Panne** : en cas d'échec, le dernier flux valide reste servi ; il n'est jamais vidé par une panne (FR-010).
6. **Flux vide** : un calendrier sans `VEVENT` est un état valide (cinéma fermé).

## Commande de génération (contrat interne)

`npm run generate` :
- lit la page Horaires en direct ;
- écrit `public/manutention.ics` et `public/republique.ics` ;
- code de sortie `0` en cas de succès ; `1` si la page est injoignable, si la réponse HTTP n'est pas 2xx, ou si aucune séance n'est reconnue (aucun fichier n'est écrit dans ces cas) ;
- avertissements (cinéma inconnu, séance rejetée) sur stderr, préfixés `::warning::` pour les annotations GitHub Actions.
