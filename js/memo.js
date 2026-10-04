// Onglet Mémo : les fiches de data/memo.json, filtrées par le réglage de niveau.
(function () {
  'use strict';

  const el = DLN.el;
  const LIBELLES_SOURCE = { donnees: 'jeu', conseil: 'conseil', wiki: 'wiki' };
  let memo = null, achats = null, profil = null, heros = null, objets = {};
  let choisi = null;

  function tableauObjets(titre, objets) {
    const bloc = el('div', 'memo-objets');
    bloc.append(el('h4', null, titre));
    const table = el('table');
    objets.forEach((o) => {
      const tr = el('tr');
      tr.append(el('td', null, o.nom), el('td', 'nombre', o.cout + ' souls'), el('td', 'nombre', '+' + o.valeur + ' %'));
      table.append(tr);
    });
    bloc.append(table);
    return bloc;
  }

  // Achats réels des héros de l'utilisateur (data/achats.json), rangés par phase de la partie.
  const PHASES = [['Early', 'avant 10 min', 0, 10], ['Mid', '10 à 20 min', 10, 20], ['Late', 'après 20 min', 20, Infinity]];
  const LIBELLES_CATEGORIE = { weapon: 'Weapon', vitality: 'Vitality', spirit: 'Spirit' };

  function blocAchats() {
    const bloc = el('div', 'memo-achats');
    const tranche = achats.tranches[profil.tranche_par_defaut] ? profil.tranche_par_defaut : 'tous';
    const ids = profil.heros_joues.concat(profil.heros_a_essayer).filter((id) => achats.tranches[tranche][String(id)]);
    if (!ids.length) return bloc;
    if (choisi == null || ids.indexOf(choisi) === -1) choisi = ids[0];

    const tete = el('div', 'memo-achats-tete');
    tete.append(el('h3', null, 'Ce que les joueurs achètent vraiment'));
    const onglets = el('div', 'filtres');
    ids.forEach((id) => {
      const h = heros.heros.find((x) => x.id === id);
      const b = el('button', 'filtre', h ? h.nom : String(id));
      b.type = 'button';
      b.setAttribute('aria-pressed', String(id === choisi));
      b.addEventListener('click', () => { choisi = id; afficher(); });
      onglets.append(b);
    });
    tete.append(onglets);
    const donnees = achats.tranches[tranche][String(choisi)];
    bloc.append(tete, el('p', 'aide', 'Objets achetés par au moins 20 % des joueurs de ce héros (' + donnees.parties.toLocaleString('fr-FR') +
      ' parties, rang ' + tranche.replace('_', ' → ') + ', depuis le ' + achats.meta.depuis + '), à leur minute moyenne d\'achat. Un pourcentage élevé = presque tout le monde le prend.'));

    const colonnes = el('div', 'memo-achats-phases');
    PHASES.forEach((ph) => {
      const ici = donnees.objets.filter((o) => o.minute >= ph[2] && o.minute < ph[3]);
      const col = el('div', 'memo-achats-phase');
      const total = ici.reduce((s, o) => s + o.cout, 0);
      const titre = el('h4', null, ph[0] + ' ');
      titre.append(el('span', 'aide', ph[1] + ' · ' + ici.length + ' objets · ' + total.toLocaleString('fr-FR') + ' souls'));
      col.append(titre);
      const ul = el('ul', 'memo-achats-liste');
      ici.forEach((o) => {
        const li = el('li', 'cat-' + o.categorie);
        const it = objets[o.nom];
        if (it && it.image) {
          const img = el('img');
          img.src = it.image;
          img.alt = '';
          img.loading = 'lazy';
          li.append(img);
        }
        const nom = el('span', 'memo-achats-nom', o.nom);
        if (o.actif) nom.append(el('span', 'objet-actif', 'actif'));
        li.append(nom, el('span', 'aide', o.cout.toLocaleString('fr-FR') + ' · ' + (LIBELLES_CATEGORIE[o.categorie] || o.categorie) +
          ' · ' + o.achete_par + ' % · ~' + Math.round(o.minute) + ' min'));
        ul.append(li);
      });
      col.append(ul);
      colonnes.append(col);
    });
    bloc.append(colonnes);
    return bloc;
  }

  function afficher() {
    const sommaire = document.getElementById('sommaire');
    const zone = document.getElementById('sections');
    sommaire.textContent = '';
    zone.textContent = '';
    memo.sections.forEach((section) => {
      const fiches = section.fiches.filter((f) => f.niveau <= DLN.niveau());
      if (!fiches.length) return;
      const lien = el('a', 'sommaire-lien', section.titre);
      lien.href = '#' + section.id;
      sommaire.append(lien);

      const bloc = el('section', 'panneau memo-section');
      bloc.id = section.id;
      bloc.append(el('h2', null, section.titre));
      const grille = el('div', 'memo-grille');
      fiches.forEach((f) => {
        const carte = el('article', 'memo-fiche source-' + f.source);
        const titre = el('h3', null, f.titre);
        titre.append(el('span', 'marque', LIBELLES_SOURCE[f.source] || f.source));
        carte.append(titre, el('p', null, f.texte));
        grille.append(carte);
      });
      bloc.append(grille);
      if (section.objets_bullet_resist && DLN.niveau() >= 2) {
        const objets = el('div', 'memo-objets-zone');
        objets.append(tableauObjets('Contre les balles (Bullet Resist)', section.objets_bullet_resist),
          tableauObjets('Contre les compétences (Spirit Resist)', section.objets_spirit_resist));
        bloc.append(objets, el('p', 'aide', section.note_objets));
      }
      if (section.achats_par_heros && achats) bloc.append(blocAchats());
      zone.append(bloc);
    });
  }

  Promise.all(['data/memo.json', 'data/achats.json', 'data/profil.json', 'data/heroes.json', 'data/items.json'].map(DLN.charger)).then((r) => {
    memo = r[0]; achats = r[1]; profil = r[2]; heros = r[3];
    r[4].objets.forEach((o) => { objets[o.nom] = o; });
    document.getElementById('app').hidden = false;
    document.getElementById('meta').textContent = 'Patch ' + memo.meta.patch + ' · vérifié le ' + memo.meta.verifie_le +
      ' · « jeu » : mécanique vérifiée · « conseil » : avis de joueur (guides de Wouks) · « wiki » : non confirmé par les données';
    afficher();
    DLN.surNiveau(afficher);
  }, DLN.echec);
})();
