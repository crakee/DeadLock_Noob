"""Transcrit une vidéo ou un fichier audio en texte horodaté (faster-whisper, sur processeur).

Usage : python transcrire.py fichier.webm [modele]
Écrit `fichier.webm.txt`, une ligne par segment : [mm:ss] texte. Mode d'emploi dans tuto_transcription.md.
"""

import os, sys
import av
import numpy as np
from faster_whisper import WhisperModel

fichier = sys.argv[1]
modele = sys.argv[2] if len(sys.argv) > 2 else "medium"

# Décodage fait ici : faster-whisper 1.2.1 appelle av.open() avec un argument
# que PyAV 19 n'accepte plus.
r = av.AudioResampler(format="s16", layout="mono", rate=16000)
morceaux = []
with av.open(fichier) as c:
    for trame in c.decode(audio=0):
        morceaux += [t.to_ndarray().reshape(-1) for t in r.resample(trame)]
morceaux += [t.to_ndarray().reshape(-1) for t in r.resample(None)]
audio = np.concatenate(morceaux).astype(np.float32) / 32768.0
print(f"Audio lu : {len(audio) / 16000 / 60:.1f} min")

# faster-whisper ne sait utiliser que les cartes NVIDIA ; par défaut il se limite à 4 threads.
m = WhisperModel(modele, device="cpu", compute_type="int8", cpu_threads=max(4, os.cpu_count() // 2))
segments, info = m.transcribe(audio, language="fr", vad_filter=True)
with open(fichier + ".txt", "w", encoding="utf-8") as f:
    for s in segments:
        f.write(f"[{int(s.start) // 60:02d}:{int(s.start) % 60:02d}] {s.text.strip()}\n")
        print(f"\r{s.end / info.duration:4.0%}", end="")
print("\nFini :", fichier + ".txt")
