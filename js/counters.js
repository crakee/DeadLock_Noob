// Onglet Counters : on choisit les héros d'en face, la page dit ce qu'ils font de dangereux
// et quoi acheter. Tout vient de data/counters.json (classement fait à la main d'après le texte
// des compétences) ; les prix et descriptions des objets viennent de data/items.json.
(function () {
  'use strict';

  const el = DLN.el;
  const CLE = 'dln.counters.choisis.v1';
  const MAX_ADVERSAIRES = 6;
  const LIBELLES_CATEGORIE = { weapon: 'Weapon', vitality: 'Vitality', spirit: 'Spirit' };

  let counters = null, heros = null, objets = {};
  let choisis = [];

  try { choisis = JSON.parse(localStorage.getItem(CLE)) || []; } catch (e) { choisis = []; }
  const sauver = () => { try { localStorage.setItem(CLE, JSON.stringify(choisis)); } catch (e) { /* stockage indisponible */ } };

  const menacesDe = (id) => ((counters.heros[String(id)] || {}).menaces || [])
    .filter((m) => counters.menaces[m.id].niveau <= DLN.niveau());

  function basculer(id) {
    const i = choisis.indexOf(id);
    if (i !== -1) choisis.splice(i, 1);
    else if (choisis.length < MAX_ADVERSAIRES) choisis.push(id);
    sauver();
    afficher();
  }

  function afficherGrille() {
    const zone = document.getElementById('grille');
    zone.textContent = '';
    heros.heros.forEach((h) => {
      const b = el('button', 'heros-case' + (choisis.indexOf(h.id) !== -1 ? ' choisi' : ''));
      b.type = 'button';
      b.title = h.nom;
      const img = el('img');
      img.src = h.icone || h.image || '';
      img.alt = '';
      img.loading = 'lazy';
      b.append(img, el('span', null, h.nom));
      b.addEventListener('click', () => basculer(h.id));
      zone.append(b);
    });
    document.getElementById('compte').textContent = choisis.length + ' / ' + MAX_ADVERSAIRES;
  }

  function ligneObjet(o) {
    const fiche = objets[o.nom];
    const li = el('li', 'objet');
    li.append(el('strong', null, o.nom));
    if (fiche) li.append(el('span', 'objet-prix', fiche.cout + ' · ' + (LIBELLES_CATEGORIE[fiche.categorie] || fiche.categorie)));
    li.append(el('span', 'objet-quand', o.quand));
    if (fiche && DLN.niveau() >= 3 && fiche.description) li.append(el('span', 'objet-description', fiche.description));
    return li;
  }

  function listeObjets(menace) {
    let liste = menace.objets.slice();
    // Débutant : les deux moins chers suffisent.
    if (DLN.niveau() === 1) {
      liste = liste.sort((a, b) => ((objets[a.nom] || {}).cout || 0) - ((objets[b.nom] || {}).cout || 0)).slice(0, 2);
    }
    const ul = el('ul', 'objets');
    liste.forEach((o) => ul.append(ligneObjet(o)));
    return ul;
  }

  function afficherResume(zone) {
    const total = {};
    choisis.forEach((id) => menacesDe(id).forEach((m) => { (total[m.id] = total[m.id] || []).push(counters.heros[String(id)].nom); }));
    const tri = Object.keys(total).sort((a, b) => total[b].length - total[a].length);
    if (!tri.length) return;
    const bloc = el('section', 'panneau counters-resume');
    bloc.append(el('h2', null, 'En face, surtout'));
    tri.slice(0, DLN.niveau() === 1 ? 2 : 4).forEach((idMenace) => {
      const menace = counters.menaces[idMenace];
      const carte = el('div', 'menace');
      const titre = el('h3', null, menace.nom);
      titre.append(el('span', 'menace-qui', total[idMenace].join(', ')));
      carte.append(titre, el('p', null, menace.reponse));
      if (menace.objets.length) carte.append(listeObjets(menace));
      bloc.append(carte);
    });
    zone.append(bloc);
  }

  function afficherHeros(zone, id) {
    const fiche = counters.heros[String(id)];
    const h = heros.heros.find((x) => x.id === id);
    if (!fiche || !h) return;
    const bloc = el('section', 'panneau counters-heros');
    const tete = el('div', 'counters-tete');
    const img = el('img', 'heros-icone');
    img.src = h.icone || '';
    img.alt = '';
    const retirer = el('button', 'btn discret', '×');
    retirer.type = 'button';
    retirer.title = 'Retirer ' + h.nom;
    retirer.addEventListener('click', () => basculer(id));
    tete.append(img, el('h2', null, h.nom), el('span', 'doux', h.role || ''), retirer);
    bloc.append(tete);

    menacesDe(id).forEach((m) => {
      const menace = counters.menaces[m.id];
      const carte = el('div', 'menace');
      carte.append(el('h3', null, menace.nom), el('p', 'menace-pourquoi', m.pourquoi + '.'));
      if (choisis.length === 1 || DLN.niveau() >= 2) {
        carte.append(el('p', null, menace.reponse));
        if (menace.objets.length) carte.append(listeObjets(menace));
      }
      bloc.append(carte);
    });
    if (fiche.astuces.length) {
      const astuces = el('ul', 'astuces');
      fiche.astuces.forEach((a) => astuces.append(el('li', null, a)));
      bloc.append(el('h3', null, 'À savoir'), astuces);
    }
    zone.append(bloc);
  }

  function afficher() {
    choisis = choisis.filter((id) => counters.heros[String(id)]);
    afficherGrille();
    const zone = document.getElementById('resultat');
    zone.textContent = '';
    if (!choisis.length) {
      zone.append(el('p', 'vide', 'Choisir un ou plusieurs héros adverses (jusqu\'à ' + MAX_ADVERSAIRES + ').'));
      return;
    }
    if (choisis.length > 1) afficherResume(zone);
    choisis.forEach((id) => afficherHeros(zone, id));
  }

  Promise.all(['data/counters.json', 'data/heroes.json', 'data/items.json'].map(DLN.charger)).then((r) => {
    counters = r[0]; heros = r[1];
    r[2].objets.forEach((o) => { objets[o.nom] = o; });
    document.getElementById('app').hidden = false;
    document.getElementById('meta').textContent = 'Patch ' + counters.meta.patch + ' · counters déduits du texte des compétences et des objets, ' +
      'pas d\'un classement de winrates · à corriger à l\'usage';
    document.getElementById('btn-vider').addEventListener('click', () => { choisis = []; sauver(); afficher(); });
    afficher();
    DLN.surNiveau(afficher);
  }, DLN.echec);
})();
