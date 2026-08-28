// Stamps each study with when it arrived and when it last changed, read out of
// the repository's own history rather than typed by hand.
//
// The page's rule is that nothing about a card is authored twice: the facets
// are derived from the card's own CSS, the versions from its own classes. A
// date is the one fact the card cannot state about itself, because it is a
// fact about the file rather than about the button — so it is taken from the
// only place that already knows it, and stamped, the way #facet-manifest is.
//
// IDENTITY. Not the number and not the title. Both have been rewritten across
// this page's life — 76 studies were renamed in one commit, and the numbers
// have been reflowed by every regroup — so keying on either would report the
// whole page as «added the day of the rename», which is the one thing a date
// column must not do. The key is the set of effect classes the demo button
// carries, because that is what the study IS: rename the card, renumber it,
// move it to another section, and `v-grow` is still `v-grow`. It is the same
// key the Copy buttons resolve against.
//
// CHANGED, not touched. A commit counts for a study only when that study's own
// markup came out different — so the sweep that reflowed every number, or the
// one that restamped the manifest, does not reset all 110 dates to today.
//
// Run after adding, editing or retiring a study:  node tools/dates.mjs
// --check reports what would change and writes nothing.

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const FILE = ROOT + 'index.html';
const check = process.argv.includes('--check');

const git = c => execSync(c, { cwd: ROOT, maxBuffer: 1 << 30 }).toString();

// Every article, keyed. The body is whitespace-collapsed so that a reindent
// during a section move does not read as an edit to the study.
function cards(html) {
  const out = new Map();
  for (const a of html.match(/<article class="spec[^"]*"[\s\S]*?<\/article>/g) || []) {
    const cls = [...a.matchAll(/<button[^>]*class="([^"]*)"/g)].flatMap(m => m[1].split(/\s+/));
    const eff = [...new Set(cls.filter(c => c && c !== 'btn' && c !== 'fav' && !/^btn--/.test(c)))].sort();
    const num = (a.match(/<span class="num">([^<]*)</) || [, ''])[1].trim();
    const h3 = (a.match(/<h3>[\s\S]*?<\/h3>/) || [, ''])[0].replace(/<[^>]*>/g, '').replace(num, '').trim();
    // A study with no effect class of its own is a static demo; its title is
    // the only handle left, and it is stable enough for one that never moves.
    const key = eff.join(' ') || 'title:' + h3.toLowerCase();
    if (!out.has(key)) out.set(key, { key, num, h3, body: a.replace(/\s+/g, ' ').trim() });
  }
  return out;
}

const log = git(`git log --reverse --format='%H%x09%cI' -- index.html`).trim().split('\n');
const first = new Map(), last = new Map();
let prev = new Map();
for (const line of log) {
  const [sha, iso] = line.replace(/'/g, '').split('\t');
  let html;
  // A commit that predates the file, or a corrupt blob, is skipped rather than
  // fatal: a history walk that dies halfway leaves every later study unstamped.
  try { html = git(`git show ${sha}:index.html`); } catch { continue; }
  const cur = cards(html);
  for (const [k, v] of cur) {
    if (!first.has(k)) { first.set(k, iso); last.set(k, iso); }
    else if (!prev.has(k) || prev.get(k).body !== v.body) last.set(k, iso);
  }
  prev = cur;
}

let s = readFileSync(FILE, 'utf8');
const live = cards(s);
let written = 0, already = 0; const unknown = [];

for (const [key, v] of live) {
  const added = first.get(key), updated = last.get(key);
  // A study added since the last commit has no history yet. It is left
  // unstamped rather than stamped with today, so the sort puts it where the
  // fallback puts it instead of asserting a date the repo cannot support.
  if (!added) { unknown.push(v.num + ' ' + v.h3); continue; }

  // Locate this study's own <article …> head by its demo classes.
  const probe = key.startsWith('title:')
    ? new RegExp('<h3><span class="num">' + v.num + '</span>')
    : new RegExp('class="btn[^"]*\\b' + key.split(' ')[0].replace(/-/g, '\\-') + '\\b');
  const m = probe.exec(s);
  if (!m) { unknown.push(v.num + ' ' + v.h3 + ' (not found)'); continue; }
  const a = s.lastIndexOf('<article class="spec', m.index);
  if (a === -1) { unknown.push(v.num + ' ' + v.h3 + ' (no article)'); continue; }

  const head = s.slice(a, s.indexOf('>', a) + 1);
  const has = /data-updated="([^"]*)"/.exec(head);
  if (has && has[1] === updated && /data-added="/.test(head)
      && (/data-added="([^"]*)"/.exec(head) || [])[1] === added) { already++; continue; }

  const stripped = head.replace(/\s*data-(added|updated)="[^"]*"/g, '');
  const next = stripped.slice(0, -1).trimEnd() + ` data-added="${added}" data-updated="${updated}">`;
  if (!check) s = s.slice(0, a) + next + s.slice(a + head.length);
  written++;
}

if (!check && written) writeFileSync(FILE, s);
console.log(`${live.size} studies · ${already} already correct · ${written} ${check ? 'would change' : 'stamped'}`);
if (unknown.length) console.log(`unstamped (${unknown.length}):\n  ` + unknown.join('\n  '));
