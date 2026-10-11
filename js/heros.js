// Espace Héros : une fiche unique par héros, qui regroupe tout ce que le site sait de lui.
// Sources : data/heroes.json (compétences), heros-details.json (stats de base, matchups),
// hero-stats.json et tempo.json (winrates par rang et par durée), roles.json (rôle, avis de joueur),
// counters.json (menaces et objets, classés à la main), items.json, achats.json, patch.json.
(function () {
  'use strict';

  const el = DLN.el;
  const CLE = 'dln.heros.reglages.v1';
  const CLE_ENFACE = 'dln.counters.choisis.v1';
  const NB_MATCHUPS = 4;
  const LIBELLES_CATEGORIE = { weapon: 'Weapon', vitality: 'Vitality', spirit: 'Spirit' };
  const ORDRE_CATEGORIES = ['weapon', 'vitality', 'spirit', 'autre'];
  const PHASES = [['Early', 'avant 10 min', 0, 10], ['Mid', '10 à 20 min', 10, 20], ['Late', 'après 20 min', 20, Infinity]];
  const ONGLETS = [
    ['apercu', 'Aperçu'], ['competences', 'Compétences'], ['contrer', 'Le contrer'],
    ['builds', 'Builds'], ['matchups', 'Stats'], ['patch', 'Patch']
  ];

  let D = {};            // toutes les données chargées
  const objets = {};
  let profil = null;
  let reglages = { choisi: null };
  let onglet = 'apercu';

  try { Object.assign(reglages, JSON.parse(localStorage.getItem(CLE)) || {}); } catch (e) { /* stockage indisponible */ }
  const sauver = () => { try { localStorage.setItem(CLE, JSON.stringify({ choisi: reglages.choisi })); } catch (e) { /* idem */ } };

  const herosDe = (id) => D.heros.heros.find((h) => h.id === id);
  const estMien = (id) => profil.heros_joues.indexOf(id) !== -1;
  const aEssayer = (id) => profil.heros_a_essayer.indexOf(id) !== -1;
  const rolesDe = (id) => D.roles.roles.filter((r) => r.heros.concat(r.aussi || []).some((h) => h.id === id));
  const menacesDe = (id) => ((D.counters.heros[String(id)] || {}).menaces || []);
  const statDe = (id, tranche) => ((D.stats.tranches[tranche] || {}).heros || {})[String(id)];
  const parPrix = (a, b) => ((objets[a.nom] || {}).cout || 0) - ((objets[b.nom] || {}).cout || 0);
  const fmtMinute = (m) => Math.floor(m) + ':' + String(Math.round((m % 1) * 60)).padStart(2, '0');

  function lireEnFace() { try { return JSON.parse(localStorage.getItem(CLE_ENFACE)) || []; } catch (e) { return []; } }
  function ecrireEnFace(l) { try { localStorage.setItem(CLE_ENFACE, JSON.stringify(l)); } catch (e) { /* idem */ } }

  // ---------- adresse : heros.html#h=13&o=contrer ----------

  function lireAdresse() {
    const p = new URLSearchParams(location.hash.slice(1));
    const h = Number(p.get('h'));
    if (h && herosDe(h)) reglages.choisi = h;
    const o = p.get('o');
    if (ONGLETS.some((x) => x[0] === o)) onglet = o;
  }

  function aller(id, o) {
    reglages.choisi = id;
    if (o) onglet = o;
    sauver();
    history.replaceState(null, '', '#h=' + id + (onglet !== 'apercu' ? '&o=' + onglet : ''));
    afficher();
  }

  // ---------- liste à gauche ----------

  // compact : portrait seul (rangées « mes héros » en tête de liste).
  function caseHeros(h, compact) {
    const b = el('button', 'heros-case' + (compact ? ' compact' : '') + (h.id === reglages.choisi ? ' choisi' : '') +
      (!compact && DLN.etiquettes.de(h.id).indexOf('joué') !== -1 ? ' mien' : ''));
    b.type = 'button';
    b.title = h.nom;
    b.append(DLN.img(h.icone || h.image));
    if (compact) b.setAttribute('aria-label', h.nom); else b.append(el('span', null, h.nom));
    if (h.id === reglages.choisi) b.setAttribute('aria-current', 'true');
    b.addEventListener('click', () => {
      document.querySelector('.choix-colonne').classList.remove('ouverte');
      aller(h.id);
      window.scrollTo({ top: 0 });
    });
    return b;
  }

  // D'abord les héros qui portent une étiquette (rangée de portraits par étiquette, un héros dans la première
  // de ses étiquettes), puis tous les héros par rôle : un héros joué y reste, avec un contour or, pour voir son rôle.
  function afficherListe() {
    const zone = document.getElementById('liste');
    const filtre = document.getElementById('recherche').value.trim().toLowerCase();
    zone.textContent = '';
    const garde = (h) => !filtre || h.nom.toLowerCase().indexOf(filtre) !== -1;
    const places = {};
    const mes = el('div', 'mes-heros');
    DLN.etiquettes.enUsage().forEach((t) => {
      const ici = DLN.etiquettes.avec(t).filter((id) => !places[id]).map(herosDe).filter((h) => h && garde(h));
      if (!ici.length) return;
      ici.forEach((h) => { places[h.id] = true; });
      const ligne = el('div', 'mes-heros-ligne');
      const nom = el('span', 'mes-heros-nom', t);
      nom.style.setProperty('--etiquette', DLN.etiquettes.couleur(t));
      const rang = el('div', 'mes-heros-portraits');
      ici.forEach((h) => rang.append(caseHeros(h, true)));
      ligne.append(nom, rang);
      mes.append(ligne);
    });
    if (mes.childNodes.length) zone.append(mes);
    const tous = el('div', 'liste-roles');
    DLN.grouperParRole(D.heros.heros.filter(garde), D.roles).forEach((g) => {
      tous.append(el('h3', 'grille-role', g.nom));
      const grille = el('div', 'heros-grille');
      g.heros.forEach((h) => grille.append(caseHeros(h)));
      tous.append(grille);
    });
    if (tous.childNodes.length) zone.append(tous);
    if (!zone.childNodes.length) zone.append(el('p', 'vide', 'Aucun héros ne correspond.'));
    document.querySelector('.choix-colonne').classList.toggle('filtree', Boolean(filtre));
  }

  // ---------- bandeau ----------

  function typeDegats(id) {
    const m = menacesDe(id).map((x) => x.id);
    const arme = m.indexOf('tir') !== -1, sorts = m.indexOf('sorts') !== -1;
    if (arme && sorts) return ['Arme et Spirit', 'mixte'];
    if (arme) return ['Dégâts à l\'arme', 'weapon'];
    if (sorts) return ['Dégâts Spirit', 'spirit'];
    return null;
  }

  function stat(libelle, valeur, aide, classe, carre) {
    const d = el('div', 'stat' + (classe ? ' ' + classe : ''));
    const nom = el('span', 'stat-nom');
    if (carre) nom.append(el('i', 'carre ' + carre));
    nom.append(libelle);
    d.append(el('span', 'stat-valeur', valeur), nom);
    if (aide) d.title = aide;
    return d;
  }

  // Étiqueter ▾ : l'éditeur d'étiquettes replié derrière un seul bouton.
  function boutonEtiqueter(h) {
    const d = el('details', 'etiqueter');
    const s = el('summary', 'btn discret');
    s.append('Étiqueter', DLN.icone('chevron-down'));
    d.append(s);
    const p = el('div', 'etiqueter-panneau');
    p.append(DLN.etiquettes.editeur(h.id));
    d.append(p);
    d.addEventListener('keydown', (e) => { if (e.key === 'Escape') { d.open = false; s.focus(); } });
    return d;
  }

  // Tête de fiche : portrait, nom, étiquettes posées, une ligne d'identité, 3 chiffres (PV, DPS, portée).
  function bandeau(h) {
    const b = el('header', 'bandeau');
    b.append(DLN.img(h.image || h.icone, 'bandeau-portrait'));
    const droite = el('div', 'bandeau-corps');
    const titre = el('div', 'bandeau-titre');
    titre.append(el('h1', null, h.nom), DLN.etiquettes.pastilles(h.id));

    const actions = el('div', 'bandeau-actions');
    const dedans = lireEnFace().indexOf(h.id) !== -1;
    const bouton = el('button', 'btn en-face' + (dedans ? ' dedans' : ''));
    bouton.append(DLN.icone(dedans ? 'check' : 'swords'), el('span', 'large', dedans ? 'En face' : 'Ajouter en face'), el('span', 'court', 'En face'));
    bouton.type = 'button';
    bouton.setAttribute('aria-pressed', String(dedans));
    bouton.title = dedans ? 'Retirer des héros d\'en face (page En partie)' : 'Ajouter aux héros d\'en face (page En partie)';
    bouton.addEventListener('click', () => {
      const l = lireEnFace();
      const i = l.indexOf(h.id);
      if (i !== -1) l.splice(i, 1); else { if (l.length >= 6) l.shift(); l.push(h.id); }
      ecrireEnFace(l);
      afficherFiche();
    });
    actions.append(bouton, boutonEtiqueter(h));
    titre.append(actions);
    droite.append(titre, el('p', 'bandeau-accroche', h.role_fr || h.role));

    // Identité en une ligne : rôle (lien), type de dégâts (carré codé), arme, complexité.
    const ident = el('p', 'bandeau-identite');
    const ajout = (n) => { if (ident.childNodes.length) ident.append(el('span', 'sep', '·')); ident.append(n); };
    rolesDe(h.id).slice(0, 1).forEach((r) => {
      const a = el('a', null, r.nom);
      a.href = 'roles.html#' + r.id;
      a.title = 'Voir la fiche du rôle';
      ajout(a);
    });
    const td = typeDegats(h.id);
    if (td) { const s = el('span', 'type-degats ' + td[1]); s.append(el('i', 'carre'), td[0]); ajout(s); }
    if (h.arme) ajout(el('span', null, h.arme));
    ajout(el('span', null, 'Complexité ' + h.complexite + '/3'));
    const st = statDe(h.id, DLN.tranche());
    const t = DLN.tier(st);
    if (t) {
      const a = el('a', 'tier-puce tier-' + t.lettre);
      a.append(el('strong', null, 'Tier ' + t.lettre), ' ' + DLN.LIBELLES_TRANCHE[DLN.tranche()]);
      a.href = 'tiers.html';
      a.title = t.libelle + ' de la moyenne : ' + st.winrate.toFixed(1) + ' % ± ' + st.marge.toFixed(1) + ' (' + DLN.fmtNombre(st.parties) + ' parties). Voir la tier list.';
      ajout(a);
    }
    const wiki = el('a', 'lien-wiki', 'Wiki ↗');
    wiki.href = h.wiki;
    wiki.target = '_blank';
    wiki.rel = 'noopener';
    ajout(wiki);
    droite.append(ident);

    const f = (D.details.fiches || {})[String(h.id)];
    const bande = el('div', 'stats-bande');
    if (f) {
      bande.append(stat('PV', String(f.pv), 'Vie au niveau 1, sans objet. Vitesse ' + f.vitesse_m_s + ' m/s.', 'pv', 'obj-vitality'));
      if (f.arme && f.arme.dps != null) {
        bande.append(stat('DPS arme', String(Math.round(f.arme.dps)),
          f.arme.degats_balle + ' par balle' + (f.arme.balles_par_tir > 1 ? ' × ' + f.arme.balles_par_tir : '') + ', ' + f.arme.tirs_par_s +
          ' tirs/s, chargeur ' + f.arme.chargeur + ', niveau 1', 'dps', 'obj-weapon'));
      }
      if (f.arme && f.arme.degats_pleins_jusqu_a_m != null) {
        bande.append(stat('Portée', f.arme.degats_pleins_jusqu_a_m + ' m', 'Pleins dégâts jusqu\'à ' + f.arme.degats_pleins_jusqu_a_m +
          ' m (un dash = 10 m), moins au-delà', 'portee'));
      }
    }
    if (bande.childNodes.length) droite.append(bande);
    b.append(droite);
    return b;
  }

  // ---------- onglet Aperçu ----------

  // « Comment je le joue » : où, quoi faire, à éviter. La source va en pied de bloc.
  function blocJouer(h) {
    const roles = rolesDe(h.id);
    if (!roles.length) return null;
    const c = el('section', 'bloc jouer');
    const t = el('h2', null, 'Comment le jouer');
    c.append(t);
    roles.forEach((r, i) => {
      if (i > 0 && DLN.niveau() < 2) return;
      if (roles.length > 1 && DLN.niveau() >= 2) c.append(el('h3', null, r.nom));
      const dl = el('dl', 'jouer-lignes');
      const ligne = (libelle, texte) => { dl.append(el('dt', null, libelle), el('dd', null, texte)); };
      ligne('Où', r.place);
      ligne('Quoi faire', r.quoi_faire);
      ligne('À éviter', r.a_eviter.join(' '));
      if (DLN.niveau() >= 2) {
        ligne('Objectifs', r.objectifs);
        ligne('Puissance', 'début ' + r.puissance.debut + ', milieu ' + r.puissance.milieu + ', fin ' + r.puissance.fin + '.');
      }
      c.append(dl);
    });
    const src = el('p', 'source', 'Rôle ' + roles[0].nom + ' : avis de joueur (vidéo de Wouks), pas une donnée du jeu. ');
    const a = el('a', null, 'Fiche du rôle');
    a.href = 'roles.html#' + roles[0].id;
    src.append(a);
    c.append(src);
    return c;
  }

  // Winrate selon la durée de la partie : fort tôt ou tard ? (rythme, data/tempo.json)
  function blocDurees(h) {
    const t = ((D.tempo || {}).tranches || {})[DLN.tranche()];
    const d = t && t[String(h.id)] && t[String(h.id)].durees;
    if (!d || !d.length) return null;
    const c = el('section', 'bloc');
    c.append(el('h2', null, 'Fort tôt ou tard ?'));
    const table = el('table', 'table');
    d.forEach((x) => {
      const tr = el('tr');
      const libelle = x.a_min == null ? 'plus de ' + x.de_min + ' min' : (x.de_min === 0 ? 'moins de ' + x.a_min + ' min' : x.de_min + ' à ' + x.a_min + ' min');
      const v = el('td', 'nombre' + (x.winrate - x.marge > 50 ? ' haut' : x.winrate + x.marge < 50 ? ' bas' : ''), x.winrate.toFixed(1) + ' %');
      tr.append(el('td', null, 'Partie de ' + libelle), v, el('td', 'nombre doux', '± ' + x.marge.toFixed(1)),
        el('td', 'nombre doux', DLN.fmtNombre(x.parties) + ' parties'));
      table.append(tr);
    });
    c.append(table, el('p', 'source', 'Winrate selon la durée de la partie (' + DLN.LIBELLES_TRANCHE[DLN.tranche()] +
      '). S\'il monte avec la durée, le héros est meilleur en fin de partie. Un écart plus petit que la marge ne veut rien dire.'));
    return c;
  }

  function blocWinrate(h) {
    const c = el('section', 'bloc');
    c.append(el('h2', null, 'Tier et winrate'));
    const table = el('table', 'table');
    Object.keys(D.stats.tranches).forEach((cle) => {
      const s = statDe(h.id, cle);
      if (!s) return;
      const tr = el('tr', cle === DLN.tranche() ? 'courante' : null);
      const t = DLN.tier(s);
      tr.append(el('td', null, DLN.LIBELLES_TRANCHE[cle] || cle), el('td', 'tier-cellule tier-' + t.lettre, t.lettre), el('td', 'nombre', s.winrate.toFixed(1) + ' %'),
        el('td', 'nombre doux', '± ' + s.marge.toFixed(1)), el('td', 'nombre doux', DLN.fmtNombre(s.parties) + ' parties'));
      table.append(tr);
    });
    const lien = el('a', null, 'Tier list complète');
    lien.href = 'tiers.html';
    const src = el('p', 'source', 'Depuis le ' + D.stats.meta.depuis + '. Ta tranche est en surbrillance (menu ⚙). Tier : S/A au-dessus de 50 % même avec la marge, C/D en dessous, B dans la moyenne. Ça dit si le héros gagne souvent, pas s\'il te convient. ');
    src.append(lien);
    c.append(table, src);
    return c;
  }

  function blocAstuces(h, titre) {
    const fiche = D.counters.heros[String(h.id)];
    if (!fiche || !fiche.astuces || !fiche.astuces.length) return null;
    const c = el('section', 'bloc');
    c.append(el('h2', null, titre));
    const ul = el('ul', 'liste-points');
    fiche.astuces.forEach((a) => ul.append(el('li', null, a)));
    c.append(ul);
    return c;
  }

  function ongletApercu(h) {
    const zone = el('div', 'deux-colonnes');
    const g = el('div', 'colonne');
    const d = el('div', 'colonne');

    const jouer = blocJouer(h);
    if (jouer) g.append(jouer);
    const style = el('details', 'bloc description');
    style.append(el('summary', null, 'Description officielle du jeu'), el('p', 'texte-anglais', h.style_de_jeu_fr || h.style_de_jeu));
    style.open = !jouer;
    g.append(style);

    const menaces = menacesDe(h.id);
    if (menaces.length) {
      const c = el('section', 'bloc dangers');
      c.append(el('h2', null, 'Ses dangers'));
      const ul = el('ul', 'liste-points');
      menaces.forEach((m) => {
        const li = el('li');
        li.append(el('strong', null, D.counters.menaces[m.id].nom + ' : '), m.pourquoi + '.');
        ul.append(li);
      });
      const lien = el('a', 'lien', 'Quoi acheter contre lui →');
      lien.href = '#h=' + h.id + '&o=contrer';
      lien.addEventListener('click', (e) => { e.preventDefault(); aller(h.id, 'contrer'); });
      c.append(ul, lien);
      d.append(c);
    }
    zone.append(g, d);
    return zone;
  }


  // ---------- bloc « Son arme » (en tête de l'onglet Compétences) ----------
  // Chiffres : data/armes.json (fichiers du jeu, via Data:HeroData.json du wiki). Lecture et notes : data/armes-conseils.json (avis).

  const virgule = (x, n) => (x == null ? '—' : Number(x).toLocaleString('fr-FR', { maximumFractionDigits: n == null ? 1 : n }));
  const LIBELLES_SPIRIT = {
    ClipSize: 'taille du chargeur', BulletDamage: 'dégâts par balle', DPS: 'DPS', RoundsPerSecond: 'tirs par seconde', FireRate: 'cadence de tir',
    HeavyMeleeDamage: 'mêlée lourde', MaxMoveSpeed: 'vitesse de course', SprintSpeed: 'vitesse de sprint', BulletResist: 'résistance aux balles',
    TechResist: 'résistance spirit', BaseHealthRegen: 'régénération de vie'
  };

  // Rang du héros parmi ceux du site (1 = le plus haut ; `bas` : la plus petite valeur est la meilleure).
  function rang(id, lire, bas) {
    const valeurs = D.heros.heros.map((x) => ({ id: x.id, v: D.armes.armes[String(x.id)] ? lire(D.armes.armes[String(x.id)]) : null }))
      .filter((x) => x.v != null).sort((a, b) => (bas ? a.v - b.v : b.v - a.v));
    const i = valeurs.findIndex((x) => x.id === id);
    if (i === -1) return null;
    // À égalité, même rang : celui du premier de la série.
    const r = valeurs.findIndex((x) => x.v === valeurs[i].v) + 1;
    return { r: r, n: valeurs.length };
  }

  function chiffreArme(libelle, valeur, explication, rg) {
    const d = el('div', 'arme-chiffre');
    d.append(el('span', 'arme-chiffre-nom', libelle), el('span', 'arme-chiffre-valeur', valeur));
    if (explication) d.append(el('span', 'arme-chiffre-aide', explication));
    if (rg) {
      const barre = el('span', 'arme-rang');
      const jauge = el('span', 'arme-rang-jauge');
      const plein = el('span', 'arme-rang-plein');
      plein.style.width = Math.round(100 * (rg.n - rg.r + 1) / rg.n) + '%';
      jauge.append(plein);
      barre.append(jauge, el('span', 'arme-rang-texte', rg.r + (rg.r === 1 ? 'er' : 'e') + ' sur ' + rg.n));
      barre.title = 'Classement parmi les ' + rg.n + ' héros (1er = le meilleur)';
      d.append(barre);
    }
    return d;
  }

  function regleVraie(si, a, p) {
    const vrai = {
      peut_crit: (v) => p.peut_crit === v,
      vitesse_max: (v) => p.vitesse_balle_m_s != null && p.vitesse_balle_m_s < v,
      gravite_min: (v) => (p.gravite || 0) >= v,
      plusieurs_balles: (v) => (p.balles_par_tir > 1) === v,
      touche_une_fois: (v) => p.touche_une_fois === v,
      vider_max: (v) => p.vider_chargeur_s != null && p.vider_chargeur_s <= v,
      vider_min: (v) => p.vider_chargeur_s != null && p.vider_chargeur_s >= v,
      rechargement_min: (v) => p.rechargement_s >= v,
      balle_par_balle: (v) => p.rechargement_balle_par_balle === v,
      montee: (v) => Boolean(p.tirs_par_s_max) === v,
      explosion_min: (v) => (p.rayon_explosion_m || 0) >= v,
      secondaire: (v) => Boolean(a.secondaire) === v
    };
    return Object.keys(si).every((k) => vrai[k] && vrai[k](si[k]));
  }

  const multCrit = (a) => 1.65 + (a.bonus_crit_pct || 0) / 100;

  function remplirRegle(t, a, p) {
    return t.replace('{crit}', virgule(multCrit(a), 2)).replace('{vitesse}', virgule(p.vitesse_balle_m_s, 0))
      .replace('{balles}', String(p.balles_par_tir)).replace('{vider}', virgule(p.vider_chargeur_s))
      .replace('{rechargement}', virgule(p.rechargement_s, 2)).replace('{montee}', virgule(p.montee_cadence_s))
      .replace('{explosion}', virgule(p.rayon_explosion_m));
  }

  // Les chiffres d'un mode de tir ; `rangs` seulement pour le tir principal.
  function chiffresTir(h, a, p, rangs) {
    const g = el('div', 'arme-chiffres');
    const dash = 10;   // dash au sol : 10 m pour tous les héros (data/heros-details.json, données du jeu)
    const rg = (lire, bas) => (rangs ? rang(h.id, lire, bas) : null);
    g.append(
      chiffreArme('DPS', virgule(p.dps), 'dégâts par seconde en tirant sans t\'arrêter, sans objet' + (p.tirs_par_s_max ? ', à pleine cadence' : ''), rg((x) => x.principal.dps)),
      chiffreArme('DPS en continu', virgule(p.dps_soutenu), 'en comptant les rechargements : ce que tu fais sur un long combat', rg((x) => x.principal.dps_soutenu)),
      chiffreArme('Dégâts par chargeur', virgule(p.degats_chargeur, 0), 'si toutes les balles touchent, sans tir à la tête', rg((x) => x.principal.degats_chargeur)),
      chiffreArme('Chargeur', p.chargeur + (p.munitions_par_tir > 1 ? ' munitions' : ' tirs'),
        'vidé en ' + virgule(p.vider_chargeur_s) + ' s de tir continu' + (p.munitions_par_tir > 1 ? ', ' + p.munitions_par_tir + ' munitions par tir' : ''), rg((x) => x.principal.vider_chargeur_s)),
      chiffreArme('Rechargement', virgule(p.rechargement_s, 2) + ' s' + (p.rechargement_balle_par_balle ? ' par balle' : ''),
        p.rechargement_balle_par_balle ? 'recharge une balle à la fois' : 'chargeur complet', p.rechargement_balle_par_balle ? null : rg((x) => (x.principal.rechargement_balle_par_balle ? null : x.principal.rechargement_s), true)),
      chiffreArme('Portée', '≤ ' + virgule(p.degats_pleins_jusqu_a_m, 0) + ' m',
        'pleins dégâts jusqu\'à ' + virgule(p.degats_pleins_jusqu_a_m / dash) + ' dash' + (p.degats_pleins_jusqu_a_m / dash >= 2 ? 'es' : '') +
        ', puis ça baisse jusqu\'à ' + virgule(p.degats_minimum_pct, 0) + ' % des dégâts dès ' + virgule(p.degats_minimum_des_m, 0) + ' m', rg((x) => x.principal.degats_pleins_jusqu_a_m)),
      chiffreArme('Tir à la tête', p.peut_crit ? '×' + virgule(multCrit(a), 2) : 'aucun bonus',
        p.peut_crit ? 'dégâts sur la tête des héros et des Troopers' : 'pas de dégâts critiques à la tête', null),
      chiffreArme('Vitesse des balles', virgule(p.vitesse_balle_m_s, 0) + ' m/s',
        p.vitesse_balle_m_s < 300 ? 'lente : il faut viser devant une cible qui bouge' : p.vitesse_balle_m_s < 600 ? 'moyenne' : 'rapide : touche presque instantanément', rg((x) => x.principal.vitesse_balle_m_s))
    );
    return g;
  }

  function detailsTir(p) {
    const ul = el('ul', 'arme-details-liste');
    const ligne = (nom, valeur) => { const li = el('li'); li.append(el('span', null, nom), el('strong', null, valeur)); ul.append(li); };
    ligne('Dégâts par balle', virgule(p.degats_balle, 2) + (p.balles_par_tir > 1 ? ' × ' + p.balles_par_tir + ' balles par tir' + (p.touche_une_fois ? ' (comptés une fois)' : '') : ''));
    ligne('Tirs par seconde', virgule(p.tirs_par_s, 2) + (p.tirs_par_s_max ? ' → ' + virgule(p.tirs_par_s_max, 2) + ' après ' + virgule(p.montee_cadence_s) + ' s de tir' : ''));
    if (p.tirs_par_rafale > 1) ligne('Rafale', p.tirs_par_rafale + ' balles par pression');
    if (p.gravite) ligne('Chute des balles', 'gravité ×' + virgule(p.gravite, 2));
    if (p.rayon_explosion_m) ligne('Explosion', 'rayon ' + virgule(p.rayon_explosion_m) + ' m');
    if (p.vitesse_en_tirant_pct != null) ligne('Vitesse en tirant', p.vitesse_en_tirant_pct + ' % de ta vitesse');
    return ul;
  }

  function blocArme(h) {
    const a = D.armes && D.armes.armes[String(h.id)];
    if (!a) return null;
    const C = D.armesConseils;
    const p = a.principal;
    const s = el('section', 'arme');
    const tete = el('div', 'arme-tete');
    const titre = el('h3', null, 'Son arme · ');
    titre.append(nomBilingue(a.nom_fr, a.nom));
    tete.append(titre);
    const types = el('div', 'arme-types');
    a.types.forEach((t) => {
      const def = C && C.types[t];
      const puce = el('span', 'puce arme-type', def ? def.nom : t);
      if (def) puce.title = def.texte;
      types.append(puce);
    });
    tete.append(types);
    s.append(tete, chiffresTir(h, a, p, true));

    // Comment s'en servir : sens des étiquettes du jeu, règles de lecture, notes du héros.
    if (C) {
      const conseils = el('div', 'arme-conseils');
      const titreC = el('h4', null, 'Comment t\'en servir');
      const ul = el('ul');
      a.types.forEach((t) => { const def = C.types[t]; if (def) { const li = el('li'); li.append(el('strong', null, def.nom + ' : '), def.texte); ul.append(li); } });
      C.regles.filter((r) => regleVraie(r.si, a, p)).forEach((r) => ul.append(el('li', null, remplirRegle(r.texte, a, p))));
      const notes = C.notes[String(h.id)] || [];
      notes.forEach((n) => {
        const li = el('li', 'arme-note');
        li.append(n.texte, ' ', el('span', 'arme-source', n.source));
        ul.append(li);
      });
      conseils.append(titreC, ul, el('p', 'source', 'Avis de joueur appuyé sur les chiffres du jeu (data/armes-conseils.json).'));
      s.append(conseils);
    }

    // Tir secondaire : visible, il change la façon de jouer.
    if (a.secondaire) {
      const sec = el('div', 'arme-secondaire');
      sec.append(el('h4', null, 'Tir secondaire' + (a.secondaire.nom && a.secondaire.nom !== a.nom ? ' · ' + a.secondaire.nom : '')));
      const q = a.secondaire;
      const ligne = el('p');
      ligne.append(virgule(q.degats_balle) + ' dégâts par tir' + (q.balles_par_tir > 1 ? ' × ' + q.balles_par_tir : '') + ', ' +
        virgule(q.tirs_par_s, 2) + ' tir/s, DPS ' + virgule(q.dps) + ' (' + virgule(q.dps_soutenu) + ' en continu), ' +
        (q.munitions_par_tir > 1 ? q.munitions_par_tir + ' munitions par tir, ' : '') + 'pleins dégâts ≤ ' + virgule(q.degats_pleins_jusqu_a_m, 0) + ' m, balles à ' +
        virgule(q.vitesse_balle_m_s, 0) + ' m/s' + (q.rayon_explosion_m ? ', explosion de ' + virgule(q.rayon_explosion_m) + ' m' : '') +
        (q.peut_crit ? '' : ', pas de bonus à la tête') + '.');
      sec.append(ligne);
      s.append(sec);
    }

    // Plus de détails : le reste des chiffres, la progression, la mêlée.
    const plus = el('details', 'arme-plus');
    plus.append(el('summary', null, 'Plus de détails : balles, cadence, progression'));
    plus.append(detailsTir(p));
    const prog = el('ul', 'arme-details-liste');
    const ligne = (nom, valeur) => { const li = el('li'); li.append(el('span', null, nom), el('strong', null, valeur)); prog.append(li); };
    const n = a.par_niveau;
    if (n.degats_balle) ligne('À chaque niveau', '+' + virgule(n.degats_balle, 3) + ' dégât par balle (+' + virgule(n.dps, 2) + ' DPS)');
    Object.keys(a.par_spirit || {}).filter((k) => k !== 'HeavyMeleeDamage').forEach((k) => ligne('Grandit avec le Spirit Power', (LIBELLES_SPIRIT[k] || k) + ' (coefficient ' + virgule(a.par_spirit[k], 3) + ' dans les données du jeu)'));
    plus.append(prog);
    if (a.secondaire) { plus.append(el('h4', null, 'Tir secondaire')); plus.append(detailsTir(a.secondaire)); }
    s.append(plus);
    s.append(el('p', 'source', 'Chiffres du jeu au niveau 1, sans objet (' + D.armes.meta.source + ', patch ' + D.armes.meta.patch +
      '). Tir à la tête : ×1,65 pour tous, moins un malus propre à certains héros (page Weapon Damage du wiki). Classements parmi les ' +
      D.heros.heros.length + ' héros.'));
    return s;
  }

  // ---------- bloc « Corps à corps » (sous l'arme) ----------
  // Chiffres : data/armes.json. Verdict : builds publics (data/builds.json) et achats (data/achats.json) ;
  // textes et règles : data/armes-conseils.json, section `melee`.

  function blocMelee(h) {
    const a = D.armes && D.armes.armes[String(h.id)];
    const M = D.armesConseils && D.armesConseils.melee;
    if (!a || !M || !a.melee.lourd) return null;
    const s = el('section', 'arme melee');
    const tete = el('div', 'arme-tete');
    tete.append(el('h3', null, 'Corps à corps'));

    // Builds publics qui prennent au moins 2 objets de mêlée.
    const builds = ((D.builds && D.builds.heros[String(h.id)]) || []);
    const nbMelee = builds.filter((b) => b.sections.reduce((n, sec) => n + sec.objets.filter((o) => M.objets.indexOf(o) !== -1).length, 0) >= 2).length;
    const verdict = builds.length ? M.verdicts.find((v) => nbMelee >= v.min_builds) : null;
    if (verdict) {
      const puce = el('span', 'puce melee-verdict' + (verdict.min_builds >= 2 ? ' fort' : ''), verdict.nom);
      tete.append(puce);
    }
    s.append(tete);

    const g = el('div', 'arme-chiffres');
    const p = a.principal;
    g.append(
      chiffreArme('Coup léger', String(a.melee.leger), 'instantané (appui court)', rang(h.id, (x) => x.melee.leger)),
      chiffreArme('Coup lourd', String(a.melee.lourd), 'touche maintenue : préparation puis bond', rang(h.id, (x) => x.melee.lourd)),
      chiffreArme('Lourd contre ton arme', '= ' + virgule(a.melee.lourd / p.dps) + ' s de tir', 'un coup lourd vaut autant que ' + virgule(a.melee.lourd / p.dps) + ' s de tir continu de ton arme',
        rang(h.id, (x) => x.melee.lourd / x.principal.dps)),
      chiffreArme('À chaque niveau', '+' + virgule(a.par_niveau.melee_lourd, 1), 'au coup lourd (+' + virgule(a.par_niveau.melee_leger, 1) + ' au léger)' +
        (a.par_spirit && a.par_spirit.HeavyMeleeDamage ? ' ; grandit aussi avec le Spirit Power' : '') + ' ; les bonus de Weapon Damage comptent à moitié', null)
    );
    s.append(g);

    // Verdict et ce qui le fonde.
    if (verdict) {
      const d = el('div', 'arme-conseils');
      const t = el('h4', null, verdict.nom);
      const ul = el('ul');
      ul.append(el('li', null, verdict.texte));
      const combien = nbMelee === 0 ? 'Aucun des ' + builds.length + ' builds publics ne prend'
        : nbMelee === 1 ? '1 build public sur ' + builds.length + ' prend' : nbMelee + ' builds publics sur ' + builds.length + ' prennent';
      ul.append(el('li', 'melee-preuve', combien + ' au moins 2 objets de mêlée (' + M.objets.join(', ') + ').'));
      const tr = D.achats && (D.achats.tranches.tous || {})[String(h.id)];
      const achetes = tr ? tr.objets.filter((o) => M.objets.indexOf(o.nom) !== -1) : [];
      if (achetes.length) ul.append(el('li', 'melee-preuve', 'Ce que ses joueurs achètent : ' + achetes.map((o) => o.nom + ' ' + o.achete_par + ' %').join(', ') + '.'));
      (M.competences[String(h.id)] || []).forEach((c) => {
        const li = el('li');
        li.append(el('strong', null, c.nom + ' : '), c.texte);
        ul.append(li);
      });
      d.append(t, ul, el('p', 'source', 'Avis tiré des builds publics et des achats de ses joueurs.'));
      s.append(d);
    }

    // Règles communes à tous les héros, dépliables.
    const plus = el('details', 'arme-plus');
    plus.append(el('summary', null, 'Les règles du corps à corps (léger, lourd, parade)'));
    const ul = el('ul', 'melee-regles');
    M.regles.forEach((r) => { const li = el('li'); li.append(r.texte, ' ', el('span', 'arme-source', 'wiki, ' + r.source)); ul.append(li); });
    plus.append(ul);
    s.append(plus);
    return s;
  }

  // ---------- onglet Compétences ----------

  // Nom français du jeu, suivi du nom anglais (celui des guides et vidéos) en italique.
  function nomBilingue(fr, en) {
    const f = document.createDocumentFragment();
    f.append(fr || en);
    if (fr && en && fr !== en) f.append(' ', el('em', 'nom-anglais', '(' + en + ')'));
    return f;
  }

  // Pas de vidéo dans l'API ni sur le wiki : on renvoie vers une recherche de démonstrations.
  function lienDemo(h, c) {
    const a = el('a', 'lien-demo');
    a.append(DLN.icone('play'), 'Voir une démo');
    a.href = 'https://www.youtube.com/results?search_query=' + encodeURIComponent('Deadlock ' + h.nom + ' ' + c.nom);
    a.target = '_blank';
    a.rel = 'noopener';
    a.title = 'Recherche YouTube « Deadlock ' + h.nom + ' ' + c.nom + ' » (nouvel onglet)';
    return a;
  }

  function ongletCompetences(h) {
    const zone = el('div', 'competences');
    h.competences.forEach((c) => {
      const carte = el('article', 'competence');
      carte.append(DLN.img(c.image, 'competence-icone'));
      const corps = el('div');
      const nom = el('h4');
      nom.append(el('span', 'competence-touche', c.touche === 4 ? 'Ultime' : String(c.touche)), nomBilingue(c.nom_fr, c.nom));
      if (c.recharge_s) { const r = el('span', 'competence-recharge'); r.append(DLN.icone('timer'), c.recharge_s + ' s'); r.title = 'Temps de recharge'; nom.append(r); }
      if (c.canalisee) nom.append(el('span', 'marque', 'canalisée : un stun l\'interrompt'));
      corps.append(nom, el('p', 'competence-resume', c.resume_fr || c.resume));
      // Quelques compétences n'ont pas de texte dans l'API (Rake de Mina) : pas de paragraphe vide.
      if (c.description_fr || c.description) corps.append(el('p', null, c.description_fr || c.description));
      if (DLN.niveau() >= 2 && c.valeurs.length) {
        const v = el('div', 'valeurs');
        c.valeurs.forEach((x) => {
          const s = el('span', 'valeur', x.nom + ' ');
          s.append(el('strong', null, x.valeur));
          v.append(s);
        });
        corps.append(v);
      }
      const amel = (c.ameliorations_fr && c.ameliorations_fr.length) ? c.ameliorations_fr : c.ameliorations;
      if (DLN.niveau() >= 2 && amel.length) {
        const ol = el('ol', 'ameliorations');
        amel.forEach((a) => ol.append(el('li', null, a)));
        corps.append(ol);
      }
      corps.append(lienDemo(h, c));
      carte.append(corps);
      zone.append(carte);
    });
    const boite = el('div', 'fiche-contenu');
    boite.append(zone);
    boite.append(el('p', 'source', 'Textes officiels du jeu en français. Noms des valeurs en anglais.' +
      (DLN.niveau() < 2 ? ' Valeurs et améliorations : niveau 2 ou plus (menu ⚙).' : '') +
      ' Les démos sont des recherches YouTube : aucune vidéo officielle n\'est disponible par l\'API.'));
    // L'arme et le corps à corps viennent après les compétences.
    const arme = blocArme(h);
    if (arme) boite.append(arme);
    const melee = blocMelee(h);
    if (melee) boite.append(melee);
    return boite;
  }

  // ---------- onglet Le contrer ----------

  function ligneObjet(o) {
    const fiche = objets[o.nom] || { nom: o.nom };
    const sous = el('span', 'objet-carte-sous');
    if (o.quand) sous.append(el('span', 'objet-quand', o.quand + ' '));
    const explication = (D.counters.objets[o.nom] || {}).explication;
    if (explication) sous.append(explication);
    if (DLN.niveau() >= 3 && fiche.description) sous.append(el('span', 'objet-description', fiche.description));
    return DLN.objetCarte(fiche, sous.childNodes.length ? sous : null, null, 'li');
  }

  function groupesObjets(liste) {
    const boite = el('div', 'objets-groupes');
    ORDRE_CATEGORIES.forEach((categorie) => {
      const ici = liste.filter((o) => ((objets[o.nom] || {}).categorie || 'autre') === categorie);
      if (!ici.length) return;
      const groupe = el('div', 'objets-groupe ' + categorie);
      const t = el('h4', null);
      t.append(el('i', 'carre'), LIBELLES_CATEGORIE[categorie] || 'Autres');
      groupe.append(t);
      const ul = el('ul', 'objets-cartes');
      ici.forEach((o) => ul.append(ligneObjet(o)));
      groupe.append(ul);
      boite.append(groupe);
    });
    return boite;
  }

  function porteeTexte(a) {
    // Repère en jeu : un dash au sol fait 10 m (data/heros-details.json, dash_sol_m).
    const dash = (m) => ' (≈ ' + (Math.round(m / 10 * 10) / 10).toLocaleString('fr-FR') + ' dash' + (m >= 20 ? 'es' : '') + ')';
    if (!a.chute_degats_pct) {
      return 'Ses dégâts d\'arme ne baissent pas avec la distance' +
        (a.portee_max_m && a.portee_max_m < 100 ? ', mais ne touchent plus au-delà de ' + a.portee_max_m + ' m.' : '.');
    }
    return 'Pleins dégâts jusqu\'à ' + a.degats_pleins_jusqu_a_m + ' m' + dash(a.degats_pleins_jusqu_a_m) + ', puis ils baissent jusqu\'à perdre ' + (-a.chute_degats_pct) +
      ' % à ' + a.degats_minimum_des_m + ' m. Plus loin que ' + a.degats_minimum_des_m + ' m, tu ne prends que ' +
      (100 + a.chute_degats_pct) + ' % de ses dégâts d\'arme.';
  }

  // Lecture en deux temps : un résumé d'une ligne par menace avec l'objet le moins cher qui y répond,
  // puis le détail de chaque menace, replié.
  function ongletContrer(h) {
    const zone = el('div', 'fiche-contenu');
    const menaces = menacesDe(h.id).filter((m) => D.counters.menaces[m.id].niveau <= DLN.niveau());
    if (!D.counters.heros[String(h.id)]) zone.append(el('p', 'vide', 'Héros pas encore classé dans data/counters.json.'));

    if (menaces.length) {
      const resume = el('section', 'contrer-resume');
      resume.append(el('h2', null, 'En bref : le moins cher qui répond'));
      const ul = el('ul', 'contrer-lignes');
      // Une ligne par réponse : les menaces qui mènent au même objet sont fusionnées.
      const lignes = [];
      menaces.forEach((m) => {
        const menace = D.counters.menaces[m.id];
        const premier = menace.objet_direct === false ? null : menace.objets.slice().sort(parPrix)[0];
        const deja = premier && lignes.find((l) => l.objet && l.objet.nom === premier.nom);
        if (deja) deja.noms.push(menace.nom);
        else lignes.push({ noms: [menace.nom], objet: premier, menace: menace });
      });
      lignes.forEach((l) => {
        const li = el('li');
        li.append(el('strong', null, l.noms.join(', ')));
        if (l.objet) li.append(DLN.objetCarte(objets[l.objet.nom] || { nom: l.objet.nom }, l.objet.quand || null, (D.counters.objets[l.objet.nom] || {}).explication));
        else li.append(el('span', 'contrer-sans-objet', 'Pas d\'objet qui y répond. ' + l.menace.reponse.split(/(?<=\.) /).filter((p) => !/objet/i.test(p)).join(' ')));
        ul.append(li);
      });
      resume.append(ul);
      const f = (D.details.fiches || {})[String(h.id)];
      if (f && f.arme && f.arme.degats_pleins_jusqu_a_m != null) { const p = el('p', 'contrer-portee'); p.append(DLN.icone('crosshair'), porteeTexte(f.arme)); resume.append(p); }
      zone.append(resume);
    }

    menaces.forEach((m, i) => {
      const menace = D.counters.menaces[m.id];
      const carte = el('details', 'menace');
      carte.open = i === 0 && menaces.length <= 2;
      const titre = el('summary');
      const mt = el('span', 'menace-titre');
      mt.append(DLN.icone('chevron-down', 'chevron'), menace.nom);
      titre.append(mt);
      carte.append(titre, el('p', 'menace-pourquoi', m.pourquoi + '.'));
      const rep = el('p', 'menace-reponse');
      rep.append(el('strong', null, 'Réponse : '), menace.reponse);
      carte.append(rep);
      let liste = menace.objets.slice();
      if (DLN.niveau() === 1) liste = liste.sort(parPrix).slice(0, 2);
      if (liste.length) carte.append(groupesObjets(liste));
      zone.append(carte);
    });
    const cachees = menacesDe(h.id).length - menaces.length;
    if (cachees > 0) zone.append(el('p', 'aide', cachees + ' menace' + (cachees > 1 ? 's' : '') + ' de plus au niveau supérieur (menu ⚙).'));
    const astuces = blocAstuces(h, 'À savoir');
    if (astuces) zone.append(astuces);
    return zone;
  }

  // ---------- onglet Builds ----------

  // Un achat : composant objet commun, avec la part des joueurs qui le prennent en jauge.
  function ligneAchat(o, details) {
    const sous = el('span', 'objet-carte-sous', details);
    const jauge = el('span', 'jauge-achat');
    const barre = el('span');
    barre.style.width = Math.min(100, o.achete_par) + '%';
    jauge.append(barre);
    sous.append(jauge);
    const fiche = Object.assign({}, o, { image: (objets[o.nom] || {}).image });
    return DLN.objetCarte(fiche, sous, (D.counters.objets[o.nom] || {}).explication, 'li');
  }

  // Builds publics du jeu : ceux qu'on trouve dans le navigateur de builds en jeu.
  function blocBuildsPublics(h, liste) {
    const c = el('section', 'bloc');
    c.append(el('h2', null, 'Builds publics les plus suivis'));
    liste.forEach((b) => c.append(detailsBuild(h, b, false)));
    c.append(el('p', 'source', 'Navigateur de builds du jeu : les plus mis en favori parmi ceux mis à jour depuis le ' + D.builds.meta.depuis +
      '. En jeu, cherche-les par leur nom. Textes des auteurs, souvent en anglais.'));
    return c;
  }

  // Un build (public ou importé) : en-tête, bouton « Suivre en partie », sections et objets.
  function detailsBuild(h, b, ouvert, retirable) {
      const d = el('details', 'build-public');
      d.open = ouvert;
      const s = el('summary');
      const suivi = DLN.builds && DLN.builds.suivi(h.id);
      const estSuivi = suivi && suivi.id === b.id;
      s.append(el('strong', null, b.nom), el('span', 'aide', ' · ' + DLN.fmtNombre(b.favoris || 0) + ' favoris · mis à jour le ' +
        new Date(b.mis_a_jour + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) + ' · n° ' + b.id));
      if (estSuivi) s.append(el('span', 'puce build-suivi', 'suivi en partie'));
      d.append(s);
      if (DLN.builds) {
        const actions = el('div', 'build-actions');
        const suivre = el('button', 'btn' + (estSuivi ? ' discret' : ' principal'), estSuivi ? 'Ne plus suivre' : 'Suivre en partie');
        suivre.type = 'button';
        suivre.title = estSuivi ? 'Le coach reviendra aux achats moyens des joueurs de ' + h.nom : 'Le coach En partie annoncera les objets de ce build, dans son ordre';
        suivre.addEventListener('click', () => DLN.builds.suivre(h.id, estSuivi ? null : b));
        actions.append(suivre);
        if (retirable) {
          const r = el('button', 'btn discret', 'Retirer');
          r.type = 'button';
          r.addEventListener('click', () => DLN.builds.retirer(b.id));
          actions.append(r);
        }
        d.append(actions);
      }
      if (b.description) d.append(el('p', 'texte-auteur', b.description));
      b.sections.forEach((sec) => {
        const ligne = el('div', 'build-section');
        const t = el('div', 'build-section-titre', sec.nom);
        if (sec.note) t.title = sec.note;
        const icones = el('div', 'build-objets');
        sec.objets.forEach((nom) => icones.append(DLN.objetCarte(objets[nom] || { nom: nom }, null, (D.counters.objets[nom] || {}).explication)));
        ligne.append(t, icones);
        d.append(ligne);
      });
      return d;
  }

  // Importer un build du jeu : numéro (navigateur de builds en jeu), lien qui le contient, ou nom.
  function blocImport(h) {
    const c = el('section', 'bloc build-import');
    c.append(el('h2', null, 'Importer un build du jeu'));
    const f = el('form', 'build-import-form');
    const champ = el('input');
    champ.type = 'text';
    champ.placeholder = 'Numéro, lien ou nom (ex. 414186)';
    champ.setAttribute('aria-label', 'Numéro, lien ou nom du build');
    const ok = el('button', 'btn', 'Chercher');
    ok.type = 'submit';
    const res = el('div', 'build-import-resultats');
    res.setAttribute('aria-live', 'polite');
    f.append(champ, ok);
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!champ.value.trim()) return;
      res.textContent = 'Recherche…';
      DLN.builds.chercher(champ.value, h.id).then((liste) => {
        res.textContent = '';
        if (!liste.length) { res.append(el('p', 'vide', 'Aucun build trouvé.')); return; }
        liste.forEach((b) => {
          const autre = b.heros !== h.id ? herosDe(b.heros) : null;
          const l = el('div', 'build-trouve');
          l.append(el('strong', null, b.nom), el('span', 'aide', ' · ' + (autre ? autre.nom + ' · ' : '') + DLN.fmtNombre(b.favoris) + ' favoris · n° ' + b.id));
          const imp = el('button', 'btn', 'Importer');
          imp.type = 'button';
          imp.addEventListener('click', () => { DLN.builds.importer(b); res.textContent = ''; champ.value = ''; });
          l.append(imp);
          res.append(l);
        });
      }).catch((err) => { res.textContent = ''; res.append(el('p', 'erreur', 'Recherche impossible (' + err.message + ').')); });
    });
    c.append(f, res, el('p', 'source', 'Le build reste dans ce navigateur. « Suivre en partie » le donne au coach.'));
    const miens = DLN.builds.liste(h.id);
    if (miens.length) {
      c.append(el('h3', null, 'Mes builds importés'));
      miens.forEach((b, i) => c.append(detailsBuild(h, b, i === 0, true)));
    }
    return c;
  }

  function ongletBuilds(h) {
    const zone = el('div', 'fiche-contenu');
    const tranche = D.achats.tranches[DLN.tranche()] ? DLN.tranche() : 'tous';
    const a = (D.achats.tranches[tranche] || {})[String(h.id)];
    // Gros achats (tempo.json : tier 3+, pris par 35 % ou plus) : marqués d'une étoile dans la grille.
    const t = ((D.tempo || {}).tranches || {});
    const trancheTempo = t[tranche] && t[tranche][String(h.id)] && (t[tranche][String(h.id)].objets_cles || []).length ? tranche : 'tous';
    const cles = (((t[trancheTempo] || {})[String(h.id)] || {}).objets_cles || []).map((o) => o.nom);
    if (a) {
      const c = el('section', 'bloc');
      c.append(el('h2', null, 'Ce que ses joueurs achètent'));
      const phases = el('div', 'builds-phases');
      PHASES.forEach((ph) => {
        const ici = a.objets.filter((o) => o.minute >= ph[2] && o.minute < ph[3]);
        const col = el('div', 'builds-phase');
        const total = ici.reduce((s, o) => s + o.cout, 0);
        const t = el('h3', null, ph[0]);
        t.append(el('span', 'aide', ph[1] + ' · ' + DLN.fmtNombre(total) + ' souls'));
        col.append(t);
        const ul = el('ul', 'objets-cartes');
        ici.forEach((o) => {
          const li = ligneAchat(o, 'vers ' + Math.round(o.minute) + ' min · ' + o.achete_par + ' %');
          if (cles.indexOf(o.nom) !== -1) {
            li.classList.add('gros-achat');
            li.querySelector('.objet-carte-nom').append(DLN.icone('star', 'etoile'));
            li.title += '\nGros achat : il monte en puissance quand il l\'a.';
          }
          ul.append(li);
        });
        col.append(ul);
        phases.append(col);
      });
      c.append(phases, el('p', 'source', 'Objets pris par au moins 20 % des joueurs de ' + h.nom + ' (' + DLN.fmtNombre(a.parties) + ' parties, ' +
        DLN.LIBELLES_TRANCHE[tranche] + ', depuis le ' + D.achats.meta.depuis + '), à leur minute moyenne d\'achat. La barre : part des joueurs qui le prennent. Étoile : gros achat (tier 3 ou plus, pris par 35 % ou plus), le moment où il monte en puissance.'));
      zone.append(c);
    }
    const publics = ((D.builds || {}).heros || {})[String(h.id)] || [];
    if (publics.length) zone.append(blocBuildsPublics(h, publics));
    if (DLN.builds) zone.append(blocImport(h));
    if (!a && !cles.length && !publics.length) zone.append(el('p', 'vide', 'Pas de données d\'achats pour ce héros.'));
    else if (!a) zone.append(el('p', 'aide', 'Le build complet par phase n\'est récupéré que pour les héros du profil (joués et à essayer).'));
    return zone;
  }

  // ---------- onglet Matchups ----------

  function ligneMatchup(m, sens) {
    const h = herosDe(m.contre);
    const signal = Math.abs(m.ecart) > m.marge;
    const li = el('li', 'matchup' + (signal ? ' signal' : ''));
    li.append(DLN.img(h && (h.icone || h.image)));
    const corps = el('div');
    const tete = el('div', 'matchup-tete');
    const nom = el('a', null, h ? h.nom : '#' + m.contre);
    nom.href = '#h=' + m.contre;
    nom.addEventListener('click', (e) => { e.preventDefault(); aller(m.contre, 'apercu'); });
    const ecart = sens === 'perd' ? -m.ecart : m.ecart;
    tete.append(nom, el('span', 'matchup-ecart', (ecart > 0 ? '+' : '') + ecart.toFixed(1) + ' pts'),
      el('span', 'doux petit', '± ' + m.marge.toFixed(1) + ' · ' + DLN.fmtNombre(m.parties) + ' parties'));
    corps.append(tete);
    const menaces = menacesDe(m.contre);
    if (menaces.length) corps.append(el('span', 'matchup-pourquoi', 'Ce qu\'il fait : ' + menaces.map((x) => D.counters.menaces[x.id].nom.toLowerCase()).join(', ')));
    li.append(corps);
    return li;
  }

  function ongletMatchups(h) {
    const zone = el('div', 'fiche-contenu');
    const stats = el('div', 'deux-colonnes');
    stats.append(blocWinrate(h));
    const durees = blocDurees(h);
    if (durees) stats.append(durees);
    zone.append(stats);
    const m = ((D.details.matchups || {})[DLN.tranche()] || {})[String(h.id)];
    if (!m) {
      zone.append(el('p', 'vide', 'Pas assez de parties pour ce héros dans cette tranche de rang.'));
      return zone;
    }
    zone.append(el('h2', 'titre-section', 'Matchups'));
    const colonnes = el('div', 'matchups-colonnes');
    [['perd', 'Le battent', (x) => x.ecart < 0], ['bat', h.nom + ' les bat', (x) => x.ecart > 0]].forEach((c) => {
      const col = el('section', 'bloc');
      col.append(el('h3', null, c[1]));
      const surs = m[c[0]].filter((x) => c[2](x) && Math.abs(x.ecart) > x.marge).slice(0, NB_MATCHUPS);
      if (!surs.length) col.append(el('p', 'vide', 'Aucun écart sûr dans cette tranche.'));
      else {
        const ul = el('ul', 'matchups-liste');
        surs.forEach((x) => ul.append(ligneMatchup(x, c[0])));
        col.append(ul);
      }
      colonnes.append(col);
    });
    zone.append(colonnes, el('p', 'source', 'Statistiques ' + DLN.LIBELLES_TRANCHE[DLN.tranche()] + ' depuis le ' + D.details.meta.depuis +
      '. Écart = winrate réel contre ce héros moins le winrate attendu d\'après la force des deux ; seuls les écarts plus grands que la marge d\'erreur sont montrés (' +
      (m.signaux || 0) + ' sur ' + m.adversaires + '). Ce qu\'il faut acheter contre lui est dans « Le contrer ».'));
    return zone;
  }

  // ---------- onglet Patch ----------

  const SENS = { buffs: 'renforcé', nerfs: 'affaibli', ajustes: 'ajusté', corriges: 'bug corrigé' };

  function changementsDe(h) {
    const liste = [];
    D.patch.patchs.forEach((p) => {
      const lignes = (p.pour_toi || []).filter((t) => t.indexOf(h.nom + ' ') === 0 || t.indexOf(h.nom + ':') === 0);
      const sens = Object.keys(SENS).filter((s) => ((p.heros || {})[s] || []).indexOf(h.nom) !== -1);
      if (lignes.length || sens.length) liste.push({ p: p, lignes: lignes, sens: sens });
    });
    return liste;
  }

  function ongletPatch(h) {
    const zone = el('div', 'fiche-contenu');
    const liste = changementsDe(h);
    if (!liste.length) zone.append(el('p', 'vide', 'Pas de changement pour ' + h.nom + ' dans les patchs résumés (' +
      D.patch.patchs.map((p) => p.titre).join(', ') + ').'));
    liste.forEach((x) => {
      const c = el('section', 'bloc patch-ligne');
      const t = el('h3', null, null);
      const a = el('a', null, x.p.titre);
      a.href = x.p.lien;
      a.target = '_blank';
      a.rel = 'noopener';
      t.append(a);
      x.sens.forEach((s) => t.append(el('span', 'marque sens-' + s, SENS[s])));
      c.append(t, el('span', 'aide', new Date(x.p.date + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })));
      if (x.lignes.length) {
        const ul = el('ul', 'liste-points');
        x.lignes.forEach((l) => ul.append(el('li', null, l)));
        c.append(ul);
      } else {
        c.append(el('p', 'doux', 'Détail dans les notes officielles (lien).'));
      }
      zone.append(c);
    });
    return zone;
  }

  // ---------- fiche ----------

  const CONTENUS = {
    apercu: ongletApercu, competences: ongletCompetences, contrer: ongletContrer,
    builds: ongletBuilds, matchups: ongletMatchups, patch: ongletPatch
  };

  function afficherFiche() {
    const zone = document.getElementById('fiche');
    zone.textContent = '';
    const h = herosDe(reglages.choisi);
    if (!h) {
      zone.append(el('p', 'vide', 'Choisir un héros à gauche.'));
      return;
    }
    document.title = h.nom + ' · Héros · DeadLock_Noob';
    zone.append(bandeau(h));

    const barre = el('nav', 'fiche-onglets');
    barre.setAttribute('role', 'tablist');
    ONGLETS.forEach((o) => {
      const b = el('button', 'fiche-onglet', o[1]);
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(o[0] === onglet));
      if (o[0] === 'contrer') b.append(el('span', 'compte', String(menacesDe(h.id).filter((m) => D.counters.menaces[m.id].niveau <= DLN.niveau()).length)));
      if (o[0] === 'patch') { const n = changementsDe(h).length; if (n) b.append(el('span', 'compte', String(n))); }
      b.addEventListener('click', () => aller(h.id, o[0]));
      barre.append(b);
    });
    zone.append(barre);
    const contenu = el('div', 'fiche-contenu');
    contenu.setAttribute('role', 'tabpanel');
    contenu.append(CONTENUS[onglet](h));
    zone.append(contenu);
  }

  function afficher() {
    afficherListe();
    afficherFiche();
  }

  Promise.all([
    'data/heroes.json', 'data/hero-stats.json', 'data/roles.json', 'data/counters.json', 'data/items.json',
    'data/heros-details.json', 'data/achats.json', 'data/patch.json'
  ].map(DLN.charger).concat([DLN.charger('data/tempo.json').catch(() => null), DLN.profil,
    DLN.charger('data/builds.json').catch(() => null), DLN.etiquettes.pret,
    DLN.charger('data/armes.json').catch(() => null), DLN.charger('data/armes-conseils.json').catch(() => null)])).then((r) => {
    D = { heros: r[0], stats: r[1], roles: r[2], counters: r[3], details: r[5], achats: r[6], patch: r[7], tempo: r[8], builds: r[10],
      armes: r[12], armesConseils: r[13] };
    r[4].objets.forEach((o) => { objets[o.nom] = o; });
    profil = r[9];
    document.getElementById('app').hidden = false;
    document.getElementById('meta').textContent = 'Patch ' + D.heros.meta.patch + ' · stats depuis le ' + D.stats.meta.depuis +
      ' · un écart de winrate plus petit que la marge (±) n\'est pas un signal · menaces et objets : classés à la main d\'après le texte du jeu · rôles : avis de joueur';
    lireAdresse();
    if (!herosDe(reglages.choisi)) reglages.choisi = profil.heros_joues[0] || D.heros.heros[0].id;
    document.getElementById('recherche').addEventListener('input', afficherListe);
    document.getElementById('recherche').addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const premier = document.querySelector('#liste .heros-case');
      if (premier) premier.click();
    });
    document.getElementById('tous-heros').addEventListener('click', (e) => {
      const ouverte = document.querySelector('.choix-colonne').classList.toggle('ouverte');
      e.currentTarget.setAttribute('aria-expanded', String(ouverte));
    });
    window.addEventListener('hashchange', () => { lireAdresse(); afficher(); });
    afficher();
    DLN.surNiveau(afficher);
    DLN.surTranche(afficher);
    if (DLN.builds) DLN.builds.surChange(afficherFiche);
    DLN.etiquettes.surChange(afficherListe);
  }, DLN.echec);
})();
