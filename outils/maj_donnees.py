"""Régénère data/heroes.json, items.json, hero-stats.json et map.json depuis api.deadlock-api.com.

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
            "bullet_resist": nombre(((o.get("properties") or {}).get("BulletResist") or {}).get("value")) or None,
            "spirit_resist": nombre(((o.get("properties") or {}).get("TechResist") or {}).get("value")) or None,
        })
    return sorted(sortie, key=lambda o: (o["categorie"] or "", o["tier"] or 0, o["nom"]))


# Couches de la carte : (clé de l'API, id, nom, niveau, à quoi ça sert).
# niveau 1 = à connaître dès le début, 2 = quand les bases sont acquises, 3 = détail.
COUCHES = [
    ("shops", "shops", "Shops", 1, "Acheter sans rentrer en base. Les shops de lane ferment quand le Guardian tombe."),
    ("bridge_buffs", "powerups", "Powerups (ponts)", 1, "Bonus temporaire de 2:40, à prendre au heavy melee. Toutes les 5 min à partir de 5:00."),
    ("soul_urn_spawns", "urn_depart", "Soul Urn — apparition", 2, "L'urne apparaît ici à partir de 10:00, puis toutes les 5 min."),
    ("soul_urn_pads", "urn_depot", "Soul Urn — dépôt", 2, "Où livrer l'urne : de l'autre côté de la carte."),
    ("unstable_rifts", "rifts", "Unstable Rift", 2, "Zone à capturer en équipe sur le pont d'une lane extérieure."),
    ("teleporters", "teleporters", "Teleporters", 2, "Traverser la carte d'un côté à l'autre en 4 s de canalisation. Interdit avec l'urne."),
    ("healing_snacks", "soins", "Healing Snacks", 2, "Petit soin à ramasser."),
    ("crates", "crates", "Crates", 3, "Caisses : chance de lâcher des souls. À casser sur le trajet."),
    ("tough_crates", "tough_crates", "Tough Crates", 3, "Caisses renforcées : heavy melee obligatoire."),
    ("golden_statues", "buff_containers", "Buff Containers", 3, "Une chance sur deux de lâcher un buff permanent."),
    ("bells", "cloches", "Cloche (Bell Tower)", 3, "Y casser quelque chose sonne sur toute la carte : tout le monde sait que tu y es."),
    ("steam_vents", "steam_vents", "Steam Vents", 3, "Invisible tant qu'on reste dessus."),
    ("cosmic_veils", "veils", "Cosmic Veils", 3, "Rideaux qui bloquent la vue, pas le passage."),
    ("climb_ropes", "cordes", "Cordes", 3, "Monter sur les toits."),
    ("bounce_pads", "bounce_pads", "Bounce pads", 3, "Tremplins vers les hauteurs."),
]
CAMPS = {
    "weak": ("camps_small", "Small camps", 1, "Les plus faciles : dès 2:00, réapparaissent 1:25 après nettoyage. Viser l'œil."),
    "medium": ("camps_medium", "Medium camps", 2, "À partir de 5:00, réapparaissent 4:50 après nettoyage."),
    "strong": ("camps_large", "Large camps", 2, "À partir de 8:00. Résistants : à éviter tant qu'on ne les tue pas vite."),
    "vault": ("sinners", "Sinner's Sacrifice", 2, "À partir de 8:00. Mêlée uniquement ; finir au heavy melee sur le jackpot pour 4 buffs."),
}
STRUCTURES = {"tier1": "Guardian", "tier2": "Walker", "titan": "Patron", "core": "Base"}


def point(e):
    return [round(e["left_relative"], 4), round(e["top_relative"], 4)]


def construire_carte(m):
    rayon = m["radius"]
    couches = []
    structures = []
    for cle, pos in m["objective_positions"].items():
        equipe, genre = cle.split("_")[0], cle.split("_")[1]
        structures.append({"type": STRUCTURES.get(genre, genre), "equipe": int(equipe[-1]), "xy": point(pos)})
    couches.append({"id": "structures", "nom": "Structures", "niveau": 1,
                    "a_quoi_ca_sert": "Guardian puis Walker sur chaque lane, puis la base et le Patron. C'est ce qu'on défend et ce qu'on attaque.",
                    "elements": structures})
    lignes = []
    for z in m["zipline_paths"]:
        ox, oy = z["origin"][0], z["origin"][1]
        trace = [[round((ox + p[0] + rayon) / (2 * rayon), 4), round((rayon - (oy + p[1])) / (2 * rayon), 4)] for p in z["P0_points"]]
        lignes.append({"couleur": z["color"], "trace": trace})
    couches.append({"id": "lanes", "nom": "Lanes et ziplines", "niveau": 1,
                    "a_quoi_ca_sert": "Les trois lanes. La zipline n'est utilisable que jusqu'où tes Troopers ont avancé.",
                    "lignes": lignes})
    for genre, (ident, nom, niveau, role) in CAMPS.items():
        elements = [{"nom": c["name"], "xy": point(c)} for c in m["neutral_camps"] if c["kind"] == genre]
        couches.append({"id": ident, "nom": nom, "niveau": niveau, "a_quoi_ca_sert": role, "elements": elements})
    for cle, ident, nom, niveau, role in COUCHES:
        elements = []
        for e in m["entities"].get(cle) or []:
            el = {"xy": point(e)}
            if e.get("kind"):
                el["type"] = e["kind"]
            if e.get("team") is not None:
                el["equipe"] = e["team"]
            elements.append(el)
        couches.append({"id": ident, "nom": nom, "niveau": niveau, "a_quoi_ca_sert": role, "elements": elements})
    # Absent de l'API : le wiki le situe au centre exact de la carte, sous Broadway.
    couches.append({"id": "midboss", "nom": "Mid-Boss", "niveau": 2,
                    "a_quoi_ca_sert": "Boss neutre dans une fosse souterraine. Le tuer donne des souls et un cristal de résurrection.",
                    "elements": [{"xy": [0.5, 0.5], "approximatif": True}]})
    return {"image": m["images"]["minimap"], "image_tunnels": m["images"].get("mid_tunnels"),
            "couches": sorted(couches, key=lambda c: c["niveau"])}


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


def proba_attendue(pa, pb):
    """Winrate attendu de A contre B d'après leurs winrates globaux (méthode log5)."""
    return pa * (1 - pb) / (pa * (1 - pb) + (1 - pa) * pb)


