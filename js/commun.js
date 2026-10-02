// Partagé par tous les onglets : réglage de niveau (1 débutant, 2 intermédiaire, 3 avancé),
// chargement des données et petits utilitaires d'affichage.
window.DLN = (function () {
  'use strict';

  const CLE_NIVEAU = 'dln.niveau.v1';
  const ecouteurs = [];
  let niveau = 1;

  try {
    const n = Number(localStorage.getItem(CLE_NIVEAU));
    if (n >= 1 && n <= 3) niveau = n;
  } catch (e) { /* stockage indisponible */ }

  function el(tag, classe, texte) {
    const e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texte != null) e.textContent = texte;
    return e;
  }

  function charger(url) {
    return fetch(url, { cache: 'no-cache' }).then((r) => {
      if (!r.ok) throw new Error(url + ' : HTTP ' + r.status);
      return r.json();
    });
  }

  function echec(err) {
    const zone = document.getElementById('erreur');
    if (!zone) return;
    document.getElementById('erreur-texte').textContent = location.protocol === 'file:'
      ? 'La page a été ouverte par double-clic (file://) : le navigateur refuse alors de lire les données.'
      : 'Impossible de charger les données (' + err.message + ').';
    zone.hidden = false;
  }

  // Petite étiquette de fiabilité : rien pour les données du jeu, une marque pour le reste.
  function marque(fiabilite) {
    return fiabilite && fiabilite !== 'donnees' ? el('span', 'marque', fiabilite) : null;
  }

  const choix = document.getElementById('opt-niveau');
  if (choix) {
    choix.value = String(niveau);
    choix.addEventListener('change', () => {
      niveau = Number(choix.value);
      try { localStorage.setItem(CLE_NIVEAU, String(niveau)); } catch (e) { /* stockage indisponible */ }
      ecouteurs.forEach((f) => f(niveau));
    });
  }

  return {
    niveau: () => niveau,
    surNiveau: (f) => ecouteurs.push(f),
    charger: charger,
    echec: echec,
    marque: marque,
    el: el
  };
})();
