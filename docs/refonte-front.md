# Refonte du front : diagnostic et cahier des charges

Demande de l'utilisateur (2026-10-11) : un front qui ne fasse pas « IA slop »,
fluide et pensé pour le joueur d'abord. Juge : `.claude/agents/juge-slop.md`
(mesures : `node outils/juge/pages.mjs`).

## Diagnostic du 2026-10-11 (juge-slop, site avant refonte)

Verdict : À CORRIGER. Notes : hiérarchie 2 · décor 3 · texte de remplissage 2 ·
système 1 · identité 3 · réponse au premier écran 2 · étapes 2 · débutant 3 ·
vitesse 3 · mouvement 3 · téléphone 2. Décisions du projet respectées.

Les 7 corrections, par gravité :
1. **En partie** : la grande carte « objectif » tourne seule toutes les 6 s
   (`js/partie.js` `tourner`) et montre parfois le 2e objectif ; « 5:00 … à
   5:00 » ; commandes du chrono visibles au survol seulement (rien sur
   téléphone). → objectif suivant fixe, les 2 d'après en ligne compacte,
   bouton Démarrer toujours visible à 0:00 et en pause.
2. **Pas d'échelle typographique** : 92 `font-size` différents dans les CSS,
   18 arrondis, jusqu'à 15 tailles rendues par page, 7,7 px sur téléphone
   (`html { font-size: clamp(…) }` × rem fractionnaires). → 6 tailles + 1
   taille « chiffre » en variables, 3 arrondis, 14 px minimum sur téléphone.
3. **Boîtes dans des boîtes** : index 37 cartes (20 imbriquées), counters
   139 (90), objets 85 (77). → un panneau par colonne, séparation par l'espace.
4. **Décor sans fonction** : pastilles pointillées « conseil » / « avis de
   joueur », 6 étiquettes perso en tête de fiche héros, emojis en icônes,
   27 dégradés sur parcours et patch. → source en pied de bloc, un bouton
   « Étiqueter ▾ », icônes SVG, pas de dégradé décoratif.
5. **Téléphone** : ordre qui ne suit pas la tâche (coach avant l'objectif,
   fiche héros sous 40 portraits, counters de 12,7 écrans), 62 cibles < 44 px.
6. **Texte d'interface** : consignes répétées, intros qui décrivent les
   commandes, pied de page technique. → une action par état vide, provenance
   des données en infobulle.
7. **Incohérences** : deux légendes pour la même carte (Apprendre / En
   partie), table de patch qui déborde, couleur bleue sans règle.

À garder : en-tête de la fiche héros au bureau (grand portrait, nom en Oswald,
chiffres en rangée) ; CLS < 0,1 partout, aucune erreur JS, focus clavier
visible, En partie sans défilement en 1080p, sommaire du Mémo.

## Direction proposée par le juge (à valider par l'utilisateur)

1. Parti pris « tableau de bord de jeu » façon Deadlock Labs : fond quasi noir
   uni, **une seule couleur d'action (orange)** pour maintenant / à faire /
   sélection ; or en secondaire ; vert, violet, rouge réservés à Vitality,
   Spirit et danger, avec la même légende partout.
2. Oswald 600–700 pour chiffres et titres courts, Inter pour le corps ; six
   tailles + une taille « chiffre héros » énorme, colorée selon ce qu'elle mesure.
3. Iconographie du jeu d'abord : portraits et icônes d'objets 40–56 px avec
   nom et prix ; composants communs « objet » et « héros ».
4. Densité maîtrisée : une seule réponse en grand par écran.
5. Mouvement : 150–200 ms sur les changements d'état seulement, aucune
   rotation automatique, `prefers-reduced-motion` respecté. HTML/CSS/JS sans
   framework, variables `:root` consommées par tous les CSS.

## Ordre de travail prévu

1. Système commun (`css/style.css` : variables, composants héros / objet /
   panneau / bouton / ligne) et icônes SVG.
2. En partie (index), en boucle avec juge-partie et juge-slop (3 tours au plus).
3. Fiche héros, puis Counters, puis le reste.

## État au 2026-10-11 (fin des 3 tours sur En partie)

- **En partie : terminée pour la boucle.** juge-partie : VALIDÉ (toutes les notes ≥ 4) ; juge-slop : 4 à 5
  partout sauf vitesse et téléphone (3), corrigés ensuite (CLS téléphone 0,11 → 0,02, cibles de 44 px dans
  la barre). Rien ne bloque un essai en vraie partie.
- Finitions notées par les juges, à reprendre après l'essai en partie : barre de contexte du téléphone haute
  (≈ 150 px), pied de page qui chevauche la carte sur la capture téléphone pleine page (à vérifier sur un vrai
  appareil), infobulle « sources » qui ne s'ouvre pas au toucher, idées (relier l'estimateur de souls au bloc
  Achète, griser l'objet de « Leur menace » s'il est déjà dans le build suivi), se passer de la touche F en
  clôturant la partie à l'arrivée du débrief.
- **Suite (ordre du juge-slop)** : fiche héros (5 décisions ci-dessus dans le rapport du tour 2 : tête de fiche
  à 3 chiffres et un bouton « Étiqueter », « comment je le joue » d'abord, chaque héros une fois dans la liste,
  composant « objet » commun, winrate dans Matchups), puis Counters (fusion partielle avec Objets clés),
  Parcours, Progression, Patch, Objets clés, Carte (légende commune), Rôles, Mémo.
