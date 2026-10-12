// Coach de la page En partie : des recommandations qui suivent le chrono, sans rien à cliquer en jouant.
// « À faire maintenant » = le prochain objectif qui compte pour ton rôle (data/coach.json), sinon l'achat
// du moment pour ton héros (data/achats.json, à défaut data/tempo.json), sinon le conseil du rôle pour la
// phase (data/conseils-roles.json). En dessous, le rappel de tes difficultés habituelles (leçons de
// data/lecons.json repérées par la page Progression ou choisies ici, cadence dans data/rappels.json) et les
// prochaines recos minutées.
// Profil du joueur (dln.coach.profil.v1, écrit par Progression) : zones de la partie où il meurt le plus,
// rappels plus fréquents sur ses points faibles, aucun sur ses points forts, rappel des parties longues.
// Chrono à zéro : écran « Avant la partie » (focus, profil, dernière partie, débrief attendu après « Partie finie »).
// Onglet Mort : la leçon de son type de mort le plus fréquent.
// Bloc « Repères » (réglages `reperes` de data/rappels.json), une ligne de chaque qui tourne : souls moyennes
// de ton héros au prochain palier (data/souls.json), astuce contre un héros d'en face (data/counters.json),
// réflexe visé sur tes points faibles, conseil de ton héros (data/armes-conseils.json, rythme de data/tempo.json). Expose DLN.coach.texteObjectif pour la liste des objectifs.
(function () {
  'use strict';

  const el = DLN.el;
  const T = DLN.tr;
  const CLE_CHRONO = 'dln.timeline.etat.v1';
  const CLE_DIFFICULTES = 'dln.coach.difficultes.v1';
  const CLE_PROFIL = 'dln.coach.profil.v1';
  const CLE_SYNC = 'dln.parties.sync.v1';
  const CLE_FIN = 'dln.partie.fin.v1';       // { fin, duree, heros } : écrit par le bouton « Partie finie »
  const LANES = { yellow: 'Yellow', blue: 'Blue', green: 'Green' };
  const ACHAT_AVANT_S = 30;    // un achat devient « à faire » 30 s avant la minute moyenne des joueurs…
  const ACHAT_APRES_S = 90;    // … et le reste 90 s après
  const RAPPEL_FRAIS_S = 12;   // un rappel de difficulté est mis en avant 12 s après son heure
  const NB_PROCHAINS = 5;
  const FIN_GARDEE_S = 4 * 3600;     // le suivi du débrief reste affiché 4 h après « Partie finie »
  const FIN_PERDUE_S = 3 * 3600;     // passé 3 h, la partie n'arrivera sans doute pas
  const FIN_OUBLIEE_S = 60;          // un nouveau chrono lancé depuis 60 s efface le suivi de la partie précédente

  // Types de mort de la revue des morts (js/mes-parties-lobby.js), dits en une expression.
  const TYPES = {
    isole: { fr: 'seul, loin de ton équipe', en: 'alone, far from your team' },
    inferiorite: { fr: 'en infériorité numérique', en: 'outnumbered' },
    engage_bas: { fr: 'en engageant avec peu de vie', en: 'after engaging on low health' },
    cote_adverse: { fr: 'du côté adverse de la carte', en: 'on the enemy side of the map' },
    surpris: { fr: 'pris par surprise', en: 'caught by surprise' }
  };

  let C = null, timeline = null, conseils = null, niveaux = null, achats = null, tempo = null, heros = null, rappels = null, lecons = [];
  let souls = null, counters = null, armes = null;
  const CLE_ENFACE = 'dln.counters.choisis.v1';

  const fmt = (s) => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const nomCourt = (ev) => ev.nom.split(' (')[0];
  const lireCle = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const ecrireCle = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* stockage indisponible */ } };
  const maintenant = () => Date.now() / 1000;
  const lecon = (id) => lecons.find((l) => l.id === id);
  const leconDe = (mesure) => lecons.find((l) => l.declencheur === mesure);
  const nomMesure = (k) => (DLN.lobby && DLN.lobby.MESURES[k] ? T(DLN.lobby.MESURES[k].nom) : (leconDe(k) || {}).titre || k);
  const nomHeros = (id) => ((heros && heros.heros.find((h) => h.id === id)) || {}).nom || '';
  const depuis = (s) => {
    const m = Math.max(0, Math.round((maintenant() - s) / 60));
    return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0');
  };
  const heure = (s) => new Date(s * 1000).toLocaleTimeString(DLN.langue === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' });

  function tempsChrono() {
    const e = lireCle(CLE_CHRONO) || {};
    if (e.depart != null) return { t: Math.max(0, (Date.now() - e.depart) / 1000), lance: true };
    if (e.pauseA != null) return { t: e.pauseA, lance: true };
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

  // ---------- profil du joueur (dln.coach.profil.v1) ----------
  // ok = assez de parties pour s'en servir ; piste = moins de `parties_fiables` parties.

  function profil() {
    const p = lireCle(CLE_PROFIL);
    const R = rappels && rappels.profil;
    if (!p || !R || !p.parties) return { p: p, ok: false };
    if (p.parties < R.min_parties) return { p: p, ok: false, min: R.min_parties, manque: R.min_parties - p.parties };
    return { p: p, ok: true, R: R, piste: p.parties < R.parties_fiables, zones: zonesDeMort(p, R), type: typePrincipal(p) };
  }

  // Tranches où le joueur meurt au moins `zone_facteur` fois plus que sa moyenne, fusionnées quand elles se touchent.
  function zonesDeMort(p, R) {
    const ts = p.tranche_s || 180;
    const n = Math.ceil(R.zone_max_min * 60 / ts);
    const v = (p.morts_par_tranche || []).slice(0, n);
    while (v.length < n) v.push(0);
    const moyenne = v.reduce((a, b) => a + b, 0) / n;
    const zones = [];
    if (!moyenne) return zones;
    v.forEach((m, i) => {
      if (m < R.zone_facteur * moyenne) return;
      const der = zones[zones.length - 1];
      if (der && der.a === i * ts) { der.a = (i + 1) * ts; der.morts += m; }
      else zones.push({ de: i * ts, a: (i + 1) * ts, morts: m });
    });
    return zones;
  }

  // Type de mort le plus fréquent (une mort peut en avoir plusieurs). En attendant les types par tranche,
  // c'est le type sur toutes les morts : le texte dit « surtout ».
  function typePrincipal(p) {
    const t = p.morts_types || {};
    let k = null;
    Object.keys(t).forEach((x) => { if (TYPES[x] && t[x] > 0 && (!k || t[x] > t[k])) k = x; });
    return k ? { id: k, part: t[k] } : null;
  }

  const etiquettePiste = (pr) => (pr.piste ? T({ fr: ' · piste, ' + pr.p.parties + ' parties', en: ' · early signal, ' + pr.p.parties + ' games' }) : '');

  // ---------- difficultés habituelles ----------
  // Choix manuel s'il existe, sinon le focus et les leçons recommandées par Progression, sinon `defaut`.
  // Le profil ajoute les leçons de ses points faibles et retire celles de ses points forts (sauf choix manuel).

  function difficultes(pr) {
    pr = pr || profil();
    const manuel = lireCle(CLE_DIFFICULTES);
    if (Array.isArray(manuel)) return { ids: manuel, source: 'manuel' };
    const e = DLN.coachEtat ? DLN.coachEtat.lire() : {};
    let ids = [e.focus].concat(e.recommandees || []).filter(Boolean);
    let source = ids.length ? 'parties' : 'defaut';
    if (!ids.length) ids = ((rappels && rappels.defaut) || []).slice();
    if (pr.ok) {
      (pr.p.faibles || []).forEach((m) => { const l = leconDe(m); if (l) { ids.push(l.id); source = 'parties'; } });
      const forts = (pr.p.forts || []).map((m) => (leconDe(m) || {}).id).filter(Boolean);
      ids = ids.filter((id) => id === e.focus || forts.indexOf(id) === -1);
    }
    return { ids: ids.filter((x, i, a) => a.indexOf(x) === i), source: source };
  }

  function choisirDifficultes(ids) {
    ecrireCle(CLE_DIFFICULTES, ids);
    dessiner(true);
  }

  // Le rappel du moment : parmi les difficultés actives à t, la plus prioritaire, puis celle dont l'heure de
  // rappel est la plus récente. Point faible du profil : intervalle raccourci. Partie longue : passe devant.
  let tenu = null;
  const ACHAT_SON_ECART_S = 60;
  let dernierSonAchat = -Infinity;   // secondes de partie   // rappel affiché et depuis quand (secondes de partie)
  function rappelDuMoment(t, pr) {
    const d = difficultes(pr);
    const faibles = pr.ok ? (pr.p.faibles || []) : [];
    const candidats = d.ids.map((id) => {
      const r = rappels && rappels.lecons[id];
      const l = lecon(id);
      if (!r || !l) return null;
      const toutes = faibles.indexOf(l.declencheur) !== -1 ? Math.max(pr.R.toutes_min_s, Math.round(r.toutes_s * pr.R.faible_facteur)) : r.toutes_s;
      return { l: l, de: r.de_s, a: r.a_s, toutes: toutes, prio: 1, faible: toutes !== r.toutes_s };
    }).filter(Boolean);
    if (pr.ok) {
      const pl = pr.p.parties_longues || {};
      const l = lecon(pr.R.longues_lecon), r = rappels.lecons[pr.R.longues_lecon];
      if (l && r && pl.seuil_min && pl.parties >= pr.R.longues_min_parties && pl.engage_bas_apres >= pr.R.longues_min_morts) {
        candidats.push({ l: l, de: pl.seuil_min * 60, a: null, toutes: r.toutes_s, prio: 2,
          etiquette: T({ fr: 'Partie longue', en: 'Long game' }) + ' · ' + l.titre,
          avant: T({ fr: 'Après ' + pl.seuil_min + ' min, tu meurs souvent en engageant avec peu de vie. ', en: 'After ' + pl.seuil_min + ' min you often die engaging on low health. ' }) });
      }
    }
    let meilleur = null;
    const actifs = candidats.filter((c) => !(t < c.de || (c.a != null && t > c.a)));
    actifs.forEach((c) => {
      const dernier = c.de + Math.floor((t - c.de) / c.toutes) * c.toutes;
      if (!meilleur || c.prio > meilleur.prio || (c.prio === meilleur.prio && dernier > meilleur.dernier)) meilleur = Object.assign(c, { dernier: dernier });
    });
    // Un rappel reste affiché au moins `tenue_s` (data/rappels.json), sauf si un rappel plus prioritaire arrive.
    const tenue = (rappels && rappels.tenue_s) || 0;
    const garde = tenu && actifs.find((c) => c.l.id === tenu.id);
    if (garde && t >= tenu.depuis && t - tenu.depuis < tenue && (!meilleur || meilleur.prio <= garde.prio)) return garde;
    if (meilleur && (!tenu || tenu.id !== meilleur.l.id || t < tenu.depuis)) tenu = { id: meilleur.l.id, depuis: t };
    return meilleur;
  }

  // ---------- achats de mon héros ----------

  function achatsDe(idHeros) {
    if (!idHeros) return [];
    const tr = DLN.tranche();
    const min = (rappels && rappels.achat_min_pct) || 30;
    const a = achats && ((achats.tranches[tr] || achats.tranches.tous || {})[String(idHeros)]);
    // Build suivi (importé depuis le jeu, js/builds-perso.js) : ses objets dans son ordre, minute estimée.
    const build = DLN.builds && DLN.builds.suivi(idHeros);
    if (build) {
      const moyens = (a && a.objets) || ((achats && (achats.tranches.tous || {})[String(idHeros)]) || {}).objets || [];
      return DLN.builds.calendrier(build, moyens).map((o) => ({ nom: o.nom, cout: o.cout, t: Math.round(o.minute * 60), build: build.nom, section: o.section, au_choix: o.au_choix }));
    }
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
    const pr = profil();
    const nom = x.heros ? nomHeros(x.heros) : '';
    const dans = (q) => (q <= t ? T({ fr: 'maintenant', en: 'now' }) : (c.lance ? T({ fr: 'dans ', en: 'in ' }) + fmt(q - t) : T({ fr: 'à ', en: 'at ' }) + fmt(q)));
    const diff = difficultes(pr).ids;

    // Objectifs qui comptent pour le rôle, prochaine apparition de chacun.
    const prio = x.priorites || ['small_camps', 'medium_camps', 'powerups', 'urn', 'sinners', 'large_camps', 'rift'];
    const objectifs = prio.map((id) => timeline.evenements.find((e) => e.id === id)).filter((e) => e && niveauOk(e.id))
      .map((e) => ({ e: e, t: prochaine(e, t) })).filter((a) => a.t != null && !(a.e.categorie === 'jungle' && a.t < t))
      .map((a) => ({
        type: 'objectif', t: a.t, cle: 'o:' + a.e.id + ':' + a.t,
        titre: nomCourt(a.e) + (a.e.fiabilite === 'incertain' ? ' (≈)' : ''),
        texte: texteObjectif(a.e.id, role, cote) || DLN.conseilEvenement(a.e) || ''
      }));

    // Achats : minute moyenne des joueurs du héros ; un rappel en plus si les souls dormantes sont une difficulté.
    const souls = diff.indexOf('souls-dormantes') !== -1;
    const listeAchats = achatsDe(x.heros).filter((o) => o.t >= t - ACHAT_APRES_S).map((o) => ({
      type: 'achat', t: o.t, cle: 'a:' + o.nom, pct: o.pct, nom: o.nom, au_choix: o.au_choix,
      titre: T({ fr: 'Acheter ', en: 'Buy ' }) + o.nom + (o.cout ? ' (' + DLN.fmtNombre(o.cout) + ')' : '') + (o.au_choix ? T({ fr: ' · au choix', en: ' · optional' }) : ''),
      texte: (o.build
        ? T({ fr: 'Ton build « ' + o.build + ' » · ' + o.section + ', vers ' + fmt(o.t) + ' (estimé).', en: 'Your build "' + o.build + '" · ' + o.section + ', around ' + fmt(o.t) + ' (estimate).' })
        : T({ fr: o.pct + ' % des joueurs de ' + nom + ' le prennent, en moyenne vers ' + fmt(o.t) + '.',
          en: o.pct + '% of ' + nom + ' players buy it, on average around ' + fmt(o.t) + '.' })) +
        (souls ? T({ fr: ' Dès que tu as les souls, file au shop le plus proche.', en: ' As soon as you have the souls, go to the nearest shop.' }) : '')
    }));

    const toutes = objectifs.concat(listeAchats).sort((a, b) => a.t - b.t);

    // À faire maintenant : objectif proche, sinon achat du moment, sinon conseil du rôle pour la phase.
    let action = toutes.find((r) => r.type === 'objectif' && r.t - t <= C.proche_s && r.t - t > -20);
    if (!action) action = listeAchats.find((r) => r.t - t <= ACHAT_AVANT_S && t - r.t <= ACHAT_APRES_S);
    if (action) action = Object.assign({}, action, { quand: dans(action.t) });
    else {
      const rp = role && conseils.roles[role] ? conseils.roles[role].phases[phase.nom] : conseils.commun[phase.nom];
      action = { type: 'phase', titre: rp || phase.resume, texte: phase.nom + ' · ' + phase.resume + (x.lane ? T({ fr: ' Ta lane : ', en: ' Your lane: ' }) + LANES[x.lane] + '.' : '') };
    }

    // Les objectifs ont leur propre liste sur le même écran : ici, les prochains achats seulement.
    const prochains = listeAchats.filter((r) => r.cle !== action.cle && r.t >= t - 5).slice(0, NB_PROCHAINS)
      .map((r) => Object.assign({}, r, { quand: dans(r.t) }));
    return { c: c, t: t, phase: phase, action: action, prochains: prochains, rappel: rappelDuMoment(t, pr), pr: pr,
      sansAchats: x.heros && !listeAchats.length && !achatsDe(x.heros).length, x: x };
  }

  // ---------- affichage ----------

  let z = null;   // zones du panneau

  // Focus choisi sur la page Progression (dln.coach.focus.v1) : son rappel s'affiche pendant la phase qu'il concerne.
  const PHASES_FOCUS = { lane: 'Laning', milieu: 'Mid-game', fin: 'Late-game' };

  function construire(zone) {
    zone.textContent = '';
    const tete = el('div', 'coach-tete');
    const h2 = el('h2', null, 'Coach ');
    h2.append(el('span', 'marque', T({ fr: 'conseil', en: 'advice' })));
    z = { phase: el('span', 'coach-phase') };
    tete.append(h2, z.phase);
    const carte = el('div', 'coach-carte');
    z.label = el('div', 'coach-label');
    z.action = el('div', 'coach-action');
    z.pourquoi = el('div', 'coach-pourquoi');
    carte.append(z.label, z.action, z.pourquoi);
    z.avant = el('div', 'coach-avant');
    z.risque = el('div', 'coach-risque');
    z.rappel = el('div', 'coach-rappel');
    z.reperes = el('ul', 'coach-reperes');
    z.prochains = el('ol', 'coach-prochains');
    z.prochainsTitre = el('h3', 'coach-prochains-titre', T({ fr: 'Tes prochains achats', en: 'Your next items' }));
    z.difficultes = el('details', 'coach-difficultes');
    zone.append(tete, carte, z.avant, z.risque, z.rappel, z.reperes, z.prochainsTitre, z.prochains, z.difficultes);
    construireDifficultes();
  }

  // Choix des difficultés : cases à cocher. Se règle avant la partie.
  function construireDifficultes() {
    const d = difficultes();
    const ouvert = z.difficultes.open;
    z.difficultes.textContent = '';
    const resume = el('summary');
    const noms = d.ids.map((id) => (lecon(id) || {}).titre).filter(Boolean);
    resume.append(el('strong', null, T({ fr: 'Tes difficultés', en: 'Your weak spots' })), ' · ' + (noms.length ? noms.join(', ') : T({ fr: 'aucune', en: 'none' })));
    z.difficultes.append(resume);
    const corps = el('div', 'coach-difficultes-corps');
    corps.append(el('p', 'aide', d.source === 'parties' ? T({ fr: 'Repérées d\'après tes parties (page Progression). Coche pour changer.', en: 'Found in your games (Progress page). Tick to change.' })
      : d.source === 'manuel' ? T({ fr: 'Choisies à la main.', en: 'Picked by hand.' }) : T({ fr: 'Choix par défaut pour débuter : coche ce qui te pose problème.', en: 'Beginner defaults: tick what gives you trouble.' })));
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
      const b = el('button', 'btn discret', T({ fr: 'Reprendre celles de mes parties', en: 'Use the ones from my games' }));
      b.type = 'button';
      b.addEventListener('click', () => { choisirDifficultes(null); b.blur(); });
      corps.append(b);
    }
    z.difficultes.append(corps);
    z.difficultes.open = ouvert;
  }

  function dessinerRappel(r) {
    z.rappel.textContent = '';
    const f = lireCle('dln.coach.focus.v1');
    const focusActif = f && (f.phase === 'toujours' || PHASES_FOCUS[f.phase] === r.phase.nom);
    const m = r.rappel;
    // Le focus de la page Progression passe avant les autres difficultés pendant sa phase.
    const l = focusActif ? { id: f.id, titre: f.titre, en_partie: { rappel: f.rappel } } : (m ? m.l : null);
    z.rappel.hidden = !l || !r.c.lance;
    // Le bandeau « regarde ta map » du chrono se tait quand le coach parle déjà de la minimap.
    document.body.dataset.coachRappel = z.rappel.hidden ? '' : l.id;
    if (z.rappel.hidden) return;
    const frais = focusActif ? (m && m.l.id === f.id && r.t - m.dernier < RAPPEL_FRAIS_S) : (r.t - m.dernier < RAPPEL_FRAIS_S);
    z.rappel.classList.toggle('frais', Boolean(frais));
    const titre = focusActif ? T({ fr: 'Ton focus · ', en: 'Your focus · ' }) + l.titre
      : m.etiquette || (m.faible ? T({ fr: 'Ton point faible · ', en: 'Your weak spot · ' }) : T({ fr: 'Ta difficulté · ', en: 'Your weak spot · ' })) + l.titre;
    const lien = el('a', 'coach-rappel-titre', titre);
    lien.href = 'parcours.html#l=' + encodeURIComponent(l.id);
    z.rappel.append(lien, el('span', 'coach-rappel-texte', (!focusActif && m.avant ? m.avant : '') + l.en_partie.rappel));
  }

  // ---------- repères : souls, contre eux, réflexe, ton héros ----------

  const tourner = (liste, t, toutes) => (liste.length ? liste[Math.floor(t / toutes) % liste.length] : null);
  const libelleTranche = (tr) => (DLN.LIBELLES_TRANCHE && DLN.LIBELLES_TRANCHE[tr]) || tr;

  // Valeur nette moyenne des joueurs de ton héros au prochain palier (au moins 20 s devant).
  function repereSouls(r) {
    const id = r.x.heros;
    if (!id || !souls) return null;
    let tr = DLN.tranche();
    let pts = (souls.tranches[tr] || {})[String(id)];
    if (!pts) { tr = 'tous'; pts = (souls.tranches.tous || {})[String(id)]; }
    const p = pts && pts.find((q) => q[0] >= r.t + 20);
    if (!p) return null;
    const v = DLN.fmtNombre(Math.round(p[1] / 100) * 100);
    return {
      cle: 'souls', label: T({ fr: 'Souls', en: 'Souls' }),
      texte: T({ fr: 'À ' + fmt(p[0]) + ', un ' + nomHeros(id) + ' a ≈ ' + v + ' souls en moyenne. Compare aux tiennes.',
        en: 'At ' + fmt(p[0]) + ', a ' + nomHeros(id) + ' has ≈ ' + v + ' souls on average. Compare with yours.' }),
      source: libelleTranche(tr) + T({ fr: ', depuis le ', en: ', since ' }) + souls.meta.depuis
    };
  }

  // Une astuce contre un des héros d'en face choisis (compétences et astuces de data/counters.json).
  function repereEnface(r) {
    if (!counters) return null;
    let ids = [];
    try { ids = JSON.parse(localStorage.getItem(CLE_ENFACE)) || []; } catch (e) { ids = []; }
    const astuces = [];
    ids.forEach((id) => {
      const h = counters.heros[String(id)];
      if (!h) return;
      (h.astuces || []).forEach((a) => astuces.push({ nom: h.nom, texte: a }));
      (h.menaces || []).forEach((m) => { if (m.pourquoi) astuces.push({ nom: h.nom, texte: m.pourquoi + '.' }); });
    });
    const a = tourner(astuces, r.t, rappels.reperes.toutes_s.enface);
    return a ? { cle: 'enface', label: T({ fr: 'Contre ', en: 'Vs ' }) + a.nom, texte: a.texte } : null;
  }

  // Réflexes : ceux de tes points faibles reviennent plus souvent, ceux de tes points forts sont retirés,
  // celui que le rappel de difficulté affiche déjà est sauté.
  function repereReflexe(r) {
    const R = rappels.reperes;
    const faibles = r.pr.ok ? (r.pr.p.faibles || []) : [];
    const forts = r.pr.ok ? (r.pr.p.forts || []) : [];
    const deja = r.rappel && r.rappel.l ? r.rappel.l.declencheur : null;
    const actifs = R.reflexes.filter((x) => r.t >= x.de_s && (x.a_s == null || r.t <= x.a_s) &&
      forts.indexOf(x.mesure) === -1 && !(x.mesure && x.mesure === deja));
    const liste = [];
    for (let k = 0; k < R.faible_poids; k++) actifs.forEach((x) => { if (k === 0 || faibles.indexOf(x.mesure) !== -1) liste.push(x); });
    const x = tourner(liste, r.t, R.toutes_s.reflexe);
    return x ? { cle: 'reflexe', label: faibles.indexOf(x.mesure) !== -1 ? T({ fr: 'Ton point faible', en: 'Your weak spot' }) : T({ fr: 'Réflexe', en: 'Habit' }), texte: T(x.texte) } : null;
  }

  // Ton héros : notes sur son arme et ses compétences, et son rythme (winrate selon la durée de la partie,
  // statistique de ta tranche, montré seulement si l'écart dépasse la marge).
  function repereHeros(r) {
    const id = r.x.heros;
    if (!id) return null;
    const liste = ((armes && armes.notes[String(id)]) || []).map((n) => n.texte);
    const tr = DLN.tranche();
    const k = tempo && ((tempo.tranches[tr] || {})[String(id)] || (tempo.tranches.tous || {})[String(id)]);
    const d = k && k.durees;
    if (d && d.length >= 2) {
      const court = d[0], long = d[d.length - 1];
      const ecart = long.winrate - court.winrate;
      const marge = Math.sqrt(court.marge * court.marge + long.marge * long.marge);
      const pct = (x) => DLN.fmtNombre(Math.round(x.winrate)) + ' %';
      if (Math.abs(ecart) > marge) {
        liste.push(ecart > 0
          ? T({ fr: 'Statistique : ' + nomHeros(id) + ' gagne plus quand la partie dure (' + pct(long) + ' après ' + long.de_min + ' min, ' + pct(court) + ' avant ' + court.a_min + ' min). Pas de panique si tu es en retard au début.',
            en: 'Stat: ' + nomHeros(id) + ' wins more in long games (' + pct(long) + ' after ' + long.de_min + ' min, ' + pct(court) + ' before ' + court.a_min + ' min). Don\'t panic if you are behind early.' })
          : T({ fr: 'Statistique : ' + nomHeros(id) + ' gagne plus quand la partie est courte (' + pct(court) + ' avant ' + court.a_min + ' min, ' + pct(long) + ' après ' + long.de_min + ' min). Profite de ton avance tôt.',
            en: 'Stat: ' + nomHeros(id) + ' wins more in short games (' + pct(court) + ' before ' + court.a_min + ' min, ' + pct(long) + ' after ' + long.de_min + ' min). Use your early lead.' }));
      }
    }
    const texte = tourner(liste, r.t, rappels.reperes.toutes_s.heros);
    return texte ? { cle: 'heros', label: nomHeros(id), texte: texte } : null;
  }

  function dessinerReperes(r) {
    z.reperes.textContent = '';
    z.reperes.hidden = !r.c.lance || !rappels.reperes;
    if (z.reperes.hidden) return;
    [repereSouls(r), repereEnface(r), repereReflexe(r), repereHeros(r)].filter(Boolean).forEach((x) => {
      const li = el('li', 'coach-repere repere-' + x.cle);
      li.append(el('span', 'coach-repere-label', x.label), el('span', 'coach-repere-texte', x.texte));
      if (x.source) li.title = x.source;
      z.reperes.append(li);
    });
    z.reperes.hidden = !z.reperes.children.length;
  }

  // ---------- zones de mort : bande 0–45 min et rappel à l'approche ----------

  function barreRisque(pr, t, lance) {
    const max = pr.R.zone_max_min * 60;
    const barre = el('div', 'coach-risque-barre');
    barre.setAttribute('aria-hidden', 'true');
    pr.zones.forEach((zn) => {
      const b = el('span', 'coach-risque-zone');
      b.style.left = (zn.de / max * 100) + '%';
      b.style.width = ((Math.min(zn.a, max) - zn.de) / max * 100) + '%';
      barre.append(b);
    });
    [10, 20, 30, 40].forEach((m) => {
      const g = el('span', 'coach-risque-graduation', String(m));
      g.style.left = (m * 60 / max * 100) + '%';
      barre.append(g);
    });
    if (lance) {
      const c = el('span', 'coach-risque-curseur');
      c.style.left = Math.min(100, t / max * 100) + '%';
      barre.append(c);
    }
    return barre;
  }

  const plage = (zn) => fmt(zn.de) + '–' + fmt(zn.a);
  const texteType = (pr) => (pr.type ? T({ fr: ', surtout ', en: ', mostly ' }) + T(TYPES[pr.type.id]) : '');

  let zoneActive = undefined;   // clé de la zone où l'on est entré (undefined : pas encore calculé, pas de son au chargement)

  function dessinerRisque(r) {
    const pr = r.pr;
    z.risque.textContent = '';
    z.risque.hidden = !pr.ok || !pr.zones.length || !r.c.lance;
    if (z.risque.hidden) { zoneActive = undefined; return; }
    const avant = pr.R.zone_avant_s;
    const active = pr.zones.find((zn) => r.t >= zn.de - avant && r.t < zn.a);
    const suivante = pr.zones.find((zn) => zn.de - avant > r.t);
    z.risque.classList.toggle('actif', Boolean(active));
    const texte = el('div', 'coach-risque-texte');
    if (active) {
      const l = lecon(pr.R.types_lecons[(pr.type || {}).id]);
      texte.append(el('strong', null, '⚠ ' + plage(active) + ' · '),
        T({ fr: 'c\'est là que tu meurs le plus (' + active.morts + ' morts sur ' + pr.p.parties + ' parties)', en: 'this is when you die the most (' + active.morts + ' deaths in ' + pr.p.parties + ' games)' }) + texteType(pr) + '.');
      if (l) texte.append(el('span', 'coach-risque-conseil', l.en_partie.rappel));
    } else if (suivante) {
      texte.append(T({ fr: 'Prochaine zone à risque : ', en: 'Next danger window: ' }), el('strong', null, plage(suivante)));
    } else texte.append(T({ fr: 'Plus de zone à risque dans tes parties habituelles.', en: 'No more danger windows from your usual games.' }));
    texte.append(el('span', 'coach-risque-source', etiquettePiste(pr)));
    z.risque.append(barreRisque(pr, r.t, true), texte);
    // Un son doux à l'entrée dans une zone (si le son du chrono est activé), jamais au chargement de la page.
    const cle = active ? active.de : null;
    if (zoneActive !== undefined && cle !== null && cle !== zoneActive) {
      const son = document.getElementById('opt-son');
      if (son && son.checked && DLN.sons) DLN.sons.jouer('preavis');
    }
    zoneActive = cle;
  }

  // ---------- après la partie : bouton « Partie finie » et arrivée du débrief ----------

  // pret : la page Progression a vu une partie normale terminée après le début de celle-ci.
  function etatDebrief(fin) {
    const s = lireCle(CLE_SYNC);
    const d = s && s.derniere_partie;
    if (d && d.mode === 'normal' && d.fin >= fin.fin - fin.duree + 60) return { etat: 'pret', s: s };
    if (maintenant() - fin.fin > FIN_PERDUE_S) return { etat: 'perdue', s: s };
    if (!s || s.verifie_a < fin.fin) return { etat: 'ouvre', s: s };
    return { etat: 'attente', s: s };
  }

  function blocFin(fin) {
    const d = etatDebrief(fin);
    const b = el('div', 'coach-fin ' + d.etat);
    const lien = (texte) => { const a = el('a', null, texte); a.href = 'mes-parties.html'; return a; };
    b.append(el('div', 'coach-bloc-titre', T({ fr: 'Partie finie', en: 'Game over' }) + ' · ' + heure(fin.fin) +
      (fin.heros ? ' · ' + nomHeros(fin.heros) : '') + ' · ' + fmt(fin.duree)));
    const p = el('p');
    if (d.etat === 'pret') p.append(el('strong', null, T({ fr: 'Ton débrief est prêt. ', en: 'Your debrief is ready. ' })), lien(T({ fr: 'Ouvrir Progression', en: 'Open Progress' })));
    else if (d.etat === 'ouvre') p.append(T({ fr: 'Débrief dans ~30 min après la fermeture du jeu. ', en: 'Debrief ~30 min after you close the game. ' }),
      lien(T({ fr: 'Ouvre Progression', en: 'Open Progress' })), T({ fr: ' et laisse-la ouverte : elle vérifie toute seule toutes les 5 min.', en: ' and leave it open: it checks by itself every 5 min.' }));
    else if (d.etat === 'attente') p.append(T({ fr: 'Partie pas encore arrivée (vérifié à ' + heure(d.s.verifie_a) + '). Compte ~30 min après la fermeture du jeu ; Progression vérifie toutes les 5 min.',
      en: 'Game not in yet (checked at ' + heure(d.s.verifie_a) + '). Allow ~30 min after closing the game; Progress checks every 5 min.' }));
    else p.append(T({ fr: 'Partie toujours pas arrivée. Sans l\'outil deadlock-api-ingest, l\'API ne la voit peut-être pas : ajoute-la par son numéro sur ', en: 'Game still not in. Without the deadlock-api-ingest tool the API may never see it: add it by its match ID on ' }),
      lien(T({ fr: 'Progression', en: 'Progress' })), '.');
    b.append(p);
    return b;
  }

  // ---------- avant la partie (chrono à zéro) ----------

  let cleAvant = null;

  function dessinerAvant(r) {
    const fin = lireCle(CLE_FIN);
    const finOk = fin && maintenant() - fin.fin < FIN_GARDEE_S;
    const pr = r.pr;
    const s = lireCle(CLE_SYNC);
    // Redessiné seulement quand quelque chose change (sinon les liens clignotent sous la souris).
    const cle = JSON.stringify([finOk && etatDebrief(fin).etat, fin && fin.fin, pr.p && pr.p.maj, s && s.verifie_a, r.x.heros, DLN.langue, Math.floor(maintenant() / 60)]);
    if (cle === cleAvant) return;
    cleAvant = cle;
    z.avant.textContent = '';
    if (finOk) z.avant.append(blocFin(fin));

    const b = el('div', 'coach-profil');
    b.append(el('div', 'coach-bloc-titre', T({ fr: 'Ton profil', en: 'Your profile' }) + (pr.ok ? ' · ' + T({ fr: pr.p.parties + ' dernières parties', en: 'last ' + pr.p.parties + ' games' }) + etiquettePiste(pr) : '')));
    if (pr.ok) {
      const p = pr.p;
      b.append(el('p', null, T({ fr: 'Tu meurs ' + DLN.fmtNombre(p.morts_par_partie) + ' fois par partie', en: 'You die ' + DLN.fmtNombre(p.morts_par_partie) + ' times per game' }) +
        (pr.type ? T({ fr: ', surtout ', en: ', mostly ' }) + T(TYPES[pr.type.id]) + ' (' + Math.round(pr.type.part * 100) + ' %)' : '') + '.'));
      if (pr.zones.length) {
        const zl = el('p');
        zl.append(T({ fr: 'Zones à risque : ', en: 'Danger windows: ' }), el('strong', null, pr.zones.map(plage).join(', ')),
          T({ fr: ' (rappel 30 s avant).', en: ' (reminder 30 s before).' }));
        b.append(barreRisque(pr, 0, false), zl);
      }
      const ligne = (titre, liste, classe) => {
        if (!liste || !liste.length) return;
        const l = el('p', classe);
        l.append(el('strong', null, titre), liste.map(nomMesure).join(' · '));
        b.append(l);
      };
      ligne(T({ fr: 'À travailler (rappels plus fréquents) : ', en: 'To work on (more frequent reminders): ' }), p.faibles, 'coach-faibles');
      ligne(T({ fr: 'Points forts (pas de rappel) : ', en: 'Strengths (no reminder): ' }), p.forts, 'coach-forts');
      // Le profil couvre tous les héros : on le dit quand le héros choisi y pèse peu.
      const h = r.x.heros && (p.heros || []).find((x) => x.id === r.x.heros);
      if (r.x.heros && (!h || h.parties * 2 < p.parties)) {
        b.append(el('p', 'aide', T({ fr: 'Profil tous héros confondus : ' + nomHeros(r.x.heros) + ' n\'y compte que ' + (h ? h.parties : 0) + ' partie(s) sur ' + p.parties + '.',
          en: 'Profile across all heroes: ' + nomHeros(r.x.heros) + ' only accounts for ' + (h ? h.parties : 0) + ' of ' + p.parties + ' games.' })));
      }
    } else {
      const p = el('p', 'aide');
      if (pr.p && pr.manque) p.append(T({ fr: 'Profil après ' + pr.min + ' parties analysées : il en manque ' + pr.manque + '. ', en: 'Profile after ' + pr.min + ' analysed games: ' + pr.manque + ' to go. ' }));
      else p.append(T({ fr: 'Pas encore de profil : lie ton compte sur ', en: 'No profile yet: link your account on ' }));
      const a = el('a', null, T({ fr: 'Progression', en: 'Progress' }));
      a.href = 'mes-parties.html';
      p.append(a, T({ fr: ' pour des rappels placés aux minutes où tu meurs.', en: ' to get reminders timed to when you usually die.' }));
      b.append(p);
    }
    if (s && s.derniere_partie) {
      b.append(el('p', 'aide', T({ fr: 'Dernière partie connue terminée il y a ' + depuis(s.derniere_partie.fin) + ' (vérifié à ' + heure(s.verifie_a) + ').',
        en: 'Last known game ended ' + depuis(s.derniere_partie.fin) + ' ago (checked at ' + heure(s.verifie_a) + ').' })));
    }
    z.avant.append(b);
  }

  // ---------- onglet Mort : la leçon de ton type de mort le plus fréquent ----------

  let cleAttente = null;

  function dessinerAttente(pr) {
    const zone = document.getElementById('attente');
    if (!zone || zone.hidden) { cleAttente = null; return; }
    const f = lireCle('dln.coach.focus.v1');
    const idType = pr.ok && pr.type ? pr.R.types_lecons[pr.type.id] : null;
    // Leçon du type de mort le plus fréquent d'abord ; sinon le focus ; sinon la première difficulté dont la
    // fenêtre de data/rappels.json (de_s / a_s) contient la minute en cours : pas de leçon de laning à 33 min.
    const t = tempsChrono().t;
    const dansFenetre = (id) => { const r = rappels && rappels.lecons[id]; return !r || (t >= r.de_s && (r.a_s == null || t <= r.a_s)); };
    const l = lecon(idType) || (f && dansFenetre(f.id) && lecon(f.id)) || lecon(difficultes(pr).ids.filter(dansFenetre)[0]);
    const cle = JSON.stringify([l && l.id, pr.p && pr.p.maj, DLN.langue]);
    if (cle === cleAttente) return;
    cleAttente = cle;
    zone.textContent = '';
    const h2 = el('h2', null, T({ fr: 'Pendant que tu attends ', en: 'While you wait ' }));
    h2.append(el('span', 'marque', T({ fr: 'conseil', en: 'advice' })));
    zone.append(h2);
    if (!l) { zone.append(el('p', 'aide', T({ fr: 'Choisis tes difficultés dans le coach (onglet En jeu).', en: 'Pick your weak spots in the coach (In game tab).' }))); return; }
    if (idType) {
      zone.append(el('p', 'attente-pourquoi', T({ fr: 'Dans tes ' + pr.p.parties + ' dernières parties, ' + Math.round(pr.type.part * 100) + ' % de tes morts : ' + T(TYPES[pr.type.id]) + '.',
        en: 'In your last ' + pr.p.parties + ' games, ' + Math.round(pr.type.part * 100) + '% of your deaths: ' + T(TYPES[pr.type.id]) + '.' }) + etiquettePiste(pr)));
    }
    const titre = el('a', 'attente-titre', l.titre);
    titre.href = 'parcours.html#l=' + encodeURIComponent(l.id);
    zone.append(titre, el('p', 'attente-rappel', l.en_partie.rappel));
    const ol = el('ul', 'attente-comment');
    (l.comment || []).forEach((c) => ol.append(el('li', null, c)));
    zone.append(ol);
  }

  // ---------- dessin ----------

  let derniereCle = null;

  function dessiner(reconstruire) {
    const zone = document.getElementById('coach');
    if (!zone || !C || !timeline || !rappels) return;
    if (!z || !zone.contains(z.action)) construire(zone);
    else if (reconstruire === true) construireDifficultes();
    const r = recos();
    const avant = !r.c.lance;
    zone.classList.toggle('avant', avant);
    z.phase.textContent = r.c.lance ? fmt(r.t) + ' · ' + r.phase.nom : T({ fr: 'avant la partie', en: 'before the game' });

    // Un nouveau chrono qui tourne efface le suivi de la partie précédente.
    if (r.c.lance && r.t > FIN_OUBLIEE_S && localStorage.getItem(CLE_FIN)) ecrireCle(CLE_FIN, null);

    if (avant) {
      document.body.dataset.coachObjectif = '';
      const f = lireCle('dln.coach.focus.v1');
      z.label.textContent = T({ fr: 'Avant la partie', en: 'Before the game' }) + (f ? ' · ' + T({ fr: 'ton focus', en: 'your focus' }) : '');
      z.action.textContent = f ? f.titre : (r.x.heros ? T({ fr: 'Lance le chrono quand la partie commence', en: 'Start the clock when the game starts' }) : '');
      if (!f && !r.x.heros) {
        // État vide = une action : le bouton ouvre le choix du héros (barre de contexte).
        const b = el('button', 'btn principal', T({ fr: 'Choisir mon héros', en: 'Pick my hero' }));
        b.type = 'button';
        b.addEventListener('click', () => { const c = document.querySelector('.contexte-heros'); if (c) c.click(); });
        z.action.append(b);
      }
      z.pourquoi.textContent = f ? T({ fr: 'Exercice : ', en: 'Drill: ' }) + f.exercice : T({ fr: 'Espace ou « Démarrer » à 0:00, puis recale avec ← → si besoin.', en: 'Space or “Start” at 0:00, then adjust with ← → if needed.' });
      z.action.classList.remove('long');
      zone.classList.remove('objectif', 'coach-achat');
      dessinerAvant(r);
    } else {
      cleAvant = null;
      z.avant.textContent = '';
      const a = r.action;
      // « À venir » (js/partie.js) saute l'objectif que le coach annonce déjà.
      document.body.dataset.coachObjectif = a.type === 'objectif' && a.cle ? a.cle.split(':')[1] : '';
      z.label.textContent = a.type === 'objectif' ? T({ fr: 'Objectif ', en: 'Objective ' }) + a.quand : a.type === 'achat' ? T({ fr: 'Achat · ', en: 'Item · ' }) + a.quand : T({ fr: 'À faire maintenant', en: 'Do it now' });
      z.action.textContent = a.titre;
      z.action.classList.toggle('long', a.titre.length > 55);
      z.pourquoi.textContent = a.texte;
      zone.classList.toggle('objectif', a.type === 'objectif');
      zone.classList.toggle('maintenant', a.type === 'objectif' && a.t <= r.t);
      zone.classList.toggle('coach-achat', a.type === 'achat');
      // Son « achat » quand un achat devient « à faire » (si le son du chrono est activé). Les minutes d'achat sont
      // des moyennes : pas plus d'un son d'achat par ACHAT_SON_ECART_S, et aucun juste après un retour en jeu.
      if (a.type === 'achat' && a.cle !== derniereCle) {
        const son = document.getElementById('opt-son');
        const apresRetour = DLN.dernierRetour != null && r.t - DLN.dernierRetour < 20;
        if (derniereCle !== null && son && son.checked && DLN.sons && r.t - dernierSonAchat >= ACHAT_SON_ECART_S && !apresRetour) {
          DLN.sons.jouer('achat');
          dernierSonAchat = r.t;
        }
      }
      derniereCle = a.cle || null;
    }
    z.avant.hidden = !avant;
    dessinerRisque(r);
    dessinerRappel(r);
    dessinerReperes(r);
    dessinerAttente(r.pr);

    z.prochains.textContent = '';
    r.prochains.forEach((p) => {
      const li = el('li', 'coach-prochain type-' + p.type);
      li.append(el('span', 'coach-prochain-quand', '≈ ' + fmt(p.t)), el('strong', null, p.nom), el('span', 'coach-prochain-pct', p.pct != null ? p.pct + T({ fr: ' %', en: '%' }) : (p.au_choix ? T({ fr: 'au choix', en: 'optional' }) : '')));
      li.title = p.texte;
      z.prochains.append(li);
    });
    z.prochainsTitre.hidden = !r.prochains.length;
    const build = r.x.heros && DLN.builds && DLN.builds.suivi(r.x.heros);
    z.prochainsTitre.textContent = build ? T({ fr: 'Ton build : ', en: 'Your build: ' }) + build.nom : T({ fr: 'Tes prochains achats', en: 'Your next items' });
    if (r.sansAchats) z.prochains.append(el('li', 'aide', T({ fr: 'Pas de données d\'achat pour ce héros : regarde l\'onglet Builds de sa fiche.', en: 'No item data for this hero: see the Builds tab of its page.' })));

  }

  // « Partie finie » : en deux temps comme Zéro (bouton ou F deux fois), note l'heure de fin et remet le chrono à zéro.
  function installerFin() {
    const b = document.getElementById('btn-fin');
    if (!b) return;
    const texte = () => T({ fr: 'Partie finie', en: 'Game over' });
    b.firstChild.textContent = texte() + ' ';
    let attente = null;
    const desarmer = () => { clearTimeout(attente); attente = null; b.firstChild.textContent = texte() + ' '; b.classList.remove('confirmer'); };
    const appui = () => {
      const c = tempsChrono();
      if (!c.lance) return;
      if (!attente) {
        b.firstChild.textContent = T({ fr: 'Confirmer ? ', en: 'Confirm? ' });
        b.classList.add('confirmer');
        attente = setTimeout(desarmer, 4000);
        return;
      }
      desarmer();
      ecrireCle(CLE_FIN, { fin: Math.round(maintenant()), duree: Math.round(c.t), heros: ctx().heros || null });
      if (DLN.chrono) DLN.chrono.remettreAZero();
      dessiner();
    };
    b.addEventListener('click', () => { appui(); b.blur(); });
    document.addEventListener('keydown', (e) => {
      if (e.key.toUpperCase() !== 'F' || e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) || document.querySelector('dialog[open]')) return;
      e.preventDefault();
      appui();
    });
  }

  DLN.coach = { texteObjectif: texteObjectif, redessiner: dessiner, achats: (id) => achatsDe(id), achatApresS: ACHAT_APRES_S, procheS: () => (C ? C.proche_s : null), etat: () => (C && timeline && rappels && conseils ? recos() : null) };

  Promise.all(['data/coach.json', 'data/timeline.json', 'data/conseils-roles.json', 'data/heroes.json', 'data/rappels.json'].map(DLN.charger)
    .concat([DLN.charger('data/niveaux.json').catch(() => null), DLN.charger('data/achats.json').catch(() => null),
      DLN.charger('data/tempo.json').catch(() => null), DLN.coachEtat.lecons().catch(() => ({ lecons: [] })),
      DLN.charger('data/souls.json').catch(() => null), DLN.charger('data/counters.json').catch(() => null),
      DLN.charger('data/armes-conseils.json').catch(() => null)])).then((r) => {
    C = r[0]; timeline = r[1]; conseils = r[2]; heros = r[3]; rappels = r[4]; niveaux = r[5]; achats = r[6]; tempo = r[7]; lecons = r[8].lecons;
    souls = r[9]; counters = r[10]; armes = r[11];
    installerFin();
    dessiner();
    setInterval(dessiner, 1000);
    DLN.surNiveau(dessiner);
    DLN.surTranche(dessiner);
    if (DLN.partieContexte) DLN.partieContexte.surChange(dessiner);
    if (DLN.builds) DLN.builds.surChange(() => dessiner(true));
    window.addEventListener('storage', (e) => {
      if ([CLE_DIFFICULTES, 'dln.coach.v1', CLE_PROFIL].indexOf(e.key) !== -1) { cleAttente = null; dessiner(true); }
      if (e.key === CLE_SYNC || e.key === CLE_PROFIL) { cleAvant = null; dessiner(); }
    });
  }).catch(() => { /* la page reste utilisable sans coach */ });
})();
