# Brief — session front-end : onglet Timeline

Document de passation pour une session dédiée à l'interface. Périmètre : **uniquement l'onglet Timeline** (le chrono de partie). Les onglets Héros et Objets viendront plus tard et ne sont pas à préparer.

À lire avant de commencer : `CLAUDE.md` (règles du projet), puis ce brief. `README.md` donne le cadrage général ; `collecte/` contient la matière brute et n'a pas besoin d'être relu pour cette session.

## Le besoin en une phrase

Un chrono affiché sur un **second écran** pendant une partie de Deadlock, lancé au début du match, qui dit ce qui arrive bientôt sur la carte et à quelle condition y aller.

L'utilisateur débute sur le jeu. Il joue sur l'écran principal et ne jette que des coups d'œil au second : tout doit se lire en une seconde, sans interaction.

## Ce que l'outil apporte par rapport au jeu

Depuis le patch du 29 septembre 2026, le jeu affiche lui-même le chrono de réapparition d'un camp nettoyé (de près) et celui du Mid-Boss. L'outil ne doit pas refaire ça. Sa valeur :

1. **Anticiper** : prévenir *avant* qu'un événement apparaisse (« Powerups dans 30 s »).
2. **Rappeler la condition** : chaque annonce porte un conseil court (« wave poussée d'abord »).
3. **Donner le contexte du moment** : phase de la partie, temps de respawn actuel, intervalle des vagues.

## Données

Tout vient de `data/timeline.json`. **Aucune valeur de jeu en dur dans le code** : un patch doit se traiter en modifiant ce fichier seulement.

Structure :

| Clé | Contenu | Rendu attendu |
|---|---|---|
| `meta` | Patch, date de vérification, légende des niveaux de fiabilité | Pied de page discret : patch et date |
| `evenements` | Événements à heure connue | Le cœur du chrono |
| `declenches` | Comptes à rebours lancés par un bouton | Boutons + minuteurs |
| `courbes` | Respawn et intervalle des vagues en fonction du temps | Indicateurs « maintenant » |
| `phases` | Laning / mid-game / late-game | Bandeau de phase |
| `checklist` | Quatre priorités de décision | Panneau fixe |

Types d'événements (`evenements[].type`) :

- `unique` : se produit une fois à `temps_s`.
- `recurrent` : première occurrence à `temps_s`, puis toutes les `intervalle_s`, sans fin.
- `fenetre` : se produit quelque part entre `debut_s` et `fin_s` (heure non fixe). À afficher comme une plage, pas comme un instant.

Champs communs : `id`, `nom`, `categorie`, `annonce_avant_s`, `fiabilite`, `detail`, `conseil` (facultatif).

- `annonce_avant_s` : délai de préavis. À `0`, l'événement est une simple information de palier : il apparaît dans la frise mais ne déclenche pas d'alerte.
- `fiabilite` : `donnees`, `wiki` ou `incertain`. Les deux derniers doivent se distinguer visuellement (marque discrète, pas d'alarme) ; `incertain` affiche en plus un « ≈ ».
- `categorie` : `jungle`, `objectif`, `lane`, `structure`, `deplacement`, `phase`. Sert au code couleur et aux filtres.

`declenches[]` : un bouton (`bouton`) lance un compte à rebours de `delais_s[n]`, où `n` est le nombre de fois où le bouton a déjà servi ; le dernier délai se répète. `marge_s`, s'il existe, s'affiche en « ± ». `termine`, s'il existe, est l'`id` d'un événement que l'appui sur le bouton retire de « À venir » (le bouton « Rift terminé » clôt ainsi la fenêtre du premier Rift).

`courbes.respawn.points_s` : interpolation linéaire entre les points, plafonnée à `plafond_s`. `courbes.vagues.paliers_s` : valeur du dernier palier atteint.

Les noms de héros, d'objets et de mécaniques restent en anglais ; le reste de l'interface est en français.

## Écran

Un seul écran, pas de défilement à 1080p, pensé pour un moniteur secondaire regardé de loin.

1. **Horloge de partie** — très grande, `mm:ss`. C'est la référence : elle doit coller à l'horloge du jeu.
2. **À venir** — les 3 ou 4 prochains événements à préavis, du plus proche au plus lointain : nom, compte à rebours, conseil. Celui qui entre dans sa fenêtre de préavis passe en état d'alerte bien visible. Un événement reste affiché une dizaine de secondes après son heure (« maintenant »), puis disparaît.
3. **Minuteurs déclenchés** — les boutons de `declenches` et leurs comptes à rebours en cours.
4. **Maintenant** — phase en cours et son résumé, temps de respawn actuel, intervalle des vagues.
5. **Checklist** — les quatre priorités, toujours visibles, en petit.
6. **Frise** (secondaire) — vue d'ensemble de la partie de 0 à ~40 min avec la position actuelle, pour consultation hors partie.

## Commandes

- **Démarrer / Pause / Reprendre / Remettre à zéro.** La pause est nécessaire : le jeu peut être mis en pause.
- **Recaler l'horloge** : boutons ±1 s et ±10 s, et saisie directe d'un temps (`12:34`) pour rattraper un chrono lancé en retard ou rejoint en cours de partie.
- **Raccourcis clavier** pour démarrer/pause et pour chaque bouton déclenché : l'utilisateur a les mains sur le jeu, les gros boutons cliquables restent indispensables.
- La remise à zéro demande une confirmation.

## Alertes

- Visuelle : obligatoire.
- Sonore : un signal court au début du préavis, désactivable. Une annonce vocale par synthèse du navigateur (« Soul Urn dans trente secondes ») serait un plus ; à proposer en option, coupée par défaut si la voix française disponible est médiocre.
- Réglage du préavis global (multiplicateur ou décalage) et filtre par catégorie, mémorisés dans le navigateur.

## Contraintes techniques

- **Site statique** : HTML, CSS, JavaScript sans framework ni étape de compilation. Doit fonctionner sur GitHub Pages.
- Le JSON est chargé par `fetch`. Conséquence : l'ouverture par double-clic (`file://`) ne marche pas dans la plupart des navigateurs. Prévoir un message clair dans ce cas et documenter le lancement local (`python -m http.server`). Si la session trouve une solution simple pour le double-clic sans dupliquer les données, la proposer.
- **Précision** : calculer le temps écoulé à partir de l'heure système (horodatage de départ + décalages), jamais en accumulant des `setInterval`. Un onglet en arrière-plan est ralenti par le navigateur : le chrono doit rester juste au retour.
- **Écran allumé** : demander le maintien de l'éveil (`Wake Lock`) quand le chrono tourne, sans bloquer si l'API est absente.
- **Reprise** : l'état (heure de départ, pause, minuteurs déclenchés, réglages) survit à un rechargement de page. Envelopper le stockage local dans des `try/catch`.
- Thème sombre par défaut, contraste fort, pas d'animation gênante.
- Structure à prévoir pour d'autres onglets plus tard (navigation simple), sans les construire.

## Arborescence proposée

```
index.html
css/style.css
js/timeline.js
data/timeline.json      (existe déjà)
```

## Hors périmètre

- Onglets Héros, Objets, Concepts.
- Appels à `api.deadlock-api.com` : la timeline n'en a pas besoin.
- Lecture automatique de l'horloge du jeu (pas d'accès au client).
- Modification des valeurs de `data/timeline.json` : si une valeur semble fausse ou manque, le signaler plutôt que la corriger de mémoire (règle du projet : aucune valeur de jeu de mémoire). Ajouter un champ au schéma est permis s'il est documenté ici.

## Points connus à traiter avec prudence

- **Unstable Rift** : horaire incertain (fenêtre 11:20–13:20, puis environ 7 min ± 1 après le précédent). L'afficher comme une plage et laisser le bouton « Rift terminé » recaler la suite.
- **Mid-Boss** : seul le premier délai (7 min) vient des données ; 6 et 5 min viennent du texte du wiki.
- **Zipline Speed Boost** à 6:00 et paliers de résistance des structures : source wiki seulement.
- **The Broker** : volontairement absent, il a été retiré du jeu le 2 octobre 2026.
- Les champs `conseil` et la `checklist` sont du jugement, pas des faits : les présenter comme des conseils.

## Critères de réussite

1. Chrono lancé à 0:00 : « Small camps » passe en alerte à 1:45 et en « maintenant » à 2:00.
2. À 9:30, « Soul Urn » est en alerte ; à 14:30 et 19:30 aussi (récurrence).
3. « Powerups » revient toutes les 5 minutes sans limite de durée.
4. « Mid-Boss tué » lance 7:00 ; un deuxième appui après expiration lance 6:00, puis 5:00, puis 5:00.
5. Recaler de +10 s décale tous les comptes à rebours d'autant, immédiatement.
6. Pause de 2 minutes puis reprise : l'horloge reprend là où elle s'était arrêtée.
7. Rechargement de la page en cours de partie : l'horloge et les minuteurs sont intacts.
8. Onglet laissé 5 minutes en arrière-plan : l'horloge est juste au retour, à la seconde.
9. À 25:00, le respawn affiché est d'environ 54 s et l'intervalle des vagues de 25 s.
10. Modifier une valeur dans `data/timeline.json` change l'affichage sans toucher au code.
11. Lisible à deux mètres sur un écran 1080p ; aucun défilement nécessaire.

## Vérification attendue de la session

Lancer le site en local et le contrôler dans un navigateur réel (avance rapide du temps ou saisie directe de l'heure pour tester les cas ci-dessus), pas seulement relire le code. Signaler ce qui n'a pas pu être testé.
