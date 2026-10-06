# Mettre le site à jour après un patch

Procédure pour une session dédiée à un nouveau patch. Rédigée le 2026-10-06 (patch en place : City Never Sleeps, 29 septembre 2026).
Règle du projet : **aucune valeur de jeu de mémoire**. Tout chiffre qui entre dans les données est relu sur une source courante (notes de patch, API, wiki à jour).

## 0. Repérer le patch

- API : `https://api.deadlock-api.com/v2/patches` (date et lien des notes).
- Notes officielles : forum Deadlock (forums.playdeadlock.com), sinon `https://deadlock.wiki/Changelog`.
- Noter le **nom** et la **date** (AAAA-MM-JJ, UTC) : ils servent à toutes les commandes ci-dessous.

Attendre un ou deux jours avant de régénérer les statistiques : le script écarte la journée du patch, et il faut assez de parties pour que les tranches de rang aient du sens.

## 1. Régénérer ce qui est automatique

```bash
python3 outils/maj_donnees.py --patch "Nom du patch (AAAA-MM-JJ)" --depuis AAAA-MM-JJ
```

Sans `--seulement`, tout est régénéré. Pour un seul fichier : `--seulement heroes,items,stats,map,details,armes,achats,tempo,builds` (séparés par des virgules).

| Fichier | Contenu | Source | Coût mesuré |
|---|---|---|---|
| `heroes.json` | Héros, compétences (textes FR et EN, passifs compris) | API `/v1/assets` | quelques secondes |
| `items.json` | Objets | API | quelques secondes |
| `hero-stats.json` | Winrates par tranche | API analytics | — |
| `map.json` | Carte et couches | API | quelques secondes |
| `heros-details.json` | Stats de base, matchups | API | — |
| `armes.json` | Arme de base de chaque héros | wiki `Data:HeroData.json` + API | quelques secondes |
| `achats.json` | Objets achetés (≥ 20 %) et minute moyenne, **tous les héros**, 4 tranches | API `/v1/analytics/item-stats` | 156 appels, environ 25 s, 860 Ko (43 Ko compressé en ligne) le 2026-10-06 |
| `tempo.json` | Winrate selon la durée, objets clés | API | — |
| `builds.json` | 3 builds publics par héros | API | — |

« — » : durée pas encore mesurée ; la noter ici après le prochain passage complet.

### À surveiller pendant l'exécution

- `à vérifier : …` (armes) : écart entre le wiki et l'API, ou DPS recalculé différent de celui du jeu. Comprendre l'écart avant de garder le fichier (cas déjà vus : plombs comptés une fois chez Drifter, cadence qui monte chez McGinnis et Victor).
- `arme absente du wiki : …` : nouveau héros pas encore dans `Data:HeroData.json`.
- **Date de révision du wiki** : elle est écrite dans `armes.json` (`meta.source`). Si elle est **antérieure au patch**, le wiki n'est pas encore à jour : remettre `--seulement armes` à plus tard.
- Le wiki bloque `?action=raw` (Cloudflare) : le script passe par `api.php` avec un User-Agent de navigateur. Si ça casse, voir `page_wiki_json` dans le script.

## 2. Relire les diffs des fichiers générés

```bash
git diff --stat data/
```

- `heroes.json` : un nouveau héros ? une compétence renommée ? Les étiquettes `mecaniques` sont déduites par mots-clés : relire celles qui changent.
- `armes.json` : comparer quelques héros aux notes de patch (dégâts, chargeur, cadence).
- `achats.json` / `builds.json` : rien à relire valeur par valeur, mais vérifier que chaque héros a des données.

## 3. Corrections écrites dans le script (à revérifier à chaque patch)

Dans `outils/maj_donnees.py` :

- `SANS_CRIT = {"Graves", "Paige"}` : héros sans dégâts critiques à la tête (wiki, page *Weapon Damage*, section *Crit Multiplier*). Relire la liste.
- `NOMS_ARMES_WIKI = {"Rem": "Long Night"}` : arme que l'API ne connaît pas. Vérifier si l'API l'a ajoutée.
- `UNITES_PAR_METRE = 39.37` : conversion des unités du moteur (recoupée avec le wiki).
- Position du Mid-Boss (absente de l'API) : centre de la carte, d'après le wiki.

## 4. Fichiers écrits à la main qui contiennent des valeurs de jeu

Chercher dans les notes de patch tout ce qui touche ces sujets, puis corriger le fichier et sa date `verifie_le` / `patch`.

| Fichier | Valeurs à revoir |
|---|---|
| `data/timeline.json` | Horaires des camps, Powerups, Soul Urn, Sinner's Sacrifice, Mid-Boss, Rift, phases (source : `collecte/timings-brut.md`, à refaire) |
| `data/niveaux.json` | Si un événement est ajouté ou retiré du chrono |
| `data/patch.json` | Résumé du nouveau patch, changements des héros du profil |
| `data/armes-conseils.json` | Notes des 7 héros joués (ex. Fixation 40 stacks, Djinn's Mark 2,75 s et 4 marques, rechargement d'Abrams 0,7 s puis 0,35 s par cartouche) ; section `melee` : règles du corps à corps (parade 2,75 s et +25 %, recharge du coup lourd 1 s / 1,3 s), compétences de mêlée par héros, liste des objets de mêlée |
| `data/counters.json` | Explications des objets cités, menaces par héros (une compétence modifiée peut changer la menace) |
| `data/map-elements.json` | Effets des éléments de la carte (soins, caisses, urne…) |
| `data/memo.json` | Valeurs citées dans le mémo |
| `data/textes/fr/lecons.json` (et `en`) | Valeurs citées dans les leçons |
| `data/coach.json`, `data/conseils-roles.json`, `data/roles.json`, `data/rappels.json` | Jugement : à relire seulement si un objectif ou une mécanique change |

Pour repérer les chiffres d'un fichier : `grep -nE "[0-9]+([.,][0-9]+)? ?(s|%|m|souls|PV)\b" data/memo.json`.

## 5. Valeurs écrites dans le code

- `js/heros.js` : `multCrit` = 1,65 + bonus du héros (tir à la tête) ; `dash = 10` (dash au sol, en mètres) ; texte « ×1,65 pour tous ».
- `js/partie.js` : texte « un dash au sol fait 10 m et un dash en l'air 8 m ».
- `js/counters.js` : repère « un dash au sol fait 10 m ».

Si le patch touche le dash ou les tirs à la tête, corriger ces lignes (ou les faire lire `heros-details.json`, qui contient `dash_sol_m` et `dash_air_m`).

## 6. Contrôler puis publier

1. `python3 -m http.server` puis ouvrir chaque espace : En partie (chrono lancé), une fiche héros par onglet, Parties, Patch. Console du navigateur sans erreur.
2. Fiches héros : passer sur les 39 héros, onglet Compétences (blocs Arme et Corps à corps sans « undefined », « NaN » ni case vide).
3. Monter `VERSION` dans `sw.js` (le site installé garde sinon d'anciens fichiers en cache hors ligne).
4. Mettre à jour le nom du patch dans `CLAUDE.md` (section *Prochaine étape*) et dans ce fichier.
5. Commit, puis `git push origin main` et `git push origin main:gh-pages`.
