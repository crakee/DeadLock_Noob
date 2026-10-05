"""Génère des essais de sons d'alerte avec ElevenLabs (Sound Effects), d'après les prompts de docs/kit-audio-alertes.md.

Chaque essai est préparé comme les voix (silences coupés, volume homogène, MP3 mono 44,1 kHz) et rangé dans la
sonothèque medias/sonotheque/ (ignorée par git) : <groupe>-<n>.mp3, l'original non retouché dans brut/, et une fiche
par son dans index.json (style, niveau, prompt, durée, date, outil, offre et licence). On écoute, on choisit, puis on
copie le son retenu dans sons/.

Usage :
  python3 outils/generer_sons.py                          # 2 variantes de chaque style et niveau
  python3 outils/generer_sons.py --style fantasy --niveau epique --variantes 4
  python3 outils/generer_sons.py --prompt "..." --niveau notif --nom mix-lame-clavier --style-libre mix   # prompt libre

Coût : 40 crédits par seconde de son (durée fixée). La clé se lit comme pour generer_voix.py.
"""

import argparse
import datetime
import json
import urllib.error
import urllib.request
from pathlib import Path

from generer_voix import cle_api, decoder, encoder, preparer, RACINE, TAUX, db

API = "https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128"
SORTIE = RACINE / "medias/sonotheque"
# Coupe des silences : les effets ont des queues et des whooshs faibles, à garder (la voix coupe à 35 dB).
SOUS_MAX = 50
FIN = ", no reverb tail, no music bed, clean ending"

# Durée demandée (l'API impose au moins 0,5 s : le tic est raccourci à la préparation), influence du prompt,
# et volume visé : plus un son revient souvent, plus il est discret.
NIVEAUX = {
    "tic": {"duree": 0.5, "influence": 0.7, "cible": -24.0},
    "notif": {"duree": 1.0, "influence": 0.6, "cible": -20.0},
    "epique": {"duree": 2.5, "influence": 0.4, "cible": -18.0},
}

PROMPTS = {
    "ludique": {
        "tic": "Tiny soft wooden marimba blip, single note, round and gentle, cheerful game menu cursor, very short",
        "notif": "Bright two-note bell chime rising, cheerful major key, playful and bouncy, cozy console game notification",
        "epique": "Joyful short fanfare, sparkling bells and xylophone arpeggio climbing to a triumphant major chord, playful victory jingle",
    },
    "arene": {
        "tic": "Short crisp snap with tiny whoosh, punchy UI hit, tight and dry",
        "notif": "Punchy orchestral stab with quick whoosh, energetic arena show cue, tight and impactful",
        "epique": "Massive orchestral hit with rising whoosh and big drum impact, crowd roar swelling, hype arena announcement sting",
    },
    "fantasy": {
        "tic": "Soft crystalline shimmer ping, magical and subtle, short fantasy UI cue",
        "notif": "Short magical chime with low warm horn underneath, fantasy strategy game objective alert, clear and noble",
        "epique": "Deep war horn swelling into a heavy cinematic boom, low brass and timpani, magical sparkle on top, ominous epic fantasy objective spawn",
    },
    # Doux et satisfaisant (retour de l'utilisateur, 5 octobre 2026) : clavier mécanique feutré, ambiance japonaise.
    "clavier": {
        "tic": "Single deep thocky mechanical keyboard keystroke, lubed linear switch, creamy and muffled, warm low click, close-up, very satisfying ASMR",
        "notif": "Two quick deep thocky mechanical keyboard keystrokes, lubed switches, creamy muffled warm clicks, satisfying ASMR typing",
        "epique": "Satisfying cascade of deep thocky mechanical keyboard keystrokes ending with a soft heavy spacebar thock, creamy muffled warm sound, ASMR",
    },
    "japon": {
        "tic": "Single soft wooden block knock, small hollow Japanese temple wood block, warm and round, gentle, close-up",
        "notif": "Two gentle koto plucks rising, warm Japanese pentatonic, soft and calm, cozy notification",
        "epique": "Soft deep taiko drum hit followed by a gentle rising koto and kalimba pentatonic phrase and a light glass wind chime, warm, calm and satisfying, Japanese zen",
    },
}


