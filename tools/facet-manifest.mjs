#!/usr/bin/env node
// Stamp #facet-manifest in index.html with the tags the rail derives today,
// so every later load can tell whether its own derivation still agrees.
//
// The rail's facets are read off the live CSSOM at load — nothing is authored
// twice, and nothing can drift out of step with the studies. The cost of that
// honesty is that a bug in the derivation mis-files studies with no error at
// all: the rail shows the wrong numbers as confidently as the right ones.
// This script runs the page in a real headless browser, reads the tags the
// derivation produced, and writes them into the page as a manifest. The page
// compares itself against that manifest on every load and shouts to the
// console when the two disagree. The derivation stays the source of truth;
// the manifest only says when it stops matching the build it was checked on.
//
// Run it after adding a study, renaming classes, or touching tag():
//   node tools/facet-manifest.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const page = path.join(root, 'index.html');

// Playwright is not a dependency of this repo; it lives in the npx cache from
// the sync tooling's own runs. Try the module name first so a real install
// wins if one ever appears.
async function loadPlaywright(){
  // Playwright is CJS, so the namespace arrives under .default.
  const unwrap = m => (m && m.default && m.default.chromium) ? m.default : m;
  try {
    const m = unwrap(await import('playwright'));
    if (m && m.chromium) return m;
  } catch (e) {}
  const cache = '/Users/sannagranqvist/.npm/_npx/218f5d799962bf90/node_modules/playwright/index.js';
  try {
    const m = unwrap(await import(cache));
    if (m && m.chromium) return m;
    throw new Error('no chromium export');
  } catch (e) {
    console.error('playwright not found (tried the module and the npx cache).');
    console.error('Run: npx playwright install chromium — or npm i -D playwright');
    process.exit(1);
  }
}

const { chromium } = await loadPlaywright();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const tab = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await tab.goto(pathToFileURL(page).href, { waitUntil: 'load' });

// tag() runs on DOMContentLoaded; wait until every card carries its answers.
await tab.waitForFunction(() => {
  const cards = document.querySelectorAll('.spec');
  return cards.length > 0 &&
    [].every.call(cards, c => c.dataset.answers !== undefined);
}, null, { timeout: 15000 });

const { map, counts, total } = await tab.evaluate(() => {
  const map = {}, counts = {};
  const cards = [].slice.call(document.querySelectorAll('.spec'));
  cards.forEach(c => {
    map[c.dataset.id] = c.dataset.changes + '|' + c.dataset.answers;
    (c.dataset.changes + ' ' + c.dataset.answers).split(/\s+/).forEach(k => {
      if (k) counts[k] = (counts[k] || 0) + 1;
    });
  });
  return { map, counts, total: cards.length };
});
await browser.close();

if (total < 2) { console.error(`only ${total} cards found — refusing to stamp`); process.exit(1); }

const html = fs.readFileSync(page, 'utf8');
const re = /(<script type="application\/json" id="facet-manifest">)[\s\S]*?(<\/script>)/;
const hits = html.match(new RegExp(re.source, 'g'));
if (!hits || hits.length !== 1) {
  console.error(`expected exactly one #facet-manifest block, found ${hits ? hits.length : 0}`);
  process.exit(1);
}
const out = html.replace(re, `$1${JSON.stringify(map)}$2`);
// The manifest is the only thing allowed to change, and it only ever grows or
// shifts by its own size — anything bigger means the regex ate the page.
if (Math.abs(out.length - html.length) > JSON.stringify(map).length + 64) {
  console.error('replacement changed more than the manifest itself — aborting, nothing written');
  process.exit(1);
}
fs.writeFileSync(page, out);

console.log(`stamped ${total} cards into #facet-manifest`);
console.log(Object.keys(counts).sort().map(k => `  ${k} ${counts[k]}`).join('\n'));
