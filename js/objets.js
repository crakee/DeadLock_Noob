// Apprendre › Objets clés : chaque menace de data/counters.json (classée à la main d'après le texte
// des compétences et des objets), les objets qui y répondent (data/items.json) et les héros concernés.
(function () {
  'use strict';

  const el = DLN.el;
  const LIBELLES_CATEGORIE = { weapon: 'Weapon', vitality: 'Vitality', spirit: 'Spirit' };
  const ORDRE_CATEGORIES = ['weapon', 'vitality', 'spirit', 'autre'];
  const FILTRES = [['tous', 'Tous les objets'], ['actifs', 'Actifs seulement'], ['passifs', 'Passifs seulement']];

  let counters = null, heros = null;
  const objets = {};
  let filtre = 'tous';

  const parPrix = (a, b) => ((objets[a.nom] || {}).cout || 0) - ((objets[b.nom] || {}).cout || 0);
  const garde = (o) => filtre === 'tous' || (filtre === 'actifs') === !!(objets[o.nom] || {}).actif;

  function ligneObjet(o) {
    const fiche = objets[o.nom];
    const li = el('li', 'objet');
    if (fiche && fiche.image) li.append(DLN.img(fiche.image, 'objet-icone'));
    const corps = el('div', 'objet-corps');
    const tete = el('div', 'objet-tete');
    tete.append(el('strong', null, o.nom));
    if (fiche) tete.append(el('span', 'objet-prix', DLN.fmtNombre(fiche.cout)));
    if (fiche && fiche.actif) tete.append(el('span', 'objet-actif', 'actif'));
    corps.append(tete);
    if (o.quand) corps.append(el('span', 'objet-quand', o.quand));
    const explication = (counters.objets[o.nom] || {}).explication;
    if (explication) corps.append(el('span', 'objet-explication', explication));
    if (fiche && DLN.niveau() >= 3 && fiche.description) corps.append(el('span', 'objet-description', fiche.description));
    li.append(corps);
    return li;
  }

  function carte(id) {
    const m = counters.menaces[id];
    const liste = m.objets.filter(garde).sort(parPrix);
    const cibles = heros.heros.filter((h) => ((counters.heros[String(h.id)] || {}).menaces || []).some((x) => x.id === id));
    const bloc = el('section', 'menace');
    bloc.append(el('h3', null, m.nom), el('p', 'menace-pourquoi', m.explication));
    const rep = el('p', 'menace-reponse');
    rep.append(el('strong', null, 'Réponse : '), m.reponse);
    bloc.append(rep);
    if (liste.length) {
      const groupes = el('div', 'objets-groupes');
      ORDRE_CATEGORIES.forEach((cat) => {
        const ici = liste.filter((o) => ((objets[o.nom] || {}).categorie || 'autre') === cat);
        if (!ici.length) return;
        const g = el('div', 'objets-groupe ' + cat);
        g.append(el('h4', null, LIBELLES_CATEGORIE[cat] || 'Autres'));
        const ul = el('ul', 'objets');
        ici.forEach((o) => ul.append(ligneObjet(o)));
        g.append(ul);
        groupes.append(g);
      });
      bloc.append(groupes);
    } else if (m.objets.length) {
      bloc.append(el('p', 'vide', 'Aucun objet de ce type pour ce problème.'));
    }
    if (cibles.length) {
      bloc.append(el('h4', null, 'Héros concernés (' + cibles.length + ')'));
      const zone = el('div', 'cibles');
      cibles.forEach((h) => {
        const p = DLN.pastilleHeros(h, 'contrer');
        p.title = (((counters.heros[String(h.id)] || {}).menaces || []).find((x) => x.id === id) || {}).pourquoi || '';
        zone.append(p);
      });
      bloc.append(zone);
    }
    return bloc;
  }

  function afficher() {
    const choix = document.getElementById('filtre');
    choix.textContent = '';
    FILTRES.forEach((f) => {
      const b = el('button', 'filtre', f[1]);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(filtre === f[0]));
      b.addEventListener('click', () => { filtre = f[0]; afficher(); });
      choix.append(b);
    });
    const zone = document.getElementById('menaces');
    zone.textContent = '';
    Object.keys(counters.menaces)
      .filter((id) => counters.menaces[id].niveau <= DLN.niveau())
      .forEach((id) => zone.append(carte(id)));
  }

  Promise.all(['data/counters.json', 'data/heroes.json', 'data/items.json'].map(DLN.charger)).then((r) => {
    counters = r[0]; heros = r[1];
    r[2].objets.forEach((o) => { objets[o.nom] = o; });
    document.getElementById('app').hidden = false;
    document.getElementById('meta').textContent = 'Patch ' + counters.meta.patch +
      ' · menaces et objets classés à la main d\'après le texte des compétences et des objets, pas d\'après des winrates' +
      ' · texte officiel des objets : niveau 3 (menu ⚙)';
    afficher();
    DLN.surNiveau(afficher);
  }, DLN.echec);
})();
