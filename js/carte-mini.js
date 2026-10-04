// Carte compacte pour la page En partie : la minimap (data/map.json) avec ce qui est ouvert
// ou arrive bientôt, d'après le chrono (data/timeline.json et l'état du chrono dans le navigateur).
// Expose aussi DLN.orientationCarte, partagé avec la page Carte : 0 = The Hidden King (base en bas),
// 1 = The Archmother (base en haut, carte retournée pour l'avoir en bas).
(function () {
  'use strict';

  const el = DLN.el;
  const SVG = 'http://www.w3.org/2000/svg';
  const CLE_EQUIPE = 'dln.carte.equipe.v1';
  const CLE_CHRONO = 'dln.timeline.etat.v1';
  const T = 1000;
  const MAINTENANT_S = 30;   // un objectif reste « là » 30 s après son apparition
  const EQUIPES = [
    { nom: 'The Hidden King', couleur: '#f5a524', cote: 'en bas' },
    { nom: 'The Archmother', couleur: '#5aa9ff', cote: 'en haut' }
  ];

  // ---------- orientation partagée ----------

  const ecouteursEquipe = [];
  function equipe() {
    try { return Number(localStorage.getItem(CLE_EQUIPE)) === 1 ? 1 : 0; } catch (e) { return 0; }
  }
  function regleEquipe(v) {
    try { localStorage.setItem(CLE_EQUIPE, String(v)); } catch (e) { /* stockage indisponible */ }
    ecouteursEquipe.forEach((f) => f(v));
  }
  window.addEventListener('storage', (e) => { if (e.key === CLE_EQUIPE) ecouteursEquipe.forEach((f) => f(equipe())); });

  // Bouton « Je joue : … » qui retourne la carte pour avoir sa base en bas.
  function boutonEquipe() {
    const b = el('button', 'btn discret bouton-equipe');
    b.type = 'button';
    const maj = () => {
      const e = EQUIPES[equipe()];
      b.textContent = '';
      const pastille = el('span', 'pastille-equipe');
      pastille.style.background = e.couleur;
      b.append(pastille, 'Je joue ' + e.nom + ' ⇄');
      b.title = 'Cliquer si tu es dans l\'autre équipe : la carte se retourne pour que ta base soit en bas.';
    };
    // blur : sinon Espace (raccourci du chrono) réactiverait ce bouton.
    b.addEventListener('click', () => { regleEquipe(1 - equipe()); b.blur(); });
    ecouteursEquipe.push(maj);
    maj();
    return b;
  }

  DLN.orientationCarte = { equipe: equipe, regler: regleEquipe, surChange: (f) => ecouteursEquipe.push(f), bouton: boutonEquipe, EQUIPES: EQUIPES };

  // ---------- temps du chrono (même calcul que js/timeline.js) ----------

  function tempsChrono() {
    try {
      const e = JSON.parse(localStorage.getItem(CLE_CHRONO)) || {};
      if (e.depart != null) return { t: Math.max(0, (Date.now() - e.depart) / 1000), lance: true };
      if (e.pauseA != null) return { t: e.pauseA, lance: true };
    } catch (err) { /* stockage indisponible */ }
    return { t: 0, lance: false };
  }

  const fmt = (s) => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  // ---------- carte ----------

  // Couches montrées et événement du chrono qui les règle (ids de data/timeline.json).
  const COUCHES = [
    { id: 'structures' }, { id: 'lanes' }, { id: 'shops', couleur: '#ffd24a', forme: 'carre', r: 7 },
    { id: 'camps_small', couleur: '#9be37a', forme: 'triangle', r: 11, evenement: 'small_camps' },
    { id: 'camps_medium', couleur: '#f2d04b', forme: 'triangle', r: 11, evenement: 'medium_camps' },
    { id: 'camps_large', couleur: '#ff7a45', forme: 'triangle', r: 12, evenement: 'large_camps' },
    { id: 'sinners', couleur: '#ff6b9d', forme: 'carre', r: 8, evenement: 'sinners' },
    { id: 'powerups', couleur: '#ffffff', r: 12, evenement: 'powerups' },
    { id: 'urn_depart', couleur: '#c9a0ff', r: 10, evenement: 'urn' },
    { id: 'urn_depot', couleur: '#c9a0ff', forme: 'carre', r: 10, evenement: 'urn' },
    { id: 'rifts', couleur: '#4fd6d6', r: 13, evenement: 'rift' },
    { id: 'midboss', couleur: '#7cfc9a', r: 15 }
  ];

  function svgEl(nom, attributs) {
    const e = document.createElementNS(SVG, nom);
    Object.keys(attributs || {}).forEach((k) => e.setAttribute(k, attributs[k]));
    return e;
  }

  function forme(c, x, y, couleur) {
    const r = c.r || 8;
    if (c.forme === 'carre') return svgEl('rect', { x: x - r, y: y - r, width: 2 * r, height: 2 * r, fill: couleur });
    if (c.forme === 'triangle') return svgEl('polygon', { points: [x, y - r, x + r, y + r * 0.8, x - r, y + r * 0.8].join(' '), fill: couleur });
    return svgEl('circle', { cx: x, cy: y, r: r, fill: couleur });
  }

  // État d'un événement au temps t : 'ferme' (pas encore ouvert), 'bientot', 'maintenant', 'ouvert' (dispo en continu),
  // 'attente' (récurrent entre deux apparitions). `dans` = secondes avant la prochaine apparition.
  function etatEvenement(ev, t) {
    if (!ev) return { etat: 'ouvert' };
    const preavis = Math.max(ev.annonce_avant_s || 0, 30);
    if (ev.type === 'unique') {
      if (t < ev.temps_s - preavis) return { etat: 'ferme', dans: ev.temps_s - t };
      if (t < ev.temps_s) return { etat: 'bientot', dans: ev.temps_s - t };
      return { etat: t < ev.temps_s + MAINTENANT_S ? 'maintenant' : 'ouvert' };
    }
    if (ev.type === 'recurrent') {
      if (t < ev.temps_s - preavis) return { etat: 'ferme', dans: ev.temps_s - t };
      const n = Math.max(0, Math.ceil((t - ev.temps_s) / ev.intervalle_s));
      const prochain = ev.temps_s + n * ev.intervalle_s;
      const dernier = prochain - ev.intervalle_s;
      if (t >= ev.temps_s && t - dernier < MAINTENANT_S && dernier >= ev.temps_s) return { etat: 'maintenant', dans: prochain - t };
      if (prochain - t <= preavis) return { etat: 'bientot', dans: prochain - t };
      return { etat: 'attente', dans: prochain - t };
    }
    if (ev.type === 'fenetre') {
      if (t < ev.debut_s - preavis) return { etat: 'ferme', dans: ev.debut_s - t };
      if (t < ev.debut_s) return { etat: 'bientot', dans: ev.debut_s - t, approx: true };
      if (t <= ev.fin_s) return { etat: 'maintenant', approx: true };
      return { etat: 'attente', approx: true };
    }
    return { etat: 'ouvert' };
  }

  function creer(conteneur, donnees) {
    const carte = donnees.carte, timeline = donnees.timeline, niveaux = donnees.niveaux || { evenements: {} };
    // Même filtre que le chrono : un événement s'affiche à partir du niveau donné par data/niveaux.json ;
    // une couche sans événement suit le niveau de data/map.json.
    const montre = (c, couche) => (c.evenement && niveaux.evenements[c.evenement] != null
      ? niveaux.evenements[c.evenement] : (couche.niveau || 1)) <= DLN.niveau();
    const parId = {};
    carte.couches.forEach((c) => { parId[c.id] = c; });
    const evParId = {};
    timeline.evenements.forEach((e) => { evParId[e.id] = e; });

    const tete = el('div', 'carte-partie-tete');
    tete.append(el('h2', null, 'Carte'));
    // Sur En partie, le bouton d'équipe est dans la barre de contexte : pas de doublon ici.
    if (!DLN.partieContexte) tete.append(boutonEquipe());
    const zone = el('div', 'carte-partie-zone');
    const image = el('img');
    image.src = carte.image;
    image.alt = 'Minimap';
    const svg = svgEl('svg', { viewBox: '0 0 ' + T + ' ' + T, preserveAspectRatio: 'none', 'aria-label': 'Objectifs sur la carte' });
    zone.append(image, svg);
    const liste = el('ul', 'carte-partie-liste');
    conteneur.append(tete, zone, liste);

    function orienter() { zone.classList.toggle('retournee', equipe() === 1); }
    ecouteursEquipe.push(orienter);
    orienter();

    // Lanes : couleur → position moyenne (gauche → droite sur la carte non retournée).
    const lanesX = ((parId.lanes || {}).lignes || []).map((l) => ({
      couleur: l.couleur.toLowerCase(), x: l.trace.reduce((s, p) => s + p[0], 0) / l.trace.length
    }));
    const LANES_ID = { '#f1cc30': 'yellow', '#29b1cc': 'blue', '#59b247': 'green' };
    const laneProche = (x) => lanesX.reduce((m, l) => (!m || Math.abs(l.x - x) < Math.abs(m.x - x) ? l : m), null);
    const COTE_LANE = ['camps_small', 'camps_medium', 'camps_large', 'sinners'];

    function dessiner() {
      const chrono = tempsChrono();
      const t = chrono.t;
      const ctx = DLN.partieContexte ? DLN.partieContexte.get() : {};
      const retournee = equipe() === 1;
      svg.textContent = '';
      liste.textContent = '';

      // 1. Ce qui est montré : couches du niveau, filtrées par le rôle ; pour un rôle de side lane,
      //    seulement la jungle la plus proche de sa lane.
      const entrees = [];
      COUCHES.forEach((c) => {
        const couche = parId[c.id];
        if (!couche || !montre(c, couche)) return;
        if (ctx.priorites && c.evenement && ctx.priorites.indexOf(c.evenement) === -1) return;
        let elements = couche.elements || [];
        if (ctx.cote === 'lane' && ctx.lane && COTE_LANE.indexOf(c.id) !== -1) {
          elements = elements.filter((e) => { const l = laneProche(e.xy[0]); return l && LANES_ID[l.couleur] === ctx.lane; });
        }
        const ev = c.evenement ? evParId[c.evenement] : null;
        entrees.push({ c: c, couche: couche, ev: ev, st: etatEvenement(ev, t), elements: elements });
      });

      // 2. Numéros : les objectifs du chrono, dans l'ordre d'urgence.
      const ordre = { maintenant: 0, bientot: 1, attente: 2, ferme: 3, ouvert: 4 };
      const lignes = [];
      entrees.filter((x) => x.ev && x.elements.length).forEach((x) => { if (lignes.every((l) => l.ev !== x.ev)) lignes.push(x); });
      lignes.sort((a, b) => ordre[a.st.etat] - ordre[b.st.etat] || (a.st.dans || 0) - (b.st.dans || 0));
      // Numéros pour les objectifs seulement : les camps se reconnaissent à leur couleur et leur forme.
      let num = 0;
      lignes.forEach((l) => { if (l.ev.categorie !== 'jungle') l.numero = ++num; });
      const numeroDe = (ev) => (lignes.find((l) => l.ev === ev) || {}).numero;

      // 3. Dessin
      entrees.forEach((x) => {
        const c = x.c;
        const g = svgEl('g', { class: 'mini-couche etat-' + x.st.etat + (c.evenement || c.id === 'lanes' ? '' : ' mini-decor') });
        (x.couche.lignes || []).forEach((l) => {
          const mienne = ctx.lane && LANES_ID[l.couleur.toLowerCase()] === ctx.lane;
          g.append(svgEl('polyline', {
            points: l.trace.map((p) => (p[0] * T) + ',' + (p[1] * T)).join(' '), fill: 'none', stroke: l.couleur,
            'stroke-width': mienne ? 12 : 6, 'stroke-opacity': ctx.lane ? (mienne ? 0.95 : 0.15) : 0.5, 'stroke-linejoin': 'round'
          }));
        });
        const n = x.ev ? numeroDe(x.ev) : null;
        x.elements.forEach((e) => {
          const px = e.xy[0] * T, py = e.xy[1] * T;
          const couleur = c.couleur || (EQUIPES[e.equipe] && EQUIPES[e.equipe].couleur) || '#ffffff';
          if (x.st.etat === 'maintenant' || x.st.etat === 'bientot') g.append(svgEl('circle', { cx: px, cy: py, r: (c.r || 8) + 9, class: 'mini-halo', stroke: couleur }));
          const m = forme(c, px, py, couleur);
          const titre = svgEl('title');
          titre.textContent = x.couche.nom;
          m.append(titre);
          g.append(m);
          if (n && chrono.lance) {
            // Le numéro reste à l'endroit même quand la carte est retournée.
            const txt = svgEl('text', { x: px, y: py - (c.r || 8) - 6, class: 'mini-numero', transform: retournee ? 'rotate(180 ' + px + ' ' + (py - (c.r || 8) - 10) + ')' : '' });
            txt.textContent = String(n);
            g.append(txt);
          }
        });
        svg.append(g);
      });

      // 4. Légende : ce qui se passe ou va se passer, numérotée comme la carte.
      if (!chrono.lance) liste.append(el('li', 'aide', 'Lance le chrono : la carte montrera ce qui est ouvert et ce qui arrive.'));
      if (ctx.priorites) liste.append(el('li', 'aide', 'Points utiles à ton rôle' + (ctx.cote === 'lane' && ctx.lane ? ', jungle de ton côté' : '') + '.'));
      if (!chrono.lance) return;
      lignes.forEach((l) => {
        const li = el('li', 'etat-' + l.st.etat);
        const p = el('span', 'mini-pastille', l.numero ? String(l.numero) : '');
        p.style.background = l.c.couleur;
        let texte;
        if (l.st.etat === 'maintenant') texte = 'maintenant';
        else if (l.st.etat === 'bientot') texte = 'dans ' + (l.st.approx ? '≈ ' : '') + fmt(l.st.dans);
        else if (l.st.etat === 'ferme') texte = 'ouvre à ' + fmt(t + l.st.dans);
        else if (l.st.etat === 'attente') texte = l.st.dans != null ? 'prochain dans ' + fmt(l.st.dans) : 'terminé';
        else texte = 'ouvert';
        const nom = el('span', 'mini-nom', l.ev.nom.split(' (')[0]);
        if (l.ev.fiabilite === 'incertain') nom.append(' ', el('span', 'marque', 'incertain'));
        li.append(p, nom, el('span', 'mini-quand', texte));
        if (l.ev.conseil && (l.st.etat === 'maintenant' || l.st.etat === 'bientot')) li.append(el('span', 'mini-conseil', l.ev.conseil));
        liste.append(li);
      });
    }

    dessiner();
    setInterval(dessiner, 1000);
    DLN.surNiveau(dessiner);
    window.addEventListener('storage', (e) => { if (e.key === CLE_CHRONO) dessiner(); });
    if (DLN.partieContexte) DLN.partieContexte.surChange(dessiner);
    ecouteursEquipe.push(dessiner);
    return { redessiner: dessiner };
  }

  DLN.carteMini = { creer: creer };

  // Sur la page En partie : remplit #carte-partie s'il existe.
  const cible = document.getElementById('carte-partie');
  if (cible) {
    Promise.all([DLN.charger('data/map.json'), DLN.charger('data/timeline.json'), DLN.charger('data/niveaux.json').catch(() => null)])
      .then((r) => creer(cible, { carte: r[0], timeline: r[1], niveaux: r[2] }))
      .catch(() => { cible.append(el('p', 'vide', 'Carte indisponible (data/map.json).')); });
  }
})();
