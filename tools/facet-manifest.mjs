#!/usr/bin/env node
// Stamp #facet-manifest in index.html with the tags the rail derives today,
// so every later load can tell whether its own derivation still agrees — and
// #number-map with the display number each study wore while it did.
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
// The second stamp answers a different question and needs no browser at all,
// but it belongs to the same moment: both are «this is how the run stood».
// A study is named by its data-key — the effect class, which the CSS depends
// on and so cannot move by accident — and NOT by its number, which is a
// position and moves whenever a study is retired. Stamping tags against the
// number re-filed every card after a retirement against another card's tags.
//
// Run it after adding a study, renaming classes, renumbering, or touching
// tag():
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

const { map, nums, counts, total } = await tab.evaluate(() => {
  const map = {}, nums = {}, counts = {};
  const cards = [].slice.call(document.querySelectorAll('.spec'));
  // window.__bhlDerived and NOT the cards' own data-changes. The rail wears the
  // STAMP now, so data-changes is this file's previous output read back — stamp
  // from that and the manifest re-stamps itself for ever, and a correction to
  // the derivation can never reach the build. Ask the derivation directly.
  // Fall back to the DOM only if the page predates the export.
  const derived = window.__bhlDerived || null;
  cards.forEach(c => {
    // data-key is authored on the article. The fallback is the number, and it
    // is only a fallback: a study reaching it is one the page could not name,
    // which the page's own duplicate check reports in the console.
    const key = c.dataset.key || c.dataset.id;
    const tags = (derived && derived[key]) ||
                 (c.dataset.changes + '|' + c.dataset.answers);
    map[key] = tags;
    nums[key] = c.dataset.id;
    tags.replace('|', ' ').split(/\s+/).forEach(k => {
      if (k) counts[k] = (counts[k] || 0) + 1;
    });
  });
  return { map, nums, counts, total: cards.length, from: derived ? 'derivation' : 'DOM' };
});
await browser.close();

if (total < 2) { console.error(`only ${total} cards found — refusing to stamp`); process.exit(1); }

if (Object.keys(map).length !== total) {
  console.error(`${total} cards but ${Object.keys(map).length} keys — two studies share one data-key`);
  process.exit(1);
}

let html = fs.readFileSync(page, 'utf8');

// Each block is replaced on its own, and each is checked against its own size:
// the guard is that a JSON blob only ever grows or shifts by roughly its own
// length, so anything bigger means the regex ate the page instead.
function stamp(src, id, data){
  const re = new RegExp(`(<script type="application/json" id="${id}">)[\\s\\S]*?(</script>)`);
  const hits = src.match(new RegExp(re.source, 'g'));
  if (!hits || hits.length !== 1) {
    console.error(`expected exactly one #${id} block, found ${hits ? hits.length : 0}`);
    process.exit(1);
  }
  const json = JSON.stringify(data);
  const out = src.replace(re, `$1${json}$2`);
  if (Math.abs(out.length - src.length) > json.length + 64) {
    console.error(`replacing #${id} changed more than the block itself — aborting, nothing written`);
    process.exit(1);
  }
  return out;
}

html = stamp(html, 'facet-manifest', map);
html = stamp(html, 'number-map', nums);
fs.writeFileSync(page, html);

console.log(`stamped ${total} studies into #facet-manifest and #number-map`);
console.log(Object.keys(counts).sort().map(k => `  ${k} ${counts[k]}`).join('\n'));
