// Tier list par tranche de rang : chaque héros classé d'après son winrate et sa marge d'erreur (DLN.tier).
// Sources : data/hero-stats.json (winrates par tranche depuis le patch), data/heroes.json, data/patch.json
// (héros sortis récemment). Statistique de la tranche, pas un counter.
(function () {
  'use strict';

  const el = DLN.el;
  const RECENT_JOURS = 14;   // un héros sorti depuis moins longtemps est signalé : ses joueurs l'apprennent encore
  let D = {};

  function nouveaux() {
    const limite = Date.now() - RECENT_JOURS * 864e5;
    const noms = {};
    D.patch.patchs.forEach((p) => {
      if (new Date(p.date + 'T12:00:00').getTime() >= limite) (p.nouveaux_heros || []).forEach((n) => { noms[n] = p.date; });
    });
    return noms;
  }

  function afficherTranches() {
    const z = document.getElementById('tranches');
    z.textContent = '';
    Object.keys(D.stats.tranches).forEach((cle) => {
      const b = el('button', 'tiers-tranche', DLN.LIBELLES_TRANCHE[cle] || cle);
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(cle === DLN.tranche()));
      b.addEventListener('click', () => DLN.choisirTranche(cle));
      z.append(b);
    });
  }

  function afficher() {
    afficherTranches();
    const cle = D.stats.tranches[DLN.tranche()] ? DLN.tranche() : 'tous';
    const stats = D.stats.tranches[cle].heros;
    const recents = nouveaux();
    const miens = DLN.etiquettes.avec('joué');
    const z = document.getElementById('tiers');
    z.textContent = '';
    DLN.TIERS.forEach((t) => {
      const ici = D.heros.heros.filter((h) => { const x = DLN.tier(stats[String(h.id)]); return x && x.lettre === t.lettre; })
        .sort((a, b) => stats[String(b.id)].winrate - stats[String(a.id)].winrate);
      const ligne = el('section', 'tier-ligne tier-' + t.lettre);
      const tete = el('div', 'tier-tete');
      tete.append(el('span', 'tier-lettre', t.lettre), el('span', 'tier-libelle', t.libelle));
      ligne.append(tete);
      const grille = el('div', 'tier-heros');
      ici.forEach((h) => {
        const s = stats[String(h.id)];
        const a = el('a', 'tier-case' + (miens.indexOf(h.id) !== -1 ? ' mien' : ''));
        a.href = 'heros.html#h=' + h.id + '&o=matchups';
        a.append(DLN.img(h.icone || h.image), el('span', 'tier-nom', h.nom), el('span', 'tier-wr', s.winrate.toFixed(1) + ' %'));
        a.title = h.nom + ' : ' + s.winrate.toFixed(1) + ' % ± ' + s.marge.toFixed(1) + ' sur ' + DLN.fmtNombre(s.parties) + ' parties' +
          (recents[h.nom] ? '\nSorti le ' + recents[h.nom] + ' : ses joueurs l\'apprennent encore.' : '');
        if (recents[h.nom]) a.append(el('span', 'tier-nouveau', 'nouveau'));
        grille.append(a);
      });
      if (!ici.length) grille.append(el('span', 'tier-vide', 'Aucun'));
      ligne.append(grille);
      z.append(ligne);
    });
    document.getElementById('tiers-source').textContent = 'Winrate des parties ' + (DLN.LIBELLES_TRANCHE[cle] || cle) + ' depuis le ' + D.stats.meta.depuis +
      ' (patch ' + D.stats.meta.patch + '). Un héros n\'est au-dessus ou en dessous de la moyenne que si tout son intervalle de confiance (± marge) ' +
      'est au-dessus ou en dessous de 50 % ; S et D quand il dépasse aussi 52 % ou 48 %. Ça dit si un héros gagne souvent dans ta tranche, ' +
      'pas s\'il te convient ni qui il contre. Contour or : tes héros joués.';
  }

  Promise.all(['data/heroes.json', 'data/hero-stats.json', 'data/patch.json'].map(DLN.charger).concat([DLN.etiquettes.pret])).then((r) => {
    D = { heros: r[0], stats: r[1], patch: r[2] };
    document.getElementById('app').hidden = false;
    document.getElementById('meta').textContent = 'Patch ' + D.stats.meta.patch + ' · stats depuis le ' + D.stats.meta.depuis + ' · api.deadlock-api.com';
    afficher();
    DLN.surTranche(afficher);
    DLN.etiquettes.surChange(afficher);
  }, DLN.echec);
})();
