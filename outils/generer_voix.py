"""Génère les clips audio des annonces vocales du chrono (voix d'IA en ligne, ElevenLabs).

Les annonces sont assemblées de deux clips : le nom (« Soul Urn ») puis la fin (« dans trente secondes »,
« maintenant »). Ce script :
  1. écrit data/voix.json : la liste des clips (texte à dire, fichier attendu) ;
  2. avec --elevenlabs ID_DE_VOIX, génère les fichiers voix/*.mp3 manquants via l'API d'ElevenLabs.

Usage :
  python3 outils/generer_voix.py                         # liste seulement (pour générer à la main)
  python3 outils/generer_voix.py --elevenlabs ID_VOIX    # génère avec l'API
  python3 outils/generer_voix.py --elevenlabs ID_VOIX --refaire   # régénère tout

La clé d'API se lit dans la variable ELEVENLABS_API_KEY ou dans outils/.cle_elevenlabs (ignoré par git).
Ne jamais mettre la clé dans un fichier commité.
"""

import argparse
import json
import os
import re
import unicodedata
import urllib.request
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
VOIX = RACINE / "voix"
API = "https://api.elevenlabs.io/v1/text-to-speech/"

# Fins d'annonce : préavis possibles (15 à 60 s dans data/timeline.json, + 0/15/30 s de réglage) et « maintenant ».
FINS = {
    "15": "dans quinze secondes", "30": "dans trente secondes", "45": "dans quarante-cinq secondes",
    "60": "dans une minute", "75": "dans une minute quinze", "90": "dans une minute trente",
    "maintenant": "maintenant",
}
# Prononciation : les noms anglais du jeu, écrits pour être bien dits par une voix française si besoin.
PRONONCIATION = {}


def cle(nom):
    """Même règle que js/voix.js : minuscules, sans accents ni ponctuation, tirets."""
    n = unicodedata.normalize("NFD", nom.split(" (")[0]).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", n).strip("-")


def liste_clips():
    timeline = json.loads((RACINE / "data/timeline.json").read_text(encoding="utf-8"))
    noms = [e["nom"] for e in timeline["evenements"] if e.get("annonce_avant_s")] + [d["nom"] for d in timeline["declenches"]]
    clips = {}
    for nom in noms:
        court = nom.split(" (")[0]
        clips["nom-" + cle(nom)] = PRONONCIATION.get(court, court)
    for k, texte in FINS.items():
        clips["fin-" + k] = texte
    return clips


def cle_api():
    if os.environ.get("ELEVENLABS_API_KEY"):
        return os.environ["ELEVENLABS_API_KEY"].strip()
    f = Path(__file__).resolve().parent / ".cle_elevenlabs"
    return f.read_text().strip() if f.exists() else None


def generer(texte, voix, cle_secrete, chemin):
    corps = json.dumps({"text": texte, "model_id": "eleven_multilingual_v2",
                        "voice_settings": {"stability": 0.5, "similarity_boost": 0.75}}).encode()
    req = urllib.request.Request(API + voix + "?output_format=mp3_44100_128", data=corps, method="POST",
                                 headers={"xi-api-key": cle_secrete, "Content-Type": "application/json", "Accept": "audio/mpeg"})
    with urllib.request.urlopen(req, timeout=60) as r:
        chemin.write_bytes(r.read())


def main():
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--elevenlabs", metavar="ID_VOIX", help="identifiant de la voix ElevenLabs à utiliser")
    p.add_argument("--refaire", action="store_true", help="régénérer aussi les fichiers existants")
    a = p.parse_args()

    clips = liste_clips()
    VOIX.mkdir(exist_ok=True)
    if a.elevenlabs:
        secret = cle_api()
        if not secret:
            raise SystemExit("Clé absente : variable ELEVENLABS_API_KEY ou fichier outils/.cle_elevenlabs")
        for k, texte in clips.items():
            chemin = VOIX / (k + ".mp3")
            if chemin.exists() and not a.refaire:
                continue
            generer(texte, a.elevenlabs, secret, chemin)
            print("généré", chemin.relative_to(RACINE), "·", texte)

    presents = {k: "voix/" + k + ".mp3" for k in clips if (VOIX / (k + ".mp3")).exists()}
    manifeste = {
        "meta": {"note": "Clips des annonces vocales : nom puis fin, assemblés par js/voix.js. Liste produite par outils/generer_voix.py.",
                 "voix": a.elevenlabs or None},
        "clips": {k: {"texte": t, "fichier": presents.get(k)} for k, t in clips.items()},
    }
    (RACINE / "data/voix.json").write_text(json.dumps(manifeste, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"data/voix.json : {len(clips)} clips, {len(presents)} fichiers présents dans voix/")
    if len(presents) < len(clips):
        print("Manquants (à générer, noms de fichiers attendus) :")
        for k, t in clips.items():
            if k not in presents:
                print(f"  voix/{k}.mp3  ←  « {t} »")


if __name__ == "__main__":
    main()
