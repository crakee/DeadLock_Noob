// Panneau « En face » du chrono : les héros adverses choisis, ce qu'ils font de dangereux,
// quoi acheter contre eux et leurs prochains gros achats. Même liste que la page Counters
// (clé dln.counters.choisis.v1). Menaces et objets : data/counters.json (classés à la main) ;
// gros achats : data/tempo.json (minute moyenne d'achat, par tranche de rang).
(function () {
  'use strict';

  const el = DLN.el;
  const CLE = 'dln.counters.choisis.v1';
  const CLE_CHRONO = 'dln.timeline.etat.v1';
  const MAX = 6;
  const ORDRE_CATEGORIES = { weapon: 0, vitality: 1, spirit: 2 };

  let counters = null, heros = null, roles = null, tempo = null;
  const objets = {};
  let choisis = [];

  try { choisis = JSON.parse(localStorage.getItem(CLE)) || []; } catch (e) { choisis = []; }
  const sauver = () => { try { localStorage.setItem(CLE, JSON.stringify(choisis)); } catch (e) { /* stockage indisponible */ } };

  const herosDe = (id) => heros.heros.find((h) => h.id === id);
  const menacesDe = (id) => ((counters.heros[String(id)] || {}).menaces || [])
    .filter((m) => counters.menaces[m.id] && counters.menaces[m.id].niveau <= DLN.niveau());
  const parPrix = (a, b) => ((objets[a] || {}).cout || 0) - ((objets[b] || {}).cout || 0);

  // Minute de jeu d'après l'état du chrono (même calcul que timeline.js).
  function minuteChrono() {
    try {
      const e = JSON.parse(localStorage.getItem(CLE_CHRONO)) || {};
      if (e.depart != null) return (Date.now() - e.depart) / 60000;
      return (e.pauseA || 0) / 60;
    } catch (err) { return 0; }
  }

  function basculer(id) {
    const i = choisis.indexOf(id);
    if (i !== -1) choisis.splice(i, 1);
    else if (choisis.length < MAX) choisis.push(id);
    sauver();
    afficher();
  }

  // ---------- équipe d'en face ----------

  function afficherEquipe() {
    const zone = document.getElementById('enface-equipe');
    zone.textContent = '';
    for (let i = 0; i < MAX; i++) {
      const h = herosDe(choisis[i]);
      if (!h) {
        const b = el('button', 'enface-place vide', '+');
        b.type = 'button';
        b.title = 'Ajouter un héros d\'en face';
        b.addEventListener('click', ouvrirChoix);
        zone.append(b);
        continue;
      }
      const a = el('a', 'enface-place');
      a.href = DLN.lienHeros(h.id, 'contrer');
      a.title = 'Fiche de ' + h.nom + ' : comment le contrer';
      a.append(DLN.img(h.icone || h.image), el('span', null, h.nom));
      const x = el('button', 'enface-retirer', '×');
      x.type = 'button';
      x.title = 'Retirer ' + h.nom;
      x.addEventListener('click', (e) => { e.preventDefault(); basculer(h.id); });
      a.append(x);
      zone.append(a);
    }
    document.getElementById('enface-vider').hidden = !choisis.length;
  }

  // ---------- dangers, achats, pics ----------

  function afficherCorps() {
    const zone = document.getElementById('enface-corps');
    zone.textContent = '';
    if (!choisis.length) {
      zone.append(el('p', 'enface-vide', 'Ajoute les héros adverses dès l\'écran de chargement (bouton +). ' +
        'Ici s\'affichent ce qu\'ils font de dangereux et quoi acheter contre eux.'));
      return;
    }

    // Menaces regroupées, les plus partagées d'abord.
    const total = {};
    choisis.forEach((id) => menacesDe(id).forEach((m) => { (total[m.id] = total[m.id] || []).push(herosDe(id).nom); }));
    const tri = Object.keys(total).sort((a, b) => total[b].length - total[a].length);
    // Achats : objets qui répondent à ces menaces, sans doublon, classés par nombre d'adversaires puis par prix.
    const parNom = {};
    tri.forEach((idMenace) => counters.menaces[idMenace].objets.forEach((o) => {
      const e = parNom[o.nom] || (parNom[o.nom] = { nom: o.nom, heros: [], menaces: [] });
      total[idMenace].forEach((n) => { if (e.heros.indexOf(n) === -1) e.heros.push(n); });
      if (e.menaces.indexOf(idMenace) === -1) e.menaces.push(idMenace);
    }));
    const liste = Object.keys(parNom).map((n) => parNom[n])
      .sort((a, b) => b.heros.length - a.heros.length || parPrix(a.nom, b.nom))
      .slice(0, DLN.niveau() === 1 ? 6 : 10)
      .sort((a, b) => (ORDRE_CATEGORIES[(objets[a.nom] || {}).categorie] || 0) - (ORDRE_CATEGORIES[(objets[b.nom] || {}).categorie] || 0) || parPrix(a.nom, b.nom));
    if (liste.length) {
      zone.append(el('h3', null, 'À acheter contre eux'));
      const ul = el('ul', 'achats');
      liste.forEach((o) => {
        const f = objets[o.nom] || {};
        const li = el('li', 'achat obj-' + (f.categorie || 'autre'));
        li.title = (counters.objets[o.nom] || {}).explication || '';
        li.append(DLN.img(f.image));
        const nom = el('span', 'achat-nom', o.nom + ' ');
        if (f.cout) nom.append(el('span', 'objet-prix', DLN.fmtNombre(f.cout)));
        if (f.actif) nom.append(' ', el('span', 'objet-actif', 'actif'));
        li.append(nom, el('span', 'achat-pour', o.menaces.map((m) => counters.menaces[m].nom.toLowerCase()).join(', ') +
          (choisis.length > 1 ? ' · ' + o.heros.join(', ') : '')));
        ul.append(li);
      });
      zone.append(ul);
    }

    // Prochains gros achats de chacun : le moment où il devient plus fort.
    if (tempo) {
      // objets_cles n'existe que pour certaines tranches : sinon, tous rangs.
      const ici = tempo.tranches[DLN.tranche()] || {};
      const tranche = Object.keys(ici).some((k) => (ici[k].objets_cles || []).length) ? DLN.tranche() : 'tous';
      const minute = minuteChrono();
      const lignes = [];
      choisis.forEach((id) => {
        const t = ((tempo.tranches[tranche] || {})[String(id)] || {}).objets_cles || [];
        const prochain = t.filter((o) => o.minute >= minute).sort((a, b) => a.minute - b.minute)[0];
        if (prochain) lignes.push({ h: herosDe(id), o: prochain });
      });
      if (lignes.length) {
        zone.append(el('h3', null, 'Leur prochain gros achat'));
        const ul = el('ul', 'achats');
        lignes.sort((a, b) => a.o.minute - b.o.minute).forEach((l) => {
          const f = objets[l.o.nom] || {};
          const li = el('li', 'achat obj-' + (l.o.categorie || f.categorie || 'autre'));
          li.append(DLN.img(l.h.icone || l.h.image), el('span', 'achat-nom', l.h.nom + ' → ' + l.o.nom),
            el('span', 'achat-pour', 'vers ' + Math.floor(l.o.minute) + ':' + String(Math.round((l.o.minute % 1) * 60)).padStart(2, '0') +
              ' · ' + l.o.achete_par + ' % de ses joueurs le prennent'));
          ul.append(li);
        });
        zone.append(ul);
      }
    }
    // Leurs dangers, et la réponse en une phrase.
    if (tri.length) {
      zone.append(el('h3', null, 'Leurs dangers'));
      const ul = el('ul', 'enface-menaces');
      tri.slice(0, DLN.niveau() === 1 ? 3 : 5).forEach((id) => {
        const m = counters.menaces[id];
        const li = el('li', 'enface-menace');
        li.append(el('strong', null, m.nom), el('span', 'qui', total[id].join(', ')), el('p', null, m.reponse));
        ul.append(li);
      });
      zone.append(ul);
    }

  }

  function afficher() {
    choisis = choisis.filter((id) => herosDe(id));
    afficherEquipe();
    afficherCorps();
  }

  // ---------- fenêtre de choix ----------

  const dialogue = document.getElementById('choix-heros');

  function remplirChoix() {
    const zone = document.getElementById('choix-grille');
    const filtre = document.getElementById('choix-recherche').value.trim().toLowerCase();
    zone.textContent = '';
    DLN.grouperParRole(heros.heros, roles).forEach((g) => {
      const ici = g.heros.filter((h) => !filtre || h.nom.toLowerCase().indexOf(filtre) !== -1);
      if (!ici.length) return;
      zone.append(el('h3', 'grille-role', g.nom));
      const grille = el('div', 'heros-grille');
      ici.forEach((h) => {
        const b = el('button', 'heros-case' + (choisis.indexOf(h.id) !== -1 ? ' choisi' : ''));
        b.type = 'button';
        b.append(DLN.img(h.icone || h.image), el('span', null, h.nom));
        b.addEventListener('click', () => {
          basculer(h.id);
          remplirChoix();
          if (choisis.length >= MAX) dialogue.close();
        });
        grille.append(b);
      });
      zone.append(grille);
    });
  }

  function ouvrirChoix() {
    document.getElementById('choix-recherche').value = '';
    remplirChoix();
    dialogue.showModal();
    document.getElementById('choix-recherche').focus();
  }

  dialogue.querySelector('[data-fermer]').addEventListener('click', () => dialogue.close());
  dialogue.addEventListener('click', (e) => { if (e.target === dialogue) dialogue.close(); });
  document.getElementById('choix-recherche').addEventListener('input', remplirChoix);
  document.getElementById('choix-recherche').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const premier = document.querySelector('#choix-grille .heros-case');
    if (premier) premier.click();
    e.target.value = '';
    remplirChoix();
  });
  document.getElementById('enface-vider').addEventListener('click', () => { choisis = []; sauver(); afficher(); });

  Promise.all([
    DLN.charger('data/counters.json'), DLN.charger('data/heroes.json'), DLN.charger('data/items.json'),
    DLN.charger('data/roles.json'), DLN.charger('data/tempo.json').catch(() => null)
  ]).then((r) => {
    counters = r[0]; heros = r[1]; roles = r[3]; tempo = r[4];
    r[2].objets.forEach((o) => { objets[o.nom] = o; });
    afficher();
    DLN.surNiveau(afficher);
    DLN.surTranche(afficher);
    // Les héros choisis sur la page Counters (autre onglet) apparaissent ici aussi.
    window.addEventListener('storage', (e) => {
      if (e.key !== CLE) return;
      try { choisis = JSON.parse(e.newValue) || []; } catch (err) { choisis = []; }
      afficher();
    });
    setInterval(afficherCorps, 15000);
  }, () => {
    document.getElementById('enface-corps').append(el('p', 'vide', 'Données des counters introuvables.'));
  });
})();
