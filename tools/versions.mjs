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
  // — Icon ————————————————————————————————————————————————————
  // The mark is a child that moves, fades or redraws; the button's own surface
  // is not part of the mechanism, so all three treatments hold. The five with a
  // «-mark» child are in here rather than below because that child carries only
  // position, transform and opacity — it is an icon wrapper, not a plate.
  'relay':'fill outline link',   'dotm':'fill outline link',
  'h-ellip':'fill outline link', 'h-caret':'fill outline link',
  'i-settle':'fill outline link','i-anti':'fill outline link',
  'i-space':'fill outline link', 'i-throw':'fill outline link',
  'j-out':'fill outline link',   'j-optic':'fill outline link',
  'q-spin':'fill outline link',  'n-cross':'fill outline link',
  'w-grid':'fill outline link',  'w-frames':'fill outline link',
  'w-redraw':'fill outline link','x-needle':'fill outline link',
  // Two plates joined, not one button: a label plate and a 46px mark plate that
  // carries its own --ink fill and --on-ink label. A treatment on the outer
  // button is a THIRD surface arguing with the two inside it, so there is none.
  'p-part':'built', 'p-walk':'built', 'p-trade':'built', 'p-cycle':'built',
  'p-hinge':'built', 'p-slip':'built', 'n-join':'built',
  // — Label ———————————————————————————————————————————————————
  // The mechanism is in the type, so the surface under it is free. These are
  // also where LONG stops being a free ride: half of them hold their label as
  // one element per character rather than as text.
  'roll':'fill outline link',     'h-second':'fill outline link',
  'e-count':'fill outline link',  's-track':'fill outline link',
  'q-turn':'fill outline link',   'n-ticker':'fill outline link',
  'x-flap':'fill outline link',
  // The three whose subject IS the label's length. They keep the treatment
  // axis; the long label is theirs to answer rather than ours to impose, and
  // each already ships a label chosen to overrun its own measure.
  'h-marq':'fill outline', 'o-over':'fill outline', 'o-loop':'fill outline',
  // — Label, per character ——————————————————————————————————————
  // Split into one element per character — or per WORD for «Word by word», and
  // twice per character for the two rolls, which need a copy to roll to. The
  // switch rebuilds the split from the first fragment as a template rather than
  // flattening it to text.
  'u-roll':'fill outline link',   'u-lift':'fill outline link',
  'u-land':'fill outline link',   'u-words':'fill outline link',
  'u-centre':'fill outline link', 'u-shuffle':'fill outline link',
  'e-wave':'fill outline link',   's-print':'fill outline link',
  'j-resolve':'fill outline link','q-jitter':'fill outline link',
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
