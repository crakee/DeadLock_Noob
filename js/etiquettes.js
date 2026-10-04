// Étiquettes personnelles sur les héros (« joué », « à essayer », « me casse »…), modifiables
// par l'utilisateur et gardées dans le navigateur (clé dln.etiquettes.v1). Au premier passage,
// les héros joués et à essayer de data/profil.json reçoivent leurs étiquettes.
// À charger après js/commun.js : expose DLN.etiquettes.
(function () {
  'use strict';

  const el = DLN.el;
  const CLE = 'dln.etiquettes.v1';
  const SUGGESTIONS = ['joué', 'à essayer', 'me casse', 'facile à tuer', 'à éviter'];
  // Couleur fixe pour les étiquettes connues, sinon une couleur tirée du texte.
  const COULEURS = { 'joué': 'var(--or)', 'à essayer': 'var(--or-clair)', 'me casse': 'var(--danger)', 'facile à tuer': 'var(--bon)', 'à éviter': 'var(--danger)' };
  const PALETTE = ['var(--weapon)', 'var(--spirit)', 'var(--vitality)', 'var(--cat-lane)', 'var(--cat-deplacement)', 'var(--cat-objectif)'];

  let etat = { ids: {}, initialise: false };
  const ecouteurs = [];

  function lire() {
    try { etat = Object.assign({ ids: {}, initialise: false }, JSON.parse(localStorage.getItem(CLE)) || {}); } catch (e) { /* stockage indisponible */ }
  }
  function sauver() {
    try { localStorage.setItem(CLE, JSON.stringify(etat)); } catch (e) { /* stockage indisponible */ }
    ecouteurs.forEach((f) => f());
  }
  lire();

  // Premier passage : on reprend le profil.
  const pret = DLN.profil.then((p) => {
    if (etat.initialise) return;
    (p.heros_joues || []).forEach((id) => ajouterSans(id, 'joué'));
    (p.heros_a_essayer || []).forEach((id) => ajouterSans(id, 'à essayer'));
    etat.initialise = true;
    sauver();
  });

  // Une autre page ouverte a changé les étiquettes.
  window.addEventListener('storage', (e) => { if (e.key === CLE) { lire(); ecouteurs.forEach((f) => f()); } });

  const normaliser = (t) => String(t || '').trim().toLowerCase().slice(0, 30);
  const de = (id) => (etat.ids[String(id)] || []).slice();

  function ajouterSans(id, tag) {
    const l = etat.ids[String(id)] || (etat.ids[String(id)] = []);
    if (l.indexOf(tag) === -1) l.push(tag);
  }
  function ajouter(id, tag) {
    tag = normaliser(tag);
    if (!tag) return;
    ajouterSans(id, tag);
    sauver();
  }
  function retirer(id, tag) {
    const l = etat.ids[String(id)] || [];
    const i = l.indexOf(tag);
    if (i === -1) return;
    l.splice(i, 1);
    if (!l.length) delete etat.ids[String(id)];
    sauver();
  }
  // Toutes les étiquettes en usage, les suggestions d'abord.
  function toutes() {
    const vues = SUGGESTIONS.slice();
    Object.keys(etat.ids).forEach((id) => etat.ids[id].forEach((t) => { if (vues.indexOf(t) === -1) vues.push(t); }));
    return vues;
  }
  const avec = (tag) => Object.keys(etat.ids).filter((id) => etat.ids[id].indexOf(tag) !== -1).map(Number);
  const enUsage = () => toutes().filter((t) => avec(t).length);

  function couleur(tag) {
    if (COULEURS[tag]) return COULEURS[tag];
    let n = 0;
    for (let i = 0; i < tag.length; i++) n = (n * 31 + tag.charCodeAt(i)) >>> 0;
    return PALETTE[n % PALETTE.length];
  }

  function pastille(tag, retrait) {
    const s = el('span', 'etiquette', tag);
    s.style.setProperty('--etiquette', couleur(tag));
    if (retrait) {
      const x = el('button', 'etiquette-retirer', '×');
      x.type = 'button';
      x.title = 'Retirer l\'étiquette « ' + tag + ' »';
      x.addEventListener('click', (e) => { e.stopPropagation(); retrait(); });
      s.append(x);
    }
    return s;
  }

  // Étiquettes d'un héros, en lecture seule (pour les listes et tableaux).
  function pastilles(id) {
    const z = el('span', 'etiquettes');
    de(id).forEach((t) => z.append(pastille(t)));
    return z;
  }

  // Éditeur : les étiquettes du héros (retirables) + un champ pour en ajouter, avec suggestions.
  function editeur(id) {
    const z = el('div', 'etiquettes-editeur');
    function dessiner() {
      z.textContent = '';
      de(id).forEach((t) => z.append(pastille(t, () => retirer(id, t))));
      const form = el('form', 'etiquette-form');
      const champ = el('input');
      champ.type = 'text';
      champ.placeholder = '+ étiquette';
      champ.setAttribute('aria-label', 'Ajouter une étiquette');
      const listeId = 'etiquettes-suggestions-' + id;
      champ.setAttribute('list', listeId);
      const dl = el('datalist');
      dl.id = listeId;
      toutes().filter((t) => de(id).indexOf(t) === -1).forEach((t) => { const o = el('option'); o.value = t; dl.append(o); });
      form.append(champ, dl);
      form.addEventListener('submit', (e) => { e.preventDefault(); ajouter(id, champ.value); });
      z.append(form);
      // Suggestions en un clic.
      toutes().filter((t) => de(id).indexOf(t) === -1).slice(0, 5).forEach((t) => {
        const b = el('button', 'etiquette-suggestion', '+ ' + t);
        b.type = 'button';
        b.addEventListener('click', () => ajouter(id, t));
        z.append(b);
      });
    }
    dessiner();
    ecouteurs.push(() => { if (z.isConnected) dessiner(); });
    return z;
  }

  DLN.etiquettes = {
    pret: pret, de: de, ajouter: ajouter, retirer: retirer, toutes: toutes, avec: avec, enUsage: enUsage,
    pastilles: pastilles, editeur: editeur, couleur: couleur,
    surChange: (f) => ecouteurs.push(f)
  };
})();
