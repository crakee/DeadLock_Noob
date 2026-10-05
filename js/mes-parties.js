// Mes parties : analyse des parties d'un joueur à partir de deadlock-api.com, en direct depuis le
// navigateur (rien n'est enregistré dans le dépôt ; l'identifiant reste dans localStorage).
// Comparaison avec les joueurs du même héros et du même niveau depuis le patch :
// /v1/analytics/player-stats/metrics (percentiles par partie) et
// /v1/analytics/player-performance-curve (souls par source au fil de la partie).
// Les constats sont des chiffres ; les pistes de travail sont des conseils (data/memo.json, guides de Wouks).
(function () {
  'use strict';

  const el = DLN.el;
  const API = 'https://api.deadlock-api.com';
  const CLE = 'dln.moi.v1';
  const OFFSET_STEAM64 = 76561197960265728n;
  // Tranches de rang (badges), mêmes bornes que outils/maj_donnees.py.
  const TRANCHES = { tous: [null, null], initiate_sentinel: [11, 46], mystic_oracle: [51, 86], phantom_eternus: [91, 116] };
  const NB_DETAILLEES = 8;     // parties analysées en détail (le détail d'une partie pèse environ 1 Mo)

  let heros = null, objets = {}, statsHeros = null, tempo = null;
  let moi = null;              // { id, nom, avatar, rang }
  let parties = [], details = {}, metriques = {}, courbes = {};

  const fmtMin = (s) => Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0');
  const nomHeros = (id) => (heros.heros.find((h) => h.id === id) || {}).nom || ('#' + id);
  const herosDe = (id) => heros.heros.find((h) => h.id === id);
  const pct = (v) => Math.round(v * 100) + ' %';
  const nombre = (v) => DLN.fmtNombre(Math.round(v));

  async function api(chemin) {
    const r = await fetch(API + chemin);
    if (!r.ok) throw new Error(chemin.split('?')[0] + ' : HTTP ' + r.status);
    return r.json();
  }

  // ---------- identifier le joueur ----------

  async function identifier(texte) {
    texte = texte.trim();
    const m64 = /(7656119\d{10})/.exec(texte);
    if (m64) return Number(BigInt(m64[1]) - OFFSET_STEAM64);
    if (/^\d{1,10}$/.test(texte)) return Number(texte);
    const vanity = /steamcommunity\.com\/id\/([^/?#]+)/.exec(texte);
    const recherche = vanity ? vanity[1] : texte;
    const res = await api('/v1/players/steam-search?search_query=' + encodeURIComponent(recherche) + '&limit=5');
    if (!res.length) throw new Error('Aucun joueur trouvé pour « ' + recherche + ' ». Colle le lien de ton profil Steam.');
    return res[0].account_id;
  }

  // ---------- comparaisons ----------

  function tranche() {
    // Rang réel s'il existe, sinon le rang choisi dans le menu ⚙.
    if (moi && moi.rang && moi.rang.badge) {
      const b = moi.rang.badge;
      return Object.keys(TRANCHES).find((k) => TRANCHES[k][0] != null && b >= TRANCHES[k][0] && b <= TRANCHES[k][1]) || DLN.tranche();
    }
    return DLN.tranche();
  }

  function filtreRang() {
    const t = TRANCHES[tranche()] || [null, null];
    return (t[0] != null ? '&min_average_badge=' + t[0] : '') + (t[1] != null ? '&max_average_badge=' + t[1] : '');
  }

  const depuisPatch = () => Math.floor(new Date(statsHeros.meta.depuis + 'T00:00:00Z').getTime() / 1000);

  async function metrique(hid) {
    const cle = hid + ':' + tranche();
    if (!metriques[cle]) metriques[cle] = api('/v1/analytics/player-stats/metrics?hero_ids=' + hid + '&min_unix_timestamp=' + depuisPatch() + filtreRang()).catch(() => null);
    return metriques[cle];
  }

  async function courbe(hid) {
    const cle = hid + ':' + tranche();
    if (!courbes[cle]) courbes[cle] = api('/v1/analytics/player-performance-curve?hero_ids=' + hid + '&resolution=10&min_unix_timestamp=' + depuisPatch() + filtreRang()).catch(() => null);
    return courbes[cle];
  }

  // Position d'une valeur par rapport aux quartiles des joueurs comparables.
  function position(v, m) {
    if (!m || v == null) return null;
    if (v < m.percentile25) return { cls: 'bas', txt: 'dans le quart le plus bas' };
    if (v < m.percentile50) return { cls: 'moyen-bas', txt: 'sous la moitié' };
    if (v < m.percentile75) return { cls: 'moyen-haut', txt: 'au-dessus de la moitié' };
    return { cls: 'haut', txt: 'dans le quart le plus haut' };
  }

  // Souls par source, par minute, pour une partie détaillée.
  const SOURCES = [
    ['lane', 'Lane (Troopers)', ['gold_lane_creep', 'gold_lane_creep_orbs']],
    ['jungle', 'Jungle (camps)', ['gold_neutral_creep', 'gold_neutral_creep_orbs']],
    ['kills', 'Kills et assists', ['gold_player', 'gold_player_orbs']],
    ['objectifs', 'Objectifs et boss', ['gold_boss', 'gold_boss_orb']],
    ['tresors', 'Caisses et urnes', ['gold_treasure']]
  ];
  const somme = (o, cles) => cles.reduce((s, k) => s + (o[k] || 0), 0);

  // Moyenne des joueurs comparables, par minute : la courbe est en % de partie, on divise ses
  // totaux de fin par la durée moyenne de leurs parties (souls totales / souls par minute).
  function referenceParMinute(c, m) {
    if (!c || !c.length || !m) return null;
    const fin = c[c.length - 1];
    const duree = m.net_worth.avg / m.net_worth_per_min.avg;      // minutes
    const r = { duree: duree };
    SOURCES.forEach((s) => { r[s[0]] = s[2].reduce((t, k) => t + (fin[k + '_avg'] || 0), 0) / duree; });
    return r;
  }

  // ---------- lecture d'une partie ----------

  function lirePartie(p, d) {
    const info = d.match_info || d;
    const me = info.players.find((x) => x.account_id === moi.id);
    if (!me) return null;
    const parSlot = {};
    info.players.forEach((x) => { parSlot[x.player_slot] = x; });
    const fin = me.stats && me.stats.length ? me.stats[me.stats.length - 1] : {};
    const duree = info.duration_s / 60;
    const sources = {};
    SOURCES.forEach((s) => { sources[s[0]] = somme(fin, s[2]) / duree; });
    return {
      p: p, me: me, duree: duree, sources: sources,
      morts: (me.death_details || []).map((x) => ({
        t: x.game_time_s, tueur: parSlot[x.killer_player_slot] ? parSlot[x.killer_player_slot].hero_id : null
      })),
      achats: (me.items || []).filter((x) => objets[x.item_id])
        .map((x) => ({ t: x.game_time_s, o: objets[x.item_id], vendu: x.sold_time_s || null })).filter((x) => x.o),
      courbe: (me.stats || []).map((s) => ({ t: s.time_stamp_s / 60, nw: s.net_worth })),
      ennemis: info.players.filter((x) => x.team !== me.team).map((x) => x.hero_id)
    };
  }

  // ---------- affichage ----------

  const contenu = () => document.getElementById('mp-contenu');

  function bloc(titre, classe) {
    const b = el('section', 'panneau ' + (classe || ''));
    if (titre) b.append(el('h2', null, titre));
    return b;
  }

  function afficherProfil() {
    const z = document.getElementById('mp-profil');
    z.textContent = '';
    if (!moi) return;
    if (moi.avatar) z.append(DLN.img(moi.avatar, 'mp-avatar'));
    const t = el('div');
    t.append(el('strong', null, moi.nom || ('Compte ' + moi.id)));
    const rang = moi.rang && moi.rang.badge ? 'Rang : badge ' + moi.rang.badge : 'Pas encore de partie classée';
    t.append(el('span', 'aide', rang + ' · comparé aux joueurs « ' + DLN.LIBELLES_TRANCHE[tranche()] + ' » depuis le patch (' + statsHeros.meta.depuis + ')'));
    z.append(t);
    const oublier = el('button', 'btn discret', 'Changer de compte');
    oublier.type = 'button';
    oublier.addEventListener('click', () => { try { localStorage.removeItem(CLE); } catch (e) { /* idem */ } moi = null; parties = []; contenu().textContent = ''; afficherProfil(); document.getElementById('mp-saisie').focus(); });
    z.append(oublier);
  }

  async function afficherBilan(lues) {
    const z = contenu();
    z.textContent = '';
    const n = parties.length;
    const victoires = parties.filter((p) => p.match_result === p.player_team).length;

    // --- 1. Ce qu'on voit sur l'ensemble ---
    const synthese = bloc('En bref', 'mp-synthese');
    const wr = n ? victoires / n : 0;
    const m95 = n ? Math.round(196 * Math.sqrt(wr * (1 - wr) / n)) : 0;
    synthese.append(el('p', 'mp-grand', victoires + ' victoire' + (victoires > 1 ? 's' : '') + ' sur ' + n + ' partie' + (n > 1 ? 's' : '') +
      (n ? ' (' + Math.round(wr * 100) + ' % ± ' + m95 + ' points)' : '')));
    if (n < 20) synthese.append(el('p', 'avertissement', n + ' parties seulement : les tendances ci-dessous sont des pistes, pas des certitudes. ' +
      'Elles se préciseront avec plus de parties (voir « Pourquoi si peu de parties ? » en bas).'));
    z.append(synthese);

    // --- 2. Les axes de progression ---
    const axes = await calculerAxes(lues);
    const blocAxes = bloc('Où progresser en premier', 'mp-axes');
    if (!axes.length) blocAxes.append(el('p', 'aide', 'Pas assez de données pour un diagnostic.'));
    axes.forEach((a, i) => {
      const c = el('article', 'mp-axe mp-' + a.niveau);
      const t = el('h3', null, (i + 1) + '. ' + a.titre);
      c.append(t, el('p', 'mp-constat', a.constat));
      if (a.conseils && a.conseils.length) {
        const ul = el('ul', 'mp-conseils');
        a.conseils.forEach((x) => ul.append(el('li', null, x)));
        const h = el('p', 'mp-conseils-titre', 'Comment ');
        h.append(el('span', 'marque', 'conseil'));
        c.append(h, ul);
      }
      blocAxes.append(c);
    });
    z.append(blocAxes);

    // --- 3. Par héros ---
    const parHeros = {};
    parties.forEach((p) => { (parHeros[p.hero_id] = parHeros[p.hero_id] || []).push(p); });
    const blocHeros = bloc('Par héros', 'mp-heros');
    const table = el('table', 'table mp-table');
    const th = el('tr');
    ['Héros', 'Parties', 'Victoires', 'Souls / min', 'Ton niveau (médiane)', 'Morts / partie', 'Médiane'].forEach((x) => th.append(el('th', null, x)));
    table.append(th);
    for (const hid of Object.keys(parHeros)) {
      const ps = parHeros[hid];
      const m = await metrique(hid);
      const nwm = ps.reduce((s, p) => s + p.net_worth / (p.match_duration_s / 60), 0) / ps.length;
      const morts = ps.reduce((s, p) => s + p.player_deaths, 0) / ps.length;
      const tr = el('tr');
      const td = el('td');
      const h = herosDe(Number(hid));
      if (h) td.append(DLN.img(h.icone || h.image, 'mp-icone'));
      td.append(nomHeros(Number(hid)));
      const posNw = m && position(nwm, m.net_worth_per_min);
      tr.append(td, el('td', 'nombre', String(ps.length)), el('td', 'nombre', String(ps.filter((p) => p.match_result === p.player_team).length)),
        el('td', 'nombre ' + (posNw ? posNw.cls : ''), nombre(nwm)), el('td', 'nombre doux', m ? nombre(m.net_worth_per_min.percentile50) : '—'),
        el('td', 'nombre', (Math.round(morts * 10) / 10).toLocaleString('fr-FR')), el('td', 'nombre doux', m ? (Math.round(m.deaths.percentile50 * 10) / 10).toLocaleString('fr-FR') : '—'));
      table.append(tr);
    }
    blocHeros.append(table, el('p', 'aide', 'Médiane = la moitié des joueurs de ce héros, à ton niveau, fait mieux, l\'autre moitié moins bien. En rouge : dans le quart le plus bas.'));
    z.append(blocHeros);

    // --- 4. Partie par partie ---
    const blocParties = bloc('Partie par partie', 'mp-parties');
    for (const p of parties) blocParties.append(await carteMatch(p, lues.find((l) => l.p === p)));
    z.append(blocParties);

    // --- 5. Données manquantes ---
    const aide = bloc('Pourquoi si peu de parties ?', 'mp-aide');
    aide.append(el('p', null, 'deadlock-api.com ne voit pas toutes les parties du jeu : elle en récupère une partie chaque jour. Ton historique complet ' +
      's\'obtient si ton compte Steam est ami avec un des robots de l\'API (elle lit alors l\'historique officiel). Les nouvelles parties qu\'elle voit ' +
      'apparaissent ici automatiquement.'));
    z.append(aide);
  }

  async function calculerAxes(lues) {
    const axes = [];
    if (!lues.length) return axes;
    // Farm global, comparé par héros
    const ecarts = [];
    for (const l of lues) {
      const m = await metrique(l.p.hero_id);
      const c = await courbe(l.p.hero_id);
      const ref = referenceParMinute(c, m);
      if (ref) ecarts.push({ l: l, ref: ref, m: m });
    }
    if (!ecarts.length) return axes;
    const moyenne = (f) => ecarts.reduce((s, e) => s + f(e), 0) / ecarts.length;
    const ratio = {};
    SOURCES.forEach((s) => { ratio[s[0]] = moyenne((e) => (e.ref[s[0]] ? e.l.sources[s[0]] / e.ref[s[0]] : 1)); });
    const toi = (k) => nombre(moyenne((e) => e.l.sources[k]));
    const eux = (k) => nombre(moyenne((e) => e.ref[k]));
    const nwRatio = moyenne((e) => (e.l.p.net_worth / e.l.duree) / e.m.net_worth_per_min.percentile50);

    if (ratio.jungle < 0.75) {
      axes.push({
        niveau: ratio.jungle < 0.5 ? 'fort' : 'moyen', score: 1 - ratio.jungle,
        titre: 'La jungle : tu en prends ' + pct(ratio.jungle) + ' de ce que prennent les joueurs de ton niveau',
        constat: 'Jungle : ' + toi('jungle') + ' souls/min pour toi, ' + eux('jungle') + ' en moyenne sur les mêmes héros à ton niveau (' + ecarts.length + ' partie' + (ecarts.length > 1 ? 's' : '') + ' analysée' + (ecarts.length > 1 ? 's' : '') + ').',
        conseils: ['Dès que ta wave est poussée, un camp de ton côté avant de revenir : c\'est le moment, jamais à la place d\'une wave.',
          'Small camps dès 2:00, Medium dès 5:00, Large et Sinner\'s Sacrifice dès 8:00 : vise l\'œil des Haunts.',
          'Sinner\'s Sacrifice en priorité sur les camps (4 buffs permanents si tu finis au heavy melee).',
          'Dans l\'onglet En partie, indique « wave poussée » : le coach te dit quel camp prendre.']
      });
    }
    if (ratio.lane < 0.85) {
      axes.push({
        niveau: ratio.lane < 0.7 ? 'fort' : 'moyen', score: (1 - ratio.lane) * 0.9,
        titre: 'La lane : ' + pct(ratio.lane) + ' des souls de Troopers des joueurs de ton niveau',
        constat: 'Troopers : ' + toi('lane') + ' souls/min pour toi, ' + eux('lane') + ' en moyenne.',
        conseils: ['Le dernier coup sur chaque Trooper : c\'est lui qui donne les souls.',
          'Tue au corps à corps quand tu peux : tu prends toutes les souls d\'un coup, l\'adversaire ne peut pas voler l\'orbe.',
          'Ne perds pas de wave : avant chaque déplacement, « ma wave est-elle poussée ? ».']
      });
    }
    if (ratio.kills > 1.2 && (ratio.jungle < 0.75 || ratio.lane < 0.85)) {
      axes.push({
        niveau: 'info', score: 0.1,
        titre: 'Tu gagnes bien en combat, mais tu farmes peu',
        constat: 'Kills et assists : ' + toi('kills') + ' souls/min pour toi, ' + eux('kills') + ' en moyenne. Ton temps passe en combats plutôt qu\'en farm.',
        conseils: ['On se bat quand tout est réuni pour gagner, wave poussée. Entre deux combats, farme.']
      });
    }
    // Morts
    const morts = lues.map((l) => l.morts.map((x) => x.t / 60)).reduce((a, b) => a.concat(b), []);
    const mortsMoy = lues.reduce((s, l) => s + l.morts.length, 0) / lues.length;
    const medMorts = moyenne((e) => e.m.deaths.percentile50);
    if (mortsMoy > medMorts * 1.15 && morts.length) {
      const tranches = [[0, 8, 'pendant la lane (0–8 min)'], [8, 20, 'en milieu de partie (8–20 min)'], [20, 99, 'en fin de partie (après 20 min)']];
      const compte = tranches.map((t) => morts.filter((m) => m >= t[0] && m < t[1]).length);
      const pire = tranches[compte.indexOf(Math.max.apply(null, compte))];
      axes.push({
        niveau: mortsMoy > medMorts * 1.5 ? 'fort' : 'moyen', score: (mortsMoy / medMorts - 1) * 0.8,
        titre: 'Les morts : ' + (Math.round(mortsMoy * 10) / 10).toLocaleString('fr-FR') + ' par partie, la médiane de ton niveau est ' + (Math.round(medMorts * 10) / 10).toLocaleString('fr-FR'),
        constat: 'Tu meurs surtout ' + pire[2] + ' (' + Math.max.apply(null, compte) + ' morts sur ' + morts.length + ').',
        conseils: ['Vie basse : recule, ne prends pas le combat. Avec des souls sur toi, rentre dépenser.',
          'Ne va pas en jungle avec peu de vie quand tu portes beaucoup de souls : elles se perdent à la mort.',
          'Avant un combat : est-il proche, gagnable, et ma wave est-elle poussée ?']
      });
    } else if (mortsMoy) {
      axes.push({ niveau: 'bon', score: 0, titre: 'Les morts : dans la norme', constat: (Math.round(mortsMoy * 10) / 10).toLocaleString('fr-FR') + ' par partie, la médiane de ton niveau est ' + (Math.round(medMorts * 10) / 10).toLocaleString('fr-FR') + '.' });
    }
    if (nwRatio < 0.9 && !axes.some((a) => a.niveau === 'fort')) {
      axes.push({ niveau: 'moyen', score: 0.3, titre: 'Ton farm total : ' + pct(nwRatio) + ' de la médiane de ton niveau', constat: 'Souls par minute, toutes sources confondues, comparées aux joueurs des mêmes héros.' });
    }
    return axes.sort((a, b) => b.score - a.score);
  }

  // Petite courbe : tes souls au fil de la partie, et la moyenne de ton niveau (ramenée à la durée de ta partie).
  function graphe(l, c) {
    const L = 360, H = 120, G = 30;
    const tmax = Math.max(l.duree, 1);
    const ref = c ? c.map((x) => ({ t: x.game_time / 100 * l.duree, nw: x.net_worth_avg })) : [];
    const vmax = Math.max.apply(null, l.courbe.map((x) => x.nw).concat(ref.map((x) => x.nw)).concat([1]));
    const X = (t) => G + (L - G - 6) * t / tmax, Y = (v) => H - 16 - (H - 26) * v / vmax;
    const ns = 'http://www.w3.org/2000/svg';
    const s = document.createElementNS(ns, 'svg');
    s.setAttribute('viewBox', '0 0 ' + L + ' ' + H);
    s.setAttribute('class', 'mp-graphe');
    const trait = (pts, cls) => {
      const p = document.createElementNS(ns, 'polyline');
      p.setAttribute('points', pts.map((x) => X(x.t).toFixed(1) + ',' + Y(x.nw).toFixed(1)).join(' '));
      p.setAttribute('class', cls);
      s.append(p);
    };
    if (ref.length) trait(ref, 'mp-ref');
    trait([{ t: 0, nw: 0 }].concat(l.courbe), 'mp-toi');
    l.morts.forEach((m) => {
      const c2 = document.createElementNS(ns, 'line');
      c2.setAttribute('x1', X(m.t / 60)); c2.setAttribute('x2', X(m.t / 60)); c2.setAttribute('y1', 6); c2.setAttribute('y2', H - 16);
      c2.setAttribute('class', 'mp-mort');
      s.append(c2);
    });
    [0, 10, 20, 30, 40].filter((m) => m <= tmax).forEach((m) => {
      const t = document.createElementNS(ns, 'text');
      t.setAttribute('x', X(m)); t.setAttribute('y', H - 3); t.setAttribute('class', 'mp-axe');
      t.textContent = m + ' min';
      s.append(t);
    });
    return s;
  }

  async function carteMatch(p, l) {
    const victoire = p.match_result === p.player_team;
    const d = el('details', 'mp-match ' + (victoire ? 'victoire' : 'defaite'));
    const s = el('summary');
    const h = herosDe(p.hero_id);
    if (h) s.append(DLN.img(h.icone || h.image, 'mp-icone'));
    const date = new Date(p.start_time * 1000).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    s.append(el('strong', null, nomHeros(p.hero_id)), el('span', 'mp-resultat', victoire ? 'Victoire' : 'Défaite'),
      el('span', 'aide', date + ' · ' + Math.round(p.match_duration_s / 60) + ' min · ' + p.player_kills + ' / ' + p.player_deaths + ' / ' + p.player_assists +
        ' · ' + nombre(p.net_worth / (p.match_duration_s / 60)) + ' souls/min'));
    d.append(s);
    if (!l) {
      d.append(el('p', 'aide', 'Détail non chargé (seules les ' + NB_DETAILLEES + ' dernières parties sont analysées en détail).'));
      return d;
    }
    const c = await courbe(p.hero_id);
    const m = await metrique(p.hero_id);
    const ref = referenceParMinute(c, m);
    const corps = el('div', 'mp-match-corps');
    // Courbe
    const g = el('div', 'mp-bloc');
    g.append(el('h4', null, 'Tes souls au fil de la partie'), graphe(l, c),
      el('p', 'aide', 'Trait plein : toi. Pointillés : moyenne des joueurs de ' + nomHeros(p.hero_id) + ' à ton niveau. Traits rouges : tes morts.'));
    corps.append(g);
    // Sources
    const src = el('div', 'mp-bloc');
    src.append(el('h4', null, 'D\'où viennent tes souls (par minute)'));
    const t = el('table', 'table mp-sources');
    SOURCES.forEach((x) => {
      const tr = el('tr');
      const toi = l.sources[x[0]], eux = ref ? ref[x[0]] : null;
      const r = eux ? toi / eux : null;
      tr.append(el('td', null, x[1]), el('td', 'nombre', nombre(toi)), el('td', 'nombre doux', eux != null ? nombre(eux) : '—'),
        el('td', 'nombre ' + (r == null ? '' : r < 0.6 ? 'bas' : r < 0.85 ? 'moyen-bas' : r > 1.15 ? 'haut' : ''), r == null ? '' : pct(r)));
      t.append(tr);
    });
    src.append(t, el('p', 'aide', 'Toi · moyenne de ton niveau · ton pourcentage.'));
    corps.append(src);
    // Morts
    const morts = el('div', 'mp-bloc');
    morts.append(el('h4', null, 'Tes morts'));
    if (!l.morts.length) morts.append(el('p', 'doux', 'Aucune.'));
    else {
      const ul = el('ul', 'mp-liste');
      l.morts.forEach((x) => ul.append(el('li', null, fmtMin(x.t) + (x.tueur ? ' · tué par ' + nomHeros(x.tueur) : ''))));
      morts.append(ul);
    }
    corps.append(morts);
    // Achats
    const achats = el('div', 'mp-bloc');
    achats.append(el('h4', null, 'Tes achats'));
    const ul = el('ul', 'mp-achats');
    l.achats.filter((x) => x.o.tier >= 1).forEach((x) => {
      const li = el('li', 'obj-' + x.o.categorie + (x.o.tier >= 3 ? ' gros' : ''));
      if (x.o.image) li.append(DLN.img(x.o.image));
      li.append(el('span', null, fmtMin(x.t) + ' · ' + x.o.nom));
      ul.append(li);
    });
    achats.append(ul);
    const premierGros = l.achats.find((x) => x.o.tier >= 3);
    const cles = ((((tempo || {}).tranches || {})[tranche()] || {})[String(p.hero_id)] || {}).objets_cles || [];
    if (premierGros && cles.length) {
      achats.append(el('p', 'aide', 'Ton premier objet à 3 200 ou plus : ' + fmtMin(premierGros.t) + '. Les joueurs de ton niveau prennent leur premier gros achat vers ' +
        Math.round(cles[0].minute) + ' min (' + cles[0].nom + ').'));
    }
    corps.append(achats);
    d.append(corps);
    return d;
  }

  // ---------- chargement ----------

  async function charger(id) {
    const z = contenu();
    z.textContent = '';
    z.append(el('p', 'aide', 'Chargement de tes parties…'));
    const [steam, rang, histo] = await Promise.all([
      api('/v1/players/steam?account_ids=' + id).catch(() => []),
      api('/v1/players/' + id + '/rank').catch(() => null),
      api('/v1/players/' + id + '/match-history')
    ]);
    const s = steam[0] || {};
    moi = { id: id, nom: s.personaname, avatar: s.avatarmedium || s.avatar, rang: rang };
    try { localStorage.setItem(CLE, String(id)); } catch (e) { /* stockage indisponible */ }
    afficherProfil();
    parties = histo.filter((p) => p.game_mode === 1).sort((a, b) => b.start_time - a.start_time);
    if (!parties.length) { z.textContent = ''; z.append(el('p', 'vide', 'Aucune partie trouvée pour ce compte sur deadlock-api.com.')); return; }
    const lues = [];
    let i = 0;
    for (const p of parties.slice(0, NB_DETAILLEES)) {
      i++;
      z.firstChild.textContent = 'Analyse de tes parties… ' + i + ' / ' + Math.min(NB_DETAILLEES, parties.length);
      try {
        const d = details[p.match_id] || (details[p.match_id] = await api('/v1/matches/' + p.match_id + '/metadata'));
        const l = lirePartie(p, d);
        if (l) lues.push(l);
      } catch (e) { /* partie indisponible : on continue */ }
    }
    await afficherBilan(lues);
  }

  async function lancer(texte) {
    try {
      const id = await identifier(texte);
      await charger(id);
    } catch (e) {
      contenu().textContent = '';
      contenu().append(el('p', 'avertissement', 'Impossible de charger ce compte : ' + e.message));
    }
  }

  Promise.all(['data/heroes.json', 'data/items.json', 'data/hero-stats.json'].map(DLN.charger)
    .concat([DLN.charger('data/tempo.json').catch(() => null), DLN.profil])).then((r) => {
    heros = r[0];
    r[1].objets.forEach((o) => { objets[o.id] = o; });
    statsHeros = r[2];
    tempo = r[3];
    document.getElementById('app').hidden = false;
    document.getElementById('meta').textContent = 'Données : deadlock-api.com, en direct depuis ton navigateur · ton identifiant reste dans ce navigateur · ' +
      'comparaisons : joueurs des mêmes héros, à ton niveau, depuis le patch · les pistes de travail sont des conseils (Mémo, guides de Wouks)';
    document.getElementById('mp-form').addEventListener('submit', (e) => { e.preventDefault(); lancer(document.getElementById('mp-saisie').value); });
    let id = null;
    try { id = localStorage.getItem(CLE); } catch (e) { /* idem */ }
    if (id) lancer(id);
    DLN.surTranche(() => { metriques = {}; courbes = {}; if (moi) charger(moi.id); });
  }, DLN.echec);
})();
