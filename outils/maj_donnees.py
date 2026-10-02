"""Régénère data/heroes.json, data/items.json et data/hero-stats.json depuis api.deadlock-api.com.

Usage : python3 outils/maj_donnees.py --patch "City Never Sleeps" --depuis 2026-09-29
`--depuis` est la date du dernier patch : les statistiques ne remontent pas avant.

Les étiquettes `mecaniques` (héros) et `contre` (objets) sont déduites par mots-clés du texte
des compétences et des objets : c'est une base à relire, pas une vérité.
"""

import argparse
import datetime as dt
import html
import json
import re
import urllib.parse
import urllib.request
from pathlib import Path

API = "https://api.deadlock-api.com"
DATA = Path(__file__).resolve().parent.parent / "data"

# Tranches de rang : badge = tier * 10 + sous-rang (Initiate 1 = 11, Eternus 6 = 116).
TRANCHES = {
    "tous": (None, None),
    "initiate_sentinel": (11, 46),
    "mystic_oracle": (51, 86),
    "phantom_eternus": (91, 116),
}

# Ce que fait un héros, repéré dans le texte de ses compétences.
MECANIQUES = {
    "soin": r"\bheal|lifesteal|steals? (life|health)|drain|regenerat|restore[sd]? health",
    "bouclier": r"\bshield|barrier",
    "invisibilite": r"invisib|stealth",
    "controle": r"\bstun|sleep|immobiliz|\broot|knock(ed|s)? (up|back|down)|\blift|\bpull|\bdrag|\btether",
    "silence_desarmement": r"silenc|disarm",
    "ralentissement": r"\bslow",
    "mobilite": r"\bdash|teleport|\bleap|\bfly|flight|\bcharge forward|\bswing|\bswap",
    "degats_sur_la_duree": r"\bburn|bleed|poison|damage over time|\bdps\b|per second",
    "reduction_de_resistance": r"resist reduction|reduces? .{0,20}resist|-\d+(\.\d+)?% (bullet|spirit) resist",
    "anti_soin": r"healing reduction|reduces? .{0,20}heal|anti-heal",
    "invocation": r"summon|turret|\bclone|\bdecoy|\bminion",
    "zone": r"\barea\b|radius|\baoe\b|around (you|her|him)",
}

# Ce qu'un objet contre, repéré dans son texte et ses propriétés.
CONTRES = {
    "soin": r"healing reduction|heal(ing)? .{0,25}reduc|anti-heal|reduces? .{0,25}heal",
    "debuffs_et_controle": r"debuff resist|removes? all negative|purge|unstoppable|immune to (stun|silence)|debuff remover",
    "invisibilite": r"reveal",
    "degats_par_balles": r"bullet resist|bullet shield|bullet armor|weapon damage reduction|fire rate (slow|reduction)|reduces? .{0,20}fire rate|disarm",
    "degats_spirit": r"spirit resist|spirit shield|spirit armor|silenc",
    "mobilite": r"\bslow|movement slow|immobiliz|\broot|stamina reduc",
    "boucliers": r"shield .{0,20}(break|destroy|remove)|damage to shields|bonus .{0,15}vs shields",
    "soin_et_sustain_adverse_par_burst": r"execut",
}


def get(chemin, **params):
    params = {k: v for k, v in params.items() if v is not None}
    url = f"{API}{chemin}" + ("?" + urllib.parse.urlencode(params) if params else "")
    requete = urllib.request.Request(url, headers={"User-Agent": "DeadLockNoob-personnel"})
    with urllib.request.urlopen(requete, timeout=120) as reponse:
        return json.load(reponse)


def texte(brut):
    """Retire les icônes SVG et les balises des textes de l'API."""
    if not brut:
        return ""
    brut = re.sub(r"<svg.*?</svg>", "", brut, flags=re.S)
    brut = re.sub(r"<br\s*/?>", " · ", brut)
    brut = re.sub(r"<[^>]+>", "", brut)
    return re.sub(r"\s+", " ", html.unescape(brut)).strip()


def etiquettes(regles, contenu):
    contenu = contenu.lower()
    return sorted(nom for nom, motif in regles.items() if re.search(motif, contenu))


def nombre(valeur):
    try:
        return float(str(valeur).rstrip("m"))
    except (TypeError, ValueError):
        return None


def competence(a):
    proprietes = a.get("properties") or {}
    desc = a.get("description") or {}
    recharge = nombre((proprietes.get("AbilityCooldown") or {}).get("value"))
    canalisation = nombre((proprietes.get("AbilityChannelTime") or {}).get("value"))
    # Propriétés mises en avant par l'infobulle du jeu.
    cles = []
    for section in (a.get("tooltip_details") or {}).get("info_sections") or []:
        for bloc in section.get("properties_block") or []:
            for p in bloc.get("properties") or []:
                nom = p.get("important_property")
                if nom and nom in proprietes and proprietes[nom].get("label"):
                    v = proprietes[nom]
                    cles.append({"nom": v["label"], "valeur": f"{v.get('value', '')}{v.get('postfix', '')}"})
    return {
        "nom": a["name"],
        "image": a.get("image_webp") or a.get("image"),
        "resume": texte(desc.get("quip")),
        "description": texte(desc.get("desc")),
        "recharge_s": recharge if recharge else None,
        "canalisee": bool(canalisation and canalisation > 0),
        "valeurs": cles,
        "ameliorations": [texte(desc.get(k)) for k in ("t1_desc", "t2_desc", "t3_desc") if desc.get(k)],
    }


