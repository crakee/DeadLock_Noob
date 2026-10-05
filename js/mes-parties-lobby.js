// Mes parties : mesures d'une partie pour les 12 joueurs, et notes par domaine en comparant le joueur
// aux 11 autres joueurs de la même partie (même niveau de jeu, même partie : la comparaison la plus juste
// quand le compte n'a pas encore de rang). Utilisé par js/mes-parties.js.
(function () {
  'use strict';

  const RAYON_CARTE = 10752;   // /v1/assets/map, radius (patch City Never Sleeps)
  const ISOLE = 2000;          // unités du jeu : aucun allié plus près au moment de la mort = mort isolé
  const SURPRIS_S = 3;         // tué en moins de 3 s = pris par surprise

  // Mesures. sens : 1 = plus haut c'est mieux, -1 = plus bas c'est mieux.
  const MESURES = {
    creeps_9: { nom: 'Troopers tués à 9 min (part des Troopers à portée)', sens: 1, fmt: 'pct' },
    orbes: { nom: 'Orbes de Troopers récupérées (souls en plus)', sens: 1, fmt: 'pct' },
    ecart_lane_9: { nom: 'Écart de souls avec tes adversaires de lane à 9 min', sens: 1, fmt: 'signe' },
    presence_lane: { nom: 'Temps passé dans ta lane (1:30–9:00)', sens: 1, fmt: 'pct' },
    denies_9: { nom: 'Denies à 9 min', sens: 1, fmt: 'n' },
    souls_min: { nom: 'Souls par minute', sens: 1, fmt: 'n' },
    jungle_min: { nom: 'Souls de jungle par minute', sens: 1, fmt: 'n' },
    morts: { nom: 'Morts', sens: -1, fmt: 'n' },
    temps_mort: { nom: 'Temps passé mort', sens: -1, fmt: 'pct' },
    isoles: { nom: 'Morts loin de ton équipe', sens: -1, fmt: 'n' },
    inferiorite: { nom: 'Morts en infériorité numérique', sens: -1, fmt: 'n' },
    engage_bas: { nom: 'Morts après avoir engagé avec moins de 50 % de vie', sens: -1, fmt: 'n' },
    vie_basse: { nom: 'Temps hors base sous 30 % de vie', sens: -1, fmt: 'pct' },
    degats_min: { nom: 'Dégâts aux héros par minute', sens: 1, fmt: 'n' },
    participation: { nom: 'Participation aux kills de ton équipe', sens: 1, fmt: 'pct' },
    efficacite: { nom: 'Part des dégâts de ton équipe ÷ part de ses souls', sens: 1, fmt: 'x' },
    precision: { nom: 'Précision sur les héros', sens: 1, fmt: 'pct' },
    headshots: { nom: 'Headshots (part de tes balles qui touchent)', sens: 1, fmt: 'pct' },
    portee: { nom: 'Tirs touchés sans perte de dégâts (bonne distance)', sens: 1, fmt: 'pct' },
    esquive: { nom: 'Précision des ennemis sur toi', sens: -1, fmt: 'pct' },
    objectifs: { nom: 'Souls d\'objectifs et boss', sens: 1, fmt: 'n' },
    boss_min: { nom: 'Dégâts aux objectifs par minute', sens: 1, fmt: 'n' },
    powerups: { nom: 'Bonus ramassés (statues, Powerups)', sens: 1, fmt: 'n' },
    gros_objet: { nom: 'Premier objet à 3 000 ou plus (minute)', sens: -1, fmt: 'min' },
    souls_dormantes: { nom: 'Souls gardées sans les dépenser (moyenne)', sens: -1, fmt: 'n' },
    points_dormants: { nom: 'Points de compétence oubliés (points × minutes)', sens: -1, fmt: 'n' }
  };

  const DOMAINES = [
    { id: 'lane', nom: 'Lane', mesures: ['creeps_9', 'orbes', 'ecart_lane_9', 'presence_lane', 'denies_9'] },
    { id: 'farm', nom: 'Farm', mesures: ['souls_min', 'jungle_min'] },
    { id: 'survie', nom: 'Survie', mesures: ['morts', 'temps_mort', 'isoles', 'inferiorite', 'engage_bas', 'vie_basse'] },
    { id: 'combat', nom: 'Combat', mesures: ['degats_min', 'participation', 'efficacite'] },
    { id: 'tir', nom: 'Tir', mesures: ['precision', 'headshots', 'portee', 'esquive'] },
    { id: 'objectifs', nom: 'Objectifs', mesures: ['objectifs', 'boss_min', 'powerups'] },
    { id: 'build', nom: 'Achats', mesures: ['gros_objet', 'souls_dormantes', 'points_dormants'] }
  ];

  const LETTRES = [[0.8, 'A'], [0.6, 'B'], [0.4, 'C'], [0.2, 'D'], [-1, 'E']];
  const lettre = (s) => (s == null ? '—' : LETTRES.find((l) => s >= l[0])[1]);

  // Position sur la minimap, en fraction de l'image (même calcul que outils/maj_donnees.py).
  const versCarte = (x, y) => [(x + RAYON_CARTE) / (2 * RAYON_CARTE), (RAYON_CARTE - y) / (2 * RAYON_CARTE)];

  function trajets(info) {
    const mp = info.match_paths;
    const out = {};
    if (!mp || !mp.paths) return out;
    mp.paths.forEach((pa) => {
      out[pa.player_slot] = {
        x0: pa.x_min, sx: (pa.x_max - pa.x_min) / mp.x_resolution, xs: pa.x_pos,
        y0: pa.y_min, sy: (pa.y_max - pa.y_min) / mp.y_resolution, ys: pa.y_pos, vie: pa.health
      };
    });
    return out;
  }

  function position(tr, t) {
    if (!tr || !tr.xs.length) return null;
    const i = Math.min(Math.max(0, Math.floor(t)), tr.xs.length - 1);
    return [tr.x0 + tr.xs[i] * tr.sx, tr.y0 + tr.ys[i] * tr.sy];
  }

  const releve = (p, t) => (p.stats || []).filter((s) => s.time_stamp_s <= t).pop() || null;

  const custom = (info, fin) => {
    const noms = {};
    (info.custom_user_stats || []).forEach((c) => { noms[c.id] = c.name; });
    const out = {};
    (fin.custom_user_stats || []).forEach((c) => { if (noms[c.id] && c.value != null) out[noms[c.id]] = c.value; });
    return out;
  };
  const source = (fin, n) => (fin.gold_sources || []).find((g) => g.source === n) || {};
  const median = (l) => { const v = l.slice().sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : null; };

  // Mesures d'un joueur. objets : { id → objet de data/items.json }.
  function mesurer(p, info, T, objets) {
    const duree = info.duration_s / 60;
    const fin = (p.stats || [])[p.stats.length - 1] || {};
    const c = custom(info, fin);
    const s9 = releve(p, 540);
    const allies = info.players.filter((q) => q.team === p.team && q !== p);
    const ennemis = info.players.filter((q) => q.team !== p.team);
    const tr = T[p.player_slot];
    const vie = (t) => (tr && tr.vie && tr.vie[Math.floor(t)] != null ? tr.vie[Math.floor(t)] : null);
    // ta base est à y < 0 pour l'équipe 0, y > 0 pour l'équipe 1
    const versMoi = (y) => (p.team === 0 ? y : -y);
    const proches = (liste, x, y, t) => liste.filter((q) => {
      const pos = position(T[q.player_slot], t);
      return pos && Math.hypot(pos[0] - x, pos[1] - y) <= ISOLE;
    }).length;
    const morts = (p.death_details || []).map((d) => {
      const x = d.death_pos.x, y = d.death_pos.y, t = d.game_time_s;
      const debut = Math.max(0, Math.floor(t - (d.time_to_kill_s || 0)) - 2);
      const allies_pres = proches(allies, x, y, t), ennemis_pres = proches(ennemis, x, y, t);
      return {
        t: t, xy: versCarte(x, y), tueur: d.killer_player_slot, duree: d.death_duration_s,
        surpris: d.time_to_kill_s < SURPRIS_S,
        isole: allies_pres === 0,
        inferiorite: ennemis_pres >= allies_pres + 2,
        engage_bas: vie(debut) != null && vie(debut) < 50,
        vie_debut: vie(debut),
        cote_adverse: versMoi(y) > 1500,
        allies: allies_pres, ennemis: ennemis_pres
      };
    });
    // Présence en lane : distance en x au milieu des adversaires de la même lane, de 1:30 à 9:00.
    let presence = null;
    const face = ennemis.filter((q) => q.assigned_lane === p.assigned_lane);
    if (tr && face.length) {
      let dedans = 0, total = 0;
      for (let t = 90; t < Math.min(540, info.duration_s); t += 5) {
        const xs = face.map((q) => position(T[q.player_slot], t)).filter(Boolean).map((v) => v[0]);
        const moi = position(tr, t);
        if (!xs.length || !moi || vie(t) === 0) continue;
        total++;
        if (Math.abs(moi[0] - median(xs)) < 2500) dedans++;
      }
      presence = total ? dedans / total : null;
    }
    // Temps hors base sous 30 % de vie (vivant).
    let bas = 0, vivant = 0;
    if (tr && tr.vie) for (let t = 60; t < tr.vie.length; t += 2) {
      const v = tr.vie[t], pos = position(tr, t);
      if (!v || !pos || versMoi(pos[1]) < -8500) continue;
      vivant++;
      if (v < 30) bas++;
    }
    const lane = source(fin, 2);
    const tirs = (fin.shots_hit || 0) + (fin.shots_missed || 0);
    const gros = (p.items || []).find((i) => objets[i.item_id] && objets[i.item_id].cout >= 3000);
    const pu = (p.power_up_buffs || []).reduce((s2, b) => s2 + (b.pickup_times_s || []).length, 0);
    const chute = (c['Enemy Hero Falloff##No Falloff'] || 0) + (c['Enemy Hero Falloff##Partial Falloff'] || 0) + (c['Enemy Hero Falloff##Max Falloff'] || 0);
    return {
      creeps_9: s9 && s9.possible_creeps ? s9.creep_kills / s9.possible_creeps : null,
      orbes: lane.gold ? (lane.gold_orbs || 0) / lane.gold : null,
      ecart_lane_9: null,   // rempli dans analyser (besoin des autres joueurs)
      souls_9: s9 ? s9.net_worth : null,
      presence_lane: presence,
      denies_9: s9 ? s9.denies : null,
      souls_min: (fin.net_worth || 0) / duree,
      jungle_min: ((fin.gold_neutral_creep || 0) + (fin.gold_neutral_creep_orbs || 0)) / duree,
      morts: morts.length,
      temps_mort: morts.reduce((s2, m) => s2 + (m.duree || 0), 0) / info.duration_s,
      isoles: morts.filter((m) => m.isole).length,
      inferiorite: morts.filter((m) => m.inferiorite).length,
      engage_bas: morts.filter((m) => m.engage_bas).length,
      vie_basse: vivant ? bas / vivant : null,
      degats_min: (fin.player_damage || 0) / duree,
      participation: null,  // rempli dans analyser
      efficacite: null,     // rempli dans analyser
      _degats: fin.player_damage || 0, _souls: fin.net_worth || 0, _ka: p.kills + p.assists,
      precision: tirs ? fin.shots_hit / tirs : null,
      headshots: fin.hero_bullets_hit ? fin.hero_bullets_hit_crit / fin.hero_bullets_hit : null,
      portee: chute ? (c['Enemy Hero Falloff##No Falloff'] || 0) / chute : null,
      esquive: c['Enemy Hero Accuracy - Incoming##Shots'] ? c['Enemy Hero Accuracy - Incoming##Hits'] / c['Enemy Hero Accuracy - Incoming##Shots'] : null,
      objectifs: (fin.gold_boss || 0) + (fin.gold_boss_orb || 0),
      boss_min: (fin.boss_damage || 0) / duree,
      powerups: pu,
      gros_objet: gros ? gros.game_time_s / 60 : null,
      souls_dormantes: c['Unspent Gold Minutes'] != null ? c['Unspent Gold Minutes'] / duree : null,
      points_dormants: c['Unspent AP Minutes'] != null ? c['Unspent AP Minutes'] : null,
      _morts: morts
    };
  }

  // Score de 0 (le pire de la partie) à 1 (le meilleur) pour chaque mesure du joueur.
  function scores(moi, tous) {
    const out = {};
    Object.keys(MESURES).forEach((k) => {
      const v = moi[k];
      const vals = tous.map((m) => m[k]).filter((x) => x != null);
      if (v == null || vals.length < 6) return;
      const sens = MESURES[k].sens;
      const mieux = vals.filter((x) => (x - v) * sens > 0).length;
      const egaux = vals.filter((x) => x === v).length - 1;
      out[k] = 1 - (mieux + egaux / 2) / (vals.length - 1);
    });
    return out;
  }

  const moyenne = (l) => (l.length ? l.reduce((a, b) => a + b, 0) / l.length : null);

  // Analyse complète d'une partie pour le compte id.
  function analyser(info, id, objets) {
    const T = trajets(info);
    const me = info.players.find((x) => x.account_id === id);
    if (!me) return null;
    const parSlot = {};
    const tous = info.players.map((p) => { const m = mesurer(p, info, T, objets); parSlot[p.player_slot] = { p: p, m: m }; return m; });
    info.players.forEach((p) => {
      const m = parSlot[p.player_slot].m;
      const equipe = info.players.filter((q) => q.team === p.team).map((q) => parSlot[q.player_slot].m);
      const kills = info.players.filter((q) => q.team === p.team).reduce((s2, q) => s2 + q.kills, 0);
      const degats = equipe.reduce((s2, q) => s2 + q._degats, 0), souls = equipe.reduce((s2, q) => s2 + q._souls, 0);
      m.participation = kills ? Math.min(1, m._ka / kills) : null;
      m.efficacite = degats && souls && m._souls ? (m._degats / degats) / (m._souls / souls) : null;
      const face = info.players.filter((q) => q.team !== p.team && q.assigned_lane === p.assigned_lane).map((q) => parSlot[q.player_slot].m.souls_9).filter((v) => v != null);
      m.ecart_lane_9 = m.souls_9 != null && face.length ? m.souls_9 - face.reduce((a, b) => a + b, 0) / face.length : null;
    });
    const moi = parSlot[me.player_slot].m;
    const sc = scores(moi, tous);
    const domaines = {};
    DOMAINES.forEach((d) => { domaines[d.id] = moyenne(d.mesures.map((k) => sc[k]).filter((x) => x != null)); });
    // Note globale de chaque joueur (même calcul) pour le classer dans sa partie.
    const global = (m) => moyenne(Object.values(scores(m, tous)));
    const classement = info.players.map((p) => ({ p: p, g: global(parSlot[p.player_slot].m) })).sort((a, b) => b.g - a.g);
    const place = classement.findIndex((c) => c.p === me) + 1;
    const equipe = classement.filter((c) => c.p.team === me.team);
    const mediane = {};
    Object.keys(MESURES).forEach((k) => {
      const v = tous.map((m) => m[k]).filter((x) => x != null).sort((a, b) => a - b);
      mediane[k] = v.length ? v[Math.floor(v.length / 2)] : null;
    });
    return {
      me: me, moi: moi, scores: sc, domaines: domaines, global: global(moi), place: place, n: info.players.length,
      mvp: equipe[0].p === me, mediane: mediane, morts: moi._morts.map((m) => Object.assign({}, m, { tueur: parSlot[m.tueur] ? parSlot[m.tueur].p.hero_id : null })),
      equipes: [0, 1].map((t) => info.players.filter((p) => p.team === t).map((p) => ({ hero: p.hero_id, moi: p === me }))),
      monEquipe: me.team
    };
  }

  DLN.lobby = { MESURES: MESURES, DOMAINES: DOMAINES, analyser: analyser, lettre: lettre, moyenne: moyenne };
})();
