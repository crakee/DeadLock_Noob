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

  let heros = null, objets = {}, statsHeros = null, tempo = null, carte = null, lecons = null;
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
      ennemis: info.players.filter((x) => x.team !== me.team).map((x) => x.hero_id),
      lobby: DLN.lobby.analyser(info, moi.id, objets)
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
    const maj = el('button', 'btn', '↻ Actualiser');
    maj.type = 'button';
    maj.title = 'Recharge tes parties depuis deadlock-api.com' + (moi.majA ? ' (dernière mise à jour à ' + moi.majA + ')' : '');
    maj.addEventListener('click', () => charger(moi.id, true));
    z.append(maj);
    const oublier = el('button', 'btn discret', 'Changer de compte');
    oublier.type = 'button';
    oublier.addEventListener('click', () => { try { localStorage.removeItem(CLE); } catch (e) { /* idem */ } moi = null; parties = []; contenu().textContent = ''; afficherProfil(); document.getElementById('mp-saisie').focus(); });
    z.append(oublier, formulaireAjout());
  }

  // ---------- résumé façon op.gg ----------

  const SVGNS = 'http://www.w3.org/2000/svg';
  function svg(nom, attrs) {
    const e = document.createElementNS(SVGNS, nom);
    Object.keys(attrs || {}).forEach((k) => e.setAttribute(k, attrs[k]));
    return e;
  }
  const kdaRatio = (k, d, a) => ((k + a) / Math.max(1, d)).toFixed(2).replace('.', ',');
  const un = (v) => (Math.round(v * 10) / 10).toLocaleString('fr-FR');

  function anneau(wr) {
    const s = svg('svg', { viewBox: '0 0 100 100', class: 'mp-anneau' });
    const R = 40, C = 2 * Math.PI * R;
    s.append(svg('circle', { cx: 50, cy: 50, r: R, class: 'mp-anneau-fond' }));
    s.append(svg('circle', { cx: 50, cy: 50, r: R, class: 'mp-anneau-plein', 'stroke-dasharray': (C * wr).toFixed(1) + ' ' + C.toFixed(1), transform: 'rotate(-90 50 50)' }));
    const t = svg('text', { x: 50, y: 56, class: 'mp-anneau-texte' });
    t.textContent = Math.round(wr * 100) + ' %';
    s.append(t);
    return s;
  }

  function resume(victoires, n) {
    const b = bloc(null, 'mp-resume');
    const wr = n ? victoires / n : 0;
    const m95 = n ? Math.round(196 * Math.sqrt(wr * (1 - wr) / n)) : 0;
    const k = parties.reduce((s, p) => s + p.player_kills, 0) / n;
    const d = parties.reduce((s, p) => s + p.player_deaths, 0) / n;
    const a = parties.reduce((s, p) => s + p.player_assists, 0) / n;
    const nwm = parties.reduce((s, p) => s + p.net_worth / (p.match_duration_s / 60), 0) / n;

    const g = el('div', 'mp-resume-wr');
    g.append(anneau(wr));
    const tg = el('div');
    tg.append(el('div', 'mp-resume-titre', n + ' parties · ' + victoires + ' V ' + (n - victoires) + ' D'),
      el('div', 'aide', 'Winrate ± ' + m95 + ' points' + (n < 20 ? ' : trop peu de parties pour conclure' : '')));
    g.append(tg);

    const c = el('div', 'mp-resume-kda');
    c.append(el('div', 'mp-kda-ligne', un(k) + ' / '), el('div', 'mp-kda-ligne'));
    c.firstChild.append(el('span', 'mp-mort-txt', un(d)), ' / ' + un(a));
    c.lastChild.append(el('strong', 'mp-kda-ratio', kdaRatio(k, d, a) + ':1 KDA'));
    c.append(el('div', 'aide', DLN.fmtNombre(Math.round(nwm)) + ' souls / min en moyenne'));

    const h = el('ul', 'mp-resume-heros');
    const parHeros = {};
    parties.forEach((p) => { (parHeros[p.hero_id] = parHeros[p.hero_id] || []).push(p); });
    Object.keys(parHeros).sort((x, y) => parHeros[y].length - parHeros[x].length).slice(0, 4).forEach((hid) => {
      const ps = parHeros[hid];
      const v = ps.filter((p) => p.match_result === p.player_team).length;
      const sk = ps.reduce((s, p) => s + p.player_kills, 0), sd = ps.reduce((s, p) => s + p.player_deaths, 0), sa = ps.reduce((s, p) => s + p.player_assists, 0);
      const li = el('li');
      const hh = herosDe(Number(hid));
      if (hh) li.append(DLN.img(hh.icone || hh.image, 'mp-icone'));
      li.append(el('strong', null, nomHeros(Number(hid))),
        el('span', 'nombre ' + (v / ps.length >= 0.5 ? 'haut' : 'doux'), Math.round(100 * v / ps.length) + ' %'),
        el('span', 'aide', ps.length + ' partie' + (ps.length > 1 ? 's' : '') + ' · ' + kdaRatio(sk, sd, sa) + ' KDA'));
      h.append(li);
    });
    b.append(g, c, h);
    return b;
  }

  // ---------- ton profil : notes par domaine face aux 11 autres joueurs de tes parties ----------

  function valeur(k, v) {
    if (v == null) return '—';
    const f = DLN.lobby.MESURES[k].fmt;
    if (f === 'pct') return Math.round(v * 100) + ' %';
    if (f === 'min') return un(v) + ' min';
    if (f === 'signe') return (v > 0 ? '+' : v < 0 ? '−' : '') + DLN.fmtNombre(Math.abs(Math.round(v)));
    if (f === 'x') return un(v).replace(/^/, '×');
    return Number.isInteger(v) ? String(v) : DLN.fmtNombre(Math.round(v));
  }

  function profilDomaines(lues) {
    const L = DLN.lobby;
    const b = bloc('Ton profil', 'mp-profil-domaines');
    b.append(el('p', 'aide', 'Ta note dans chaque domaine face aux 11 autres joueurs de tes ' + lues.length + ' dernières parties (même niveau que toi). ' +
      'A = parmi les meilleurs de la partie, E = parmi les derniers. Clique pour le détail.'));
    const tri = L.DOMAINES.map((d) => ({ d: d, s: L.moyenne(lues.map((l) => l.lobby.domaines[d.id]).filter((x) => x != null)) }));
    tri.forEach((x) => {
      const det = el('details', 'mp-domaine');
      const sum = el('summary');
      const barre = el('span', 'mp-dom-barre');
      const remp = el('span', 'mp-dom-plein note-' + L.lettre(x.s));
      remp.style.width = x.s == null ? '0' : Math.max(4, Math.round(x.s * 100)) + '%';
      barre.append(remp);
      sum.append(el('span', 'mp-dom-nom', DLN.tr(x.d.nom)), barre, el('span', 'mp-note note-' + L.lettre(x.s), L.lettre(x.s)));
      det.append(sum);
      const t = el('table', 'table mp-dom-table');
      const th = el('tr');
      ['', 'Toi', 'Médiane de tes parties'].forEach((c) => th.append(el('th', null, c)));
      t.append(th);
      x.d.mesures.forEach((k) => {
        const toi = lues.map((l) => l.lobby.moi[k]).filter((v) => v != null);
        const med = lues.map((l) => l.lobby.mediane[k]).filter((v) => v != null);
        const sc = L.moyenne(lues.map((l) => l.lobby.scores[k]).filter((v) => v != null));
        const tr = el('tr');
        tr.append(el('td', null, DLN.tr(L.MESURES[k].nom)), el('td', 'nombre ' + (sc == null ? '' : sc < 0.3 ? 'bas' : sc > 0.7 ? 'haut' : ''), valeur(k, L.moyenne(toi))),
          el('td', 'nombre doux', valeur(k, L.moyenne(med))));
        t.append(tr);
      });
      det.append(t);
      b.append(det);
    });
    const faible = tri.filter((x) => x.s != null).sort((p, q) => p.s - q.s)[0];
    const fort = tri.filter((x) => x.s != null).sort((p, q) => q.s - p.s)[0];
    if (faible && fort) {
      const p = el('p', 'mp-focus');
      p.append('Point fort : ', el('strong', null, DLN.tr(fort.d.nom)), ' · à travailler en premier : ', el('strong', 'mp-focus-faible', DLN.tr(faible.d.nom)));
      b.append(p);
    }
    return b;
  }

  // ---------- carte de tes morts ----------

  function carteMorts(lues) {
    const b = bloc('Où tu meurs', 'mp-carte-morts');
    const cadre = el('div', 'mp-carte-cadre');
    if (carte && carte.image) cadre.append(DLN.img(carte.image, 'mp-carte-img'));
    const s = svg('svg', { viewBox: '0 0 100 100', class: 'mp-carte-svg' });
    let total = 0, surpris = 0, isoles = 0;
    lues.forEach((l) => {
      const retourner = l.lobby.monEquipe === 1;   // ta base toujours en bas
      l.lobby.morts.forEach((m) => {
        total++;
        if (m.surpris) surpris++;
        if (m.isole) isoles++;
        const x = (retourner ? 1 - m.xy[0] : m.xy[0]) * 100, y = (retourner ? 1 - m.xy[1] : m.xy[1]) * 100;
        const c = svg('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: 1.8, class: 'mp-point ' + (m.isole ? 'isole' : 'groupe') + (m.surpris ? ' surpris' : '') });
        const titre = svg('title');
        titre.textContent = nomHeros(l.p.hero_id) + ' · ' + fmtMin(m.t) + (m.tueur ? ' · tué par ' + nomHeros(m.tueur) : '') + (m.isole ? ' · seul' : '') + (m.surpris ? ' · en moins de 3 s' : '');
        c.append(titre);
        s.append(c);
      });
    });
    cadre.append(s);
    b.append(cadre);
    const leg = el('p', 'aide mp-carte-legende');
    leg.append(el('span', 'mp-pastille isole'), 'seul, aucun allié à moins de ~50 m (' + isoles + '/' + total + ')  ',
      el('span', 'mp-pastille groupe'), 'avec ton équipe  ', el('span', 'mp-pastille surpris'), 'tué en moins de 3 s (' + surpris + ')');
    b.append(leg, el('p', 'aide', 'Ta base est en bas. Survole un point pour le détail.'));
    return b;
  }

  // ---------- le coach : un focus, une leçon, un exercice vérifié partie après partie ----------

  const POIDS = { 1: 1, 2: 0.85, 3: 0.7 };
  const lireCoach = () => DLN.coachEtat.lire();
  const ecrireCoach = (etat) => DLN.coachEtat.ecrire(etat, lecons.lecons);

  // Score moyen (0 à 1) sur une mesure, sur les parties analysées.
  const scoreMoyen = (lues, k) => DLN.lobby.moyenne(lues.map((l) => l.lobby.scores[k]).filter((v) => v != null));

  function besoins(lues) {
    const acquises = lireCoach().acquises || [];
    return lecons.lecons.filter((le) => le.declencheur).map((le) => {
      const s = scoreMoyen(lues, le.declencheur);
      return { le: le, s: s, besoin: s == null ? -1 : (1 - s) * (POIDS[le.priorite] || 0.7) };
    }).filter((x) => x.s != null && x.s < 0.45 && acquises.indexOf(x.le.id) === -1).sort((a, b) => b.besoin - a.besoin);
  }

  function exerciceReussi(le, l) {
    const ex = le.exercice;
    if (ex.score != null) { const s = l.lobby.scores[ex.mesure]; return s == null ? null : s >= ex.score; }
    const v = l.lobby.moi[ex.mesure];
    if (v == null) return null;
    return ex.sens === 'max' ? v <= ex.cible : v >= ex.cible;
  }

  function constat(le, lues) {
    const k = le.declencheur;
    const toi = DLN.lobby.moyenne(lues.map((l) => l.lobby.moi[k]).filter((v) => v != null));
    const med = DLN.lobby.moyenne(lues.map((l) => l.lobby.mediane[k]).filter((v) => v != null));
    return DLN.tr(DLN.lobby.MESURES[k].nom) + ' : ' + valeur(k, toi) + ' pour toi, ' + valeur(k, med) + ' pour la médiane de tes parties (' + lues.length + ' parties).';
  }

  function carteLecon(le, lues) {
    const c = el('article', 'mp-lecon');
    c.append(el('h3', null, le.titre), el('p', 'mp-constat', constat(le, lues)), el('p', null, le.pourquoi));
    const h = el('p', 'mp-conseils-titre', 'Comment ');
    h.append(el('span', 'marque', 'conseil'));
    const ul = el('ul', 'mp-conseils');
    le.comment.forEach((x) => ul.append(el('li', null, x)));
    c.append(h, ul);
    if (le.memo) {
      const a = el('a', 'mp-lien-memo', 'Relire la fiche du Mémo →');
      a.href = 'memo.html#' + le.memo;
      c.append(a);
    }
    return c;
  }

  // Pour la page Parcours : leçons conseillées et série de réussites de chaque exercice mesurable.
  function enregistrerSuivi(lues) {
    const etat = lireCoach();
    const recentes = lues.slice().sort((a, b2) => b2.p.start_time - a.p.start_time);
    etat.recommandees = besoins(recentes.slice(0, 10)).slice(0, 3).map((x) => x.le.id);
    etat.suivi = {};
    lecons.lecons.filter((le) => le.declencheur).forEach((le) => {
      let serie = 0;
      // Pour le focus en cours, seules comptent les parties jouées depuis son choix.
      const prises = le.id === etat.focus ? recentes.filter((l) => l.p.start_time > (etat.depuis || 0)) : recentes;
      for (const l of prises) { if (exerciceReussi(le, l)) serie++; else break; }
      etat.suivi[le.id] = { serie: serie, cible: le.exercice.reussites };
      if (serie >= le.exercice.reussites && le.id === etat.focus) etat.acquises = (etat.acquises || []).concat([le.id]).filter((v, i, a) => a.indexOf(v) === i);
    });
    etat.maj = Date.now();
    ecrireCoach(etat);
  }

  function blocCoach(lues) {
    enregistrerSuivi(lues);
    const b = bloc('Ton coach', 'mp-coach');
    const etat = lireCoach();
    const le = etat.focus && lecons.lecons.find((x) => x.id === etat.focus);
    const recentes = lues.slice().sort((a, b2) => b2.p.start_time - a.p.start_time);

    if (!le) {
      const props = besoins(recentes.slice(0, 10)).slice(0, 3);
      b.append(el('p', 'aide', 'Un seul point à travailler à la fois : c\'est ce qui fait progresser le plus vite. Voici ce que tes parties suggèrent, ' +
        'du plus utile au moins utile pour toi. Choisis-en un : la page vérifiera l\'exercice sur tes prochaines parties.'));
      if (!props.length) b.append(el('p', 'doux', 'Rien de net ne ressort pour l\'instant : continue de jouer, le coach s\'affinera avec plus de parties.'));
      props.forEach((x, i) => {
        const d = el('details', 'mp-proposition');
        if (i === 0) d.open = true;
        const s = el('summary');
        s.append(el('span', 'mp-prop-rang', String(i + 1)), el('strong', null, x.le.titre), el('span', 'aide', 'Exercice : ' + x.le.exercice.texte));
        d.append(s, carteLecon(x.le, recentes.slice(0, 10)));
        const go = el('button', 'btn principal', 'Je travaille ça');
        go.type = 'button';
        go.addEventListener('click', () => {
          ecrireCoach(Object.assign(lireCoach(), { focus: x.le.id, depuis: recentes[0].p.start_time }));
          afficherBilan(lues);
        });
        d.append(go);
        b.append(d);
      });
      return b;
    }

    // Focus en cours
    const tete = el('div', 'mp-focus-tete');
    tete.append(el('span', 'marque', 'focus'), el('strong', 'mp-focus-titre', le.titre));
    b.append(tete);
    const ex = el('div', 'mp-exercice');
    ex.append(el('p', null, 'Exercice à chaque partie : '), el('strong', null, le.exercice.texte));
    const apres = recentes.filter((l) => l.p.start_time > etat.depuis).reverse();
    const suivi = el('ol', 'mp-suivi');
    let serie = 0;
    apres.forEach((l) => {
      const r = exerciceReussi(le, l);
      const v = l.lobby.moi[le.exercice.mesure];
      const li = el('li', r ? 'ok' : r === false ? 'rate' : '');
      li.append(el('span', 'mp-suivi-marque', r ? '✓' : r === false ? '✗' : '?'),
        el('span', null, nomHeros(l.p.hero_id) + ' · ' + new Date(l.p.start_time * 1000).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' · ' + valeur(le.exercice.mesure, v)));
      suivi.append(li);
      serie = r ? serie + 1 : 0;
    });
    if (!apres.length) ex.append(el('p', 'aide', 'Pas encore de partie depuis le choix de ce focus. Joue, puis reviens et clique sur « ↻ Actualiser ».'));
    else ex.append(suivi, el('p', 'aide', serie + ' réussite' + (serie > 1 ? 's' : '') + ' d\'affilée sur ' + le.exercice.reussites + ' pour valider.'));
    b.append(ex);
    if (serie >= le.exercice.reussites) {
      const bravo = el('p', 'mp-bravo', 'Acquis : ' + le.exercice.reussites + ' parties réussies d\'affilée. Passe au point suivant.');
      const suivant = el('button', 'btn principal', 'Choisir le prochain point');
      suivant.type = 'button';
      suivant.addEventListener('click', () => {
        const e2 = lireCoach();
        e2.acquises = (e2.acquises || []).concat([le.id]);
        delete e2.focus;
        ecrireCoach(e2);
        afficherBilan(lues);
      });
      b.append(bravo, suivant);
    }
    const det = el('details', 'mp-lecon-det');
    det.append(el('summary', null, 'La leçon'), carteLecon(le, recentes.slice(0, 10)));
    b.append(det);
    const changer = el('button', 'btn discret', 'Changer de focus');
    changer.type = 'button';
    changer.addEventListener('click', () => { const e2 = lireCoach(); delete e2.focus; ecrireCoach(e2); afficherBilan(lues); });
    b.append(changer);
    b.append(el('p', 'aide', 'Ce focus s\'affiche aussi sur la page En partie, pour l\'avoir en tête pendant la partie.'));
    return b;
  }

  // ---------- revue des morts, comme en review avec un coach ----------

  function verdictMort(m) {
    if (m.inferiorite) return { cls: 'grave', txt: m.ennemis + ' ennemis contre ' + (m.allies + 1) + ' : combat perdu d\'avance.' };
    if (m.isole) return { cls: 'grave', txt: 'Seul, aucun allié à moins de ~50 m.' };
    if (m.engage_bas) return { cls: 'moyen', txt: 'Combat engagé avec ' + m.vie_debut + ' % de vie.' };
    if (m.cote_adverse) return { cls: 'moyen', txt: 'Dans leur moitié de carte.' };
    if (m.surpris) return { cls: 'moyen', txt: 'Tué en moins de 3 s : pris par surprise.' };
    if (m.allies + 1 > m.ennemis) return { cls: 'neutre', txt: 'Ton équipe était en surnombre (' + (m.allies + 1) + ' contre ' + m.ennemis + ') : regarde ce qui a coincé.' };
    return { cls: 'neutre', txt: 'Combat à égalité (' + (m.allies + 1) + ' contre ' + m.ennemis + ').' };
  }

  // ---------- débrief de la dernière partie ----------
  // Ce qu'un coach dit juste après une partie : un point réussi, un point à corriger, l'exercice du focus,
  // la mort la plus évitable, et ce qui a bougé par rapport aux parties d'avant.

  const GRAVITE = (m) => (m.inferiorite ? 4 : m.isole ? 3 : m.engage_bas ? 2 : m.cote_adverse ? 1.5 : m.surpris ? 1 : 0);
  const T = (fr, en) => DLN.tr({ fr: fr, en: en });

  function tuile(classe, titre, contenu) {
    const t = el('div', 'mp-tuile ' + classe);
    t.append(el('div', 'mp-tuile-titre', titre));
    contenu.forEach((c) => { if (c) t.append(c); });
    return t;
  }

  function lienLecon(k) {
    const le = lecons && lecons.lecons.find((x) => x.declencheur === k);
    if (!le) return null;
    const a = el('a', 'mp-lien-memo', T('Leçon : ', 'Lesson: ') + le.titre + ' →');
    a.href = 'parcours.html#l=' + le.id;
    return a;
  }

  function debrief(lues) {
    const L = DLN.lobby;
    const tri = lues.slice().sort((a, b) => b.p.start_time - a.p.start_time);
    const l = tri[0], avant = tri.slice(1, 11);
    const b = bloc(null, 'mp-debrief');
    const p = l.p, victoire = p.match_result === p.player_team;
    const tete = el('div', 'mp-debrief-tete');
    const h = herosDe(p.hero_id);
    if (h) tete.append(DLN.img(h.icone || h.image, 'mp-portrait'));
    const titre = el('div');
    titre.append(el('h2', null, T('Débrief de ta dernière partie', 'Debrief of your last game')),
      el('div', null, nomHeros(p.hero_id) + ' · ' + (victoire ? T('Victoire', 'Win') : T('Défaite', 'Loss')) + ' · ' +
        new Date(p.start_time * 1000).toLocaleDateString(DLN.langue === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) +
        ' · ' + Math.round(p.match_duration_s / 60) + ' min · ' + p.player_kills + ' / ' + p.player_deaths + ' / ' + p.player_assists));
    const g = L.lettre(l.lobby.global);
    const note = el('div', 'mp-debrief-note');
    note.append(el('span', 'mp-note grande note-' + g, g), el('span', 'aide', l.lobby.place + (l.lobby.place === 1 ? T('er', 'st') : T('e', 'th')) + ' / ' + l.lobby.n));
    tete.append(titre, note);
    b.append(tete);

    const grille = el('div', 'mp-tuiles');
    // Point fort et point à corriger : meilleure et pire mesure de la partie (face aux 11 autres).
    const sc = Object.keys(l.lobby.scores).map((k) => ({ k: k, s: l.lobby.scores[k] })).sort((x, y) => y.s - x.s);
    const ligne = (k) => el('p', null, DLN.tr(L.MESURES[k].nom) + ' : ' + valeur(k, l.lobby.moi[k]) + T(' (médiane de la partie : ', ' (game median: ') + valeur(k, l.lobby.mediane[k]) + ')');
    if (sc.length) {
      grille.append(tuile('bon', T('✓ Ton point fort', '✓ Your strong point'), [ligne(sc[0].k), el('p', 'aide', T('Garde ça.', 'Keep it up.'))]));
      const pire = sc[sc.length - 1];
      grille.append(tuile('mauvais', T('✗ À corriger', '✗ To fix'), [ligne(pire.k), lienLecon(pire.k)]));
    }
    // Exercice du focus
    const etat = lireCoach();
    const le = etat.focus && lecons && lecons.lecons.find((x) => x.id === etat.focus);
    if (le && !le.exercice.manuel) {
      const r = exerciceReussi(le, l);
      const apres = p.start_time > (etat.depuis || 0);
      grille.append(tuile(r ? 'bon' : r === false ? 'mauvais' : '', T('🎯 Exercice : ', '🎯 Drill: ') + le.titre, [
        el('p', null, le.exercice.texte), el('p', 'mp-ex-res', (r ? T('Réussi', 'Done') : r === false ? T('Raté', 'Missed') : '?') + ' · ' + valeur(le.exercice.mesure, l.lobby.moi[le.exercice.mesure])),
        apres ? null : el('p', 'aide', T('Partie jouée avant le choix de ce focus : elle ne compte pas.', 'Game played before this focus was chosen: it does not count.'))]));
    } else {
      const a = el('a', 'mp-lien-memo', T('Choisir un focus dans le parcours →', 'Pick a focus in the path →'));
      a.href = 'parcours.html';
      grille.append(tuile('', T('🎯 Pas de focus', '🎯 No focus'), [el('p', null, T('Un point à travailler à la fois : c\'est ce qui fait progresser.', 'One thing at a time: that\'s how you improve.')), a]));
    }
    // Mort la plus évitable : la plus grave, et la plus tardive à gravité égale (respawn plus long).
    const morts = l.lobby.morts.slice().sort((x, y) => GRAVITE(y) - GRAVITE(x) || y.t - x.t);
    if (morts.length && GRAVITE(morts[0]) > 0) {
      const m = morts[0];
      grille.append(tuile('mauvais', T('💀 Ta mort la plus évitable', '💀 Your most avoidable death'), [
        el('p', null, fmtMin(m.t) + (m.tueur ? T(' · tué par ', ' · killed by ') + nomHeros(m.tueur) : '') + (m.duree ? ' · ' + m.duree + T(' s à attendre', ' s respawn') : '')),
        el('p', null, verdictMort(m).txt),
        lienLecon(m.inferiorite ? 'inferiorite' : m.isole ? 'isoles' : m.engage_bas ? 'engage_bas' : null)]));
    } else {
      grille.append(tuile('bon', T('💀 Tes morts', '💀 Your deaths'), [el('p', null, morts.length ? T('Aucune mort évitable repérée.', 'No avoidable death spotted.') : T('Aucune mort. Bravo.', 'No deaths. Well done.'))]));
    }
    b.append(grille);

    // Ce qui a bougé par rapport aux parties d'avant (domaines qui changent nettement).
    if (avant.length >= 2) {
      const evol = L.DOMAINES.map((d) => {
        const v = l.lobby.domaines[d.id], ref = L.moyenne(avant.map((x) => x.lobby.domaines[d.id]).filter((x) => x != null));
        return { d: d, ecart: v != null && ref != null ? v - ref : null };
      }).filter((x) => x.ecart != null && Math.abs(x.ecart) >= 0.15).sort((x, y) => y.ecart - x.ecart);
      if (evol.length) {
        const e = el('p', 'mp-evol');
        e.append(T('Par rapport à tes ' + avant.length + ' parties d\'avant : ', 'Compared with your previous ' + avant.length + ' games: '));
        evol.forEach((x, i) => {
          if (i) e.append(' · ');
          e.append(el('span', x.ecart > 0 ? 'haut' : 'bas', (x.ecart > 0 ? '↑ ' : '↓ ') + DLN.tr(x.d.nom)));
        });
        b.append(e);
      }
    }
    return b;
  }

  async function afficherBilan(lues) {
    const z = contenu();
    z.textContent = '';
    const n = parties.length;
    const victoires = parties.filter((p) => p.match_result === p.player_team).length;

    // --- 1. Résumé, ton profil par domaine, carte de tes morts ---
    z.append(resume(victoires, n));
    const analysees = lues.filter((l) => l.lobby);
    if (analysees.length) z.append(debrief(analysees));
    if (analysees.length && lecons) z.append(blocCoach(analysees));
    if (analysees.length) {
      const ligne = el('div', 'mp-duo');
      ligne.append(profilDomaines(analysees), carteMorts(analysees));
      z.append(ligne);
    }

    // --- 2. Les axes de progression ---
    const axes = await calculerAxes(lues);
    const blocAxes = bloc('Comparé à tous les joueurs de tes héros', 'mp-axes');
    blocAxes.append(el('p', 'aide', 'Ici, la comparaison se fait avec tous les joueurs des mêmes héros, au rang choisi dans ⚙, depuis le patch. « Ton profil », plus haut, ' +
      'te compare aux joueurs de tes propres parties : les deux peuvent différer.'))
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
    // Replié : à ton niveau, la comparaison avec ta propre partie (Ton coach) est la plus juste.
    const pli = el('details', 'mp-pli');
    pli.append(el('summary', null, 'Comparaison avec tous les joueurs de tes héros (rang choisi dans ⚙)'));
    blocAxes.querySelector('h2').remove();
    pli.append(blocAxes);
    z.append(pli);

    // --- 4. Partie par partie ---
    const blocParties = bloc('Partie par partie', 'mp-parties');
    for (const p of parties) blocParties.append(await carteMatch(p, lues.find((l) => l.p === p)));
    z.append(blocParties);

    // --- 5. Données manquantes ---
    const aide = bloc(DLN.tr({ fr: 'Pourquoi il manque des parties ?', en: 'Why are games missing?' }), 'mp-aide');
    aide.append(el('p', null, DLN.tr({
      fr: 'deadlock-api.com ne voit pas toutes les parties : elle en récupère une partie chaque jour, au hasard. Pour que toutes les tiennes arrivent automatiquement, ' +
        'installe sur ton PC l\'outil gratuit de l\'API, deadlock-api-ingest : il envoie tes parties pendant que tu joues.',
      en: 'deadlock-api.com does not see every game: it collects a share of them each day, at random. To get all of yours automatically, ' +
        'install the API\'s free tool, deadlock-api-ingest, on your PC: it sends your games while you play.' })));
    const etapes = el('ol', 'mp-etapes');
    [
      { fr: 'Dans PowerShell (Windows) : irm https://raw.githubusercontent.com/deadlock-api/deadlock-api-ingest/master/install-windows.ps1 | iex',
        en: 'In PowerShell (Windows): irm https://raw.githubusercontent.com/deadlock-api/deadlock-api-ingest/master/install-windows.ps1 | iex' },
      { fr: 'Une fois, pour récupérer tes parties passées : deadlock-api-ingest.exe --own-matches',
        en: 'Once, to recover your past games: deadlock-api-ingest.exe --own-matches' },
      { fr: 'Pour qu\'il tourne seulement pendant le jeu : Steam → clic droit sur Deadlock → Propriétés → Options de lancement : "C:\\Users\\TON_NOM\\AppData\\Local\\deadlock-api-ingest\\deadlock-api-ingest.exe" -- %command%',
        en: 'To run it only while playing: Steam → right-click Deadlock → Properties → Launch options: "C:\\Users\\YOUR_NAME\\AppData\\Local\\deadlock-api-ingest\\deadlock-api-ingest.exe" -- %command%' }
    ].forEach((x) => etapes.append(el('li', null, DLN.tr(x))));
    aide.append(etapes);
    aide.append(el('p', 'aide', DLN.tr({
      fr: 'À savoir : par défaut, l\'outil utilise la session Steam enregistrée sur ton PC pour retrouver tes parties (le jeton reste sur ton PC d\'après son code). ' +
        'L\'option --no-gc évite ça, en ne lisant que le cache de Steam. Sans rien installer, colle le numéro d\'une partie plus haut (3 par heure).',
      en: 'Good to know: by default the tool uses the Steam session saved on your PC to find your games (according to its code, the token stays on your PC). ' +
        'The --no-gc option avoids that by reading only Steam\'s cache. Without installing anything, paste a match number above (3 per hour).' })));
    const lien = el('a', 'mp-lien-memo', 'github.com/deadlock-api/deadlock-api-ingest →');
    lien.href = 'https://github.com/deadlock-api/deadlock-api-ingest';
    lien.target = '_blank';
    lien.rel = 'noopener';
    aide.append(lien);
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
    const s = el('summary', 'mp-ligne');
    const h = herosDe(p.hero_id);
    const date = new Date(p.start_time * 1000).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    const duree = p.match_duration_s / 60;
    const c1 = el('div', 'mp-l-res');
    c1.append(el('strong', 'mp-resultat', victoire ? 'Victoire' : 'Défaite'), el('span', 'aide', date), el('span', 'aide', Math.round(duree) + ' min'));
    const c2 = el('div', 'mp-l-heros');
    if (h) c2.append(DLN.img(h.icone || h.image, 'mp-portrait'));
    c2.append(el('span', null, nomHeros(p.hero_id)));
    const c3 = el('div', 'mp-l-kda');
    const k = el('div', 'mp-kda-ligne', p.player_kills + ' / ');
    k.append(el('span', 'mp-mort-txt', String(p.player_deaths)), ' / ' + p.player_assists);
    c3.append(k, el('span', 'aide', kdaRatio(p.player_kills, p.player_deaths, p.player_assists) + ':1 KDA'));
    const c4 = el('div', 'mp-l-stats aide');
    c4.append(el('span', null, nombre(p.net_worth / duree) + ' souls/min'));
    if (l && l.lobby) {
      const m = l.lobby.moi;
      if (m.creeps_9 != null) c4.append(el('span', null, Math.round(m.creeps_9 * 100) + ' % troopers à 9 min'));
      c4.append(el('span', null, nombre(m.degats_min) + ' dégâts/min'));
    }
    const c5 = el('div', 'mp-l-objets');
    if (l) l.achats.filter((x) => !x.vendu && x.o.tier >= 2).slice(-8).forEach((x) => {
      const i = DLN.img(x.o.image, 'mp-obj obj-' + x.o.categorie);
      i.title = x.o.nom + ' · ' + fmtMin(x.t);
      c5.append(i);
    });
    const c6 = el('div', 'mp-l-note');
    if (l && l.lobby) {
      const g = DLN.lobby.lettre(l.lobby.global);
      c6.append(el('span', 'mp-note note-' + g, g), el('span', 'aide', l.lobby.place + (l.lobby.place === 1 ? 'er' : 'e') + ' / ' + l.lobby.n));
      if (l.lobby.mvp) c6.append(el('span', 'mp-mvp', 'MVP'));
      c6.title = 'Note de la partie : ta place parmi les ' + l.lobby.n + ' joueurs, toutes mesures confondues. MVP = le meilleur de ton équipe.';
    }
    const c7 = el('div', 'mp-l-equipes');
    if (l && l.lobby) l.lobby.equipes.forEach((eq, t) => {
      const col = el('div', 'mp-eq' + (t === l.lobby.monEquipe ? ' mienne' : ''));
      eq.forEach((x) => {
        const hh = herosDe(x.hero);
        const i = hh ? DLN.img(hh.icone || hh.image, 'mp-mini' + (x.moi ? ' moi' : '')) : el('span');
        i.title = nomHeros(x.hero);
        col.append(i);
      });
      c7.append(col);
    });
    s.append(c1, c2, c3, c4, c5, c6, c7);
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
      const ul = el('ul', 'mp-liste mp-revue');
      (l.lobby ? l.lobby.morts : l.morts).forEach((x) => {
        const li = el('li');
        li.append(el('span', 'mp-revue-t', fmtMin(x.t)), el('span', null, x.tueur ? 'par ' + nomHeros(x.tueur) : ''));
        if (l.lobby) { const v = verdictMort(x); li.className = 'mp-v-' + v.cls; li.append(el('span', 'mp-revue-v', v.txt)); }
        ul.append(li);
      });
      morts.append(ul);
      if (l.lobby) morts.append(el('p', 'aide', 'Revue : pour chaque mort, la cause la plus probable d\'après les positions des 12 joueurs et ta vie à la seconde.'));
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

  // ---------- parties ajoutées par leur numéro (Match ID) ----------
  // L'API ne voit pas toutes les parties ; avec le numéro, elle va chercher la partie chez Steam
  // (3 demandes par heure et par adresse IP). Les numéros sont gardés dans ce navigateur, par compte.
  const CLE_AJOUTEES = 'dln.parties.ajoutees.v1';
  const lireAjoutees = () => { try { return (JSON.parse(localStorage.getItem(CLE_AJOUTEES)) || {})[moi.id] || []; } catch (e) { return []; } };
  function ecrireAjoutees(liste) {
    try {
      const tout = JSON.parse(localStorage.getItem(CLE_AJOUTEES)) || {};
      tout[moi.id] = liste;
      localStorage.setItem(CLE_AJOUTEES, JSON.stringify(tout));
    } catch (e) { /* stockage indisponible */ }
  }

  // Entrée d'historique (même forme que /match-history) reconstruite depuis le détail d'une partie.
  function entreeDepuisDetail(d) {
    const info = d.match_info || d;
    const me = info.players.find((x) => x.account_id === moi.id);
    if (!me) return null;
    const fin = (me.stats || [])[me.stats.length - 1] || {};
    return {
      match_id: info.match_id, hero_id: me.hero_id, start_time: info.start_time, match_duration_s: info.duration_s,
      match_result: info.winning_team, player_team: me.team, player_kills: me.kills, player_deaths: me.deaths,
      player_assists: me.assists, net_worth: me.net_worth || fin.net_worth || 0, last_hits: me.last_hits, denies: me.denies,
      game_mode: info.game_mode, ajoutee: true
    };
  }

  async function detailPartie(matchId) {
    if (!details[matchId]) details[matchId] = await api('/v1/matches/' + matchId + '/metadata');
    return details[matchId];
  }

  async function ajouterPartie(texte, message) {
    const m = /(\d{6,12})/.exec(texte || '');
    if (!m) { message.textContent = DLN.tr({ fr: 'Colle le numéro de la partie (Match ID), que des chiffres.', en: 'Paste the match number (Match ID), digits only.' }); return; }
    const id = Number(m[1]);
    if (parties.some((p) => p.match_id === id)) { message.textContent = DLN.tr({ fr: 'Cette partie est déjà dans ta liste.', en: 'This match is already in your list.' }); return; }
    message.textContent = DLN.tr({ fr: 'Recherche de la partie chez Steam…', en: 'Fetching the match from Steam…' });
    try {
      const d = await detailPartie(id);
      if (!entreeDepuisDetail(d)) { delete details[id]; message.textContent = DLN.tr({ fr: 'Tu n\'es pas dans cette partie : vérifie le numéro ou le compte.', en: 'You are not in this match: check the number or the account.' }); return; }
      ecrireAjoutees(lireAjoutees().filter((x) => x !== id).concat([id]));
      await charger(moi.id);
    } catch (e) {
      const limite = /429/.test(e.message);
      message.textContent = limite
        ? DLN.tr({ fr: 'Limite atteinte : 3 parties par heure peuvent être cherchées chez Steam. Réessaie plus tard.', en: 'Limit reached: 3 matches per hour can be fetched from Steam. Try again later.' })
        : DLN.tr({ fr: 'Partie introuvable pour l\'instant (', en: 'Match not found for now (' }) + e.message + DLN.tr({ fr: '). Si elle vient de finir, réessaie dans quelques minutes.', en: '). If it just ended, try again in a few minutes.' });
    }
  }

  function formulaireAjout() {
    const f = el('form', 'mp-ajout');
    const lab = el('label', null, DLN.tr({ fr: 'Ajouter une partie par son numéro', en: 'Add a match by its number' }));
    lab.htmlFor = 'mp-ajout-id';
    const input = el('input');
    input.id = 'mp-ajout-id';
    input.inputMode = 'numeric';
    input.autocomplete = 'off';
    input.placeholder = 'Match ID';
    const b = el('button', 'btn', DLN.tr({ fr: 'Ajouter', en: 'Add' }));
    b.type = 'submit';
    const msg = el('p', 'aide mp-ajout-msg', DLN.tr({ fr: 'Le Match ID est dans l\'historique des parties du jeu. Utile juste après une partie : l\'API ne les voit pas toutes.',
      en: 'The Match ID is in the in-game match history. Useful right after a game: the API does not see them all.' }));
    f.append(lab, input, b, msg);
    f.addEventListener('submit', (e) => { e.preventDefault(); ajouterPartie(input.value, msg); });
    return f;
  }

  // ---------- chargement ----------

  async function charger(id, frais) {
    if (frais) { details = {}; metriques = {}; courbes = {}; }
    const z = contenu();
    z.textContent = '';
    z.append(el('p', 'aide', 'Chargement de tes parties…'));
    const [steam, rang, histo] = await Promise.all([
      api('/v1/players/steam?account_ids=' + id).catch(() => []),
      api('/v1/players/' + id + '/rank').catch(() => null),
      api('/v1/players/' + id + '/match-history')
    ]);
    const s = steam[0] || {};
    moi = { id: id, nom: s.personaname, avatar: s.avatarmedium || s.avatar, rang: rang,
      majA: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) };
    try { localStorage.setItem(CLE, String(id)); } catch (e) { /* stockage indisponible */ }
    afficherProfil();
    parties = histo.filter((p) => p.game_mode === 1);
    // Parties ajoutées par leur numéro et absentes de l'historique de l'API.
    for (const mid of lireAjoutees()) {
      if (parties.some((p) => p.match_id === mid)) continue;
      try { const e = entreeDepuisDetail(await detailPartie(mid)); if (e) parties.push(e); } catch (e) { /* indisponible pour l'instant */ }
    }
    parties.sort((a, b) => b.start_time - a.start_time);
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
    .concat([DLN.charger('data/tempo.json').catch(() => null), DLN.profil, DLN.charger('data/map.json').catch(() => null), DLN.coachEtat.lecons().catch(() => null)])).then((r) => {
    carte = r[5];
    lecons = r[6];
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