def construire_matchups(depuis_ts, stats):
    """Pour chaque héros et chaque tranche : les adversaires contre qui il fait mieux ou moins bien
    que prévu, une fois corrigé de la force des deux héros. Écart et marge en points de winrate."""
    tranches = {}
    for nom, (mini, maxi) in TRANCHES.items():
        globaux = stats[nom]["heros"]
        lignes = get("/v1/analytics/hero-counter-stats", min_unix_timestamp=depuis_ts,
                     min_average_badge=mini, max_average_badge=maxi)
        par_heros = {}
        for l in lignes:
            a, b, n = str(l["hero_id"]), str(l["enemy_hero_id"]), l["matches_played"]
            if a == b or n < 30 or a not in globaux or b not in globaux:
                continue
            attendu = proba_attendue(globaux[a]["winrate"] / 100, globaux[b]["winrate"] / 100)
            par_heros.setdefault(a, []).append({
                "contre": int(b),
                "parties": n,
                "winrate": round(100 * l["wins"] / n, 1),
                "ecart": round(100 * (l["wins"] / n - attendu), 1),
                "marge": round(98 / n ** 0.5, 1),
            })
        tranches[nom] = {
            h: {
                # Ceux qu'il bat le plus, puis ceux qui le battent le plus.
                "bat": sorted(m, key=lambda x: -x["ecart"])[:5],
                "perd": sorted(m, key=lambda x: x["ecart"])[:5],
                "signaux": sum(1 for x in m if abs(x["ecart"]) > x["marge"]),
                "adversaires": len(m),
            }
            for h, m in par_heros.items()
        }
    return tranches


UNITES_PAR_METRE = 39.37


def metres(unites):
    return unites / UNITES_PAR_METRE if isinstance(unites, (int, float)) else None


def construire_fiches(heros_api, armes):
    """Statistiques de base de chaque héros et de son arme, au niveau 1 sans objet."""
    armes = {a["class_name"]: a for a in armes}
    fiches = {}
    for h in heros_api:
        if not h.get("player_selectable") or h.get("disabled") or h.get("in_development"):
            continue
        st = {k: (v or {}).get("value") for k, v in (h.get("starting_stats") or {}).items()}
        arme = (armes.get((h.get("items") or {}).get("weapon_primary")) or {}).get("weapon_info") or {}
        arrondi = lambda v, n=1: round(v, n) if isinstance(v, (int, float)) else None
        fiches[str(h["id"])] = {
            "pv": st.get("max_health"),
            "regen_pv_s": st.get("base_health_regen"),
            "vitesse_m_s": st.get("max_move_speed"),
            "stamina": st.get("stamina"),
            "melee_leger": st.get("light_melee_damage"),
            "melee_lourd": st.get("heavy_melee_damage"),
            "arme": {
                "degats_balle": arrondi(arme.get("bullet_damage"), 2),
                "balles_par_tir": arme.get("bullets"),
                "tirs_par_s": arrondi(arme.get("shots_per_second"), 2),
                "chargeur": arme.get("clip_size"),
                "rechargement_s": arme.get("reload_duration"),
                "dps": arrondi(arme.get("damage_per_second")),
                "dps_avec_rechargement": arrondi(arme.get("damage_per_second_with_reload")),
                # Distances en mètres : 1 m = 39,37 unités du moteur (recoupé avec le tableau
                # « Base Falloff Range » de deadlock.wiki, page Falloff Range, le 2026-10-04).
                "degats_pleins_jusqu_a_m": arrondi(metres(arme.get("damage_falloff_start_range"))),
                "degats_minimum_des_m": arrondi(metres(arme.get("damage_falloff_end_range"))),
                "chute_degats_pct": arrondi(-100 + 100 * arme["damage_falloff_end_scale"], 0)
                if isinstance(arme.get("damage_falloff_end_scale"), (int, float)) else None,
                "portee_max_m": arrondi(metres(arme.get("range"))),
            },
        }
    return fiches


