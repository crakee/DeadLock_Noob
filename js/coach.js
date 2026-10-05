// Coach de la page En partie : « à faire maintenant », avec le pourquoi, selon l'état que le joueur
// indique d'un clic (sa wave, sa vie, ses souls, le score), son style, son rôle et sa lane
// (js/partie.js) et les objectifs qui arrivent (data/timeline.json). Les règles et les textes sont
// dans data/coach.json (avis de joueur, guides de Wouks) : ce fichier ne fait que les appliquer.
// Expose DLN.coach.texteObjectif pour l'onglet Objectifs.
(function () {
  'use strict';

  const el = DLN.el;
  const CLE = 'dln.coach.etat.v1';
  const CLE_CHRONO = 'dln.timeline.etat.v1';
  const LIBERTE_S = 45;        // « wave poussée » redevient « au milieu » après 45 s de jeu (le temps de liberté)
  const LANES = { yellow: 'Yellow', blue: 'Blue', green: 'Green' };

  let C = null, timeline = null, conseils = null, niveaux = null, achats = null, heros = null;
  let etat = {};
  try { etat = JSON.parse(localStorage.getItem(CLE)) || {}; } catch (e) { etat = {}; }
  const sauver = () => { try { localStorage.setItem(CLE, JSON.stringify(etat)); } catch (e) { /* stockage indisponible */ } };

  const fmt = (s) => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

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

  // ---------- état indiqué par le joueur ----------

  function valeur(id) {
    const def = C.etats.find((x) => x.id === id);
    let v = etat[id] || (def && def.defaut);
    // Une wave poussée ne le reste pas : après le temps de liberté, on repose la question.
    if (id === 'wave' && v === 'poussee' && etat.wave_t != null) {
      const c = tempsChrono();
      if (c.lance && c.t - etat.wave_t > LIBERTE_S) { v = 'milieu'; etat.wave = 'milieu'; sauver(); }
    }
    return v;
  }

  function regler(id, v) {
    etat[id] = v;
    if (id === 'wave') etat.wave_t = tempsChrono().t;
    sauver();
    dessiner();
  }

  // ---------- règles ----------

  function situation() {
    const c = tempsChrono();
    const t = c.t;
    const x = ctx();
    const role = x.role;
    const cote = x.cote || 'centre';
    const prio = x.priorites || ['small_camps', 'medium_camps', 'powerups', 'urn', 'sinners', 'large_camps', 'rift'];
    const evs = prio.map((id) => timeline.evenements.find((e) => e.id === id)).filter((e) => e && niveauOk(e.id));
    const proches = evs.map((e) => ({ e: e, quand: prochaine(e, t) })).filter((a) => a.quand != null)
      .sort((a, b) => a.quand - b.quand);
    const proche = proches.find((a) => a.quand - t <= C.proche_s && a.quand - t > -20 && !(a.e.categorie === 'jungle' && a.quand <= t));
    const camps = timeline.evenements.filter((e) => e.categorie === 'jungle' && e.type === 'unique' && e.temps_s <= t && niveauOk(e.id)
      && (!x.priorites || x.priorites.indexOf(e.id) !== -1));
    return { c: c, t: t, x: x, role: role, cote: cote, phase: phaseA(t), proche: proche, suivants: proches, camps: camps };
  }

  function vrai(si, s) {
    return Object.keys(si).every((k) => {
      const v = si[k];
      const liste = (val) => (Array.isArray(v) ? v.indexOf(val) !== -1 : v === val);
      if (k === 'phase') return liste(s.phase.nom);
      if (k === 'cote') return liste(s.cote);
      if (k === 'role') return liste(s.role);
      if (k === 'objectif_proche') return Boolean(s.proche) === v;
      if (k === 'camps_ouverts') return (s.camps.length > 0) === v;
      if (k === 'style') return liste(etat.style || 'equilibre');
      if (k === 'style_pas') return !liste(etat.style || 'equilibre');
      return liste(valeur(k));
    });
  }

  function objetsDuMoment(s) {
    const h = s.x.heros;
    if (!h || !achats) return '';
    const tranche = achats.tranches[DLN.tranche()] ? DLN.tranche() : 'tous';
    const a = (achats.tranches[tranche] || {})[String(h)];
    if (!a) return '';
    const minute = s.t / 60;
    const prochains = a.objets.filter((o) => o.minute >= minute - 1).sort((p, q) => p.minute - q.minute).slice(0, 2);
    if (!prochains.length) return '';
    const nom = (heros.heros.find((x) => x.id === h) || {}).nom;
    return 'À ce moment, les joueurs de ' + nom + ' achètent souvent : ' + prochains.map((o) => o.nom).join(', ') + '.';
  }

  function remplir(texte, s) {
    const rolePhase = s.role && conseils.roles[s.role] ? conseils.roles[s.role].phases[s.phase.nom] : conseils.commun[s.phase.nom];
    return texte
      .replace('{objectif}', s.proche ? s.proche.e.nom.split(' (')[0] : '')
      .replace('{dans}', s.proche ? (s.proche.quand <= s.t ? 'maintenant' : (s.c.lance ? 'dans ' + fmt(s.proche.quand - s.t) : 'à ' + fmt(s.proche.quand))) : '')
      .replace('{role_objectif}', s.proche ? (texteObjectif(s.proche.e.id, s.role, s.cote) || s.proche.e.conseil || '') : '')
      .replace('{camps}', s.camps.map((e) => e.nom.split(' (')[0]).join(', ') + (s.x.lane && s.cote === 'lane' ? ' côté ' + LANES[s.x.lane] : ''))
      .replace('{lane}', s.x.lane ? LANES[s.x.lane] : '')
      .replace('{objet}', objetsDuMoment(s))
      .replace('{role_phase}', rolePhase || s.phase.resume || '')
      .replace(/\s+/g, ' ').trim();
  }

  function conseil() {
    const s = situation();
    const regle = C.regles.find((r) => vrai(r.si || {}, s)) || C.regles[C.regles.length - 1];
    // « Ensuite » : le prochain objectif qui compte, s'il n'est pas déjà l'action du moment.
    const ensuite = s.suivants.find((a) => a.quand > s.t + 5 && (!s.proche || a.e !== s.proche.e) && !(a.e.categorie === 'jungle' && a.quand <= s.t));
    return {
      s: s,
      action: remplir(regle.action, s),
      pourquoi: remplir(regle.pourquoi, s),
      ensuite: ensuite ? {
        nom: ensuite.e.nom.split(' (')[0],
        quand: s.c.lance ? 'dans ' + fmt(ensuite.quand - s.t) : 'à ' + fmt(ensuite.quand),
        texte: texteObjectif(ensuite.e.id, s.role, s.cote) || ensuite.e.conseil || ''
      } : null
    };
  }

  // ---------- affichage ----------

  let zoneAction = null, zonePourquoi = null, zoneEnsuite = null, zoneEtats = null;

  function construire(zone) {
    zone.textContent = '';
    const tete = el('div', 'coach-tete');
    const h2 = el('h2', null, 'Coach ');
    h2.append(el('span', 'marque', 'conseil'));
    const styles = el('div', 'coach-styles');
    styles.setAttribute('role', 'group');
    styles.setAttribute('aria-label', 'Mon style de jeu');
    C.styles.forEach((st) => {
      const b = el('button', 'btn coach-style', st[1]);
      b.type = 'button';
      b.dataset.style = st[0];
      b.addEventListener('click', () => { etat.style = st[0]; sauver(); dessiner(); b.blur(); });
      styles.append(b);
    });
    tete.append(h2, styles);
    const carte = el('div', 'coach-carte');
    zoneAction = el('div', 'coach-action');
    zonePourquoi = el('div', 'coach-pourquoi');
    carte.append(el('div', 'coach-label', 'À faire maintenant'), zoneAction, zonePourquoi);
    zoneEnsuite = el('div', 'coach-ensuite');
    zoneEtats = el('div', 'coach-etats');
    C.etats.forEach((d) => {
      const ligne = el('div', 'coach-etat');
      ligne.append(el('span', 'coach-etat-nom', d.nom));
      const groupe = el('div', 'coach-options');
      groupe.setAttribute('role', 'group');
      groupe.setAttribute('aria-label', d.nom);
      d.options.forEach((o) => {
        const b = el('button', 'btn coach-option', o[1]);
        b.type = 'button';
        b.dataset.etat = d.id;
        b.dataset.valeur = o[0];
        b.addEventListener('click', () => { regler(d.id, o[0]); b.blur(); });
        groupe.append(b);
      });
      ligne.append(groupe);
      zoneEtats.append(ligne);
    });
    zone.append(tete, carte, zoneEnsuite, zoneEtats);
  }

  function dessiner() {
    const zone = document.getElementById('coach');
    if (!zone || !C || !timeline) return;
    if (!zoneAction || !zone.contains(zoneAction)) construire(zone);
    const r = conseil();
    zoneAction.textContent = r.action;
    zoneAction.classList.toggle('long', r.action.length > 55);
    zonePourquoi.textContent = r.pourquoi;
    zoneEnsuite.textContent = '';
    if (r.ensuite) {
      zoneEnsuite.append(el('strong', null, 'Ensuite · ' + r.ensuite.nom + ' ' + r.ensuite.quand + ' : '), r.ensuite.texte);
    }
    zone.querySelectorAll('.coach-option').forEach((b) => b.setAttribute('aria-pressed', String(valeur(b.dataset.etat) === b.dataset.valeur)));
    zone.querySelectorAll('.coach-style').forEach((b) => b.setAttribute('aria-pressed', String((etat.style || 'equilibre') === b.dataset.style)));
    // Couleur de la carte selon l'urgence : vie basse ou wave en danger = rouge, objectif proche = or.
    const urgent = valeur('pv') === 'bas' || valeur('wave') === 'danger';
    zone.classList.toggle('urgent', urgent);
    zone.classList.toggle('objectif', !urgent && Boolean(r.s.proche));
  }

  DLN.coach = { texteObjectif: texteObjectif, redessiner: dessiner };

  Promise.all(['data/coach.json', 'data/timeline.json', 'data/conseils-roles.json', 'data/heroes.json'].map(DLN.charger)
    .concat([DLN.charger('data/niveaux.json').catch(() => null), DLN.charger('data/achats.json').catch(() => null)])).then((r) => {
    C = r[0]; timeline = r[1]; conseils = r[2]; heros = r[3]; niveaux = r[4]; achats = r[5];
    dessiner();
    setInterval(dessiner, 1000);
    DLN.surNiveau(dessiner);
    if (DLN.partieContexte) DLN.partieContexte.surChange(dessiner);
  }).catch(() => { /* la page reste utilisable sans coach */ });
})();
