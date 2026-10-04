// Sons des alertes, synthétisés dans le navigateur (Web Audio, aucun fichier audio).
// Deux moments : « preavis » (un objectif arrive bientôt) et « maintenant » (il est là).
// Plusieurs ambiances au choix, volume réglable ; réglages gardés dans dln.sons.v1.
// À charger après js/commun.js : expose DLN.sons (utilisé par js/timeline.js et js/partie.js).
(function () {
  'use strict';

  const CLE = 'dln.sons.v1';
  let reglages = { profil: 'carillon', volume: 0.7 };
  try { Object.assign(reglages, JSON.parse(localStorage.getItem(CLE)) || {}); } catch (e) { /* stockage indisponible */ }
  const sauver = () => { try { localStorage.setItem(CLE, JSON.stringify(reglages)); } catch (e) { /* idem */ } };

  let ctx = null, sortie = null;

  // Le navigateur n'autorise le son qu'après un geste : on prépare l'audio au premier clic ou à la première touche.
  function preparer() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!ctx && Ctx) {
        ctx = new Ctx();
        // Un compresseur doux : audible même bas, sans pic agressif.
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -18;
        comp.ratio.value = 4;
        sortie = ctx.createGain();
        sortie.connect(comp).connect(ctx.destination);
      }
      if (ctx && ctx.state === 'suspended') ctx.resume();
    } catch (e) { /* pas de son */ }
  }
  ['pointerdown', 'keydown'].forEach((ev) => window.addEventListener(ev, preparer, { capture: true }));

  // Une note : oscillateur(s) + enveloppe (attaque courte, chute douce).
  function note(freq, debut, duree, opts) {
    opts = opts || {};
    const g = ctx.createGain();
    const crete = (opts.niveau || 0.35);
    g.gain.setValueAtTime(0.0001, debut);
    g.gain.exponentialRampToValueAtTime(crete, debut + (opts.attaque || 0.012));
    g.gain.exponentialRampToValueAtTime(0.0001, debut + duree);
    g.connect(sortie);
    const o = ctx.createOscillator();
    o.type = opts.forme || 'sine';
    o.frequency.setValueAtTime(freq, debut);
    if (opts.fm) {
      // Cloche : modulation de fréquence qui s'éteint, timbre métallique doux.
      const m = ctx.createOscillator();
      const mg = ctx.createGain();
      m.frequency.value = freq * opts.fm;
      mg.gain.setValueAtTime(freq * 1.2, debut);
      mg.gain.exponentialRampToValueAtTime(1, debut + duree);
      m.connect(mg).connect(o.frequency);
      m.start(debut);
      m.stop(debut + duree + 0.05);
    }
    o.connect(g);
    o.start(debut);
    o.stop(debut + duree + 0.05);
    if (opts.harmonique) {
      // Une octave au-dessus, très bas : donne de la présence sans dureté.
      const o2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      o2.frequency.value = freq * 2;
      g2.gain.setValueAtTime(0.0001, debut);
      g2.gain.exponentialRampToValueAtTime(crete * opts.harmonique, debut + 0.01);
      g2.gain.exponentialRampToValueAtTime(0.0001, debut + duree * 0.6);
      o2.connect(g2).connect(sortie);
      o2.start(debut);
      o2.stop(debut + duree);
    }
  }

  // Profils : pour chaque moment, une liste de [fréquence Hz, décalage s, durée s].
  const PROFILS = {
    carillon: {
      nom: 'Carillon', aide: 'Deux notes rondes, agréable et bien audible (conseillé)',
      opts: { harmonique: 0.25 },
      preavis: [[988, 0, 0.7], [1319, 0.16, 0.9]],
      maintenant: [[988, 0, 0.5], [1319, 0.14, 0.5], [1760, 0.28, 1.0]]
    },
    cloche: {
      nom: 'Cloche', aide: 'Une cloche claire qui résonne',
      opts: { fm: 1.4, niveau: 0.3 },
      preavis: [[660, 0, 1.4]],
      maintenant: [[660, 0, 1.0], [880, 0.22, 1.4]]
    },
    marimba: {
      nom: 'Marimba', aide: 'Notes boisées et courtes, très douces',
      opts: { forme: 'triangle', niveau: 0.45, attaque: 0.005 },
      preavis: [[523, 0, 0.35], [659, 0.12, 0.45]],
      maintenant: [[523, 0, 0.3], [659, 0.1, 0.3], [784, 0.2, 0.3], [1047, 0.3, 0.6]]
    },
    radar: {
      nom: 'Radar', aide: 'Bips nets, le plus facile à repérer dans le bruit du jeu',
      opts: { forme: 'square', niveau: 0.12, attaque: 0.004 },
      preavis: [[1200, 0, 0.12], [1200, 0.18, 0.12]],
      maintenant: [[1200, 0, 0.1], [1200, 0.14, 0.1], [1600, 0.28, 0.25]]
    },
    discret: {
      nom: 'Discret', aide: 'Une seule note douce, pour qui joue avec de la musique',
      opts: { niveau: 0.3 },
      preavis: [[784, 0, 0.6]],
      maintenant: [[784, 0, 0.4], [1047, 0.15, 0.7]]
    }
  };

  function jouer(moment, profil) {
    preparer();
    if (!ctx || !sortie) return;
    const p = PROFILS[profil || reglages.profil] || PROFILS.carillon;
    try {
      sortie.gain.setValueAtTime(Math.max(0.0001, reglages.volume), ctx.currentTime);
      const t0 = ctx.currentTime + 0.03;
      (p[moment] || p.preavis).forEach((n) => note(n[0], t0 + n[1], n[2], p.opts));
    } catch (e) { /* pas de son */ }
  }

  // Durée approximative d'un son, pour que la voix parle après lui.
  function duree(moment) {
    const p = PROFILS[reglages.profil] || PROFILS.carillon;
    return Math.max.apply(null, (p[moment] || p.preavis).map((n) => n[1] + n[2] * 0.6));
  }

  DLN.sons = {
    PROFILS: PROFILS,
    jouer: jouer,
    duree: duree,
    preparer: preparer,
    profil: () => reglages.profil,
    volume: () => reglages.volume,
    reglerProfil: (p) => { if (PROFILS[p]) { reglages.profil = p; sauver(); } },
    reglerVolume: (v) => { reglages.volume = Math.max(0, Math.min(1, v)); sauver(); }
  };
})();