def construire_achats(depuis_ts, stats, objets, heros_ids):
    """Objets achetés par au moins 20 % des joueurs d'un héros, rangés par moment moyen d'achat."""
    par_id = {o["id"]: o for o in objets}
    sortie = {}
    for nom, (mini, maxi) in TRANCHES.items():
        sortie[nom] = {}
        for hid in heros_ids:
            joueurs = (stats[nom]["heros"].get(str(hid)) or {}).get("parties") or 0
            if not joueurs:
                continue
            lignes = get("/v1/analytics/item-stats", hero_id=hid, min_unix_timestamp=depuis_ts,
                         min_average_badge=mini, max_average_badge=maxi)
            liste = []
            for l in lignes:
                o = par_id.get(l["item_id"])
                taux = l["matches"] / joueurs
                if not o or taux < 0.2 or l.get("avg_buy_time_s") is None:
                    continue
                liste.append({"nom": o["nom"], "categorie": o["categorie"], "tier": o["tier"], "cout": o["cout"],
                              "actif": o["actif"], "achete_par": round(100 * taux),
                              "minute": round(l["avg_buy_time_s"] / 60, 1),
                              "winrate": round(100 * l["wins"] / l["matches"], 1)})
            sortie[nom][str(hid)] = {"parties": joueurs, "objets": sorted(liste, key=lambda x: x["minute"])}
    return sortie


# Durées de partie (secondes) pour lire quand un héros est fort : parties courtes, moyennes, longues.
DUREES = [(0, 25 * 60), (25 * 60, 35 * 60), (35 * 60, 7000)]
# Tranches pour lesquelles on calcule les objets clés de chaque héros (39 appels par tranche).
TRANCHES_OBJETS_CLES = ("tous", "initiate_sentinel")


def construire_tempo(depuis_ts, stats, objets):
    """Par tranche et par héros : winrate selon la durée de la partie, et objets clés
    (tier 3 et plus, achetés par au moins 35 % des joueurs) avec leur minute moyenne d'achat."""
    par_id = {o["id"]: o for o in objets}
    sortie = {}
    for nom, (mini, maxi) in TRANCHES.items():
        tranche = {}
        for de, a in DUREES:
            for l in get("/v1/analytics/hero-stats", min_unix_timestamp=depuis_ts, min_duration_s=de, max_duration_s=a,
                         min_average_badge=mini, max_average_badge=maxi):
                n = l["matches"]
                tranche.setdefault(str(l["hero_id"]), {"durees": [], "objets_cles": []})["durees"].append({
                    "de_min": de // 60, "a_min": a // 60 if a < 7000 else None, "parties": n,
                    "winrate": round(100 * l["wins"] / n, 1) if n else None,
                    "marge": round(98 / n ** 0.5, 1) if n else None})
        if nom in TRANCHES_OBJETS_CLES:
            for hid, h in tranche.items():
                joueurs = (stats[nom]["heros"].get(hid) or {}).get("parties") or 0
                if not joueurs:
                    continue
                cles = []
                for l in get("/v1/analytics/item-stats", hero_id=int(hid), min_unix_timestamp=depuis_ts,
                             min_average_badge=mini, max_average_badge=maxi):
                    o = par_id.get(l["item_id"])
                    if o and (o["tier"] or 0) >= 3 and l["matches"] / joueurs >= 0.35 and l.get("avg_buy_time_s"):
                        cles.append({"nom": o["nom"], "cout": o["cout"], "categorie": o["categorie"], "actif": o["actif"],
                                     "achete_par": round(100 * l["matches"] / joueurs),
                                     "minute": round(l["avg_buy_time_s"] / 60, 1)})
                h["objets_cles"] = sorted(cles, key=lambda x: x["minute"])[:6]
        sortie[nom] = tranche
    return sortie


