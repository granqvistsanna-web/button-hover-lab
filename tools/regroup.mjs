// Re-cut the specimen page into groups named by the part of the button that
// performs, replacing the lettered sections the studies were built in.
//
// The letters recorded WHERE a study was written, which is the author's
// business and not the reader's: someone hunting a fill sweep had to check
// four sections. The groups below name a part instead, so the question the
// page gets asked — «I have this button, what fits it?» — is answered by the
// heading.
//
// Re-runnable. The map is keyed on TITLE, not number, because the numbers get
// resequenced and the titles do not. A card whose title is not in the map
// stops the run rather than being dropped or filed under a guess. Within a
// group the cards land in the LISTED order — see the note on ORDER_OF.
//
//   node tools/regroup.mjs [--check]
//
// Numbers are deliberately NOT resequenced: forty-odd cards cite each other by
// bare number in their own prose, and a card's number is its catalogue entry,
// not its position.

import { readFileSync, writeFileSync } from 'node:fs';

const FILE = new URL('../index.html', import.meta.url);
const CHECK = process.argv.includes('--check');

// The eight groups, in reading order: the whole plate first because it is what
// most sites ship, the row last because it is the only one that needs siblings.
const GROUPS = [
  ['button',   'Whole button'],
  ['fill',     'Fill'],
  ['edge',     'Border, corner and rule'],
  ['label',    'Label'],
  ['char',     'Label, per character'],
  ['icon',     'Icon'],
  ['material', 'Material and light'],
  ['row',      'Button groups'],
  // The ninth group does not name a part, because a compound performs on two
  // of them at once — which is exactly why it cannot be filed under either.
  // It goes last for the same reason 'row' used to: it is the one group that
  // presumes you have read the others.
  ['compound', 'Two at once'],
];

// The two material aliases were declared on the SECTION, which made a card's
// colours depend on which section it happened to sit in — the one thing a
// regrouping is guaranteed to change. A CSSOM scan of the page says exactly
// seven rules read them, across four cards, so the declarations move onto
// those cards' own classes and the section goes back to being structural.
// Every copied snippet then carries the alias if and only if it reads it.
const ALIAS_REHOME = [
  ['  .f-mat{ --f-lys:var(--ink); --f-mork:var(--on-ink) }',
   '  .f-glas, .f-motljus, .f-lykta{ --f-lys:var(--ink); --f-mork:var(--on-ink) }'],
  // The .l-mat -> .l-deboss rehoming is gone WITH ITS CARD: Deboss was culled
  // (ef1ea6c) and the alias left the stylesheet with it, so there is nothing
  // left to move and nothing left that reads it. If a card reading --l-lys
  // ever returns, its alias belongs on the card's own class from day one.
];

