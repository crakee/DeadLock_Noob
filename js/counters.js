// Onglet Counters : on choisit les héros d'en face, la page dit ce qu'ils font de dangereux
// et quoi acheter. Menaces et réponses : data/counters.json (classement fait à la main d'après le
// texte des compétences et des objets). Prix et icônes : data/items.json. Stats de base et
// matchups : data/heros-details.json. Rôles : data/roles.json (avis de joueur).
(function () {
  'use strict';

  const el = DLN.el;
  const CLE = 'dln.counters.choisis.v1';
  const MAX_ADVERSAIRES = 6;
  const NB_MATCHUPS = 3;
  const LIBELLES_CATEGORIE = { weapon: 'Weapon', vitality: 'Vitality', spirit: 'Spirit' };
  const ORDRE_CATEGORIES = ['weapon', 'vitality', 'spirit', 'autre'];
  const LIBELLES_TRANCHE = DLN.LIBELLES_TRANCHE;

  let counters = null, heros = null, details = null, stats = null, roles = null, profil = null, tempo = null;
  let objets = {};
  let choisis = [];
  let tranche = null;
  let filtre = 'tous';   // filtre de la liste d'achats : tous, passifs, actifs
  let mode = 'adversaires';   // adversaires : fiche par héros d'en face ; compo : les deux équipes
  let allies = [];            // mon équipe, en mode compo
  let cible = 'face';         // équipe que remplit la grille en mode compo : face ou moi
  let courant = null;         // adversaire affiché en mode adversaires
  let minute = 15;            // moment de la partie regardé en mode compo
  const CLE_COMPO = 'dln.counters.compo.v1';
  try { const c = JSON.parse(localStorage.getItem(CLE_COMPO)) || {};
    mode = c.mode || mode; allies = c.allies || []; minute = c.minute != null ? c.minute : minute; } catch (e) { /* stockage indisponible */ }
  const sauverCompo = () => { try { localStorage.setItem(CLE_COMPO, JSON.stringify({ mode: mode, allies: allies, minute: minute })); } catch (e) { /* idem */ } };

  try { choisis = JSON.parse(localStorage.getItem(CLE)) || []; } catch (e) { choisis = []; }
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
    const liste = mode === 'compo' && cible === 'moi' ? allies : choisis;
    const autre = liste === allies ? choisis : allies;
    const i = liste.indexOf(id);
    if (i !== -1) liste.splice(i, 1);
    else if (liste.length < MAX_ADVERSAIRES) {
      liste.push(id);
      // Un héros n'est que dans une équipe à la fois.
      if (mode === 'compo' && autre.indexOf(id) !== -1) autre.splice(autre.indexOf(id), 1);
      if (liste === choisis) courant = id;
    }
    sauver();
    sauverCompo();
    afficher();
  }

  // Ajoute un héros à « En face » s'il n'y est pas, puis amène sa fiche à l'écran.
  function ouvrir(id) {
    if (choisis.indexOf(id) === -1) {
      if (choisis.length >= MAX_ADVERSAIRES) choisis.shift();
      choisis.push(id);
      sauver();
    }
    courant = id;
    if (mode !== 'adversaires') { mode = 'adversaires'; sauverCompo(); }
    afficher();
    const fiche = document.querySelector('.counters-heros[data-heros="' + id + '"]');
    if (fiche) fiche.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
        const b = el('button', 'heros-case' + (choisis.indexOf(h.id) !== -1 ? ' choisi' : '') +
          (mode === 'compo' && allies.indexOf(h.id) !== -1 ? ' allie' : ''));
        b.type = 'button';
        b.title = h.nom + (rolesDe(h.id).length > 1 ? ' · ' + rolesDe(h.id).map((r) => r.nom).join(', ') : '');
        b.append(icone(h), el('span', null, h.nom));
        b.addEventListener('click', () => basculer(h.id));
        grille.append(b);
      });
      zone.append(grille);
    });
    const liste = mode === 'compo' && cible === 'moi' ? allies : choisis;
    document.getElementById('titre-grille').textContent = mode === 'compo' && cible === 'moi' ? 'Mon équipe' : 'En face';
    document.getElementById('compte').textContent = liste.length + ' / ' + MAX_ADVERSAIRES;
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
      // Les héros concernés : un clic les ajoute à « En face » et ouvre leur fiche.
      const cibles = heros.heros.filter((h) => toutesMenacesDe(h.id).some((x) => x.id === id));
      if (cibles.length) {
        carte.append(el('h4', 'actifs-titre', 'À utiliser contre (' + cibles.length + ')'));
        const zone = el('ul', 'actifs-cibles');
        cibles.forEach((h) => {
          const li = el('li');
          const b = el('button', 'cible' + (choisis.indexOf(h.id) !== -1 ? ' choisi' : ''));
          b.type = 'button';
          b.title = 'Ajouter ' + h.nom + ' à « En face » et ouvrir sa fiche';
          b.append(icone(h), el('span', null, h.nom));
          b.addEventListener('click', () => ouvrir(h.id));
          li.append(b, el('span', 'doux petit', (toutesMenacesDe(h.id).find((x) => x.id === id) || {}).pourquoi || ''));
          zone.append(li);
        });
        carte.append(zone);
      }
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

  // Distance de tir : pleins dégâts jusqu'à une distance, puis baisse linéaire jusqu'à un minimum.
  function porteeTexte(a) {
    if (!a.chute_degats_pct) {
      return 'Portée : pas de baisse des dégâts avec la distance' +
        (a.portee_max_m && a.portee_max_m < 100 ? ', mais ne touche plus au-delà de ' + a.portee_max_m + ' m.' : '.');
    }
    return 'Portée : pleins dégâts jusqu\'à ' + a.degats_pleins_jusqu_a_m + ' m, puis les dégâts baissent jusqu\'à ' +
      a.chute_degats_pct + ' % à ' + a.degats_minimum_des_m + ' m et au-delà. Rester plus loin que ' + a.degats_minimum_des_m +
      ' m, c\'est ne prendre que ' + (100 + a.chute_degats_pct) + ' % de ses dégâts d\'arme.';
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
      if (f.arme && f.arme.degats_pleins_jusqu_a_m != null) {
        bande.append(stat('Pleins dégâts', 'jusqu\'à ' + f.arme.degats_pleins_jusqu_a_m + ' m'));
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
    if (f && f.arme && f.arme.degats_pleins_jusqu_a_m != null) boite.append(el('p', 'portee', porteeTexte(f.arme)));
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

  // ---------- profil : tempo, pics de puissance, compétences ----------

  const tempoDe = (id) => ((tempo.tranches[tranche] || {})[String(id)]) || null;
  const objetsClesDe = (id) => {
    const t = tempoDe(id);
    if (t && t.objets_cles.length) return t.objets_cles;
    return (((tempo.tranches.tous || {})[String(id)]) || {}).objets_cles || [];
  };

  // Tendance : winrate dans les parties longues moins celui des parties courtes, comparé à la marge.
  function tendance(id) {
    const t = tempoDe(id);
    if (!t || t.durees.length < 3) return null;
    const court = t.durees[0], long = t.durees[t.durees.length - 1];
    if (court.winrate == null || long.winrate == null) return null;
    const ecart = long.winrate - court.winrate;
    const marge = Math.sqrt(court.marge * court.marge + long.marge * long.marge);
    let sens = 'stable';
    if (ecart > marge) sens = 'tard';
    else if (ecart < -marge) sens = 'tot';
    return { sens: sens, ecart: ecart, marge: marge };
  }
  const LIBELLES_TENDANCE = {
    tard: 'plus fort quand la partie dure',
    tot: 'plus fort quand la partie est courte',
    stable: 'pas de tendance nette selon la durée'
  };

  function blocTempo(id) {
    const t = tempoDe(id);
    const bloc = el('div', 'tempo');
    if (!t) return bloc;
    const td = tendance(id);
    const titre = el('h3', null, 'Quand il est fort ');
    if (td) titre.append(el('span', 'puce fort tendance-' + td.sens, LIBELLES_TENDANCE[td.sens]));
    bloc.append(titre);
    const table = el('table', 'tempo-table');
    const tr1 = el('tr'), tr2 = el('tr');
    t.durees.forEach((d) => {
      tr1.append(el('th', null, d.a_min ? d.de_min + '–' + d.a_min + ' min' : 'plus de ' + d.de_min + ' min'));
      tr2.append(el('td', 'nombre', d.winrate != null ? d.winrate.toFixed(1) + ' % ± ' + d.marge.toFixed(1) : '—'));
    });
    table.append(tr1, tr2);
    bloc.append(table, el('p', 'doux petit', 'Winrate selon la durée de la partie (' + LIBELLES_TRANCHE[tranche] +
      '). Si le chiffre monte vers la droite, ses parties longues lui réussissent : le laisser farmer est dangereux.'));
    const cles = objetsClesDe(id);
    if (cles.length) {
      bloc.append(el('h3', null, 'Ses pics de puissance (objets clés)'));
      const ul = el('ul', 'objets');
      cles.forEach((o) => ul.append(ligneObjet({ nom: o.nom, quand: 'vers ' + Math.round(o.minute) + ' min · ' + o.achete_par + ' % de ses joueurs l\'achètent' })));
      bloc.append(ul);
    }
    return bloc;
  }

  function blocCompetences(h) {
    const bloc = el('div');
    bloc.append(el('h3', null, 'Compétences'));
    const liste = el('div', 'competences');
    (h.competences || []).forEach((c) => {
      const carte = el('article', 'competence');
      const img = el('img', 'competence-icone');
      img.src = c.image || '';
      img.alt = '';
      img.loading = 'lazy';
      const corps = el('div');
      const nom = el('h4', null, (c.touche === 4 ? 'Ultimate · ' : c.touche + ' · ') + c.nom);
      if (c.recharge_s) nom.append(el('span', 'competence-recharge', c.recharge_s + ' s'));
      if (c.canalisee) nom.append(el('span', 'marque', 'canalisée : un stun l\'interrompt'));
      corps.append(nom, el('p', 'competence-resume', c.resume), el('p', null, c.description));
      if (c.valeurs && c.valeurs.length) corps.append(el('p', 'doux petit', c.valeurs.map((v) => v.nom + ' ' + v.valeur).join(' · ')));
      if (DLN.niveau() >= 2 && c.ameliorations && c.ameliorations.length) {
        const ol = el('ol', 'ameliorations');
        c.ameliorations.forEach((a) => ol.append(el('li', null, a)));
        corps.append(ol);
      }
      carte.append(img, corps);
      liste.append(carte);
    });
    bloc.append(liste);
    return bloc;
  }

  function afficherHeros(zone, id) {
    const fiche = counters.heros[String(id)];
    const h = herosDe(id);
    if (!h) return;
    const bloc = el('section', 'panneau counters-heros');
    bloc.dataset.heros = String(id);
    const tete = el('div', 'counters-tete');
    const retirer = el('button', 'btn discret', '×');
    retirer.type = 'button';
    retirer.title = 'Retirer ' + h.nom;
    retirer.addEventListener('click', () => basculer(id));
    tete.append(icone(h, 'heros-icone'), el('h2', null, h.nom), el('span', 'doux', h.role || ''), retirer);
    bloc.append(tete, bandeStats(id));
    if (h.style_de_jeu) bloc.append(el('p', 'heros-style', h.style_de_jeu));
    bloc.append(blocTempo(id), blocCompetences(h));
    bloc.append(el('h3', 'section-titre', 'Ce qui le rend dangereux, et quoi acheter'));

    if (!fiche) bloc.append(el('p', 'vide', 'Héros pas encore classé dans data/counters.json (sorti après le 2 octobre).'));
    menacesDe(id).forEach((m) => {
      const menace = counters.menaces[m.id];
      const carte = el('div', 'menace');
      carte.append(el('h3', null, menace.nom), el('p', 'menace-pourquoi', m.pourquoi + '.'));
      {
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

  // ---------- mode compo ----------

  function degatsEquipe(ids) {
    let arme = 0, sorts = 0;
    ids.forEach((id) => {
      const m = toutesMenacesDe(id).map((x) => x.id);
      if (m.indexOf('tir') !== -1) arme++;
      if (m.indexOf('sorts') !== -1) sorts++;
    });
    return { arme: arme, sorts: sorts };
  }

  // Bucket de durée qui contient la minute regardée.
  function dureeA(id, m) {
    const t = tempoDe(id);
    if (!t) return null;
    return t.durees.find((d) => m >= d.de_min && (d.a_min == null || m < d.a_min)) || null;
  }

  function ligneCompo(id, face) {
    const h = herosDe(id);
    const tr = el('tr');
    const nom = el('td', 'compo-nom');
    const lien = el('button', 'cible');
    lien.type = 'button';
    lien.append(icone(h), el('span', null, h.nom));
    lien.title = 'Ouvrir sa fiche';
    lien.addEventListener('click', () => { if (face) ouvrir(id); else { courant = null; ouvrirAllie(id); } });
    nom.append(lien);
    const s = (stats.tranches[tranche] || {}).heros ? stats.tranches[tranche].heros[String(id)] : null;
    const td = tendance(id);
    const d = dureeA(id, minute);
    const deja = objetsClesDe(id).filter((o) => o.minute <= minute);
    const prochain = objetsClesDe(id).find((o) => o.minute > minute);
    tr.append(nom,
      el('td', null, rolesDe(id).map((r) => r.nom).join(', ') || '—'),
      el('td', null, typeDegats(id) || '—'),
      el('td', 'nombre', s && s.winrate != null ? s.winrate.toFixed(1) + ' %' : '—'),
      el('td', td ? 'tendance-' + td.sens : null, td ? LIBELLES_TENDANCE[td.sens] : '—'),
      el('td', null, deja.length ? deja.map((o) => o.nom).join(', ') : 'rien de majeur'),
      el('td', null, prochain ? prochain.nom + ' vers ' + Math.round(prochain.minute) + ' min' : '—'));
    if (face) {
      const m = toutesMenacesDe(id).map((x) => counters.menaces[x.id].nom.toLowerCase());
      tr.append(el('td', 'petit', m.join(', ') || '—'));
    }
    if (d && s && d.winrate != null && s.winrate != null) tr.title = 'Winrate dans les parties de cette durée : ' + d.winrate + ' % (moyenne ' + s.winrate + ' %)';
    return tr;
  }

  function ouvrirAllie(id) {
    // Ma propre équipe : la fiche complète est dans l'onglet Héros.
    location.href = DLN.lienHeros ? DLN.lienHeros(id, 'apercu') : 'heros.html#h=' + id;
  }

  function tableCompo(titre, ids, face) {
    const bloc = el('section', 'panneau');
    bloc.append(el('h2', null, titre + ' (' + ids.length + ')'));
    if (!ids.length) {
      bloc.append(el('p', 'vide', 'Choisir les héros dans la grille (bouton « Remplir : ' + (face ? 'en face' : 'mon équipe') + ' »).'));
      return bloc;
    }
    const table = el('table', 'compo-table');
    const tete = el('tr');
    ['Héros', 'Rôle', 'Dégâts', 'Winrate', 'Quand il est fort', 'Objets clés déjà achetés à ' + minute + ' min', 'Prochain pic']
      .concat(face ? ['Ce qu\'il fait'] : []).forEach((t) => tete.append(el('th', null, t)));
    table.append(tete);
    ids.forEach((id) => table.append(ligneCompo(id, face)));
    bloc.append(table);
    const dg = degatsEquipe(ids);
    bloc.append(el('p', 'petit', 'Dégâts de l\'équipe : ' + dg.arme + ' héros surtout à l\'arme, ' + dg.sorts + ' surtout aux compétences.' +
      (face && dg.arme >= dg.sorts + 2 ? ' → Bullet Resist (Vitality) en priorité.' : '') +
      (face && dg.sorts >= dg.arme + 2 ? ' → Spirit Resist (Vitality) en priorité.' : '')));
    const tard = ids.filter((id) => (tendance(id) || {}).sens === 'tard').map(nomDe);
    const tot = ids.filter((id) => (tendance(id) || {}).sens === 'tot').map(nomDe);
    if (tard.length) bloc.append(el('p', 'petit', 'Plus forts quand la partie dure : ' + tard.join(', ') + '.'));
    if (tot.length) bloc.append(el('p', 'petit', 'Plus forts dans les parties courtes : ' + tot.join(', ') + '.'));
    return bloc;
  }

  function afficherCompo(zone) {
    const reglage = el('section', 'panneau');
    const label = el('label', 'reglage');
    const curseur = el('input');
    curseur.type = 'range';
    curseur.min = '0';
    curseur.max = '45';
    curseur.step = '1';
    curseur.value = String(minute);
    const valeur = el('strong', null, minute + ' min');
    curseur.addEventListener('input', () => { valeur.textContent = curseur.value + ' min'; });
    curseur.addEventListener('change', () => { minute = Number(curseur.value); sauverCompo(); afficher(); });
    label.append('Moment de la partie regardé : ', curseur, valeur);
    reglage.append(label, el('p', 'doux petit', 'Les objets clés sont ceux de tier 3 ou plus que la plupart des joueurs de ce héros achètent, à leur minute moyenne d\'achat. ' +
      '« Quand il est fort » compare son winrate dans les parties courtes (moins de 25 min) et longues (plus de 35 min) ; ' +
      'en ' + LIBELLES_TRANCHE[tranche] + ', peu de héros ont une tendance qui dépasse la marge d\'erreur.'));
    zone.append(reglage);

    // Pics de puissance d'en face, dans l'ordre chronologique.
    const pics = [];
    choisis.forEach((id) => objetsClesDe(id).forEach((o) => pics.push({ id: id, o: o })));
    pics.sort((a, b) => a.o.minute - b.o.minute);
    if (pics.length) {
      const bloc = el('section', 'panneau');
      bloc.append(el('h2', null, 'Leurs pics de puissance, dans l\'ordre'));
      const ul = el('ul', 'pics');
      pics.forEach((p) => {
        const li = el('li', p.o.minute <= minute ? 'passe' : (p.o.minute <= minute + 5 ? 'bientot' : null));
        li.append(el('span', 'nombre', '~' + Math.round(p.o.minute) + ' min'), ' ', el('strong', null, nomDe(p.id)), ' : ' + p.o.nom +
          ' (' + p.o.cout.toLocaleString('fr-FR') + ', ' + p.o.achete_par + ' %)' +
          (p.o.minute <= minute ? ' — probablement déjà acheté' : p.o.minute <= minute + 5 ? ' — dans les 5 prochaines minutes' : ''));
        ul.append(li);
      });
      bloc.append(ul);
      zone.append(bloc);
    }

    zone.append(tableCompo('En face', choisis, true), tableCompo('Mon équipe', allies, false));
    if (choisis.length) {
      afficherResume(zone);
      afficherAchats(zone);
    }
  }

  function afficherModes() {
    const modes = document.getElementById('modes');
    modes.textContent = '';
    [['adversaires', 'Adversaires'], ['compo', 'Compo (les deux équipes)']].forEach((m) => {
      const b = el('button', 'filtre', m[1]);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(mode === m[0]));
      b.addEventListener('click', () => { mode = m[0]; cible = 'face'; sauverCompo(); afficher(); });
      modes.append(b);
    });
    const cibles = document.getElementById('cibles');
    cibles.textContent = '';
    cibles.hidden = mode !== 'compo';
    [['moi', 'Remplir : mon équipe'], ['face', 'Remplir : en face']].forEach((c) => {
      const b = el('button', 'filtre', c[1]);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(cible === c[0]));
      b.addEventListener('click', () => { cible = c[0]; afficher(); });
      cibles.append(b);
    });
  }

  function ongletsAdversaires(zone) {
    const barre = el('div', 'filtres onglets-adversaires');
    choisis.forEach((id) => {
      const h = herosDe(id);
      const b = el('button', 'cible' + (id === courant ? ' choisi' : ''));
      b.type = 'button';
      b.append(icone(h), el('span', null, h.nom));
      b.addEventListener('click', () => { courant = id; afficher(); });
      barre.append(b);
    });
    zone.append(barre);
  }

  function afficher() {
    choisis = choisis.filter((id) => herosDe(id));
    allies = allies.filter((id) => herosDe(id) && choisis.indexOf(id) === -1);
    if (choisis.indexOf(courant) === -1) courant = choisis[choisis.length - 1] || null;
    afficherModes();
    afficherGrille();
    const zone = document.getElementById('resultat');
    zone.textContent = '';
    if (mode === 'compo') { afficherCompo(zone); return; }
    if (!choisis.length) {
      zone.append(el('p', 'vide', 'Choisir un ou plusieurs héros adverses (jusqu\'à ' + MAX_ADVERSAIRES + ').'));
      zone.append(panneauActifs(true));
      return;
    }
    ongletsAdversaires(zone);
    afficherHeros(zone, courant);
    if (choisis.length > 1) afficherResume(zone);
    afficherAchats(zone);
    zone.append(panneauActifs(false));
  }

  Promise.all(['data/counters.json', 'data/heroes.json', 'data/items.json', 'data/heros-details.json',
    'data/hero-stats.json', 'data/roles.json', 'data/profil.json', 'data/tempo.json'].map(DLN.charger).concat([DLN.profil])).then((r) => {
    counters = r[0]; heros = r[1]; details = r[3]; stats = r[4]; roles = r[5]; profil = r[6]; tempo = r[7];
    r[2].objets.forEach((o) => { objets[o.nom] = o; });
    document.getElementById('app').hidden = false;
    document.getElementById('meta').textContent = 'Patch ' + counters.meta.patch + ' · counters déduits du texte des compétences et des objets ' +
      '(pas d\'un classement de winrates) · stats et matchups depuis le ' + details.meta.depuis + ' · rôles : avis de joueur';
    document.getElementById('btn-vider').addEventListener('click', () => {
      if (mode === 'compo' && cible === 'moi') allies = []; else choisis = [];
      sauver(); sauverCompo(); afficher();
    });
    tranche = DLN.tranche();
    DLN.surTranche(() => { tranche = DLN.tranche(); afficher(); });
    afficher();
    DLN.surNiveau(afficher);
  }, DLN.echec);
})();
