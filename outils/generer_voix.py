"""Génère les clips audio des annonces vocales du chrono (voix d'IA en ligne, ElevenLabs).

Les annonces sont assemblées de deux clips : le nom (« Soul Urn ») puis la fin (« dans trente secondes »,
« maintenant »). Ce script :
  1. écrit data/voix.json : la liste des clips (texte à dire, fichier attendu) ;
  2. avec --elevenlabs ID_DE_VOIX, génère les fichiers voix/*.mp3 manquants via l'API d'ElevenLabs ;
  3. avec --depuis, prépare des clips produits à la main (n'importe quel outil, n'importe quel format audio) :
     silences coupés, volume homogène, MP3 mono 44,1 kHz 128 kb/s, rangés sous le nom attendu dans voix/.

Usage :
  python3 outils/generer_voix.py                         # liste seulement (pour générer à la main)
  python3 outils/generer_voix.py --script                # texte à coller dans l'outil de voix, en une prise
  python3 outils/generer_voix.py --depuis                # prépare les fichiers bruts de medias/voix-brut/
  python3 outils/generer_voix.py --elevenlabs ID_VOIX    # génère avec l'API
  python3 outils/generer_voix.py --elevenlabs ID_VOIX --refaire   # régénère tout
  ... --outil "Fish Audio" --nom-voix "…" --licence "…"  # noté dans le meta de data/voix.json (gardé ensuite)

Fichiers bruts (dossier medias/voix-brut/, ignoré par git) :
  - soit un fichier par clip, nommé comme le clip attendu : nom-powerups.wav, fin-30.mp3… ;
  - soit une seule prise « prise.* » qui dit les 17 textes dans l'ordre de --script, séparés par une pause :
    elle est découpée sur les silences. Un fichier par clip l'emporte sur le morceau de la prise.
ffmpeg est pris dans le PATH, sinon dans le paquet imageio-ffmpeg (pip install imageio-ffmpeg).

La clé d'API se lit dans la variable ELEVENLABS_API_KEY ou dans outils/.cle_elevenlabs (ignoré par git).
Ne jamais mettre la clé dans un fichier commité.
"""

import argparse
import array
import json
import math
import os
import re
import shutil
import subprocess
import unicodedata
import urllib.request
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
VOIX = RACINE / "voix"
API = "https://api.elevenlabs.io/v1/text-to-speech/"
BRUT = RACINE / "medias/voix-brut"
FORMATS = (".wav", ".mp3", ".ogg", ".flac", ".m4a", ".webm", ".aac", ".opus")
TAUX = 44100
CIBLE_DB = -18.0   # RMS des passages parlés, en dBFS : proche de -16 LUFS pour une voix

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


# ---------- Préparation de clips produits à la main ----------

def ffmpeg():
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        raise SystemExit("ffmpeg introuvable : l'installer, ou pip install imageio-ffmpeg")


def decoder(chemin):
    sortie = subprocess.run([ffmpeg(), "-v", "error", "-i", str(chemin), "-ac", "1", "-ar", str(TAUX), "-f", "s16le", "-"],
                            capture_output=True, check=True).stdout
    a = array.array("h")
    a.frombytes(sortie)
    return [x / 32768 for x in a]


def encoder(echantillons, chemin):
    pcm = array.array("h", (max(-32768, min(32767, round(x * 32767))) for x in echantillons))
    subprocess.run([ffmpeg(), "-v", "error", "-y", "-f", "s16le", "-ar", str(TAUX), "-ac", "1", "-i", "-",
                    "-codec:a", "libmp3lame", "-b:a", "128k", str(chemin)], input=pcm.tobytes(), check=True)


def db(x):
    return 20 * math.log10(x) if x > 0 else -120.0


def enveloppe(e, pas=441):
    """RMS par fenêtre de 10 ms."""
    return [math.sqrt(sum(x * x for x in e[i:i + pas]) / len(e[i:i + pas])) for i in range(0, len(e), pas)]