def ecrire(nom, meta, contenu):
    DATA.mkdir(exist_ok=True)
    chemin = DATA / nom
    chemin.write_text(json.dumps({"meta": meta, **contenu}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{chemin.relative_to(DATA.parent)} : {chemin.stat().st_size // 1024} Ko")


def main():
    parseur = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parseur.add_argument("--patch", required=True, help="nom ou date du patch en cours")
    parseur.add_argument("--depuis", required=True, help="date du patch, AAAA-MM-JJ (UTC)")
    parseur.add_argument("--seulement", default="", help="fichiers à régénérer, séparés par des virgules "
                         "(heroes,items,stats,map,details,achats,tempo) ; tous par défaut")
    args = parseur.parse_args()
    voulu = lambda nom: not args.seulement or nom in args.seulement.split(",")

    depuis = dt.datetime.strptime(args.depuis, "%Y-%m-%d").replace(tzinfo=dt.timezone.utc)
    # Le lendemain du patch : on écarte les parties de la journée de déploiement.
    depuis_ts = int((depuis + dt.timedelta(days=1)).timestamp())
    meta = {
        "patch": args.patch,
        "verifie_le": dt.date.today().isoformat(),
        "source": API,
        "genere_par": "outils/maj_donnees.py",
    }

    heros_api = get("/v1/assets/heroes", only_active="true")
    heros = construire_heros(heros_api, get("/v1/assets/items/by-type/ability"))
    if voulu("heroes"):
        ecrire("heroes.json", {**meta, "note": "`mecaniques` est déduit par mots-clés : à relire. `video` est à remplir à la main."},
           {"heros": heros})

    objets = construire_objets(get("/v1/assets/items/by-type/upgrade"))
    if voulu("items"):
        ecrire("items.json", {**meta, "note": "`contre` est déduit par mots-clés : à relire."}, {"objets": objets})

    stats = construire_stats(depuis_ts)
    depuis_texte = (depuis + dt.timedelta(days=1)).date().isoformat()
    if voulu("stats"):
        ecrire("hero-stats.json",
           {**meta, "depuis": (depuis + dt.timedelta(days=1)).date().isoformat(),
            "note": "Winrate en %, marge = intervalle à 95 % en points. Un écart inférieur à la marge n'est pas un signal. "
                    "Les tranches de rang ne couvrent que les parties dont le rang moyen est connu (environ un quart le 2026-10-02) ; "
                    "`tous` les inclut toutes."},
           {"tranches": stats})

    if voulu("details"):
        ecrire("heros-details.json",
               {**meta, "depuis": depuis_texte,
                "note": "`fiches` : stats de base au niveau 1 sans objet (vitesse en m/s, arme : dégâts par balle et par seconde). "
                        "`matchups` : par tranche de rang, écart = winrate réel contre cet adversaire moins le winrate attendu "
                        "d'après la force globale des deux héros (log5), en points. Un écart inférieur à la marge (95 %) n'est pas un signal."},
               {"fiches": construire_fiches(heros_api, get("/v1/assets/items/by-type/weapon")),
                "matchups": construire_matchups(depuis_ts, stats)})

    if voulu("tempo"):
        ecrire("tempo.json",
               {**meta, "depuis": depuis_texte,
                "note": "Par tranche de rang : `durees` = winrate du héros selon la durée de la partie (en minutes, marge à 95 % en points) ; "
                        "un héros dont le winrate monte avec la durée est fort en fin de partie. `objets_cles` (tranches tous et "
                        "initiate_sentinel seulement) = objets de tier 3 ou plus achetés par au moins 35 % de ses joueurs, avec la "
                        "minute moyenne d'achat : les moments où il devient plus fort."},
               {"tranches": construire_tempo(depuis_ts, stats, objets)})

    if voulu("achats"):
        profil = json.loads((DATA / "profil.json").read_text(encoding="utf-8"))
        ids = profil["heros_joues"] + profil["heros_a_essayer"]
        ecrire("achats.json",
               {**meta, "depuis": depuis_texte,
                "note": "Objets achetés par au moins 20 % des joueurs du héros depuis le patch, par tranche de rang, "
                        "rangés par minute moyenne d'achat. `achete_par` en % des parties du héros. Héros de data/profil.json."},
               {"tranches": construire_achats(depuis_ts, stats, objets, ids)})

    carte = construire_carte(get("/v1/assets/map"))
    if voulu("map"):
        ecrire("map.json", {**meta, "note": "Positions en fraction de l'image (x depuis la gauche, y depuis le haut). "
                                        "Le Mid-Boss n'a pas de position dans l'API : il est sous le centre de la carte. "
                                        "`niveau` : 1 débutant, 2 intermédiaire, 3 détail."}, carte)

    print(f"{len(heros)} héros, {len(objets)} objets, {len(carte['couches'])} couches de carte")


if __name__ == "__main__":
    main()
