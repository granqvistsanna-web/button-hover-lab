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
// A key with no study is an ERROR, not a skip: it means the study was retired
// or renamed, and the manifest has to say so deliberately. All of them are
// collected and reported together, and nothing is written until the manifest
// and the page agree — reporting one name per attempt is how twenty-two stale
// declarations passed for a bug in the tool for weeks. Those twenty-two were
// retired on 2026-08-31.
import {readFileSync, writeFileSync} from 'fs';

export const VERSIONS = {
  // — Whole button ——————————————————————————————————————————————
  'v-bloom':'fill', 'v-inner':'fill',
  // pure transform or label: no plate for the mechanism to depend on
  'magnet':'outline link', 'o-quiet':'fill link',
  // geometric, but the gesture is about a plate — a link has none to give
  'i-mass':'outline', 't-mark':'fill',
  't-hold':'fill',  'q-riser':'outline',
  // The riser is the mechanism and a riser is a box-shadow, which every
  // surface can carry. 43 names its wall as a token so each treatment states
  // what the cap is made of; 116's sheets do the same one card down. Neither
  // is a link: a wall and a stack both need a plate to stand under.
  'g-key':'outline', 'z-stack':'outline',
  // owns its surface outright
  'g-measure':'', 'lift':'',
  // — Fill ————————————————————————————————————————————————————
  'sweep':'fill link', 'shutter':'fill',
  'inkfill':'fill',      'sheen':'outline',
  // No link version: the mechanism is a plate entering from any of four edges,
  // and a 1.5px rule on the bottom edge can only ever answer one of them.
  'j-dir':'fill',
  // 129 is 75's tile on an authored cycle, so it takes 75's fill and stops
  // exactly where 75 stops — four edges, one rule to answer them with.
  'j-turns':'fill',
  // 91's staircase is a HEIGHT — six columns rising off the floor with a
  // jagged leading edge — so a 1.5px rule has nothing for it to happen in.
  // Card 08's absence, one axis over.
  'o-step':'fill',
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
  'f-glas':'', 'f-lykta':'',
  's-bevel':'', 's-sprite':'', 'x-bevel':'',
  // — Icon ————————————————————————————————————————————————————
  // The mark is a child that moves, fades or redraws; the button's own surface
  // is not part of the mechanism, so all three treatments hold. The five with a
  // «-mark» child are in here rather than below because that child carries only
  // position, transform and opacity — it is an icon wrapper, not a plate.
  'relay':'outline link',   'dotm':'fill link',
  'i-anti':'outline link',  'i-throw':'outline link',
  'j-out':'fill',   'j-optic':'fill link',
  'q-spin':'fill link',  'n-cross':'fill link',
  'w-grid':'outline link',  'w-redraw':'fill link',
  // Two plates joined, not one button: a label plate and a 46px mark plate that
  // carries its own --ink fill and --on-ink label. A treatment on the outer
  // button is a THIRD surface arguing with the two inside it, so there is none.
  'p-part':'', 'p-walk':'', 'n-join':'',
  // 69 is the exception to the line above, and its own card says why: gap:0
  // and the facing corners squared, so it is ONE capsule with two windows cut
  // in it rather than two objects passing something between them. A treatment
  // replaces that single surface instead of arguing with two, and the clipping
  // that makes the windows survives it untouched — the roles, the keyframes and
  // the +230% wrap are all geometry. The link is the capsule's own bottom edge
  // said in 1.5px, and it runs under BOTH windows: a rule under the label alone
  // would be a link standing next to an arrow rather than one with an arrow in it.
  'p-cycle':'outline link',
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
  'u-roll':'fill link', 'u-centre':'fill link',
  'q-jitter':'fill link',
  // 127 keeps a 1px border in every version and only recolours it, so its own
  // plate and a generic .btn--solid measure identical rather than a border
  // apart — which is why the fill is not offered twice and only the link is
  // declared. Its two label copies are plain text, so it keeps Long.
  // Outline added 2026-08-31. The built version's ground cannot come with it —
  // .btn--line means there is no plate for a 7% tint to be a tint OF — so the
  // ::before stops being a ground and becomes the ring that draws in, and the
  // button's own border steps aside so there is one edge rather than two. The
  // fill is still not offered: 127 keeps a 1px border in every version and only
  // recolours it, so its own plate and a generic .btn--solid measure identical
  // rather than a border apart. Its two label copies are plain text, so it
  // keeps Long.
  'h-arc':'outline link',
  // — Two at once ————————————————————————————————————————————————
  // A compound is only as portable as its stricter half. 123 was filed as «a
  // lit plate» and that was wrong by half — card 10, the sheen it is half made
  // of,
  // ships filled already and inverts its streak to --on-ink there, so 123 in
  // fill is 49 x 10 read on 10's plate. It stops at fill: outline and link
  // have no plate to raise and nothing for the light to cross.
  // 121 was absent on purpose and the purpose has expired. The argument was
  // that its label is per-letter spans inside .lbl and the Long toggle writes
  // textContent back over them — true then, and answered since in the switch
  // itself, which skips any label node with element children. So 121 loses
  // Long and keeps the treatment, and it earns the fill outright: on an --ink
  // plate the tide inverts to --on-ink and the letters that arrive go back to
  // --ink. No link — a level needs a surface to rise against, and with the
  // border gone the card is invisible until you point at it.
  // 122's ellipse needs a surface, and a link has none. 124 sets its own
  // border and radius, so a treatment on top of it is a third opinion. Only
  // the two pure roll-plus-transform cards survive all three.
  'c-crest':'', 'c-regis':'',
  // — 137-143, the second treatment ————————————————————————————————
  // Seven studies recreated from tiny-mighty-buttons on 2026-08-31 and shipped
  // in one treatment each. Every one of them survives the other, and each for a
  // reason the study itself supplies rather than a house default.
  //
  // 138's pair is one mechanism run twice with the sign turned over; the plate
  // is only what it is read on, so an outline takes the plate away and moves
  // what the plate was saying onto the edge.
  // 139 GAINS from the removal — with no resting plate, the two-stage arrival
  // and its reordered exit are the only things on the button.
  // 140's front face turns; the frame turns with it, on the face rather than on
  // the button.
  // 141 and 142 never touch the plate at all: both are per-character, and both
  // derive everything they do from where a character sits in the word.
  // 143 is the clearest of them — the plate that closes onto the label becomes
  // a ring that closes onto it, same inset, same radius, same clock.
  //
  // None of the six is offered a LINK. Five of them need a surface for the
  // mechanism to happen on — a wash to sweep under, a face to turn, a plate to
  // close — and 141's burst needs a box to be clipped by, or the characters
  // fly loose over the card.
  'c-against':'outline', 'c-wash':'outline', 'p-face':'outline',
  'u-burst':'outline',   'u-area':'outline', 'p-tighten':'outline',
  // 137 the other way round: it ships as an outline and takes the fill. The
  // raster is unchanged; what moves is the pair of grounds its difference-
  // blended label resolves against, so the fill version reads its own solved
  // constant --m-pix-fill rather than --m-pix. No link — a 24-cell raster has
  // nothing to happen in on a rule 1.5px tall.
  'o-pix':'fill',
  'c-relay':'fill', 'c-tide':'fill',
  'c-swell':'outline link', 'c-mass':'outline link',
  // — Buttons in a row ——————————————————————————————————————————
  // The hardest corner of the axis, because a ROW shares ONE version: there is
  // no per-item answer, and the treatment has to make sense of every sibling
  // relation at once. 62's link was the first, and these three are the second
  // pass. All three survive it for the same reason — none of them is about the
  // plate. Weight is ink, so it is the same study with no surface at all; the
  // gap budget redistributes MARGIN, which a row of links has exactly as much
  // of; and the lever rotates the row rather than anything in it, so what it
  // tips is whatever the row happens to contain.
  // 152 Radius budget and 155 Elevation trade are absent on purpose and the
  // rule is the same one: a 1.5px line along the bottom edge has no corners to
  // spend and no depth to trade. 156-162 land in the next pass.
  'k-share':'link',
  'k-wght':'link', 'k-gap':'link', 'k-lever':'link',
};

