// Builds importés : n'importe quel build public du jeu, retrouvé par son numéro (affiché dans le
// navigateur de builds en jeu), par un lien qui contient ce numéro, ou par son nom. Lus en direct
// sur deadlock-api.com (/v1/builds), gardés dans ce navigateur (dln.builds.importes.v1).
// Le build « suivi » d'un héros (dln.builds.suivi.v1) remplace les achats moyens dans le coach En partie :
// minute estimée de chaque objet d'après data/achats.json (voir calendrier()).
// À charger après js/commun.js : expose DLN.builds.
(function () {
  'use strict';

  const API = 'https://api.deadlock-api.com/v1/builds';
  const CLE = 'dln.builds.importes.v1';
  const CLE_SUIVI = 'dln.builds.suivi.v1';
  // Même table que outils/maj_donnees.py (SECTIONS_BUILD).
  const SECTIONS = {
    '#Citadel_HeroBuilds_EarlyGame': 'Early game', '#Citadel_HeroBuilds_Early': 'Early game',
    '#Citadel_HeroBuilds_MidGame': 'Mid game', '#Citadel_HeroBuilds_Mid': 'Mid game',
    '#Citadel_HeroBuilds_LateGame': 'Late game', '#Citadel_HeroBuilds_Late': 'Late game'
  };

  const lire = (cle, defaut) => { try { return JSON.parse(localStorage.getItem(cle)) || defaut; } catch (e) { return defaut; } };
  const ecrire = (cle, v) => { try { localStorage.setItem(cle, JSON.stringify(v)); } catch (e) { /* stockage indisponible */ } };
  const ecouteurs = [];
  const prevenir = () => ecouteurs.forEach((f) => f());

  let objets = null;
  const pret = DLN.charger('data/items.json').then((d) => {
    objets = {};
    d.objets.forEach((o) => { objets[o.id] = o; });
  });

  const nomSection = (n) => SECTIONS[n] || (n && n.charAt(0) === '#' ? n.replace('#Citadel_HeroBuilds_', '') : n) || 'Sans titre';

  // Réponse de l'API → même forme que data/builds.json (+ heros, coûts, sections au choix).
  function convertir(b) {
    const hb = b.hero_build;
    return {
      id: hb.hero_build_id, heros: hb.hero_id, nom: hb.name || ('Build ' + hb.hero_build_id), version: hb.version,
      favoris: b.num_favorites || 0,
      mis_a_jour: new Date((hb.last_updated_timestamp || 0) * 1000).toISOString().slice(0, 10),
      description: hb.description ? hb.description.slice(0, 300) : null,
      sections: ((hb.details || {}).mod_categories || []).map((c) => ({
        nom: nomSection(c.name), note: c.description || null, au_choix: !!c.optional,
        objets: (c.mods || []).map((m) => objets[m.ability_id]).filter(Boolean).map((o) => o.nom)
      })).filter((s) => s.objets.length)
    };
  }

  // Un numéro de 3 chiffres ou plus (seul ou dans un lien) = numéro de build ; sinon recherche par nom pour ce héros.
  function chercher(texte, idHeros) {
    const n = (String(texte).match(/\d{3,}/) || [])[0];
    const q = n ? { build_id: n, only_latest: 'true' }
      : { search_name: String(texte).trim(), hero_id: idHeros, only_latest: 'true', sort_by: 'favorites', limit: '6' };
    return pret.then(() => fetch(API + '?' + new URLSearchParams(q)))
      .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then((liste) => liste.map(convertir));
  }

  const liste = (idHeros) => lire(CLE, []).filter((b) => idHeros == null || b.heros === idHeros);

  function importer(build) {
    const tous = lire(CLE, []).filter((b) => b.id !== build.id);
    tous.unshift(Object.assign({}, build, { importe_le: new Date().toISOString().slice(0, 10) }));
    ecrire(CLE, tous);
    prevenir();
    return build;
  }

  function retirer(id) {
    ecrire(CLE, lire(CLE, []).filter((b) => b.id !== id));
    const s = lire(CLE_SUIVI, {});
    Object.keys(s).forEach((h) => { if (s[h] === id) delete s[h]; });
    ecrire(CLE_SUIVI, s);
    prevenir();
  }

  // Suivre un build en partie (null = revenir aux achats moyens). Un build public pas encore importé l'est au passage.
  function suivre(idHeros, build) {
    const s = lire(CLE_SUIVI, {});
    if (build) {
      if (!liste().some((b) => b.id === build.id)) importer(build);
      s[idHeros] = build.id;
    } else delete s[idHeros];
    ecrire(CLE_SUIVI, s);
    prevenir();
  }

  function suivi(idHeros) {
    const id = lire(CLE_SUIVI, {})[idHeros];
    return id == null ? null : (liste().find((b) => b.id === id) || null);
  }

  // Minute estimée de chaque objet du build, dans l'ordre du build : au plus tôt quand on a pu payer
  // l'objet après le précédent, au rythme de souls de ce héros (coût cumulé de ses achats moyens,
  // data/achats.json, divisé par la minute du dernier) ; plus tard si ses joueurs l'achètent en moyenne
  // plus tard. Les sections « au choix » gardent leurs objets (le coach dit « au choix »).
  function calendrier(build, moyens) {
    const minuteDe = {};
    (moyens || []).forEach((o) => { minuteDe[o.nom] = o.minute; });
    const tries = (moyens || []).slice().sort((a, b) => a.minute - b.minute);
    const dernier = tries[tries.length - 1];
    const parMinute = dernier && dernier.minute > 0 ? tries.reduce((s, o) => s + (o.cout || 0), 0) / dernier.minute : null;
    let t = 0;
    const sortie = [];
    build.sections.forEach((sec) => sec.objets.forEach((nom) => {
      const o = objets && Object.values(objets).find((x) => x.nom === nom);
      const cout = o ? o.cout : null;
      const auPlusTot = t + (parMinute && cout ? cout / parMinute : 1);
      t = Math.max(auPlusTot, minuteDe[nom] || 0);
      sortie.push({ nom: nom, cout: cout, minute: t, section: sec.nom, au_choix: sec.au_choix, estime: minuteDe[nom] == null });
    }));
    return sortie;
  }

  window.addEventListener('storage', (e) => { if (e.key === CLE || e.key === CLE_SUIVI) prevenir(); });

  DLN.builds = {
    pret: pret, chercher: chercher, liste: liste, importer: importer, retirer: retirer,
    suivre: suivre, suivi: suivi, calendrier: calendrier,
    surChange: (f) => ecouteurs.push(f)
  };
})();
