# Brief : agent juge pour l'écran En partie

État : **en cours de définition** (session du 2026-10-11, à reprendre). Rien
n'est encore branché : l'agent n'existe pas encore dans `.claude/agents/`.

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

## Questions encore ouvertes (à trancher à la reprise)

1. Quels **moments clés** dans le scénario ? Proposition : 0:00 avant la
   partie, 0:30, 3:00, 6:00, 10:00, 15:00, 20:00, 30:00, 40:00, plus une mort
   en début, milieu et fin de partie.
2. Quels **scénarios** ? Proposition : un par héros joué (Haze, Mirage, Yamato,
   Lady Geist), contre une compo qui pose problème (étiquette « me casse »).
3. « Power des héros adverses » : qu'affiche-t-on exactement ? Leurs gros achats
   probables à cette minute (`data/achats.json`) ? Leur pic de puissance
   (`data/tempo.json`) ? Les deux ?
4. Faut-il un **onglet ou un mode « attente »** qui s'adapte à la durée de la
   mort (court en début de partie : une ligne ; long en fin de partie : plus
   riche), ou bien l'onglet Mort actuel enrichi ?
5. Le juge doit-il aussi lire le **son** (rappels sonores) et la **voix**, ou
   seulement l'écran ?
6. Grille finale du juge : la rédiger ensemble à partir des critères ci-dessus,
   puis créer `.claude/agents/juge-partie.md`.

Ressources visuelles pour les corrections : `docs/ressources-ui.md`.
