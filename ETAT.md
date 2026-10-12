---
type: etat
projet: DeadLock Noob
depot: DeadLock_Noob
maj: 2026-10-12
---
# DeadLock Noob — état des lieux

## En bref
Site statique (HTML/JS sans compilation) pour apprendre Deadlock et s'aider en partie : chrono et coach sur second écran, fiches héros, parcours débutant, analyse de ses parties.
En ligne : https://crakee.github.io/DeadLock_Noob/ (branche `gh-pages`). Patch en place : Make Your Move (9 octobre 2026 ; équilibrage du 5 octobre, héros Rat King, Baba et Solomon), stats depuis le 7 octobre.
Tout est poussé et publié ; rien n'a encore été essayé en partie réelle.

## Où on en est
| Chantier | État | Bloqué par | Détail |
|---|---|---|---|
| En partie (chrono, coach sans clic, carte, profil du joueur) | 🟡 | essai en partie réelle | `CLAUDE.md` §État, `js/partie.js`, `js/coach.js`, `js/carte-mini.js` |
| Fiches héros (compétences, arme, corps à corps, counters) + Tier list par rang | 🟡 | refonte : tour 2 du juge-slop à passer | `tiers.html`, `js/tiers.js`, `js/heros.js`, `data/armes.json`, `data/armes-conseils.json` |
| Parcours débutant et leçons | 🟢 | — | `js/parcours.js`, `data/parcours.json`, `data/lecons.json` |
| Progression (analyse des parties, coach perso) | 🟡 | parties visibles par l'API (outil d'ingestion) | `docs/recuperer-ses-parties.md`, `js/mes-parties*.js` |
| Timings du chrono | 🟡 | horaires `incertain` à vérifier en jeu (Unstable Rift) | `data/timeline.json`, `collecte/timings-brut.md` |
| Mise à jour de patch | 🟢 | prochain patch | `docs/maj-patch.md` |
| Données en direct pendant la partie | 🔴 | pas de source légère confirmée (Overwolf = gros chantier ; test `-condebug` à faire) | `docs/coach-donnees.md` |
| Quiz « Entraînement » (gamifié, lié aux points faibles) | 🔴 | brief à écrire | compte rendu Obsidian du 2026-10-06 |
| Agent juge (boucle constructeur / juge sur En partie) | 🟡 | premier passage à blanc à analyser avec l'utilisateur | `.claude/agents/juge-partie.md`, `docs/brief-juge.md`, `outils/juge/` |
| Builds importés (numéro, lien ou nom ; suivi par le coach) | 🟢 | à essayer en partie | `js/builds-perso.js`, onglet Builds de la fiche héros |
| Refonte du front (anti « IA slop », fluide, user first) | 🟡 | En partie terminée ; fiche héros au tour 2 sur 3 | `.claude/agents/juge-slop.md`, `outils/juge/pages.mjs` |
| Traduction anglaise | 🟡 | seulement navigation, parcours, leçons | `CLAUDE.md` §Langues |

## Prochaine étape
Fiche héros : passer le tour 2 du juge-slop sur la version publiée le 2026-10-11, corriger, tour 3 (`docs/refonte-front.md`). Essayer En partie en vraie partie. Prochains héros annoncés : Nurse Harrow, Deadman Danny, Violet (mardis et vendredis) : relancer `outils/maj_donnees.py` et ajouter leurs menaces à `data/counters.json` ; leurs rôles ne sont pas classés (`data/roles.json`, avis de Wouks), comme Rat King, Sinclair, Solomon et Baba.

