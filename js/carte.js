// Onglet Carte : la minimap, ses couches (data/map.json) et la fiche de chaque élément
// (data/map-elements.json). Les positions viennent des données ; seuls les choix de dessin sont ici.
(function () {
  'use strict';

  const el = DLN.el;
  const SVG = 'http://www.w3.org/2000/svg';
  const CLE_MASQUEES = 'dln.carte.masquees.v1';
  const T = 1000; // côté du repère de dessin

  // Apparence des couches (choix d'affichage, pas des valeurs de jeu)
  const STYLE = {
    structures: { forme: 'carre', r: 9 },
    shops: { couleur: '#ffd24a', forme: 'carre', r: 6 },
    camps_small: { couleur: '#9be37a', forme: 'triangle', r: 9 },
    camps_medium: { couleur: '#f2d04b', forme: 'triangle', r: 9 },
    camps_large: { couleur: '#ff7a45', forme: 'triangle', r: 10 },
    sinners: { couleur: '#ff6b9d', forme: 'carre', r: 6 },
    powerups: { couleur: '#ffffff', r: 9 },
    urn_depart: { couleur: '#c9a0ff', r: 7 },
    urn_depot: { couleur: '#c9a0ff', forme: 'carre', r: 7 },
    rifts: { couleur: '#4fd6d6', r: 11 },
    midboss: { couleur: '#7cfc9a', r: 13 },
    teleporters: { couleur: '#b58cff', r: 7 },
    soins: { couleur: '#ff8fa3', r: 4 },
    crates: { couleur: '#b98a5a', r: 2.5 },
    tough_crates: { couleur: '#3fb8a8', r: 3.5 },
    buff_containers: { couleur: '#e8c547', r: 3 },
    cloches: { couleur: '#ffffff', forme: 'carre', r: 6 },
    steam_vents: { couleur: '#cfd8dc', r: 4 },
    veils: { couleur: '#8e7dff', r: 4 },
    cordes: { couleur: '#c2a878', r: 4 },
    bounce_pads: { couleur: '#7fd1ff', r: 5 }
  };
  const EQUIPES = ['#f5a524', '#5aa9ff']; // 0 : The Hidden King (bas), 1 : The Archmother (haut)

  let carte = null;
  let fiches = null;
  let masquees = [];
  let choisie = null;

  try { masquees = JSON.parse(localStorage.getItem(CLE_MASQUEES)) || []; } catch (e) { masquees = []; }

  const svgEl = (nom, attributs) => {
    const e = document.createElementNS(SVG, nom);
    Object.keys(attributs || {}).forEach((k) => e.setAttribute(k, attributs[k]));
    return e;
  };

  const visible = (couche) => couche.niveau <= DLN.niveau() && masquees.indexOf(couche.id) === -1;
  const ficheDe = (idCouche) => fiches.elements.find((f) =>
    (f.couche_carte || '').split(',').map((s) => s.trim()).indexOf(idCouche) !== -1);

  function forme(style, x, y, couleur) {
    const r = style.r || 5;
    if (style.forme === 'carre') {
      return svgEl('rect', { x: x - r, y: y - r, width: 2 * r, height: 2 * r, fill: couleur });
    }
    if (style.forme === 'triangle') {
      return svgEl('polygon', { points: [x, y - r, x + r, y + r * 0.8, x - r, y + r * 0.8].join(' '), fill: couleur });
    }
    return svgEl('circle', { cx: x, cy: y, r: r, fill: couleur });
  }

  function dessiner() {
    const svg = document.getElementById('carte-svg');
    svg.textContent = '';
    // Les couches de détail d'abord : les éléments importants restent au-dessus.
    carte.couches.slice().sort((a, b) => b.niveau - a.niveau).forEach((couche) => {
      if (!visible(couche)) return;
      const style = STYLE[couche.id] || {};
      const groupe = svgEl('g', { class: 'couche' + (choisie === couche.id ? ' choisie' : '') });
      (couche.lignes || []).forEach((l) => {
        groupe.append(svgEl('polyline', {
          points: l.trace.map((p) => (p[0] * T) + ',' + (p[1] * T)).join(' '),
          fill: 'none', stroke: l.couleur, 'stroke-width': 5, 'stroke-opacity': 0.55, 'stroke-linejoin': 'round'
        }));
      });
      (couche.elements || []).forEach((e) => {
        const couleur = style.couleur || EQUIPES[e.equipe] || '#ffffff';
        const marqueur = forme(style, e.xy[0] * T, e.xy[1] * T, couleur);
        marqueur.setAttribute('class', 'point' + (e.approximatif ? ' approximatif' : ''));
        const titre = svgEl('title');
        titre.textContent = couche.nom + (e.type ? ' · ' + e.type : '') + (e.approximatif ? ' (position approximative)' : '');
        marqueur.append(titre);
        marqueur.addEventListener('click', () => choisir(couche.id));
        groupe.append(marqueur);
      });
      svg.append(groupe);
    });
  }

  function ligne(zone, libelle, texte) {
    if (!texte || texte === '—') return;
    const p = el('p', 'fiche-ligne');
    p.append(el('strong', null, libelle + ' '), texte);
    zone.append(p);
  }

  function afficherFiche(fiche, couche) {
    const zone = document.getElementById('fiche');
    zone.textContent = '';
    if (!fiche && !couche) {
      zone.append(el('p', 'vide', 'Cliquer un élément de la carte ou de la liste pour voir à quoi il sert.'));
      return;
    }
    const titre = el('h3', null, fiche ? fiche.nom : couche.nom);
    const m = fiche && DLN.marque(fiche.fiabilite);
    if (m) titre.append(m);
    zone.append(titre);
    if (!fiche) { zone.append(el('p', null, couche.a_quoi_ca_sert)); return; }
    ligne(zone, 'Le reconnaître :', fiche.reconnaitre);
    ligne(zone, 'Effet :', fiche.effet);
    ligne(zone, 'Comment :', fiche.comment);
    ligne(zone, 'Quand :', fiche.quand);
    ligne(zone, 'Sur la minimap :', fiche.sur_la_minimap);
    if (fiche.attention) {
      const p = el('p', 'fiche-ligne attention');
      p.append(el('strong', null, 'Attention : '), fiche.attention);
      zone.append(p);
    }
  }

  function choisir(idCouche, fiche) {
    choisie = idCouche || null;
    const couche = carte.couches.find((c) => c.id === idCouche);
    afficherFiche(fiche || (idCouche && ficheDe(idCouche)), couche);
    dessiner();
    construireCouches();
  }

  function construireCouches() {
    const zone = document.getElementById('couches');
    zone.textContent = '';
    carte.couches.forEach((couche) => {
      if (couche.niveau > DLN.niveau()) return;
      const style = STYLE[couche.id] || {};
      const rang = el('label', 'couche-rang' + (choisie === couche.id ? ' choisie' : ''));
      const case_ = el('input');
      case_.type = 'checkbox';
      case_.checked = masquees.indexOf(couche.id) === -1;
      case_.addEventListener('change', () => {
        const i = masquees.indexOf(couche.id);
        if (case_.checked && i !== -1) masquees.splice(i, 1);
        if (!case_.checked && i === -1) masquees.push(couche.id);
        try { localStorage.setItem(CLE_MASQUEES, JSON.stringify(masquees)); } catch (e) { /* stockage indisponible */ }
        dessiner();
      });
      const pastille = el('span', 'pastille ' + (style.forme || 'rond'));
      pastille.style.background = style.couleur || 'linear-gradient(90deg,' + EQUIPES[0] + ' 50%,' + EQUIPES[1] + ' 50%)';
      const nom = el('button', 'couche-nom', couche.nom);
      nom.type = 'button';
      nom.addEventListener('click', (e) => { e.preventDefault(); choisir(couche.id); });
      const nombre = (couche.elements || couche.lignes || []).length;
      rang.append(case_, pastille, nom, el('span', 'couche-nombre', String(nombre)));
      zone.append(rang);
    });
  }

  function construireGuide() {
    const zone = document.getElementById('guide');
    zone.textContent = '';
    Object.keys(fiches.categories).forEach((cle) => {
      const liste = fiches.elements.filter((f) => f.categorie === cle && f.niveau <= DLN.niveau());
      if (!liste.length) return;
      zone.append(el('h3', null, fiches.categories[cle]));
      const ul = el('div', 'guide-liste');
      liste.forEach((f) => {
        const b = el('button', 'guide-item', f.nom);
        b.type = 'button';
        b.addEventListener('click', () => {
          const premiere = (f.couche_carte || '').split(',')[0].trim();
          const i = masquees.indexOf(premiere);
          if (i !== -1) masquees.splice(i, 1);
          choisir(premiere || null, f);
        });
        ul.append(b);
      });
      zone.append(ul);
    });
  }

  function tout() {
    if (choisie && !carte.couches.some((c) => c.id === choisie && c.niveau <= DLN.niveau())) choisie = null;
    construireCouches();
    construireGuide();
    dessiner();
  }

  Promise.all([DLN.charger('data/map.json'), DLN.charger('data/map-elements.json')]).then((r) => {
    carte = r[0];
    fiches = r[1];
    document.getElementById('carte-image').src = carte.image;
    // Bouton d'orientation (js/carte-mini.js) : base en bas quelle que soit l'équipe.
    const zone = document.querySelector('.carte-zone');
    if (DLN.orientationCarte && zone) {
      const barre = DLN.el('div', 'carte-orientation');
      barre.append(DLN.orientationCarte.bouton());
      zone.parentNode.insertBefore(barre, zone);
      const orienter = () => zone.classList.toggle('retournee', DLN.orientationCarte.equipe() === 1);
      DLN.orientationCarte.surChange(orienter);
      orienter();
    }
    document.getElementById('app').hidden = false;
    document.getElementById('meta').textContent = 'Patch ' + carte.meta.patch + ' · positions : ' + carte.meta.source +
      ' · descriptions : deadlock.wiki, pas encore confirmées en jeu';
    afficherFiche(null, null);
    tout();
    DLN.surNiveau(tout);
  }, DLN.echec);
})();
