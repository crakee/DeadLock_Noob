// En partie : disposition réglable. Poignées entre les colonnes et entre les panneaux d'une colonne ;
// les tailles sont gardées par onglet (dln.partie.tailles.v1). Double-clic sur une poignée : disposition
// d'origine de l'onglet. Rien sur téléphone (une seule colonne).
(function () {
  'use strict';

  const CLE = 'dln.partie.tailles.v1';   // { onglet: { cols: [poids…], panneaux: { id: poids } } }
  const ETROIT = window.matchMedia('(max-width: 600px)');
  // Le chrono et les minuteurs gardent leur taille naturelle : pas de poignée à côté d'eux.
  const FIXES = ['horloge', 'declenches'];
  const MIN_PX = 120;

  let tailles = {};
  try { tailles = JSON.parse(localStorage.getItem(CLE)) || {}; } catch (e) { /* défaut */ }
  const sauver = () => { try { localStorage.setItem(CLE, JSON.stringify(tailles)); } catch (e) { /* stockage indisponible */ } };

  let onglet = null;
  const visibles = (parent, sel) => Array.from(parent.children).filter((c) => c.matches(sel) && !c.hidden);
  const reglables = (col) => visibles(col, 'section[data-panneau]').filter((s) => FIXES.indexOf(s.dataset.panneau) === -1);

  function appliquer(id) {
    onglet = id || onglet;
    const conteneur = document.querySelector('.partie-colonnes');
    if (!conteneur || !onglet) return;
    document.querySelectorAll('.poignee').forEach((p) => p.remove());
    conteneur.querySelectorAll('.col, .col > section').forEach((e) => { e.style.flex = ''; });
    if (ETROIT.matches) return;
    const t = tailles[onglet] || {};
    const cols = visibles(conteneur, '.col');
    cols.forEach((c, i) => { if (t.cols && t.cols[i] != null) c.style.flex = t.cols[i] + ' 1 0'; });
    for (let i = 1; i < cols.length; i++) poser(cols[i - 1], cols[i], 'x', () => cols, (poids) => { t.cols = poids; });
    cols.forEach((col) => {
      const secs = reglables(col);
      secs.forEach((s) => { const v = (t.panneaux || {})[s.dataset.panneau]; if (v != null) s.style.flex = v + ' 1 0'; });
      for (let i = 1; i < secs.length; i++) {
        if (secs[i - 1].nextElementSibling !== secs[i]) continue;   // un panneau fixe entre les deux
        poser(secs[i - 1], secs[i], 'y', () => reglables(col), (poids, liste) => {
          t.panneaux = t.panneaux || {};
          liste.forEach((s, k) => { t.panneaux[s.dataset.panneau] = poids[k]; });
        });
      }
    });
    tailles[onglet] = t;
  }

  // Poignée entre a et b. Au glisser, chaque élément de la rangée prend sa taille actuelle en pixels
  // comme poids (flex: px 1 0), puis a et b s'échangent la distance parcourue.
  function poser(a, b, axe, rangee, enregistrer) {
    const p = document.createElement('div');
    p.className = 'poignee poignee-' + axe;
    p.setAttribute('role', 'separator');
    p.setAttribute('aria-orientation', axe === 'x' ? 'vertical' : 'horizontal');
    p.title = 'Glisser pour agrandir un côté · double-clic : disposition d\'origine';
    a.after(p);
    const taille = (e) => (axe === 'x' ? e.getBoundingClientRect().width : e.getBoundingClientRect().height);
    p.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      p.setPointerCapture(ev.pointerId);
      const liste = rangee();
      const depart = liste.map(taille);
      const ia = liste.indexOf(a), ib = liste.indexOf(b);
      const origine = axe === 'x' ? ev.clientX : ev.clientY;
      const poids = depart.slice();
      document.body.classList.add('redimension', 'redimension-' + axe);
      const bouger = (e) => {
        let d = (axe === 'x' ? e.clientX : e.clientY) - origine;
        d = Math.max(MIN_PX - depart[ia], Math.min(depart[ib] - MIN_PX, d));
        poids[ia] = depart[ia] + d;
        poids[ib] = depart[ib] - d;
        liste.forEach((el, k) => { el.style.flex = Math.round(poids[k]) + ' 1 0'; });
        window.dispatchEvent(new Event('resize'));
      };
      const finir = () => {
        p.removeEventListener('pointermove', bouger);
        document.body.classList.remove('redimension', 'redimension-' + axe);
        enregistrer(poids.map(Math.round), liste);
        sauver();
      };
      p.addEventListener('pointermove', bouger);
      p.addEventListener('pointerup', finir, { once: true });
      p.addEventListener('pointercancel', finir, { once: true });
    });
    p.addEventListener('dblclick', () => {
      delete tailles[onglet];
      sauver();
      appliquer();
      window.dispatchEvent(new Event('resize'));
    });
  }

  ETROIT.addEventListener('change', () => appliquer());
  window.addEventListener('storage', (e) => {
    if (e.key !== CLE) return;
    try { tailles = JSON.parse(e.newValue) || {}; } catch (err) { tailles = {}; }
    appliquer();
  });

  DLN.disposition = { appliquer: appliquer };
})();