def generer(texte, niveau, cle_secrete):
    n = NIVEAUX[niveau]
    corps = json.dumps({"text": texte + FIN, "duration_seconds": n["duree"], "prompt_influence": n["influence"]}).encode()
    req = urllib.request.Request(API, data=corps, method="POST",
                                 headers={"xi-api-key": cle_secrete, "Content-Type": "application/json", "Accept": "audio/mpeg"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.read()
    except urllib.error.HTTPError as e:
        raise SystemExit(f"ElevenLabs a refusé ({e.code}) : {e.read().decode(errors='replace')[:300]}")


def offre(cle_secrete):
    """Offre ElevenLabs du compte au moment de générer : la licence en dépend (gratuite = usage non commercial)."""
    req = urllib.request.Request("https://api.elevenlabs.io/v1/user/subscription", headers={"xi-api-key": cle_secrete})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.load(r).get("tier")
    except (urllib.error.URLError, ValueError):
        return None


def main():
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--style", choices=PROMPTS, action="append", help="style(s) à générer (tous par défaut)")
    p.add_argument("--niveau", choices=NIVEAUX, action="append", help="niveau(x) à générer (tous par défaut)")
    p.add_argument("--variantes", type=int, default=2)
    p.add_argument("--prompt", help="prompt libre (avec --niveau et --nom)")
    p.add_argument("--nom", help="nom des fichiers pour un prompt libre")
    p.add_argument("--repreparer", action="store_true", help="refait la préparation de tous les sons depuis brut/ (sans générer)")
    p.add_argument("--style-libre", default="libre", help="style noté dans l'index pour un prompt libre")
    a = p.parse_args()

    if a.repreparer:
        index = SORTIE / "index.json"
        donnees = json.loads(index.read_text(encoding="utf-8"))
        for nom, f in donnees["sons"].items():
            if not f.get("brut"):
                continue
            e = preparer(decoder(SORTIE / f["brut"]), NIVEAUX[f["niveau"]]["cible"], crete_max=-3.0, sous_max=SOUS_MAX)
            encoder(e, SORTIE / nom)
            print(f"{nom}  {f['duree']:.2f} → {len(e) / TAUX:.2f} s")
            f["duree"] = round(len(e) / TAUX, 2)
        index.write_text(json.dumps(donnees, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        return
    secret = cle_api()
    if not secret:
        raise SystemExit("Clé absente : variable ELEVENLABS_API_KEY ou fichier outils/.cle_elevenlabs")
    if a.prompt:
        if not (a.niveau and a.nom):
            raise SystemExit("--prompt demande --niveau et --nom")
        travaux = [(a.nom, a.style_libre, a.niveau[0], a.prompt)]
    else:
        travaux = [(f"{s}-{n}", s, n, PROMPTS[s][n]) for s in (a.style or PROMPTS) for n in (a.niveau or NIVEAUX)]

    SORTIE.mkdir(parents=True, exist_ok=True)
    index = SORTIE / "index.json"
    sons = json.loads(index.read_text(encoding="utf-8"))["sons"] if index.exists() else {}
    tier = offre(secret)
    for nom, style, niveau, texte in travaux:
        for _ in range(a.variantes):
            i = 1
            while (SORTIE / f"{nom}-{i}.mp3").exists():
                i += 1
            brut = SORTIE / "brut" / f"{nom}-{i}.mp3"      # gardé : on peut repréparer sans repayer
            brut.parent.mkdir(exist_ok=True)
            brut.write_bytes(generer(texte, niveau, secret))
            e = preparer(decoder(brut), NIVEAUX[niveau]["cible"], crete_max=-3.0, sous_max=SOUS_MAX)
            fichier = SORTIE / f"{nom}-{i}.mp3"
            encoder(e, fichier)
            sons[fichier.name] = {"groupe": nom, "style": style, "niveau": niveau, "prompt": texte,
                                  "duree": round(len(e) / TAUX, 2), "date": datetime.date.today().isoformat(),
                                  "outil": "ElevenLabs Sound Effects", "offre": tier,
                                  "licence": "usage non commercial" if tier == "free" else "commercial (selon l'offre)",
                                  "brut": "brut/" + brut.name}
            print(f"{fichier.relative_to(RACINE)}  {len(e) / TAUX:.2f} s  crête {db(max(abs(x) for x in e)):.1f} dBFS")
            index.write_text(json.dumps({"meta": {"note": "Sonothèque des essais de sons d'alerte, produite par outils/generer_sons.py."},
                                         "sons": sons}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
