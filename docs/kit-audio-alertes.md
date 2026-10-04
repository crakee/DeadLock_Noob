# Kit audio d'alertes — prompts réutilisables

Kit générique pour produire des **sons d'alerte** et une **voix d'annonce** avec une IA (pensé pour ElevenLabs, valable ailleurs), pour ce projet ou un autre. Les prompts sont en anglais : les outils les comprennent mieux. La partie propre à Deadlock est à la fin.

Règle : on décrit un **style** avec des mots de son (instruments, attaque, durée, ambiance), jamais un jeu, une marque ou une personne réelle. Les générateurs refusent souvent ces noms, et le résultat doit être original.

## 1. Trois niveaux d'alerte

| Niveau | Quand | Durée | Ce qu'on cherche |
|---|---|---|---|
| **Tic** | rappel fréquent, préavis | 0,2 à 0,4 s | à peine remarqué, ne lasse jamais |
| **Notif** | événement utile mais courant | 0,5 à 1 s | clair, joyeux, se distingue du son du jeu |
| **Épique** | événement rare et décisif | 1,5 à 3 s | on lève la tête, montée d'adrénaline |

Plus un son revient souvent, plus il doit être court et doux. L'épique ne marche que s'il est rare.

## 2. Trois familles de style

À combiner avec un niveau. Chaque famille garde les mêmes instruments du tic à l'épique, pour que l'ensemble sonne comme un tout.

**Ludique** (console familiale, couleurs vives) : cloches, marimba, xylophone, arpèges en majeur, sons ronds et rebondissants, un peu cartoon.

**Arène** (jeu de combat de plateau, show) : coups orchestraux secs, whoosh, impacts percussifs, énergie de présentateur, foule qui s'emballe.

**Fantasy épique** (arène stratégique en ligne) : cuivres graves qui enflent, cor de guerre, boom profond, scintillement magique et cristallin, chœur discret.

## 3. Prompts d'effets sonores (ElevenLabs › Sound Effects)

Réglages : durée fixée (pas « auto »), *prompt influence* haute pour les tics et les notifs, plus basse pour l'épique si on veut des variantes. Générer 4 variantes et garder la meilleure. Toujours finir le prompt par `no reverb tail, no music bed, clean ending` : un son qui traîne se marche dessus avec la voix.

### Ludique
- Tic : `Tiny soft wooden marimba blip, single note, round and gentle, cheerful game menu cursor, very short, no reverb tail, clean ending`
- Notif : `Bright two-note bell chime rising, cheerful major key, playful and bouncy, cozy console game notification, no reverb tail, clean ending`
- Épique : `Joyful short fanfare, sparkling bells and xylophone arpeggio climbing to a triumphant major chord, playful victory jingle, no reverb tail, clean ending`

### Arène
- Tic : `Short crisp snap with tiny whoosh, punchy UI hit, tight and dry, no reverb tail, clean ending`
- Notif : `Punchy orchestral stab with quick whoosh, energetic arena show cue, tight and impactful, no reverb tail, clean ending`
- Épique : `Massive orchestral hit with rising whoosh and big drum impact, crowd roar swelling, hype arena announcement sting, no reverb tail, clean ending`

### Fantasy épique
- Tic : `Soft crystalline shimmer ping, magical and subtle, short fantasy UI cue, no reverb tail, clean ending`
- Notif : `Short magical chime with low warm horn underneath, fantasy strategy game objective alert, clear and noble, no reverb tail, clean ending`
- Épique : `Deep war horn swelling into a heavy cinematic boom, low brass and timpani, magical sparkle on top, ominous epic fantasy objective spawn, no reverb tail, clean ending`

## 4. Voix d'annonce (ElevenLabs › Voice Design, puis Text to Speech, modèle Eleven v3)

Une seule voix pour toutes les annonces : les clips sont collés les uns aux autres. Le côté épique vient des sons, pas d'un changement de voix.

Deux registres au choix :

- **Présentateur** : `A native French voice in their late twenties, energetic and punchy like a competitive video game announcer, controlled and never shouting. Crisp articulation, short confident delivery, mid-low pitch, slight warmth. Dry studio recording, no reverb, no background music.`
- **IA de bord** (fatigue moins sur une longue session) : `A native French voice, calm and precise like a spaceship onboard assistant, neutral warm tone, clear articulation, short sentences, slightly synthetic polish but natural. Dry studio recording, no reverb, no background music.`

Texte : une ligne par clip, une ligne vide entre deux clips, une seule balise de ton au début (`[energetic]` ou `[calm]`). Les noms se terminent par « … » (intonation suspendue, un autre clip suit) ; « maintenant » se termine par un point.

## 5. Fichiers

Pour tous les sons : silences coupés au début et à la fin, volume homogène, mono, 44,1 kHz. Dans ce projet, `outils/generer_voix.py --depuis` s'en charge pour la voix.

Licence : noter l'outil, l'offre et ses conditions d'usage. Les offres gratuites interdisent souvent l'usage commercial.

## 6. Sons libres déjà faits (à écouter avant de générer)

- [Kenney](https://kenney.nl/assets/category:Audio) : packs *Interface Sounds*, *UI Audio*, *Music Jingles* (85 jingles), *Sci-fi Sounds*, *Voiceover Pack (Fighter)* ; licence CC0 (domaine public, usage commercial libre).
- [OpenGameArt](https://opengameart.org/content/ui-sounds-0) et [itch.io](https://baldspotstudios.itch.io/nano/devlog/888662/nano-soundpack-available) : petits packs CC0 d'interface et de jingles ; vérifier la licence pack par pack.
- [ZzFX](https://github.com/KilledByAPixel/ZzFX) (MIT) : générateur de sons rétro dans le navigateur, avec un éditeur en ligne et un export .wav ; idéal pour les tics.

## 7. Application à Deadlock_Noob

| Événement | Niveau proposé |
|---|---|
| Small / Medium / Large camps, préavis en général | Tic |
| Powerups, Sinner's Sacrifice, Unstable Rift | Notif |
| Soul Urn, Mid-Boss, Rejuvenator actif | Épique |

Noms de fichiers : `sons/<ambiance>-<niveau>.mp3` (par exemple `sons/fantasy-tic.mp3`). Aujourd'hui le site joue un son par **moment** (préavis, maintenant) et non par **événement** : jouer un son épique pour le Mid-Boss demande que le chrono transmette l'événement à `js/sons.js` (changement dans `js/timeline.js` / `js/partie.js`, à demander à la session front).
