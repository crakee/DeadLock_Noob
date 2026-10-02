// Onglet Rôles : une fiche détaillée par rôle (data/roles.json, jugement tiré d'une vidéo),
// avec les portraits des héros (data/heroes.json) et les objets cités (data/items.json).
(function () {
  'use strict';

  const el = DLN.el;
  const SVG = 'http://www.w3.org/2000/svg';
  const CLE = 'dln.roles.choisi.v1';
  const LIBELLES_RICHESSE = { 4: 'le plus de farm', 3: 'beaucoup de farm', 2: 'peu de farm', 1: 'presque pas de farm' };
  const LIBELLES_PARTICIPE = { oui: 'Participe', non: 'Ne participe pas' };
  const MOMENTS = ['Early', 'Midgame', 'Lategame'];

  let roles = null, heros = null, objets = null, profil = null;
  let choisi = null;

  try { choisi = localStorage.getItem(CLE); } catch (e) { /* stockage indisponible */ }

  function svg(tag, attributs, texte) {
    const n = document.createElementNS(SVG, tag);
    Object.keys(attributs || {}).forEach((k) => n.setAttribute(k, attributs[k]));
    if (texte != null) n.textContent = texte;
    return n;
  }

  const roleDe = (id) => roles.roles.find((r) => r.id === id);
  const herosDe = (id) => heros.heros.find((h) => h.id === id);
  const estMien = (id) => profil.heros_joues.indexOf(id) !== -1;
  const aEssayer = (id) => profil.heros_a_essayer.indexOf(id) !== -1;

  function choisir(id) {
    choisi = id;
    try { localStorage.setItem(CLE, id); } catch (e) { /* stockage indisponible */ }
    if (location.hash !== '#' + id) history.replaceState(null, '', '#' + id);
    afficher();
  }

  // ---------- bandeau de choix ----------

  function afficherChoix() {
    const zone = document.getElementById('choix');
    zone.textContent = '';
    roles.roles.forEach((r, i) => {
      const b = el('button', 'roles-onglet' + (r.id === choisi ? ' choisi' : ''));
      b.type = 'button';
      b.append(el('span', 'roles-numero', String(i + 1)), el('span', 'roles-onglet-nom', r.nom));
      const miens = r.heros.concat(r.aussi || []).filter((h) => estMien(h.id) || aEssayer(h.id));
      if (miens.length) b.append(el('span', 'roles-onglet-miens', miens.map((h) => h.nom).join(', ')));
      b.setAttribute('aria-pressed', String(r.id === choisi));
      b.addEventListener('click', () => choisir(r.id));
      zone.append(b);
    });
  }

  // ---------- schémas ----------

  // Pyramide de richesse : un étage par niveau de 4 (sommet) à 1, celui du rôle en évidence.
  function pyramide(role) {
    const boite = el('div', 'pyramide');
    for (let n = 4; n >= 1; n--) {
      const ici = roles.roles.filter((r) => r.richesse === n);
      const etage = el('button', 'pyramide-etage' + (n === role.richesse ? ' courant' : ''));
      etage.type = 'button';
      etage.style.width = (40 + (4 - n) * 20) + '%';
      etage.append(el('span', 'pyramide-souls', '$'.repeat(n)),
        el('span', 'pyramide-noms', ici.map((r) => r.nom).join(' · ') || '—'));
      etage.title = LIBELLES_RICHESSE[n];
      if (ici.length) etage.addEventListener('click', () => choisir((ici.indexOf(role) === -1 ? ici[0] : ici[(ici.indexOf(role) + 1) % ici.length]).id));
      else etage.disabled = true;
      boite.append(etage);
    }
    return boite;
  }

  // Courbe d'impact : forme lue sur la vidéo, sans échelle.
  function courbe(role) {
    const L = 300, H = 150, G = 8, B = 22, T = 16;
    const x = (m) => G + (L - 2 * G) * m / 3;
    const y = (v) => T + (H - T - B) * (1 - v);
    const s = svg('svg', { viewBox: '0 0 ' + L + ' ' + H, class: 'courbe-impact', role: 'img' });
    s.append(svg('title', {}, 'Impact de ' + role.nom + ' selon le moment de la partie'));
    const pts = role.courbe;
    const trace = pts.map((p, i) => (i ? 'L' : 'M') + x(p[0]).toFixed(1) + ' ' + y(p[1]).toFixed(1)).join(' ');
    s.append(svg('path', { d: trace + ' L' + x(3) + ' ' + y(0) + ' L' + x(0) + ' ' + y(0) + ' Z', class: 'courbe-aire' }));
    s.append(svg('path', { d: trace, class: 'courbe-trait' }));
    [1, 2].forEach((m) => s.append(svg('line', { x1: x(m), x2: x(m), y1: T - 4, y2: y(0), class: 'courbe-separation' })));
    s.append(svg('line', { x1: x(0), x2: x(3), y1: y(0), y2: y(0), class: 'courbe-axe' }));
    MOMENTS.forEach((nom, i) => s.append(svg('text', { x: x(i + 0.5), y: H - 6, class: 'courbe-texte' }, nom)));
    return s;
  }

  // Placement en milieu de partie : trois lanes, quatre joueurs au centre, un sur chaque côté (1-4-1).
  function placement(role) {
    const s = svg('svg', { viewBox: '0 0 300 110', class: 'placement', role: 'img' });
    s.append(svg('title', {}, role.place));
    const lanes = [{ cx: 50, nom: 'Side lane', cle: 'side', n: 1 }, { cx: 150, nom: 'Centre', cle: 'centre', n: 4 }, { cx: 250, nom: 'Side lane', cle: 'side_autre', n: 1 }];
    lanes.forEach((l) => {
      const ici = l.cle === role.position;
      s.append(svg('line', { x1: l.cx, x2: l.cx, y1: 8, y2: 84, class: 'placement-lane' }));
      for (let i = 0; i < l.n; i++) {
        const cx = l.cx + (l.n === 1 ? 0 : (i - 1.5) * 20);
        // Au centre, un seul des quatre points est « moi ».
        const moi = ici && i === (l.n === 1 ? 0 : 1);
        s.append(svg('circle', { cx: cx, cy: 46, r: moi ? 9 : 6, class: 'placement-joueur' + (moi ? ' moi' : '') }));
      }
      s.append(svg('text', { x: l.cx, y: 103, class: 'courbe-texte' + (ici ? ' fort' : '') }, l.nom));
    });
    return s;
  }

  // ---------- fiche ----------

  function titre(zone, texte) {
    const h = el('h3', null, texte);
    zone.append(h);
    return h;
  }

  function liste(items, classe) {
    const ul = el(classe === 'pieges' ? 'ol' : 'ul', classe);
    items.forEach((t) => ul.append(el('li', null, t)));
    return ul;
  }

  function portraits(liste, classe) {
    const grille = el('div', 'roles-portraits ' + (classe || ''));
    liste.forEach((ref) => {
      const h = herosDe(ref.id);
      const a = el('a', 'roles-portrait' + (estMien(ref.id) ? ' mien' : aEssayer(ref.id) ? ' essai' : ''));
      a.href = 'heros.html#h=' + ref.id;
      const img = el('img');
      img.src = (h && (h.image || h.icone)) || '';
      img.alt = '';
      img.loading = 'lazy';
      a.append(img, el('span', 'roles-portrait-nom', ref.nom));
      if (estMien(ref.id)) a.append(el('span', 'marque mien', 'joué'));
      else if (aEssayer(ref.id)) a.append(el('span', 'marque', 'à essayer'));
      a.title = h ? h.role : ref.nom;
      grille.append(a);
    });
    return grille;
  }

  function afficherFiche() {
    const zone = document.getElementById('fiche');
    zone.textContent = '';
    const r = roleDe(choisi);
    const niveau = DLN.niveau();

    const tete = el('div', 'roles-tete');
    tete.append(el('span', 'roles-numero grand', String(roles.roles.indexOf(r) + 1)), el('h1', null, r.nom),
      el('span', 'marque', 'avis de joueur'));
    zone.append(tete);

    const colonnes = el('div', 'roles-colonnes');
    const texte = el('div', 'roles-texte'), schemas = el('div', 'roles-schemas'), cote = el('div', 'roles-cote');
    colonnes.append(texte, schemas, cote);
    zone.append(colonnes);

    // Colonne 1 : le texte de la fiche
    titre(texte, 'Définition');
    texte.append(r.definition ? liste(r.definition) : el('p', null, r.quoi_faire));

    titre(texte, 'Boucle de jeu en milieu de partie');
    if (r.boucle) {
      const boucle = el('div', 'boucle');
      const vers = el('div', 'boucle-vers');
      r.boucle.vers.forEach((v) => vers.append(el('span', 'boucle-etape', v)));
      boucle.append(el('span', 'boucle-etape', r.boucle.depuis), el('span', 'boucle-fleche', '⇄'), vers);
      texte.append(boucle);
    }
    if (r.but) texte.append(el('p', 'roles-but', 'Objectif : ' + r.but));
    if (r.definition) texte.append(el('p', 'doux', r.quoi_faire));

    titre(texte, 'Combats et urnes en milieu de partie');
    const combats = el('p');
    if (r.combats) combats.append(el('strong', 'participe ' + r.combats.participe, LIBELLES_PARTICIPE[r.combats.participe] || r.combats.participe), ' — ');
    combats.append((r.combats && r.combats.texte !== 'Participe.' ? r.combats.texte + ' ' : '') + r.objectifs);
    texte.append(combats);

    titre(texte, r.a_eviter.length > 1 ? 'Pièges du rôle' : 'Piège du rôle');
    texte.append(liste(r.a_eviter, 'pieges'));

    // Colonne 2 : richesse et impact
    titre(schemas, 'Richesse théorique');
    schemas.append(pyramide(r), el('p', 'doux petit', 'Ce rôle : ' + LIBELLES_RICHESSE[r.richesse] + '. Cliquer un étage pour voir le rôle.'));
    titre(schemas, 'Impact selon le moment');
    if (r.courbe) schemas.append(courbe(r));
    const puissance = el('p', 'petit');
    puissance.append('Début ', el('strong', null, r.puissance.debut), ' · milieu ', el('strong', null, r.puissance.milieu), ' · fin ', el('strong', null, r.puissance.fin));
    schemas.append(puissance);
    if (r.pic && niveau >= 2) schemas.append(el('p', 'doux petit', 'Pic de puissance : ' + r.pic));

    // Colonne 3 : placement, héros, objets
    titre(cote, 'Positionnement');
    cote.append(placement(r), el('p', 'petit', r.place));

    titre(cote, 'Héros');
    cote.append(portraits(r.heros));
    if (r.aussi && r.aussi.length && niveau >= 2) {
      cote.append(el('p', 'doux petit', 'Aussi jouables dans ce rôle :'), portraits(r.aussi, 'petits'));
    }

    if (r.objets_cites) {
      titre(cote, 'Objets cités');
      const boite = el('div', 'roles-objets');
      r.objets_cites.forEach((nom) => {
        const o = objets.objets.find((x) => x.nom === nom);
        const carte = el('div', 'roles-objet');
        if (o && o.image) {
          const img = el('img');
          img.src = o.image;
          img.alt = '';
          img.loading = 'lazy';
          carte.append(img);
        }
        const corps = el('div');
        corps.append(el('strong', null, nom));
        if (o) {
          corps.append(el('span', 'doux petit', ' ' + o.cout.toLocaleString('fr-FR') + ' souls' + (o.actif ? ' · actif' : '')));
          if (niveau >= 2 && o.description) corps.append(el('p', 'doux petit', o.description));
        }
        carte.append(corps);
        boite.append(carte);
      });
      cote.append(boite);
    }
  }

  // ---------- annexes ----------

  function afficherAnnexes() {
    const zone = document.getElementById('annexes');
    zone.textContent = '';

    const compo = el('section', 'panneau');
    compo.append(el('h2', null, 'Composition idéale'), el('p', null, roles.composition_ideale));
    compo.append(el('h2', 'espace', 'Héros hybrides'), el('p', 'doux', roles.hybrides.note), portraits(roles.hybrides.heros, 'petits'));
    zone.append(compo);

    const concepts = el('section', 'panneau');
    concepts.append(el('h2', null, 'Notions'));
    roles.concepts.forEach((c) => {
      const p = el('p', 'fiche-ligne');
      p.append(el('strong', null, c.nom + ' '), c.texte);
      concepts.append(p);
    });
    zone.append(concepts);

    const lexique = el('section', 'panneau');
    lexique.append(el('h2', null, 'Lexique'));
    const dl = el('dl', 'lexique');
    roles.lexique.forEach((l) => dl.append(el('dt', null, l.terme), el('dd', null, l.texte)));
    lexique.append(dl);
    zone.append(lexique);
  }

  function afficher() {
    afficherChoix();
    afficherFiche();
  }

  Promise.all(['data/roles.json', 'data/heroes.json', 'data/items.json', 'data/profil.json'].map(DLN.charger)).then((r) => {
    roles = r[0]; heros = r[1]; objets = r[2]; profil = r[3];
    document.getElementById('app').hidden = false;
    document.getElementById('meta').textContent = roles.meta.source + ' ' + roles.meta.nature;

    const parLien = location.hash.slice(1);
    if (roleDe(parLien)) choisi = parLien;
    if (!roleDe(choisi)) {
      // Par défaut : le rôle du premier héros joué.
      const mien = roles.roles.find((x) => x.heros.some((h) => h.id === profil.heros_joues[0]));
      choisi = (mien || roles.roles[0]).id;
    }
    afficher();
    afficherAnnexes();
    DLN.surNiveau(afficher);

    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
      const i = roles.roles.findIndex((x) => x.id === choisi);
      if (/^[1-9]$/.test(e.key) && roles.roles[Number(e.key) - 1]) choisir(roles.roles[Number(e.key) - 1].id);
      else if (e.key === 'ArrowRight') choisir(roles.roles[(i + 1) % roles.roles.length].id);
      else if (e.key === 'ArrowLeft') choisir(roles.roles[(i + roles.roles.length - 1) % roles.roles.length].id);
    });
  }, DLN.echec);
})();
