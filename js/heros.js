// Onglet Héros : liste classée par winrate (data/hero-stats.json), fiche avec style de jeu,
// rôle (data/roles.json, jugement) et compétences (data/heroes.json).
(function () {
  'use strict';

  const el = DLN.el;
  const CLE_REGLAGES = 'dln.heros.reglages.v1';
  const LIBELLES_TRANCHE = {
    tous: 'Tous rangs', initiate_sentinel: 'Initiate → Sentinel',
    mystic_oracle: 'Mystic → Oracle', phantom_eternus: 'Phantom → Eternus'
  };

  let heros = null, stats = null, roles = null, profil = null;
  let reglages = { tranche: null, role: '', miens: false, choisi: null };

  try { Object.assign(reglages, JSON.parse(localStorage.getItem(CLE_REGLAGES)) || {}); } catch (e) { /* stockage indisponible */ }
  const sauver = () => { try { localStorage.setItem(CLE_REGLAGES, JSON.stringify(reglages)); } catch (e) { /* idem */ } };

  const rolesDe = (id) => roles.roles.filter((r) =>
    r.heros.concat(r.aussi || []).some((h) => h.id === id));
  const estMien = (id) => profil.heros_joues.indexOf(id) !== -1;
  const aEssayer = (id) => profil.heros_a_essayer.indexOf(id) !== -1;
  const statDe = (id, tranche) => stats.tranches[tranche].heros[String(id)];

  function construireFiltres() {
    const tranche = document.getElementById('opt-tranche');
    Object.keys(stats.tranches).forEach((cle) => {
      const o = el('option', null, LIBELLES_TRANCHE[cle] || cle);
      o.value = cle;
      tranche.append(o);
    });
    if (!stats.tranches[reglages.tranche]) reglages.tranche = profil.tranche_par_defaut;
    tranche.value = reglages.tranche;
    tranche.addEventListener('change', () => { reglages.tranche = tranche.value; sauver(); afficher(); });

    const role = document.getElementById('opt-role');
    roles.roles.forEach((r) => {
      const o = el('option', null, r.nom);
      o.value = r.id;
      role.append(o);
    });
    role.value = reglages.role;
    role.addEventListener('change', () => { reglages.role = role.value; sauver(); afficher(); });

    const miens = document.getElementById('opt-miens');
    miens.checked = reglages.miens;
    miens.addEventListener('change', () => { reglages.miens = miens.checked; sauver(); afficher(); });
  }

  function afficherListe() {
    const zone = document.getElementById('liste');
    zone.textContent = '';
    const lignes = heros.heros
      .filter((h) => !reglages.role || rolesDe(h.id).some((r) => r.id === reglages.role))
      .filter((h) => !reglages.miens || estMien(h.id) || aEssayer(h.id))
      .map((h) => ({ h: h, s: statDe(h.id, reglages.tranche) }))
      .sort((a, b) => ((b.s && b.s.winrate) || 0) - ((a.s && a.s.winrate) || 0));

    lignes.forEach((l) => {
      const h = l.h, s = l.s;
      const b = el('button', 'heros-rang' + (reglages.choisi === h.id ? ' choisi' : ''));
      b.type = 'button';
      const img = el('img', 'heros-icone');
      img.src = h.icone || h.image || '';
      img.alt = '';
      img.loading = 'lazy';
      const nom = el('span', 'heros-nom', h.nom);
      if (estMien(h.id)) nom.append(el('span', 'marque mien', 'joué'));
      else if (aEssayer(h.id)) nom.append(el('span', 'marque', 'à essayer'));
      const role = el('span', 'heros-role', rolesDe(h.id).map((r) => r.nom).join(' · ') || '—');
      const jauge = el('span', 'jauge');
      if (s && s.winrate != null) {
        // Échelle 40–60 % : la barre montre l'écart à 50 %, le trait clair la marge d'erreur.
        const pos = (v) => Math.max(0, Math.min(100, (v - 40) * 5));
        const barre = el('span', 'jauge-barre ' + (s.winrate >= 50 ? 'haut' : 'bas'));
        barre.style.left = Math.min(pos(50), pos(s.winrate)) + '%';
        barre.style.width = Math.abs(pos(s.winrate) - pos(50)) + '%';
        const marge = el('span', 'jauge-marge');
        marge.style.left = pos(s.winrate - s.marge) + '%';
        marge.style.width = (pos(s.winrate + s.marge) - pos(s.winrate - s.marge)) + '%';
        jauge.append(barre, marge);
      }
      const chiffre = el('span', 'heros-winrate', s && s.winrate != null ? s.winrate.toFixed(1) + ' %' : '—');
      const marge = el('span', 'heros-marge', s && s.marge != null ? '± ' + s.marge.toFixed(1) : '');
      b.append(img, nom, role, jauge, chiffre, marge);
      b.addEventListener('click', () => { reglages.choisi = h.id; sauver(); afficher(); });
      zone.append(b);
    });
    if (!lignes.length) zone.append(el('p', 'vide', 'Aucun héros pour ce filtre.'));
  }

  function bloc(zone, titre, noeud) {
    zone.append(el('h3', null, titre), noeud);
  }

  function afficherFiche() {
    const zone = document.getElementById('fiche');
    zone.textContent = '';
    const h = heros.heros.find((x) => x.id === reglages.choisi);
    if (!h) {
      zone.append(el('p', 'vide', 'Choisir un héros dans la liste.'));
      return;
    }
    const tete = el('div', 'heros-tete');
    const img = el('img', 'heros-portrait');
    img.src = h.image || h.icone || '';
    img.alt = '';
    const titre = el('div');
    titre.append(el('h1', null, h.nom), el('p', 'heros-accroche', h.role));
    const puces = el('p', 'puces');
    [h.type, h.arme].concat(h.etiquettes_jeu).filter(Boolean).forEach((t) => puces.append(el('span', 'puce', t)));
    puces.append(el('span', 'puce', 'complexité ' + h.complexite + '/3'));
    titre.append(puces);
    tete.append(img, titre);
    zone.append(tete, el('p', 'heros-style', h.style_de_jeu));

    // Statistiques par tranche
    const table = el('table', 'heros-stats');
    Object.keys(stats.tranches).forEach((cle) => {
      const s = statDe(h.id, cle);
      if (!s) return;
      const tr = el('tr', cle === reglages.tranche ? 'courante' : null);
      tr.append(el('td', null, LIBELLES_TRANCHE[cle] || cle), el('td', 'nombre', s.winrate.toFixed(1) + ' %'),
        el('td', 'nombre doux', '± ' + s.marge.toFixed(1)), el('td', 'nombre doux', s.parties.toLocaleString('fr-FR') + ' parties'));
      table.append(tr);
    });
    bloc(zone, 'Winrate depuis le ' + stats.meta.depuis, table);

    // Rôle (jugement)
    rolesDe(h.id).forEach((r) => {
      if (DLN.niveau() < 2 && rolesDe(h.id).indexOf(r) > 0) return;
      const carte = el('div', 'role-carte');
      const p = (libelle, texte) => {
        const ligne = el('p', 'fiche-ligne');
        ligne.append(el('strong', null, libelle + ' '), texte);
        carte.append(ligne);
      };
      p('Où :', r.place);
      p('Quoi faire :', r.quoi_faire);
      p('À éviter :', r.a_eviter.join(' '));
      if (DLN.niveau() >= 2) {
        p('Objectifs :', r.objectifs);
        p('Puissance :', 'début ' + r.puissance.debut + ', milieu ' + r.puissance.milieu + ', fin ' + r.puissance.fin + '.');
      }
      const t = el('h3', null, 'Rôle : ' + r.nom);
      t.append(el('span', 'marque', 'conseil'));
      zone.append(t, carte);
    });

    // Compétences
    const comps = el('div', 'competences');
    h.competences.forEach((c) => {
      const carte = el('article', 'competence');
      const icone = el('img', 'competence-icone');
      icone.src = c.image || '';
      icone.alt = '';
      icone.loading = 'lazy';
      const corps = el('div');
      const nom = el('h4', null, c.touche + ' · ' + c.nom);
      if (c.recharge_s) nom.append(el('span', 'competence-recharge', c.recharge_s + ' s'));
      corps.append(nom, el('p', 'competence-resume', c.resume));
      if (DLN.niveau() >= 2) {
        corps.append(el('p', null, c.description));
        if (c.valeurs.length) {
          corps.append(el('p', 'doux', c.valeurs.map((v) => v.nom + ' ' + v.valeur).join(' · ')));
        }
      }
      if (DLN.niveau() >= 3 && c.ameliorations.length) {
        const ol = el('ol', 'ameliorations');
        c.ameliorations.forEach((a) => ol.append(el('li', null, a)));
        corps.append(ol);
      }
      carte.append(icone, corps);
      comps.append(carte);
    });
    bloc(zone, 'Compétences', comps);

    const lien = el('a', 'lien', 'Voir les compétences en vidéo sur le wiki');
    lien.href = h.wiki;
    lien.target = '_blank';
    lien.rel = 'noopener';
    zone.append(el('p', null, null));
    zone.lastChild.append(lien);
  }

  function afficher() {
    afficherListe();
    afficherFiche();
  }

  Promise.all(['data/heroes.json', 'data/hero-stats.json', 'data/roles.json', 'data/profil.json'].map(DLN.charger)).then((r) => {
    heros = r[0]; stats = r[1]; roles = r[2]; profil = r[3];
    document.getElementById('app').hidden = false;
    document.getElementById('meta').textContent = 'Patch ' + heros.meta.patch + ' · stats depuis le ' + stats.meta.depuis +
      ' · un écart de winrate inférieur à la marge (±) n\'est pas un signal · rôles : avis de joueur, pas une donnée du jeu';
    construireFiltres();
    if (reglages.choisi == null) reglages.choisi = profil.heros_joues[0];
    afficher();
    DLN.surNiveau(afficher);
  }, DLN.echec);
})();
