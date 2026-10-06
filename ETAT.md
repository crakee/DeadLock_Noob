---
type: etat
projet: DeadLock Noob
depot: DeadLock_Noob
maj: 2026-10-06
---
# DeadLock Noob — état des lieux

## En bref
Site statique (HTML/JS sans compilation) pour apprendre Deadlock et s'aider en partie : chrono et coach sur second écran, fiches héros, parcours débutant, analyse de ses parties.
En ligne : https://crakee.github.io/DeadLock_Noob/ (branche `gh-pages`). Patch en place : City Never Sleeps (29 septembre 2026).
Tout est poussé et publié ; rien n'a encore été essayé en partie réelle.

## Où on en est
| Chantier | État | Bloqué par | Détail |
|---|---|---|---|
| En partie (chrono, coach sans clic, carte, profil du joueur) | 🟡 | essai en partie réelle | `CLAUDE.md` §État, `js/partie.js`, `js/coach.js`, `js/carte-mini.js` |
| Fiches héros (compétences, arme, corps à corps, counters) | 🟢 | — | `js/heros.js`, `data/armes.json`, `data/armes-conseils.json` |
| Parcours débutant et leçons | 🟢 | — | `js/parcours.js`, `data/parcours.json`, `data/lecons.json` |
| Progression (analyse des parties, coach perso) | 🟡 | parties visibles par l'API (outil d'ingestion) | `docs/recuperer-ses-parties.md`, `js/mes-parties*.js` |
| Timings du chrono | 🟡 | horaires `incertain` à vérifier en jeu (Unstable Rift) | `data/timeline.json`, `collecte/timings-brut.md` |
| Mise à jour de patch | 🟢 | prochain patch | `docs/maj-patch.md` |
| Données en direct pendant la partie | 🔴 | pas de source légère confirmée (Overwolf = gros chantier ; test `-condebug` à faire) | `docs/coach-donnees.md` |
| Quiz « Entraînement » (gamifié, lié aux points faibles) | 🔴 | brief à écrire | compte rendu Obsidian du 2026-10-06 |
| Traduction anglaise | 🟡 | seulement navigation, parcours, leçons | `CLAUDE.md` §Langues |

## Prochaine étape
Essayer le site pendant de vraies parties (second écran 1080p et téléphone), puis corriger ce qui gêne : rappels du coach, horaires incertains, lisibilité de la carte.

## Carte du dépôt
- Vue d'ensemble, règles, fichiers de données : lire `CLAUDE.md`, puis `README.md` pour le cadrage.
- Régénérer les données de jeu : `outils/maj_donnees.py` ; procédure complète de patch : `docs/maj-patch.md`.
- Valeurs du jeu : sources et accès au wiki (API MediaWiki, Cloudflare) dans `CLAUDE.md` §Prochaine étape.
- Coach En partie : `js/coach.js` + `data/coach.json`, `data/rappels.json` ; brief : `docs/brief-front-coach.md`.
- Chrono : `js/timeline.js`, schéma `docs/brief-front-timeline.md`.
- Carte : `js/carte-mini.js` (En partie), `js/carte.js` (page Carte), `data/map.json`, `data/map-elements.json`.
- Fiches héros : `js/heros.js` ; arme et mêlée : `data/armes.json` (généré), `data/armes-conseils.json` (jugement).
- Inventaire des données et propositions pour le coach : `docs/coach-donnees.md`.
- Progression et récupération des parties : `js/mes-parties.js`, `js/mes-parties-lobby.js`, `docs/recuperer-ses-parties.md`.
- Sons et voix : `js/sons.js`, `js/voix.js`, `docs/brief-voix-sons.md`, `docs/kit-audio-alertes.md`.
- Publier : `git push origin main` puis `git push origin main:gh-pages`.

## À ne pas reproposer
- Pas de framework ni d'étape de compilation : site statique.
- Aucune valeur de jeu de mémoire : toujours une source courante (API, wiki à jour, notes de patch).
- Pas de counter justifié par un winrate : seulement par une mécanique.
- Un seul réglage de niveau (1 à 3) pour tout le site, pas une version par rang.
- Coach sans boutons d'état à cliquer en jouant (retirés le 2026-10-05).
- En partie : un seul écran « En jeu » avec la carte ; la compo à part dans « Mort · compo ».
- Pas de voix sur les timings non fixes ; sons doux, pas d'orchestral.
- L'identifiant Steam du joueur reste dans le navigateur, jamais dans le dépôt.
- Pas d'abonnement Patreon deadlock-api ; parties récupérées par deadlock-api-ingest en service (pas l'option de lancement Steam, qui ne lit que le cache).
- Positionnement : apprendre (parcours, coach, leçons), pas un site de stats ; site public multilingue.

## Journal
- 2026-10-06 — En partie : coach selon le profil du joueur (zones de mort, points faibles), avant/après la partie, version téléphone.
- 2026-10-06 — Fiches héros : blocs Arme et Corps à corps sous les compétences ; textes passifs ; achats pour les 39 héros ; procédure `docs/maj-patch.md`.
- 2026-10-06 — Progression : profil du joueur, synchro, journaux de l'outil d'ingestion.
- 2026-10-05 — En partie sur un seul écran : coach sans clic, carte avec légende cochable, chrono remis à zéro après 2 h.
- 2026-10-05 — Progression : débrief, ajout de partie par Match ID, outil deadlock-api-ingest choisi.
