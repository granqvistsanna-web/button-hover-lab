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
  'o-quiet':'fill outline link',
  // geometric, but the gesture is about a plate — a link has none to give
  'i-mass':'fill outline', 't-mark':'fill outline',
  't-hold':'fill outline',  'q-riser':'fill outline',
  // The riser is the mechanism and a riser is a box-shadow, which every
  // surface can carry. 43 names its wall as a token so each treatment states
  // what the cap is made of; 116's sheets do the same one card down. Neither
  // is a link: a wall and a stack both need a plate to stand under.
  'g-key':'built fill outline', 'z-stack':'fill outline',
  // owns its surface outright
  'i-give':'built', 'g-measure':'built', 'lift':'built',
  // — Fill ————————————————————————————————————————————————————
  'sweep':'fill outline link', 'shutter':'fill outline',
  'inkfill':'built fill',      'sheen':'built outline',
  'o-plate':'built',
  // No link version: the mechanism is a plate entering from any of four edges,
  // and a 1.5px rule on the bottom edge can only ever answer one of them.
  'j-dir':'fill outline',
  // 129 is 75's tile on an authored cycle, so it takes 75's fill and stops
  // exactly where 75 stops — four edges, one rule to answer them with.
  'j-turns':'fill',
  // 91's staircase is a HEIGHT — six columns rising off the floor with a
  // jagged leading edge — so a 1.5px rule has nothing for it to happen in.
  // Card 08's absence, one axis over.
  'o-step':'fill outline',
  // 130's plate is nailed down and only the word drifts, in pixels read off
  // the plate's own rect, so no treatment can reach the mechanism at all.
  // Fill only, and for what it BUYS rather than what it survives: the cap is
  // the study and a hard edge is what a cap is judged against. An outline
  // would restate the hairline the card already draws, and a link has no
  // frame for a label to be loose inside.
  'i-loose':'fill',
  // 136's silhouette is the subject, and a plate, a ring and a rule are three
  // ways to state one — the rule shows the most of it, having nothing but
  // length. No outline: .btn--line IS the ring 136 already draws for itself.
  'h-grow':'fill link',
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
  // — Label ————————————————————————————————————————————————————
  // The word performs and the plate is only what it stands on, so these hold
  // whatever treatment the label can be drawn in. None of the three fills
  // needs a rule of its own: a mask, a duplicate, a translate and a tilt ask
  // nothing of the ground, and .btn--solid hands a split label the same
  // --ink-on-fill it hands a label that was never split.
  // They used to declare NO versions at all, to keep the Long toggle from
  // writing textContent over their per-character spans. That trade is gone:
  // the switch skips any label node with element children, so a structured
  // label loses Long and keeps the treatment switch. Which is also the whole
  // of what these three give up — no Long control on 20, 24 or 85.
  'u-roll':'fill outline link', 'u-centre':'fill outline link',
  'q-jitter':'fill outline link',
  // 127 is the one card here that keeps a 1px border in every version and only
  // recolours it, so its built and fill boxes measure identical rather than a
  // border apart. Its two label copies are plain text, so it keeps Long.
  'h-arc':'built fill link',
  // — Two at once ————————————————————————————————————————————————
  // A compound is only as portable as its stricter half. 118 owns its surface
  // outright: the corner shape IS the study, and a treatment over it is a
  // second opinion about the same edge. 123 was filed beside it as «a lit
  // plate» and that was wrong by half — card 10, the sheen it is half made of,
  // ships filled already and inverts its streak to --on-ink there, so 123 in
  // fill is 49 x 10 read on 10's plate. It stops at fill: outline and link
  // have no plate to raise and nothing for the light to cross.
  // 121 was absent on purpose and the purpose has expired. The argument was
  // that its label is per-letter spans inside .lbl and the Long toggle writes
  // textContent back over them — true then, and answered since in the switch
  // itself, which skips any label node with element children. So 121 loses
  // Long and keeps the treatment, and it earns the fill outright: on an --ink
  // plate the tide inverts to --on-ink and the letters that arrive go back to
  // --ink. No link and no built — a level needs a surface to rise against, and
  // with the border gone the card is invisible until you point at it.
  // 122's ellipse needs a surface, and a link has none. 124 sets its own
  // border and radius, so a treatment on top of it is a third opinion. Only
  // the two pure roll-plus-transform cards survive all three.
  'c-chassis':'built', 'c-crest':'built fill', 'c-regis':'built',
  'c-relay':'fill outline', 'c-tide':'fill outline',
  'c-swell':'fill outline link', 'c-mass':'fill outline link',
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