/* The version each study SHIPS in — one of the three, for every study on the
 * page. It used to be four, the fourth being «As built»: the studies that
 * supply their own surface carried no treatment class, so the control had a
 * position that named the ABSENCE of one. Fifty-one studies sat behind it —
 * knurling, a keycap, frost, a bevel, six rows of links — filed under a word
 * that describes the source rather than the button.
 *
 * Derived, not decided. Each of these was measured: the study was rendered
 * over a stage forced to a colour nothing on the page uses, and the button's
 * interior and perimeter read back off a screenshot. An interior that paints
 * over the stage is a plate (fill); an interior that does not, inside a
 * perimeter that does, is an edge (outline); neither is a label (link). Run
 * against the forty-six studies that already carried a treatment class, that
 * test reproduced all forty-six.
 *
 * The class still wins where a study carries one — it IS the fact — so these
 * entries only have to answer for the fifty-one that do not. They are listed
 * for all ninety-seven anyway, because a manifest that covers a subset is one
 * nobody can check against the page.
 */
export const NATIVE = {
  // — Fill: the study paints its own plate ————————————————————————
  'o-caps':'fill', 'p-index':'fill',
  'sheen':'fill', 'relay':'fill', 'roll':'fill',   'h-marq':'fill', 'u-lift':'fill', 'u-words':'fill', 'u-shuffle':'fill',
  'e-chamfer':'fill', 'e-count':'fill', 'f-lykta':'fill',
  's-bevel':'fill', 's-sprite':'fill', 'g-measure':'fill', 'f-kant':'fill',
  'g-key':'fill', 'lift':'fill', 'magnet':'fill',
  'i-mass':'fill', 'i-anti':'fill', 'i-throw':'fill', 'k-pair':'fill',
  'p-part':'fill', 'p-walk':'fill', 'p-cycle':'fill', 'q-riser':'fill',
  'n-join':'fill', 'w-grid':'fill', 'w-corner':'fill', 'x-bevel':'fill',
  'y-lit':'fill', 'y-hold':'fill', 'z-stack':'fill',
  'z-gum':'fill', 'c-swell':'fill', 'c-mass':'fill', 'c-crest':'fill',
  'squash':'fill', 'h-arc':'fill', 'p-bud':'fill', 'k-lamp':'fill',
  // 155 paints its own plate, so it carries no treatment class and the
  // attribute is the only thing that answers for it -- same as 132.
  'k-trade':'fill',
  'c-against':'fill', 'c-wash':'fill', 'p-face':'fill', 'u-burst':'fill',
  'u-area':'fill', 'p-tighten':'fill',
  // — Outline: an edge and no plate ——————————————————————————————
  'q-hinge':'outline',
  'v-bloom':'outline', 'v-inner':'outline', 'sweep':'outline',
  'shutter':'outline', 'inkfill':'outline', 'dotm':'outline',
  'u-roll':'outline', 'u-centre':'outline', 'e-wave':'outline',
  'f-glas':'outline',
  'i-rule':'outline', 'k-share':'outline',
  // Row batch two: four outlines, because an outline is the treatment that
  // shows plate GEOMETRY without shouting, and 152 is about the corner.
  'k-wght':'outline', 'k-rad':'outline', 'k-gap':'outline', 'k-lever':'outline',
  't-report':'outline', 't-mark':'outline', 't-hold':'outline',
  'j-dir':'outline', 'j-out':'outline', 'j-optic':'outline',
  'j-resolve':'outline', 'q-spin':'outline', 'q-jitter':'outline',
  'o-quiet':'outline', 'o-step':'outline', 'n-cross':'outline',
  'w-redraw':'outline', 'c-tide':'outline', 'c-relay':'outline',
  'j-turns':'outline', 'i-loose':'outline',
  'g-two':'outline', 'k-fit':'outline', 'k-hand':'outline',
  'j-plus':'outline', 'h-grow':'outline', 'o-pix':'outline',
  // — Link: a label, and nothing drawn around it ————————————————
  'k-ind':'link',
  'corners':'link', 'uline':'link', 's-mid':'link', 'i-beam':'link',
  'k-recede':'link', 'k-rep':'link', 'k-div':'link', 'c-regis':'link',
};

