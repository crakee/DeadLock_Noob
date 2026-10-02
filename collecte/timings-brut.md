# Timings — collecte brute

Matière première pour la timeline, **non triée**. Rien ici n'est encore une donnée validée du projet : le tri et le passage en JSON viennent après.

- **Collecté le** : 2 octobre 2026
- **Patch en cours** : « City Never Sleeps », 29 septembre 2026 (+ correctif du 30 septembre, uniquement interface et son). Le README mentionnait le 16 septembre comme dernier patch : c'est dépassé.
- **Notes officielles du 29/09** : aucun changement chiffré de timing publié. Le patch refond la carte et les neutres (renommés *Haunts*) et ajoute des éléments, mais sans changelog de valeurs. Les chiffres ci-dessous viennent donc des fichiers du jeu, pas des notes.

## Sources et niveau de confiance

| Repère | Source | Fraîcheur |
|---|---|---|
| **[D]** | Donnée extraite des fichiers du jeu : `Data:Convars.json`, `Data:NpcData.json`, `Data:GenericData.json` de deadlock.wiki (synchronisés par bot) et `api.deadlock-api.com/v1/assets/{misc-entities,npc-units,generic-data}` | Convars 01/10, NpcData 01/10, GenericData 30/09, **MiscData 29/09 (build d'avant le correctif)** |
| **[W]** | Texte rédigé à la main sur deadlock.wiki (page courante, lue en `action=raw`) | Date de dernière révision indiquée par page |
| **[?]** | Sources contradictoires ou interprétation de ma part | À vérifier en jeu |

Les valeurs [D] recoupées entre le wiki et l'API concordent (camps, powerups, breakables, objectifs, rejuv).

## Vue chronologique

| Temps | Événement | Source |
|---|---|---|
| 0:00 | Mid-Boss présent dès le début (délai initial 0) | [D] |
| 0:00 | Teleporters utilisables (2 paires) | [W] |
| 0:00 | Guardians à 50 % de résistance, Walkers à 65 % | [W] |
| ~0:16 | Première vague de Troopers (`citadel_trooper_spawn_initial 16`) | [?] |
| 2:00 | Small camps | [D] |
| 2:30 ou 3:00 | Soul Well de la base commence à émettre | [?] |
| 3:00 | Crates et Buff Containers (cas général) | [D] |
| 5:00 | Medium camps | [D] |
| 5:00 | Powerups sur les ponts, puis toutes les 5 min | [D] |
| 5:00 | Crates / Buff Containers des tunnels | [D] |
| 5:00 | Les vagues passent de 3 Ranged + 1 Medic à 2 Ranged + 1 Melee + 1 Medic | [W] |
| 5:00 | Début de la courbe de respawn (8 s) | [D] |
| 6:00 | Zipline Speed Boost disponible | [W] |
| 8:00 | Large camps | [D] |
| 8:00 | Sinner's Sacrifice | [D] |
| 8:00 | Fin des règles de laning ; revenu passif des deux joueurs les plus pauvres | [D] |
| 10:00 | Soul Urn (ramassable à 10:12,5) | [D] |
| 10:00 | Buff Containers niveau 2 | [D] |
| 10:00 | Crates / Buff Containers de la salle au-dessus du Mid-Boss | [D] |
| 10:00 | Pénalité de respawn sur les joueurs riches | [D] |
| 10:00–12:00 | Premier Unstable Rift (effet visuel) | [?] |
| 12:00 | Guardians à −50 % (plancher) | [W] |
| 18:00 | Walkers à −65 % (plancher) | [W] |
| 20:00 | Vagues toutes les 25 s ; le Patron commence à gagner des PV | [D] |
| 30:00 | Buff Containers niveau 3 | [D] |
| ~30:00 | The Broker (±2 min) — voir réserve plus bas | [D] |
| 35:00 | Vagues toutes les 20 s ; Troopers +50 % PV | [D] / [W] |
| 40:00 | Powerups à leur valeur maximale | [D] |

## Haunts (camps de jungle)

Les neutres s'appellent *Haunts* depuis le 29/09 (« Denizens » reste dans le rapport de dégâts).

| Tier | Icône minimap | Apparition | Réapparition | PV | Souls / unité | Bullet resist | Spirit resist |
|---|---|---|---|---|---|---|---|
| Small | triangle | 2:00 | 1:25 | 129 | 41 | 50 % | 45 % |
| Medium | triangle + 1 trait | 5:00 | 4:50 | 322 | 68 | 50 % | 45 % |
| Large | triangle + 2 traits | 8:00 | 5:35 | 1133 | 181 | 60 % | 55 % |

Tout le tableau est [D].

- Le chrono de réapparition démarre **quand le dernier Haunt du camp meurt** [W] : ce sont des délais relatifs, pas des horaires fixes.
- Souls : +1,08 % de la valeur de base par minute, compté depuis le début de la partie [D]. PV +2,1 %/min, dégâts +0,5 %/min [D].
- Pas d'orbe : les souls vont à tous ceux qui ont infligé des dégâts, à parts égales. Ce sont des **Haunted Souls** (perdues à la mort) [W].
- Un small camp contient 3 small Haunts ; les medium ont 6 compositions possibles ; 6 camps de la carte ont 3 large Haunts [W].
- Tirer dans l'œil = dégât critique [W].
- Nombre de camps : la page Haunts ne le donne pas ; la page de la carte donne 4 small / 22 medium / 12 large dans un tableau et 6 / 26 / 8 dans les légendes d'images, sur une section marquée obsolète [?].
- Certains medium camps contiennent des Sinner's Sacrifice : il faut tout nettoyer (Haunts **et** machines) pour lancer le chrono [W].
- `neutral_camp_bug` : apparition 2:00, intervalle 2:00 [D] — les cafards des tunnels (1 soul chacun), anecdotique.

## Sinner's Sacrifice

- Apparition **8:00**, réapparition **5:00** après destruction (ou après nettoyage complet du camp hybride) [D].
- 15 machines sur 11 emplacements : 6 seules, 2 camps « 1 machine + 2 medium Haunts », 2 camps « 2 machines + 1 medium Haunt », 1 emplacement à 3 machines (clocher de Chinatown) [W, 01/10].
- 500 PV, mêlée uniquement : light = 50, heavy = 100 [W]. Riposte 80 dégâts par coup [D], soit 320 (tout en heavy) à 640 (tout en light).
- **Jackpot** : après 400 dégâts, les ampoules s'allument de gauche à droite ; frapper quand elles sont toutes allumées. Heavy = **4 buffs permanents**, light = 1, raté = seulement les souls. Pas de riposte pendant cette phase [W].
- Depuis le 29/09, le rythme du jackpot est variable (notes officielles).
- Souls : 310 au départ (155 × 2), +1,08 %/min [D]. Moitié distribuée au fil des coups, moitié au coup final. Haunted Souls.
- Sonner la cloche du clocher (casser un breakable là-haut) s'entend sur toute la carte ; ping minimap ajouté le 30/09.

## Mid-Boss et Rejuvenator

- Présent dès 0:00, sous terre au centre, accès par Blue lane [D/W].
- **Réapparition : 7 min après la 1ʳᵉ mort** [D], puis 6 min après la 2ᵉ, puis 5 min ensuite [W uniquement]. Chrono visible sur la minimap, exact avec Tab.
- 13 000 PV + 195/min ; régénération 15 PV/s ; bullet resist 15 % [D].
- Bouclier régénérant : absorbe 35 dégâts/s + 5 par minute de partie [D]. Il faut dépasser ce seuil pour entamer les PV.
- N'est vulnérable que depuis l'intérieur de la fosse ; rugit à 50 % de PV (les deux équipes l'entendent) [W].
- Récompense : 3000 souls + 50/min pour l'équipe [D], 2 buffs permanents par joueur [W].
- **Rejuvenator** : le cristal descend en 6 s [D], puis heavy melee pour le prendre — 1 crédit par coup, 3 max, **volable par l'équipe adverse**. Le premier à frapper est soigné à 100 % [W].
- Crédit : réapparition sur place après 3 s à 100 % PV [D], un seul crédit consommé par joueur. Durée du buff 180 s, alerte à 30 s de la fin [D].
- `RejuvParams` contient aussi `TrooperHealthMult [1.7, 2, 2.3]` et `PlayerRespawnMult [0.5, 0.4, 0.3]` [D] ; le wiki actuel n'en parle pas — restes d'une ancienne version ou effets non documentés [?].

## Soul Urn

- **Première apparition 10:00, puis toutes les 5 min** [D]. Descente 12,5 s avant de pouvoir la prendre [D].
- Apparaît près du pont, en alternance Yellow / Green ; **la première toujours côté Yellow** [W]. Dépôt de l'autre côté de la carte.
- Se ramasse avec une mêlée (light ou heavy) [W].
- Récompense : **250 + 70 souls par minute de jeu**, figée à l'apparition [D] (soit 950 à 10:00). Plus **4 buffs permanents** pour le porteur [D]. Les souls sortent en orbes et peuvent être **déniées**.
- Anti-blocage : 45 s après la prise, la valeur fond pendant 45 s jusqu'à zéro [D].
- Si elle est portée au moment du cycle suivant, l'apparition suivante est repoussée [W].
- Non ramassée après 3 min : elle marche seule vers le dépôt [D : 180 s].
- Porteur : +2 m/s, +1 Stamina, 100 % Slow Resistance ; **ni Zipline ni Teleporter** ; lâche l'urne sur mêlée ennemie ou stun [W].
- **Mirage : Traveler fait lâcher l'urne** [W].
- Équipe en retard : bonus de souls, et résistances pour le porteur (max 10 % + 1 %/min, plafond 40 %, plein effet à 15 % d'écart de net worth) [D].

## Unstable Rift

Objectif récent (séparé de l'urne le 30 juin 2026). Capture de zone sur le pont d'une side lane.

- Récompense : 1260 + 222 souls/min, la valeur ne montant qu'à partir de 13 min [D/W] ; distribuée à parts égales à toute l'équipe.
- Capture en 12 s ; 6 s pour l'équipe en retard, 18 s pour celle en avance (au maximum d'écart) [D]. Rayon 20 m. Ne se valide que s'il ne reste qu'une équipe dans la zone ; les joueurs dedans sont révélés sur la minimap.
- Contesté 50 s : avertissement ; 60 s : match nul, souls relâchées en 13 orbes pour qui les prend [D].
- Vainqueur : **Rift Troopers** dans cette lane (5 minimum, jusqu'à 14 si l'équipe était en retard) : +100 % PV et dégâts au premier Rift, +20 % par Rift suivant jusqu'à +160 % ; 25 % Melee Resist ; 30 → 45 % Spirit Resist [D].
- Lane : Green ou Yellow, alterne en général mais pas toujours [W].

**Horaire — sources en désaccord [?]** :

- Convars [D] : `citadel_koth_spawn_initial_delay 720` (12:00), `citadel_koth_respawn_interval 420` (7 min), `citadel_koth_spawn_window 60`, `citadel_koth_early_warning_time 60`, `citadel_koth_warning_time 20`.
- Page Unstable Rift [W, 28/09] : effet visuel à 11:00 ± 1 min, annonce 60 s plus tard, ouverture 20 s après ; suivants 7 ± 1 min après le précédent (s'appuie sur un rapport de bug du forum).
- Page de la carte [W, section marquée obsolète] : 40 s au lieu de 60 s entre l'effet et l'annonce.
- Lecture qui concilie convars et page Rift : annonce nominale à 12:00 ± 1 min, effet visuel 60 s avant, ouverture 20 s après — donc **ouverture entre 11:20 et 13:20**. C'est une déduction, à chronométrer en jeu.

## Powerups (ponts)

- **5:00 puis toutes les 5 min**, aux deux emplacements en même temps (ponts près des points d'urne) [D].
- **Heavy melee** pour prendre [W]. Durée **160 s** [D]. Perdu à la mort.
- Un powerup non pris est remplacé au cycle suivant (expire à 300 s) [D].
- À 5:00 le tirage est aléatoire ; à 10:00 ce sont forcément les 2 autres types [W].
- Valeurs croissantes de 5 à 40 min [D] :

| Type | À 5 min | À 40 min |
|---|---|---|
| Gun | +12 % Fire Rate, +35 % Ammo | +35 %, +70 % |
| Casting | +15 Spirit Power, +12 % Cooldown Reduction | +65, +20 % |
| Movement | +2 Stamina, +1,5 m/s Sprint, +20 % Stamina Regen, +40 % Zipline Speed | +4, +4 m/s, +50 %, +80 % |
| Survival | +200 Health, +4 Health Regen | +750, +40 |

## Crates et Buff Containers

| Emplacement | Apparition | Réapparition |
|---|---|---|
| Cas général | 3:00 | 3:00 après avoir été cassé |
| Tunnels | 5:00 | 5:00 (allongé au patch du 16/09) |
| Salle au-dessus du Mid-Boss | 10:00 | 3:00 |
| 4ᵉ profil non identifié | 5:00 | 3:00 |

Tableau [D] (`BreakableSpawnTimeDesc`) ; l'attribution des lignes aux emplacements vient du wiki.

- **Crates** : 60 % de chance de lâcher des souls [D] ; montant 23 + 2 × minutes [W]. Haunted Souls. Le montant croît dès 0:00 même si les caisses n'apparaissent qu'à 3:00. 518 caisses sur la carte [W].
- **Tough Crates** (nouveau, 29/09) : bleu-vert, bords métalliques, heavy melee obligatoire.
- **Buff Containers** (ex-Golden Statues) : 50 % de chance de lâcher un buff permanent [D].
- Ne pas ramasser ce qui tombe retarde la réapparition [W].
- **Healing Snacks** et **Steam Vents** (invisibilité + régénération en restant dessus) ajoutés le 29/09 : pas de timing connu.

Buffs permanents par niveau [D] — niveau 1 dès 0:00, **niveau 2 à 10:00, niveau 3 à 30:00** :

| Stat | Niv. 1 | Niv. 2 | Niv. 3 |
|---|---|---|---|
| Fire Rate | +1,5 % | +2 % | +2,5 % |
| Max Ammo | +3 % | +5 % | +7 % |
| Cooldown Reduction | +0,5 % | +0,75 % | +1 % |
| Weapon Damage | +3 % | +4 % | +6 % |
| Max Health | +15 | +20 | +30 |
| Spirit Power | +2 | +3 | +4 |
| Bullet Resist | +0,5 % | +0,75 % | +1 % |
| Spirit Resist | +0,5 % | +0,75 % | +1 % |
| Move Speed | +0,1 m/s | +0,2 m/s | +0,3 m/s |
| Ability Range | +0,25 % | +0,5 % | +0,75 % |

Tirage : poids 1 pour chaque stat, 2 pour Health, 0,5 pour Move Speed et Ability Range.

## Troopers et vagues

- Intervalle : **30 s** jusqu'à 20:00, **25 s** de 20:00 à 35:00, **20 s** ensuite [D].
- Première vague : convar à 16 s ; un autre convar `citadel_match_pre_trooper_spawn_brawl_time 40` existe [?].
- Composition : 3 Ranged + 1 Medic, puis à partir de 5:00 2 Ranged + 1 Melee + 1 Medic [W].
- Souls par Trooper : **100 + 2/min** [D]. Moitié dans l'orbe au sol (non déniable), moitié dans l'orbe flottant (déniable). Tuer à la mêlée : pas d'orbe flottant, tout est acquis d'office.
- Partage : 100 % seul, 54 % chacun à 2, 36 % à 3, 25 % à 4, 20 % à 5, 16 % à 6 [D].
- L'orbe au sol reste 18 s, 40 s après 10 min [W].
- Spirit resist des Troopers : 20 % à 25 min, 70 % à 50 min [W]. +50 % PV à 35:00 [W].
- Medic : son pack soigne les héros dans 35 m, ne peut pas être ramassé par l'équipe du Trooper [W].
- **Super Troopers** quand le Shrine ennemi de la lane tombe : +60 % dégâts, +40 % PV, 15 % de souls en moins [D].

## Ziplines

Page du 26/09, valeurs écrites à la main [W] — pas retrouvées dans les données.

- Vitesse fixe : 18 m/s sur la lane centrale, 21 m/s sur les extérieures.
- **Zipline Speed Boost** : +80 %, dure 32 s, cooldown 6 min, **disponible à partir de 6:00**.
- Détruire les Base Guardians d'une lane rend le boost permanent sur cette zipline.
- Subir des dégâts d'un héros ou d'un objectif ennemi : 3 s sans pouvoir s'accrocher [D pour les 3 s]. Les Haunts, Sinner's Sacrifice et Troopers ennemis ne bloquent pas.
- Touché en cours de trajet : chute, 15 % des PV max, stun 2,5 s. Immunité à la chute après 3 s de trajet continu.
- La longueur utilisable dépend de l'avancée des Troopers de la lane.

## Structures

| Structure | PV | Souls | Résistance dans le temps |
|---|---|---|---|
| Lane Guardian | 5500 | 1375 | 50 % → −50 % sur les 12 premières minutes |
| Walker | 6000 (9000 puis 12 000 pour les survivants) | 3675 | 65 % → −65 % sur les 18 premières minutes |
| Base Guardian (×2 par lane) | 4000 | 1000 | selon le nombre d'ennemis proches |
| Shrine (×2) | 5000 (10 000 pour le second) | 2000 | invulnérable tant qu'aucune paire de Base Guardians n'est tombée |
| Patron | 12 000 par phase | — | +250 PV/min à partir de 20:00 (phase 1), +450/min (phase 2) |

PV et souls [D] ; courbes de résistance [W, pages du 30/09].

- Repères utiles : Guardian à 0 % de résistance à 6:00 ; Walker à 0 % à 9:00.
- Walker : résiste davantage au tir à partir de 3 ennemis proches (20 % à 3, jusqu'à 50 % à 6) [D]. Chaque Walker détruit débloque un Extra Slot pour l'équipe [W]. Souls : 40 % aux attaquants proches, 60 % à toute l'équipe.
- Guardian : souls à tous les héros vivants de l'équipe. Sa mêlée se pare, mais depuis le 29/09 **parer un objectif ne remet plus à zéro le cooldown du Parry**.
- Backdoor Protection (tout sauf Lane Guardians) : 65 % de réduction des dégâts des joueurs et 65 PV/s tant que la vague n'est pas arrivée [D].
- Les soul bounties des Guardians et Walkers ont été augmentées au patch du 16/09.
- Un Curiosity Shop ferme par Guardian détruit (jusqu'à 6 sur 10) [W].

## Mort et respawn

Courbe linéaire entre les points [D] :

| Temps de jeu | Respawn |
|---|---|
| jusqu'à 5:00 | 8 s |
| 20:00 | 38 s |
| 30:00 | 70 s |
| 40:00 | 85 s |
| plafond | 90 s |

- +10 s si on meurt d'une unité non-joueur, sans héros ennemi impliqué [D].
- À partir de 10:00, tuer un joueur dont le net worth dépasse de 15 % la moyenne de l'équipe du tueur allonge son respawn : de +6 s (15 % à 10 min) à +22 s (30 % à 25 min) [D].
- Patron phase 1 détruit : le respawn restant des défenseurs morts est raccourci de 20 s, avec un plancher à 10 s [D].
- Courbe ajustée au patch du 16/09.

## Souls et rattrapage

- 600 souls au départ [D]. First Blood : +125 [D].
- **Haunted Souls** (Haunts, Sinner's Sacrifice, Crates) : perdues à la mort. Si on meurt avec au moins 50 + 5/min, elles tombent dans un Soul Container (heavy melee pour le prendre, disparaît après 3 min) ; en dessous, elles sont perdues [D].
- Sécurisation progressive : 0,5 % du stock par seconde + 1,6 souls/s (cette part fixe croît de 8 %/min) [D].
- Partage d'un kill de héros : 125 % seul, 57,5 % chacun à 2, 28,3 % à 3, 17,5 % à 4, 11 % à 5, 8,3 % à 6 [D]. Assist = dégâts dans les 10 dernières secondes [W].
- Équipe en retard : jusqu'à +26 % de souls sur Troopers, Haunts, Sinner's Sacrifice et objectifs, maximum atteint à 20 % d'écart ; les 3000 premiers souls d'écart sont ignorés [D/W].
- À partir de 8:00, les deux joueurs les plus pauvres de l'équipe reçoivent 2,5 % et 1,5 % des souls gagnées par l'équipe [D].
- **Soul Well** en base : orbes de 10 souls toutes les 2 s. Début à 2:30 selon la page Souls, à 3:00 selon la page de la carte (section obsolète) [?].
- Zone de soin du spawn : 6 % des PV max + 60 PV par seconde [D].

## The Broker

- Marchand qui transforme des objets en Corrupted Items, ajouté le 29/09.
- Ouvre vers **30:00 ± 2 min** [D : 1800 s, variance 120 s], rouvre environ 15 min après sa fermeture [W]. Deux emplacements en miroir, près du Walker de Blue lane.
- **Réserve** : le wiki l'annonce comme temporaire, disponible jusqu'au 2 octobre 21:00 UTC — c'est-à-dire ce soir. À revérifier avant de l'intégrer à la timeline.

## Compléments tirés des vidéos

Sources secondaires, détail dans `video-patch-city-never-sleeps.md` et `video-macro-wouks.md`.

- Depuis le 29/09, le jeu affiche un chrono de réapparition sur un camp nettoyé et le chrono du Mid-Boss dans la barre du haut ; les Haunts et objectifs montrent leur valeur en souls.
- The Broker : disparition annoncée à la sortie du premier nouveau héros (2 octobre), ce qui recoupe le wiki.
- Tough Crates : donneraient plus de souls que les caisses normales (non recoupé).
- Sunken Plaza : zone de jungle où la stamina ne se régénère plus (non recoupé).
- Associations famille de Haunts ↔ district : Stage Hand au théâtre, Festival Spirit et Crabbage Pot à Chinatown, Slum Shroom au Haunted Lot, Underhand à la Plaza.
- Six nouveaux héros sortent un par un, les mardis et vendredis, du 2 octobre à la mi-octobre.

## Points à trancher ou à vérifier en jeu

1. Horaire exact du premier Unstable Rift et régularité des suivants.
2. Soul Well : 2:30 ou 3:00.
3. Heure de la première vague de Troopers.
4. Réapparition du Mid-Boss à 6 puis 5 min : seulement dans le texte du wiki.
5. Zipline Speed Boost : aucune confirmation dans les données, et rien ne dit que le patch du 29/09 l'a laissé intact.
6. Nombre de camps par tier depuis la refonte de la carte.
7. Le Broker existe-t-il encore après ce soir.
8. La refonte de la carte du 29/09 a pu déplacer des emplacements (ponts, urne, teleporters) : les descriptions de lieux du wiki ne sont pas toutes à jour, la page de la carte est marquée « en construction ».
9. `MiscData` du wiki date du 29/09 (build précédent) : durée des powerups et paramètres du Rift recoupés avec l'API, qui concorde.

## Pas encore collecté

- La « condition pour y aller » de chaque événement (jugement, pas donnée) : à construire à partir des mécaniques ci-dessus, éventuellement recoupée avec des guides.
- Seuils de souls des Boons (montée de niveau) et paliers de déblocage des capacités.
- Emplacements précis sur la carte (`/v1/assets/map` de l'API contient des coordonnées, non exploitées).
- Street Brawl : hors périmètre.
