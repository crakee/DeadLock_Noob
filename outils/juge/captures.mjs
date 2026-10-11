// Joue des parties simulées sur la page En partie pour l'agent juge (docs/brief-juge.md).
// Horloge simulée (Playwright page.clock) : 40 min en quelques secondes. Toutes les 10 s, on lit
// l'écran ; une capture n'est gardée que si le texte affiché a changé (chiffres ignorés, sinon le
// chrono rendrait chaque image différente). Les sons et les voix déclenchés sont notés au passage.
// « coupes » : texte qui dépasse de sa boîte (masqué ou à faire défiler), par panneau.
// Morts simulées : onglet Attente pendant la durée de réapparition de data/reapparition.json.
//
// Usage : node outils/juge/captures.mjs [--parties haze,mirage] [--formats ecran-1080p]
// Sorties : outils/juge/sorties/<horodatage>/ (non versionné) : captures, journal.json, resume.md.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = join(ICI, '..', '..');
const PORT = 8765;
const lireJson = (p) => JSON.parse(readFileSync(join(RACINE, p), 'utf8'));
const S = lireJson('outils/juge/scenarios.json');
const R = lireJson('data/reapparition.json');
const HEROS = Object.fromEntries(lireJson('data/heroes.json').heros.map((h) => [h.id, h.nom]));

const arg = (nom) => { const i = process.argv.indexOf('--' + nom); return i > 0 ? process.argv[i + 1].split(',') : null; };
const parties = S.parties.filter((p) => !arg('parties') || arg('parties').includes(p.id));
const formats = Object.entries(S.formats).filter(([id]) => !arg('formats') || arg('formats').includes(id));

// Chromium déjà installé par Playwright sur la machine (révision quelconque).
function cheminChromium() {
  const base = join(homedir(), '.cache', 'ms-playwright');
  const dir = readdirSync(base).filter((d) => /^chromium-\d+$/.test(d)).sort().pop();
  if (!dir) throw new Error('Chromium introuvable dans ' + base + ' : npx playwright install chromium');
  return join(base, dir, 'chrome-linux64', 'chrome');
}

function reapparition(t) {
  const m = t / 60, P = R.points;
  if (m <= P[0].minute) return P[0].secondes;
  for (let i = 1; i < P.length; i++) {
    if (m <= P[i].minute) {
      const a = P[i - 1], b = P[i];
      return Math.min(R.maximum_s, a.secondes + (b.secondes - a.secondes) * (m - a.minute) / (b.minute - a.minute));
    }
  }
  return R.maximum_s;
}

const mmss = (t) => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');

// Texte visible par panneau, pour le résumé et pour détecter un changement.
const LIRE_ECRAN = () => {
  const vis = (e) => e && !e.hidden && e.offsetParent !== null;
  const panneaux = {};
  document.querySelectorAll('[data-panneau], #contexte').forEach((s) => {
    if (vis(s)) panneaux[s.dataset.panneau || s.id] = s.innerText.replace(/\n{2,}/g, '\n').trim();
  });
  // Texte coupé : un élément visible dont le contenu dépasse sa boîte sans barre de défilement.
  const coupes = [];
  const app = document.getElementById('app') || document.body;
  app.querySelectorAll('*').forEach((e) => {
    if (!vis(e) || !e.innerText || !e.innerText.trim()) return;
    const st = getComputedStyle(e);
    // Masqué (hidden/clip) ou à faire défiler (auto/scroll) : en jouant, on ne fait pas défiler un panneau.
    const cache = (v) => v !== 'visible';
    const depasseY = cache(st.overflowY) && e.scrollHeight - e.clientHeight > 4;
    const depasseX = cache(st.overflowX) && e.scrollWidth - e.clientWidth > 4;
    const ellipse = st.textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth + 1;
    if (depasseY || depasseX || ellipse) {
      const p = e.closest('[data-panneau]');
      coupes.push({ panneau: p ? p.dataset.panneau : (e.id || e.className || e.tagName), mode: /auto|scroll/.test(st.overflowY + st.overflowX) ? 'à faire défiler' : 'masqué', cache_px: Math.max(e.scrollHeight - e.clientHeight, e.scrollWidth - e.clientWidth), texte: e.innerText.replace(/\s+/g, ' ').slice(0, 80) });
    }
  });
  const coach = document.querySelector('[data-panneau="coach"]');
  return {
    panneaux,
    coupes,
    horloge: (document.getElementById('horloge') || {}).textContent,
    principal: coach && vis(coach) ? coach.innerText.split('\n').filter(Boolean).slice(0, 4).join(' | ') : null,
    defile: document.documentElement.scrollHeight > window.innerHeight + 2,
    onglet: [...document.body.classList].find((c) => c.startsWith('onglet-')) || ''
  };
};

