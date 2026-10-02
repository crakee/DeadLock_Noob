# DeadLock_Noob

Aide-mémoire personnel pour progresser sur Deadlock (Valve) : les timings de la partie à suivre sur un second écran, et les infos à retenir sur les héros et les objets (counters, faiblesses).

> **Statut : cadrage.** Rien n'est implémenté. Ce document sert à décider ensemble du découpage, des sources et de l'architecture avant d'écrire du contenu ou du code.

## Besoin

1. **Timings de partie** — savoir ce qui se passe à quel moment : ouverture des camps de jungle par tier, apparition des bonus et objectifs, vagues de creeps, boost des ziplines, etc. Pour chaque événement : quand, et dans quelles conditions y aller.
2. **Infos à retenir** — quel objet contre quel héros ou quelle mécanique, forces et faiblesses de chaque héros.
3. **Outil simple** — choisir son héros et voir ses counters, ses faiblesses, les objets à acheter contre tel adversaire.
4. **Tenir dans le temps** — le jeu est en développement, les valeurs changent à chaque patch. Le contenu doit pouvoir être mis à jour sans tout réécrire.

## Principe directeur : séparer les données de l'affichage

Les valeurs du jeu (timings, stats, counters) vivent dans des fichiers de données versionnés, chacun marqué du patch auquel il a été vérifié. Les pages (HTML ou autre) sont générées ou alimentées à partir de ces fichiers. Un patch = on modifie les données, pas la mise en page.

## Découpage proposé

| Bloc | Contenu | Usage | Fréquence de changement |
|---|---|---|---|
| **Timeline** | Événements datés de la partie + condition pour y aller | Second écran, pendant la partie | Moyenne (gros patchs) |
| **Héros** | Rôle, forces, faiblesses, counters, bons/mauvais matchups | Avant la partie / au draft | Élevée |
| **Objets** | Effet en une ligne, ce qu'il contre, quand l'acheter | Pendant la partie (boutique) | Élevée |
| **Concepts** | Règles stables : lanes, souls, parry, objectifs, macro | Lecture hors partie | Faible |

Deux natures d'information à ne pas mélanger :

