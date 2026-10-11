// Captures et mesures de toutes les pages pour l'agent juge-slop (.claude/agents/juge-slop.md).
// Par page et par format : capture du premier écran et de la page entière, mesures du « système »
// visuel (tailles de texte, couleurs, arrondis, ombres, dégradés, emojis, cartes), mots lus, et
// fluidité (décalages de mise en page, tâches longues, temps de réaction des onglets).
//
// Usage : node outils/juge/pages.mjs [--pages index,heros] [--formats bureau]
// Sorties : outils/juge/sorties/pages-<horodatage>/ (non versionné) : captures, mesures.json, resume.md.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = join(ICI, '..', '..');
const PORT = 8766;

const PAGES = {
  index: 'index.html', heros: 'heros.html#h=13', counters: 'counters.html', parcours: 'parcours.html',
  memo: 'memo.html', roles: 'roles.html', carte: 'carte.html', objets: 'objets.html',
  'mes-parties': 'mes-parties.html', patch: 'patch.html'
};
const FORMATS = {
  bureau: { width: 1440, height: 900 },
  ecran2: { width: 1920, height: 1080 },
  telephone: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
};
const arg = (nom) => { const i = process.argv.indexOf('--' + nom); return i > 0 ? process.argv[i + 1].split(',') : null; };

function cheminChromium() {
  const base = join(homedir(), '.cache', 'ms-playwright');
  const dir = readdirSync(base).filter((d) => /^chromium-\d+$/.test(d)).sort().pop();
  return join(base, dir, 'chrome-linux64', 'chrome');
}

// Avant le chargement : on écoute les décalages de mise en page et les tâches longues.
const ECOUTER = () => {
  window.__perf = { cls: 0, decalages: [], longues: [] };
  try {
    new PerformanceObserver((l) => l.getEntries().forEach((e) => {
      if (e.hadRecentInput) return;
      window.__perf.cls += e.value;
      if (e.value > 0.01) window.__perf.decalages.push({ t: Math.round(e.startTime), valeur: +e.value.toFixed(3) });
    })).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__perf.longues.push(Math.round(e.duration)))).observe({ type: 'longtask', buffered: true });
    new PerformanceObserver((l) => { const e = l.getEntries().pop(); if (e) window.__perf.lcp = Math.round(e.startTime); }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch (e) { /* navigateur sans ces mesures */ }
};

const MESURER = () => {
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
  const tous = [...document.body.querySelectorAll('*')].filter(vis);
  const compte = (f) => { const m = new Map(); tous.forEach((e) => { const v = f(e); if (v) m.set(v, (m.get(v) || 0) + 1); }); return [...m.entries()].sort((a, b) => b[1] - a[1]); };
  const st = (e) => getComputedStyle(e);
  const avecTexte = tous.filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
  const texte = document.body.innerText;
  // Mots comptés de la même façon partout : textes directs des éléments visibles (le premier écran = ceux qui commencent dans la fenêtre).
  const textesDe = (liste) => liste.map((e) => [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' ')).join(' ');
  const premierEcran = textesDe(avecTexte.filter((e) => e.getBoundingClientRect().top < innerHeight));
  const mots = (t) => (t.match(/[\p{L}\d]+/gu) || []).length;
  const emojis = texte.match(/\p{Extended_Pictographic}/gu) || [];
  const cartes = tous.filter((e) => { const s = st(e); return parseFloat(s.borderTopLeftRadius) >= 4 && (s.boxShadow !== 'none' || parseFloat(s.borderTopWidth) > 0) && s.backgroundColor !== 'rgba(0, 0, 0, 0)'; });
  return {
    titre: document.title,
    mots_total: mots(textesDe(avecTexte)),
    mots_premier_ecran: mots(premierEcran),
    hauteur_page_ecrans: +(document.documentElement.scrollHeight / innerHeight).toFixed(1),
    emojis: { total: emojis.length, distincts: [...new Set(emojis)].join(' ') },
    tailles_texte: compte((e) => avecTexte.includes(e) && st(e).fontSize).slice(0, 15),
    polices: compte((e) => avecTexte.includes(e) && st(e).fontFamily.split(',')[0]),
    graisses: compte((e) => avecTexte.includes(e) && st(e).fontWeight),
    majuscules: avecTexte.filter((e) => st(e).textTransform === 'uppercase').length,
    couleurs_texte: compte((e) => avecTexte.includes(e) && st(e).color).slice(0, 15),
    couleurs_fond: compte((e) => { const c = st(e).backgroundColor; return c !== 'rgba(0, 0, 0, 0)' && c; }).slice(0, 15),
    arrondis: compte((e) => { const r = st(e).borderTopLeftRadius; return r !== '0px' && r; }),
    ombres: compte((e) => { const s = st(e).boxShadow; return s !== 'none' && s; }).length,
    degrades: tous.filter((e) => st(e).backgroundImage.includes('gradient')).length,
    cartes: cartes.length,
    cartes_dans_cartes: cartes.filter((c) => cartes.some((p) => p !== c && p.contains(c))).length,
    boutons: tous.filter((e) => e.matches('button, [role=button], a.btn, .btn')).length,
    liens: tous.filter((e) => e.matches('a[href]')).length,
    transitions: compte((e) => { const d = st(e).transitionDuration; return d !== '0s' && st(e).transitionProperty + ' ' + d; }).slice(0, 8),
    animations: compte((e) => { const a = st(e).animationName; return a !== 'none' && a; }),
    reduit_mouvement: [...document.styleSheets].some((s) => { try { return [...s.cssRules].some((r) => r.conditionText && r.conditionText.includes('prefers-reduced-motion')); } catch (e) { return false; } }),
    focus_visible: [...document.styleSheets].some((s) => { try { return [...s.cssRules].some((r) => r.selectorText && r.selectorText.includes(':focus-visible')); } catch (e) { return false; } }),
    images_sans_alt: tous.filter((e) => e.matches('img:not([alt])')).length,
    petits_textes: avecTexte.filter((e) => parseFloat(st(e).fontSize) < 12).length,
    cibles_trop_petites: tous.filter((e) => e.matches('button, a[href], input, select') && (e.getBoundingClientRect().height < 24 || e.getBoundingClientRect().width < 24)).length
  };
};

