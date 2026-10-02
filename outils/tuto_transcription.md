# Transcrire une vidéo YouTube

Mode d'emploi pour Windows (PowerShell). Sert à récupérer le texte d'un guide vidéo pour en tirer des notes dans `collecte/`.

## Installation (une seule fois)

```powershell
pip install faster-whisper yt-dlp
```

Puis placer `transcrire.py` (ce dossier) dans le dossier de travail, par exemple `C:\Users\lucas`.

## À chaque vidéo

Ouvrir PowerShell normalement (pas en administrateur) et se placer dans le dossier de travail :

```powershell
cd C:\Users\lucas
```

1. Télécharger l'audio — remplacer `nom` et le lien :

```powershell
python -m yt_dlp -f bestaudio -o "nom.%(ext)s" "https://www.youtube.com/watch?v=XXXX"
```

Le nom exact du fichier créé s'affiche après `Destination:` (souvent `nom.webm`).

2. Transcrire :

```powershell
python transcrire.py nom.webm
```

Il affiche `Audio lu : … min`, puis un pourcentage, puis `Fini : nom.webm.txt`.

3. Copier le résultat pour le coller à Claude :

```powershell
Get-Content nom.webm.txt -Encoding utf8 | Set-Clipboard
```

## Options

- Modèle plus précis mais plus lent : `python transcrire.py nom.webm large-v3` (télécharge environ 3 Go la première fois). Par défaut : `medium`.
- Le script est réglé pour le français. Pour une autre langue, changer `language="fr"` dans `transcrire.py`.

## Messages normaux

- Les avertissements `huggingface_hub` sur les *symlinks* et `HF_TOKEN` : sans conséquence.
- L'avertissement `No supported JavaScript runtime` de yt-dlp : sans conséquence tant que le téléchargement aboutit.

## Pannes déjà rencontrées

| Message | Cause | Solution |
|---|---|---|
| `can't open file '…\transcrire.py'` | PowerShell n'est pas dans le bon dossier, ou le script n'y est pas | `cd C:\Users\lucas`, vérifier avec `dir transcrire.py` |
| `unexpected keyword argument 'metadata_errors'` | Ancienne version du script | Reprendre `transcrire.py` de ce dossier |
| Accents abîmés (`Ã©`) au collage | Lecture du fichier sans préciser l'encodage | Utiliser `-Encoding utf8` comme à l'étape 3 |
| Invite `>>` qui ne rend pas la main | PowerShell attend la fin d'un bloc collé | Appuyer sur Entrée jusqu'à revoir `PS C:\…>` |

## Limites

- La carte graphique AMD n'est pas utilisée (faster-whisper ne gère que NVIDIA) ; ça tourne sur le processeur.
- Les noms propres du jeu sont parfois mal transcrits.
- Les fichiers audio et les transcriptions brutes ne vont pas dans le repo (voir `.gitignore`) : seules des notes reformulées, avec lien et minutage.
