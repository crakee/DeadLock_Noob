// Onglet Counters : on choisit les héros d'en face, la page dit ce qu'ils font de dangereux
// et quoi acheter. Tout vient de data/counters.json (classement fait à la main d'après le texte
// des compétences) ; les prix et descriptions des objets viennent de data/items.json.
(function () {
  'use strict';

  const el = DLN.el;
  const CLE = 'dln.counters.choisis.v1';
  const MAX_ADVERSAIRES = 6;
  const LIBELLES_CATEGORIE = { weapon: 'Weapon', vitality: 'Vitality', spirit: 'Spirit' };
  const ORDRE_CATEGORIES = ['weapon', 'vitality', 'spirit', 'autre'];

  let counters = null, heros = null, objets = {};
  let choisis = [];
  let filtre = 'tous';   // filtre de la liste d'achats : tous, passifs, actifs

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

  // Une ligne d'objet : icône, nom, prix, marque « actif », quand l'acheter, et contre quoi.
  function ligneObjet(o, contre) {
    const fiche = objets[o.nom];
    const li = el('li', 'objet');
    if (fiche && fiche.image) {
      const img = el('img', 'objet-icone');
      img.src = fiche.image;
      img.alt = '';
      img.loading = 'lazy';
      li.append(img);
    }
    const corps = el('div', 'objet-corps');
    const tete = el('div', 'objet-tete');
    tete.append(el('strong', null, o.nom));
    if (fiche) tete.append(el('span', 'objet-prix', fiche.cout.toLocaleString('fr-FR')));
    if (fiche && fiche.actif) {
      const actif = el('span', 'objet-actif', 'actif');
      actif.title = 'Objet à activer avec une touche';
      tete.append(actif);
    }
    corps.append(tete, el('span', 'objet-quand', o.quand));
    if (contre) corps.append(el('span', 'objet-contre', 'Contre : ' + contre));
    if (fiche && DLN.niveau() >= 3 && fiche.description) corps.append(el('span', 'objet-description', fiche.description));
    li.append(corps);
    return li;
  }

  const filtreOk = (o) => {
    const fiche = objets[o.nom];
    return filtre === 'tous' || !fiche || (filtre === 'actifs') === !!fiche.actif;
  };

  // Objets regroupés par catégorie de la boutique. `limite` : nombre maximal par catégorie.
  function groupesObjets(liste, limite, contreDe) {
    const boite = el('div', 'objets-groupes');
    ORDRE_CATEGORIES.forEach((categorie) => {
      let ici = liste.filter((o) => ((objets[o.nom] || {}).categorie || 'autre') === categorie && filtreOk(o));
      if (!ici.length) return;
      if (limite) ici = ici.slice(0, limite);
      const groupe = el('div', 'objets-groupe ' + categorie);
      groupe.append(el('h4', null, LIBELLES_CATEGORIE[categorie] || 'Autres'));
      const ul = el('ul', 'objets');
      ici.forEach((o) => ul.append(ligneObjet(o, contreDe ? contreDe(o) : null)));
      groupe.append(ul);
      boite.append(groupe);
    });
    if (!boite.childNodes.length) boite.append(el('p', 'vide', 'Aucun objet pour ce filtre.'));
    return boite;
  }

  const parPrix = (a, b) => ((objets[a.nom] || {}).cout || 0) - ((objets[b.nom] || {}).cout || 0);

  function listeObjets(menace) {
    let liste = menace.objets.slice();
    // Débutant : les deux moins chers suffisent.
    if (DLN.niveau() === 1) liste = liste.sort(parPrix).slice(0, 2);
    return groupesObjets(liste);
  }

  // Liste d'achats : tous les objets qui répondent aux adversaires choisis, sans doublon,
  // classés par nombre d'adversaires concernés puis par prix.
  function afficherAchats(zone) {
    const parNom = {};
    choisis.forEach((id) => menacesDe(id).forEach((m) => {
      counters.menaces[m.id].objets.forEach((o) => {
        const e = parNom[o.nom] || (parNom[o.nom] = { nom: o.nom, quand: o.quand, heros: [], menaces: [] });
        const nom = counters.heros[String(id)].nom;
        if (e.heros.indexOf(nom) === -1) e.heros.push(nom);
        if (e.menaces.indexOf(m.id) === -1) e.menaces.push(m.id);
      });
    }));
    const liste = Object.keys(parNom).map((n) => parNom[n])
      .sort((a, b) => b.heros.length - a.heros.length || parPrix(a, b));
    if (!liste.length) return;

    const bloc = el('section', 'panneau counters-achats');
    const titre = el('h2', null, 'Liste d\'achats ');
    titre.append(el('span', 'note', 'par catégorie de la boutique'));
    const choix = el('div', 'filtres achats-filtre');
    [['tous', 'Tous'], ['passifs', 'Passifs'], ['actifs', 'Actifs']].forEach((f) => {
      const b = el('button', 'filtre', f[1]);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(filtre === f[0]));
      b.addEventListener('click', () => { filtre = f[0]; afficher(); });
      choix.append(b);
    });
    bloc.append(titre, choix);
    bloc.append(groupesObjets(liste, DLN.niveau() === 1 ? 3 : 0, (o) =>
      o.menaces.map((m) => counters.menaces[m].nom.toLowerCase()).join(', ') +
      (choisis.length > 1 ? ' (' + o.heros.join(', ') + ')' : '')));
    if (DLN.niveau() === 1) bloc.append(el('p', 'doux petit', 'Niveau débutant : trois objets par catégorie au plus. Passer au niveau 2 pour tout voir.'));
    zone.append(bloc);
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
    afficherAchats(zone);
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