// Réaction des onglets : clic → deux images peintes ; décalages de mise en page pendant le clic.
async function reactivite(page) {
  const cibles = await page.$$('[role=tab], [aria-selected], .onglet, .onglet-partie, details > summary');
  const mesures = [];
  for (const c of cibles.slice(0, 6)) {
    try {
      const nom = (await c.innerText()).trim().slice(0, 30);
      const avant = await page.evaluate(() => window.__perf.cls);
      const t0 = await page.evaluate(() => performance.now());
      await c.click({ timeout: 2000 });
      const ms = await page.evaluate((t0) => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(() => ok(Math.round(performance.now() - t0))))), t0);
      const apres = await page.evaluate(() => window.__perf.cls);
      mesures.push({ onglet: nom, ms, decalage: +(apres - avant).toFixed(3) });
    } catch (e) { /* onglet non cliquable */ }
  }
  return mesures;
}

const serveur = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: RACINE, stdio: 'ignore' });
await new Promise((ok) => setTimeout(ok, 800));
const sortie = join(ICI, 'sorties', 'pages-' + new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-'));
mkdirSync(sortie, { recursive: true });
const navigateur = await chromium.launch({ executablePath: cheminChromium() });
const resultats = [];
try {
  for (const [id, chemin] of Object.entries(PAGES).filter(([id]) => !arg('pages') || arg('pages').includes(id))) {
    for (const [idF, f] of Object.entries(FORMATS).filter(([id]) => !arg('formats') || arg('formats').includes(id))) {
      const ctx = await navigateur.newContext({ viewport: { width: f.width, height: f.height }, isMobile: !!f.isMobile, hasTouch: !!f.hasTouch, deviceScaleFactor: f.deviceScaleFactor || 1, locale: 'fr-FR' });
      const page = await ctx.newPage();
      const erreurs = [];
      page.on('pageerror', (e) => erreurs.push(e.message));
      await page.addInitScript(ECOUTER);
      const t0 = Date.now();
      await page.goto(`http://127.0.0.1:${PORT}/${chemin}`, { waitUntil: 'networkidle' });
      const charge_ms = Date.now() - t0;
      await page.waitForTimeout(500);
      const nom = `${id}-${idF}`;
      await page.screenshot({ path: join(sortie, nom + '-ecran.png') });
      await page.screenshot({ path: join(sortie, nom + '-page.png'), fullPage: true });
      const m = await page.evaluate(MESURER);
      const perf = await page.evaluate(() => window.__perf);
      const onglets = await reactivite(page);
      resultats.push({ page: id, format: idF, charge_ms, lcp_ms: perf.lcp, cls: +perf.cls.toFixed(3), decalages: perf.decalages, taches_longues_ms: perf.longues, onglets, erreurs, ...m });
      await ctx.close();
      console.log(nom);
    }
  }
} finally {
  await navigateur.close();
  serveur.kill();
}
writeFileSync(join(sortie, 'mesures.json'), JSON.stringify(resultats, null, 1));
const ligne = (r) => `| ${r.page} | ${r.format} | ${r.mots_premier_ecran} / ${r.mots_total} | ${r.hauteur_page_ecrans} | ${r.emojis.total} | ${r.tailles_texte.length} | ${r.couleurs_texte.length}+${r.couleurs_fond.length} | ${r.arrondis.length} | ${r.cartes} (${r.cartes_dans_cartes}) | ${r.majuscules} | ${r.cls} | ${r.lcp_ms ?? '—'} | ${Math.max(0, ...r.onglets.map((o) => o.ms))} | ${r.erreurs.length} |`;
writeFileSync(join(sortie, 'resume.md'), [
  '# Pages du site : mesures', '',
  'Mots : premier écran / total. Hauteur en écrans. Couleurs : texte + fond distinctes (15 max listées). Cartes : blocs arrondis à fond et bordure ou ombre (dont imbriquées). CLS : décalage cumulé de mise en page (bon < 0,1). Onglet : réaction la plus lente en ms (bon < 100).', '',
  '| Page | Format | Mots | Hauteur | Emojis | Tailles de texte | Couleurs | Arrondis | Cartes | Majuscules | CLS | LCP ms | Onglet ms | Erreurs |',
  '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
  ...resultats.map(ligne)
].join('\n') + '\n');
console.log('Sorties : ' + sortie);
