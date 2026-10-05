# Coach : ce qu'on a comme données et ce qu'on en fait

Inventaire du 5 octobre 2026 (patch City Never Sleeps). Le but : un site public et multilingue pour **apprendre** Deadlock, centré sur l'aide pendant la partie. Les statistiques servent à dire quoi travailler et à prouver qu'on progresse, pas à faire un site de stats (d'autres le font déjà).

## 1. Les trois sources

### A. Ce qui est dans le dépôt (vérifié, versionné par patch)

| Données | Fichiers | Ce que ça enseigne |
|---|---|---|
| Règles et macro | `memo.json`, `roles.json`, `conseils-roles.json`, `coach.json` | Le savoir des leçons : waves, jungle, objectifs, rôles, priorités |
| Chronologie de la partie | `timeline.json`, `niveaux.json` | Quand faire quoi : camps, Powerups, Urn, Rift, Mid-Boss |
| Carte | `map.json`, `map-elements.json` | Où sont les choses et comment s'en servir |
| Héros et objets | `heroes.json`, `items.json`, `heros-details.json`, `counters.json` | Compétences, distance de pleins dégâts, menaces et objets qui y répondent |
| Habitudes des joueurs par tranche de rang | `achats.json`, `builds.json`, `tempo.json`, `hero-stats.json` | Quoi acheter et à quelle minute, quand chaque héros est fort |
| Leçons | `lecons.json`, `parcours.json`, `textes/<langue>/` | Le parcours, les exercices |

### B. Statistiques publiques de l'API (sans compte joueur)

| Endpoint | Contenu | Utilité pour apprendre |
|---|---|---|
| `kill-death-stats` | Carte des kills et des morts par position, **filtrable sur le pool des nouveaux joueurs**, par minute de jeu, par héros | « Où meurent les débutants entre 0 et 10 min » : zones dangereuses de la carte, sans compte |
| `lane-soul-curve` | Écart de souls à 3, 6 et 9 min selon les héros face à face en lane | Préparer sa lane : « contre ce duo, attends-toi à être en retard, joue prudent » |
| `ability-order-stats` | Ordres de montée des compétences par héros | Leçon « points de compétence » propre à chaque héros. Winrates biaisés (67 % sur Yamato) : ne retenir que la popularité |
| `player-stats/metrics` | Percentiles par héros et par rang (souls/min, morts, précision, dégâts…) | Référence quand le joueur a un rang. **Aucune valeur pour les comptes sans rang** |
| `player-performance-curve` | Souls par source au fil de la partie, par héros et rang | Courbe de référence « tu devrais avoir tant à 10 min » |
| `item-stats`, `item-flow-stats`, `build-item-stats` | Objets achetés, quand, et ce qui suit | Expliquer un build : pourquoi cet objet à ce moment |
| `hero-counter-stats`, `hero-synergy-stats` | Résultats entre héros | À éviter comme argument : signal dans la marge d'erreur (README) |

### C. Données d'un joueur (identifiant Steam, lues depuis son navigateur)

- **Historique** (`match-history`) : héros, résultat, KDA, souls, last hits. L'API ne voit qu'une partie des matchs, sauf si le compte est ami avec un de ses bots.
- **Détail de chaque partie** (`matches/{id}/metadata`, ~1 Mo) :
  - toutes les 3 min : souls par source (dont les orbes), Troopers tués et possibles, denies, dégâts faits et reçus, tirs, headshots, soins ;
  - **chaque seconde, pour les 12 joueurs : position et vie (en %)** ;
  - chaque mort : minute, position, tueur, temps pour mourir ;
  - chaque achat et chaque montée de compétence, à la seconde ;
  - compteurs cachés : **souls et points de compétence non dépensés**, distance des tirs (sortants et entrants), chute de dégâts, précision des ennemis sur soi, parry réussis et ratés ;
  - matrice des dégâts : qui a fait combien à qui, au fil du temps ;
  - bonus ramassés (statues, Powerups), objectifs détruits (minute, équipe), rang MVP du jeu.
- **Stats par héros du joueur** (`players/hero-stats`), adversaires fréquents (`enemy-stats`), rang.

Champs **non utilisés** car non documentés : `combat_type` et `move_type` (par seconde), `stats_type_stat`, identifiants d'accolades.

## 2. Ce que le coach mesure déjà (page Progression)

26 mesures en 7 domaines (`js/mes-parties-lobby.js`), notées face aux 11 autres joueurs de la même partie (même niveau, la seule comparaison juste sans rang) :

| Domaine | Mesures |
|---|---|
| Lane | Troopers à 9 min, orbes récupérées, écart de souls avec la lane adverse, présence en lane, denies |
| Farm | souls/min, souls de jungle/min |
| Survie | morts, temps mort, morts seul, morts en infériorité, morts après avoir engagé sous 50 % de vie, temps sous 30 % de vie |
| Combat | dégâts/min, participation aux kills, dégâts rapportés aux souls |
| Tir | précision, headshots, tirs sans chute de dégâts, précision des ennemis sur soi |
| Objectifs | souls d'objectifs, dégâts aux objectifs, bonus ramassés |
| Achats | premier gros objet, souls non dépensées, points de compétence non dépensés |

Plus la revue de chaque mort (cause la plus probable) et la carte des morts.

## 3. Ce qu'on peut enseigner, selon le joueur

| Joueur | Ce qu'il a | Ce qu'on lui apporte |
|---|---|---|
| **Sans compte** (tout nouveau visiteur) | Le parcours, la page En partie | Leçons validées par lui-même, rappel du focus en partie, chrono, zones dangereuses des débutants (`kill-death-stats`), préparation de sa lane selon les héros (`lane-soul-curve`) |
| **Compte lié** | + le détail des parties que l'API voit | Diagnostic par domaine, leçons conseillées, exercices vérifiés, revue des morts |
| **Compte ami avec un bot** | + l'historique complet | Tendances sur 20 parties ou plus, progression visible dans le temps, consistance |

## 4. Propositions pour le coach

Classées par ce qu'elles apportent pour apprendre, à faire une par une.

1. **Débrief après chaque partie.** À l'ouverture de Progression, la dernière partie en grand : un point réussi, un point à corriger, l'exercice du focus réussi ou non, la mort la plus évitable. C'est le moment où on apprend le plus. Données : déjà là.
2. **Leçons propres au héros.** Pour le héros du focus : ordre de montée des compétences le plus joué, distance de pleins dégâts, minute habituelle des objets clés à ton niveau, ce que ses joueurs font de différent quand ils gagnent. Données : `ability-order-stats`, `achats.json`, `tempo.json`, `heros-details.json`.
3. **Zones dangereuses.** Superposer tes morts à la carte des morts des débutants dans la même minute de jeu : « là où tu meurs, tout le monde meurt, n'y va pas seul ». Marche aussi sans compte. Données : `kill-death-stats` (pool des nouveaux joueurs).
4. **Préparer sa lane.** Dans En partie, quand le joueur indique sa lane et les héros d'en face : l'écart de souls habituel à 3, 6 et 9 min pour ce face-à-face, et la leçon à appliquer. Données : `lane-soul-curve`.
5. **Mini-quiz de décision** (écran de mort) : « deux ennemis disparaissent de la minimap, que fais-tu ? ». Entraîne ce que les données ne voient pas. Données : à écrire, à partir du Mémo.
6. **Personnaliser En partie selon les points faibles** : au-delà du bandeau du focus, rappels placés quand l'erreur se produit dans tes parties (ex. « tu meurs souvent seul vers 12 min » → rappel à 11:30). Données : minutes de tes morts, déjà là.

## 5. Limites à garder en tête

- **Pas de données en direct.** Rien ne lit la partie en cours : la page En partie ne connaît que le chrono et ce que le joueur indique. Le coach agit avant (focus, préparation) et après (débrief).
- **Échantillons petits.** Sur ses propres parties, toujours afficher le nombre de parties ; une tendance sur moins de 5 parties est une piste.
- **La cause d'une mort est déduite** des positions et de la vie, pas vue : la revue dit « cause la plus probable ».
- **Comparaison selon le joueur** : face au lobby pour tous ; aux percentiles de la tranche seulement quand le joueur a un rang ; aux débutants (pool des nouveaux joueurs) seulement pour la carte des morts.
- **Langues** : chaque nouveau texte doit exister au moins en français et en anglais (`data/textes/`).
