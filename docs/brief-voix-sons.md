# Brief — session voix et sons des alertes

Document de passation pour une session dédiée à l'audio du chrono. Périmètre : **les clips de voix des annonces et, en option, les sons d'alerte en fichiers**. Le reste du site (pages, mise en page, chrono) est suivi par une autre session : ne pas y toucher.

À lire avant de commencer : `CLAUDE.md` (règles du projet), puis ce brief.

## Le besoin

En partie, l'utilisateur ne regarde jamais le second écran : les alertes doivent s'**entendre**. La voix actuelle (synthèse du navigateur) est jugée « horrible ». L'utilisateur veut **produire lui-même les clips avec une IA spécialisée** dans la voix (et éventuellement dans les effets sonores), puis les intégrer au site.

Ton recherché : des alertes claires, bien audibles par-dessus le son du jeu, mais pas agaçantes à la longue. Ambiance « jeu vidéo » plutôt que GPS.

## Ce qui existe déjà (ne pas le refaire)

| Fichier | Rôle |
|---|---|
| `outils/generer_voix.py` | Écrit `data/voix.json` (liste des clips, texte, fichier présent ou non). Sans option : affiche les clips manquants et le nom de fichier attendu. Avec `--elevenlabs ID_VOIX` : génère via l'API ElevenLabs (clé dans `outils/.cle_elevenlabs`, ignoré par git). |
| `data/voix.json` | Manifeste lu par le site. **À régénérer** (`python3 outils/generer_voix.py`) après chaque ajout de fichier. |
| `voix/` | Dossier des clips `*.mp3` (publiés : `.gitignore` les autorise malgré la règle `*.mp3`). |
| `js/voix.js` | Lecteur : une annonce = clip du **nom** puis clip de **fin**, joués à la suite ; si un des deux manque, retour à la voix du navigateur. Appelé par `js/timeline.js` (préavis des objectifs) et par le bouton « Tester une alerte » (`js/partie.js`). |
| `js/sons.js` | Sons d'alerte **synthétisés** (Web Audio) : 8 ambiances (Carillon, Cloche, Marimba, Radar, Menu console, Clic net, Rétro 8-bit, Discret), deux moments `preavis` et `maintenant`, volume. Réglages dans `dln.sons.v1`. |

Test rapide en local : `python -m http.server` à la racine, ouvrir `http://localhost:8000`, menu **🔔 Alertes** › « Tester une alerte » (il faut avoir coché Voix).

## Les clips de voix à produire

17 clips. Noms de fichiers **exacts** (le site les cherche sous ces noms) :

| Fichier | À dire |
|---|---|
| `voix/nom-small-camps.mp3` | Small camps |
| `voix/nom-medium-camps.mp3` | Medium camps |
| `voix/nom-large-camps.mp3` | Large camps |
| `voix/nom-sinner-s-sacrifice.mp3` | Sinner's Sacrifice |
| `voix/nom-powerups.mp3` | Powerups |
| `voix/nom-soul-urn.mp3` | Soul Urn |
| `voix/nom-unstable-rift.mp3` | Unstable Rift |
| `voix/nom-mid-boss.mp3` | Mid-Boss |
| `voix/nom-rejuvenator-actif.mp3` | Rejuvenator actif |
| `voix/nom-unstable-rift-suivant.mp3` | Unstable Rift suivant |
| `voix/fin-15.mp3` | dans quinze secondes |
| `voix/fin-30.mp3` | dans trente secondes |
| `voix/fin-45.mp3` | dans quarante-cinq secondes |
| `voix/fin-60.mp3` | dans une minute |
| `voix/fin-75.mp3` | dans une minute quinze |
| `voix/fin-90.mp3` | dans une minute trente |
| `voix/fin-maintenant.mp3` | maintenant |

La liste fait foi dans `data/voix.json` (elle suit `data/timeline.json` : si un événement est ajouté au chrono, relancer `outils/generer_voix.py` pour voir le nouveau clip attendu).

Conseils de production :

