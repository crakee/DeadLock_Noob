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
    ['builds', 'Builds'], ['matchups', 'Matchups'], ['patch', 'Patch']
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

  function caseHeros(h) {
    const b = el('button', 'heros-case' + (h.id === reglages.choisi ? ' choisi' : '') + (estMien(h.id) ? ' mien' : ''));
    b.type = 'button';
    b.title = h.nom;
    b.append(DLN.img(h.icone || h.image), el('span', null, h.nom), DLN.etiquettes.pastilles(h.id));
    b.addEventListener('click', () => { aller(h.id); window.scrollTo({ top: 0 }); });
    return b;
  }

  function afficherListe() {
    const zone = document.getElementById('liste');
    const filtre = document.getElementById('recherche').value.trim().toLowerCase();
    zone.textContent = '';
    const garde = (h) => !filtre || h.nom.toLowerCase().indexOf(filtre) !== -1;
    // Un groupe par étiquette personnelle en usage (« joué », « me casse »…), puis les rôles.
    const parEtiquette = DLN.etiquettes.enUsage().map((t) => ({
      nom: t.charAt(0).toUpperCase() + t.slice(1), heros: DLN.etiquettes.avec(t).map(herosDe).filter((h) => h && garde(h))
    }));
    const groupes = parEtiquette.concat(DLN.grouperParRole(D.heros.heros.filter(garde), D.roles));
    groupes.forEach((g) => {
      if (!g.heros.length) return;
      zone.append(el('h3', 'grille-role', g.nom));
      const grille = el('div', 'heros-grille');
      g.heros.forEach((h) => grille.append(caseHeros(h)));
      zone.append(grille);
    });
    if (!zone.childNodes.length) zone.append(el('p', 'vide', 'Aucun héros ne correspond.'));
  }

  // ---------- bandeau ----------

  function typeDegats(id) {
    const m = menacesDe(id).map((x) => x.id);
    const arme = m.indexOf('tir') !== -1, sorts = m.indexOf('sorts') !== -1;
    if (arme && sorts) return ['Arme et compétences', 'fort'];
    if (arme) return ['Dégâts surtout à l\'arme', 'weapon'];
    if (sorts) return ['Dégâts surtout spirit', 'spirit'];
    return null;
  }

  function stat(libelle, valeur, aide, classe) {
    const d = el('div', 'stat');
    d.append(el('span', 'stat-valeur' + (classe ? ' ' + classe : ''), valeur), el('span', 'stat-nom', libelle));
    if (aide) d.title = aide;
    return d;
  }

  function bandeau(h) {
    const b = el('header', 'bandeau');
    b.append(DLN.img(h.image || h.icone, 'bandeau-portrait'));
    const droite = el('div');
    const titre = el('div', 'bandeau-titre');
    const h1 = el('h1', null, h.nom);
    titre.append(h1);

    const actions = el('div', 'bandeau-actions');
    const enFace = lireEnFace();
    const dedans = enFace.indexOf(h.id) !== -1;
    const bouton = el('button', 'btn', dedans ? '✓ En face' : '+ En face');
    bouton.type = 'button';
    bouton.title = dedans ? 'Retirer des héros d\'en face (page En partie)' : 'Ajouter aux héros d\'en face (page En partie)';
    bouton.addEventListener('click', () => {
      const l = lireEnFace();
      const i = l.indexOf(h.id);
      if (i !== -1) l.splice(i, 1); else { if (l.length >= 6) l.shift(); l.push(h.id); }
      ecrireEnFace(l);
      afficherFiche();
    });
    const wiki = el('a', 'btn discret', 'Wiki ↗');
    wiki.href = h.wiki;
    wiki.target = '_blank';
    wiki.rel = 'noopener';
    actions.append(bouton, wiki);
    titre.append(actions);
    droite.append(titre, el('p', 'bandeau-accroche', h.role_fr || h.role), DLN.etiquettes.editeur(h.id));

    const puces = el('div', 'puces');
    rolesDe(h.id).forEach((r) => {
      const a = el('a', 'puce fort', r.nom);
      a.href = 'roles.html#' + r.id;
      a.title = 'Voir la fiche du rôle';
      puces.append(a);
    });
    const td = typeDegats(h.id);
    if (td) puces.append(el('span', 'puce ' + td[1], td[0]));
    if (h.arme) puces.append(el('span', 'puce', h.arme));
    puces.append(el('span', 'puce', 'Complexité ' + h.complexite + '/3'));
    droite.append(puces);

    const f = (D.details.fiches || {})[String(h.id)];
    const s = statDe(h.id, DLN.tranche());
    const bande = el('div', 'stats-bande');
    if (s && s.winrate != null) {
      bande.append(stat('Winrate', s.winrate.toFixed(1) + ' %',
        '± ' + s.marge.toFixed(1) + ' points · ' + DLN.LIBELLES_TRANCHE[DLN.tranche()] + ' · ' + DLN.fmtNombre(s.parties) + ' parties',
        s.winrate - s.marge > 50 ? 'haut' : (s.winrate + s.marge < 50 ? 'bas' : '')));
    }
    if (f) {
      bande.append(stat('PV de départ', String(f.pv), 'Vie au niveau 1, sans objet'));
      if (f.arme && f.arme.dps != null) {
        bande.append(stat('DPS arme', String(Math.round(f.arme.dps)),
          f.arme.degats_balle + ' par balle' + (f.arme.balles_par_tir > 1 ? ' × ' + f.arme.balles_par_tir : '') + ', ' + f.arme.tirs_par_s + ' tirs/s, niveau 1'));
        bande.append(stat('Chargeur', String(f.arme.chargeur), 'Rechargement : ' + f.arme.rechargement_s + ' s'));
      }
      if (f.arme && f.arme.degats_pleins_jusqu_a_m != null) bande.append(stat('Pleins dégâts', '≤ ' + f.arme.degats_pleins_jusqu_a_m + ' m'));
      bande.append(stat('Vitesse', f.vitesse_m_s + ' m/s'));
    }
    droite.append(bande);
    b.append(droite);
    return b;
  }

  // ---------- onglet Aperçu ----------

  function carteRole(r) {
    const c = el('div', 'encadre');
    const t = el('h3', null, 'Rôle : ' + r.nom);
    t.append(el('span', 'marque', 'avis de joueur'));
    c.append(t);
    const ligne = (libelle, texte) => {
      const p = el('p', 'fiche-ligne');
      p.append(el('strong', null, libelle + ' '), texte);
      c.append(p);
    };
    ligne('Où :', r.place);
    ligne('Quoi faire :', r.quoi_faire);
    ligne('À éviter :', r.a_eviter.join(' '));
    if (DLN.niveau() >= 2) {
      ligne('Objectifs :', r.objectifs);
      ligne('Puissance :', 'début ' + r.puissance.debut + ', milieu ' + r.puissance.milieu + ', fin ' + r.puissance.fin + '.');
    }
    return c;
  }

  // Winrate selon la durée de la partie : fort tôt ou tard ?
  function blocDurees(h) {
    const t = ((D.tempo || {}).tranches || {})[DLN.tranche()];
    const d = t && t[String(h.id)] && t[String(h.id)].durees;
    if (!d || !d.length) return null;
    const c = el('div', 'encadre');
    c.append(el('h3', null, 'Fort tôt ou tard ?'));
    const table = el('table', 'table');
    d.forEach((x) => {
      const tr = el('tr');
      const libelle = x.a_min == null ? 'plus de ' + x.de_min + ' min' : (x.de_min === 0 ? 'moins de ' + x.a_min + ' min' : x.de_min + ' à ' + x.a_min + ' min');
      const v = el('td', 'nombre', x.winrate.toFixed(1) + ' %');
      if (x.winrate - x.marge > 50) v.style.color = 'var(--bon)';
      if (x.winrate + x.marge < 50) v.style.color = 'var(--danger)';
      tr.append(el('td', null, 'Partie de ' + libelle), v, el('td', 'nombre doux', '± ' + x.marge.toFixed(1)),
        el('td', 'nombre doux', DLN.fmtNombre(x.parties) + ' parties'));
      table.append(tr);
    });
    c.append(table, el('p', 'aide', 'Winrate selon la durée de la partie (' + DLN.LIBELLES_TRANCHE[DLN.tranche()] +
      '). S\'il monte avec la durée, le héros est meilleur en fin de partie. Un écart plus petit que la marge ne veut rien dire.'));
    return c;
  }

  function ongletApercu(h) {
    const zone = el('div', 'deux-colonnes');
    const g = el('div', 'fiche-contenu');
    const d = el('div', 'fiche-contenu');

    const style = el('div', 'encadre');
    const ts = el('h3', null, 'Style de jeu');
    ts.append(el('span', 'marque', 'description officielle du jeu'));
    style.append(ts, el('p', 'texte-anglais', h.style_de_jeu_fr || h.style_de_jeu));
    g.append(style);
    rolesDe(h.id).forEach((r, i) => { if (i === 0 || DLN.niveau() >= 2) g.append(carteRole(r)); });

    const fiche = D.counters.heros[String(h.id)];
    const menaces = menacesDe(h.id);
    if (menaces.length) {
      const c = el('div', 'encadre danger');
      c.append(el('h3', null, 'Ses dangers'));
      const ul = el('ul', 'liste-points');
      menaces.forEach((m) => {
        const li = el('li');
        li.append(el('strong', null, D.counters.menaces[m.id].nom + ' : '), m.pourquoi + '.');
        ul.append(li);
      });
      const lien = el('a', 'lien', 'Quoi acheter contre ce héros →');
      lien.href = '#h=' + h.id + '&o=contrer';
      lien.addEventListener('click', (e) => { e.preventDefault(); aller(h.id, 'contrer'); });
      c.append(ul, lien);
      d.append(c);
    }
    if (fiche && fiche.astuces && fiche.astuces.length) {
      const c = el('div', 'encadre bon');
      c.append(el('h3', null, 'À savoir'));
      const ul = el('ul', 'liste-points');
      fiche.astuces.forEach((a) => ul.append(el('li', null, a)));
      c.append(ul);
      d.append(c);
    }

    const c = el('div', 'encadre');
    c.append(el('h3', null, 'Winrate depuis le ' + D.stats.meta.depuis));
    const table = el('table', 'table');
    Object.keys(D.stats.tranches).forEach((cle) => {
      const s = statDe(h.id, cle);
      if (!s) return;
      const tr = el('tr', cle === DLN.tranche() ? 'courante' : null);
      tr.append(el('td', null, DLN.LIBELLES_TRANCHE[cle] || cle), el('td', 'nombre', s.winrate.toFixed(1) + ' %'),
        el('td', 'nombre doux', '± ' + s.marge.toFixed(1)), el('td', 'nombre doux', DLN.fmtNombre(s.parties) + ' parties'));
      table.append(tr);
    });
    c.append(table);
    d.append(c);
    const durees = blocDurees(h);
    if (durees) d.append(durees);

    zone.append(g, d);
    return zone;
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
    const a = el('a', 'lien-demo', '▶ Voir une démo');
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
      if (c.recharge_s) nom.append(el('span', 'competence-recharge', '⟳ ' + c.recharge_s + ' s'));
      if (c.canalisee) nom.append(el('span', 'marque', 'canalisée : un stun l\'interrompt'));
      corps.append(nom, el('p', 'competence-resume', c.resume_fr || c.resume), el('p', null, c.description_fr || c.description));
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
    boite.append(el('p', 'aide', 'Textes officiels du jeu en français. Noms des valeurs en anglais.' +
      (DLN.niveau() < 2 ? ' Valeurs et améliorations : niveau 2 ou plus (menu ⚙).' : '') +
      ' Les démos sont des recherches YouTube : aucune vidéo officielle n\'est disponible par l\'API.'));
    return boite;
  }

  // ---------- onglet Le contrer ----------

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
    const explication = (D.counters.objets[o.nom] || {}).explication;
    if (explication) corps.append(el('span', 'objet-explication', explication));
    if (fiche && DLN.niveau() >= 3 && fiche.description) corps.append(el('span', 'objet-description', fiche.description));
    li.append(corps);
    return li;
  }

  function groupesObjets(liste) {
    const boite = el('div', 'objets-groupes');
    ORDRE_CATEGORIES.forEach((categorie) => {
      const ici = liste.filter((o) => ((objets[o.nom] || {}).categorie || 'autre') === categorie);
      if (!ici.length) return;
      const groupe = el('div', 'objets-groupe ' + categorie);
      groupe.append(el('h4', null, LIBELLES_CATEGORIE[categorie] || 'Autres'));
      const ul = el('ul', 'objets');
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
      resume.append(el('h3', null, 'En bref'));
      const ul = el('ul', 'contrer-lignes');
      menaces.forEach((m) => {
        const menace = D.counters.menaces[m.id];
        const li = el('li');
        const premier = menace.objets.slice().sort(parPrix)[0];
        li.append(el('strong', null, menace.nom));
        if (premier) {
          const o = objets[premier.nom];
          const chip = el('span', 'contrer-objet obj-' + ((o || {}).categorie || 'autre'));
          if (o && o.image) chip.append(DLN.img(o.image));
          chip.append(premier.nom);
          chip.title = (D.counters.objets[premier.nom] || {}).explication || '';
          li.append(el('span', 'contrer-fleche', '→'), chip);
        }
        ul.append(li);
      });
      resume.append(ul);
      const f = (D.details.fiches || {})[String(h.id)];
      if (f && f.arme && f.arme.degats_pleins_jusqu_a_m != null) resume.append(el('p', 'contrer-portee', '🎯 ' + porteeTexte(f.arme)));
      zone.append(resume);
    }

    menaces.forEach((m, i) => {
      const menace = D.counters.menaces[m.id];
      const carte = el('details', 'menace');
      carte.open = i === 0 && menaces.length <= 2;
      const titre = el('summary');
      titre.append(el('span', 'menace-titre', menace.nom), el('span', 'menace-pourquoi', m.pourquoi + '.'));
      carte.append(titre);
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
    const fiche = D.counters.heros[String(h.id)];
    if (fiche && fiche.astuces && fiche.astuces.length) {
      const c = el('div', 'encadre bon');
      c.append(el('h3', null, 'À savoir'));
      const ul = el('ul', 'liste-points');
      fiche.astuces.forEach((a) => ul.append(el('li', null, a)));
      c.append(ul);
      zone.append(c);
    }
    return zone;
  }

  // ---------- onglet Builds ----------

  function ligneAchat(o, details) {
    const li = el('li', 'achat obj-' + (o.categorie || 'autre'));
    li.append(DLN.img((objets[o.nom] || {}).image));
    const nom = el('span', 'achat-nom', o.nom + ' ');
    nom.append(el('span', 'objet-prix', DLN.fmtNombre(o.cout)));
    if (o.actif) nom.append(' ', el('span', 'objet-actif', 'actif'));
    const pour = el('span', 'achat-pour', details);
    const jauge = el('div', 'jauge-achat');
    const barre = el('span');
    barre.style.width = Math.min(100, o.achete_par) + '%';
    jauge.append(barre);
    pour.append(jauge);
    li.append(nom, pour);
    li.title = (D.counters.objets[o.nom] || {}).explication || '';
    return li;
  }

  // Builds publics du jeu : ceux qu'on trouve dans le navigateur de builds en jeu.
  function blocBuildsPublics(h, liste) {
    const c = el('section', 'panneau');
    c.append(el('h2', null, 'Builds publics les plus suivis'),
      el('p', 'aide', 'Les builds de la communauté visibles dans le navigateur de builds du jeu, les plus mis en favori parmi ceux mis à jour ' +
        'depuis le patch (' + D.builds.meta.depuis + '). Pour en suivre un en partie : le chercher par son nom dans les builds de ' + h.nom + '. ' +
        'Textes des auteurs, souvent en anglais.'));
    liste.forEach((b, i) => {
      const d = el('details', 'build-public');
      d.open = i === 0;
      const s = el('summary');
      s.append(el('strong', null, b.nom), el('span', 'aide', ' · ' + DLN.fmtNombre(b.favoris || 0) + ' favoris · mis à jour le ' +
        new Date(b.mis_a_jour + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })));
      d.append(s);
      if (b.description) d.append(el('p', 'texte-auteur', b.description));
      b.sections.forEach((sec) => {
        const ligne = el('div', 'build-section');
        const t = el('div', 'build-section-titre', sec.nom);
        if (sec.note) t.title = sec.note;
        const icones = el('div', 'build-objets');
        sec.objets.forEach((nom) => {
          const o = objets[nom];
          const x = el('span', 'build-objet obj-' + ((o || {}).categorie || 'autre') + (o && o.actif ? ' actif' : ''));
          if (o && o.image) x.append(DLN.img(o.image));
          x.append(el('span', null, nom));
          x.title = nom + (o ? ' · ' + DLN.fmtNombre(o.cout) + ' souls' + (o.actif ? ' · actif' : '') : '') +
            ((D.counters.objets[nom] || {}).explication ? '\n' + D.counters.objets[nom].explication : '');
          icones.append(x);
        });
        ligne.append(t, icones);
        d.append(ligne);
      });
      c.append(d);
    });
    return c;
  }

  function ongletBuilds(h) {
    const zone = el('div', 'fiche-contenu');
    const tranche = D.achats.tranches[DLN.tranche()] ? DLN.tranche() : 'tous';
    const a = (D.achats.tranches[tranche] || {})[String(h.id)];
    if (a) {
      const c = el('section', 'panneau');
      c.append(el('h2', null, 'Ce que ses joueurs achètent'),
        el('p', 'aide', 'Objets pris par au moins 20 % des joueurs de ' + h.nom + ' (' + DLN.fmtNombre(a.parties) + ' parties, ' +
          DLN.LIBELLES_TRANCHE[tranche] + ', depuis le ' + D.achats.meta.depuis + '), à leur minute moyenne d\'achat. ' +
          'La barre = part des joueurs qui le prennent.'));
      const phases = el('div', 'builds-phases');
      PHASES.forEach((ph) => {
        const ici = a.objets.filter((o) => o.minute >= ph[2] && o.minute < ph[3]);
        const col = el('div', 'builds-phase');
        const total = ici.reduce((s, o) => s + o.cout, 0);
        const t = el('h3', null, ph[0]);
        t.append(el('span', 'aide', ph[1] + ' · ' + DLN.fmtNombre(total) + ' souls'));
        col.append(t);
        const ul = el('ul', 'achats');
        ici.forEach((o) => ul.append(ligneAchat(o, o.achete_par + ' % · vers ' + Math.round(o.minute) + ' min')));
        col.append(ul);
        phases.append(col);
      });
      c.append(phases);
      zone.append(c);
    }
    const t = ((D.tempo || {}).tranches || {});
    const trancheTempo = t[DLN.tranche()] && t[DLN.tranche()][String(h.id)] && (t[DLN.tranche()][String(h.id)].objets_cles || []).length ? DLN.tranche() : 'tous';
    const cles = ((t[trancheTempo] || {})[String(h.id)] || {}).objets_cles || [];
    if (cles.length) {
      const c = el('section', 'panneau');
      c.append(el('h2', null, 'Ses gros achats : quand ce héros monte en puissance'),
        el('p', 'aide', 'Objets de tier 3 ou plus pris par au moins 35 % de ses joueurs (' + DLN.LIBELLES_TRANCHE[trancheTempo] +
          '), dans l\'ordre de la minute moyenne d\'achat. En face, c\'est le moment où il faut s\'attendre à un palier de puissance.'));
      const ul = el('ul', 'achats');
      cles.slice().sort((x, y) => x.minute - y.minute).forEach((o) => ul.append(ligneAchat(o, 'vers ' + fmtMinute(o.minute) + ' · ' + o.achete_par + ' % de ses joueurs')));
      c.append(ul);
      zone.append(c);
    }
    const publics = ((D.builds || {}).heros || {})[String(h.id)] || [];
    if (publics.length) zone.prepend(blocBuildsPublics(h, publics));
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
      el('span', 'doux petit', '± ' + m.marge.toFixed(1) + ' · ' + DLN.fmtNombre(m.parties) + ' parties'),
      el('span', signal ? 'marque signal' : 'marque', signal ? 'signal' : 'dans la marge'));
    corps.append(tete);
    const menaces = menacesDe(m.contre);
    if (menaces.length) corps.append(el('span', 'matchup-pourquoi', 'Ce qu\'il fait : ' + menaces.map((x) => D.counters.menaces[x.id].nom.toLowerCase()).join(', ')));
    li.append(corps);
    return li;
  }

  function ongletMatchups(h) {
    const zone = el('div', 'fiche-contenu');
    const m = ((D.details.matchups || {})[DLN.tranche()] || {})[String(h.id)];
    if (!m) {
      zone.append(el('p', 'vide', 'Pas assez de parties pour ce héros dans cette tranche de rang.'));
      return zone;
    }
    zone.append(el('p', 'aide', 'Statistiques ' + DLN.LIBELLES_TRANCHE[DLN.tranche()] + ' depuis le ' + D.details.meta.depuis +
      '. Écart = winrate réel contre ce héros moins le winrate attendu d\'après la force des deux. « Signal » seulement si l\'écart dépasse la marge d\'erreur.'));
    if (!m.signaux) {
      zone.append(el('p', 'avertissement', 'Aucun matchup de ' + h.nom + ' ne sort de la marge d\'erreur dans cette tranche : ' +
        'les noms ci-dessous sont surtout du hasard. Ce qui compte, ce sont ses menaces (onglet « Le contrer »).'));
    } else {
      zone.append(el('p', 'doux', m.signaux + ' matchup' + (m.signaux > 1 ? 's' : '') + ' sur ' + m.adversaires + ' sortent de la marge.'));
    }
    const colonnes = el('div', 'matchups-colonnes');
    [['perd', 'Le battent le plus', (x) => x.ecart < 0], ['bat', h.nom + ' les bat le plus', (x) => x.ecart > 0]].forEach((c) => {
      const col = el('section', 'panneau');
      col.append(el('h3', null, c[1]));
      const ul = el('ul', 'matchups-liste');
      m[c[0]].filter(c[2]).slice(0, NB_MATCHUPS).forEach((x) => ul.append(ligneMatchup(x, c[0])));
      col.append(ul);
      colonnes.append(col);
    });
    zone.append(colonnes);
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
      const c = el('div', 'patch-ligne ' + (x.sens[0] || ''));
      const t = el('h3', null, null);
      const a = el('a', null, x.p.titre);
      a.href = x.p.lien;
      a.target = '_blank';
      a.rel = 'noopener';
      t.append(a);
      x.sens.forEach((s) => t.append(el('span', 'marque', SENS[s])));
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
    DLN.charger('data/builds.json').catch(() => null), DLN.etiquettes.pret])).then((r) => {
    D = { heros: r[0], stats: r[1], roles: r[2], counters: r[3], details: r[5], achats: r[6], patch: r[7], tempo: r[8], builds: r[10] };
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
    window.addEventListener('hashchange', () => { lireAdresse(); afficher(); });
    afficher();
    DLN.surNiveau(afficher);
    DLN.surTranche(afficher);
    DLN.etiquettes.surChange(afficherListe);
  }, DLN.echec);
})();
