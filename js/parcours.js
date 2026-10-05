// Parcours : le chemin d'apprentissage débutant (data/parcours.json), leçon par leçon (data/lecons.json),
// textes dans la langue choisie (data/textes/<langue>/). Une leçon à la fois devient le focus, affiché
// sur la page En partie ; les exercices mesurables sont vérifiés sur la page Progression (js/mes-parties.js).
(function () {
  'use strict';

  const el = DLN.el;
  let parcours = null, textes = null, lecons = [];
  const ui = (k, vars) => {
    let t = (textes.ui && textes.ui[k]) || k;
    Object.keys(vars || {}).forEach((v) => { t = t.replace('{' + v + '}', vars[v]); });
    return t;
  };
  const lecon = (id) => lecons.find((l) => l.id === id);
  const etat = () => DLN.coachEtat.lire();
  const sauver = (e) => { DLN.coachEtat.ecrire(e, lecons); afficher(); };
  const compteLie = () => { try { return Boolean(localStorage.getItem('dln.moi.v1')); } catch (e) { return false; } };

  function statut(id, e) {
    if ((e.acquises || []).indexOf(id) !== -1) return 'acquise';
    if (e.focus === id) return 'en_cours';
    if ((e.recommandees || []).indexOf(id) !== -1) return 'recommandee';
    return 'a_faire';
  }

  function commencer(id) {
    const e = etat();
    e.focus = id;
    // Les parties jouées avant ce choix ne comptent pas pour l'exercice.
    e.depuis = Math.floor(Date.now() / 1000);
    sauver(e);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function valider(id) {
    const e = etat();
    e.acquises = (e.acquises || []).filter((x) => x !== id).concat([id]);
    if (e.focus === id) delete e.focus;
    sauver(e);
  }
  function remettre(id) {
    const e = etat();
    e.acquises = (e.acquises || []).filter((x) => x !== id);
    sauver(e);
  }
  function arreter() { const e = etat(); delete e.focus; sauver(e); }

  function bouton(texte, classe, action) {
    const b = el('button', 'btn ' + (classe || ''), texte);
    b.type = 'button';
    b.addEventListener('click', action);
    return b;
  }

  // Contenu d'une leçon : pourquoi, comment, exercice, lien vers les bases.
  function corpsLecon(l, e) {
    const c = el('div', 'pc-lecon-corps');
    c.append(el('h4', null, ui('pourquoi')), el('p', null, l.pourquoi));
    const h = el('h4', null, ui('comment') + ' ');
    h.append(el('span', 'marque', ui('conseil')));
    const ul = el('ul', 'pc-comment');
    l.comment.forEach((x) => ul.append(el('li', null, x)));
    c.append(h, ul);
    const ex = el('div', 'pc-exercice');
    ex.append(el('span', 'pc-ex-label', ui('exercice')), el('strong', null, l.exercice.texte),
      el('span', 'aide', l.exercice.manuel ? ui('manuel') : ui('auto')));
    const s = (e.suivi || {})[l.id];
    if (s && !l.exercice.manuel) ex.append(el('span', 'aide pc-suivi', ui('suivi', { serie: s.serie, cible: s.cible })));
    c.append(ex);
    if (l.memo) {
      const a = el('a', 'pc-memo', ui('memo'));
      a.href = 'memo.html#' + l.memo;
      c.append(a);
    }
    const actions = el('div', 'pc-actions');
    const st = statut(l.id, e);
    if (st === 'acquise') actions.append(bouton(ui('annuler_validation'), 'discret', () => remettre(l.id)));
    else {
      if (st !== 'en_cours') actions.append(bouton(ui('commencer'), 'principal', () => commencer(l.id)));
      actions.append(bouton(ui('valider'), st === 'en_cours' ? 'principal' : '', () => valider(l.id)));
    }
    c.append(actions);
    return c;
  }

  function carteFocus(e) {
    const b = el('section', 'panneau pc-focus');
    const l = e.focus && lecon(e.focus);
    b.append(el('h2', null, ui('focus')));
    if (!l) { b.append(el('p', 'doux', ui('aucun_focus'))); return b; }
    b.append(el('p', 'pc-focus-titre', l.titre), el('p', 'pc-focus-rappel', l.en_partie.rappel));
    b.append(corpsLecon(l, e));
    b.lastChild.querySelector('.pc-actions').append(bouton(ui('arreter'), 'discret', arreter));
    return b;
  }

  function afficher() {
    const app = document.getElementById('app');
    app.textContent = '';
    const e = etat();
    const total = parcours.chapitres.reduce((s, c) => s + c.lecons.length, 0);
    const faites = parcours.chapitres.reduce((s, c) => s + c.lecons.filter((id) => (e.acquises || []).indexOf(id) !== -1).length, 0);

    const tete = el('section', 'pc-tete');
    tete.append(el('h1', null, ui('titre')), el('p', 'pc-intro', ui('intro')));
    const barre = el('div', 'pc-barre');
    const plein = el('span');
    plein.style.width = Math.round(100 * faites / total) + '%';
    barre.append(plein);
    tete.append(barre, el('p', 'aide', ui('progression', { n: faites, total: total })));
    app.append(tete);

    app.append(carteFocus(e));
    if (!compteLie()) {
      const lier = el('p', 'pc-lier');
      const a = el('a', null, ui('lier_bouton'));
      a.href = 'mes-parties.html';
      lier.append(ui('lier') + ' ', a);
      app.append(lier);
    }

    const ouverte = decodeURIComponent((/[#&]l=([^&]+)/.exec(location.hash) || [])[1] || '');
    parcours.chapitres.forEach((ch, i) => {
      const t = (textes.chapitres || {})[ch.id] || {};
      const sec = el('section', 'panneau pc-chapitre');
      const fait = ch.lecons.filter((id) => (e.acquises || []).indexOf(id) !== -1).length;
      const h = el('h2');
      h.append(el('span', 'pc-num', String(i + 1)), t.titre || ch.id, el('span', 'pc-compte', fait + ' / ' + ch.lecons.length));
      sec.append(h, el('p', 'aide', t.but || ''));
      ch.lecons.forEach((id) => {
        const l = lecon(id);
        if (!l) return;
        const st = statut(id, e);
        const d = el('details', 'pc-lecon st-' + st);
        d.id = 'l-' + id;
        if (id === ouverte && id !== e.focus) d.open = true;
        const s = el('summary');
        s.append(el('span', 'pc-puce'), el('span', 'pc-lecon-titre', l.titre), el('span', 'pc-statut', ui(st)));
        d.append(s, corpsLecon(l, e));
        sec.append(d);
      });
      app.append(sec);
    });
    if (ouverte && ouverte !== e.focus) { const cible = document.getElementById('l-' + ouverte); if (cible) cible.scrollIntoView(); }
  }

  Promise.all([DLN.charger('data/parcours.json'), DLN.chargerTextes('parcours'), DLN.coachEtat.lecons()]).then((r) => {
    parcours = r[0]; textes = r[1]; lecons = r[2].lecons;
    document.title = ui('titre') + ' · DeadLock_Noob';
    document.getElementById('app').hidden = false;
    document.getElementById('meta').textContent = 'Patch ' + r[2].meta.patch + ' · ' + r[2].meta.nature;
    afficher();
    window.addEventListener('hashchange', afficher);
    window.addEventListener('storage', (ev) => { if (ev.key === 'dln.coach.v1') afficher(); });
  }, DLN.echec);
})();
