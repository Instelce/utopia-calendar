# Contract: syntaxe des filtres

C'est l'interface publique de la feature : tout ce qu'une personne peut écrire après `?` dans l'adresse.

## Grammaire

```ebnf
requête    = [ param { "&" param } ] ;
param      = "cinema=" cinémas | "regle=" règle ;      (* autres paramètres : erreur *)
cinémas    = slug { "," slug } ;
slug       = "manutention" | "republique" ;
règle      = condition { ";" condition } ;
condition  = "jours:" jours | "heure:" plage ;         (* clés de la version 1 *)
jours      = élément { "," élément } ;
élément    = jour [ "-" jour ] ;
jour       = "lun" | "mar" | "mer" | "jeu" | "ven" | "sam" | "dim" ;
plage      = heure "-" [ heure ] | "-" heure ;
heure      = h [ mm ] ;                                 (* ex. 9h, 17h, 17h30, 9h05 *)
h          = 1*2 DIGIT "h" ;                            (* 0–23 *)
mm         = 2 DIGIT ;                                  (* 00–59 *)
```

Avant analyse :
- les valeurs sont décodées (`%3B` → `;`, `%3A` → `:`, `%2C` → `,`) ;
- elles sont mises en minuscules et débarrassées de leurs accents (`République` → `republique`, `Lun` → `lun`) ;
- les espaces en début et en fin de valeur sont ignorés.

## Sémantique

- `cinema` peut être répété ou donné en liste ; les cinémas sont réunis. S'il est absent, tous les cinémas sont inclus.
- `regle` peut être répété. Une séance est retenue si **au moins une** règle la retient. Sans aucune `regle`, toutes les séances des cinémas choisis sont retenues.
- Une règle retient une séance si **toutes** ses conditions sont vraies.
- `jours:a-b` désigne les jours de `a` à `b` inclus, dans l'ordre lun→dim. La plage fait le tour de la semaine si `b` vient avant `a` : `ven-lun` = ven, sam, dim, lun.
- `heure:x-y` : la séance commence entre `x` (inclus) et `y` (exclu), en heure d'Avignon. `x-` signifie « à partir de x », `-y` « avant y ».
- Le jour d'une séance est la date affichée par le site, même après minuit.
- L'ordre des paramètres, des règles et des conditions est sans effet.

## Erreurs (HTTP 400, `text/plain; charset=utf-8`)

Chaque message cite le fragment fautif. Il n'y a qu'une erreur par réponse : la première trouvée.

| Cas | Exemple | Message (forme) |
|-----|---------|-----------------|
| paramètre inconnu | `?cinemas=manutention` | `Paramètre inconnu « cinemas ». Paramètres acceptés : cinema, regle.` |
| cinéma inconnu | `cinema=utopia` | `Cinéma inconnu « utopia ». Cinémas acceptés : manutention, republique.` |
| règle vide | `regle=` | `Règle vide. Exemple : regle=jours:lun-ven;heure:17h-` |
| condition sans `:` | `regle=lun-ven` | `Condition « lun-ven » invalide : attendu clé:valeur (ex. jours:lun-ven).` |
| clé inconnue | `regle=vost:oui` | `Clé inconnue « vost ». Clés acceptées : jours, heure.` |
| clé répétée | `regle=jours:lun;jours:mar` | `Clé « jours » répétée dans la règle « jours:lun;jours:mar ».` |
| jour inconnu | `jours:lun-vdr` | `Jour inconnu « vdr » dans « lun-vdr ». Jours acceptés : lun mar mer jeu ven sam dim.` |
| heure invalide | `heure:25h-` | `Heure invalide « 25h ». Format : 17h, 17h30 (0h à 23h59).` |
| plage horaire vide | `heure:-` | `Plage horaire vide « - ». Exemples : 17h-, -12h, 14h-18h30.` |
| plage horaire inversée | `heure:20h-18h` | `Plage horaire « 20h-18h » vide : le début doit précéder la fin.` |

## Exemples (repris dans le README)

| Besoin | Adresse (après `https://utopia-calendar.vercel.app/`) |
|--------|--------------------------------------------------------|
| Exemple de l'utilisateur : Manutention, soirs de semaine dès 17h, week-end entier | `?cinema=manutention&regle=jours:lun-ven;heure:17h-&regle=jours:sam,dim` |
| Les deux cinémas, week-end seulement | `?regle=jours:sam,dim` |
| République, dimanche après 14h | `?cinema=republique&regle=jours:dim;heure:14h-` |
| Matinées (avant midi), tous les jours | `?regle=heure:-12h` |
| Manutention, tout (même contenu que `manutention.ics`) | `?cinema=manutention` |

## Extensibilité

Ajouter une clé (par exemple `vost:oui`, `duree:-120`, `film:texte`, `mention:avant-premiere`) ne demande que deux choses :
1. une nouvelle entrée dans la table des clés ;
2. sa documentation ici.

La grammaire ne change pas. Une adresse valide le reste, avec le même sens. Les noms `cinema` et `regle` et les clés existantes ne seront jamais renommés.