// Journal des sons et voix : on enveloppe les fonctions appelées par le site.
const ESPIONNER = () => {
  window.__journal = [];
  const appelant = () => (new Error().stack || '').split('\n').filter((l) => /js\/[a-z-]+\.js/.test(l)).slice(0, 2).map((l) => l.trim().replace(/^at /, '').replace(/https?:\/\/[^/]+\//, '')).join(' ← ');
  const note = (type, detail) => window.__journal.push({ type, detail, source: appelant(), horloge: (document.getElementById('horloge') || {}).textContent });
  if (window.DLN && DLN.sons) { const j = DLN.sons.jouer; DLN.sons.jouer = (m, p) => { note('son', { moment: m, profil: p || DLN.sons.profil() }); return j(m, p); }; }
  if (window.DLN && DLN.voix) { const a = DLN.voix.annoncer; DLN.voix.annoncer = (n, r) => { note('voix', { nom: n, restant_s: r }); return a(n, r); }; }
  if (window.speechSynthesis) { const s = speechSynthesis.speak.bind(speechSynthesis); speechSynthesis.speak = (u) => { note('voix-navigateur', { texte: u.text }); try { s(u); } catch (e) { /* sans voix */ } }; }
};

async function jouerPartie(navigateur, partie, [idFormat, format], dossier) {
  const ctx = await navigateur.newContext({ viewport: { width: format.width, height: format.height }, isMobile: !!format.isMobile, hasTouch: !!format.hasTouch, deviceScaleFactor: format.deviceScaleFactor || 1, locale: 'fr-FR' });
  const page = await ctx.newPage();
  const T0 = Date.parse('2026-10-11T20:00:00Z');
  // Horloge figée : le temps n'avance que par runFor (sinon le temps réel s'ajoute et le chrono dérive).
  await page.clock.install({ time: T0 - 60000 });
  await page.clock.pauseAt(T0 - 30000);
  await page.addInitScript(({ partie, T0 }) => {
    if (sessionStorage.getItem('juge.pret')) return;
    sessionStorage.setItem('juge.pret', '1');
    localStorage.clear();
    localStorage.setItem('dln.langue.v1', JSON.stringify('fr'));
    localStorage.setItem('dln.partie.contexte.v1', JSON.stringify({ heros: partie.heros, role: null, lane: null }));
    localStorage.setItem('dln.counters.choisis.v1', JSON.stringify(partie.en_face));
    localStorage.setItem('dln.partie.affichage.v1', JSON.stringify({ onglet: 'jeu' }));
    localStorage.setItem('dln.timeline.etat.v1', JSON.stringify({ depart: T0, pauseA: null, declenches: {}, termines: {} }));
  }, { partie, T0 });

  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  await page.goto(`http://127.0.0.1:${PORT}/index.html`);
  await page.clock.runFor(30000);
  await page.evaluate(ESPIONNER);

  const lignes = [];
  let derniere = null, dernierPrincipal = null, nCaptures = 0, mortJusqua = -1;
  for (let t = 0; t <= S.duree_s; t += S.pas_s) {
    // Mort simulée : on passe sur l'onglet Mort (touche M) le temps de la réapparition.
    const mort = S.morts_s.find((m) => m === t);
    let evenement = null;
    if (mort != null) {
      const d = Math.round(reapparition(t));
      mortJusqua = t + d;
      evenement = `mort (réapparition ${d} s)`;
      await page.keyboard.press('a');   // onglet Attente (réapparition)
    } else if (mortJusqua >= 0 && t >= mortJusqua) {
      mortJusqua = -1;
      evenement = 'réapparition';
      await page.keyboard.press('j');
    }
    if (t > 0) await page.clock.runFor(S.pas_s * 1000);

    const ecran = await page.evaluate(LIRE_ECRAN);
    const sons = await page.evaluate(() => window.__journal.splice(0));
    const empreinte = createHash('sha1').update(JSON.stringify(ecran.panneaux).replace(/\d/g, '#')).digest('hex').slice(0, 12);
    const nouveauPrincipal = ecran.principal && ecran.principal.replace(/\d/g, '#') !== dernierPrincipal;
    dernierPrincipal = ecran.principal && ecran.principal.replace(/\d/g, '#');
    let capture = null;
    if (empreinte !== derniere || evenement) {
      capture = `${String(t).padStart(4, '0')}s.png`;
      await page.screenshot({ path: join(dossier, capture), fullPage: true });
      if (format.isMobile) await page.screenshot({ path: join(dossier, capture.replace('.png', '-ecran.png')) });
      nCaptures++;
    }
    derniere = empreinte;
    lignes.push({ t, chrono: mmss(t), affiche: ecran.horloge, evenement, onglet: ecran.onglet, defile: ecran.defile, coupes: ecran.coupes.length ? ecran.coupes : undefined,
      nouveau_message: nouveauPrincipal || undefined, principal: nouveauPrincipal ? ecran.principal : undefined,
      capture, identique: capture ? undefined : true, sons, panneaux: capture ? ecran.panneaux : undefined });
  }
  await ctx.close();
  return { partie: partie.id, heros: HEROS[partie.heros], en_face: partie.en_face.map((id) => HEROS[id]), format: idFormat, captures: nCaptures, erreurs, lignes };
}

function resume(r) {
  const out = [`## ${r.heros} contre ${r.en_face.join(', ')} — ${r.format}`, '',
    `${r.captures} captures gardées sur ${r.lignes.length} instants ; ${r.lignes.filter((l) => l.nouveau_message).length} nouveaux messages du coach ; ci-dessous seulement les nouveaux messages, morts, sons et textes coupés.` + (r.erreurs.length ? ` **Erreurs JS : ${r.erreurs.length}** (${[...new Set(r.erreurs)].slice(0, 3).join(' | ')})` : ''), ''];
  for (const l of r.lignes) {
    if (!l.nouveau_message && !l.evenement && !l.sons.length && !l.coupes) continue;
    const s = l.sons.map((x) => (x.type === 'son' ? `🔔 ${x.detail.moment}` : `🗣 ${x.detail.nom || x.detail.texte}${x.detail.restant_s != null ? ' (' + Math.round(x.detail.restant_s) + ' s)' : ''}`) + ` [${(x.source || '').split(' ← ')[0]}]`).join(', ');
    const ecart = l.affiche && l.affiche !== l.chrono ? ` (affiché ${l.affiche})` : '';
    out.push(`- **${l.chrono}**${ecart}${l.evenement ? ' · ' + l.evenement : ''} · ${l.onglet}${l.defile ? ' · ⚠ défilement' : ''}${l.coupes ? ' · ✂ texte coupé (' + [...new Set(l.coupes.map((c) => c.panneau))].join(', ') + ')' : ''}${l.capture ? ' · `' + l.capture + '`' : ''}${s ? ' · ' + s : ''}${l.principal ? '\n  - 💬 ' + l.principal : ''}`);
  }
  return out.join('\n') + '\n';
}

const serveur = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: RACINE, stdio: 'ignore' });
await new Promise((ok) => setTimeout(ok, 800));
const racineSortie = join(ICI, 'sorties', new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-'));
const navigateur = await chromium.launch({ executablePath: cheminChromium() });
const tous = [];
try {
  for (const p of parties) {
    for (const f of formats) {
      const dossier = join(racineSortie, `${p.id}-${f[0]}`);
      mkdirSync(dossier, { recursive: true });
      const r = await jouerPartie(navigateur, p, f, dossier);
      writeFileSync(join(dossier, 'journal.json'), JSON.stringify(r, null, 1));
      tous.push(r);
      console.log(`${p.id} ${f[0]} : ${r.captures} captures, ${r.erreurs.length} erreurs JS`);
    }
  }
} finally {
  await navigateur.close();
  serveur.kill();
}
writeFileSync(join(racineSortie, 'resume.md'), `# Parties simulées du ${new Date().toISOString().slice(0, 16)}\n\n` + tous.map(resume).join('\n'));
console.log('Sorties : ' + racineSortie);
