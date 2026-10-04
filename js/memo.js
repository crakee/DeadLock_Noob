// Apprendre › Les bases : data/memo.json mis en page comme un article.
// Quatre catégories, un sommaire qui suit la lecture, pour chaque section l'essentiel d'abord
// (la suite est repliée) et un schéma quand une donnée s'y prête (phases, camps, objectifs,
// respawn, bonus d'achat : tirés de data/timeline.json et de memo.json, jamais écrits en dur).
(function () {
  'use strict';

  const el = DLN.el;
  const SVG = 'http://www.w3.org/2000/svg';
  const LIBELLES_SOURCE = { donnees: 'mécanique vérifiée dans les données du jeu', conseil: 'conseil de joueur', wiki: 'texte du wiki, non confirmé par les données' };
  const VISIBLES = 3;   // points affichés avant « Lire la suite »
  let memo = null, profil = null, heros = null, timeline = null;
  let observateur = null;

  const fmt = (s) => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');

  function svg(tag, attributs, texte) {
    const n = document.createElementNS(SVG, tag);
    Object.keys(attributs || {}).forEach((k) => n.setAttribute(k, attributs[k]));
    if (texte != null) n.textContent = texte;
    return n;
  }

  // ---------- schémas ----------

  // Frise horizontale : bandes (phases) et repères (événements), sur 0 → fin secondes.
  function frise(bandes, reperes, fin, legende) {
    const L = 640, H = 92, G = 10;
    const x = (s) => G + (L - 2 * G) * Math.min(s, fin) / fin;
    const s = svg('svg', { viewBox: '0 0 ' + L + ' ' + H, class: 'ap-frise', role: 'img' });
    s.append(svg('title', {}, legende));
    bandes.forEach((b, i) => {
      s.append(svg('rect', { x: x(b.de), y: 8, width: x(b.a) - x(b.de), height: 26, rx: 4, class: 'ap-bande ap-bande-' + (i % 3) }));
      s.append(svg('text', { x: (x(b.de) + x(b.a)) / 2, y: 26, class: 'ap-bande-texte' }, b.nom));
    });
    let dernier = -100, rang = 0;
    reperes.forEach((r) => {
      const px = x(r.t);
      rang = px - dernier < 70 ? (rang + 1) % 2 : 0;
      dernier = px;
      s.append(svg('line', { x1: px, x2: px, y1: 36, y2: 46 + rang * 18, class: 'ap-repere' }));
      s.append(svg('circle', { cx: px, cy: 40, r: 3.5, class: 'ap-repere-point' }));
      s.append(svg('text', { x: px, y: 58 + rang * 18, class: 'ap-repere-texte' }, fmt(r.t) + ' ' + r.nom));
    });
    return s;
  }

  function schemaPhases() {
    const fin = 2400;
    const bandes = timeline.phases.map((p) => ({ nom: p.nom, de: p.debut_s, a: p.fin_s == null ? fin : p.fin_s }));
    const reperes = timeline.phases.slice(1).map((p) => ({ t: p.debut_s, nom: p.nom }));
    return figure(frise(bandes, reperes, fin, 'Les trois phases de la partie'),
      'Les phases de la partie, d\'après data/timeline.json (0 à 40 min).');
  }

  function schemaCamps() {
    const ev = timeline.evenements.filter((e) => e.categorie === 'jungle' && e.temps_s != null && e.temps_s <= 900);
    const fin = 900;
    return figure(frise([{ nom: 'Laning', de: 0, a: timeline.phases[0].fin_s }, { nom: 'Mid-game', de: timeline.phases[0].fin_s, a: fin }],
      ev.map((e) => ({ t: e.temps_s, nom: e.nom.replace(' et Buff Containers', '') })), fin, 'Ouverture de la jungle'),
      'Quand chaque partie de la jungle s\'ouvre (data/timeline.json).');
  }

  function schemaObjectifs() {
    const fin = 1500;
    const reperes = [];
    timeline.evenements.filter((e) => e.categorie === 'objectif').forEach((e) => {
      if (e.type === 'recurrent') for (let t = e.temps_s; t <= fin; t += e.intervalle_s) reperes.push({ t: t, nom: e.nom.split(' (')[0] });
      else if (e.type === 'fenetre') reperes.push({ t: e.debut_s, nom: e.nom + ' (≈)' });
    });
    reperes.sort((a, b) => a.t - b.t);
    return figure(frise(timeline.phases.map((p) => ({ nom: p.nom, de: p.debut_s, a: p.fin_s == null ? fin : Math.min(p.fin_s, fin) })), reperes, fin,
      'Objectifs jusqu\'à 25 min'), 'Les objectifs jusqu\'à 25 min (data/timeline.json). « ≈ » : horaire incertain.');
  }

  // Courbe : points [x, y] reliés, axes simples.
  function courbe(points, maxX, maxY, etiquetteX, etiquetteY, fmtX, fmtY, titre, marques) {
    const L = 640, H = 210, G = 44, B = 30, T = 24;
    const x = (v) => G + (L - G - 12) * v / maxX;
    const y = (v) => T + (H - T - B) * (1 - v / maxY);
    const s = svg('svg', { viewBox: '0 0 ' + L + ' ' + H, class: 'ap-courbe', role: 'img' });
    s.append(svg('title', {}, titre));
    s.append(svg('line', { x1: G, x2: L - 12, y1: y(0), y2: y(0), class: 'ap-axe' }), svg('line', { x1: G, x2: G, y1: T, y2: y(0), class: 'ap-axe' }));
    s.append(svg('path', { d: points.map((p, i) => (i ? 'L' : 'M') + x(p[0]).toFixed(1) + ' ' + y(p[1]).toFixed(1)).join(' '), class: 'ap-trait' }));
    points.forEach((p) => {
      s.append(svg('circle', { cx: x(p[0]), cy: y(p[1]), r: 3, class: 'ap-pt' }));
      s.append(svg('text', { x: x(p[0]), y: y(p[1]) - 7, class: 'ap-valeur' }, fmtY(p[1])));
      s.append(svg('text', { x: x(p[0]), y: H - 12, class: 'ap-graduation' }, fmtX(p[0])));
    });
    (marques || []).forEach((m) => {
      s.append(svg('line', { x1: x(m.x), x2: x(m.x), y1: T, y2: y(0), class: 'ap-marque' }));
      s.append(svg('text', { x: x(m.x) + 4, y: T + 10, class: 'ap-marque-texte' }, m.texte));
    });
    s.append(svg('text', { x: L - 12, y: H - 1, class: 'ap-legende-axe', 'text-anchor': 'end' }, etiquetteX));
    s.append(svg('text', { x: 4, y: T + 2, class: 'ap-legende-axe' }, etiquetteY));
    return s;
  }

  function schemaRespawn() {
    const r = timeline.courbes.respawn;
    const pts = r.points_s.map((p) => [p[0], p[1]]);
    return figure(courbe(pts, pts[pts.length - 1][0], r.plafond_s || pts[pts.length - 1][1], 'temps de partie', 'respawn (s)',
      (v) => fmt(v), (v) => v + ' s', r.nom), r.nom + ' selon le moment de la partie (data/timeline.json). ' + (r.detail || ''));
  }

  function schemaInvestissement(section) {
    const inv = section.investissement;
    // Paliers régulièrement espacés (l'échelle des souls n'est pas linéaire) pour que tout reste lisible.
    const pts = inv.souls.map((s, i) => [i, inv.weapon_pct[i]]);
    const etiquette = (i) => { const v = inv.souls[i]; return v >= 1000 ? (v / 1000).toLocaleString('fr-FR') + 'k' : String(v); };
    const graphe = courbe(pts, inv.souls.length - 1, inv.weapon_pct[inv.weapon_pct.length - 1], 'souls dépensées en Weapon (paliers)',
      'bonus dégâts', etiquette, (v) => '+' + v + ' %', 'Bonus de dégâts d\'arme selon les souls investies',
      [{ x: inv.souls.indexOf(4800), texte: 'palier 4,8k : +28 points d\'un coup' }]);
    return figure(graphe, 'Bonus de dégâts d\'arme selon le total dépensé en objets Weapon. Même principe en Vitality (vie) et Spirit (spirit power). Source : ' + inv.source + '.');
  }

  function schemaEtapes(section) {
    const ol = el('ol', 'ap-etapes');
    section.fiches.filter((f) => /^\d\./.test(f.titre) && f.niveau <= DLN.niveau()).forEach((f) => {
      const li = el('li');
      li.append(el('strong', null, f.titre.replace(/^\d\.\s*/, '')), el('span', null, f.texte));
      ol.append(li);
    });
    return ol;
  }

  function figure(contenu, legende) {
    const f = el('figure', 'ap-figure');
    f.append(contenu, el('figcaption', null, legende));
    return f;
  }

  const SCHEMAS = { phases: schemaPhases, respawn: schemaRespawn, camps: schemaCamps, objectifs: schemaObjectifs, investissement: schemaInvestissement, etapes: schemaEtapes };

  // ---------- texte ----------

  function point(f) {
    const p = el('p', 'ap-point');
    const titre = el('strong', null, f.titre.replace(/^\d\.\s*/, '') + '. ');
    p.append(titre, f.texte);
    const source = el('span', 'ap-source ap-source-' + f.source);
    source.title = LIBELLES_SOURCE[f.source] || f.source;
    source.setAttribute('aria-label', source.title);
    p.prepend(source);
    return p;
  }

  function section(s) {
    const fiches = s.fiches.filter((f) => f.niveau <= DLN.niveau());
    if (!fiches.length) return null;
    const bloc = el('section', 'ap-section');
    bloc.id = s.id;
    bloc.append(el('h2', null, s.titre));

    const schema = s.schema && SCHEMAS[s.schema] ? SCHEMAS[s.schema](s) : null;
    // Les étapes numérotées sont déjà dans le schéma : on ne les répète pas en texte.
    const texte = s.schema === 'etapes' ? fiches.filter((f) => !/^\d\./.test(f.titre)) : fiches;
    if (schema) bloc.append(schema);
    texte.slice(0, VISIBLES).forEach((f) => bloc.append(point(f)));
    if (texte.length > VISIBLES) {
      const suite = el('details', 'ap-suite');
      suite.append(el('summary', null, 'Lire la suite (' + (texte.length - VISIBLES) + ')'));
      texte.slice(VISIBLES).forEach((f) => suite.append(point(f)));
      bloc.append(suite);
    }
    if (s.objets_bullet_resist && DLN.niveau() >= 2) bloc.append(objetsResistance(s));
    if (s.achats_par_heros) bloc.append(raccourcisAchats());
    return bloc;
  }

  function objetsResistance(s) {
    const d = el('details', 'ap-suite');
    d.append(el('summary', null, 'Objets de résistance et leur bonus'));
    const g = el('div', 'ap-resist');
    [['Contre les balles (Bullet Resist)', s.objets_bullet_resist, 'var(--weapon)'], ['Contre les compétences (Spirit Resist)', s.objets_spirit_resist, 'var(--spirit)']].forEach((c) => {
      const col = el('div');
      col.append(el('h4', null, c[0]));
      c[1].forEach((o) => {
        const ligne = el('div', 'ap-barre');
        const barre = el('span');
        barre.style.width = Math.min(100, o.valeur * 2.5) + '%';
        barre.style.background = c[2];
        ligne.append(el('span', 'ap-barre-nom', o.nom + ' · ' + DLN.fmtNombre(o.cout)), barre, el('span', 'ap-barre-valeur', '+' + o.valeur + ' %'));
        col.append(ligne);
      });
      g.append(col);
    });
    d.append(g, el('p', 'aide', s.note_objets));
    return d;
  }

  function raccourcisAchats() {
    const p = el('div', 'ap-raccourcis');
    p.append(el('span', 'aide', 'Ce que les joueurs achètent vraiment, phase par phase : '));
    profil.heros_joues.concat(profil.heros_a_essayer).forEach((id) => {
      const h = heros.heros.find((x) => x.id === id);
      if (h) p.append(DLN.pastilleHeros(h, 'builds'));
    });
    return p;
  }

  // ---------- page ----------

  function afficher() {
    const sommaire = document.getElementById('sommaire');
    const zone = document.getElementById('sections');
    sommaire.textContent = '';
    zone.textContent = '';
    const parId = {};
    memo.sections.forEach((s) => { parId[s.id] = s; });

    const intro = el('header', 'ap-intro');
    intro.append(el('p', null, 'Les règles qui évitent de perdre, rangées en quatre thèmes. Chaque partie commence par l\'essentiel ; ' +
      '« Lire la suite » ouvre le reste. Le menu ⚙ (niveau) montre plus ou moins de détails.'));
    const legende = el('p', 'ap-legende');
    ['donnees', 'conseil', 'wiki'].forEach((k) => {
      const s = el('span', 'ap-legende-item');
      s.append(el('span', 'ap-source ap-source-' + k), LIBELLES_SOURCE[k]);
      legende.append(s);
    });
    intro.append(legende);
    zone.append(intro);

    (memo.categories || []).forEach((c, i) => {
      const blocs = c.sections.map((id) => parId[id] && section(parId[id])).filter(Boolean);
      if (!blocs.length) return;
      const groupe = el('div', 'ap-sommaire-groupe');
      const lienC = el('a', 'ap-sommaire-categorie', (i + 1) + '. ' + c.titre);
      lienC.href = '#cat-' + c.id;
      groupe.append(lienC);
      blocs.forEach((b) => {
        const a = el('a', 'ap-sommaire-lien', b.querySelector('h2').textContent);
        a.href = '#' + b.id;
        a.dataset.cible = b.id;
        groupe.append(a);
      });
      sommaire.append(groupe);

      const cat = el('section', 'ap-categorie');
      cat.id = 'cat-' + c.id;
      const t = el('header', 'ap-categorie-tete');
      t.append(el('span', 'ap-categorie-numero', String(i + 1)), el('h1', null, c.titre), el('p', null, c.resume));
      cat.append(t);
      blocs.forEach((b) => cat.append(b));
      zone.append(cat);
    });

    // Le sommaire suit la lecture.
    if (observateur) observateur.disconnect();
    if ('IntersectionObserver' in window) {
      observateur = new IntersectionObserver((entrees) => {
        entrees.forEach((e) => {
          if (!e.isIntersecting) return;
          sommaire.querySelectorAll('.ap-sommaire-lien').forEach((a) => a.classList.toggle('actif', a.dataset.cible === e.target.id));
        });
      }, { rootMargin: '-20% 0px -70% 0px' });
      zone.querySelectorAll('.ap-section').forEach((s) => observateur.observe(s));
    }
  }

  Promise.all([DLN.charger('data/memo.json'), DLN.profil, DLN.charger('data/heroes.json'), DLN.charger('data/timeline.json')]).then((r) => {
    memo = r[0]; profil = r[1]; heros = r[2]; timeline = r[3];
    document.getElementById('app').hidden = false;
    document.getElementById('meta').textContent = 'Patch ' + memo.meta.patch + ' · vérifié le ' + memo.meta.verifie_le +
      ' · point vert : mécanique vérifiée · point or : conseil de joueur (guides de Wouks) · point gris : wiki, non confirmé par les données';
    afficher();
    if (location.hash) { const c = document.getElementById(location.hash.slice(1)); if (c) c.scrollIntoView(); }
    DLN.surNiveau(afficher);
  }, DLN.echec);
})();
