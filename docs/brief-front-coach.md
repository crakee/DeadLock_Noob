# Brief front : le coach et l'onglet En partie

6 octobre 2026. Pour la session qui travaille l'affichage (page En partie, coach). Une autre session s'occupe de la **connexion et de la récupération des données** (outil deadlock-api-ingest, page Progression, calcul des mesures) : ce document dit ce qu'elle fournit, quand, sous quelle forme, et ce que l'affichage pourrait en faire. Références : `docs/coach-donnees.md` (inventaire complet), `docs/recuperer-ses-parties.md` (choix technique de la récupération).

Positionnement : site public et multilingue pour **apprendre** Deadlock, centré sur l'aide pendant la partie. Les données servent à dire quoi travailler et à prouver qu'on progresse.

## 1. Ce qu'on sait, et quand on le sait

**Rien en direct.** Aucune source ne lit la partie en cours. Pendant la partie, la page En partie ne connaît que le chrono, ce que le joueur a réglé (héros, lane, équipe, adversaires) et ce que les parties **précédentes** ont appris de lui.

**Délai d'arrivée d'une partie**, une fois jouée :

| Situation du joueur | Arrivée dans l'API |
|---|---|
| Outil deadlock-api-ingest en service | Dans les 30 min après la fermeture du jeu, plus le traitement de l'API (délai exact à mesurer) |
| Sans outil | Peut-être jamais (l'API ne récupère qu'une partie des matchs, au hasard) |
| Numéro collé à la main (Progression) | Tout de suite si Steam répond, 3 par heure |

**Les parties Street Brawl** (`game_mode` 4, sans waves) sont listées à part et **exclues** de toutes les mesures, du coach et du débrief.

## 2. Ce qui est déjà disponible dans le navigateur

Écrit par la page Progression (`js/mes-parties.js`), via `js/coach-etat.js` :

| Clé | Contenu |
|---|---|
| `dln.moi.v1` | Identifiant du compte (jamais dans le dépôt) |
| `dln.coach.v1` | `focus` (id de leçon), `depuis` (le focus ne compte que les parties après), `acquises` [ids], `recommandees` [3 ids, du plus utile au moins utile], `suivi` { id: { serie, cible } }, `maj` |
| `dln.coach.focus.v1` | Copie courte du focus : `titre`, `rappel`, `phase` (lane, milieu, fin, toujours), `exercice` |
| `dln.parties.ajoutees.v1` | Numéros de parties ajoutés à la main, par compte |

Lu par En partie aujourd'hui : `dln.coach.focus.v1` (bandeau), `dln.coach.v1` (`focus` + `recommandees` → difficultés rappelées), `dln.coach.difficultes.v1` (choix manuel, écrit par En partie), cadence dans `data/rappels.json`.

**Mesures par partie** (`DLN.lobby.analyser`, `js/mes-parties-lobby.js`) : 26 mesures en 7 domaines (Lane, Farm, Survie, Combat, Tir, Objectifs, Achats), chacune notée de 0 à 1 face aux 11 autres joueurs de la partie, plus la revue de chaque mort : minute, position, tueur, temps d'attente, et indicateurs `inferiorite`, `isole`, `engage_bas` (+ `vie_debut`), `cote_adverse`, `surpris`, `allies`, `ennemis`. Noms des mesures et des domaines en `{fr, en}`.

## 3. Profil et état de synchro (en place depuis le 6 octobre 2026)

Écrits par la page Progression à chaque chargement (`js/mes-parties.js`, section « profil, état de synchro »). En partie n'a qu'à les lire.

