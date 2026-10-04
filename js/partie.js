// En partie : contexte de la partie (mon héros → rôle → lane de départ, équipe), modes d'affichage
// (Compact / Normal / Complet, panneaux à la carte) et panneau « Ton plan » (conseil du rôle pour la
// phase en cours, prochaines actions qui comptent pour ce rôle, portée de mon arme et de celle d'en face).
// Les conseils sont du jugement (data/conseils-roles.json) ; les horaires viennent de data/timeline.json.
// Expose DLN.partieContexte pour la carte (js/carte-mini.js).
(function () {
  'use strict';

  const el = DLN.el;
  const CLE_CONTEXTE = 'dln.partie.contexte.v1';
  const CLE_AFFICHAGE = 'dln.partie.affichage.v1';
  const CLE_CHRONO = 'dln.timeline.etat.v1';
  const CLE_ENFACE = 'dln.counters.choisis.v1';

  const PANNEAUX = [
    ['horloge', 'Chrono'], ['plan', 'Ton plan'], ['avenir', 'À venir'], ['declenches', 'Minuteurs'],
    ['carte', 'Carte'], ['enface', 'En face'], ['maintenant', 'Maintenant'], ['checklist', 'Priorités'], ['frise', 'Frise']
  ];
  const MODES = {
    compact: { nom: 'Compact', aide: 'Chrono, ton plan, minuteurs', panneaux: ['horloge', 'plan', 'declenches'] },
    normal: { nom: 'Normal', aide: 'Plus « À venir » et la carte', panneaux: ['horloge', 'plan', 'declenches', 'avenir', 'carte'] },
    complet: { nom: 'Complet', aide: 'Tout', panneaux: PANNEAUX.map((p) => p[0]) }
  };
  // Couleurs des lanes : celles de data/map.json (choix d'affichage pour les nommer).
  const LANES = { '#f1cc30': { id: 'yellow', nom: 'Yellow' }, '#29b1cc': { id: 'blue', nom: 'Blue' }, '#59b247': { id: 'green', nom: 'Green' } };

  let D = null;
  let contexte = { heros: null, role: null, lane: null };
  let affichage = { mode: 'normal', perso: {} };
  const ecouteurs = [];

  const lire = (cle, defaut) => { try { return Object.assign(defaut, JSON.parse(localStorage.getItem(cle)) || {}); } catch (e) { return defaut; } };
  const ecrire = (cle, v) => { try { localStorage.setItem(cle, JSON.stringify(v)); } catch (e) { /* stockage indisponible */ } };
  contexte = lire(CLE_CONTEXTE, contexte);
  affichage = lire(CLE_AFFICHAGE, affichage);
  if (!MODES[affichage.mode]) affichage.mode = 'normal';

  const fmt = (s) => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const herosDe = (id) => D && D.heros.heros.find((h) => h.id === id);
  const roleDe = (id) => D && D.roles.roles.find((r) => r.id === id);

  function rolePrincipal(idHeros) {
    if (!D) return null;
    const r = D.roles.roles.find((x) => x.heros.some((h) => h.id === idHeros)) ||
      D.roles.roles.find((x) => (x.aussi || []).some((h) => h.id === idHeros));
    return r ? r.id : null;
  }
  const roleCourant = () => contexte.role || (contexte.heros ? rolePrincipal(contexte.heros) : null);

  function tempsChrono() {
    try {
      const e = JSON.parse(localStorage.getItem(CLE_CHRONO)) || {};
      if (e.depart != null) return { t: Math.max(0, (Date.now() - e.depart) / 1000), lance: true };
      if (e.pauseA != null) return { t: e.pauseA, lance: true };
    } catch (err) { /* stockage indisponible */ }
    return { t: 0, lance: false };
  }

  function changer(nouveau) {
    Object.assign(contexte, nouveau);
    ecrire(CLE_CONTEXTE, contexte);
    ecouteurs.forEach((f) => f());
    dessinerContexte();
    dessinerPlan();
  }

  // ---------- affichage : modes et panneaux ----------

  function panneauxVisibles() {
    const base = MODES[affichage.mode].panneaux;
    const perso = affichage.perso[affichage.mode] || {};
    return PANNEAUX.map((p) => p[0]).filter((id) => (perso[id] != null ? perso[id] : base.indexOf(id) !== -1));
  }

  function appliquerAffichage() {
    const visibles = panneauxVisibles();
    document.querySelectorAll('[data-panneau]').forEach((s) => { s.hidden = visibles.indexOf(s.dataset.panneau) === -1; });
    Object.keys(MODES).forEach((m) => document.body.classList.toggle('mode-' + m, m === affichage.mode));
    // En mode Complet, « Maintenant » et « Priorités » passent sous « À venir » : la colonne de gauche
    // garde le chrono, le plan et les minuteurs, sans que tout s'empile au même endroit.
    const gauche = document.querySelector('.col-gauche'), centre = document.querySelector('.col-avenir');
    if (gauche && centre) {
      const cible = affichage.mode === 'complet' ? centre : gauche;
      ['maintenant', 'checklist'].forEach((id) => {
        const s = document.querySelector('[data-panneau="' + id + '"]');
        if (s && s.parentNode !== cible) cible.append(s);
      });
    }
    // Une colonne sans panneau visible disparaît (secours si :has n'est pas pris en charge).
    document.querySelectorAll('.partie-colonnes > .col').forEach((c) => {
      c.hidden = !Array.prototype.some.call(c.children, (x) => !x.hidden);
    });
    window.dispatchEvent(new Event('resize'));
  }

  // ---------- barre de contexte ----------

  function bouton(texte, classe, action, titre) {
    const b = el('button', 'btn ' + (classe || ''), texte);
    b.type = 'button';
    if (titre) b.title = titre;
    // blur : Espace reste le raccourci du chrono.
    b.addEventListener('click', () => { action(); b.blur(); });
    return b;
  }

  function lanesOrdonnees() {
    const lignes = ((D.carte.couches.find((c) => c.id === 'lanes') || {}).lignes || []).map((l) => {
      const x = l.trace.reduce((s, p) => s + p[0], 0) / l.trace.length;
      return Object.assign({ couleur: l.couleur, x: x }, LANES[l.couleur.toLowerCase()] || { id: l.couleur, nom: l.couleur });
    }).sort((a, b) => a.x - b.x);
    // Carte retournée (équipe du haut) : la gauche et la droite s'échangent.
    return DLN.orientationCarte && DLN.orientationCarte.equipe() === 1 ? lignes.reverse() : lignes;
  }

  function dessinerContexte() {
    const zone = document.getElementById('contexte');
    if (!zone || !D) return;
    zone.textContent = '';

    // Mon héros
    const h = herosDe(contexte.heros);
    const choixHeros = bouton('', 'contexte-heros', ouvrirChoixHeros, 'Choisir le héros que tu joues');
    if (h) choixHeros.append(DLN.img(h.icone || h.image), el('span', null, h.nom));
    else choixHeros.append(el('span', null, 'Choisir mon héros'));
    choixHeros.append(el('span', 'doux', ' ▾'));

    // Rôle (déduit du héros, modifiable)
    const role = el('select', 'contexte-role');
    role.setAttribute('aria-label', 'Mon rôle');
    const auto = el('option', null, contexte.heros && rolePrincipal(contexte.heros) ? 'Rôle : ' + roleDe(rolePrincipal(contexte.heros)).nom + ' (auto)' : 'Rôle : choisir');
    auto.value = '';
    role.append(auto);
    D.roles.roles.forEach((r) => { const o = el('option', null, r.nom); o.value = r.id; role.append(o); });
    role.value = contexte.role || '';
    role.addEventListener('change', () => { changer({ role: role.value || null }); });

    // Lane de départ
    const lanes = el('div', 'contexte-lanes');
    lanes.setAttribute('role', 'group');
    lanes.setAttribute('aria-label', 'Ma lane de départ');
    lanes.append(el('span', 'doux petit', 'Lane'));
    lanesOrdonnees().forEach((l) => {
      const b = bouton(l.nom, 'lane-bouton' + (contexte.lane === l.id ? ' choisi' : ''), () => changer({ lane: contexte.lane === l.id ? null : l.id }));
      b.style.setProperty('--lane', l.couleur);
      b.setAttribute('aria-pressed', String(contexte.lane === l.id));
      lanes.append(b);
    });

    // Équipe (oriente la carte)
    const equipe = DLN.orientationCarte ? DLN.orientationCarte.bouton() : el('span');

    // Affichage
    const modes = el('div', 'segments-modes');
    modes.setAttribute('role', 'group');
    modes.setAttribute('aria-label', 'Affichage');
    Object.keys(MODES).forEach((m) => {
      const b = bouton(MODES[m].nom, 'mode-bouton', () => { affichage.mode = m; ecrire(CLE_AFFICHAGE, affichage); appliquerAffichage(); dessinerContexte(); }, MODES[m].aide);
      b.setAttribute('aria-pressed', String(affichage.mode === m));
      modes.append(b);
    });

    // Panneaux à la carte
    const perso = el('details', 'contexte-panneaux');
    perso.append(el('summary', null, 'Panneaux'));
    const liste = el('div', 'contexte-panneaux-liste');
    const visibles = panneauxVisibles();
    PANNEAUX.forEach((p) => {
      const label = el('label');
      const c = el('input');
      c.type = 'checkbox';
      c.checked = visibles.indexOf(p[0]) !== -1;
      c.addEventListener('change', () => {
        const o = affichage.perso[affichage.mode] || (affichage.perso[affichage.mode] = {});
        o[p[0]] = c.checked;
        ecrire(CLE_AFFICHAGE, affichage);
        appliquerAffichage();
        c.blur();
      });
      label.append(c, ' ' + p[1]);
      liste.append(label);
    });
    liste.append(bouton('Revenir au réglage du mode', 'discret', () => { delete affichage.perso[affichage.mode]; ecrire(CLE_AFFICHAGE, affichage); appliquerAffichage(); dessinerContexte(); }));
    perso.append(liste);

    zone.append(choixHeros, role, lanes, equipe, modes, perso, menuAlertes());
    if (installation) zone.append(bouton('📲 Installer', 'discret', installer, 'Installer le site comme une application (écran d\'accueil, plein écran)'));
  }

  // Choix de mon héros : une fenêtre avec la grille, mes étiquettes d'abord.
  function ouvrirChoixHeros() {
    let dlg = document.getElementById('choix-mon-heros');
    if (!dlg) {
      dlg = el('dialog', 'choix-heros');
      dlg.id = 'choix-mon-heros';
      document.body.append(dlg);
    }
    dlg.textContent = '';
    const tete = el('div', 'choix-heros-tete');
    tete.append(el('h2', null, 'Quel héros joues-tu ?'), bouton('Aucun', 'discret', () => { changer({ heros: null, role: null }); dlg.close(); }),
      bouton('Fermer', '', () => dlg.close()));
    dlg.append(tete);
    const groupes = [];
    if (DLN.etiquettes) {
      DLN.etiquettes.enUsage().filter((t) => t === 'joué' || t === 'à essayer').forEach((t) => {
        groupes.push({ nom: t.charAt(0).toUpperCase() + t.slice(1), heros: DLN.etiquettes.avec(t).map(herosDe).filter(Boolean) });
      });
    }
    DLN.grouperParRole(D.heros.heros, D.roles).forEach((g) => groupes.push(g));
    groupes.forEach((g) => {
      if (!g.heros.length) return;
      dlg.append(el('h3', 'grille-role', g.nom));
      const grille = el('div', 'heros-grille');
      g.heros.forEach((x) => {
        const b = el('button', 'heros-case' + (x.id === contexte.heros ? ' choisi' : ''));
        b.type = 'button';
        b.append(DLN.img(x.icone || x.image), el('span', null, x.nom));
        b.addEventListener('click', () => { changer({ heros: x.id, role: null }); dlg.close(); });
        grille.append(b);
      });
      dlg.append(grille);
    });
    dlg.showModal();
  }

  // ---------- panneau « Ton plan » ----------

  function phaseA(t) {
    let p = D.timeline.phases[0];
    D.timeline.phases.forEach((x) => { if (t >= x.debut_s) p = x; });
    return p;
  }

  const niveauOk = (id) => {
    const n = D.niveaux && D.niveaux.evenements ? D.niveaux.evenements[id] : null;
    return n == null || n <= DLN.niveau();
  };

  // Prochaine apparition (ou fenêtre) d'un événement après t, pour la liste d'actions.
  function prochaine(ev, t) {
    if (ev.type === 'unique') return ev.temps_s >= t - 20 ? ev.temps_s : null;
    if (ev.type === 'recurrent') {
      const n = Math.max(0, Math.ceil((t - 20 - ev.temps_s) / ev.intervalle_s));
      return ev.temps_s + n * ev.intervalle_s;
    }
    if (ev.type === 'fenetre') return t <= ev.fin_s ? ev.debut_s : null;
    return null;
  }

  // Portée de l'arme en mots : mètres, dashes (10 m au sol, donnée du jeu) et secondes de course.
  function portee(f) {
    if (!f || !f.arme || f.arme.degats_pleins_jusqu_a_m == null) return null;
    const m = f.arme.degats_pleins_jusqu_a_m;
    const dash = f.dash_sol_m || null;
    const morceaux = [m + ' m'];
    if (dash) morceaux.push('≈ ' + (Math.round(m / dash * 10) / 10).toLocaleString('fr-FR') + ' dash' + (m / dash >= 2 ? 'es' : ''));
    if (f.vitesse_m_s) morceaux.push('≈ ' + (Math.round(m / f.vitesse_m_s * 10) / 10).toLocaleString('fr-FR') + ' s de course');
    return { m: m, texte: morceaux.join(' '), min: f.arme.degats_minimum_des_m, chute: f.arme.chute_degats_pct };
  }

  function dessinerPlan() {
    const zone = document.getElementById('plan');
    if (!zone || !D) return;
    const chrono = tempsChrono();
    const t = chrono.t;
    zone.textContent = '';
    const idRole = roleCourant();
    const role = roleDe(idRole);
    const conseils = D.conseils;
    const phase = phaseA(t);

    const tete = el('div', 'plan-tete');
    const titre = el('h2', null, 'Ton plan');
    titre.append(el('span', 'marque', 'conseil'));
    tete.append(titre);
    const h = herosDe(contexte.heros);
    const qui = el('span', 'plan-qui');
    if (h) qui.append(DLN.img(h.icone || h.image), h.nom);
    if (role) qui.append(el('span', 'puce', role.nom));
    if (contexte.lane) {
      const l = lanesOrdonnees().find((x) => x.id === contexte.lane);
      if (l) { const p = el('span', 'puce lane-puce', l.nom + ' lane'); p.style.setProperty('--lane', l.couleur); qui.append(p); }
    }
    tete.append(qui);
    zone.append(tete);

    // Conseil de la phase
    const texte = role && conseils.roles[idRole] ? conseils.roles[idRole].phases[phase.nom] : conseils.commun[phase.nom];
    const conseil = el('p', 'plan-conseil');
    conseil.append(el('strong', null, phase.nom + ' : '), texte || phase.resume);
    zone.append(conseil);
    if (!h) zone.append(el('p', 'aide', 'Choisis ton héros en haut : le plan s\'adapte à son rôle et à ta lane.'));

    // Prochaines actions pour ce rôle
    const priorites = role && conseils.roles[idRole] ? conseils.roles[idRole].priorites : ['small_camps', 'medium_camps', 'powerups', 'urn', 'sinners', 'large_camps', 'rift'];
    const actions = priorites.map((id) => D.timeline.evenements.find((e) => e.id === id)).filter((e) => e && niveauOk(e.id))
      .map((e) => ({ e: e, quand: prochaine(e, t) })).filter((x) => x.quand != null)
      .sort((a, b) => a.quand - b.quand).slice(0, 3);
    if (actions.length) {
      const ul = el('ul', 'plan-actions');
      actions.forEach((a, i) => {
        const li = el('li', a.quand <= t ? 'maintenant' : (a.quand - t <= 45 ? 'bientot' : ''));
        const quand = a.quand <= t ? 'maintenant' : (chrono.lance ? 'dans ' + fmt(a.quand - t) : 'à ' + fmt(a.quand));
        li.append(el('span', 'plan-num', String(i + 1)), el('strong', null, a.e.nom.split(' (')[0]), el('span', 'plan-quand', quand));
        if (a.e.fiabilite === 'incertain') li.append(el('span', 'marque', 'incertain'));
        if (a.e.conseil && i === 0) li.append(el('span', 'plan-detail', a.e.conseil));
        ul.append(li);
      });
      zone.append(el('h3', null, role ? 'Ce qui compte pour un ' + role.nom.toLowerCase() : 'Prochains objectifs'), ul);
    }
    // Ce qui est déjà ouvert et reste disponible (camps de jungle) : un simple rappel.
    const ouverts = priorites.map((id) => D.timeline.evenements.find((e) => e.id === id))
      .filter((e) => e && niveauOk(e.id) && e.type === 'unique' && e.categorie === 'jungle' && e.temps_s <= t - 20);
    if (chrono.lance && ouverts.length) {
      zone.append(el('p', 'plan-ouverts', 'Déjà ouverts' + (role && conseils.roles[idRole] && conseils.roles[idRole].cote === 'lane' && contexte.lane ? ' de ton côté' : '') +
        ' : ' + ouverts.map((e) => e.nom.split(' (')[0]).join(', ') + '.'));
    }

    // Distances : ma portée et celle d'en face, en dashes
    const fiches = D.details.fiches || {};
    const moi = h ? portee(fiches[String(h.id)]) : null;
    let enFace = [];
    try { enFace = JSON.parse(localStorage.getItem(CLE_ENFACE)) || []; } catch (e) { enFace = []; }
    if (moi || enFace.length) {
      const d = el('div', 'plan-portee');
      d.append(el('h3', null, 'Distances'));
      if (moi) {
        const p = el('p');
        p.append(el('strong', null, 'Toi : '), 'pleins dégâts jusqu\'à ' + moi.texte + '.');
        if (moi.chute) p.append(' Au-delà de ' + moi.min + ' m, il ne reste que ' + (100 + moi.chute) + ' % de tes dégâts.');
        d.append(p);
      }
      const autres = enFace.map((id) => ({ h: herosDe(id), p: portee(fiches[String(id)]) })).filter((x) => x.h && x.p).sort((a, b) => b.p.m - a.p.m);
      if (autres.length) {
        d.append(el('p', 'plan-ennemis-titre', 'En face, pleins dégâts jusqu\'à : (reste plus loin pour prendre beaucoup moins' +
          (moi ? ' ; en rouge, ceux qui te touchent de plus loin que toi' : '') + ')'));
        const ul = el('ul', 'plan-ennemis');
        autres.forEach((x) => {
          const li = el('li', moi && x.p.m > moi.m ? 'plus-loin' : '');
          li.append(DLN.img(x.h.icone || x.h.image), el('span', null, x.h.nom), el('span', 'plan-quand', x.p.m + ' m'));
          if (moi && x.p.m > moi.m) li.title = x.h.nom + ' fait ses pleins dégâts plus loin que toi : ne reste pas entre ' + moi.m + ' et ' + x.p.m + ' m.';
          ul.append(li);
        });
        d.append(ul);
      }
      d.append(el('p', 'aide', 'Repère : un dash au sol fait 10 m et un dash en l\'air 8 m (données du jeu, tous les héros).'));
      zone.append(d);
    }
  }

  // ---------- alertes : flash plein écran, notification système, vibration ----------
  // Le son et la voix restent ceux du chrono (js/timeline.js, cases #opt-son et #opt-voix) :
  // le menu « Alertes » les regroupe ici.

  const CLE_ALERTES = 'dln.partie.alertes.v1';
  let premiereFois = false;
  try { premiereFois = localStorage.getItem(CLE_ALERTES) == null; } catch (e) { /* stockage indisponible */ }
  let alertes = lire(CLE_ALERTES, { flash: true, notif: false, vibre: true });
  // Premier passage : son et voix du chrono sont activés par js/sons.js (chargé avant le chrono).
  if (premiereFois) ecrire(CLE_ALERTES, alertes);
  const declenchees = new Set();
  let premierPassage = true;

  function evenementsSurveilles() {
    if (!D) return [];
    const r = roleCourant();
    const prio = r && D.conseils.roles[r] ? D.conseils.roles[r].priorites : null;
    return D.timeline.evenements.filter((e) => e.annonce_avant_s > 0 && niveauOk(e.id) && (!prio || prio.indexOf(e.id) !== -1));
  }

  // Seuils (préavis puis apparition) de la prochaine occurrence et de la précédente.
  function seuils(ev, t) {
    const liste = [];
    const ajoute = (debut, n) => {
      liste.push({ cle: ev.id + ':' + n + ':avant', t: debut - ev.annonce_avant_s, debut: debut, avant: true });
      liste.push({ cle: ev.id + ':' + n + ':mtn', t: debut, debut: debut, avant: false });
    };
    if (ev.type === 'unique') ajoute(ev.temps_s, 0);
    else if (ev.type === 'fenetre') ajoute(ev.debut_s, 0);
    else if (ev.type === 'recurrent') {
      const n = Math.max(0, Math.floor((t - ev.temps_s) / ev.intervalle_s));
      ajoute(ev.temps_s + n * ev.intervalle_s, n);
      ajoute(ev.temps_s + (n + 1) * ev.intervalle_s, n + 1);
    }
    return liste;
  }

  function surveiller() {
    const chrono = tempsChrono();
    if (!D || !chrono.lance) { premierPassage = true; return; }
    const t = chrono.t;
    evenementsSurveilles().forEach((ev) => {
      seuils(ev, t).forEach((s) => {
        if (t < s.t) { declenchees.delete(s.cle); return; }       // l'horloge a été reculée
        if (t > s.t + 8 || declenchees.has(s.cle)) { declenchees.add(s.cle); return; }
        declenchees.add(s.cle);
        if (!premierPassage) alerter(ev, s.avant ? s.debut - t : 0);
      });
    });
    premierPassage = false;
  }

  function alerter(ev, restant) {
    const nom = ev.nom.split(' (')[0];
    const titre = restant > 1 ? nom + ' dans ' + Math.round(restant) + ' s' : nom + ' : maintenant';
    const texte = ev.conseil || ev.detail || '';
    if (alertes.flash) flash(titre, texte);
    // Le préavis sonne déjà via le chrono ; l'apparition a son propre son, si le son est activé.
    const son = document.getElementById('opt-son');
    if (restant <= 1 && son && son.checked && DLN.sons) DLN.sons.jouer('maintenant');
    if (alertes.vibre && navigator.vibrate) { try { navigator.vibrate([250, 120, 250, 120, 400]); } catch (e) { /* pas de vibration */ } }
    if (alertes.notif) notifier(titre, texte, ev.id);
  }

  function flash(titre, texte) {
    let z = document.getElementById('alerte-flash');
    if (!z) {
      z = el('div', 'alerte-flash');
      z.id = 'alerte-flash';
      z.setAttribute('role', 'alert');
      z.addEventListener('click', () => { z.hidden = true; });
      document.body.append(z);
    }
    z.textContent = '';
    z.append(el('div', 'alerte-flash-titre', titre), el('div', 'alerte-flash-texte', texte), el('div', 'alerte-flash-aide', 'clic pour fermer'));
    z.hidden = false;
    z.classList.remove('anime');
    void z.offsetWidth;                // relance l'animation
    z.classList.add('anime');
    clearTimeout(flash.minuteur);
    flash.minuteur = setTimeout(() => { z.hidden = true; }, 7000);
  }

  function notifier(titre, texte, tag) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const options = { body: texte, tag: 'dln-' + tag, renotify: true, icon: 'icones/icone-192.png', badge: 'icones/icone-192.png' };
    const repli = () => { try { new Notification(titre, options); } catch (e) { /* notifications indisponibles */ } };
    if (navigator.serviceWorker && navigator.serviceWorker.getRegistration) {
      navigator.serviceWorker.getRegistration().then((r) => (r ? r.showNotification(titre, options) : repli())).catch(repli);
    } else repli();
  }

  // Ambiance sonore : un profil à choisir, deux sons à écouter, le volume.
  function choixSon() {
    const z = el('div', 'choix-son');
    if (!DLN.sons) return z;
    const ligne = el('div', 'choix-son-profils');
    Object.keys(DLN.sons.PROFILS).forEach((id) => {
      const p = DLN.sons.PROFILS[id];
      const b = bouton(p.nom, 'son-profil' + (DLN.sons.profil() === id ? ' choisi' : ''), () => {
        DLN.sons.reglerProfil(id);
        DLN.sons.jouer('preavis');
        z.querySelectorAll('.son-profil').forEach((x) => x.classList.toggle('choisi', x === b));
        aide.textContent = p.aide;
      }, p.aide);
      ligne.append(b);
    });
    const aide = el('p', 'aide', DLN.sons.PROFILS[DLN.sons.profil()].aide);
    const ecoute = el('div', 'choix-son-ecoute');
    ecoute.append(bouton('▶ Bientôt', 'discret', () => DLN.sons.jouer('preavis'), 'Le son du préavis'),
      bouton('▶ Maintenant', 'discret', () => DLN.sons.jouer('maintenant'), 'Le son quand l\'objectif apparaît'));
    const vol = el('label', 'choix-son-volume');
    const r = el('input');
    r.type = 'range';
    r.min = '0';
    r.max = '100';
    r.value = String(Math.round(DLN.sons.volume() * 100));
    r.addEventListener('change', () => { DLN.sons.reglerVolume(Number(r.value) / 100); DLN.sons.jouer('preavis'); r.blur(); });
    vol.append('Volume ', r);
    z.append(el('strong', null, 'Son des alertes'), ligne, aide, ecoute, vol);
    return z;
  }

  function menuAlertes() {
    const d = el('details', 'contexte-panneaux contexte-alertes');
    const resume = el('summary', null, '🔔 Alertes');
    d.append(resume);
    const liste = el('div', 'contexte-panneaux-liste alertes-liste');
    const caseAlerte = (texte, aide, lireV, ecrireV) => {
      const label = el('label');
      const c = el('input');
      c.type = 'checkbox';
      c.checked = lireV();
      c.addEventListener('change', () => { ecrireV(c.checked); c.blur(); });
      label.append(c, ' ' + texte);
      if (aide) label.title = aide;
      liste.append(label);
      return c;
    };
    // Son et voix : on pilote les cases du chrono pour garder un seul réglage.
    const relais = (id) => () => { const c = document.getElementById(id); return !!(c && c.checked); };
    const relaisEcrire = (id) => (v) => { const c = document.getElementById(id); if (c && c.checked !== v) { c.checked = v; c.dispatchEvent(new Event('change')); } };
    const caseSon = caseAlerte('Son', 'Un son au début du préavis et à l\'apparition', relais('opt-son'), relaisEcrire('opt-son'));
    liste.append(choixSon());
    const caseVoix = caseAlerte('Voix (« Soul Urn dans 30 secondes »)', 'Annonce vocale du navigateur', relais('opt-voix'), relaisEcrire('opt-voix'));
    // À l'ouverture du menu, les cases reprennent l'état réel des réglages du chrono.
    d.addEventListener('toggle', () => { if (d.open) { caseSon.checked = relais('opt-son')(); caseVoix.checked = relais('opt-voix')(); } });
    caseAlerte('Flash plein écran', 'Un grand bandeau sur toute la page', () => alertes.flash, (v) => { alertes.flash = v; ecrire(CLE_ALERTES, alertes); });
    caseAlerte('Vibration (téléphone)', null, () => alertes.vibre, (v) => { alertes.vibre = v; ecrire(CLE_ALERTES, alertes); });
    const notif = caseAlerte('Notifications du système', 'Elles s\'affichent par-dessus les autres fenêtres, sur ton écran principal', () => alertes.notif && 'Notification' in window && Notification.permission === 'granted', (v) => {
      if (!v) { alertes.notif = false; ecrire(CLE_ALERTES, alertes); return; }
      if (!('Notification' in window)) { notif.checked = false; return; }
      Notification.requestPermission().then((p) => {
        alertes.notif = p === 'granted';
        notif.checked = alertes.notif;
        ecrire(CLE_ALERTES, alertes);
        if (alertes.notif) notifier('Notifications activées', 'Tu seras prévenu même si tu ne regardes pas cet écran.', 'test');
      });
    });
    liste.append(bouton('Tester une alerte', 'discret', () => {
      const ev = evenementsSurveilles()[0] || { id: 'test', nom: 'Soul Urn', conseil: 'Exemple d\'alerte.' };
      alerter(ev, 30);
      const c = document.getElementById('opt-voix');
      if (c && c.checked && 'speechSynthesis' in window) { const u = new SpeechSynthesisUtterance(ev.nom.split(' (')[0] + ' dans 30 secondes'); u.lang = 'fr-FR'; speechSynthesis.speak(u); }
    }));
    liste.append(el('p', 'aide', 'Conseil : active la voix et les notifications. En jeu plein écran exclusif, Windows peut masquer les notifications : préfère le mode « plein écran fenêtré » du jeu.'));
    d.append(liste);
    return d;
  }

  // ---------- installation (PWA) ----------

  let installation = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installation = e; dessinerContexte(); });
  function installer() {
    if (!installation) return;
    installation.prompt();
    installation.userChoice.finally(() => { installation = null; dessinerContexte(); });
  }
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => { /* pas de mode hors ligne */ });
  }

  // ---------- démarrage ----------

  DLN.partieContexte = {
    get: () => {
      const r = roleCourant();
      return {
        heros: contexte.heros, role: r, lane: contexte.lane,
        priorites: D && r && D.conseils.roles[r] ? D.conseils.roles[r].priorites : null,
        cote: D && r && D.conseils.roles[r] ? D.conseils.roles[r].cote : null
      };
    },
    surChange: (f) => ecouteurs.push(f)
  };

  appliquerAffichage();
  Promise.all(['data/heroes.json', 'data/roles.json', 'data/conseils-roles.json', 'data/timeline.json', 'data/heros-details.json', 'data/map.json']
    .map(DLN.charger).concat([DLN.charger('data/niveaux.json').catch(() => null)])).then((r) => {
    D = { heros: r[0], roles: r[1], conseils: r[2], timeline: r[3], details: r[4], carte: r[5], niveaux: r[6] };
    dessinerContexte();
    dessinerPlan();
    ecouteurs.forEach((f) => f());
    setInterval(dessinerPlan, 1000);
    setInterval(surveiller, 500);
    DLN.surNiveau(dessinerPlan);
    if (DLN.orientationCarte) DLN.orientationCarte.surChange(dessinerContexte);
    window.addEventListener('storage', (e) => { if (e.key === CLE_ENFACE || e.key === CLE_CHRONO) dessinerPlan(); });
  }).catch(() => { /* la page reste utilisable sans le plan */ });
})();
