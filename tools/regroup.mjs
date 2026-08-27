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
  ['row',      'Buttons in a row'],
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
  'The small grow': 'button',
  'The small shrink': 'button',
  'It grows from where you came in': 'button',
  'Filling the measure': 'button',
  'The key': 'button',
  'Elevation step': 'button',
  'Magnetic': 'button',
  "The plate gives, the type doesn't": 'button',
  'Two masses': 'button',
  'It matches your tempo': 'button',
  'It reports on itself': 'button',
  'The plate becomes the mark': 'button',
  'It asks you to mean it': 'button',
  'In one order, out another': 'button',
  'Straightens up': 'button',
  'The riser': 'button',
  'Nothing but the press': 'button',

  // Fill — a fill arrives or leaves.
  'Directional sweep': 'fill',
  'Shutter': 'fill',
  'Ink fill': 'fill',
  'Sheen': 'fill',
  'Directional fill': 'fill',
  'The wave': 'fill',
  'The plate has no direction': 'fill',
  'The hatch withdraws': 'fill',
  'Stepped fill': 'fill',
  'The fill has no edge': 'fill',

  // Border, corner and rule — an outline draws, a radius changes, a rule moves.
  'Crop marks': 'edge',
  'Directional underline': 'edge',
  'Drawn outline': 'edge',
  'Chamfered corner': 'edge',
  'In register': 'edge',
  'Edge light': 'edge',
  'No direction at all': 'edge',
  'Diagonal radius': 'edge',
  'The line gauge': 'edge',
  'Continuous corners': 'edge',
  'The rule takes the load': 'edge',
  'The real underline': 'edge',
  'Struck through': 'edge',
  'The corner comes off in cells': 'edge',
  'The dotted rectangle': 'edge',

  // Label — the word moves as one unit.
  'Label roll': 'label',
  'The second line': 'label',
  "Only when it doesn't fit": 'label',
  'Counter': 'label',
  'The measure absorbs the tracking': 'label',
  'One full turn': 'label',
  'Overruns its measure': 'label',
  'Too long to sit still': 'label',
  'Ticker label': 'label',
  'Split-flap': 'label',

  // Label, per character — the word is split and the parts move separately.
  'The roll, letter by letter': 'char',
  'A lift, not a roll': 'char',
  'It lands past its mark': 'char',
  'Word by word': 'char',
  'From the middle out': 'char',
  'In no particular order': 'char',
  'Weight wave': 'char',
  'It prints': 'char',
  'Resolve': 'char',
  'Nervous type': 'char',

  // Icon — an arrow, dot, caret, needle or dash does the work.
  'Arrow relay': 'icon',
  'Dot becomes arrow': 'icon',
  'Guillemets': 'icon',
  'Three dots become an arrow': 'icon',
  'The caret': 'icon',
  'The stop': 'icon',
  'The settle': 'icon',
  'Anticipation': 'icon',
  'Re-spacing': 'icon',
  'The exit remembers': 'icon',
  'The pieces part': 'icon',
  'The mark walks the plate': 'icon',
  'They trade fill': 'icon',
  'The arrow leaves, the plates stay': 'icon',
  'The mark hinges': 'icon',
  'The mark slips behind': 'icon',
  'It leaves by the corner': 'icon',
  'The optical centre holds': 'icon',
  'It goes to work': 'icon',
  'Changes sides': 'icon',
  'The pieces join': 'icon',
  'Set on a four-pixel grid': 'icon',
  'Four frames, not a tween': 'icon',
  'It does not rotate': 'icon',
  'The needle swings': 'icon',

  // Material and light — the button looks like a thing.
  'The bloom': 'material',
  'Lit from within': 'material',
  'It breathes, until you arrive': 'material',
  'Frosted glass': 'material',
  'Backlight': 'material',
  'The lantern': 'material',
  'The grain settles': 'material',
  'The light source flips': 'material',
  'The tube converges': 'material',
  'Two frames': 'material',
  'Knurling': 'material',
  'Deboss': 'material',
  'The data plate': 'material',
  'The same grey, a coarser grid': 'material',
  'Outset, then inset': 'material',

  // Buttons in a row — siblings react to the one you are on.
  'The others recede': 'row',
  'The travelling indicator': 'row',
  'Conserved compression': 'row',
  'Repulsion': 'row',
  'The pair': 'row',
  'The divider yields': 'row',
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
