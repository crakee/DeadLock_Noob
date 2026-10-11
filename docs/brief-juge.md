# Brief : agent juge pour l'écran En partie

État : **branché le 2026-10-11**. Agent `.claude/agents/juge-partie.md`, outils
`outils/juge/captures.mjs` (parties simulées) et `outils/juge/sons.py` (fiche
d'écoute). Premier passage à blanc fait sur le site tel quel.

## Le principe

Une boucle à deux agents, comme un mangaka et son éditeur :
- le **constructeur** (la session Claude habituelle) modifie le site ;
- le **juge** (un sous-agent séparé, qui n'a rien construit) regarde le résultat
  *comme le joueur le verra* et rend une note et des corrections ;
- le constructeur corrige, et ainsi de suite, **3 tours au plus**. L'utilisateur
  reçoit la version finale et le dernier rapport du juge, et c'est lui qui tranche.

## Décisions prises

| Question | Choix |
|---|---|
| Critères | Clarté pour un débutant ; exactitude des données ; **parcours du joueur pendant une partie, seconde par seconde** (voir plus bas) |
| Ton | Exigeant mais juste : note de 1 à 5 par critère, validé quand tout est à 4 ou plus, 5 corrections au plus par tour, classées par gravité |
| Déclenchement | Boucle automatique après chaque changement visible de l'écran En partie, 3 tours au plus |
| Modèle | Opus, le même que le constructeur |
| Pouvoirs | Lecture seule : il regarde et juge, il ne modifie pas le code |
| Captures | **Balayage complet** : une capture toutes les 10 s sur 40 min, onglets En jeu et Attente, 1080p et téléphone. Pour que ce soit jugeable : les captures identiques à la précédente sont écartées automatiquement (empreinte d'image), le juge ne regarde que celles où l'écran a changé, plus un résumé chronologique de ce qui est affiché à chaque instant |
| Scénarios | **Les 4 héros joués dès le départ** (Haze, Mirage, Yamato, Lady Geist), chacun contre une compo difficile (étiquette « me casse ») |
| Écran de mort | **Nouvel onglet « Attente »**, dédié à la réapparition ; « Mort · compo » reste tel quel |

## Le besoin (formulé par l'utilisateur)

> Regarder le parcours utilisateur pendant une partie : qu'est-ce qui apparaît à
> l'écran à l'instant t, est-ce vraiment la chose la plus importante, est-ce assez
> clair ? Regarder seconde par seconde et juger si ça correspond au besoin
> initial : un coach sur le second écran en jeu, qui donne des infos claires et
> rapides (power des héros adverses, leçons adéquates, etc.).

Deux façons de regarder l'écran, à juger séparément :

1. **Coup d'œil en jouant** (une à deux secondes, les mains sur la souris) : une
   seule information domine, lisible de loin sur un 1080p, sans défilement.
   Question du juge : *si le joueur ne lit qu'une ligne, est-ce la bonne ?*
2. **Mort, en attente de réapparition** (plus long en fin de partie) : le joueur
   a du temps. L'onglet Mort doit donner ce qui est utile **à ce stade de la
   partie** : quoi acheter maintenant, ce que l'équipe d'en face vient de gagner
   en puissance, une leçon courte. Durées de réapparition par minute de jeu : à
   prendre sur le wiki ou l'API (règle « aucune valeur de mémoire »), pas
   l'estimation « 60 s ».

## Comment le juge « voit » la partie (faisable, vérifié le 2026-10-11)

- Chromium sans écran est installé (`~/.cache/ms-playwright/chromium-1243`),
  Playwright passe par `npx`.
- Le chrono lit `localStorage['dln.timeline.etat.v1']` (`depart` = horodatage du
  début) : en le réglant, ou avec l'horloge simulée de Playwright (`page.clock`),
  on place la page à n'importe quelle minute sans attendre.
- Un **scénario de partie** fixe le contexte : mon héros (ex. Haze), l'équipe
  d'en face (`dln.counters.choisis.v1`), le niveau, le profil du joueur. Puis
  une capture à chaque moment clé, au format 1920×1080 et au format téléphone
  (390 px), onglet En jeu et onglet Mort.
- « Seconde par seconde » : des captures serrées autour des moments où
  l'affichage change (un rappel arrive, un objectif passe en « bientôt », un
  achat conseillé), plus un balayage régulier pour repérer les trous.

## Puissance des adversaires (décidé le 2026-10-11)

À afficher : **leur pic de puissance** (`data/tempo.json`) et **leur menace
principale** avec l'objet qui y répond (`data/counters.json`, justifié par la
mécanique). Pas de classement automatique « le plus dangereux ».

Remarque de l'utilisateur : la puissance dépend aussi du joueur, bon ou non.
D'où l'idée d'un **estimateur** : on choisit un héros adverse et on saisit ses
souls lues sur le tableau des scores à la minute X ; le site compare à la
courbe normale de ce héros à ce rang et dit « en avance / dans la moyenne / en
retard ». Faisable : `/v1/analytics/player-performance-curve` (paramètres
`hero_ids`, `min_average_badge`/`max_average_badge`, depuis le patch) donne la
valeur nette (net worth) par minute ; à mettre en cache dans un JSON comme les
autres données. Place naturelle : l'onglet Attente, quand la réapparition est
longue (38 s à 20 min d'après `data/patch.json`, plus ensuite).

Autres idées à trier ensuite (proposées par Claude) :
- Comparer avec **mes** souls à la même minute : « tu es en retard de 3 000 sur
  ton vis-à-vis » plutôt qu'un chiffre seul.
- **Ce qu'il a déjà acheté** (visible en jeu) coché dans une liste : le site
  retire les menaces déjà couvertes et dit ce qu'il reste à contrer.
- Un rappel du **prochain gros achat probable** du héros en avance
  (`data/achats.json`) : « il approche de X, prévois Y ».
- Pendant l'attente : **où réapparaître et quoi faire en premier** selon la
  minute (rejoindre l'équipe en fin de partie, farmer sa lane au début).
- Pendant l'attente : le **prochain objectif** et le temps qu'il restera une
  fois revenu en jeu (chrono − durée de réapparition).

## Sons et voix (décidé le 2026-10-11)

Le juge juge aussi l'audio : à quel moment chaque son ou voix part (journal des
parties simulées), s'il est audible et cohérent (mesures de volume et
spectrogrammes de `outils/juge/sons.py`, le juge n'entend pas), et ce qu'il
faudrait **ajouter** ou retirer. Premier constat : sons d'alerte vers -41 LUFS,
voix vers -17 LUFS, soit environ 24 dB d'écart.

## Grille

Elle est dans `.claude/agents/juge-partie.md` (critères A coup d'œil, B attente,
C débutant, D exactitude, E décisions bloquantes, F sons et voix).

## Outils

- `node outils/juge/captures.mjs [--parties haze] [--formats ecran-1080p]` :
  Playwright (`outils/juge/package.json`, `npm install` dans ce dossier) avec le
  Chromium déjà installé ; scénarios dans `outils/juge/scenarios.json` (compos
  adverses provisoires, à remplacer par les héros « me casse ») ; morts à 4:00,
  18:00 et 33:00 avec la durée de `data/reapparition.json`.
- `.venv/bin/python outils/juge/sons.py`.
- Sorties non versionnées dans `outils/juge/sorties/`.

Ressources visuelles pour les corrections : `docs/ressources-ui.md`.
