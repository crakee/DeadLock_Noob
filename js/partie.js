// En partie : contexte de la partie (mon héros → rôle → lane de départ, équipe) et trois onglets
// selon le moment : « En jeu » (le prochain objectif en grand), « Objectifs » (ce qu'il faut faire
// et quand, carte, frise), « Mort · compo » (compo d'en face, comment la jouer, notes perso).
// Les conseils sont du jugement (data/conseils-roles.json) ; les horaires viennent de data/timeline.json.
// Expose DLN.partieContexte pour la carte (js/carte-mini.js).
(function () {
  'use strict';

  const el = DLN.el;
  const CLE_CONTEXTE = 'dln.partie.contexte.v1';
  const CLE_AFFICHAGE = 'dln.partie.affichage.v1';
  const CLE_CHRONO = 'dln.timeline.etat.v1';
  const CLE_ENFACE = 'dln.counters.choisis.v1';

  // Chaque onglet range ses panneaux en colonnes (de gauche à droite) ; les autres sont masqués.
  const ONGLETS = {
    jeu: { nom: '🎮 En jeu', touche: 'J', aide: 'Le prochain objectif en grand : à regarder en jouant', colonnes: [['horloge', 'avenir', 'plan', 'declenches']] },
    objectifs: { nom: '🗺 Objectifs', touche: 'O', aide: 'Ce qu\'il faut faire et quand, la carte', colonnes: [['objectifs'], ['carte']], bas: ['frise'] },
    mort: { nom: '💀 Mort · compo', touche: 'M', aide: 'Quand tu es mort : leur compo, comment la jouer, tes notes', colonnes: [['maintenant', 'compo', 'checklist'], ['enface'], ['notes']] }
  };
  // Couleurs des lanes : celles de data/map.json (choix d'affichage pour les nommer).
  const LANES = { '#f1cc30': { id: 'yellow', nom: 'Yellow' }, '#29b1cc': { id: 'blue', nom: 'Blue' }, '#59b247': { id: 'green', nom: 'Green' } };

  let D = null;
  let contexte = { heros: null, role: null, lane: null };
  let affichage = { onglet: 'jeu' };
  const ecouteurs = [];

  const lire = (cle, defaut) => { try { return Object.assign(defaut, JSON.parse(localStorage.getItem(cle)) || {}); } catch (e) { return defaut; } };
  const ecrire = (cle, v) => { try { localStorage.setItem(cle, JSON.stringify(v)); } catch (e) { /* stockage indisponible */ } };
  contexte = lire(CLE_CONTEXTE, contexte);
  affichage = lire(CLE_AFFICHAGE, affichage);
  if (!ONGLETS[affichage.onglet]) affichage.onglet = 'jeu';

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

  // ---------- onglets ----------

  function appliquerAffichage() {
    const o = ONGLETS[affichage.onglet];
    const colonnes = document.querySelectorAll('.partie-colonnes > .col');
    const montres = [];
    o.colonnes.forEach((ids, i) => {
      const col = colonnes[i];
      if (!col) return;
      ids.forEach((id) => {
        const sec = document.querySelector('[data-panneau="' + id + '"]');
        if (sec) { col.append(sec); montres.push(id); }
      });
    });
    (o.bas || []).forEach((id) => montres.push(id));
    document.querySelectorAll('[data-panneau]').forEach((sec) => { sec.hidden = montres.indexOf(sec.dataset.panneau) === -1; });
    colonnes.forEach((c, i) => { c.hidden = i >= o.colonnes.length; });
    Object.keys(ONGLETS).forEach((k) => document.body.classList.toggle('onglet-' + k, k === affichage.onglet));
    document.querySelectorAll('.onglet-partie').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.onglet === affichage.onglet)));
    window.dispatchEvent(new Event('resize'));
    tourner(true);
    if (affichage.onglet === 'objectifs') dessinerObjectifs();
    if (affichage.onglet === 'mort') { dessinerCompo(); dessinerNotes(); }
  }

  function changerOnglet(id) {
    if (!ONGLETS[id]) return;
    affichage.onglet = id;
    ecrire(CLE_AFFICHAGE, affichage);
    appliquerAffichage();
  }

  // Raccourcis J / O / M (sauf pendant une saisie).
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) || document.querySelector('dialog[open]')) return;
    const k = e.key.toUpperCase();
    Object.keys(ONGLETS).forEach((id) => { if (ONGLETS[id].touche === k) { e.preventDefault(); changerOnglet(affichage.onglet === id && id !== 'jeu' ? 'jeu' : id); } });
  });

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

    // Onglets
    const onglets = el('div', 'onglets-partie');
    onglets.setAttribute('role', 'tablist');
    Object.keys(ONGLETS).forEach((id) => {
      const b = bouton(ONGLETS[id].nom, 'onglet-partie', () => changerOnglet(id), ONGLETS[id].aide + ' (touche ' + ONGLETS[id].touche + ')');
      b.dataset.onglet = id;
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(affichage.onglet === id));
      onglets.append(b);
    });

    // Mini chrono, visible dans tous les onglets
    const mini = el('span', 'mini-chrono');
    mini.id = 'mini-chrono';

    // Visible : héros, lane, affichage, alertes. Le reste dans « ⚙ Ma partie ».
    const plus = el('details', 'contexte-panneaux contexte-plus');
    plus.append(el('summary', null, '⚙ Ma partie'));
    const contenu = el('div', 'contexte-panneaux-liste plus-liste');
    const ligne = (titre, noeud) => { const d = el('div', 'plus-ligne'); d.append(el('span', 'doux petit', titre), noeud); contenu.append(d); };
    ligne('Lane de départ', lanes);
    ligne('Rôle', role);
    ligne('Équipe (oriente la carte)', equipe);
    if (installation) ligne('Application', bouton('📲 Installer sur cet appareil', '', installer, 'Installer le site comme une application (écran d\'accueil, plein écran)'));
    plus.append(contenu);
    zone.append(choixHeros, onglets, mini, menuAlertes(), plus);
    majMiniChrono();
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

  // ---------- mini chrono (barre du haut) ----------

  function majMiniChrono() {
    const z = document.getElementById('mini-chrono');
    if (!z || !D) return;
    const c = tempsChrono();
    z.textContent = c.lance ? fmt(c.t) + ' · ' + phaseA(c.t).nom : '';
    z.hidden = !c.lance || affichage.onglet === 'jeu';
  }

  // ---------- onglet Objectifs : ce qu'il faut faire, et quand ----------

  function occurrences(ev, de, a) {
    const liste = [];
    if (ev.type === 'unique') { if (ev.temps_s >= de && ev.temps_s <= a) liste.push({ t: ev.temps_s }); }
    else if (ev.type === 'recurrent') { for (let t = ev.temps_s; t <= a; t += ev.intervalle_s) if (t >= de) liste.push({ t: t }); }
    else if (ev.type === 'fenetre') { if (ev.fin_s >= de && ev.debut_s <= a) liste.push({ t: ev.debut_s, fin: ev.fin_s }); }
    return liste;
  }

  function dessinerObjectifs() {
    const zone = document.getElementById('objectifs-vue');
    if (!zone || !D || affichage.onglet !== 'objectifs') return;
    const chrono = tempsChrono();
    const t = chrono.t;
    const r = roleCourant();
    const prio = r && D.conseils.roles[r] ? D.conseils.roles[r].priorites : [];
    const de = Math.max(0, t - 60), a = t + 20 * 60;
    const lignes = [];
    D.timeline.evenements.filter((e) => niveauOk(e.id)).forEach((e) => occurrences(e, de, a).forEach((o) => lignes.push({ e: e, t: o.t, fin: o.fin })));
    D.timeline.phases.forEach((p) => { if (p.debut_s > de && p.debut_s <= a) lignes.push({ phase: p, t: p.debut_s }); });
    lignes.sort((x, y) => x.t - y.t || (x.phase ? -1 : 1));

    zone.textContent = '';
    const tete = el('div', 'obj-tete');
    tete.append(el('h2', null, 'Objectifs'), el('span', 'aide', chrono.lance ? 'les 20 prochaines minutes' : 'lance le chrono pour suivre la partie'));
    if (r) tete.append(el('span', 'aide', '★ = compte pour ton rôle (' + roleDe(r).nom.toLowerCase() + ')'));
    zone.append(tete);
    const ul = el('ol', 'obj-liste');
    lignes.forEach((l) => {
      if (l.phase) {
        const li = el('li', 'obj-phase');
        li.append(el('span', 'obj-heure', fmt(l.t)), el('strong', null, l.phase.nom), el('span', 'obj-texte', l.phase.resume));
        ul.append(li);
        return;
      }
      const passe = (l.fin || l.t) < t;
      const proche = !passe && l.t - t <= 60;
      const mien = prio.indexOf(l.e.id) !== -1;
      const li = el('li', 'obj-ligne' + (passe ? ' passe' : '') + (proche ? ' proche' : '') + (mien ? ' mien' : '') + (l.e.annonce_avant_s > 0 ? '' : ' info'));
      li.style.setProperty('--cat', 'var(--cat-' + l.e.categorie + ', var(--doux))');
      const heure = (l.e.fiabilite === 'incertain' ? '≈ ' : '') + fmt(l.t) + (l.fin ? '–' + fmt(l.fin) : '');
      const quand = !chrono.lance ? '' : passe ? 'passé' : l.t <= t ? 'maintenant' : 'dans ' + fmt(l.t - t);
      const nom = el('strong', 'obj-nom', (mien ? '★ ' : '') + l.e.nom.split(' (')[0]);
      li.append(el('span', 'obj-heure', heure), nom, el('span', 'obj-quand', quand));
      if (l.e.conseil || l.e.detail) li.append(el('span', 'obj-texte', l.e.conseil || l.e.detail));
      ul.append(li);
    });
    zone.append(ul);
    const proche = ul.querySelector('.obj-ligne:not(.passe)');
    if (proche && !zone.dataset.defile) { zone.dataset.defile = '1'; proche.scrollIntoView({ block: 'center' }); }
  }

  // ---------- onglet Mort : la compo d'en face et comment la jouer ----------

  function enFaceIds() {
    try { return (JSON.parse(localStorage.getItem(CLE_ENFACE)) || []).filter((id) => herosDe(id)); } catch (e) { return []; }
  }

  function tendanceTempo(id) {
    const tr = ((D.tempo || {}).tranches || {}).tous || {};
    const d = (tr[String(id)] || {}).durees;
    if (!d || d.length < 3 || d[0].winrate == null || d[2].winrate == null) return null;
    const ecart = d[2].winrate - d[0].winrate, marge = Math.sqrt(d[0].marge * d[0].marge + d[2].marge * d[2].marge);
    return ecart > marge ? 'tard' : ecart < -marge ? 'tot' : null;
  }

  function dessinerCompo() {
    const zone = document.getElementById('compo');
    if (!zone || !D) return;
    zone.textContent = '';
    const titre = el('h2', null, 'Comment jouer leur compo ');
    titre.append(el('span', 'marque', 'conseil'));
    zone.append(titre);
    const ids = enFaceIds();
    if (!ids.length) {
      zone.append(el('p', 'aide', 'Ajoute les héros d\'en face (panneau « En face », bouton +) dès l\'écran de chargement.'));
      return;
    }
    const menaces = (id) => ((D.counters.heros[String(id)] || {}).menaces || []).map((m) => m.id);
    const ul = el('ul', 'compo-points');
    const point = (fort, texte) => { const li = el('li'); li.append(el('strong', null, fort + ' '), texte); ul.append(li); };

    // 1. Leurs dégâts → la résistance à acheter en premier
    const arme = ids.filter((id) => menaces(id).indexOf('tir') !== -1).length;
    const sorts = ids.filter((id) => menaces(id).indexOf('sorts') !== -1).length;
    if (arme > sorts) point('Ils tirent surtout :', arme + ' héros à l\'arme contre ' + sorts + ' aux compétences → Bullet Resist en priorité (objets Vitality).');
    else if (sorts > arme) point('Ils jouent surtout aux compétences :', sorts + ' héros spirit contre ' + arme + ' à l\'arme → Spirit Resist en priorité (objets Vitality).');
    else if (arme + sorts) point('Dégâts mixtes :', 'autant d\'arme que de compétences → équilibre tes résistances.');

    // 2. Leur rythme de partie
    const tard = ids.filter((id) => tendanceTempo(id) === 'tard').map((id) => herosDe(id).nom);
    const tot = ids.filter((id) => tendanceTempo(id) === 'tot').map((id) => herosDe(id).nom);
    if (tard.length > tot.length) point('Ils gagnent plus souvent quand ça dure :', tard.join(', ') + ' → pousse les objectifs tôt, ne laisse pas traîner.');
    else if (tot.length > tard.length) point('Ils sont forts tôt :', tot.join(', ') + ' → joue prudent au début, la fin de partie est pour toi.');

    // 3. Les réflexes qui changent un combat
    const avec = (id) => ids.filter((x) => menaces(x).indexOf(id) !== -1).map((x) => herosDe(x).nom);
    if (avec('canalisation').length) point('Garde un stun :', 'pour couper l\'ultimate de ' + avec('canalisation').join(', ') + ' (Knockdown, Cursed Relic).');
    if (avec('soin').length) point('Anti-soin :', avec('soin').join(', ') + ' se soigne beaucoup → Healbane ou Toxic Bullets.');
    if (avec('invisibilite').length) point('Invisible :', avec('invisibilite').join(', ') + ' → reste près d\'un allié, surveille la minimap.');
    if (avec('controle').length >= 3) point('Beaucoup de contrôles :', 'pense à Reactive Barrier, puis Dispel Magic ou Unstoppable.');

    // 4. Rappel du rôle
    const r = roleCourant();
    const c = tempsChrono();
    if (r && D.conseils.roles[r]) point('Toi (' + roleDe(r).nom.toLowerCase() + ') :', D.conseils.roles[r].phases[phaseA(c.t).nom] || '');
    zone.append(ul);
  }

  // ---------- notes perso sur les adversaires ----------
  // Gardées d'une partie à l'autre dans le navigateur (dln.notes.v1), avec la minute de la partie.

  const CLE_NOTES = 'dln.notes.v1';
  const lireNotes = () => { try { return JSON.parse(localStorage.getItem(CLE_NOTES)) || {}; } catch (e) { return {}; } };

  function dessinerNotes() {
    const zone = document.getElementById('notes');
    if (!zone || !D) return;
    if (zone.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return;   // pas pendant la saisie
    zone.textContent = '';
    zone.append(el('h2', null, 'Mes notes sur eux'));
    const ids = enFaceIds();
    if (!ids.length) { zone.append(el('p', 'aide', 'Les héros d\'en face apparaîtront ici : note ce qui te tue, ce qui marche contre eux.')); return; }
    const notes = lireNotes();
    ids.forEach((id) => {
      const h = herosDe(id);
      const bloc = el('div', 'note-heros');
      const tete = el('div', 'note-tete');
      tete.append(DLN.img(h.icone || h.image), el('strong', null, h.nom));
      bloc.append(tete);
      if (DLN.etiquettes) bloc.append(DLN.etiquettes.editeur(id));
      const form = el('form', 'note-form');
      const champ = el('input');
      champ.type = 'text';
      champ.placeholder = 'Ex. : m\'attend derrière le Walker, garde son stun pour…';
      champ.setAttribute('aria-label', 'Note sur ' + h.nom);
      form.append(champ, bouton('Noter', '', () => form.requestSubmit()));
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const texte = champ.value.trim();
        if (!texte) return;
        const n = lireNotes();
        const c = tempsChrono();
        (n[id] = n[id] || []).unshift({ texte: texte, minute: c.lance ? fmt(c.t) : null, date: new Date().toISOString().slice(0, 10) });
        ecrire(CLE_NOTES, n);
        champ.value = '';
        champ.blur();
        dessinerNotes();
      });
      bloc.append(form);
      const liste = el('ul', 'note-liste');
      (notes[id] || []).slice(0, 6).forEach((n, i) => {
        const li = el('li');
        li.append(el('span', 'aide', (n.minute ? n.minute + ' · ' : '') + n.date.slice(5).split('-').reverse().join('/')), el('span', null, n.texte));
        li.append(bouton('×', 'discret note-suppr', () => { const all = lireNotes(); all[id].splice(i, 1); ecrire(CLE_NOTES, all); dessinerNotes(); }, 'Supprimer cette note'));
        liste.append(li);
      });
      bloc.append(liste);
      zone.append(bloc);
    });
  }

  // ---------- « À venir » en un objectif à la fois (onglet En jeu) ----------
  // Les cartes restent celles du chrono (js/timeline.js) ; ici on n'en montre qu'une, en grand,
  // qui tourne toutes les ROTATION_S secondes. Un objectif en alerte ou en cours reste affiché.

  const ROTATION_S = 6;
  let indexVue = 0, prochaineRotation = 0, pauseJusqua = 0;

  function points(cartes, active) {
    let z = document.getElementById('avenir-points');
    if (!z) {
      z = el('div', 'avenir-points');
      z.id = 'avenir-points';
      z.setAttribute('role', 'tablist');
      const liste = document.getElementById('avenir');
      if (liste) liste.after(z);
    }
    if (z.childElementCount !== cartes.length) {
      z.textContent = '';
      cartes.forEach((c, i) => {
        const b = el('button', 'avenir-point');
        b.type = 'button';
        b.setAttribute('role', 'tab');
        b.addEventListener('click', () => { indexVue = i; pauseJusqua = Date.now() + 15000; tourner(true); b.blur(); });
        z.append(b);
      });
    }
    Array.prototype.forEach.call(z.children, (b, i) => {
      b.setAttribute('aria-selected', String(i === active));
      const nom = cartes[i] && cartes[i].querySelector('.carte-nom');
      b.title = nom ? nom.textContent : '';
    });
  }

  function tourner(force) {
    const epure = affichage.onglet === 'jeu';
    const toutes = Array.prototype.slice.call(document.querySelectorAll('#avenir > li'));
    if (!epure) { toutes.forEach((c) => { delete c.dataset.vue; }); const z = document.getElementById('avenir-points'); if (z) z.hidden = true; return; }
    const cartes = toutes.filter((c) => !c.hidden);
    if (!cartes.length) return;
    const urgente = cartes.findIndex((c) => /\b(alerte|maintenant|ouverte)\b/.test(c.className));
    const maintenant = Date.now();
    if (urgente !== -1 && maintenant > pauseJusqua) indexVue = urgente;
    else if (force !== true && maintenant >= prochaineRotation && maintenant > pauseJusqua) {
      indexVue = (indexVue + 1) % cartes.length;
      prochaineRotation = maintenant + ROTATION_S * 1000;
    }
    if (indexVue >= cartes.length) indexVue = 0;
    if (force === true) prochaineRotation = maintenant + ROTATION_S * 1000;
    toutes.forEach((c) => { if (c === cartes[indexVue]) c.dataset.vue = '1'; else delete c.dataset.vue; });
    const z = document.getElementById('avenir-points');
    points(cartes, indexVue);
    if (z) z.hidden = cartes.length < 2;
  }

  // Chrono minimal : les commandes se déplient au survol ; au toucher, un appui sur l'heure les ouvre.
  function preparerHorloge() {
    const h = document.querySelector('.horloge');
    if (!h || h.dataset.pret) return;
    h.dataset.pret = '1';
    const temps = h.querySelector('.horloge-ligne');
    if (temps) {
      temps.setAttribute('title', 'Survoler (ou toucher) pour régler le chrono');
      temps.addEventListener('click', () => h.classList.toggle('ouvert'));
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
    if (alertes.flash) flash(ev, restant, texte);
    // Le préavis sonne déjà via le chrono ; l'apparition a son propre son, si le son est activé.
    const son = document.getElementById('opt-son');
    if (restant <= 1 && son && son.checked && DLN.sons) DLN.sons.jouer('maintenant');
    if (alertes.vibre && navigator.vibrate) { try { navigator.vibrate([250, 120, 250, 120, 400]); } catch (e) { /* pas de vibration */ } }
    if (alertes.notif) notifier(titre, texte, ev.id);
  }

  // Carte plein écran : couleur de la catégorie, nom et délai en très grand, le conseil dessous.
  function flash(ev, restant, texte) {
    let z = document.getElementById('alerte-flash');
    if (!z) {
      z = el('div', 'alerte-flash');
      z.id = 'alerte-flash';
      z.setAttribute('role', 'alert');
      z.addEventListener('click', () => { z.hidden = true; });
      document.body.append(z);
    }
    z.textContent = '';
    z.style.setProperty('--cat', 'var(--cat-' + (ev.categorie || 'objectif') + ', var(--alerte))');
    const carte = el('div', 'alerte-carte');
    carte.append(el('div', 'alerte-nom', ev.nom.split(' (')[0]),
      el('div', 'alerte-delai', restant > 1 ? 'dans ' + Math.round(restant) + ' s' : 'maintenant'));
    if (texte) carte.append(el('div', 'alerte-texte', texte));
    carte.append(el('div', 'alerte-aide', 'toucher pour fermer'));
    z.append(carte);
    z.hidden = false;
    z.classList.remove('anime');
    void z.offsetWidth;                // relance l'animation
    z.classList.add('anime');
    clearTimeout(flash.minuteur);
    flash.minuteur = setTimeout(() => { z.hidden = true; }, 6000);
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
      if (c && c.checked) setTimeout(() => (DLN.voix ? DLN.voix.annoncer(ev.nom, 30) : null), DLN.sons ? DLN.sons.duree('preavis') * 1000 : 0);
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
  Promise.all(['data/heroes.json', 'data/roles.json', 'data/conseils-roles.json', 'data/timeline.json', 'data/heros-details.json', 'data/map.json', 'data/counters.json']
    .map(DLN.charger).concat([DLN.charger('data/niveaux.json').catch(() => null), DLN.charger('data/tempo.json').catch(() => null)])).then((r) => {
    D = { heros: r[0], roles: r[1], conseils: r[2], timeline: r[3], details: r[4], carte: r[5], counters: r[6], niveaux: r[7], tempo: r[8] };
    dessinerContexte();
    dessinerPlan();
    ecouteurs.forEach((f) => f());
    setInterval(dessinerPlan, 1000);
    setInterval(surveiller, 500);
    setInterval(tourner, 500);
    setInterval(() => { majMiniChrono(); dessinerObjectifs(); }, 1000);
    appliquerAffichage();
    preparerHorloge();
    DLN.surNiveau(dessinerPlan);
    if (DLN.orientationCarte) DLN.orientationCarte.surChange(dessinerContexte);
    window.addEventListener('storage', (e) => {
      if (e.key === CLE_ENFACE || e.key === CLE_CHRONO) dessinerPlan();
      if (e.key === CLE_ENFACE && affichage.onglet === 'mort') { dessinerCompo(); dessinerNotes(); }
    });
    // Le panneau En face (js/enface.js) écrit la liste dans ce même onglet : on suit ses changements.
    let derniereListe = localStorage.getItem(CLE_ENFACE);
    setInterval(() => {
      const l = localStorage.getItem(CLE_ENFACE);
      if (l !== derniereListe) { derniereListe = l; if (affichage.onglet === 'mort') { dessinerCompo(); dessinerNotes(); } dessinerPlan(); }
    }, 700);
  }).catch(() => { /* la page reste utilisable sans le plan */ });
})();