// Membership AND order, in one structure. It used to be a flat title -> group
// map, which answered «which section» and left «where in it» to whatever order
// the cards happened to sit in — so a group of sixteen opened with a scale
// study, then a press, then a scale again. A reader comparing two lifts had to
// hold half the section in their head to find the second one.
//
// The lists below are read in order, and the blank-line clusters inside each
// are the point: adjacent cards do the same thing to the same part, so the
// comparison a reader is making is the one the eye is already making. The
// cluster comments name the run rather than the group; they are not headings
// and nothing renders them.
//
// Numbers still do not move. The clusters reorder POSITIONS, and a study's
// number is its catalogue entry — the prose cites bare numbers across cards,
// #number-map pairs key to number, and both survive a reorder untouched.
const ORDER_OF = {
  // Whole button — it lifts, scales, leans, settles, or answers a press.
  button: [
    // Scale: the plate changes size and nothing else.
    'Small grow',
    'Small shrink',
    'Pointer grow',
    'Inset fill',

    // Depth: it leaves the page, or pretends to sit on it.
    'Keycap',
    'Elevation step',
    'Riser',
    'Fixed shadow',
    'Slab tilt',
    'Stack fan',

    // Mass: it has weight, and the pointer has to argue with it.
    'Magnetic',
    'Two masses',
    'Rigid type',
    'Wave through',
    'Tempo match',

    // A state to report: the press means something and the button says so.
    'Status button',
    'Plate to check',
    'Hold to confirm',
    'Honest progress',

    // The reduction: almost nothing, on purpose.
    'Hairline only',
  ],

  // Fill — a fill arrives or leaves.
  fill: [
    // Directional: it enters from a side.
    'Directional sweep',
    'Directional fill',
    'Shutter',

    // Liquid: it spreads from the point of contact.
    'Ink fill',
    'Liquid fill',
    'Measured ripple',
    'Press fill',

    // Stepped and screened: the fill arrives in visible units.
    'Stepped fill',
    'Halftone fill',
    'Hatch exit',

    // Whole-plate: no travel, the surface just changes.
    'Instant invert',
    'Sheen',
  ],

  // Border, corner and rule — an outline draws, a radius changes, a rule moves.
  edge: [
    // Underlines: the one edge a link already has.
    'Directional underline',
    'Centre underline',
    'Real underline',
    'Struck through',

    // Rules that are not underlines.
    'Line gauge',
    'Rule bend',
    'Racing line',

    // Outlines and marks around the whole plate.
    'Drawn outline',
    'Crop marks',
    'In register',
    'Edge light',
    'Dotted focus',

    // Corners: the radius itself performs.
    'Chamfered corner',
    'Cell chamfer',
    'Diagonal radius',
    'Continuous corners',
  ],

  // Label — the word moves as one unit.
  label: [
    // Rolls: one label leaves as another arrives.
    'Label roll',
    'Second line',
    'One full turn',
    'Split-flap',
    'Ticker label',

    // Overflow: the label is wider than the plate and admits it.
    'Overflow only',
    'Overrun',
    'Overflow loop',

    // The label changes without travelling.
    'Counter',
    'Tracking trade',
    'Label invert',
  ],

  // Label, per character — the word is split and the parts move separately.
  char: [
    // Rolls and lifts, staggered across the characters.
    'Letter roll',
    'Word roll',
    'Letter lift',
    'Overshoot',
    'Middle out',
    'Random stagger',
    'Word bow',

    // The characters change weight or position in place.
    'Weight wave',
    'Nervous type',

    // The word assembles: it was not there, and then it is.
    'It prints',
    'Resolve',
  ],

  // Icon — an arrow, dot, caret, needle or dash does the work.
  icon: [
    // Arrows that travel.
    'Arrow relay',
    'Dot to arrow',
    'Ellipsis arrow',
    'Sprite arrow',
    'Clipped relay',
    'Exit velocity',
    'Corner exit',
    'Changes sides',

    // Marks that redraw themselves.
    'Mark walk',
    'Mark hinge',
    'Mark tuck',
    'Plus to X',
    'Pieces join',
    'Split apart',
    'Grid steps',
    'Fill swap',

    // Carets and pointers: the small directional set.
    'Caret',
    'Guillemets',
    'Needle swing',

    // Where the character is in the MOTION, not the shape.
    'Anticipation',
    'The stop',
    'Settle',
    'Re-spacing',
    'Optical centre',
    'Working state',
  ],

  // Material and light — the button looks like a thing.
  material: [
    // Light: something is emitting.
    'Bloom',
    'Inner light',
    'Backlight',
    'Lantern',
    'Light flip',
    'Fixed light',

    // Glass.
    'Frosted glass',

    // Print and screen: the surface has a grain.
    'The grain settles',
    'Coarse dither',
    'CRT converge',
    'Sprite swap',
    'Knurling',

    // Relief: the surface is cut or raised.
    'Deboss',
    'Bevel flip',
    'Shortcut plate',

    // It never stops.
    'Idle breath',
  ],

  // Button groups — siblings react to the one you are on.
  row: [
    // The others give way.
    'Others recede',
    'Conserved compression',
    'Repulsion',

    // Something shared between them moves or yields.
    'Travelling rule',
    'Divider yields',
    'Emphasis trade',
  ],

  // Two at once — two mechanisms from the groups above, on one curve.
  compound: [
    // The two arrive together.
    'Swell',
    'Crest',
    'Tide',
    'Under load',

    // One leads and the other follows.
    'Lands first',
    'Leading edge',
    'Closing marks',
  ],
};

