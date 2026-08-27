#!/usr/bin/env node
// Re-apply every study's data-versions declaration from the manifest below.
//
// The declarations are per-study FACTS — which surface treatments this
// mechanism honestly survives — and they live on the <article> in index.html so
// the page is still one self-contained file. This tool exists because the page
// gets renumbered and regrouped regularly, and a rebase that moves every
// article turns hand-placed attributes into a conflict per study. Run this
// after taking the incoming side of any such conflict and the declarations land
// again by effect class, which does not move.
//
//   node tools/versions.mjs            # apply
//   node tools/versions.mjs --check    # report drift, change nothing
//
// A key with no button is an ERROR, not a skip: it means the study was retired
// or its class renamed, and the manifest has to say so deliberately.
import {readFileSync, writeFileSync} from 'fs';

export const VERSIONS = {
  // — Whole button ——————————————————————————————————————————————
  'v-grow':'fill outline link', 'v-shrink':'fill outline link',
  'v-from':'fill outline link', 'v-bloom':'fill outline',
  'v-inner':'fill outline',     'v-live':'fill outline',
  // pure transform or label: no plate for the mechanism to depend on
  'magnet':'fill outline link', 'j-order':'fill outline link',
  'q-true':'fill outline link', 'o-quiet':'fill outline link',
  // geometric, but the gesture is about a plate — a link has none to give
  'i-mass':'fill outline', 't-mark':'fill outline',
  't-hold':'fill outline',  'q-riser':'fill outline',
  // owns its surface outright
  'g-key':'built', 'i-give':'built', 'g-measure':'built', 'lift':'built',
  // — Fill ————————————————————————————————————————————————————
  'sweep':'fill outline link', 'shutter':'fill outline',
  'inkfill':'built fill',      'sheen':'built outline',
  'o-plate':'built',
  // — Material and light ————————————————————————————————————————
  'f-glas':'built', 'f-motljus':'built', 'f-lykta':'built',
  's-bevel':'built', 's-crt':'built', 's-sprite':'built',
  'l-knurl':'built', 'l-deboss':'built', 'x-bevel':'built', 'w-pitch':'built',
  'o-hatch':'built',
  // the tag is the effect and it hangs off the button rather than on it
  'l-plate':'fill outline link',
};

const F = new URL('../index.html', import.meta.url).pathname;
let s = readFileSync(F, 'utf8');
const check = process.argv.includes('--check');
let applied = 0, already = 0; const drift = [];

for (const [key, v] of Object.entries(VERSIONS)){
  const m = new RegExp('class="btn[^"]*\\b' + key.replace(/-/g,'\\-') + '\\b').exec(s);
  if (!m) throw new Error('no button carries .' + key + ' — retired or renamed?');
  const a = s.lastIndexOf('<article class="spec', m.index);
  if (a === -1) throw new Error('.' + key + ' is not inside an article');
  const head = s.slice(a, s.indexOf('>', a) + 1);
  const has = /data-versions="([^"]*)"/.exec(head);
  if (has && has[1] === v){ already++; continue; }
  if (has) drift.push(key + ': "' + has[1] + '" → "' + v + '"');
  const stripped = head.replace(/\s*data-versions="[^"]*"/, '');
  const next = stripped.slice(0, -1).trimEnd() + ` data-versions="${v}">`;
  if (!check) s = s.slice(0, a) + next + s.slice(a + head.length);
  applied++;
}
if (!check && applied) writeFileSync(F, s);
console.log(`${Object.keys(VERSIONS).length} declared · ${already} already correct · ${applied} ${check ? 'would change' : 'written'}`);
if (drift.length) console.log('drift:\n  ' + drift.join('\n  '));
