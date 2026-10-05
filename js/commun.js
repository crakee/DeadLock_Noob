// Partagé par toutes les pages : barre de navigation (4 espaces), menu de réglages
// (niveau 1 débutant / 2 intermédiaire / 3 tout, tranche de rang), chargement des données
// et petits utilitaires d'affichage.
window.DLN = (function () {
  'use strict';

  const CLE_NIVEAU = 'dln.niveau.v1';
  const CLE_TRANCHE = 'dln.tranche.v1';
  const CLE_LANGUE = 'dln.langue.v1';
  // Langues de l'interface. Les textes longs sont dans data/textes/<langue>/ ; repli sur le français.
  const LANGUES = [['fr', 'Français'], ['en', 'English']];
  const langue = (function () {
    let l = null;
    try { l = localStorage.getItem(CLE_LANGUE); } catch (e) { /* stockage indisponible */ }
    if (LANGUES.some((x) => x[0] === l)) return l;
    return /^fr/i.test(navigator.language || '') ? 'fr' : 'en';
  })();
  document.documentElement.lang = langue;
  // Texte traduit : { fr: '…', en: '…' } → la langue choisie, sinon le français ; une chaîne reste telle quelle.
  const tr = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? (v[langue] != null ? v[langue] : v.fr) : v);
  const TRANCHE_DEFAUT = 'initiate_sentinel';   // repli si data/profil.json est illisible
  const LIBELLES_TRANCHE = {
    tous: 'Tous rangs', initiate_sentinel: 'Initiate → Sentinel',
    mystic_oracle: 'Mystic → Oracle', phantom_eternus: 'Phantom → Eternus'
  };
  const NIVEAUX = [
    [1, { fr: 'Débutant', en: 'Beginner' }, { fr: 'L\'essentiel seulement', en: 'Essentials only' }],
    [2, { fr: 'Intermédiaire', en: 'Intermediate' }, { fr: 'Plus de détails et de minuteurs', en: 'More details and timers' }],
    [3, { fr: 'Tout', en: 'Everything' }, { fr: 'Toutes les valeurs, améliorations, notions avancées', en: 'All values, upgrades, advanced notions' }]
  ];
  const ESPACES = [
    ['partie', { fr: 'En partie', en: 'In game' }, 'index.html'],
    ['apprendre', { fr: 'Apprendre', en: 'Learn' }, 'parcours.html'],
    ['heros', { fr: 'Héros', en: 'Heroes' }, 'heros.html'],
    ['parties', { fr: 'Progression', en: 'Progress' }, 'mes-parties.html'],
    ['patch', 'Patch', 'patch.html']
  ];
  // Sous-onglets de certains espaces.
  const SOUS = {
    heros: [
      ['heros', { fr: 'Fiches', en: 'Heroes' }, 'heros.html'],
      ['counters', 'Counters & compo', 'counters.html']
    ],
    apprendre: [
      ['parcours', { fr: 'Parcours', en: 'Path' }, 'parcours.html'],
      ['memo', { fr: 'Les bases', en: 'Basics' }, 'memo.html'],
      ['roles', { fr: 'Rôles', en: 'Roles' }, 'roles.html'],
      ['carte', { fr: 'Carte', en: 'Map' }, 'carte.html'],
      ['objets', { fr: 'Objets clés', en: 'Key items' }, 'objets.html']
    ]
  };

  const ecouteursNiveau = [];
  const ecouteursTranche = [];
  let niveau = 1;
  let tranche = null;

  const lire = (cle) => { try { return localStorage.getItem(cle); } catch (e) { return null; } };
  const ecrire = (cle, v) => { try { localStorage.setItem(cle, v); } catch (e) { /* stockage indisponible */ } };

  const n = Number(lire(CLE_NIVEAU));
  if (n >= 1 && n <= 3) niveau = n;
  // Anciennes clés par onglet : la première trouvée devient le réglage commun.
  tranche = lire(CLE_TRANCHE) || lire('dln.counters.tranche.v1') || lire('dln.patch.tranche.v1');
  if (!LIBELLES_TRANCHE[tranche]) tranche = null;

  function el(tag, classe, texte) {
    const e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texte != null) e.textContent = texte;
    return e;
  }

  function img(src, classe) {
    const i = el('img', classe || null);
    i.src = src || '';
    i.alt = '';
    i.loading = 'lazy';
    return i;
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

  const fmtNombre = (x) => Number(x).toLocaleString(langue === 'fr' ? 'fr-FR' : 'en-US');

  // Textes d'un fichier dans la langue choisie (data/textes/<langue>/<nom>.json), repli sur le français.
  function chargerTextes(nom) {
    const fr = charger('data/textes/fr/' + nom + '.json');
    if (langue === 'fr') return fr;
    return charger('data/textes/' + langue + '/' + nom + '.json').catch(() => fr);
  }

  // Fusionne des textes { id: {…} } dans une liste d'objets qui ont un id (les textes l'emportent, en profondeur).
  function fusionner(liste, textes) {
    const profond = (a, b) => {
      if (!b || typeof b !== 'object' || Array.isArray(b)) return b;
      const o = Object.assign({}, a);
      Object.keys(b).forEach((k) => { o[k] = a && typeof a[k] === 'object' && !Array.isArray(a[k]) ? profond(a[k], b[k]) : b[k]; });
      return o;
    };
    return liste.map((x) => (textes && textes[x.id] ? profond(x, textes[x.id]) : x));
  }

  // ---------- barre de navigation et réglages ----------

  const page = document.body.dataset.page || '';
  const espace = Object.keys(SOUS).find((k) => SOUS[k].some((a) => a[0] === page)) || page;
  const avecRang = document.body.hasAttribute('data-rang');
  let resumeReglages = null;

  function libelleReglages() {
    if (!resumeReglages) return;
    resumeReglages.textContent = tr(NIVEAUX[niveau - 1][1]) + (avecRang && tranche ? ' · ' + LIBELLES_TRANCHE[tranche] : '');
  }

  function construireBarre() {
    const barre = document.getElementById('barre');
    if (!barre) return;
    barre.className = 'barre';
    const logo = el('a', 'logo');
    logo.href = 'index.html';
    logo.append(el('span', 'logo-dead', 'Deadlock'), el('span', 'logo-noob', 'noob'));
    const nav = el('nav', 'espaces');
    nav.setAttribute('aria-label', 'Espaces');
    ESPACES.forEach((e) => {
      const a = el('a', 'espace' + (e[0] === espace ? ' actif' : ''), tr(e[1]));
      a.href = e[2];
      if (e[0] === espace) a.setAttribute('aria-current', 'page');
      nav.append(a);
    });

    // Menu de réglages : un seul endroit pour le niveau et le rang.
    const menu = el('details', 'reglages-menu');
    const resume = el('summary', 'reglages-bouton');
    resume.append(el('span', 'reglages-icone', '⚙'));
    resumeReglages = el('span', 'reglages-texte');
    resume.append(resumeReglages);
    menu.append(resume);
    const panneau = el('div', 'reglages-panneau');
    panneau.append(el('h3', null, 'Langue · Language'));
    const langues = el('div', 'segments compact');
    LANGUES.forEach((l) => {
      const b = el('button', 'segment', l[1]);
      b.type = 'button';
      b.setAttribute('aria-checked', String(l[0] === langue));
      b.addEventListener('click', () => { if (l[0] !== langue) { ecrire(CLE_LANGUE, l[0]); location.reload(); } });
      langues.append(b);
    });
    panneau.append(langues);
    if (langue !== 'fr') panneau.append(el('p', 'aide', 'Translation in progress: some pages are still in French.'));
    panneau.append(el('h3', null, tr({ fr: 'Niveau', en: 'Level' })), el('p', 'aide', tr({ fr: 'Règle ce qui s\'affiche partout : chrono, mémo, carte, fiches.', en: 'Sets what is shown everywhere: timer, basics, map, hero pages.' })));
    const choix = el('div', 'segments');
    choix.setAttribute('role', 'radiogroup');
    NIVEAUX.forEach((nv) => {
      const b = el('button', 'segment');
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.append(el('strong', null, nv[0] + ' · ' + tr(nv[1])), el('span', null, tr(nv[2])));
      b.addEventListener('click', () => regleNiveau(nv[0]));
      b.dataset.niveau = String(nv[0]);
      choix.append(b);
    });
    panneau.append(choix);
    if (avecRang) {
      panneau.append(el('h3', null, 'Rang des statistiques'),
        el('p', 'aide', 'Winrates et achats de joueurs de ce niveau, depuis le dernier patch.'));
      const rangs = el('div', 'segments compact');
      Object.keys(LIBELLES_TRANCHE).forEach((cle) => {
        const b = el('button', 'segment', LIBELLES_TRANCHE[cle]);
        b.type = 'button';
        b.dataset.tranche = cle;
        b.addEventListener('click', () => regleTranche(cle));
        rangs.append(b);
      });
      panneau.append(rangs);
    }
    menu.append(panneau);
    document.addEventListener('click', (e) => { if (menu.open && !menu.contains(e.target)) menu.open = false; });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') menu.open = false; });

    barre.textContent = '';
    barre.append(logo, nav, menu);

    if (SOUS[espace]) {
      const sous = el('nav', 'sous-nav');
      sous.setAttribute('aria-label', 'Sous-sections');
      SOUS[espace].forEach((a) => {
        const lien = el('a', 'sous-onglet' + (a[0] === page ? ' actif' : ''), tr(a[1]));
        lien.href = a[2];
        if (a[0] === page) lien.setAttribute('aria-current', 'page');
        sous.append(lien);
      });
      barre.after(sous);
    }
    majReglages();
  }

  function majReglages() {
    document.querySelectorAll('.segment[data-niveau]').forEach((b) => {
      b.setAttribute('aria-checked', String(Number(b.dataset.niveau) === niveau));
    });
    document.querySelectorAll('.segment[data-tranche]').forEach((b) => {
      b.setAttribute('aria-checked', String(b.dataset.tranche === tranche));
    });
    libelleReglages();
  }

  function regleNiveau(v) {
    if (v === niveau) return;
    niveau = v;
    ecrire(CLE_NIVEAU, String(niveau));
    majReglages();
    ecouteursNiveau.forEach((f) => f(niveau));
  }

  function regleTranche(v) {
    if (v === tranche) return;
    tranche = v;
    ecrire(CLE_TRANCHE, tranche);
    majReglages();
    ecouteursTranche.forEach((f) => f(tranche));
  }

  construireBarre();

  // Le profil donne la tranche par défaut quand aucune n'a été choisie.
  const profil = charger('data/profil.json').catch(() => ({ heros_joues: [], heros_a_essayer: [], tranche_par_defaut: TRANCHE_DEFAUT }));
  profil.then((p) => {
    if (!tranche) { tranche = LIBELLES_TRANCHE[p.tranche_par_defaut] ? p.tranche_par_defaut : TRANCHE_DEFAUT; majReglages(); }
  });

  // ---------- héros et objets ----------

  // Fiche de héros : lien direct vers un onglet de la fiche.
  const lienHeros = (id, onglet) => 'heros.html#h=' + id + (onglet ? '&o=' + onglet : '');

  // Pastille de héros (portrait rond + nom), cliquable vers sa fiche.
  function pastilleHeros(h, onglet) {
    const a = el('a', 'pastille-heros');
    a.href = lienHeros(h.id, onglet);
    a.append(img(h.icone || h.image), el('span', null, h.nom));
    return a;
  }

  // Héros rangés par rôle principal (premier rôle où ils sont titulaires, sinon « aussi »).
  function grouperParRole(heros, roles) {
    const principal = (id) => roles.roles.find((r) => r.heros.some((h) => h.id === id)) ||
      roles.roles.find((r) => (r.aussi || []).some((h) => h.id === id)) || null;
    const groupes = roles.roles.map((r) => ({ id: r.id, nom: r.nom, heros: [] }));
    const autres = { id: 'autres', nom: 'Non classés', heros: [] };
    heros.forEach((h) => {
      const r = principal(h.id);
      (r ? groupes[roles.roles.indexOf(r)] : autres).heros.push(h);
    });
    return groupes.concat([autres]).filter((g) => g.heros.length);
  }

  return {
    langue: langue,
    tr: tr,
    chargerTextes: chargerTextes,
    fusionner: fusionner,
    niveau: () => niveau,
    tranche: () => tranche || TRANCHE_DEFAUT,
    surNiveau: (f) => ecouteursNiveau.push(f),
    surTranche: (f) => ecouteursTranche.push(f),
    profil: profil,
    LIBELLES_TRANCHE: LIBELLES_TRANCHE,
    charger: charger,
    echec: echec,
    marque: marque,
    el: el,
    img: img,
    fmtNombre: fmtNombre,
    lienHeros: lienHeros,
    pastilleHeros: pastilleHeros,
    grouperParRole: grouperParRole
  };
})();
