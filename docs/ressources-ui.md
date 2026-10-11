# Ressources UI : bibliothèques de composants et inspiration

Liste de départ du 2026-10-11, à enrichir. Contrainte du projet : **site statique,
sans framework ni compilation**. On ne peut donc pas *installer* une bibliothèque
React ou une bibliothèque qui exige Tailwind compilé. On s'en sert de deux façons :
- **copier** un extrait HTML/CSS pur (licence à vérifier à chaque fois) ;
- **s'inspirer** d'un motif et le réécrire dans nos CSS (`css/style.css`,
  palette « ambiance Deadlock », Oswald + Inter).

## Bibliothèques de composants

| Source | Ce que c'est | Utilisable ici ? | Le plus intéressant pour DeadLock_Noob |
|---|---|---|---|
| [daisyUI](https://daisyui.com/components/) | Plugin Tailwind : des classes toutes faites (`breadcrumbs`, `tabs`…) | **Inspiration** (le CDN marche sans compilation, mais ça amène Tailwind entier et se battrait avec nos CSS) | [Countdown](https://daisyui.com/components/countdown/) et [Radial progress](https://daisyui.com/components/radial-progress/) → **compte à rebours de réapparition** dans l'onglet Mort ; [Timeline](https://daisyui.com/components/timeline/) → liste des 20 prochaines minutes ; [Steps](https://daisyui.com/components/steps/) → chapitres du parcours ; [Breadcrumbs](https://daisyui.com/components/breadcrumbs/) → Héros › Haze › Compétences ; [Kbd](https://daisyui.com/components/kbd/) → afficher les raccourcis J / M / F / Espace ; [Stat](https://daisyui.com/components/stat/) → chiffres de la page Parties |
| [shadcn/ui](https://ui.shadcn.com/) | Composants React (Radix + Tailwind) copiés dans le dépôt par une CLI | **Inspiration seulement** (React) | Les comportements à imiter : [Command](https://ui.shadcn.com/docs/components/command) (recherche de héros au clavier), [Hover card](https://ui.shadcn.com/docs/components/hover-card) (fiche d'un objet au survol), [Sonner/Toast](https://ui.shadcn.com/docs/components/sonner) (rappel du coach qui apparaît puis s'efface), [Tabs](https://ui.shadcn.com/docs/components/tabs) (accessibilité clavier de nos onglets) |
| [uiverse.io](https://uiverse.io/) | Petits éléments en HTML/CSS pur, copiables | **Oui, directement** | Boutons, loaders, interrupteurs, cartes animées pour le futur quiz « Entraînement » |
| [Open Props](https://open-props.style/) | Variables CSS prêtes (ombres, dégradés, animations), un simple `<link>` | **Oui** (pas de compilation) | Animations d'apparition des rappels du coach, échelles de tailles cohérentes |
| [Lucide](https://lucide.dev/) | Icônes SVG libres | **Oui** (copier le SVG) | Remplacer certains emojis (🎮 💀) par des icônes nettes à petite taille |
| Magic UI, Aceternity UI, React Bits, 21st.dev | Effets animés, React | Inspiration | À éviter en partie (distrait) ; éventuellement pour le quiz |
| HyperUI, Flowbite | Blocs Tailwind | Peu utile ici | — |

## Inspiration « interface de jeu » (le plus utile pour le coup d'œil)

- [Game UI Database](https://www.gameuidatabase.com/) : captures d'interfaces de
  jeux classées par type d'écran (HUD, écran de mort, minuteur…). Utile pour
  l'onglet Mort et le chrono.
- [Interface In Game](https://interfaceingame.com/) : même idée.
- **Deadlock Labs** (application de bureau tierce, captures du 2026-10-06 dans
  `docs/`, non versionnées : contenu de tiers et pseudos d'autres joueurs) :
  - « Live game : lobby scout, builds, timers » + **overlay** (Ctrl+O) → c'est
    exactement notre besoin En partie ; à étudier comme concurrent.
  - **Arcade** « Whose ability is this? » (4 héros, 8 s, score + série) →
    modèle direct pour le quiz « Entraînement » (chantier 🔴 d'`ETAT.md`).
  - Tableau de bord : historique avec KDA en gros chiffres colorés, icônes
    d'objets en grille → idées pour la page Parties.
- Sites de stats Deadlock déjà notés dans le `README.md` (tracklock.gg,
  mobalytics.gg) : à regarder pour la présentation, pas pour les valeurs.

## Ce que je retiens en priorité

1. **Onglet Mort = vrai écran d'attente** : un grand compte à rebours circulaire
   (motif Radial progress / Countdown), et autour, l'info utile *à ce stade de la
   partie*. Voir `docs/brief-juge.md`, c'est le premier cas que le juge testera.
   La durée de réapparition se vérifie sur le wiki ou l'API, jamais de mémoire.
2. **Quiz Entraînement** sur le modèle Arcade de Deadlock Labs + éléments uiverse.
3. **Raccourcis visibles** (motif Kbd) et **fil d'Ariane** sur les fiches héros.

Sources non revisitées le 2026-10-11 en dehors de daisyUI et shadcn/ui : vérifier
qu'elles existent toujours et leur licence avant de copier quoi que ce soit.
