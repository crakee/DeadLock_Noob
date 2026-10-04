// Annonces vocales à partir de clips audio (voix d'IA générée une fois, outils/generer_voix.py) :
// le nom (« Soul Urn ») puis la fin (« dans trente secondes » ou « maintenant »).
// Sans clip pour une annonce, on revient à la synthèse vocale du navigateur.
// À charger après js/commun.js : expose DLN.voix (utilisé par js/timeline.js et js/partie.js).
(function () {
  'use strict';

  let clips = {};
  let file = Promise.resolve();
  const audio = {};

  DLN.charger('data/voix.json').then((v) => { clips = v.clips || {}; }).catch(() => { /* pas de clips : voix du navigateur */ });

  // Même règle que outils/generer_voix.py.
  const cle = (nom) => nom.split(' (')[0].normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const fichier = (k) => clips[k] && clips[k].fichier;

  function finPour(restant) {
    if (restant <= 1) return 'fin-maintenant';
    const arrondi = Math.min(90, Math.max(15, Math.round(restant / 15) * 15));
    return 'fin-' + arrondi;
  }

  function jouerFichier(src) {
    return new Promise((ok) => {
      const a = audio[src] || (audio[src] = new Audio(src));
      a.currentTime = 0;
      a.volume = DLN.sons ? Math.min(1, 0.4 + DLN.sons.volume()) : 1;
      a.onended = ok;
      a.onerror = ok;
      a.play().catch(ok);
    });
  }

  function synthese(texte) {
    try {
      if (!('speechSynthesis' in window)) return;
      const u = new SpeechSynthesisUtterance(texte);
      u.lang = 'fr-FR';
      window.speechSynthesis.speak(u);
    } catch (e) { /* pas de voix */ }
  }

  // Annonce « nom » + « fin ». Les annonces s'enchaînent sans se couper.
  function annoncer(nom, restant) {
    const kNom = 'nom-' + cle(nom), kFin = finPour(restant);
    const texte = restant > 1 ? nom.split(' (')[0] + ' dans ' + Math.round(restant) + ' secondes' : nom.split(' (')[0] + ' maintenant';
    if (!fichier(kNom) || !fichier(kFin)) { synthese(texte); return; }
    file = file.then(() => jouerFichier(fichier(kNom))).then(() => jouerFichier(fichier(kFin)));
  }

  DLN.voix = {
    annoncer: annoncer,
    disponible: () => Object.keys(clips).some((k) => fichier(k)),
    complet: () => Object.keys(clips).length > 0 && Object.keys(clips).every((k) => fichier(k))
  };
})();
