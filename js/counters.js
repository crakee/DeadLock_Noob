// Onglet Counters : on choisit les héros d'en face, la page dit ce qu'ils font de dangereux
// et quoi acheter. Menaces et réponses : data/counters.json (classement fait à la main d'après le
// texte des compétences et des objets). Prix et icônes : data/items.json. Stats de base et
// matchups : data/heros-details.json. Rôles : data/roles.json (avis de joueur).
(function () {
  'use strict';

  const el = DLN.el;
  const CLE = 'dln.counters.choisis.v1';
  const CLE_TRANCHE = 'dln.counters.tranche.v1';
  const MAX_ADVERSAIRES = 6;
  const NB_MATCHUPS = 3;
  const LIBELLES_CATEGORIE = { weapon: 'Weapon', vitality: 'Vitality', spirit: 'Spirit' };
  const ORDRE_CATEGORIES = ['weapon', 'vitality', 'spirit', 'autre'];
  const LIBELLES_TRANCHE = {
    tous: 'Tous rangs', initiate_sentinel: 'Initiate → Sentinel',
    mystic_oracle: 'Mystic → Oracle', phantom_eternus: 'Phantom → Eternus'
  };

  let counters = null, heros = null, details = null, stats = null, roles = null, profil = null;
  let objets = {};
  let choisis = [];
  let tranche = null;
  let filtre = 'tous';   // filtre de la liste d'achats : tous, passifs, actifs

  try { choisis = JSON.parse(localStorage.getItem(CLE)) || []; } catch (e) { choisis = []; }
  try { tranche = localStorage.getItem(CLE_TRANCHE); } catch (e) { /* stockage indisponible */ }
  const sauver = () => { try { localStorage.setItem(CLE, JSON.stringify(choisis)); } catch (e) { /* stockage indisponible */ } };

  const herosDe = (id) => heros.heros.find((x) => x.id === id);
  const nomDe = (id) => (herosDe(id) || {}).nom || (counters.heros[String(id)] || {}).nom || ('#' + id);
  const menacesDe = (id) => ((counters.heros[String(id)] || {}).menaces || [])
    .filter((m) => counters.menaces[m.id].niveau <= DLN.niveau());
  const toutesMenacesDe = (id) => (counters.heros[String(id)] || {}).menaces || [];
  const rolesDe = (id) => roles.roles.filter((r) => r.heros.concat(r.aussi || []).some((h) => h.id === id));

  function icone(h, classe) {
    const img = el('img', classe || null);
    img.src = (h && (h.icone || h.image)) || '';
    img.alt = '';
    img.loading = 'lazy';
    return img;
  }

  function basculer(id) {
    const i = choisis.indexOf(id);
    if (i !== -1) choisis.splice(i, 1);
    else if (choisis.length < MAX_ADVERSAIRES) choisis.push(id);
    sauver();
    afficher();
  }

  // ---------- grille des héros, par rôle ----------

  // Rôle principal : le premier rôle où le héros figure en titulaire, sinon en « aussi ».
  function rolePrincipal(id) {
    return roles.roles.find((r) => r.heros.some((h) => h.id === id)) ||
      roles.roles.find((r) => (r.aussi || []).some((h) => h.id === id)) || null;
  }

  function afficherGrille() {
    const zone = document.getElementById('grille');
    zone.textContent = '';
    const groupes = roles.roles.map((r) => ({ nom: r.nom, heros: [] }));
    const autres = { nom: 'Non classés', heros: [] };
    heros.heros.forEach((h) => {
      const r = rolePrincipal(h.id);
      (r ? groupes[roles.roles.indexOf(r)] : autres).heros.push(h);
    });
    groupes.concat([autres]).forEach((g) => {
      if (!g.heros.length) return;
      zone.append(el('h3', 'grille-role', g.nom));
      const grille = el('div', 'heros-grille');
      g.heros.forEach((h) => {
        const b = el('button', 'heros-case' + (choisis.indexOf(h.id) !== -1 ? ' choisi' : ''));
        b.type = 'button';
        b.title = h.nom + (rolesDe(h.id).length > 1 ? ' · ' + rolesDe(h.id).map((r) => r.nom).join(', ') : '');
        b.append(icone(h), el('span', null, h.nom));
        b.addEventListener('click', () => basculer(h.id));
        grille.append(b);
      });
      zone.append(grille);
    });
    document.getElementById('compte').textContent = choisis.length + ' / ' + MAX_ADVERSAIRES;
  }

  // ---------- objets ----------

  // Une ligne d'objet : icône, nom, prix, marque « actif », quand l'acheter, ce qu'il fait.
  function ligneObjet(o, contre) {
    const fiche = objets[o.nom];
    const explication = (counters.objets[o.nom] || {}).explication;
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
    corps.append(tete);
    if (o.quand) corps.append(el('span', 'objet-quand', o.quand));
    if (explication) corps.append(el('span', 'objet-explication', explication));
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
  function groupesObjets(liste, limite, contreDe, sansFiltre) {
    const boite = el('div', 'objets-groupes');
    ORDRE_CATEGORIES.forEach((categorie) => {
      let ici = liste.filter((o) => ((objets[o.nom] || {}).categorie || 'autre') === categorie && (sansFiltre || filtreOk(o)));
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
    return groupesObjets(liste, 0, null, true);
  }

  // ---------- panneaux de synthèse ----------

  // Les objets actifs, rangés par problème qu'ils règlent : à lire avant la partie.
  function panneauActifs(ouvert) {
    const bloc = el('details', 'panneau counters-actifs');
    bloc.open = ouvert;
    bloc.append(el('summary', null, 'Les objets actifs à connaître (un par problème)'));
    bloc.append(el('p', 'doux petit', 'Un objet actif se déclenche avec une touche, comme une compétence. Quatre au maximum.'));
    const grille = el('div', 'actifs-grille');
    Object.keys(counters.menaces).forEach((id) => {
      const m = counters.menaces[id];
      const actifs = m.objets.filter((o) => (objets[o.nom] || {}).actif);
      if (!actifs.length) return;
      const carte = el('div', 'menace');
      carte.append(el('h3', null, m.nom), el('p', 'doux petit', m.explication));
      const ul = el('ul', 'objets');
      actifs.sort(parPrix).forEach((o) => ul.append(ligneObjet(o)));
      carte.append(ul);
      grille.append(carte);
    });
    bloc.append(grille);
    return bloc;
  }

  function afficherResume(zone) {
    const total = {};
    choisis.forEach((id) => menacesDe(id).forEach((m) => { (total[m.id] = total[m.id] || []).push(nomDe(id)); }));
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

  // Liste d'achats : tous les objets qui répondent aux adversaires choisis, sans doublon,
  // classés par nombre d'adversaires concernés puis par prix.
  function afficherAchats(zone) {
    const parNom = {};
    choisis.forEach((id) => menacesDe(id).forEach((m) => {
      counters.menaces[m.id].objets.forEach((o) => {
        const e = parNom[o.nom] || (parNom[o.nom] = { nom: o.nom, quand: o.quand, heros: [], menaces: [] });
        const nom = nomDe(id);
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

  // ---------- fiche d'un adversaire ----------

  // Type de dégâts, d'après les menaces classées à la main (arme, compétences, ou les deux).
  function typeDegats(id) {
    const m = toutesMenacesDe(id).map((x) => x.id);
    const arme = m.indexOf('tir') !== -1, sorts = m.indexOf('sorts') !== -1;
    if (arme && sorts) return 'arme et compétences';
    if (arme) return 'surtout l\'arme (gun)';
    if (sorts) return 'surtout les compétences (spirit)';
    return null;
  }

  function stat(libelle, valeur, aide) {
    const d = el('div', 'stat');
    d.append(el('span', 'stat-valeur', valeur), el('span', 'stat-nom', libelle));
    if (aide) d.title = aide;
    return d;
  }

  function bandeStats(id) {
    const f = (details.fiches || {})[String(id)];
    const h = herosDe(id);
    const s = (stats.tranches[tranche] || {}).heros ? stats.tranches[tranche].heros[String(id)] : null;
    const bande = el('div', 'stats-bande');
    if (f) {
      bande.append(stat('PV de départ', String(f.pv), 'Vie au niveau 1, sans objet'));
      if (f.arme && f.arme.dps != null) {
        bande.append(stat('DPS de l\'arme', String(Math.round(f.arme.dps)),
          'Dégâts par seconde au niveau 1 sans recharger : ' + f.arme.degats_balle + ' par balle' +
          (f.arme.balles_par_tir > 1 ? ' × ' + f.arme.balles_par_tir + ' balles par tir' : '') + ', ' + f.arme.tirs_par_s + ' tirs/s'));
        bande.append(stat('Chargeur', String(f.arme.chargeur), 'Rechargement : ' + f.arme.rechargement_s + ' s'));
      }
      bande.append(stat('Vitesse', f.vitesse_m_s + ' m/s'));
    }
    if (s && s.winrate != null) bande.append(stat('Winrate', s.winrate.toFixed(1) + ' %', '± ' + s.marge.toFixed(1) + ' points, ' + LIBELLES_TRANCHE[tranche]));
    const infos = el('p', 'puces');
    rolesDe(id).forEach((r) => infos.append(el('span', 'puce', r.nom)));
    if (typeDegats(id)) infos.append(el('span', 'puce fort', 'Dégâts : ' + typeDegats(id)));
    if (h && h.arme) infos.append(el('span', 'puce', h.arme));
    if (h && h.complexite) infos.append(el('span', 'puce', 'complexité ' + h.complexite + '/3'));
    const boite = el('div');
    boite.append(bande, infos);
    return boite;
  }

  function ligneMatchup(m, sens) {
    const h = herosDe(m.contre);
    const li = el('li', 'matchup' + (Math.abs(m.ecart) > m.marge ? ' signal' : ''));
    li.append(icone(h, 'heros-icone'));
    const corps = el('div');
    const tete = el('div', 'matchup-tete');
    tete.append(el('strong', null, nomDe(m.contre)));
    const ecart = (sens === 'perd' ? -m.ecart : m.ecart);
    tete.append(el('span', 'matchup-ecart', (ecart > 0 ? '+' : '') + ecart.toFixed(1) + ' pts'),
      el('span', 'doux petit', '± ' + m.marge.toFixed(1) + ' · ' + m.parties.toLocaleString('fr-FR') + ' parties'));
    tete.append(el('span', Math.abs(m.ecart) > m.marge ? 'marque signal' : 'marque', Math.abs(m.ecart) > m.marge ? 'signal' : 'dans la marge'));
    corps.append(tete);
    // « Grâce à quoi » : ce que fait ce héros, d'après ses compétences.
    const menaces = toutesMenacesDe(m.contre);
    if (menaces.length) {
      corps.append(el('span', 'matchup-pourquoi', 'Ce qu\'il fait : ' +
        menaces.map((x) => counters.menaces[x.id].nom.toLowerCase()).join(', ')));
    }
    li.append(corps);
    return li;
  }

  function detailMatchups(id) {
    const bloc = el('details', 'matchups');
    bloc.append(el('summary', null, 'Détail : qui le bat, qui il bat'));
    const m = (((details.matchups || {})[tranche]) || {})[String(id)];
    if (!m) {
      bloc.append(el('p', 'vide', 'Pas assez de parties pour ce héros dans cette tranche.'));
      return bloc;
    }
    const nom = nomDe(id);
    bloc.append(el('p', 'doux petit',
      'Statistiques ' + LIBELLES_TRANCHE[tranche] + ' depuis le ' + details.meta.depuis + '. Écart = winrate réel contre ce héros moins le winrate attendu ' +
      'd\'après la force des deux héros. « Signal » seulement si l\'écart dépasse la marge d\'erreur.'));
    if (!m.signaux) {
      bloc.append(el('p', 'avertissement', 'Dans cette tranche, aucun matchup de ' + nom + ' ne sort de la marge d\'erreur : ' +
        'les noms ci-dessous sont surtout du hasard. Ce qui compte vraiment, ce sont ses menaces et les objets au-dessus.'));
    } else {
      bloc.append(el('p', 'doux petit', m.signaux + ' matchup' + (m.signaux > 1 ? 's' : '') + ' sur ' + m.adversaires + ' sortent de la marge.'));
    }
    const colonnes = el('div', 'matchups-colonnes');
    const perd = el('div');
    perd.append(el('h4', null, 'Le battent le plus'));
    const ulPerd = el('ul', 'matchups-liste');
    m.perd.filter((x) => x.ecart < 0).slice(0, NB_MATCHUPS).forEach((x) => ulPerd.append(ligneMatchup(x, 'perd')));
    perd.append(ulPerd);
    const bat = el('div');
    bat.append(el('h4', null, nom + ' les bat le plus'));
    const ulBat = el('ul', 'matchups-liste');
    m.bat.filter((x) => x.ecart > 0).slice(0, NB_MATCHUPS).forEach((x) => ulBat.append(ligneMatchup(x, 'bat')));
    bat.append(ulBat);
    colonnes.append(perd, bat);
    bloc.append(colonnes);
    return bloc;
  }

  function afficherHeros(zone, id) {
    const fiche = counters.heros[String(id)];
    const h = herosDe(id);
    if (!h) return;
    const bloc = el('section', 'panneau counters-heros');
    const tete = el('div', 'counters-tete');
    const retirer = el('button', 'btn discret', '×');
    retirer.type = 'button';
    retirer.title = 'Retirer ' + h.nom;
    retirer.addEventListener('click', () => basculer(id));
    tete.append(icone(h, 'heros-icone'), el('h2', null, h.nom), el('span', 'doux', h.role || ''), retirer);
    bloc.append(tete, bandeStats(id));

    if (!fiche) bloc.append(el('p', 'vide', 'Héros pas encore classé dans data/counters.json (sorti après le 2 octobre).'));
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
    if (fiche && fiche.astuces.length) {
      const astuces = el('ul', 'astuces');
      fiche.astuces.forEach((a) => astuces.append(el('li', null, a)));
      bloc.append(el('h3', null, 'À savoir'), astuces);
    }
    bloc.append(detailMatchups(id));
    zone.append(bloc);
  }

  function afficher() {
    choisis = choisis.filter((id) => herosDe(id));
    afficherGrille();
    const zone = document.getElementById('resultat');
    zone.textContent = '';
    if (!choisis.length) {
      zone.append(el('p', 'vide', 'Choisir un ou plusieurs héros adverses (jusqu\'à ' + MAX_ADVERSAIRES + ').'));
      zone.append(panneauActifs(true));
      return;
    }
    if (choisis.length > 1) afficherResume(zone);
    afficherAchats(zone);
    choisis.forEach((id) => afficherHeros(zone, id));
    zone.append(panneauActifs(false));
  }

  function construireTranche() {
    const choix = document.getElementById('opt-tranche');
    Object.keys(stats.tranches).forEach((cle) => {
      const o = el('option', null, LIBELLES_TRANCHE[cle] || cle);
      o.value = cle;
      choix.append(o);
    });
    if (!stats.tranches[tranche]) tranche = profil.tranche_par_defaut;
    choix.value = tranche;
    choix.addEventListener('change', () => {
      tranche = choix.value;
      try { localStorage.setItem(CLE_TRANCHE, tranche); } catch (e) { /* stockage indisponible */ }
      afficher();
    });
  }

  Promise.all(['data/counters.json', 'data/heroes.json', 'data/items.json', 'data/heros-details.json',
    'data/hero-stats.json', 'data/roles.json', 'data/profil.json'].map(DLN.charger)).then((r) => {
    counters = r[0]; heros = r[1]; details = r[3]; stats = r[4]; roles = r[5]; profil = r[6];
    r[2].objets.forEach((o) => { objets[o.nom] = o; });
    document.getElementById('app').hidden = false;
    document.getElementById('meta').textContent = 'Patch ' + counters.meta.patch + ' · counters déduits du texte des compétences et des objets ' +
      '(pas d\'un classement de winrates) · stats et matchups depuis le ' + details.meta.depuis + ' · rôles : avis de joueur';
    document.getElementById('btn-vider').addEventListener('click', () => { choisis = []; sauver(); afficher(); });
    construireTranche();
    afficher();
    DLN.surNiveau(afficher);
  }, DLN.echec);
})();