def seuil(env):
    """Voix = 35 dB sous la fenêtre la plus forte, et au moins 12 dB au-dessus du bruit de fond (10e centile).
    Sans silence dans le fichier, ce « fond » est déjà de la voix : il ne monte alors pas à moins de 20 dB du maximum."""
    haut, fond = max(env), sorted(env)[len(env) // 10]
    return max(haut * 10 ** (-35 / 20), min(fond * 10 ** (12 / 20), haut * 10 ** (-20 / 20)), 10 ** (-60 / 20))


def decouper(e, pause_s):
    """Découpe une prise sur les silences d'au moins pause_s secondes. Renvoie les morceaux parlés."""
    env = enveloppe(e)
    s = seuil(env)
    morceaux, debut, silence = [], None, 0
    for i, v in enumerate(env):
        if v >= s:
            if debut is None:
                debut = i
            silence = 0
        elif debut is not None:
            silence += 1
            if silence * 0.01 >= pause_s:
                morceaux.append((debut, i - silence + 1))
                debut, silence = None, 0
    if debut is not None:
        morceaux.append((debut, len(env) - silence))
    # Marge de 150 ms autour de chaque morceau : la coupe fine est faite ensuite clip par clip.
    return [e[max(0, (a - 15) * 441):(b + 15) * 441] for a, b in morceaux if (b - a) >= 8]


def preparer(e, cible=CIBLE_DB, crete_max=None):
    """Coupe les silences, ramène le volume parlé à la cible (dBFS), limite les crêtes, adoucit les bords."""
    env = enveloppe(e)
    s = seuil(env)
    actifs = [i for i, v in enumerate(env) if v >= s]
    if not actifs:
        raise SystemExit("Clip muet ou illisible")
    debut = max(0, (actifs[0] - 2) * 441)            # 20 ms avant l'attaque (consonnes douces : « s », « f »)
    fin = min(len(e), (actifs[-1] + 5) * 441)        # 40 ms après : fin de souffle, sans trou
    e = e[debut:fin]
    parle = [v for v in env[actifs[0]:actifs[-1] + 1] if v >= s]
    gain = 10 ** ((cible - db(math.sqrt(sum(v * v for v in parle) / len(parle)))) / 20)
    if crete_max is not None:                        # sons percussifs : ne pas écraser les attaques
        gain = min(gain, 10 ** (crete_max / 20) / max(abs(x) for x in e))
    k = 0.7                                          # limiteur doux au-dessus de -3 dBFS
    def limiter(x):
        x *= gain
        m = abs(x)
        return x if m <= k else math.copysign(k + (0.99 - k) * math.tanh((m - k) / (0.99 - k)), x)
    e = [limiter(x) for x in e]
    n_in, n_out = int(0.005 * TAUX), int(0.015 * TAUX)
    for i in range(min(n_in, len(e))):
        e[i] *= i / n_in
    for i in range(min(n_out, len(e))):
        e[-1 - i] *= i / n_out
    return e


def depuis_brut(dossier, clips, pause_s):
    if not dossier.is_dir():
        raise SystemExit(f"Dossier absent : {dossier} (y déposer les fichiers bruts)")
    bruts = {f.stem: f for f in dossier.iterdir() if f.suffix.lower() in FORMATS}
    sources = {}
    prise = bruts.get("prise")
    if prise:
        morceaux = decouper(decoder(prise), pause_s)
        if len(morceaux) != len(clips):
            durees = ", ".join(f"{len(m) / TAUX:.1f}" for m in morceaux)
            raise SystemExit(f"{prise.name} : {len(morceaux)} morceaux trouvés pour {len(clips)} clips attendus "
                             f"(durées en s : {durees}). Allonger les pauses à l'enregistrement, ou régler --pause "
                             f"(actuellement {pause_s} s ; plus grand si un clip est coupé en deux, plus petit si deux sont collés).")
        sources = {k: (m, f"{prise.name} n°{i + 1}") for i, (k, m) in enumerate(zip(clips, morceaux))}
    for k in clips:
        if k in bruts:
            sources[k] = (bruts[k], bruts[k].name)
    inconnus = sorted(set(bruts) - set(clips) - {"prise"})
    if inconnus:
        print("Ignorés (nom inattendu) :", ", ".join(bruts[n].name for n in inconnus))
    VOIX.mkdir(exist_ok=True)
    for k, (src, origine) in sources.items():
        e = preparer(decoder(src) if isinstance(src, Path) else src)
        encoder(e, VOIX / (k + ".mp3"))
        duree = len(e) / TAUX
        alerte = "  ← durée hors 0,3-1,8 s, à réécouter" if not 0.3 <= duree <= 1.8 else ""
        print(f"préparé voix/{k}.mp3  {duree:.2f} s  crête {db(max(abs(x) for x in e)):.1f} dBFS  ({origine}){alerte}")


def main():
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--elevenlabs", metavar="ID_VOIX", help="identifiant de la voix ElevenLabs à utiliser")
    p.add_argument("--refaire", action="store_true", help="régénérer aussi les fichiers existants")
    p.add_argument("--script", action="store_true", help="affiche le texte à faire dire en une seule prise")
    p.add_argument("--depuis", nargs="?", const=str(BRUT), metavar="DOSSIER",
                   help="prépare les clips bruts de ce dossier (par défaut medias/voix-brut)")
    p.add_argument("--pause", type=float, default=0.35, help="silence minimal entre deux clips d'une prise, en s")
    p.add_argument("--outil", help="outil de voix utilisé (noté dans data/voix.json)")
    p.add_argument("--nom-voix", help="nom de la voix utilisée")
    p.add_argument("--licence", help="conditions d'usage de la voix et des clips")
    a = p.parse_args()

    clips = liste_clips()
    if a.script:
        print("À dire dans cet ordre, une ligne par clip, avec une pause nette (au moins une demi-seconde) entre chaque :\n")
        print("\n".join(t + ("…" if k.startswith("nom-") else ".") for k, t in clips.items()))
        print("\nEnregistrer la prise sous medias/voix-brut/prise.<ext>, puis : python3 outils/generer_voix.py --depuis")
        return
    VOIX.mkdir(exist_ok=True)
    if a.depuis:
        dossier = Path(a.depuis)
        depuis_brut(dossier if dossier.is_absolute() else Path.cwd() / dossier, clips, a.pause)
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
    try:
        ancien = json.loads((RACINE / "data/voix.json").read_text(encoding="utf-8")).get("meta", {})
    except (FileNotFoundError, ValueError):
        ancien = {}
    meta = {"note": "Clips des annonces vocales : nom puis fin, assemblés par js/voix.js. Liste produite par outils/generer_voix.py."}
    for champ, valeur in (("outil", a.outil or ("ElevenLabs" if a.elevenlabs else None)),
                          ("voix", a.nom_voix or a.elevenlabs), ("licence", a.licence)):
        meta[champ] = valeur or ancien.get(champ)
    manifeste = {
        "meta": meta,
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
