// Onglet Timeline : chrono de partie alimenté par data/timeline.json.
// Aucune valeur de jeu ici : tout ce qui dépend d'un patch est dans le JSON.
(function () {
  'use strict';

  const URL_DONNEES = 'data/timeline.json';
  const URL_NIVEAUX = 'data/niveaux.json';
  const CLE_ETAT = 'dln.timeline.etat.v1';
  const CLE_REGLAGES = 'dln.timeline.reglages.v1';

  // Choix d'affichage (pas des valeurs de jeu)
  const MAINTIEN_S = 10;      // durée du « maintenant » après l'heure d'un événement
  const NB_AVENIR = 4;        // cartes affichées dans « À venir »
  const DUREE_RAPPEL_S = 4;   // durée d'affichage du rappel « regarde ta map »
  const OUBLI_S = 2 * 3600;   // chrono oublié : remis à zéro après 2 h de partie ou 2 h en pause
  const FRISE_MIN_S = 2400;   // étendue minimale de la frise
  const LIBELLES_CATEGORIE = {
    jungle: 'Jungle', objectif: 'Objectif', lane: 'Lane',
    structure: 'Structure', deplacement: 'Déplacement', phase: 'Phase'
  };

  let donnees = null;
  let niveaux = null;         // data/niveaux.json ; absent : tout est affiché
  let etat = { depart: null, pauseA: null, declenches: {}, termines: {} };
  let reglages = { son: true, voix: false, rappel: true, decalage: 0, masquees: [] };

  const $ = (id) => document.getElementById(id);

  function el(tag, classe, texte) {
    const e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texte != null) e.textContent = texte;
    return e;
  }

  // ---------- stockage ----------

  function lire(cle, defaut) {
    try {
      const brut = localStorage.getItem(cle);
      return brut ? Object.assign(defaut, JSON.parse(brut)) : defaut;
    } catch (e) {
      return defaut;
    }
  }

  function ecrire(cle, valeur) {
    try { localStorage.setItem(cle, JSON.stringify(valeur)); } catch (e) { /* stockage indisponible */ }
  }

  const sauverEtat = () => ecrire(CLE_ETAT, etat);
  const sauverReglages = () => ecrire(CLE_REGLAGES, reglages);

  // ---------- temps ----------

  // Le temps de partie se déduit de l'heure système, jamais d'un cumul de ticks.
  function temps() {
    if (etat.depart != null) return Math.max(0, (Date.now() - etat.depart) / 1000);
    return etat.pauseA != null ? etat.pauseA : 0;
  }

  const enMarche = () => etat.depart != null;
  const auRepos = () => etat.depart == null && etat.pauseA == null;

  function fmt(s) {
    s = Math.max(0, Math.floor(s));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  const fmtRestant = (s) => fmt(Math.ceil(s));

  function lireTemps(texte) {
    const m = /^\s*(\d{1,3})(?:[:.,\s]([0-5]?\d))?\s*$/.exec(texte);
    return m ? Number(m[1]) * 60 + Number(m[2] || 0) : null;
  }

  function reglerTemps(t) {
    t = Math.max(0, t);
    if (etat.pauseA != null) etat.pauseA = t;
    else etat.depart = Date.now() - t * 1000;
    sauverEtat();
    rafraichir();
  }

  function basculer() {
    if (enMarche()) {
      etat.pauseA = temps();
      etat.pauseLe = Date.now();
      etat.depart = null;
    } else {
      etat.depart = Date.now() - (etat.pauseA || 0) * 1000;
      etat.pauseA = null;
      delete etat.pauseLe;
    }
    sauverEtat();
    veille();
    rafraichir();
  }

  function recaler(delta) {
    if (auRepos()) return;
    reglerTemps(temps() + delta);
  }

  function remettreAZero() {
    etat = { depart: null, pauseA: null, declenches: {}, termines: {} };
    annonces.clear();
    sauverEtat();
    veille();
    rafraichir();
  }

  // Aucune partie ne dure 2 h : un chrono qui les dépasse (ou en pause depuis 2 h) a été oublié.
  function oublie() {
    if (etat.depart != null) return temps() >= OUBLI_S;
    return etat.pauseA != null && etat.pauseLe != null && Date.now() - etat.pauseLe >= OUBLI_S;
  }

  // ---------- lecture des données ----------

  // Prochaine occurrence encore affichable d'un événement, ou null.
  function occurrence(ev, t) {
    if (ev.type === 'fenetre') {
      return t <= ev.fin_s ? { debut: ev.debut_s, fin: ev.fin_s, n: 0 } : null;
    }
    if (ev.type === 'recurrent') {
      const n = Math.max(0, Math.floor((t - MAINTIEN_S - ev.temps_s) / ev.intervalle_s) + 1);
      const debut = ev.temps_s + n * ev.intervalle_s;
      return { debut: debut, fin: debut, n: n };
    }
    return t < ev.temps_s + MAINTIEN_S ? { debut: ev.temps_s, fin: ev.temps_s, n: 0 } : null;
  }

  function statut(debut, fin, preavis, t) {
    if (t < debut - preavis) return 'attente';
    if (t < debut) return 'alerte';
    return fin > debut ? 'ouverte' : 'maintenant';
  }

  const preavis = (objet) => objet.annonce_avant_s > 0 ? objet.annonce_avant_s + reglages.decalage : 0;
  const masquee = (categorie) => reglages.masquees.indexOf(categorie) !== -1;

  // Un événement ou un minuteur n'apparaît qu'à partir du niveau indiqué dans niveaux.json.
  function auNiveau(table, id) {
    const requis = niveaux && niveaux[table] ? niveaux[table][id] : null;
    return requis == null || requis <= DLN.niveau();
  }
  const cache = (ev) => masquee(ev.categorie) || !auNiveau('evenements', ev.id);

  function aVenir(t) {
    const items = [];
    donnees.evenements.forEach((ev) => {
      if (!(ev.annonce_avant_s > 0) || cache(ev) || etat.termines[ev.id]) return;
      const occ = occurrence(ev, t);
      if (!occ) return;
      items.push({
        ev: ev, occ: occ,
        statut: statut(occ.debut, occ.fin, preavis(ev), t),
        cle: 'ev:' + ev.id + ':' + occ.n
      });
    });
    return items.sort((a, b) => a.occ.debut - b.occ.debut);
  }

  // Interpolation linéaire entre les points ; au-delà du dernier point, la
  // dernière pente est prolongée jusqu'au plafond (extrapolation, signalée « ≈ »).
  function interpoler(courbe, t) {
    const p = courbe.points_s;
    if (t <= p[0][0]) return { valeur: p[0][1], extrapole: false };
    for (let i = 1; i < p.length; i++) {
      if (t <= p[i][0]) {
        const k = (t - p[i - 1][0]) / (p[i][0] - p[i - 1][0]);
        return { valeur: p[i - 1][1] + k * (p[i][1] - p[i - 1][1]), extrapole: false };
      }
    }
    const a = p[p.length - 2], b = p[p.length - 1];
    let v = b[1] + (t - b[0]) * (b[1] - a[1]) / (b[0] - a[0]);
    if (courbe.plafond_s != null) v = Math.min(v, courbe.plafond_s);
    return { valeur: v, extrapole: true };
  }

  function palier(paliers, t) {
    let v = paliers[0][1];
    paliers.forEach((p) => { if (t >= p[0]) v = p[1]; });
    return v;
  }

  function phaseA(t) {
    let courante = donnees.phases[0];
    donnees.phases.forEach((p) => { if (t >= p.debut_s) courante = p; });
    return courante;
  }

  function heureTexte(ev, occ) {
    const approx = ev.fiabilite === 'incertain' ? '≈ ' : '';
    if (occ.fin > occ.debut) return approx + fmt(occ.debut) + '–' + fmt(occ.fin);
    return approx + 'à ' + fmt(occ.debut);
  }

  function marque(objet) {
    return objet.fiabilite && objet.fiabilite !== 'donnees' ? el('span', 'marque', objet.fiabilite) : null;
  }

  // ---------- minuteurs déclenchés ----------

  function declencher(d) {
    if (auRepos()) return;
    const t = temps();
    const e = etat.declenches[d.id] || (etat.declenches[d.id] = { n: 0, fin: null });
    if (e.fin != null && t < e.fin - (d.marge_s || 0)) return;
    const delai = d.delais_s[Math.min(e.n, d.delais_s.length - 1)];
    e.fin = t + delai;
    e.n += 1;
    if (d.termine) etat.termines[d.termine] = true;
    sauverEtat();
    rafraichir();
  }

  function annulerDeclenche(d) {
    const e = etat.declenches[d.id];
    if (!e || e.fin == null) return;
    e.fin = null;
    e.n = Math.max(0, e.n - 1);
    if (d.termine && e.n === 0) delete etat.termines[d.termine];
    sauverEtat();
    rafraichir();
  }

  // ---------- alertes ----------

  const annonces = new Set();
  let premierPassage = true;
  let audio = null;

  function preparerAudio() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!audio && Ctx) audio = new Ctx();
      if (audio && audio.state === 'suspended') audio.resume();
    } catch (e) { /* pas de son */ }
  }

  function bip() {
    // Son choisi dans « Alertes » (js/sons.js) s'il est chargé, sinon le bip d'origine.
    if (window.DLN && DLN.sons) { DLN.sons.jouer('preavis'); return; }
    if (!audio) return;
    try {
      [880, 1175].forEach((frequence, i) => {
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        const debut = audio.currentTime + i * 0.16;
        osc.frequency.value = frequence;
        gain.gain.setValueAtTime(0.0001, debut);
        gain.gain.exponentialRampToValueAtTime(0.25, debut + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, debut + 0.15);
        osc.connect(gain).connect(audio.destination);
        osc.start(debut);
        osc.stop(debut + 0.16);
      });
    } catch (e) { /* pas de son */ }
  }

  function dire(texte) {
    try {
      if (!('speechSynthesis' in window)) return;
      const u = new SpeechSynthesisUtterance(texte);
      u.lang = 'fr-FR';
      window.speechSynthesis.speak(u);
    } catch (e) { /* pas de voix */ }
  }

  function annoncer(cle, nom, restant_s) {
    if (annonces.has(cle)) return;
    annonces.add(cle);
    // Au chargement de la page, les alertes déjà en cours ne sonnent pas une seconde fois.
    if (premierPassage || !enMarche()) return;
    if (reglages.son) bip();
    if (reglages.voix) {
      const texte = restant_s > 1 ? nom + ' dans ' + Math.round(restant_s) + ' secondes' : nom + ' maintenant';
      // La voix attend la fin du son pour ne pas le couvrir.
      const attente = reglages.son && window.DLN && DLN.sons ? DLN.sons.duree('preavis') * 1000 : 0;
      // Clips de voix d'IA s'ils existent (js/voix.js), sinon la voix du navigateur.
      setTimeout(() => (window.DLN && DLN.voix ? DLN.voix.annoncer(nom, restant_s) : dire(texte)), attente);
    }
  }

  // ---------- écran allumé ----------

  let verrou = null;

  function veille() {
    try {
      if (enMarche() && !verrou && navigator.wakeLock && document.visibilityState === 'visible') {
        navigator.wakeLock.request('screen').then((v) => {
          verrou = v;
          v.addEventListener('release', () => { verrou = null; });
        }).catch(() => {});
      } else if (!enMarche() && verrou) {
        verrou.release().catch(() => {});
      }
    } catch (e) { /* API absente */ }
  }

  // ---------- construction de la page ----------

  const cartes = [];
  const minuteurs = [];
  let friseEtendue = 0;
  let curseur = null;
  let pointChoisi = null;

  function afficherDetail(objet, heure) {
    const zone = $('detail');
    zone.textContent = '';
    zone.append(el('strong', null, objet.nom), ' · ' + heure);
    const m = marque(objet);
    if (m) zone.append(m);
    if (objet.detail) zone.append(' — ' + objet.detail);
    if (objet.conseil) zone.append(' Conseil : ' + objet.conseil);
  }

  function construireFiltres() {
    const zone = $('filtres');
    const vues = [];
    donnees.evenements.forEach((ev) => { if (vues.indexOf(ev.categorie) === -1) vues.push(ev.categorie); });
    vues.forEach((categorie) => {
      const b = el('button', 'filtre', LIBELLES_CATEGORIE[categorie] || categorie);
      b.type = 'button';
      b.style.setProperty('--cat', 'var(--cat-' + categorie + ', var(--doux))');
      b.setAttribute('aria-pressed', String(!masquee(categorie)));
      b.addEventListener('click', () => {
        const i = reglages.masquees.indexOf(categorie);
        if (i === -1) reglages.masquees.push(categorie); else reglages.masquees.splice(i, 1);
        b.setAttribute('aria-pressed', String(i !== -1));
        b.blur();
        sauverReglages();
        friseEtendue = 0;
        rafraichir();
      });
      zone.append(b);
    });
  }

  function construireCartes() {
    for (let i = 0; i < NB_AVENIR; i++) {
      const li = el('li', 'carte');
      const c = {
        li: li, item: null,
        nom: el('div', 'carte-nom'),
        conseil: el('div', 'carte-conseil'),
        compte: el('div', 'carte-compte'),
        heure: el('div', 'carte-heure')
      };
      const droite = el('div', 'carte-droite');
      droite.append(c.compte, c.heure);
      li.append(c.nom, droite, c.conseil);
      li.addEventListener('click', () => {
        if (c.item) afficherDetail(c.item.ev, heureTexte(c.item.ev, c.item.occ));
      });
      $('avenir').append(li);
      cartes.push(c);
    }
  }

  function construireMinuteurs() {
    donnees.declenches.forEach((d, i) => {
      const ligne = el('div', 'minuteur');
      const bouton = el('button', 'btn minuteur-btn');
      bouton.type = 'button';
      const m = {
        d: d, bouton: bouton, ligne: ligne,
        nom: el('span', 'minuteur-nom'),
        compte: el('span', 'minuteur-compte'),
        annuler: el('button', 'btn discret minuteur-annuler', '×')
      };
      bouton.append(el('kbd', null, String(i + 1)), m.nom, m.compte);
      bouton.title = d.detail || '';
      bouton.addEventListener('click', () => { preparerAudio(); declencher(d); bouton.blur(); });
      m.annuler.type = 'button';
      m.annuler.title = 'Annuler ce minuteur';
      m.annuler.setAttribute('aria-label', 'Annuler ' + d.nom);
      m.annuler.addEventListener('click', () => annulerDeclenche(d));
      ligne.append(bouton, m.annuler);
      $('declenches').append(ligne);
      minuteurs.push(m);
    });
  }

  function construireFixe() {
    Object.keys(donnees.courbes).forEach((cle) => {
      const bloc = el('div', 'courbe');
      const valeur = el('div', 'courbe-valeur');
      valeur.id = 'courbe-' + cle;
      bloc.append(valeur, el('div', 'courbe-nom', donnees.courbes[cle].nom));
      bloc.title = donnees.courbes[cle].detail || '';
      $('courbes').append(bloc);
    });
    donnees.checklist.priorites.forEach((p) => $('checklist').append(el('li', null, p)));
    $('checklist').title = donnees.checklist.source || '';
    $('meta').textContent = 'Patch ' + donnees.meta.patch + ' · vérifié le ' + donnees.meta.verifie_le +
      ' · « wiki » et « incertain » : valeurs non confirmées par les données du jeu';
  }

  function construireFrise(etendue) {
    const piste = $('frise');
    piste.textContent = '';
    pointChoisi = null;
    const pct = (s) => (100 * s / etendue) + '%';

    const phases = el('div', 'frise-phases');
    donnees.phases.forEach((p) => {
      const fin = p.fin_s == null ? etendue : Math.min(p.fin_s, etendue);
      const bande = el('div', 'frise-phase', p.nom);
      bande.style.left = pct(p.debut_s);
      bande.style.width = pct(fin - p.debut_s);
      bande.title = p.resume || '';
      phases.append(bande);
    });
    piste.append(phases);

    const rangs = {};
    donnees.evenements.forEach((ev) => {
      if (cache(ev)) return;
      let rang = rangs[ev.categorie];
      if (!rang) {
        rang = rangs[ev.categorie] = { noeud: el('div', 'frise-rang'), pris: {} };
        rang.noeud.style.setProperty('--cat', 'var(--cat-' + ev.categorie + ', var(--doux))');
        rang.noeud.append(el('span', 'frise-rang-nom', LIBELLES_CATEGORIE[ev.categorie] || ev.categorie));
        piste.append(rang.noeud);
      }
      const occurrences = [];
      if (ev.type === 'fenetre') {
        occurrences.push({ debut: ev.debut_s, fin: ev.fin_s });
      } else if (ev.type === 'recurrent') {
        for (let s = ev.temps_s; s <= etendue; s += ev.intervalle_s) occurrences.push({ debut: s, fin: s });
      } else {
        occurrences.push({ debut: ev.temps_s, fin: ev.temps_s });
      }
      occurrences.forEach((occ) => {
        if (occ.debut > etendue) return;
        const point = el('button', 'frise-point');
        point.type = 'button';
        if (!(ev.annonce_avant_s > 0)) point.classList.add('info');
        if (ev.fiabilite === 'incertain') point.classList.add('incertain');
        // Deux événements d'une même catégorie à la même heure : le second est décalé.
        const deja = rang.pris[occ.debut] || 0;
        rang.pris[occ.debut] = deja + 1;
        point.style.left = 'calc(' + pct(occ.debut) + ' + ' + (deja * 0.8) + 'rem)';
        if (occ.fin > occ.debut) {
          point.classList.add('plage');
          point.style.width = pct(occ.fin - occ.debut);
        }
        const heure = heureTexte(ev, occ);
        point.title = ev.nom + ' · ' + heure;
        point.setAttribute('aria-label', point.title);
        point.addEventListener('click', () => {
          if (pointChoisi) pointChoisi.classList.remove('choisi');
          pointChoisi = point;
          point.classList.add('choisi');
          afficherDetail(ev, heure);
          point.blur();
        });
        rang.noeud.append(point);
      });
    });

    const axe = el('div', 'frise-axe');
    for (let s = 0; s <= etendue; s += 300) {
      const g = el('span', 'frise-graduation', String(s / 60));
      g.style.left = pct(s);
      axe.append(g);
    }
    piste.append(axe);

    curseur = el('div', 'frise-curseur');
    piste.append(curseur);
  }

  // ---------- rafraîchissement ----------

  function rafraichirHorloge(t) {
    $('horloge').textContent = fmt(t);
    document.title = (auRepos() ? '' : fmt(t) + ' · ') + 'En partie · DeadLock_Noob';
    const bouton = $('btn-marche');
    const libelle = enMarche() ? 'Pause' : (auRepos() ? 'Démarrer' : 'Reprendre');
    if (bouton.firstChild.nodeValue !== libelle + ' ') bouton.firstChild.nodeValue = libelle + ' ';
    $('horloge-etat').textContent = enMarche() ? 'en cours' : (auRepos() ? 'prêt' : 'en pause');
    document.querySelector('.horloge').classList.toggle('en-pause', etat.pauseA != null);
    document.querySelectorAll('[data-recale]').forEach((b) => { b.disabled = auRepos(); });
  }

  function rafraichirAvenir(t) {
    const items = aVenir(t);
    items.forEach((it) => {
      if (it.statut !== 'attente') annoncer(it.cle, it.ev.nom, it.occ.debut - t);
    });
    cartes.forEach((c, i) => {
      const it = items[i];
      c.item = it || null;
      c.li.hidden = !it;
      if (!it) return;
      c.li.className = 'carte ' + it.statut;
      c.li.style.setProperty('--cat', 'var(--cat-' + it.ev.categorie + ', var(--doux))');
      c.nom.textContent = it.ev.nom;
      const m = marque(it.ev);
      if (m) c.nom.append(m);
      c.conseil.textContent = it.ev.conseil || '';
      if (it.statut === 'maintenant') {
        c.compte.textContent = 'MAINTENANT';
        c.heure.textContent = heureTexte(it.ev, it.occ);
      } else if (it.statut === 'ouverte') {
        c.compte.textContent = 'FENÊTRE';
        c.heure.textContent = heureTexte(it.ev, it.occ) + ' · encore ' + fmtRestant(it.occ.fin - t);
      } else {
        c.compte.textContent = fmtRestant(it.occ.debut - t);
        c.heure.textContent = heureTexte(it.ev, it.occ);
      }
    });
    $('avenir-vide').hidden = items.length > 0;
  }

  function rafraichirMinuteurs(t) {
    let modifie = false;
    minuteurs.forEach((m) => {
      const d = m.d;
      m.ligne.hidden = !auNiveau('declenches', d.id);
      if (m.ligne.hidden) return;
      const marge = d.marge_s || 0;
      const e = etat.declenches[d.id];
      if (e && e.fin != null && t >= e.fin + marge + MAINTIEN_S) {
        e.fin = null;
        modifie = true;
      }
      m.bouton.disabled = auRepos();
      const actif = e && e.fin != null;
      m.annuler.hidden = !actif;
      if (!actif) {
        const prochain = d.delais_s[Math.min(e ? e.n : 0, d.delais_s.length - 1)];
        m.bouton.className = 'btn minuteur-btn repos';
        m.nom.textContent = d.bouton;
        m.compte.textContent = '→ ' + fmt(prochain);
        return;
      }
      const debut = e.fin - marge;
      const s = statut(debut, e.fin + marge, preavis(d), t);
      if (s !== 'attente') annoncer('dc:' + d.id + ':' + e.n, d.nom, debut - t);
      m.bouton.className = 'btn minuteur-btn ' + s;
      m.nom.textContent = d.nom;
      const mq = marque(d);
      if (mq) m.nom.append(mq);
      const approx = marge ? '≈ ' : '';
      const suffixe = marge ? ' ± ' + fmt(marge) : '';
      m.compte.textContent = t >= e.fin
        ? (marge ? 'vers maintenant' : 'écoulé')
        : approx + fmtRestant(e.fin - t) + suffixe;
    });
    $('declenches-vide').hidden = minuteurs.some((m) => !m.ligne.hidden);
    if (modifie) sauverEtat();
  }

  function rafraichirMaintenant(t) {
    const phase = phaseA(t);
    $('phase-nom').textContent = phase.nom;
    $('phase-resume').textContent = phase.resume || '';
    const r = interpoler(donnees.courbes.respawn, t);
    $('courbe-respawn').textContent = (r.extrapole ? '≈ ' : '') + Math.round(r.valeur) + ' s';
    $('courbe-vagues').textContent = palier(donnees.courbes.vagues.paliers_s, t) + ' s';

    // Prochains événements sans préavis (paliers d'information)
    let prochain = null;
    donnees.evenements.forEach((ev) => {
      if (ev.annonce_avant_s > 0 || ev.temps_s == null || ev.temps_s <= t || cache(ev)) return;
      if (!prochain || ev.temps_s < prochain.temps_s) prochain = { temps_s: ev.temps_s, noms: [ev.nom] };
      else if (ev.temps_s === prochain.temps_s) prochain.noms.push(ev.nom);
    });
    const zone = $('palier');
    zone.textContent = '';
    if (prochain) zone.append('Prochain palier ', el('strong', null, fmt(prochain.temps_s)), ' · ' + prochain.noms.join(' · '));
  }

  function rafraichirRappel(t) {
    const r = niveaux && niveaux.rappel_minimap;
    const zone = $('rappel');
    const actif = Boolean(r) && reglages.rappel && enMarche() && DLN.niveau() <= r.niveau_max &&
      t >= r.intervalle_s && (t % r.intervalle_s) < DUREE_RAPPEL_S;
    zone.classList.toggle('actif', actif);
    if (actif && zone.textContent !== r.texte) zone.textContent = r.texte;
  }

  function rafraichirFrise(t) {
    const etendue = Math.max(FRISE_MIN_S, Math.ceil((t + 60) / 600) * 600);
    if (etendue !== friseEtendue) {
      friseEtendue = etendue;
      construireFrise(etendue);
    }
    curseur.style.left = (100 * Math.min(t, etendue) / etendue) + '%';
  }

  function rafraichir() {
    if (!donnees) return;
    if (oublie()) { remettreAZero(); return; }
    const t = temps();
    rafraichirHorloge(t);
    rafraichirAvenir(t);
    rafraichirMinuteurs(t);
    rafraichirMaintenant(t);
    rafraichirRappel(t);
    rafraichirFrise(t);
    premierPassage = false;
  }

  // ---------- commandes ----------

  function brancherCommandes() {
    $('btn-marche').addEventListener('click', (e) => { preparerAudio(); basculer(); e.currentTarget.blur(); });

    document.querySelectorAll('[data-recale]').forEach((b) => {
      b.addEventListener('click', () => { recaler(Number(b.dataset.recale)); b.blur(); });
    });

    $('form-temps').addEventListener('submit', (e) => {
      e.preventDefault();
      const champ = $('saisie-temps');
      const t = lireTemps(champ.value);
      champ.classList.toggle('invalide', t == null);
      if (t == null) return;
      preparerAudio();
      // Chrono pas encore lancé : on rejoint une partie en cours, il démarre à l'heure saisie.
      if (auRepos()) etat.depart = Date.now();
      reglerTemps(t);
      veille();
      champ.value = '';
      champ.blur();
    });

    // Remise à zéro en deux temps, sans boîte de dialogue.
    const zero = $('btn-zero');
    let attente = null;
    const desarmer = () => {
      clearTimeout(attente);
      attente = null;
      zero.textContent = 'Zéro';
      zero.classList.remove('confirmer');
    };
    zero.addEventListener('click', () => {
      if (attente) {
        desarmer();
        remettreAZero();
      } else {
        zero.textContent = 'Confirmer ?';
        zero.classList.add('confirmer');
        attente = setTimeout(desarmer, 4000);
      }
      zero.blur();
    });

    const son = $('opt-son'), voix = $('opt-voix'), choixPreavis = $('opt-preavis');
    son.checked = reglages.son;
    voix.checked = reglages.voix;
    choixPreavis.value = String(reglages.decalage);
    if (choixPreavis.value !== String(reglages.decalage)) { reglages.decalage = 0; choixPreavis.value = '0'; }
    son.addEventListener('change', () => { reglages.son = son.checked; sauverReglages(); preparerAudio(); if (son.checked) bip(); });
    voix.addEventListener('change', () => { reglages.voix = voix.checked; sauverReglages(); if (voix.checked) dire('Annonces vocales activées'); });
    choixPreavis.addEventListener('change', () => { reglages.decalage = Number(choixPreavis.value); sauverReglages(); rafraichir(); });
    const rappel = $('opt-rappel');
    rappel.checked = reglages.rappel;
    rappel.addEventListener('change', () => { reglages.rappel = rappel.checked; sauverReglages(); rafraichir(); });
    DLN.surNiveau(() => { friseEtendue = 0; rafraichir(); });

    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
      if (document.querySelector('dialog[open]')) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat) { preparerAudio(); basculer(); }
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        recaler((e.key === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 10 : 1));
      } else if (/^[1-9]$/.test(e.key) && minuteurs[Number(e.key) - 1] && !minuteurs[Number(e.key) - 1].ligne.hidden) {
        if (!e.repeat) { preparerAudio(); declencher(minuteurs[Number(e.key) - 1].d); }
      }
    });

    document.addEventListener('visibilitychange', () => { veille(); rafraichir(); });
  }

  // ---------- démarrage ----------

  function demarrer(json) {
    donnees = json;
    $('erreur').hidden = true;
    $('app').hidden = false;
    etat = lire(CLE_ETAT, etat);
    if (etat.pauseA != null && etat.pauseLe == null) { etat.pauseLe = Date.now(); sauverEtat(); }
    reglages = lire(CLE_REGLAGES, reglages);
    construireFiltres();
    construireCartes();
    construireMinuteurs();
    construireFixe();
    brancherCommandes();
    rafraichir();
    veille();
    setInterval(rafraichir, 250);
  }

  function echec(raison) {
    $('erreur-texte').textContent = location.protocol === 'file:'
      ? 'La page a été ouverte par double-clic (file://) : le navigateur refuse alors de lire ' + URL_DONNEES + '.'
      : 'Impossible de charger ' + URL_DONNEES + ' (' + raison + ').';
    $('erreur').hidden = false;
    $('erreur-fichier').addEventListener('change', (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      fichier.text().then((texte) => demarrer(JSON.parse(texte)))
        .catch((err) => { $('erreur-texte').textContent = 'Fichier illisible : ' + err.message; });
    });
  }

  fetch(URL_DONNEES, { cache: 'no-cache' })
    .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then((json) => fetch(URL_NIVEAUX, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((n) => { niveaux = n; demarrer(json); }),
    (err) => echec(err.message));
})();
