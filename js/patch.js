// Onglet Patch : résumé des derniers patchs (data/patch.json) et héros forts du moment
// (data/hero-stats.json, par tranche de rang, depuis la date du patch).
(function () {
  'use strict';

  const el = DLN.el;
  const CLE = 'dln.patch.tranche.v1';
  const NB_META = 8;
  const LIBELLES_TRANCHE = {
    tous: 'Tous rangs', initiate_sentinel: 'Initiate → Sentinel',
    mystic_oracle: 'Mystic → Oracle', phantom_eternus: 'Phantom → Eternus'
  };
  const LIBELLES_TYPE = { majeur: 'majeur', equilibrage: 'équilibrage', correctif: 'correctif' };
  const LIBELLES_SENS = { buffs: 'Renforcés', nerfs: 'Affaiblis', ajustes: 'Ajustés', corriges: 'Bugs corrigés' };

  let patch = null, stats = null, heros = null, profil = null;
  let tranche = null;

  try { tranche = localStorage.getItem(CLE); } catch (e) { /* stockage indisponible */ }

  const miens = () => profil.heros_joues.concat(profil.heros_a_essayer);
  const estMien = (nom) => heros.heros.some((h) => h.nom === nom && miens().indexOf(h.id) !== -1);
  const fmtDate = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  function afficherPatchs() {
    const zone = document.getElementById('patchs');
    zone.textContent = '';
    if (patch.a_venir) {
      const bloc = el('section', 'panneau patch-avenir');
      bloc.append(el('h2', null, patch.a_venir.titre), el('p', null, patch.a_venir.texte));
      zone.append(bloc);
    }
    patch.patchs.forEach((p, i) => {
      if (DLN.niveau() === 1 && i > 1 && !p.pour_toi.length) return;
      const bloc = el('section', 'panneau patch-carte');
      const titre = el('h2');
      const lien = el('a', 'lien', p.titre);
      lien.href = p.lien;
      lien.target = '_blank';
      lien.rel = 'noopener';
      titre.append(lien, el('span', 'marque', LIBELLES_TYPE[p.type] || p.type), el('span', 'patch-date', fmtDate(p.date)));
      bloc.append(titre);

      if (p.pour_toi.length) {
        const toi = el('div', 'patch-toi');
        toi.append(el('h3', null, 'Pour tes héros'));
        const ul = el('ul');
        p.pour_toi.forEach((t) => ul.append(el('li', null, t)));
        toi.append(ul);
        bloc.append(toi);
      }

      const resume = el('ul', 'patch-resume');
      p.resume.slice(0, DLN.niveau() === 1 ? 4 : p.resume.length).forEach((t) => resume.append(el('li', null, t)));
      bloc.append(resume);

      Object.keys(LIBELLES_SENS).forEach((sens) => {
        const liste = (p.heros || {})[sens];
        if (!liste || !liste.length) return;
        const ligne = el('p', 'puces patch-heros ' + sens);
        ligne.append(el('strong', null, LIBELLES_SENS[sens] + ' '));
        liste.forEach((nom) => ligne.append(el('span', 'puce' + (estMien(nom) ? ' mien' : ''), nom)));
        bloc.append(ligne);
      });
      zone.append(bloc);
    });
  }

  function ligneMeta(table, h, s) {
    const tr = el('tr', miens().indexOf(h.id) !== -1 ? 'mien' : null);
    tr.append(el('td', null, h.nom), el('td', 'nombre', s.winrate.toFixed(1) + ' %'),
      el('td', 'nombre doux', '± ' + s.marge.toFixed(1)), el('td', 'nombre doux', s.presence.toFixed(0) + ' % des parties'));
    table.append(tr);
  }

  function afficherMeta() {
    const zone = document.getElementById('meta-heros');
    zone.textContent = '';
    const donnees = stats.tranches[tranche].heros;
    const lignes = heros.heros.map((h) => ({ h: h, s: donnees[String(h.id)] })).filter((l) => l.s && l.s.winrate != null)
      .sort((a, b) => b.s.winrate - a.s.winrate);
    const bloc = (titre, liste) => {
      const table = el('table', 'meta-table');
      liste.forEach((l) => ligneMeta(table, l.h, l.s));
      zone.append(el('h3', null, titre), table);
    };
    bloc('Les plus forts', lignes.slice(0, NB_META));
    bloc('Les plus faibles', lignes.slice(-NB_META).reverse());
    bloc('Tes héros', lignes.filter((l) => miens().indexOf(l.h.id) !== -1));
    zone.append(el('p', 'aide', 'Depuis le ' + stats.meta.depuis + '. Un écart plus petit que la marge (±) ne veut rien dire. ' +
      'Les jours qui suivent un patch ou la sortie d\'un héros, ces chiffres bougent vite.'));
  }

  function afficher() {
    afficherPatchs();
    afficherMeta();
  }

  Promise.all(['data/patch.json', 'data/hero-stats.json', 'data/heroes.json', 'data/profil.json'].map(DLN.charger)).then((r) => {
    patch = r[0]; stats = r[1]; heros = r[2]; profil = r[3];
    const choix = document.getElementById('opt-tranche');
    Object.keys(stats.tranches).forEach((cle) => {
      const o = el('option', null, LIBELLES_TRANCHE[cle] || cle);
      o.value = cle;
      choix.append(o);
    });
    if (!stats.tranches[tranche]) tranche = profil.tranche_par_defaut;
    choix.value = tranche;
    choix.addEventListener('change', () => {
      tranche = choix.value;
      try { localStorage.setItem(CLE, tranche); } catch (e) { /* stockage indisponible */ }
      afficherMeta();
    });
    document.getElementById('app').hidden = false;
    document.getElementById('meta').textContent = 'Patchs vérifiés le ' + patch.meta.verifie_le +
      ' · résumés reformulés : les notes officielles (liens) font foi · stats : ' + stats.meta.source;
    afficher();
    DLN.surNiveau(afficher);
  }, DLN.echec);
})();