- **Une seule voix** pour les 17 clips, même réglages, même ambiance : les clips sont collés « nom » + « fin », un changement de timbre s'entendrait.
- Noms du jeu en anglais (règle du projet), prononcés comme les joueurs les disent ; le reste en français.
- **Ton** : énergique et net, phrase courte, pas de musique de fond. Le « nom » se termine sur une intonation suspendue (ça enchaîne sur la fin) ; « maintenant » est plus appuyé.
- **Fichier** : MP3, mono, 44,1 kHz, 128 kb/s suffisent. **Silences coupés** au début et à la fin (sinon un trou s'entend entre les deux clips). Volume homogène entre clips (viser environ −16 LUFS, ou au moins normaliser tous les clips de la même façon).
- Durée : 0,5 à 1,5 s par clip.

## Outils possibles (à vérifier au moment de s'en servir)

Voix :
- **ElevenLabs** : déjà branché par `outils/generer_voix.py --elevenlabs ID_VOIX` (modèle multilingue). Le plus simple.
- **Fish Audio**, **Resemble AI / Chatterbox** : bien classés dans les comparatifs 2026 ; génération à la main puis dépôt des fichiers dans `voix/`.
- Libres et locaux : **Piper**, **Kokoro** (usage commercial permis), **XTTS v2** (clone une voix à partir de quelques secondes, mais **non commercial**).

Effets sonores (option) : générateurs « texte → son » (ElevenLabs Sound Effects, Layer…). Prompts du genre « soft rounded notification chime, game menu, short, no reverb tail ».

**Licences** : le site est public et pourrait un jour avoir de la publicité. Noter dans le meta de `data/voix.json` (champ `meta`) l'outil, la voix et ses conditions d'usage. Éviter les licences non commerciales si possible.

## Limites à respecter

- **Pas de sons ou voix de jeux existants** (menus Nintendo Switch/Wii, voix de Deadlock, etc.), même modifiés, distordus ou passés dans une IA : ce sont des œuvres protégées, et le site est public. Des sons **originaux « dans l'esprit de »** sont possibles.
- **Pas de voix d'une personne réelle** sans son accord (clonage).
- **Jamais de clé d'API dans un fichier commité** : `outils/.cle_elevenlabs` (ignoré) ou variable d'environnement `ELEVENLABS_API_KEY`.

## Option : sons d'alerte en fichiers

Aujourd'hui les sons sont synthétisés. Si l'utilisateur produit ses propres sons avec une IA, ajouter une ambiance « fichiers » dans `js/sons.js` :

- fichiers `sons/<ambiance>-preavis.mp3` et `sons/<ambiance>-maintenant.mp3` (mêmes règles : courts, silences coupés, volume homogène) ;
- une entrée dans `PROFILS` qui joue ces fichiers (élément `<audio>` ou `AudioBuffer`) au lieu de notes, avec le volume de `reglages.volume` ;
- `DLN.sons.duree(moment)` doit renvoyer la durée réelle du fichier, pour que la voix attende la fin du son ;
- ajouter les fichiers à la liste `ESSENTIEL` de `sw.js` et incrémenter `VERSION`.

## Fichiers de cette session

La session audio peut modifier : `voix/`, `sons/` (à créer), `data/voix.json`, `outils/generer_voix.py`, `js/voix.js`, `js/sons.js`, `sw.js` (liste `ESSENTIEL` et `VERSION` seulement). **Pas** `index.html`, `js/timeline.js`, `js/partie.js`, les CSS ni les autres pages : si un changement y est nécessaire, le signaler à la session front (`ListAgents` puis `SendMessage`) ou à l'utilisateur.

Publier : commit sur `main`, puis `git push origin main` et `git push origin main:gh-pages` (site : `https://crakee.github.io/DeadLock_Noob/`). Ne commiter que ses propres fichiers (d'autres sessions travaillent en parallèle).

## Critères de réussite

1. Les 17 fichiers sont dans `voix/`, `python3 outils/generer_voix.py` affiche « 17 fichiers présents ».
2. « Tester une alerte » enchaîne le son puis « Powerups… dans trente secondes » avec la nouvelle voix, sans trou audible entre les deux clips.
3. En partie (chrono lancé, horloge réglée à 4:25), l'annonce des Powerups part à 4:30 avec la nouvelle voix.
4. Volume des clips homogène, la voix s'entend par-dessus le son du jeu à volume habituel.
5. Outil, voix et licence notés dans `data/voix.json`.
