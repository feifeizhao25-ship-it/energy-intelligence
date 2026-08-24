import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

const scenarios = [
  {
    locale: 'cn',
    url: process.env.CN_WEEK_URL || 'http://127.0.0.1:3101/experience-week',
    personaSelector: '.personaButton',
    daySelector: '.dayButton',
    cardSelector: '.experience',
  },
  {
    locale: 'global',
    url: process.env.GLOBAL_WEEK_URL || 'http://127.0.0.1:3102/experience-week',
    personaSelector: 'aside button',
    daySelector: '[aria-label="Seven-day personalization journey"] button',
    cardSelector: 'article',
  },
];

const outputDir = resolve('docs/screenshots/personalization');
mkdirSync(outputDir, { recursive: true });
const workingDir = mkdtempSync(join(tmpdir(), 'energy-week-ui-'));
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});

try {
  for (const scenario of scenarios) {
    const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 1 });
    await page.goto(scenario.url, { waitUntil: 'networkidle' });
    const personas = page.locator(scenario.personaSelector);
    const days = page.locator(scenario.daySelector);
    if ((await personas.count()) !== 5 || (await days.count()) !== 7) {
      throw new Error(`${scenario.locale}: expected 5 personas and 7 days`);
    }

    const images = [];
    for (let persona = 0; persona < 5; persona += 1) {
      await personas.nth(persona).click();
      for (let day = 0; day < 7; day += 1) {
        await days.nth(day).click();
        if ((await personas.nth(persona).getAttribute('aria-pressed')) !== 'true') {
          throw new Error(`${scenario.locale}: persona ${persona + 1} has no selected semantics`);
        }
        if ((await days.nth(day).getAttribute('aria-pressed')) !== 'true') {
          throw new Error(`${scenario.locale}: day ${day + 1} has no selected semantics`);
        }
        const path = join(workingDir, `${scenario.locale}-p${persona + 1}-d${day + 1}.png`);
        await page.locator(scenario.cardSelector).screenshot({ path });
        images.push(path);
      }
    }

    const target = join(outputDir, `${scenario.locale}-5-personas-7-days.png`);
    const rows = [];
    for (let row = 0; row < 5; row += 1) {
      const rowPath = join(workingDir, `${scenario.locale}-row-${row + 1}.png`);
      execFileSync('convert', [
        ...images.slice(row * 7, row * 7 + 7),
        '-thumbnail', '300x220',
        '+append',
        rowPath,
      ]);
      rows.push(rowPath);
    }
    execFileSync('convert', [...rows, '-append', target]);
    console.log(`${scenario.locale}: verified and captured 35 interactive states -> ${target}`);
    await page.close();
  }
} finally {
  await browser.close();
  rmSync(workingDir, { recursive: true, force: true });
}