const F = new URL('../index.html', import.meta.url).pathname;
let s = readFileSync(F, 'utf8');
const check = process.argv.includes('--check');
let applied = 0, already = 0; const drift = [];

/* Set one attribute on an article's opening tag, or remove it where the value
 * is empty. An empty data-versions is not the same as data-versions="": it
 * means the study offers nothing BEYOND the version it ships in, which is what
 * an absent attribute has always meant on this page. */
function set (head, name, value) {
  const stripped = head.replace(new RegExp('\\s*' + name + '="[^"]*"'), '');
  return value
    ? stripped.slice(0, -1).trimEnd() + ` ${name}="${value}">`
    : stripped;
}

/* Both facts land in one pass, because they are one fact seen twice: the
 * version a study ships in and the ones it can also hold are the same question
 * about the same article, and writing them in two passes is how they drift. */
const KEYS = [...new Set([...Object.keys(NATIVE), ...Object.keys(VERSIONS)])];

/* Resolved by the article's data-key and NOT by a class on the button, which
 * is what this used to do. The key IS the article's attribute — the identity
 * pass in the page says so — and a study whose key sits on a wrapper rather
 * than on the .btn was simply unreachable: the six k-row studies are all
 * spelled that way. Matching the class also matched prefixes of other keys,
 * which the \b only half protected against. */
