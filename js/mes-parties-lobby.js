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
    creeps_9: { nom: 'Troopers pris à 9 min', sens: 1, fmt: 'pct' },
    souls_9: { nom: 'Souls à 9 min', sens: 1, fmt: 'n' },
    denies_9: { nom: 'Denies à 9 min', sens: 1, fmt: 'n' },
    souls_min: { nom: 'Souls par minute', sens: 1, fmt: 'n' },
    jungle_min: { nom: 'Souls de jungle par minute', sens: 1, fmt: 'n' },
    morts: { nom: 'Morts', sens: -1, fmt: 'n' },
    temps_mort: { nom: 'Temps passé mort', sens: -1, fmt: 'pct' },
    isoles: { nom: 'Morts loin de ton équipe', sens: -1, fmt: 'n' },
    degats_min: { nom: 'Dégâts aux héros par minute', sens: 1, fmt: 'n' },
    participation: { nom: 'Kills + assists', sens: 1, fmt: 'n' },
    precision: { nom: 'Précision', sens: 1, fmt: 'pct' },
    headshots: { nom: 'Headshots (part des balles)', sens: 1, fmt: 'pct' },
    objectifs: { nom: 'Souls d\'objectifs et boss', sens: 1, fmt: 'n' },
    boss_min: { nom: 'Dégâts aux objectifs par minute', sens: 1, fmt: 'n' },
    gros_objet: { nom: 'Premier objet à 3 000 ou plus (minute)', sens: -1, fmt: 'min' }
  };

  const DOMAINES = [
    { id: 'lane', nom: 'Lane', mesures: ['creeps_9', 'souls_9', 'denies_9'], lien: 'memo.html' },
    { id: 'farm', nom: 'Farm', mesures: ['souls_min', 'jungle_min'], lien: 'memo.html' },
    { id: 'survie', nom: 'Survie', mesures: ['morts', 'temps_mort', 'isoles'], lien: 'memo.html' },
    { id: 'combat', nom: 'Combat', mesures: ['degats_min', 'participation'], lien: 'roles.html' },
    { id: 'tir', nom: 'Tir', mesures: ['precision', 'headshots'], lien: 'memo.html' },
    { id: 'objectifs', nom: 'Objectifs', mesures: ['objectifs', 'boss_min'], lien: 'carte.html' },
    { id: 'build', nom: 'Achats', mesures: ['gros_objet'], lien: 'objets.html' }
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
        y0: pa.y_min, sy: (pa.y_max - pa.y_min) / mp.y_resolution, ys: pa.y_pos
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

  // Mesures d'un joueur. objets : { id → objet de data/items.json }.
  function mesurer(p, info, T, objets) {
    const duree = info.duration_s / 60;
    const fin = (p.stats || [])[p.stats.length - 1] || {};
    const s9 = releve(p, 540);
    const allies = info.players.filter((q) => q.team === p.team && q !== p);
    const morts = (p.death_details || []).map((d) => {
      let proche = Infinity;
      allies.forEach((q) => {
        const pos = position(T[q.player_slot], d.game_time_s);
        if (pos) proche = Math.min(proche, Math.hypot(pos[0] - d.death_pos.x, pos[1] - d.death_pos.y));
      });
      return {
        t: d.game_time_s, xy: versCarte(d.death_pos.x, d.death_pos.y), tueur: d.killer_player_slot,
        surpris: d.time_to_kill_s < SURPRIS_S, isole: proche > ISOLE, duree: d.death_duration_s
      };
    });
    const tirs = (fin.shots_hit || 0) + (fin.shots_missed || 0);
    const gros = (p.items || []).find((i) => objets[i.item_id] && objets[i.item_id].cout >= 3000);
    return {
      creeps_9: s9 && s9.possible_creeps ? s9.creep_kills / s9.possible_creeps : null,
      souls_9: s9 ? s9.net_worth : null,
      denies_9: s9 ? s9.denies : null,
      souls_min: (fin.net_worth || 0) / duree,
      jungle_min: ((fin.gold_neutral_creep || 0) + (fin.gold_neutral_creep_orbs || 0)) / duree,
      morts: morts.length,
      temps_mort: morts.reduce((s, m) => s + (m.duree || 0), 0) / info.duration_s,
      isoles: morts.filter((m) => m.isole).length,
      degats_min: (fin.player_damage || 0) / duree,
      participation: p.kills + p.assists,
      precision: tirs ? fin.shots_hit / tirs : null,
      headshots: fin.hero_bullets_hit ? fin.hero_bullets_hit_crit / fin.hero_bullets_hit : null,
      objectifs: (fin.gold_boss || 0) + (fin.gold_boss_orb || 0),
      boss_min: (fin.boss_damage || 0) / duree,
      gros_objet: gros ? gros.game_time_s / 60 : null,
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
