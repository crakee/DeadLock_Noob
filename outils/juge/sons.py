"""Fiche d'écoute des sons et voix pour l'agent juge (docs/brief-juge.md).

Le juge n'entend pas : pour chaque fichier de sons/ et voix/, on mesure la durée, le volume perçu
(LUFS intégré, norme EBU R128 ; un jeu se mixe autour de -14 à -23 LUFS) et le pic vrai, et on
dessine un spectrogramme (PNG) qu'il peut regarder. Les sons synthétisés (Web Audio) n'ont pas de
fichier : leurs notes sont lisibles dans js/sons.js.

Usage : .venv/bin/python outils/juge/sons.py   → outils/juge/sorties/sons/ (non versionné)
"""
import json, re, subprocess, sys
from pathlib import Path

import imageio_ffmpeg

RACINE = Path(__file__).resolve().parents[2]
SORTIE = RACINE / 'outils' / 'juge' / 'sorties' / 'sons'
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()


def mesurer(f):
    r = subprocess.run([FFMPEG, '-hide_banner', '-loglevel', 'verbose', '-i', str(f), '-af', 'apad=pad_dur=1,ebur128=peak=true', '-f', 'null', '-'],
                       capture_output=True, text=True).stderr
    duree = re.search(r'Duration: (\d+):(\d+):([\d.]+)', r)
    lufs = re.findall(r'I:\s+(-?[\d.]+) LUFS', r)
    pic = re.findall(r'Peak:\s+(-?[\d.]+|-inf) dBFS', r)
    # Niveau « momentané » (fenêtre de 400 ms) : seul fiable pour un son très court, où le LUFS intégré s'effondre.
    momentane = [float(x) for x in re.findall(r'M:\s*(-?[\d.]+)', r) if float(x) > -120]
    return {
        'm_max': max(momentane) if momentane else None,
        'duree_s': round(int(duree[1]) * 3600 + int(duree[2]) * 60 + float(duree[3]), 2) if duree else None,
        'lufs': float(lufs[-1]) if lufs else None,
        'pic_dbfs': pic[-1] if pic else None,
    }


def spectrogramme(f, png):
    subprocess.run([FFMPEG, '-hide_banner', '-loglevel', 'error', '-y', '-i', str(f), '-lavfi',
                    'showspectrumpic=s=800x300:legend=1', str(png)], check=True)


def main():
    SORTIE.mkdir(parents=True, exist_ok=True)
    textes = {k: v.get('texte') for k, v in json.loads((RACINE / 'data' / 'voix.json').read_text())['clips'].items()}
    # Gains appliqués par le site au réglage par défaut (volume 0,7) : sons × volume (js/sons.js),
    # voix × min(1, 0,4 + volume) (js/voix.js). Niveau effectif = momentané max + gain.
    import math
    gain = {'sons': 20 * math.log10(0.7), 'voix': 20 * math.log10(min(1, 0.4 + 0.7))}
    lignes = ['# Fiche d\'écoute', '', 'Niveau effectif = niveau momentané max (400 ms) + gain du site au volume par défaut (0,7).', '',
              '| Fichier | Dit | Durée | LUFS intégré | Momentané max | Effectif | Pic (dBFS) | Spectrogramme |', '|---|---|---|---|---|---|---|---|']
    for dossier in ('sons', 'voix'):
        for f in sorted((RACINE / dossier).glob('*.mp3')):
            m = mesurer(f)
            png = SORTIE / (f.stem + '.png')
            spectrogramme(f, png)
            eff = round(m['m_max'] + gain[dossier], 1) if m['m_max'] is not None else None
            lignes.append(f"| `{dossier}/{f.name}` | {textes.get(f.stem, '—')} | {m['duree_s']} s | {m['lufs']} | {m['m_max']} | {eff} | {m['pic_dbfs']} | `{png.name}` |")
    manquants = [k for k, v in json.loads((RACINE / 'data' / 'voix.json').read_text())['clips'].items() if not v.get('fichier')]
    lignes += ['', f'Clips de voix sans fichier (voix du navigateur à la place) : {", ".join(manquants) or "aucun"}.']
    (SORTIE / 'fiche.md').write_text('\n'.join(lignes) + '\n')
    print(SORTIE / 'fiche.md')


if __name__ == '__main__':
    sys.exit(main())
