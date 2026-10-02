# Notes — présentation vidéo du patch « City Never Sleeps »

- **Source** : vidéo de présentation du patch du 29 septembre 2026, en français (vraisemblablement Wouks – Deadlock Academy, d'après les renvois en fin de vidéo). **Lien et date de publication à compléter.**
- **Nature** : résumé d'un créateur à partir de l'annonce de Valve, publié avant la sortie du premier nouveau héros. Notes reformulées à partir d'une transcription automatique ; minutages de la vidéo.
- **Fiabilité** : secondaire. Ce qui recoupe nos données est signalé ; le reste est à vérifier en jeu ou sur le wiki avant d'entrer dans les données.

## Ce qui touche la timeline et le chrono

| Info | Minutage | Recoupement |
|---|---|---|
| The Broker arrive vers 30 min, puis toutes les 15 min | 04:41 | Concorde (variable du jeu : 1800 s ± 120 s ; wiki : réouverture ~15 min) |
| The Broker est temporaire et disparaît à la sortie du premier nouveau héros, vendredi 2 octobre | 04:46 | Concorde avec le wiki (2 octobre 21:00 UTC). **À retirer de la timeline, ou à marquer comme événement temporaire** |
| Un camp nettoyé affiche un chrono de réapparition sur place | 07:31 | Concorde avec la variable `neutral_camp_respawn_timer_show_distance` (visible de près) |
| Le chrono du Mid-Boss est affiché dans la barre du haut | 07:37 | Nouveau. Le wiki parlait encore de Tab et de l'icône minimap |
| Les barres de vie des Haunts et des objectifs affichent leur vie et leur valeur en souls | 05:47 | Nouveau, non recoupé |
| La cloche de la Bell Tower sonne sur toute la carte quand on y prend les ressources | 03:32 | Concorde avec le wiki (Chinatown, 3 Sinner's Sacrifice ; ping minimap ajouté le 30/09) |

Conséquence pour l'outil : le jeu affiche désormais lui-même les chronos de camp et du Mid-Boss. Le chrono du second écran apporte donc surtout l'**anticipation** (annoncer avant que ça apparaisse) et les événements que le jeu n'annonce pas à l'avance.

## Carte

- Carte entièrement refaite visuellement, jouée de nuit. La minimap affiche le nom de chaque lane et de chaque district (02:42).
- Lieux cités le long des lanes : Uptown, Times Square, Downtown, l'université, Central Park, les Brownstones, la Bourse, le port, les usines Fairfax.
- Quatre quartiers de jungle : le théâtre, Chinatown, le Haunted Lot, la Plaza (03:04).
- **Sunken Plaza** (03:16) : zone en contrebas où la stamina baisse et ne se régénère plus, le son extérieur est étouffé et un brouillard coupe la vue vers l'extérieur. Présentée comme zone de récompense. Non recoupé.
- **Bell Tower** (03:32) : grosse concentration de souls (plusieurs Sinner's Sacrifice et grosses caisses), mais la cloche prévient tout le monde.

## Haunts

- Plus qu'un changement d'apparence : nouveaux monstres avec des capacités différentes (03:43).
- Familles citées : Specimen, Past Dues, Gutter Ghoul, Barrel Mimic.
- Par district : Stage Hand au théâtre ; Festival Spirit et Crabbage Pot à Chinatown ; Slum Shroom au Haunted Lot ; Underhand à la Plaza (04:04). Concorde avec la liste des familles du wiki ; l'association famille ↔ district est un plus par rapport à nos notes.

## Breakables et pickups

- **Tough Crates** : heavy melee obligatoire, et donneraient plus de souls que les caisses normales (04:57). Le « plus de souls » n'apparaît pas dans nos données : à vérifier.
- **Buff Containers** : le buff apparaît sous forme de livre flottant au-dessus de la tête (05:04).
- Quatre buffs permanents ajoutés au tirage : Spirit Resist, Bullet Resist, Ability Range, Move Speed. Concorde avec les notes officielles et nos données.
- Petits soins à ramasser sur la carte (Healing Snacks) (05:19).
- **Steam Vents** : invisible tant qu'on se tient dedans (05:24). Le wiki ajoute une régénération.

## The Broker et Corrupted Items

- Marchand temporaire qui échange des objets de haut tier contre des versions corrompues : stats renforcées, avec un malus en contrepartie (04:15).
- Les malus viennent d'une liste fixée à chaque partie ; l'ampleur du bonus comme du malus varie.

## Interface

- Barres de vie refaites : nom du héros, ultimate disponible ou non, crédit Rejuvenator, stamina restante (05:33).
- Marqueur des alliés visible à travers les bâtiments.
- Paliers Weapon / Vitality / Spirit affichés en bas à gauche, mis à jour à l'achat.
- Nouveau fil des kills : qui tue qui, avec quelle aide, quel sort ou objet, souls gagnées, primes, et qui ramasse le sac de souls de qui (06:14).
- Shop : nouvel onglet des objets les plus achetés sur le héros, d'après les données du jeu (06:35). À rapprocher de notre usage de l'API pour « quoi construire ».
- Cooldown de son propre Parry affiché près du viseur (07:26).
- Beaucoup plus de pings (carte, portraits, ennemis, alliés, Haunts).
- IA des Troopers améliorée ; rendu des Veils et des boucliers refait.

## Nouveaux héros

- Six héros annoncés : Nurse Harrow, Rat King, Solomon, Deadman Danny, Baba, Violet. La vidéo ne décrit que leur présentation et spécule sur leurs rôles : rien d'exploitable avant leur sortie.
- Calendrier : le premier le vendredi 2 octobre, puis un chaque mardi et chaque vendredi à 23 h heure française, sur trois semaines (01:50). Concorde avec le wiki (14:00 PT).
- Ordre de sortie décidé par vote dans le lobby d'avant-partie ; les votes de l'équipe gagnante et ceux de la première victoire du jour comptent double.

Conséquence pour le projet : six héros arrivent d'ici le 20 octobre environ. Les fiches héros, les stats par héros de l'API et les listes de counters bougeront pendant cette période.

## À vérifier

- Lien et date de la vidéo.
- Tough Crates : rapportent-elles vraiment plus de souls, et combien.
- Sunken Plaza : emplacement, contenu, effet exact sur la stamina.
- Position exacte du chrono du Mid-Boss dans l'interface.
