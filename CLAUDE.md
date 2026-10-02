# DeadLock_Noob

Aide-mémoire Deadlock personnel : chrono de timings pour second écran + fiches héros/objets avec counters. Le cadrage complet (besoin, découpage, sources, décisions, limites de l'API) est dans `README.md` — le lire en premier.

## État

Onglet Timeline construit (`index.html`, `css/style.css`, `js/timeline.js`, sans framework ni compilation) et contrôlé dans Chromium sur les critères du brief ; pas encore essayé en partie réelle. Onglets Héros, Carte, Mémo, Counters, Patch : données prêtes ou en cours (voir « Fichiers de données »), interface à faire. Données de jeu : une collecte brute (`collecte/`) et les événements retenus pour le chrono (`data/timeline.json`). Repo GitHub `crakee/DeadLock_Noob` (public), branche `main` poussée.

Site en ligne : `https://crakee.github.io/DeadLock_Noob/`, servi par GitHub Pages depuis la branche `gh-pages`. Pour publier : `git push origin main:gh-pages` après le push sur `main`.

## Prochaine étape

Timeline : la collecte brute des timings est dans `collecte/timings-brut.md` (2 octobre 2026, patch « City Never Sleeps » du 29 septembre). Les événements retenus sont dans `data/timeline.json`. Le schéma du JSON est décrit dans `docs/brief-front-timeline.md`. Prochaine étape : essai en partie réelle, puis schéma de données Héros / Objets. Restent à lever en jeu les points marqués `incertain` (horaire de l'Unstable Rift surtout).

`collecte/` contient aussi des notes tirées de vidéos (jugement, pas données). `outils/` sert à transcrire une vidéo sur le PC Windows de l'utilisateur (mode d'emploi dans `outils/tuto_transcription.md`).

Pour les valeurs : les pages de deadlock.wiki sont des gabarits, les chiffres sont dans `Data:Convars.json`, `Data:NpcData.json`, `Data:GenericData.json`, `Data:MiscData.json` (lisibles avec `index.php?title=…&action=raw`) et dans `/v1/assets/misc-entities` de l'API.

## Fichiers de données

| Fichier | Contenu | Produit par |
|---|---|---|
| `data/timeline.json` | Événements du chrono | à la main, depuis `collecte/timings-brut.md` |
| `data/niveaux.json` | Niveau (1 à 3) à partir duquel chaque événement du chrono s'affiche, et le rappel « regarde ta map » | à la main |
| `data/heroes.json`, `items.json`, `hero-stats.json`, `map.json` | Héros et compétences, objets, winrates par tranche de rang, carte et ses couches | `python3 outils/maj_donnees.py --patch "…" --depuis AAAA-MM-JJ` |
| `data/map-elements.json` | Fiche de chaque élément de la carte : comment le reconnaître, effet, comment s'en servir | à la main, depuis le wiki |
| `data/memo.json` | Mémo de macro en fiches, dont Gun contre Spirit | à la main, depuis `collecte/` |
| `data/roles.json` | Rôles et héros par rôle (jugement, vidéo de Wouks) | à la main |

**Réglage de niveau unique** (demande de l'utilisateur) : un seul curseur 1 débutant / 2 intermédiaire / 3 avancé filtre la Timeline, le Mémo et les couches de la carte, plutôt qu'une version par rang. Le champ s'appelle `niveau` partout. Le rappel minimap doit pouvoir être désactivé.

Dans `heroes.json` et `items.json`, les étiquettes `mecaniques` et `contre` sont déduites par mots-clés et peu fiables : à relire à la main avant de construire l'onglet Counters. Le champ `video` des héros est vide.

## Règles du projet

- **Données séparées de l'affichage** : valeurs de jeu dans des fichiers JSON versionnés, chacun marqué du patch auquel il a été vérifié. Site statique HTML par-dessus.
- **Aucune valeur de jeu de mémoire.** Le jeu change à chaque patch : toute valeur est vérifiée sur une source courante (notes de patch officielles, page actuelle de deadlock.wiki, API) avant d'entrer dans les données. Les résultats de recherche web renvoient souvent d'anciennes révisions du wiki.
- **Factuel et jugement ne se mélangent pas** : un counter est justifié par une mécanique (ce que fait l'objet ou la compétence), pas par un classement de winrates — le signal statistique des matchups est dans la marge d'erreur (détail dans le README).
- **Statistiques ajustables par rang** : toujours récupérer par tranche de rang et depuis la date du dernier patch.
- Noms de héros, d'objets et de mécaniques en anglais. Échanges avec l'utilisateur en français.

## API

`https://api.deadlock-api.com` — JSON public, sans clé, spec sur `/openapi.json`. Les assets sont sur `/v1/assets/heroes` et `/v1/assets/items` (le sous-domaine `assets.deadlock-api.com` ne se résolvait pas depuis cette machine le 2 octobre 2026).

Identifiants des héros joués par l'utilisateur : Haze 13, Mirage 52, Yamato 27, Lady Geist 4. Il veut aussi essayer Seven 2, Paige 67 et Abrams 6 (un héros par grand rôle ; Haze est trop souvent prise par d'autres).

## Public visé

L'utilisateur débute (environ 20 h de jeu début octobre 2026, nouveau sur les MOBA, pas encore de rang). Par défaut : tranche de rang la plus basse (`initiate_sentinel` dans `data/hero-stats.json`), conseils de base avant les notions avancées, termes de MOBA expliqués.