// The flat lookup the rest of the script uses, derived so the two can never
// disagree. A title listed under two groups is an authoring mistake that would
// otherwise show up as a card silently taking the second group, so it stops
// the run here instead.
const GROUP_OF = {};
const ORDER_IN = {};
for (const [group, titles] of Object.entries(ORDER_OF)) {
  titles.forEach((title, i) => {
    if (GROUP_OF[title]) throw new Error(`'${title}' is listed twice: ${GROUP_OF[title]} and ${group}`);
    GROUP_OF[title] = group;
    ORDER_IN[title] = i;
  });
}

// ---- parsing ---------------------------------------------------------------
// Tag-counting rather than a regex across the whole block: the cards contain
// enough nested markup that a lazy match picks the wrong closing tag.
function blocks(html, openRe, tag) {
  const out = [];
  const open = new RegExp(openRe.source, 'g');
  let m;
  while ((m = open.exec(html))) {
    const start = m.index;
    const scan = new RegExp(`<${tag}\\b|</${tag}>`, 'g');
    scan.lastIndex = start;
    let depth = 0, end = -1, t;
    while ((t = scan.exec(html))) {
      depth += t[0][1] === '/' ? -1 : 1;
      if (depth === 0) { end = t.index + t[0].length; break; }
    }
    if (end < 0) throw new Error(`unclosed <${tag}> at ${start}`);
    out.push({ start, end, html: html.slice(start, end) });
    open.lastIndex = end;
  }
  return out;
}

const titleOf = (card) => {
  const m = card.match(/<h3>[\s\S]*?<\/span>([^<]*)<\/h3>/);
  if (!m) throw new Error('card with no <h3> title');
  return m[1].trim();
};

const src = readFileSync(FILE, 'utf8');
const sects = blocks(src, /<section class="sect[^"]*"[^>]*>/, 'section');
if (!sects.length) throw new Error('no sections found');

const cards = [];
for (const s of sects) {
  for (const c of blocks(s.html, /<article class="spec[^"]*"[^>]*>/, 'article')) {
    cards.push(c.html);
  }
}

const missing = [...new Set(cards.map(titleOf).filter((t) => !GROUP_OF[t]))];
if (missing.length) {
  console.error('Not in the map — add them to GROUP_OF and re-run:');
  missing.forEach((t) => console.error('  ' + t));
  process.exit(1);
}

const bucket = Object.fromEntries(GROUPS.map(([k]) => [k, []]));
for (const c of cards) bucket[GROUP_OF[titleOf(c)]].push(c);
// Into the authored order. Sorting rather than walking ORDER_OF and pulling
// each title keeps the run total honest: every card that was parsed is still
// in a bucket afterwards, whatever the lists say.
for (const k of Object.keys(bucket)) {
  bucket[k].sort((a, b) => ORDER_IN[titleOf(a)] - ORDER_IN[titleOf(b)]);
}

const empty = GROUPS.filter(([k]) => !bucket[k].length);
if (empty.length) throw new Error('empty group: ' + empty.map(([, n]) => n).join(', '));

// ---- rebuild ---------------------------------------------------------------
// Re-indent a card to `pad`, having first taken off whatever indentation it
// arrived with. The dedent is not tidiness: blocks() starts a card at its
// `<article`, so the first line comes back with no indent while every line
// after it keeps its original one — and a plain `pad + line` then ADDED four
// spaces to those lines on every run. Three runs had left the same element at
// 18, 22 and 24 spaces across the page, and the file grew ~2.8KB each time for
// no change on screen, which is noise a 600KB file being merged by two
// sessions cannot afford. Idempotent now: run it twice, get the same bytes.
// Safe because no card contains <pre>, <textarea> or white-space:pre — checked
// across all 86 — so leading whitespace inside a card renders as nothing.
const indent = (s, pad) => {
  const lines = s.split('\n');
  const base = lines.slice(1)
    .filter((l) => l.trim())
    .reduce((min, l) => Math.min(min, l.match(/^ */)[0].length), Infinity);
  const strip = Number.isFinite(base) ? base : 0;
  return lines
    .map((l, i) => (l.trim() ? pad + (i === 0 ? l : l.slice(strip)) : ''))
    .join('\n');
};
const rebuilt = GROUPS.map(([key, name]) => {
  return `<section class="sect">\n  <h2>${name}</h2>\n  <div class="grid">\n\n`
       + bucket[key].map((c) => indent(c, '    ')).join('\n\n')
       + `\n\n  </div>\n</section>`;
}).join('\n\n');

