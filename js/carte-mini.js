// Carte de la page En partie : la minimap (data/map.json) avec ce qui est ouvert ou arrive bientôt,
// d'après le chrono (data/timeline.json et l'état du chrono dans le navigateur). Légende par groupes :
// chaque couche se coche à la main (dln.carte.partie.v1) ; « Auto » revient à ce qui compte pour le rôle.
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

  const CLE_COUCHES = 'dln.carte.partie.v1';   // { manuel: { idCouche: true|false }, cote: true|false|null, tunnels: bool }

  // Couches dans l'ordre de la légende (ids de data/map.json). Apparence = choix d'affichage ;
  // `evenement` = id de data/timeline.json qui donne l'état (pas encore, bientôt, là) ;
  // `auto` : 'toujours', 'role' (si l'objectif compte pour ton rôle), 'niveau' (si le niveau ⚙ le propose),
  // absent = seulement si on la coche ; `jungle` : filtrée par « jungle de ma lane ».
  const GROUPES = [
    { nom: 'Repères', couches: [
      { id: 'structures', nom: 'Structures', auto: 'toujours' },
      { id: 'lanes', nom: 'Lanes', auto: 'toujours' },
      { id: 'shops', nom: 'Shops', couleur: '#ffd24a', forme: 'carre', r: 10, lettre: '$', auto: 'toujours' }
    ] },
    { nom: 'Jungle', couches: [
      { id: 'camps_small', nom: 'Small camps', couleur: '#9be37a', forme: 'triangle', r: 13, evenement: 'small_camps', auto: 'role', jungle: true },
      { id: 'camps_medium', nom: 'Medium camps', couleur: '#f2d04b', forme: 'triangle', r: 13, evenement: 'medium_camps', auto: 'role', jungle: true },
      { id: 'camps_large', nom: 'Large camps', couleur: '#ff7a45', forme: 'triangle', r: 15, evenement: 'large_camps', auto: 'role', jungle: true },
      { id: 'sinners', nom: 'Sinner\'s Sacrifice', couleur: '#ff6b9d', forme: 'losange', r: 11, evenement: 'sinners', auto: 'role', jungle: true },
      { id: 'cloches', nom: 'Bell Tower', couleur: '#ffffff', forme: 'carre', r: 8 },
      { id: 'buff_containers', nom: 'Buff Containers', couleur: '#e8c547', r: 4.5 },
      { id: 'tough_crates', nom: 'Tough Crates', couleur: '#3fb8a8', r: 5 },
      { id: 'crates', nom: 'Caisses', couleur: '#b98a5a', r: 3.5 }
    ] },
    { nom: 'Objectifs', couches: [
      { id: 'powerups', nom: 'Powerups', couleur: '#ffffff', forme: 'etoile', r: 16, evenement: 'powerups', auto: 'role' },
      { id: 'urn_depart', nom: 'Soul Urn · apparition', couleur: '#c9a0ff', r: 12, evenement: 'urn', auto: 'role' },
      { id: 'urn_depot', nom: 'Soul Urn · dépôt', couleur: '#c9a0ff', forme: 'carre', r: 11, lettre: 'U', evenement: 'urn', auto: 'role' },
      { id: 'rifts', nom: 'Unstable Rift', couleur: '#4fd6d6', r: 15, evenement: 'rift', auto: 'role' },
      { id: 'midboss', nom: 'Mid-Boss', couleur: '#7cfc9a', r: 18, lettre: 'M', auto: 'niveau' }
    ] },
    { nom: 'Se déplacer · se soigner · se cacher', couches: [
      { id: 'teleporters', nom: 'Teleporters', couleur: '#b58cff', forme: 'losange', r: 10, auto: 'niveau' },
      { id: 'soins', nom: 'Healing Snacks', couleur: '#ff8fa3', forme: 'plus', r: 7 },
      { id: 'bounce_pads', nom: 'Bounce pads', couleur: '#7fd1ff', forme: 'triangle', r: 7 },
      { id: 'cordes', nom: 'Cordes', couleur: '#c2a878', r: 5 },
      { id: 'steam_vents', nom: 'Steam Vents', couleur: '#cfd8dc', r: 5.5 },
      { id: 'veils', nom: 'Cosmic Veils', couleur: '#8e7dff', forme: 'carre', r: 5 }
    ] }
  ];
  // Structures : une lettre par type, la taille suit l'importance.
  const STRUCTURES = { Guardian: { lettre: 'G', r: 12 }, Walker: { lettre: 'W', r: 15 }, Base: { lettre: 'B', r: 17 }, Patron: { lettre: 'P', r: 17 } };
  const LANES_ID = { '#f1cc30': 'yellow', '#29b1cc': 'blue', '#59b247': 'green' };
  const LANES_NOM = { yellow: 'Yellow', blue: 'Blue', green: 'Green' };

  function svgEl(nom, attributs) {
    const e = document.createElementNS(SVG, nom);
    Object.keys(attributs || {}).forEach((k) => e.setAttribute(k, attributs[k]));
    return e;
  }

  function forme(nomForme, x, y, r, attributs) {
    let e;
    if (nomForme === 'carre') e = svgEl('rect', { x: x - r, y: y - r, width: 2 * r, height: 2 * r, rx: r * 0.2 });
    else if (nomForme === 'triangle') e = svgEl('polygon', { points: [x, y - r, x + r, y + r * 0.8, x - r, y + r * 0.8].join(' ') });
    else if (nomForme === 'losange') e = svgEl('polygon', { points: [x, y - r * 1.2, x + r, y, x, y + r * 1.2, x - r, y].join(' ') });
    else if (nomForme === 'plus') {
      const a = r * 0.38;
      e = svgEl('polygon', { points: [x - a, y - r, x + a, y - r, x + a, y - a, x + r, y - a, x + r, y + a, x + a, y + a, x + a, y + r, x - a, y + r, x - a, y + a, x - r, y + a, x - r, y - a, x - a, y - a].join(' ') });
    } else if (nomForme === 'etoile') {
      const pts = [];
      for (let i = 0; i < 10; i++) { const ang = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; pts.push(x + rr * Math.cos(ang), y + rr * Math.sin(ang)); }
      e = svgEl('polygon', { points: pts.join(' ') });
    } else e = svgEl('circle', { cx: x, cy: y, r: r });
    Object.keys(attributs || {}).forEach((k) => e.setAttribute(k, attributs[k]));
    return e;
  }

  // Remplissage selon l'état : plein = disponible, contour seul = pas encore ouvert.
  function peinture(couleur, etat) {
    if (etat === 'ferme') return { fill: 'rgba(12,10,8,.65)', stroke: couleur, 'stroke-width': 3.5 };
    return { fill: couleur, stroke: '#0c0a08', 'stroke-width': 2.5 };
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

  function texteEtat(st, ev, t, lance) {
    if (!lance) return ev.type === 'fenetre' ? '≈ ' + fmt(ev.debut_s) : 'à ' + fmt(ev.temps_s);
    if (st.etat === 'maintenant') return 'maintenant';
    if (st.etat === 'bientot') return 'dans ' + (st.approx ? '≈ ' : '') + fmt(st.dans);
    if (st.etat === 'ferme') return 'à ' + fmt(t + st.dans);
    if (st.etat === 'attente') return st.dans != null ? 'dans ' + fmt(st.dans) : 'terminé';
    return 'ouvert';
  }

  function creer(conteneur, donnees) {
    const carte = donnees.carte, timeline = donnees.timeline, niveaux = donnees.niveaux || { evenements: {} };
    const parId = {};
    carte.couches.forEach((c) => { parId[c.id] = c; });
    const evParId = {};
    timeline.evenements.forEach((e) => { evParId[e.id] = e; });
    const toutes = [];
    GROUPES.forEach((g) => g.couches.forEach((c) => { if (parId[c.id]) toutes.push(c); }));

    let reglage = { manuel: {}, cote: null, tunnels: false };
    try { reglage = Object.assign(reglage, JSON.parse(localStorage.getItem(CLE_COUCHES)) || {}); } catch (e) { /* défaut */ }
    const sauver = () => { try { localStorage.setItem(CLE_COUCHES, JSON.stringify(reglage)); } catch (e) { /* stockage indisponible */ } };

    // Même filtre que le chrono : un événement s'affiche à partir du niveau de data/niveaux.json ;
    // une couche sans événement suit le niveau de data/map.json.
    const niveauOk = (c) => (c.evenement && niveaux.evenements[c.evenement] != null
      ? niveaux.evenements[c.evenement] : (parId[c.id].niveau || 1)) <= DLN.niveau();
    const ctx = () => (DLN.partieContexte ? DLN.partieContexte.get() : {});
    function auto(c) {
      const x = ctx();
      if (c.auto === 'toujours') return true;
      if (c.auto === 'role') return niveauOk(c) && (!x.priorites || x.priorites.indexOf(c.evenement) !== -1);
      if (c.auto === 'niveau') return niveauOk(c);
      return false;
    }
    const visible = (c) => (reglage.manuel[c.id] != null ? reglage.manuel[c.id] : auto(c));
    const jungleDeMaLane = () => { const x = ctx(); return Boolean(x.lane) && (reglage.cote != null ? reglage.cote : x.cote === 'lane'); };

    // ---------- en-tête : réglages ----------
    const tete = el('div', 'carte-partie-tete');
    tete.append(el('h2', null, 'Carte'));
    const outils = el('div', 'carte-outils');
    const btn = (texte, titre, action) => {
      const b = el('button', 'btn discret', texte);
      b.type = 'button';
      b.title = titre;
      b.addEventListener('click', () => { action(); sauver(); dessiner(); b.blur(); });
      outils.append(b);
      return b;
    };
    const bAuto = btn('Auto', 'Montrer ce qui compte pour ton rôle et ton niveau (efface tes choix)', () => { reglage.manuel = {}; reglage.cote = null; });
    const bTout = btn('Tout', 'Montrer toutes les couches', () => { toutes.forEach((c) => { reglage.manuel[c.id] = true; }); reglage.cote = false; });
    const bCote = btn('Jungle : ma lane', 'Ne montrer que la jungle proche de ta lane, ou toute la jungle', () => { reglage.cote = !jungleDeMaLane(); });
    const bTunnels = btn('Tunnels', 'Montrer le sous-sol (tunnels) sur le fond de carte', () => { reglage.tunnels = !reglage.tunnels; });
    tete.append(outils);
    // Sur En partie, le bouton d'équipe est dans la barre de contexte : pas de doublon ici.
    if (!DLN.partieContexte) tete.append(boutonEquipe());

    const zone = el('div', 'carte-partie-zone');
    const image = el('img');
    image.alt = 'Minimap';
    const svg = svgEl('svg', { viewBox: '0 0 ' + T + ' ' + T, preserveAspectRatio: 'none', 'aria-label': 'Carte et objectifs' });
    zone.append(image, svg);

    // ---------- légende : une ligne par couche, cochable ----------
    const legende = el('div', 'carte-legende');
    const lecture = el('p', 'carte-lecture');
    const symbole = (nomForme, couleur, etat, lettre) => {
      const s = svgEl('svg', { viewBox: '-20 -20 40 40', class: 'carte-symbole', 'aria-hidden': 'true' });
      s.append(forme(nomForme, 0, 0, 14, peinture(couleur, etat)));
      if (lettre) { const tx = svgEl('text', { x: 0, y: 1, class: 'mini-lettre legende-lettre' }); tx.textContent = lettre; s.append(tx); }
      return s;
    };
    lecture.append(symbole('cercle', '#d9b25b', 'ouvert'), ' disponible ', symbole('cercle', '#d9b25b', 'ferme'), ' pas encore ',
      el('span', 'carte-halo-ex'), ' bientôt / maintenant · numéros = ordre d\'arrivée');
    legende.append(lecture);
    const lignes = {};
    GROUPES.forEach((g) => {
      const couches = g.couches.filter((c) => parId[c.id]);
      if (!couches.length) return;
      legende.append(el('div', 'carte-groupe', g.nom));
      couches.forEach((c) => {
        const label = el('label', 'carte-ligne');
        const caseC = el('input');
        caseC.type = 'checkbox';
        caseC.addEventListener('change', () => { reglage.manuel[c.id] = caseC.checked; sauver(); dessiner(); caseC.blur(); });
        let sym;
        if (c.id === 'structures') {
          sym = el('span', 'carte-symboles');
          sym.append(symbole('carre', EQUIPES[0].couleur, 'ouvert', 'W'), symbole('carre', EQUIPES[1].couleur, 'ouvert', 'W'));
        } else if (c.id === 'lanes') {
          sym = svgEl('svg', { viewBox: '0 0 40 40', class: 'carte-symbole', 'aria-hidden': 'true' });
          ['#f1cc30', '#29b1cc', '#59b247'].forEach((k, i) => sym.append(svgEl('line', { x1: 6 + i * 14, y1: 4, x2: 6 + i * 14, y2: 36, stroke: k, 'stroke-width': 6 })));
        } else sym = symbole(c.forme || 'cercle', c.couleur, 'ouvert', c.lettre);
        const nom = el('span', 'carte-ligne-nom', c.nom);
        const etat = el('span', 'carte-ligne-etat');
        label.append(caseC, sym, nom, etat);
        const parent = parId[c.id];
        label.title = parent.nom + (parent.a_quoi_ca_sert ? ' : ' + parent.a_quoi_ca_sert : '');
        legende.append(label);
        lignes[c.id] = { label: label, caseC: caseC, nom: nom, etat: etat };
      });
    });
    conteneur.append(tete, zone, legende);

    function orienter() { zone.classList.toggle('retournee', equipe() === 1); }
    ecouteursEquipe.push(orienter);
    orienter();

    // Lanes : couleur → position moyenne, pour rattacher la jungle à la lane la plus proche.
    const lanesX = ((parId.lanes || {}).lignes || []).map((l) => ({
      couleur: l.couleur.toLowerCase(), x: l.trace.reduce((s, p) => s + p[0], 0) / l.trace.length
    }));
    const laneProche = (x) => lanesX.reduce((m, l) => (!m || Math.abs(l.x - x) < Math.abs(m.x - x) ? l : m), null);

    function dessiner() {
      const chrono = tempsChrono();
      const t = chrono.t;
      const x = ctx();
      const retournee = equipe() === 1;
      const mienne = equipe();
      // Le texte reste à l'endroit quand la carte est retournée.
      const texte = (px, py, contenu, classe, attributs) => {
        const tx = svgEl('text', Object.assign({ x: px, y: py, class: classe, transform: retournee ? 'rotate(180 ' + px + ' ' + py + ')' : '' }, attributs || {}));
        tx.textContent = contenu;
        return tx;
      };
      const src = reglage.tunnels && carte.image_tunnels ? carte.image_tunnels : carte.image;
      if (image.getAttribute('src') !== src) image.src = src;
      svg.textContent = '';
      const filtreCote = jungleDeMaLane();

      // 1. Couches visibles et état de leur objectif.
      const entrees = toutes.filter(visible).map((c) => {
        const couche = parId[c.id];
        let elements = couche.elements || [];
        if (filtreCote && c.jungle) elements = elements.filter((e) => { const l = laneProche(e.xy[0]); return l && LANES_ID[l.couleur] === x.lane; });
        const ev = c.evenement ? evParId[c.evenement] : null;
        return { c: c, couche: couche, ev: ev, st: etatEvenement(ev, t), elements: elements };
      });

      // 2. Numéros pour les objectifs (pas les camps, reconnaissables à leur forme), par ordre d'urgence.
      const ordre = { maintenant: 0, bientot: 1, attente: 2, ferme: 3, ouvert: 4 };
      const objectifs = [];
      entrees.filter((e) => e.ev && e.ev.categorie !== 'jungle' && e.elements.length).forEach((e) => { if (objectifs.indexOf(e.ev) === -1) objectifs.push(e); });
      objectifs.sort((a, b) => ordre[a.st.etat] - ordre[b.st.etat] || (a.st.dans || 0) - (b.st.dans || 0));
      const numeros = {};
      objectifs.forEach((e, i) => { if (numeros[e.ev.id] == null) numeros[e.ev.id] = Object.keys(numeros).length + 1; });

      // 3. Dessin : lanes d'abord, puis du plus petit au plus important.
      entrees.slice().sort((a, b) => (a.c.id === 'lanes' ? -1 : b.c.id === 'lanes' ? 1 : (a.c.r || 12) - (b.c.r || 12))).forEach((e) => {
        const c = e.c;
        const g = svgEl('g', { class: 'mini-couche etat-' + e.st.etat });
        (e.couche.lignes || []).forEach((l) => {
          const id = LANES_ID[l.couleur.toLowerCase()];
          const maLane = x.lane && id === x.lane;
          g.append(svgEl('polyline', {
            points: l.trace.map((p) => (p[0] * T) + ',' + (p[1] * T)).join(' '), fill: 'none', stroke: l.couleur,
            'stroke-width': maLane ? 12 : 7, 'stroke-opacity': x.lane ? (maLane ? 0.95 : 0.3) : 0.6, 'stroke-linejoin': 'round'
          }));
          // Nom de la lane, côté de ma base.
          const cible = mienne === 1 ? 0.3 : 0.7;
          const p = l.trace.reduce((m, q) => (Math.abs(q[1] - cible) < Math.abs(m[1] - cible) ? q : m), l.trace[0]);
          if (id) g.append(texte(p[0] * T + (p[0] < 0.5 ? 26 : -26), p[1] * T, LANES_NOM[id], 'mini-lane', { fill: l.couleur, 'text-anchor': p[0] < 0.5 === !retournee ? 'start' : 'end' }));
        });
        const n = e.ev ? numeros[e.ev.id] : null;
        e.elements.forEach((el2) => {
          const px = el2.xy[0] * T, py = el2.xy[1] * T;
          let r = c.r || 8, f = c.forme || 'cercle', lettre = c.lettre, couleur = c.couleur;
          if (c.id === 'structures') {
            const s = STRUCTURES[el2.type] || { lettre: '?', r: 12 };
            r = s.r; f = 'carre'; lettre = s.lettre; couleur = (EQUIPES[el2.equipe] || {}).couleur || '#ffffff';
          }
          if (c.id === 'shops' && el2.type === 'secret') lettre = '?';
          if (!couleur) couleur = (EQUIPES[el2.equipe] && EQUIPES[el2.equipe].couleur) || '#ffffff';
          if (e.st.etat === 'maintenant' || e.st.etat === 'bientot') g.append(svgEl('circle', { cx: px, cy: py, r: r + 10, class: 'mini-halo', stroke: couleur }));
          const m = forme(f, px, py, r, peinture(couleur, e.st.etat));
          const titre = svgEl('title');
          titre.textContent = c.nom + (el2.type && c.id !== 'structures' ? ' · ' + el2.type : '') + (c.id === 'structures' ? ' · ' + el2.type + (el2.equipe === mienne ? ' (ton équipe)' : ' (en face)') : '') +
            (e.ev ? ' · ' + texteEtat(e.st, e.ev, t, chrono.lance) : '') + (el2.approximatif ? ' · position approximative' : '');
          m.append(titre);
          g.append(m);
          if (lettre && r >= 8) g.append(texte(px, py + 1, lettre, 'mini-lettre', { 'font-size': Math.round(r * 1.3) }));
          if (n && chrono.lance) g.append(texte(px + r + 4, py - r - 4, String(n), 'mini-numero'));
          if (c.id === 'structures' && el2.type === 'Base' && el2.equipe === mienne) g.append(texte(px, py + r + 32, 'Ta base', 'mini-base'));
        });
        svg.append(g);
      });

      // 4. Légende : cases, état de chaque objectif, numéro.
      toutes.forEach((c) => {
        const L = lignes[c.id];
        const v = visible(c);
        L.caseC.checked = v;
        L.label.classList.toggle('cachee', !v);
        L.label.classList.toggle('manuel', reglage.manuel[c.id] != null);
        const ev = c.evenement ? evParId[c.evenement] : null;
        L.etat.textContent = '';
        L.label.className = L.label.className.replace(/\betat-\w+/g, '').trim();
        if (ev) {
          const st = etatEvenement(ev, t);
          L.label.classList.add('etat-' + (chrono.lance ? st.etat : 'ferme'));
          if (numeros[ev.id] && v && chrono.lance) L.etat.append(el('span', 'mini-pastille', String(numeros[ev.id])));
          L.etat.append(texteEtat(st, ev, t, chrono.lance) + (ev.fiabilite === 'incertain' ? ' ?' : ''));
        }
      });
      const manuel = Object.keys(reglage.manuel).length > 0 || reglage.cote != null;
      bAuto.setAttribute('aria-pressed', String(!manuel));
      bTout.setAttribute('aria-pressed', String(toutes.every(visible)));
      bCote.hidden = !x.lane;
      bCote.textContent = filtreCote ? 'Jungle : ma lane' : 'Jungle : toute';
      bCote.setAttribute('aria-pressed', String(filtreCote));
      bTunnels.hidden = !carte.image_tunnels;
      bTunnels.setAttribute('aria-pressed', String(Boolean(reglage.tunnels)));
    }

    dessiner();
    setInterval(dessiner, 1000);
    DLN.surNiveau(dessiner);
    window.addEventListener('storage', (e) => {
      if (e.key === CLE_COUCHES) { try { Object.assign(reglage, JSON.parse(e.newValue) || {}); } catch (err) { /* ignoré */ } }
      if (e.key === CLE_CHRONO || e.key === CLE_COUCHES) dessiner();
    });
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