**`dln.coach.profil.v1`** : le profil du joueur sur ses 10 dernières parties normales (exemple réel du 6 octobre).
```json
{
  "maj": 1791240080, "parties": 10,
  "domaines": { "lane": 0.55, "farm": 0.51, "survie": 0.48, "combat": 0.47, "tir": 0.63, "objectifs": 0.4, "build": 0.36 },
  "faibles": ["points_dormants", "souls_dormantes", "creeps_9"],
  "forts": ["denies_9", "orbes"],
  "scores": { "points_dormants": 0.08, "souls_dormantes": 0.27, "…": "toutes les mesures, de la pire à la meilleure" },
  "tranche_s": 180,
  "morts_par_tranche": [1, 1, 2, 6, 8, 7, 11, 9, 10, 5, 3, 3, 2, 3, 2, 0, 0, 1, 2, 1, 0, 1],
  "morts_par_partie": 7.8,
  "morts_types": { "inferiorite": 0.37, "isole": 0.45, "engage_bas": 0.15, "cote_adverse": 0.31, "surpris": 0.05 },
  "parties_longues": { "seuil_min": 35, "parties": 3, "engage_bas_apres": 1.67 },
  "heros": [ { "id": 27, "parties": 7 }, { "id": 4, "parties": 1 } ]
}
```
- `domaines` et `scores` : de 0 (le pire de la partie) à 1 (le meilleur), moyenne sur les parties.
- `faibles` : jusqu'à 3 mesures sous 0,4 ; `forts` : jusqu'à 2 mesures au-dessus de 0,6.
- `morts_par_tranche` : **total** des morts sur les `parties` parties, par tranche de `tranche_s` secondes (indice 0 = 0:00–3:00). Dans l'exemple, le pic est entre 18:00 et 27:00.
- `morts_types` : part des morts (0 à 1) de chaque type ; une mort peut en avoir plusieurs.
- `parties_longues.engage_bas_apres` : morts par partie longue après avoir engagé sous 50 % de vie, passé `seuil_min`.

**`dln.parties.sync.v1`** : l'état de la récupération.
```json
{ "verifie_a": 1791240078, "nb_parties": 12, "derniere_partie": { "match_id": 111573219, "mode": "street_brawl", "fin": 1791236954 } }
```
`derniere_partie` compte aussi le Street Brawl (`mode`). Mis à jour au chargement de Progression et à chaque vérification.

**Vérification automatique** : tant que la page Progression est ouverte (et visible), elle interroge `match-history` toutes les 5 min et au retour sur l'onglet ; une nouvelle partie relance l'analyse et met à jour profil, débrief et coach (message « nouvelle partie arrivée »). En partie peut s'en servir : « ouvre Progression, ton débrief arrivera tout seul ».

## 4. Propositions pour l'onglet En partie

Contraintes connues : second écran 1080p **sans défilement**, **coach sans clic** pendant la partie (choix de l'utilisateur), sons doux, textes en `{fr, en}` ou dans `data/textes/<langue>/`, jugement marqué « conseil ».

**Avant la partie (écran de chargement)**
- Le focus du jour et son exercice, en une ligne.
- « Ta dernière partie » : le point à corriger et la mort la plus évitable (déjà calculés par le débrief), avec un lien vers la page Progression.
- Préparer sa lane : quand le joueur a indiqué sa lane et les héros d'en face, l'écart de souls habituel à 3, 6 et 9 min pour ce face-à-face (`/v1/analytics/lane-soul-curve`, à récupérer côté données) et la leçon à appliquer.

**Pendant la partie**
- Rappels placés **aux minutes où le joueur meurt d'habitude** (`morts_par_tranche`), avec le type de mort le plus fréquent : « tu meurs souvent seul vers 12 min : reste près de ton équipe ».
- Cadence adaptée aux points faibles : si `points_dormants` ou `souls_dormantes` est faible, rappel plus fréquent « point de compétence ? souls à dépenser ? ».
- Parties longues : si `parties_longues.engage_bas_apres` est élevé, rappel après 35 min « vie basse = pas de combat ».
- Les points forts ne déclenchent aucun rappel (moins de bruit).

**À la mort (onglet Mort · compo)**
- Une question courte ou une leçon de 20 secondes liée au point faible (les mini-quiz de `docs/coach-donnees.md`, à écrire).

**Après la partie**
- Un geste « partie finie » (fin du chrono) qui annonce : « débrief disponible dans quelques minutes ». La page Progression peut vérifier toute seule l'arrivée de la partie (interrogation de `match-history` toutes les 5 min pendant 45 min, côté données) et afficher le débrief dès qu'elle est là.

## 5. Répartition proposée

| Données (connexion, récupération, calcul) | Front (affichage) |
|---|---|
| Outil d'ingestion, `dln.parties.sync.v1`, vérification automatique de l'arrivée des parties (faits) | Messages « partie pas encore arrivée », « débrief prêt » |
| `dln.coach.profil.v1` après chaque analyse (fait) | Rappels placés selon le profil, bandeau avant partie |
| Récupération de `lane-soul-curve` | Bloc « préparer sa lane » |
| Mesures, revue des morts, exercices | Leur présentation, les quiz |

## 6. Questions ouvertes

- Le profil doit-il couvrir tous les héros ou seulement celui choisi en haut de la page En partie ?
- Les rappels selon les minutes de mort : utile dès 5 parties, ou attendre 10 parties ?
- Faut-il un geste « partie finie », ou déduire la fin du chrono arrêté ?
