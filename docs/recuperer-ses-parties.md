# Récupérer ses parties : choix technique

Décision du 5 octobre 2026. Contexte : la page Progression analyse les parties d'un joueur depuis deadlock-api.com, en direct depuis le navigateur. Problème constaté : après deux heures de jeu, aucune des nouvelles parties de l'utilisateur n'apparaissait.

## Pourquoi les parties manquent

`/v1/players/{id}/match-history` ne renvoie que les parties que l'API a déjà en base. Elle en récupère environ 100 000 par jour (`/v1/info`, `fetched_matches_per_day`), pas toutes, et rien n'indique celles d'un joueur précis. L'historique complet n'est garanti que pour les comptes « amis avec un bot » de l'API, et cette option est réservée aux abonnés Patreon (l'endpoint qui donne les liens d'invitation répond 403 « only available to Patreon subscribers »).

## Options étudiées

| Option | Comment | Automatique | Coût | Retenue |
|---|---|---|---|---|
| Attendre l'API | Rien à faire | Oui, mais au hasard | Gratuit | Non : la plupart des parties d'un débutant n'arrivent jamais |
| Patreon deadlock-api | Compte prioritaire, historique complet | Oui | À partir de 1,50 $/mois par compte | Non : refusé par l'utilisateur, et impossible à imposer aux visiteurs du site |
| Numéro de partie (Match ID) | Le joueur colle le numéro ; `/v1/matches/{id}/metadata` va chercher la partie chez Steam | Non | Gratuit, **3 parties par heure et par adresse IP** | Gardée comme **secours** (champ « Ajouter une partie par son numéro ») |
| Parties en cours `/v1/matches/active` | Repérer la partie du joueur pendant qu'il joue | Oui | Gratuit | Non : ne liste que les 200 meilleures parties du moment |
| **deadlock-api-ingest** | Outil officiel de deadlock-api, sur le PC du joueur | **Oui** | Gratuit | **Oui** |

## La solution retenue : deadlock-api-ingest

Dépôt : https://github.com/deadlock-api/deadlock-api-ingest (licence MIT, organisation deadlock-api). Lu le 5 octobre 2026 : README, `src/main.rs`, `src/gc/auth.rs`, `src/gc/quota.rs`, `install-windows.ps1`.

**Ce qu'il fait**
- Surveille le cache HTTP de Steam (`Steam/appcache/httpcache/`) et y repère les fichiers de replay de Deadlock (`.meta.bz2`, `.dem.bz2`).
- Par défaut, demande aussi au Game Coordinator de Steam les « salts » des parties du joueur, avec la session Steam enregistrée sur le PC.
- Envoie à deadlock-api le numéro de chaque partie et ses salts (la clé qui permet de télécharger ses données). L'API va ensuite chercher la partie, qui apparaît dans `match-history`. La page Progression la voit alors à l'ouverture ou avec « ↻ Actualiser ».

**Mise en place conseillée** (Windows)
1. Installer, sans être administrateur :
   `irm https://raw.githubusercontent.com/deadlock-api/deadlock-api-ingest/master/install-windows.ps1 | iex`
   L'installateur télécharge la dernière version publiée sur GitHub et peut créer une tâche planifiée au démarrage.
2. Une fois, pour récupérer l'historique passé : `deadlock-api-ingest.exe --own-matches`.
3. Pour qu'il ne tourne que pendant le jeu : Steam → clic droit sur Deadlock → Propriétés → Options de lancement :
   `"C:\Users\<nom>\AppData\Local\deadlock-api-ingest\deadlock-api-ingest.exe" -- %command%`
   Il démarre avec le jeu et s'arrête quand on le quitte. Dans ce cas, désactiver la tâche planifiée pour ne pas avoir deux copies.

**Options utiles** : `--no-gc` (ne pas utiliser la session Steam, lire seulement le cache), `--once` (une passe puis quitter), `--own-matches` (récupérer son historique via le Game Coordinator puis quitter).

## Avantages

- Automatique : rien à faire après l'installation, toutes les parties jouées avec l'outil actif sont envoyées.
- Gratuit, et utilisable par n'importe quel joueur du site.
- Outil de l'équipe qui fait l'API : il suit ses changements.
- Rien ne change dans le site : il lit toujours `match-history`, qui contient alors les parties.
- Aide aussi la base publique de l'API (plus de parties de débutants pour tout le monde).

## Inconvénients et risques

- **Accès à la session Steam** : en mode par défaut, l'outil déchiffre localement le jeton de connexion Steam (« se souvenir de moi », chiffré par DPAPI sous Windows). Le code indique qu'il reste en mémoire, n'est ni écrit ni journalisé ni envoyé. C'est tout de même une confiance accordée à un programme tiers : si le dépôt était compromis, une mise à jour pourrait en abuser. Le mode `--no-gc` évite ce risque, au prix de ne récupérer que ce qui passe par le cache.
- **Windows ou Linux seulement**, sur le PC où l'on joue. Rien pour la console ou un autre ordinateur.
- **Plafond** de 40 récupérations par 24 h via le Game Coordinator (`FETCH_QUOTA_LIMIT`), largement assez pour une soirée de jeu.
- **Délai** : entre la fin d'une partie et son arrivée dans `match-history`, l'API doit la télécharger et la traiter. Délai non documenté ; à mesurer.
- **Dépendance** à un service tiers gratuit (deadlock-api.com) : s'il ferme ou change ses règles, la page Progression ne reçoit plus rien.
- **Lancement hors Steam** : l'option de lancement n'agit que si le jeu est lancé depuis Steam.

## Plan de secours

1. **Champ « Ajouter une partie par son numéro »** (page Progression, en place) : marche sans rien installer, 3 parties par heure. Les numéros sont gardés dans le navigateur (`dln.parties.ajoutees.v1`).
2. **`public-ingest`** (https://github.com/deadlock-api/public-ingest) : même principe en ligne de commande pour une liste de numéros de parties. Il demande l'identifiant et le mot de passe Steam : à éviter.
3. **Si deadlock-api disparaît** : le site ne peut plus analyser les parties. Il faudrait lire les replays localement (fichiers `.dem`) avec un analyseur de démos Source 2, ce qui n'est pas prévu aujourd'hui.

## À vérifier

- Après installation : délai réel entre la fin d'une partie et son apparition sur la page Progression.
- En mode `--no-gc` : les parties arrivent-elles sans les ouvrir dans l'historique du jeu ?