- **Factuel** (timings, stats, effets d'objets) : vérifiable, tiré des sources primaires, automatisable.
- **Jugement** (« X contre Y », faiblesses) : avis de la communauté ou statistiques de winrate. À sourcer et à dater, jamais présenté comme un fait.

## Sources

Aucune valeur de jeu n'est encore inscrite dans ce repo. Sources candidates, à valider :

| Source | Type | Fiabilité attendue | Usage |
|---|---|---|---|
| [Forum officiel / notes de patch Steam](https://forums.playdeadlock.com/) | Primaire (Valve) | Référence | Détecter et lire les changements |
| [deadlock.wiki](https://deadlock.wiki/) ([Changelog](https://deadlock.wiki/Changelog)) | Wiki communautaire | Bonne, mais pages parfois en retard sur le patch | Timings, mécaniques, fiches héros/objets |
| [deadlock-api.com](https://deadlock-api.com) ([GitHub](https://github.com/deadlock-api)) | API ouverte (assets + stats de matchs) | Données extraites du jeu et des matchs | Stats héros/objets, winrates, matchups ; base d'une éventuelle automatisation |
| [tracklock.gg](https://tracklock.gg/), [mobalytics.gg](https://mobalytics.gg/deadlock) | Sites de stats / guides | Secondaire | Recoupement, builds, résumés de patch |

Règles :

- Une valeur factuelle n'entre dans les données que recoupée avec la source primaire ou l'API, avec le patch de vérification noté.
- Les pages de wiki trouvées par moteur de recherche sont souvent d'anciennes révisions : toujours vérifier sur la page courante.
- Rythme des patchs : irrégulier depuis janvier 2025 (plus de cycle fixe de deux semaines). Dernier patch repéré lors du cadrage : 16 septembre 2026.

## Décisions

1. **Second écran** — chrono interactif lancé en début de partie, qui annonce les événements à venir.
2. **Forme de l'outil** — site statique : HTML + données JSON, ouvrable en local ou hébergé sur GitHub Pages.
3. **Counters** — basés sur les statistiques de l'API (voir ci-dessous), complétés par des notes manuelles pour le « pourquoi ».
4. **Périmètre initial** — la timeline d'abord, puis les héros joués : Haze, Mirage, Yamato, Lady Geist.
5. **Langue** — noms de héros, d'objets et de mécaniques en anglais, comme en jeu et dans les sources. Langue du reste du contenu : à confirmer.
6. **Rang** — les statistiques sont ajustables selon le rang de la personne : l'outil propose un sélecteur de tranche de rang, et les données sont récupérées par tranche (`min_average_badge` / `max_average_badge`).

## Ce que l'API permet (vérifié le 2 octobre 2026)

Pas de scraping nécessaire : `api.deadlock-api.com` expose des endpoints JSON publics, sans clé, sous licence MIT, avec une spécification OpenAPI (`/openapi.json`).

| Endpoint | Ce qu'on en tire |
|---|---|
| `/v1/assets/heroes` | Liste des héros, stats de base, images |
| `/v1/analytics/hero-stats` | Winrate et stats moyennes par héros |
| `/v1/analytics/hero-counter-stats` | Winrate héros contre héros (option `same_lane_filter`) |
| `/v1/analytics/lane-matchup-stats` | Résultat des duels de lane à un instant donné |
| `/v1/analytics/item-stats` | Winrate par objet, filtrable par héros joué et par héros adverse (`enemy_hero_ids`) |
| `/v1/analytics/hero-synergy-stats` | Winrate des paires de héros alliés |

Tous acceptent des filtres de rang (`min_average_badge`) et de période (`min_unix_timestamp`, 30 derniers jours par défaut).

Limites constatées :

- **Le counter héros contre héros pèse peu.** Sur les 30 derniers jours, tous rangs, l'écart de winrate d'un matchup une fois corrigé de la force des deux héros dépasse rarement ±1,5 point, pour une marge d'erreur d'environ ±0,7 à ±1,3 point. Un classement « pires adversaires » tiré de ce seul chiffre serait en grande partie du bruit.
- **Le filtre « même lane » ne change rien** : testé depuis le patch du 16 septembre, les écarts restent de l'ordre de ±1,5 point.
- **Les objets contre un héros précis ne ressortent pas non plus** : testé sur Lady Geist contre Abrams, aucun objet ne se détache au-delà de la marge d'erreur (±1,3 à ±2,3 points). Un seul couple testé.
- **Ce qui est solide** : le winrate global d'un héros, le winrate et le moment d'achat des objets sur un héros donné (échantillons de plusieurs milliers à plus de cent mille parties).
- **Conséquence** : les statistiques servent à dire « quoi construire sur mon héros » et « quel héros est fort en ce moment ». Les counters, eux, doivent venir des mécaniques (ce que fait l'objet ou la compétence, lu dans `/v1/assets/items` et `/v1/assets/heroes`), pas d'un classement de winrates.
- **Corrélation, pas causalité** : un objet à fort winrate peut simplement être acheté par ceux qui gagnent déjà.
- **Période** : la fenêtre par défaut peut chevaucher un patch ; filtrer à partir de la date du dernier patch.
- **Rang** : les statistiques tous rangs ne reflètent pas forcément le niveau auquel on joue.

## Questions ouvertes

1. **Automatisation** — quelles données récupérer par script et à quelle fréquence : à déterminer une fois la première version en place.
2. **Tranches de rang** — quel découpage proposer, sachant que plus la tranche est étroite, plus l'échantillon est petit et la marge d'erreur grande.
3. **Langue du contenu** — français ou anglais pour les textes hors noms propres du jeu.

## Étapes envisagées

1. ~~Valider les sources et le découpage.~~
2. ~~Tester les endpoints de lane et d'objets pour savoir quels signaux sont exploitables.~~
3. Timeline : collecter et vérifier les timings, première version consultable.
4. Héros et objets : schéma de données, puis remplissage.
5. Outil de sélection de héros.
6. Procédure de mise à jour par patch (manuelle ou automatisée).
