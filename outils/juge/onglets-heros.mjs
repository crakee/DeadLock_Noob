// Captures de chaque onglet de la fiche héros (bureau 1440 et téléphone), pour le juge-slop.
// Usage : node outils/juge/onglets-heros.mjs [--heros 13,52] ; sorties dans outils/juge/sorties/onglets-<horodatage>/.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = join(ICI, '..', '..');
const PORT = 8767;
const ONGLETS = ['apercu', 'competences', 'contrer', 'builds', 'matchups', 'patch'];
const FORMATS = {
  bureau: { width: 1440, height: 900 },
  telephone: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
};
const i = process.argv.indexOf('--heros');
const HEROS = i > 0 ? process.argv[i + 1].split(',') : ['13', '52'];
const base = join(homedir(), '.cache', 'ms-playwright');
const chrome = join(base, readdirSync(base).filter((d) => /^chromium-\d+$/.test(d)).sort().pop(), 'chrome-linux64', 'chrome');

const serveur = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: RACINE, stdio: 'ignore' });
await new Promise((ok) => setTimeout(ok, 800));
const sortie = join(ICI, 'sorties', 'onglets-' + new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-'));
mkdirSync(sortie, { recursive: true });
const nav = await chromium.launch({ executablePath: chrome });
try {
  for (const [idF, f] of Object.entries(FORMATS)) {
    const ctx = await nav.newContext({ viewport: { width: f.width, height: f.height }, isMobile: !!f.isMobile, hasTouch: !!f.hasTouch, deviceScaleFactor: f.deviceScaleFactor || 1, locale: 'fr-FR' });
    const page = await ctx.newPage();
    const erreurs = [];
    page.on('pageerror', (e) => erreurs.push(e.message));
    for (const h of HEROS) {
      for (const o of ONGLETS) {
        await page.goto(`http://127.0.0.1:${PORT}/heros.html#h=${h}&o=${o}`);
        await page.reload();
        await page.waitForSelector('#fiche .bandeau', { timeout: 8000 });
        await page.waitForTimeout(600);
        await page.screenshot({ path: join(sortie, `${h}-${o}-${idF}.png`), fullPage: true });
      }
    }
    console.log(idF + ' : ' + (erreurs.length ? erreurs.join(' | ') : '0 erreur JS'));
    await ctx.close();
  }
} finally {
  await nav.close();
  serveur.kill();
}
console.log('Sorties : ' + sortie);
