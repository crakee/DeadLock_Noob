// État du coach, partagé par les pages Parcours, Progression (mes-parties) et En partie.
// dln.coach.v1 : { focus: id de leçon, depuis: start_time de la dernière partie connue au choix du focus,
//                  acquises: [ids], recommandees: [ids], suivi: { id: { serie, cible } }, maj }
// dln.coach.focus.v1 : copie courte du focus (titre, rappel, phase, exercice) lue par le coach de la page En partie.
(function () {
  'use strict';
  const CLE = 'dln.coach.v1';
  const CLE_FOCUS = 'dln.coach.focus.v1';

  function lire() { try { return JSON.parse(localStorage.getItem(CLE)) || {}; } catch (e) { return {}; } }

  // lecons : liste des leçons déjà fusionnées avec leurs textes (DLN.fusionner).
  function ecrire(etat, lecons) {
    try {
      localStorage.setItem(CLE, JSON.stringify(etat));
      const l = etat.focus && lecons.find((x) => x.id === etat.focus);
      if (l) localStorage.setItem(CLE_FOCUS, JSON.stringify({ id: l.id, titre: l.titre, rappel: l.en_partie.rappel, phase: l.en_partie.phase, exercice: l.exercice.texte }));
      else localStorage.removeItem(CLE_FOCUS);
    } catch (e) { /* stockage indisponible */ }
  }

  // Leçons fusionnées avec les textes de la langue choisie.
  const lecons = () => Promise.all([DLN.charger('data/lecons.json'), DLN.chargerTextes('lecons')])
    .then((r) => { r[0].lecons = DLN.fusionner(r[0].lecons, r[1].lecons); return r[0]; });

  DLN.coachEtat = { lire: lire, ecrire: ecrire, lecons: lecons };
})();