def construire_heros(heros, capacites):
    par_classe = {a["class_name"]: a for a in capacites}
    sortie = []
    for h in sorted(heros, key=lambda h: h["name"]):
        if not h.get("player_selectable") or h.get("disabled") or h.get("in_development"):
            continue
        comps = []
        for emplacement in ("signature1", "signature2", "signature3", "signature4"):
            a = par_classe.get((h.get("items") or {}).get(emplacement))
            if a:
                comps.append({"touche": int(emplacement[-1]), **competence(a)})
        # Effet de base seulement : les améliorations ajoutent du vol de vie ou un ralentissement à presque tout le monde.
        corpus = " ".join(f"{c['resume']} {c['description']}" for c in comps)
        mecaniques = etiquettes(MECANIQUES, corpus)
        if any(c["canalisee"] for c in comps):
            mecaniques.append("canalisation")
        d = h.get("description") or {}
        stats = h.get("starting_stats") or {}
        sortie.append({
            "id": h["id"],
            "nom": h["name"],
            "type": h.get("hero_type"),
            "complexite": h.get("complexity"),
            "etiquettes_jeu": h.get("tags") or [],
            "arme": h.get("gun_tag"),
            "role": texte(d.get("role")),
            "style_de_jeu": texte(d.get("playstyle")),
            "pv_depart": (stats.get("max_health") or {}).get("value"),
            "image": (h.get("images") or {}).get("icon_hero_card_webp"),
            "icone": (h.get("images") or {}).get("icon_image_small_webp"),
            "wiki": "https://deadlock.wiki/" + urllib.parse.quote(h["name"].replace(" ", "_")),
            "video": None,
            "mecaniques": sorted(mecaniques),
            "competences": comps,
        })
    return sortie


def construire_objets(objets):
    sortie = []
    for o in objets:
        if not o.get("shopable") or o.get("disabled"):
            continue
        morceaux = [texte((o.get("description") or {}).get("desc"))]
        for section in o.get("tooltip_sections") or []:
            for attribut in section.get("section_attributes") or []:
                morceaux.append(texte(attribut.get("loc_string")))
        description = " ".join(dict.fromkeys(m for m in morceaux if m))
        sortie.append({
            "id": o["id"],
            "nom": o["name"],
            "categorie": o.get("item_slot_type"),
            "tier": o.get("item_tier"),
            "cout": o.get("cost"),
            "actif": bool(o.get("is_active_item")),
            "image": o.get("shop_image_webp") or o.get("image_webp"),
            "description": description,
            "contre": etiquettes(CONTRES, description),
        })
    return sorted(sortie, key=lambda o: (o["categorie"] or "", o["tier"] or 0, o["nom"]))


def construire_stats(depuis_ts):
    tranches = {}
    for nom, (mini, maxi) in TRANCHES.items():
        lignes = get("/v1/analytics/hero-stats", min_unix_timestamp=depuis_ts,
                     min_average_badge=mini, max_average_badge=maxi)
        total = sum(l["matches"] for l in lignes) or 1
        tranches[nom] = {
            "badge_min": mini,
            "badge_max": maxi,
            "heros": {
                str(l["hero_id"]): {
                    "parties": l["matches"],
                    "winrate": round(100 * l["wins"] / l["matches"], 2) if l["matches"] else None,
                    # Part des parties où le héros est présent (12 joueurs par partie).
                    "presence": round(100 * 12 * l["matches"] / total, 2),
                    # Demi-largeur de l'intervalle à 95 %, en points de winrate.
                    "marge": round(98 / (l["matches"] ** 0.5), 2) if l["matches"] else None,
                }
                for l in lignes
            },
        }
    return tranches


def ecrire(nom, meta, contenu):
    DATA.mkdir(exist_ok=True)
    chemin = DATA / nom
    chemin.write_text(json.dumps({"meta": meta, **contenu}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{chemin.relative_to(DATA.parent)} : {chemin.stat().st_size // 1024} Ko")


def main():
    parseur = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parseur.add_argument("--patch", required=True, help="nom ou date du patch en cours")
    parseur.add_argument("--depuis", required=True, help="date du patch, AAAA-MM-JJ (UTC)")
    args = parseur.parse_args()

    depuis = dt.datetime.strptime(args.depuis, "%Y-%m-%d").replace(tzinfo=dt.timezone.utc)
    # Le lendemain du patch : on écarte les parties de la journée de déploiement.
    depuis_ts = int((depuis + dt.timedelta(days=1)).timestamp())
    meta = {
        "patch": args.patch,
        "verifie_le": dt.date.today().isoformat(),
        "source": API,
        "genere_par": "outils/maj_donnees.py",
    }

    heros = construire_heros(get("/v1/assets/heroes", only_active="true"),
                             get("/v1/assets/items/by-type/ability"))
    ecrire("heroes.json", {**meta, "note": "`mecaniques` est déduit par mots-clés : à relire. `video` est à remplir à la main."},
           {"heros": heros})

    objets = construire_objets(get("/v1/assets/items/by-type/upgrade"))
    ecrire("items.json", {**meta, "note": "`contre` est déduit par mots-clés : à relire."}, {"objets": objets})

    ecrire("hero-stats.json",
           {**meta, "depuis": (depuis + dt.timedelta(days=1)).date().isoformat(),
            "note": "Winrate en %, marge = intervalle à 95 % en points. Un écart inférieur à la marge n'est pas un signal. "
                    "Les tranches de rang ne couvrent que les parties dont le rang moyen est connu (environ un quart le 2026-10-02) ; "
                    "`tous` les inclut toutes."},
           {"tranches": construire_stats(depuis_ts)})

    print(f"{len(heros)} héros, {len(objets)} objets")


if __name__ == "__main__":
    main()
