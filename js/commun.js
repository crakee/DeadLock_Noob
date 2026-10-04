// Partagé par toutes les pages : barre de navigation (4 espaces), menu de réglages
// (niveau 1 débutant / 2 intermédiaire / 3 tout, tranche de rang), chargement des données
// et petits utilitaires d'affichage.
window.DLN = (function () {
  'use strict';

  const CLE_NIVEAU = 'dln.niveau.v1';
  const CLE_TRANCHE = 'dln.tranche.v1';
  const TRANCHE_DEFAUT = 'initiate_sentinel';   // repli si data/profil.json est illisible
  const LIBELLES_TRANCHE = {
    tous: 'Tous rangs', initiate_sentinel: 'Initiate → Sentinel',
    mystic_oracle: 'Mystic → Oracle', phantom_eternus: 'Phantom → Eternus'
  };
  const NIVEAUX = [
    [1, 'Débutant', 'L\'essentiel seulement'],
    [2, 'Intermédiaire', 'Plus de détails et de minuteurs'],
    [3, 'Tout', 'Toutes les valeurs, améliorations, notions avancées']
  ];
  const ESPACES = [
    ['partie', 'En partie', 'index.html'],
    ['heros', 'Héros', 'heros.html'],
    ['apprendre', 'Apprendre', 'memo.html'],
    ['patch', 'Patch', 'patch.html']
  ];
  // Sous-onglets de certains espaces.
  const SOUS = {
    heros: [
      ['heros', 'Fiches', 'heros.html'],
      ['counters', 'Counters & compo', 'counters.html']
    ],
    apprendre: [
      ['memo', 'Les bases', 'memo.html'],
      ['roles', 'Rôles', 'roles.html'],
      ['carte', 'Carte', 'carte.html'],
      ['objets', 'Objets clés', 'objets.html']
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

  const fmtNombre = (x) => Number(x).toLocaleString('fr-FR');

  // ---------- barre de navigation et réglages ----------

  const page = document.body.dataset.page || '';
  const espace = Object.keys(SOUS).find((k) => SOUS[k].some((a) => a[0] === page)) || page;
  const avecRang = document.body.hasAttribute('data-rang');
  let resumeReglages = null;

  function libelleReglages() {
    if (!resumeReglages) return;
    resumeReglages.textContent = NIVEAUX[niveau - 1][1] + (avecRang && tranche ? ' · ' + LIBELLES_TRANCHE[tranche] : '');
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
      const a = el('a', 'espace' + (e[0] === espace ? ' actif' : ''), e[1]);
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
    panneau.append(el('h3', null, 'Niveau'), el('p', 'aide', 'Règle ce qui s\'affiche partout : chrono, mémo, carte, fiches.'));
    const choix = el('div', 'segments');
    choix.setAttribute('role', 'radiogroup');
    NIVEAUX.forEach((nv) => {
      const b = el('button', 'segment');
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.append(el('strong', null, nv[0] + ' · ' + nv[1]), el('span', null, nv[2]));
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
        const lien = el('a', 'sous-onglet' + (a[0] === page ? ' actif' : ''), a[1]);
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
