# DeadLock_Noob

Aide-mémoire Deadlock personnel : chrono de timings pour second écran + fiches héros/objets avec counters. Le cadrage complet (besoin, découpage, sources, décisions, limites de l'API) est dans `README.md` — le lire en premier.

## État

Phase de cadrage terminée, aucun code. Seule donnée de jeu : une collecte brute non triée (voir ci-dessous). Repo GitHub `crakee/DeadLock_Noob`, encore vide côté distant (rien n'a été commité).

## Prochaine étape

Timeline : la collecte brute des timings est dans `collecte/timings-brut.md` (2 octobre 2026, patch « City Never Sleeps » du 29 septembre). Les événements retenus sont dans `data/timeline.json`. Prochaine étape : construire l'onglet Timeline en suivant `docs/brief-front-timeline.md`. Restent à lever en jeu les points marqués `incertain` (horaire de l'Unstable Rift surtout).

`collecte/` contient aussi des notes tirées de vidéos (jugement, pas données). `outils/` sert à transcrire une vidéo sur le PC Windows de l'utilisateur (mode d'emploi dans `outils/README.md`).

Pour les valeurs : les pages de deadlock.wiki sont des gabarits, les chiffres sont dans `Data:Convars.json`, `Data:NpcData.json`, `Data:GenericData.json`, `Data:MiscData.json` (lisibles avec `index.php?title=…&action=raw`) et dans `/v1/assets/misc-entities` de l'API.

## Règles du projet

- **Données séparées de l'affichage** : valeurs de jeu dans des fichiers JSON versionnés, chacun marqué du patch auquel il a été vérifié. Site statique HTML par-dessus.
- **Aucune valeur de jeu de mémoire.** Le jeu change à chaque patch : toute valeur est vérifiée sur une source courante (notes de patch officielles, page actuelle de deadlock.wiki, API) avant d'entrer dans les données. Les résultats de recherche web renvoient souvent d'anciennes révisions du wiki.
- **Factuel et jugement ne se mélangent pas** : un counter est justifié par une mécanique (ce que fait l'objet ou la compétence), pas par un classement de winrates — le signal statistique des matchups est dans la marge d'erreur (détail dans le README).
- **Statistiques ajustables par rang** : toujours récupérer par tranche de rang et depuis la date du dernier patch.
- Noms de héros, d'objets et de mécaniques en anglais. Échanges avec l'utilisateur en français.

## API

`https://api.deadlock-api.com` — JSON public, sans clé, spec sur `/openapi.json`. Les assets sont sur `/v1/assets/heroes` et `/v1/assets/items` (le sous-domaine `assets.deadlock-api.com` ne se résolvait pas depuis cette machine le 2 octobre 2026).

Identifiants des héros joués par l'utilisateur : Haze 13, Mirage 52, Yamato 27, Lady Geist 4.