const missing = [];
for (const key of KEYS){
  const m = new RegExp('<article class="spec[^>]*data-key="' + key + '"').exec(s);
  if (!m){ missing.push(key); continue; }
  const a = m.index;
  const head = s.slice(a, s.indexOf('>', a) + 1);

  let next = head;
  for (const [name, want] of [['data-native',   NATIVE[key]],
                              ['data-versions', VERSIONS[key]]]){
    if (want === undefined) continue;           // this manifest says nothing
    const has = new RegExp(name + '="([^"]*)"').exec(next);
    const now = has ? has[1] : '';
    if (now === want) continue;
    drift.push(key + ' ' + name + ': "' + now + '" → "' + want + '"');
    next = set(next, name, want);
  }
  if (next === head){ already++; continue; }
  if (!check) s = s.slice(0, a) + next + s.slice(a + head.length);
  applied++;
}
/* A key with no study is an ERROR, not a skip: it means the study was retired
 * or renamed, and the manifest has to say so deliberately. Collected rather
 * than thrown on the first one, because the first one is never the only one —
 * this refused to run for weeks while reporting a single name per attempt, so
 * nobody could see it was twenty-one stale declarations rather than a bug. */
if (missing.length) {
  console.error(`${missing.length} manifest keys have no study on the page — retired, ` +
    `or renamed:\n  ${missing.join('\n  ')}\n` +
    'Nothing written. Remove them from VERSIONS/NATIVE, or restore the studies.');
  process.exit(1);
}
if (!check && applied) writeFileSync(F, s);
console.log(`${KEYS.length} studies · ${already} already correct · ${applied} ${check ? 'would change' : 'written'}`);
if (drift.length) console.log('drift:\n  ' + drift.join('\n  '));