// Only the <section> blocks are replaced. Everything BETWEEN them stays exactly
// where it is — two hundred kilobytes of the page's CSS is written in style
// blocks interleaved with the sections it belongs to, and replacing the whole
// span from the first section to the last would take all of it with them.
let out = '';
let cursor = 0;
sects.forEach((s, i) => {
  const between = src.slice(cursor, s.start);
  if (i === 0) {
    out += between + rebuilt;             // all nine land where the first was
  } else {
    // What sits between two authored sections is the interleaved CSS, and it
    // is kept exactly. What is NOT kept is the blank lines the removed
    // <section> leaves on either side of it: the old swallow took one newline
    // per section, the source has two, and the leftover was carried to the end
    // of the file — eight fresh blank lines after </section> on every run,
    // for ever. Trimmed to nothing and re-separated by exactly one blank line,
    // so a second run over the same file is a no-op.
    const kept = between.replace(/^\s*\n/, '').replace(/\s+$/, '');
    if (kept) out += '\n\n' + kept;
  }
  cursor = s.end;
});
out += src.slice(cursor).replace(/^(?:[ \t]*\n)+/, '\n');

// The rail took a section's id from the first letter of its heading, which was
// unique only while the headings started with one. Slug the whole name.
const OLD_ID = `        var letter = h.textContent.trim().charAt(0).toLowerCase();
        if (!sect.id) sect.id = 's-' + letter;`;
const NEW_ID = `        var slug = h.textContent.trim().toLowerCase()
                       .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        if (!sect.id) sect.id = 's-' + slug;`;
if (out.includes(OLD_ID)) out = out.replace(OLD_ID, NEW_ID);
else if (!out.includes(NEW_ID)) throw new Error('rail id derivation not found — has it moved?');

// Two comments in the copy machinery explain a mechanism that no longer
// exists once the aliases move off the section. The code stays — a section
// could carry a class again — but the reasoning has to match what is true.
const COMMENT_FIXES = [
  [`      // A pasted component has to carry the section's own classes on its root:
      // .f-mat and .l-mat are token aliases the effect reads. The stage's are
      // demo furniture — .f-ruta is a baseline grid behind the button, not part
      // of it — so they are deliberately left behind.`,
   `      // A pasted component used to carry the section's own classes on its
      // root, back when .f-mat and .l-mat were declared there. Those aliases sit
      // on the four cards that read them now, so a section carries nothing but
      // .sect and this comes back empty. The stage's classes are demo furniture
      // — .f-ruta is a baseline grid behind the button, not part of it — so they
      // are left behind either way.`],
  [`    // Only the token blocks get re-scoped. Everything else already carries a
    // distinctive class, and a :root selector that HAS a descendant part (the
    // .f-mat aliases) is already pointing at the component root.`,
   `    // Only the token blocks get re-scoped. Everything else already carries a
    // distinctive class, and a :root selector that HAS a descendant part is
    // already pointing at the component root.`],
];
for (const [from, to] of COMMENT_FIXES) {
  if (out.includes(from)) out = out.replace(from, to);
  else if (!out.includes(to)) throw new Error('comment not found — has it been rewritten?');
}

for (const [from, to] of ALIAS_REHOME) {
  if (out.includes(from)) out = out.replace(from, to);
  else if (!out.includes(to)) throw new Error('alias declaration not found: ' + from.trim());
}

const counts = GROUPS.map(([k, n]) => `${String(bucket[k].length).padStart(3)}  ${n}`).join('\n');
console.log(counts + '\n' + String(cards.length).padStart(3) + '  cards in total');

if (CHECK) { console.log('\n--check: nothing written'); process.exit(0); }
writeFileSync(FILE, out);
console.log('\nindex.html rewritten');
