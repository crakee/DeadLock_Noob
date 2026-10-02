// Onglet Mémo : les fiches de data/memo.json, filtrées par le réglage de niveau.
(function () {
  'use strict';

  const el = DLN.el;
  const LIBELLES_SOURCE = { donnees: 'jeu', conseil: 'conseil', wiki: 'wiki' };
  let memo = null;

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
      zone.append(bloc);
    });
  }

  DLN.charger('data/memo.json').then((json) => {
    memo = json;
    document.getElementById('app').hidden = false;
    document.getElementById('meta').textContent = 'Patch ' + memo.meta.patch + ' · vérifié le ' + memo.meta.verifie_le +
      ' · « jeu » : mécanique vérifiée · « conseil » : avis de joueur (guides de Wouks) · « wiki » : non confirmé par les données';
    afficher();
    DLN.surNiveau(afficher);
  }, DLN.echec);
})();
