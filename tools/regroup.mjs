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
// stops the run rather than being dropped or filed under a guess.
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
  ['  .l-mat{ --l-lys:var(--ink); --l-mork:var(--on-ink) }',
   '  .l-deboss{ --l-lys:var(--ink); --l-mork:var(--on-ink) }'],
];

const GROUP_OF = {
  // Whole button — it lifts, scales, leans, settles, or answers a press.
  'Small grow': 'button',
  'Small shrink': 'button',
  'Pointer grow': 'button',
  'Inset fill': 'button',
  'Keycap': 'button',
  'Elevation step': 'button',
  'Magnetic': 'button',
  'Rigid type': 'button',
  'Two masses': 'button',
  'Tempo match': 'button',
  'Status button': 'button',
  'Plate to check': 'button',
  'Hold to confirm': 'button',
  'Wave through': 'button',
  'Straightens up': 'button',
  'Riser': 'button',
  'Hairline only': 'button',

  // Fill — a fill arrives or leaves.
  'Directional sweep': 'fill',
  'Shutter': 'fill',
  'Ink fill': 'fill',
  'Sheen': 'fill',
  'Directional fill': 'fill',
  'Liquid fill': 'fill',
  'Instant invert': 'fill',
  'Hatch exit': 'fill',
  'Stepped fill': 'fill',
  'Halftone fill': 'fill',

  // Border, corner and rule — an outline draws, a radius changes, a rule moves.
  'Crop marks': 'edge',
  'Directional underline': 'edge',
  'Drawn outline': 'edge',
  'Chamfered corner': 'edge',
  'In register': 'edge',
  'Edge light': 'edge',
  'Centre underline': 'edge',
  'Diagonal radius': 'edge',
  'Line gauge': 'edge',
  'Continuous corners': 'edge',
  'Rule bend': 'edge',
  'Real underline': 'edge',
  'Struck through': 'edge',
  'Cell chamfer': 'edge',
  'Dotted focus': 'edge',

  // Label — the word moves as one unit.
  'Label roll': 'label',
  'Second line': 'label',
  'Overflow only': 'label',
  'Counter': 'label',
  'Tracking trade': 'label',
  'One full turn': 'label',
  'Overrun': 'label',
  'Overflow loop': 'label',
  'Ticker label': 'label',
  'Split-flap': 'label',

  // Label, per character — the word is split and the parts move separately.
  'Letter roll': 'char',
  'Letter lift': 'char',
  'Overshoot': 'char',
  'Word roll': 'char',
  'Middle out': 'char',
  'Random stagger': 'char',
  'Weight wave': 'char',
  'It prints': 'char',
  'Resolve': 'char',
  'Nervous type': 'char',

  // Icon — an arrow, dot, caret, needle or dash does the work.
  'Arrow relay': 'icon',
  'Dot to arrow': 'icon',
  'Guillemets': 'icon',
  'Ellipsis arrow': 'icon',
  'Caret': 'icon',
  'The stop': 'icon',
  'Settle': 'icon',
  'Anticipation': 'icon',
  'Re-spacing': 'icon',
  'Exit velocity': 'icon',
  'Split apart': 'icon',
  'Mark walk': 'icon',
  'Fill swap': 'icon',
  'Clipped relay': 'icon',
  'Mark hinge': 'icon',
  'Mark tuck': 'icon',
  'Corner exit': 'icon',
  'Optical centre': 'icon',
  'Working state': 'icon',
  'Changes sides': 'icon',
  'Pieces join': 'icon',
  'Grid steps': 'icon',
  'Sprite arrow': 'icon',
  'Plus to X': 'icon',
  'Needle swing': 'icon',

  // Material and light — the button looks like a thing.
  'Bloom': 'material',
  'Inner light': 'material',
  'Idle breath': 'material',
  'Frosted glass': 'material',
  'Backlight': 'material',
  'Lantern': 'material',
  'The grain settles': 'material',
  'Light flip': 'material',
  'CRT converge': 'material',
  'Sprite swap': 'material',
  'Knurling': 'material',
  'Deboss': 'material',
  'Shortcut plate': 'material',
  'Coarse dither': 'material',
  'Bevel flip': 'material',

  // Button groups — siblings react to the one you are on.
  'Others recede': 'row',
  'Travelling rule': 'row',
  'Conserved compression': 'row',
  'Repulsion': 'row',
  'Emphasis trade': 'row',
  'Divider yields': 'row',
  // Studies 109-117, added with the 2026-08-28 rename (they predate this map).
  'Fixed light': 'material',
  'Measured ripple': 'fill',
  'Press fill': 'fill',
  'Label invert': 'label',
  'Honest progress': 'button',
  'Slab tilt': 'button',
  'Word bow': 'char',
  'Stack fan': 'button',
  'Fixed shadow': 'button',

  // Two at once — two mechanisms from the groups above, on one curve.
  'Under load': 'compound',
  'Swell': 'compound',
  'Lands first': 'compound',
  'Tide': 'compound',
  'Leading edge': 'compound',
  'Crest': 'compound',
  'Closing marks': 'compound',
};

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

const empty = GROUPS.filter(([k]) => !bucket[k].length);
if (empty.length) throw new Error('empty group: ' + empty.map(([, n]) => n).join(', '));

// ---- rebuild ---------------------------------------------------------------
const indent = (s, pad) => s.replace(/^/gm, pad).replace(/^\s+$/gm, '');
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
  out += src.slice(cursor, s.start);
  if (i === 0) out += rebuilt;            // all eight land where the first was
  cursor = s.end;
  // Swallow the blank line a dropped section leaves behind.
  if (i > 0) { const m = /^[ \t]*\n/.exec(src.slice(cursor)); if (m) cursor += m[0].length; }
});
out += src.slice(cursor);

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