Ensuite : Essayer le site pendant de vraies parties (second écran 1080p et téléphone), puis corriger ce qui gêne : rappels du coach, horaires incertains, lisibilité de la carte.

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
- En partie : aucune action manuelle en jouant à part changer d'onglet (J, A, M) ; ne pas doubler ce que le jeu affiche (compte à rebours de réapparition, souls) (2026-10-11).
- En partie : un seul écran « En jeu » avec la carte ; la compo à part dans « Mort · compo ».
- Pas de voix sur les timings non fixes ; sons doux, pas d'orchestral.
- L'identifiant Steam du joueur reste dans le navigateur, jamais dans le dépôt.
- Pas d'abonnement Patreon deadlock-api ; parties récupérées par deadlock-api-ingest en service (pas l'option de lancement Steam, qui ne lit que le cache).
- Positionnement : apprendre (parcours, coach, leçons), pas un site de stats ; site public multilingue.
- Fiche héros : la liste garde les doublons (héros étiquetés en tête ET dans leur rôle), décision du 2026-10-11.

## Journal
- 2026-10-12 — Coach : bloc « Repères » qui tourne (souls moyennes de ton héros au prochain palier, astuce contre un héros d'en face, réflexe visé sur les points faibles, conseil et rythme de ton héros ; réglages `reperes` de `data/rappels.json`) ; site publié.
- 2026-10-12 — En partie : infobulle au survol de la carte (nom, état, à quoi ça sert, comment s'en servir, d'après `data/map-elements.json`) ; disposition réglable par onglet (poignées entre colonnes et panneaux, `dln.partie.tailles.v1`, double-clic = origine, `js/disposition.js`) ; site publié.
- 2026-10-11 — Profil joueur compilé (Steam public + tous les endpoints joueurs de deadlock-api) dans la note Obsidian « Mon profil joueur » ; ingestion active (dernier envoi le 10/10), aucune partie jouée depuis le 06/10 ; l'historique (58 parties) n'est toujours pas rattrapé (14 dans l'API).
- 2026-10-11 — Refonte tour 3 : sons audibles et distincts, alertes regroupées, grand bloc stable, Attente figée à la mort, estimateur sans verdict avant saisie ; En partie validée par les deux juges ; site publié.
- 2026-10-11 — Refonte tours 1-2 : système commun (7 tailles, icônes SVG), En partie (objectif fixe, carte avec les temps dessus et bouton Retourner, recherche de héros), onglet Attente avec estimateur de souls ; `data/souls.json` à générer (`--seulement souls`, DNS en panne le 2026-10-11).
- 2026-10-11 — Import de builds du jeu (numéro, lien ou nom) suivi par le coach ; juge anti-slop (`juge-slop`) et outil de mesure des pages ; règle : rythme permis pour le pic de puissance.
- 2026-10-11 — Agent juge branché : parties simulées (4 héros × 1080p et téléphone, captures toutes les 10 s, morts, journal des sons), fiche d'écoute, durées de réapparition du wiki dans `data/reapparition.json`.
- 2026-10-11 — Brief de l'agent juge (parcours en partie seconde par seconde, coup d'œil / attente de mort) et liste de ressources UI.
- 2026-10-06 — En partie : coach selon le profil du joueur (zones de mort, points faibles), avant/après la partie, version téléphone.
- 2026-10-06 — Fiches héros : blocs Arme et Corps à corps sous les compétences ; textes passifs ; achats pour les 39 héros ; procédure `docs/maj-patch.md`.
- 2026-10-06 — Progression : profil du joueur, synchro, journaux de l'outil d'ingestion.
- 2026-10-05 — En partie sur un seul écran : coach sans clic, carte avec légende cochable, chrono remis à zéro après 2 h.
- 2026-10-05 — Progression : débrief, ajout de partie par Match ID, outil deadlock-api-ingest choisi.
- 2026-10-11 : patch Make Your Move (données régénérées, stats depuis le 07/10 ; Baba incluse malgré l'API, `SORTIS_MALGRE_API`), menaces de Rat King / Solomon / Baba, page Tier list par rang (winrate + marge), fiche héros refondue (tour 1 du juge-slop + corrections), doublons de la liste gardés à la demande de l'utilisateur.
