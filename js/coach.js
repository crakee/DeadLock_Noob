// Coach de la page En partie : des recommandations qui suivent le chrono, sans rien à cliquer en jouant.
// « À faire maintenant » = le prochain objectif qui compte pour ton rôle (data/coach.json), sinon l'achat
// du moment pour ton héros (data/achats.json, à défaut data/tempo.json), sinon le conseil du rôle pour la
// phase (data/conseils-roles.json). En dessous, le rappel de tes difficultés habituelles (leçons de
// data/lecons.json repérées par la page Parties ou choisies ici, cadence dans data/rappels.json) et les
// prochaines recos minutées. Expose DLN.coach.texteObjectif pour la liste des objectifs.
(function () {
  'use strict';

  const el = DLN.el;
  const CLE_CHRONO = 'dln.timeline.etat.v1';
  const CLE_DIFFICULTES = 'dln.coach.difficultes.v1';
  const LANES = { yellow: 'Yellow', blue: 'Blue', green: 'Green' };
  const ACHAT_AVANT_S = 30;    // un achat devient « à faire » 30 s avant la minute moyenne des joueurs…
  const ACHAT_APRES_S = 90;    // … et le reste 90 s après
  const RAPPEL_FRAIS_S = 12;   // un rappel de difficulté est mis en avant 12 s après son heure
  const NB_PROCHAINS = 5;

  let C = null, timeline = null, conseils = null, niveaux = null, achats = null, tempo = null, heros = null, rappels = null, lecons = [];

  const fmt = (s) => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const nomCourt = (ev) => ev.nom.split(' (')[0];

  function tempsChrono() {
    try {
      const e = JSON.parse(localStorage.getItem(CLE_CHRONO)) || {};
      if (e.depart != null) return { t: Math.max(0, (Date.now() - e.depart) / 1000), lance: true };
      if (e.pauseA != null) return { t: e.pauseA, lance: true };
    } catch (err) { /* stockage indisponible */ }
    return { t: 0, lance: false };
  }

  const ctx = () => (DLN.partieContexte ? DLN.partieContexte.get() : {});
  const niveauOk = (id) => { const n = niveaux && niveaux.evenements ? niveaux.evenements[id] : null; return n == null || n <= DLN.niveau(); };

  function phaseA(t) {
    let p = timeline.phases[0];
    timeline.phases.forEach((x) => { if (t >= x.debut_s) p = x; });
    return p;
  }

  function prochaine(ev, t) {
    if (ev.type === 'unique') return ev.temps_s >= t - 20 ? ev.temps_s : null;
    if (ev.type === 'recurrent') { const n = Math.max(0, Math.ceil((t - 20 - ev.temps_s) / ev.intervalle_s)); return ev.temps_s + n * ev.intervalle_s; }
    if (ev.type === 'fenetre') return t <= ev.fin_s ? ev.debut_s : null;
    return null;
  }

  // Ce que TU fais pour un objectif, selon ton rôle (texte du rôle, sinon de son côté de carte).
  function texteObjectif(idEv, role, cote) {
    const o = C && C.objectifs_roles[idEv];
    if (!o) return null;
    return o[role] || o[cote] || null;
  }

  // ---------- difficultés habituelles ----------
  // Choix manuel s'il existe, sinon le focus et les leçons recommandées par la page Parties, sinon `defaut`.

  function difficultes() {
    let manuel = null;
    try { manuel = JSON.parse(localStorage.getItem(CLE_DIFFICULTES)); } catch (e) { manuel = null; }
    if (Array.isArray(manuel)) return { ids: manuel, source: 'manuel' };
    const e = DLN.coachEtat ? DLN.coachEtat.lire() : {};
    const ids = [e.focus].concat(e.recommandees || []).filter((x, i, a) => x && a.indexOf(x) === i);
    if (ids.length) return { ids: ids, source: 'parties' };
    return { ids: (rappels && rappels.defaut) || [], source: 'defaut' };
  }

  function choisirDifficultes(ids) {
    try {
      if (ids == null) localStorage.removeItem(CLE_DIFFICULTES);
      else localStorage.setItem(CLE_DIFFICULTES, JSON.stringify(ids));
    } catch (e) { /* stockage indisponible */ }
    dessiner(true);
  }

  // Le rappel du moment : parmi les difficultés actives à t, celle dont l'heure de rappel est la plus récente.
  function rappelDuMoment(t) {
    const d = difficultes();
    let meilleur = null;
    d.ids.forEach((id) => {
      const r = rappels && rappels.lecons[id];
      const l = lecons.find((x) => x.id === id);
      if (!r || !l || t < r.de_s || (r.a_s != null && t > r.a_s)) return;
      const dernier = r.de_s + Math.floor((t - r.de_s) / r.toutes_s) * r.toutes_s;
      if (!meilleur || dernier > meilleur.dernier) meilleur = { l: l, dernier: dernier, prochain: dernier + r.toutes_s };
    });
    return meilleur;
  }

  // ---------- achats de mon héros ----------

  function achatsDe(idHeros) {
    if (!idHeros) return [];
    const tr = DLN.tranche();
    const min = (rappels && rappels.achat_min_pct) || 30;
    const a = achats && ((achats.tranches[tr] || achats.tranches.tous || {})[String(idHeros)]);
    if (a && a.objets.length) {
      return a.objets.filter((o) => o.achete_par >= min).map((o) => ({ nom: o.nom, cout: o.cout, pct: o.achete_par, t: Math.round(o.minute * 60) }));
    }
    const k = tempo && ((tempo.tranches[tr] && tempo.tranches[tr][String(idHeros)]) || (tempo.tranches.tous || {})[String(idHeros)]);
    return k && k.objets_cles ? k.objets_cles.map((o) => ({ nom: o.nom, cout: o.cout, pct: o.achete_par, t: Math.round(o.minute * 60), cle: true })) : [];
  }

  // ---------- recommandations ----------

  function recos() {
    const c = tempsChrono();
    const t = c.t;
    const x = ctx();
    const role = x.role;
    const cote = x.cote || 'centre';
    const phase = phaseA(t);
    const nomHeros = x.heros ? ((heros.heros.find((h) => h.id === x.heros) || {}).nom || '') : '';
    const dans = (q) => (q <= t ? 'maintenant' : (c.lance ? 'dans ' + fmt(q - t) : 'à ' + fmt(q)));
    const diff = difficultes().ids;

    // Objectifs qui comptent pour le rôle, prochaine apparition de chacun.
    const prio = x.priorites || ['small_camps', 'medium_camps', 'powerups', 'urn', 'sinners', 'large_camps', 'rift'];
    const objectifs = prio.map((id) => timeline.evenements.find((e) => e.id === id)).filter((e) => e && niveauOk(e.id))
      .map((e) => ({ e: e, t: prochaine(e, t) })).filter((a) => a.t != null && !(a.e.categorie === 'jungle' && a.t < t))
      .map((a) => ({
        type: 'objectif', t: a.t, cle: 'o:' + a.e.id + ':' + a.t,
        titre: nomCourt(a.e) + (a.e.fiabilite === 'incertain' ? ' (≈)' : ''),
        texte: texteObjectif(a.e.id, role, cote) || a.e.conseil || ''
      }));

    // Achats : minute moyenne des joueurs du héros ; un rappel en plus si les souls dormantes sont une difficulté.
    const souls = diff.indexOf('souls-dormantes') !== -1;
    const listeAchats = achatsDe(x.heros).filter((o) => o.t >= t - ACHAT_APRES_S).map((o) => ({
      type: 'achat', t: o.t, cle: 'a:' + o.nom, pct: o.pct,
      titre: 'Acheter ' + o.nom + (o.cout ? ' (' + DLN.fmtNombre(o.cout) + ')' : ''),
      texte: o.pct + ' % des joueurs de ' + nomHeros + ' le prennent, en moyenne vers ' + fmt(o.t) + '.' +
        (souls ? ' Dès que tu as les souls, file au shop le plus proche.' : '')
    }));

    const toutes = objectifs.concat(listeAchats).sort((a, b) => a.t - b.t);

    // À faire maintenant : objectif proche, sinon achat du moment, sinon conseil du rôle pour la phase.
    let action = toutes.find((r) => r.type === 'objectif' && r.t - t <= C.proche_s && r.t - t > -20);
    if (!action) action = listeAchats.find((r) => r.t - t <= ACHAT_AVANT_S && t - r.t <= ACHAT_APRES_S);
    if (action) action = Object.assign({}, action, { quand: dans(action.t) });
    else {
      const rp = role && conseils.roles[role] ? conseils.roles[role].phases[phase.nom] : conseils.commun[phase.nom];
      action = { type: 'phase', titre: rp || phase.resume, texte: phase.nom + ' · ' + phase.resume + (x.lane ? ' Ta lane : ' + LANES[x.lane] + '.' : '') };
    }

    // Les objectifs ont leur propre liste sur le même écran : ici, les prochains achats seulement.
    const prochains = listeAchats.filter((r) => r.cle !== action.cle && r.t >= t - 5).slice(0, NB_PROCHAINS)
      .map((r) => Object.assign({}, r, { quand: dans(r.t) }));
    return { c: c, t: t, phase: phase, action: action, prochains: prochains, rappel: rappelDuMoment(t), sansAchats: x.heros && !listeAchats.length && !achatsDe(x.heros).length, x: x };
  }

  // ---------- affichage ----------

  let z = null;   // zones du panneau

  // Focus choisi sur la page Parties (dln.coach.focus.v1) : son rappel s'affiche pendant la phase qu'il concerne.
  const PHASES_FOCUS = { lane: 'Laning', milieu: 'Mid-game', fin: 'Late-game' };

  function construire(zone) {
    zone.textContent = '';
    const tete = el('div', 'coach-tete');
    const h2 = el('h2', null, 'Coach ');
    h2.append(el('span', 'marque', 'conseil'));
    z = { phase: el('span', 'coach-phase') };
    tete.append(h2, z.phase);
    const carte = el('div', 'coach-carte');
    z.label = el('div', 'coach-label');
    z.action = el('div', 'coach-action');
    z.pourquoi = el('div', 'coach-pourquoi');
    carte.append(z.label, z.action, z.pourquoi);
    z.rappel = el('div', 'coach-rappel');
    z.prochains = el('ol', 'coach-prochains');
    z.prochainsTitre = el('h3', 'coach-prochains-titre', 'Tes prochains achats');
    z.difficultes = el('details', 'coach-difficultes');
    zone.append(tete, carte, z.rappel, z.prochainsTitre, z.prochains, z.difficultes);
    construireDifficultes();
  }

  // Choix des difficultés : cases à cocher, rangées par domaine. Se règle avant la partie.
  function construireDifficultes() {
    const d = difficultes();
    const ouvert = z.difficultes.open;
    z.difficultes.textContent = '';
    const resume = el('summary');
    const noms = d.ids.map((id) => (lecons.find((l) => l.id === id) || {}).titre).filter(Boolean);
    resume.append(el('strong', null, 'Tes difficultés'), ' · ' + (noms.length ? noms.join(', ') : 'aucune'));
    z.difficultes.append(resume);
    const corps = el('div', 'coach-difficultes-corps');
    corps.append(el('p', 'aide', d.source === 'parties' ? 'Repérées d\'après tes parties (page Parties). Coche pour changer.'
      : d.source === 'manuel' ? 'Choisies à la main.' : 'Choix par défaut pour débuter : coche ce qui te pose problème.'));
    const grille = el('div', 'coach-difficultes-grille');
    lecons.filter((l) => rappels.lecons[l.id]).forEach((l) => {
      const label = el('label');
      const c = el('input');
      c.type = 'checkbox';
      c.checked = d.ids.indexOf(l.id) !== -1;
      c.addEventListener('change', () => {
        const ids = difficultes().ids.filter((x) => x !== l.id);
        if (c.checked) ids.push(l.id);
        choisirDifficultes(ids);
        c.blur();
      });
      label.append(c, ' ' + l.titre);
      grille.append(label);
    });
    corps.append(grille);
    if (d.source === 'manuel') {
      const b = el('button', 'btn discret', 'Reprendre celles de mes parties');
      b.type = 'button';
      b.addEventListener('click', () => { choisirDifficultes(null); b.blur(); });
      corps.append(b);
    }
    z.difficultes.append(corps);
    z.difficultes.open = ouvert;
  }

  function dessinerRappel(r) {
    z.rappel.textContent = '';
    let f = null;
    try { f = JSON.parse(localStorage.getItem('dln.coach.focus.v1')); } catch (e) { f = null; }
    const focusActif = f && (f.phase === 'toujours' || PHASES_FOCUS[f.phase] === r.phase.nom);
    const m = r.rappel;
    // Le focus de la page Parties passe avant les autres difficultés pendant sa phase.
    const l = focusActif ? { id: f.id, titre: f.titre, en_partie: { rappel: f.rappel } } : (m ? m.l : null);
    z.rappel.hidden = !l || !r.c.lance;
    if (z.rappel.hidden) return;
    const frais = focusActif ? (m && m.l.id === f.id && r.t - m.dernier < RAPPEL_FRAIS_S) : (r.t - m.dernier < RAPPEL_FRAIS_S);
    z.rappel.classList.toggle('frais', Boolean(frais));
    const lien = el('a', 'coach-rappel-titre', (focusActif ? 'Ton focus · ' : 'Ta difficulté · ') + l.titre);
    lien.href = 'parcours.html#l=' + encodeURIComponent(l.id);
    z.rappel.append(lien, el('span', 'coach-rappel-texte', l.en_partie.rappel));
  }

  let derniereCle = null;

  function dessiner(reconstruire) {
    const zone = document.getElementById('coach');
    if (!zone || !C || !timeline || !rappels) return;
    if (!z || !zone.contains(z.action)) construire(zone);
    else if (reconstruire === true) construireDifficultes();
    const r = recos();
    z.phase.textContent = r.c.lance ? fmt(r.t) + ' · ' + r.phase.nom : '';
    const a = r.action;
    z.label.textContent = a.type === 'objectif' ? 'Objectif ' + a.quand : a.type === 'achat' ? 'Achat · ' + a.quand : 'À faire maintenant';
    z.action.textContent = a.titre;
    z.action.classList.toggle('long', a.titre.length > 55);
    z.pourquoi.textContent = a.texte;
    zone.classList.toggle('objectif', a.type === 'objectif');
    zone.classList.toggle('achat', a.type === 'achat');
    // Petit son au moment où un achat devient « à faire » (si le son du chrono est activé).
    if (a.type === 'achat' && a.cle !== derniereCle && r.c.lance) {
      const son = document.getElementById('opt-son');
      if (derniereCle !== null && son && son.checked && DLN.sons) DLN.sons.jouer('preavis');
    }
    derniereCle = a.cle || null;
    dessinerRappel(r);

    z.prochains.textContent = '';
    r.prochains.forEach((p) => {
      const li = el('li', 'coach-prochain ' + p.type);
      li.append(el('span', 'coach-prochain-quand', '≈ ' + fmt(p.t)), el('strong', null, p.titre.replace(/^Acheter /, '')), el('span', 'coach-prochain-pct', p.pct + ' %'));
      li.title = p.texte;
      z.prochains.append(li);
    });
    z.prochainsTitre.hidden = !r.prochains.length;
    if (r.sansAchats) z.prochains.append(el('li', 'aide', 'Pas de données d\'achat pour ce héros : regarde l\'onglet Builds de sa fiche.'));
    else if (!r.x.heros) z.prochains.append(el('li', 'aide', 'Choisis ton héros en haut : le coach ajoute ses achats habituels, minute par minute.'));
  }

  DLN.coach = { texteObjectif: texteObjectif, redessiner: dessiner };

  Promise.all(['data/coach.json', 'data/timeline.json', 'data/conseils-roles.json', 'data/heroes.json', 'data/rappels.json'].map(DLN.charger)
    .concat([DLN.charger('data/niveaux.json').catch(() => null), DLN.charger('data/achats.json').catch(() => null),
      DLN.charger('data/tempo.json').catch(() => null), DLN.coachEtat.lecons().catch(() => ({ lecons: [] }))])).then((r) => {
    C = r[0]; timeline = r[1]; conseils = r[2]; heros = r[3]; rappels = r[4]; niveaux = r[5]; achats = r[6]; tempo = r[7]; lecons = r[8].lecons;
    dessiner();
    setInterval(dessiner, 1000);
    DLN.surNiveau(dessiner);
    DLN.surTranche(dessiner);
    if (DLN.partieContexte) DLN.partieContexte.surChange(dessiner);
    window.addEventListener('storage', (e) => { if (e.key === CLE_DIFFICULTES || e.key === 'dln.coach.v1') dessiner(true); });
  }).catch(() => { /* la page reste utilisable sans coach */ });
})();
