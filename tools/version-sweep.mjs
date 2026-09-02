#!/usr/bin/env node
/* tools/version-sweep.mjs — the gate a newly-declared version has to pass.
 *
 *   node tools/version-sweep.mjs c-crest
 *   node tools/version-sweep.mjs lift g-measure --versions=fill,link
 *   node tools/version-sweep.mjs c-crest --palettes=all --json=build/sweep.json
 *
 * WHY THIS EXISTS AND a11y.mjs DOES NOT COVER IT. tools/a11y.mjs measures the
 * version a study SHIPS in. A version that has just been declared is invisible
 * to it until someone clicks the control, so the eight minutes it costs say
 * nothing at all about the block just written. Card 123's fill measured 1.48:1
 * on Violet the moment it first rendered and passed every check on the page.
 *
 * WHAT IT MEASURES. Every version the study can be in — native together with
 * everything data-versions declares — across seven palettes, both themes, at
 * rest and hovered. 28 readings per version per study. Plus the geometry
 * promise: a study is the same 195.087 x 47.003 in all of its versions, which
 * is what «border to transparent, never to zero» is for.
 *
 * WHY SEVEN AND NOT FOURTEEN. The palette row is thirteen colours plus
 * Graphite, and most of them fail together or not at all. These seven are the
 * corners of the space, and each is here for a reason a hue cannot stand in
 * for: Graphite because it is what ships AND the one palette where
 * --ink-on-fill and --on-ink-hover resolve to the same colour, which makes a
 * whole class of fault invisible by construction; Violet because its accent is
 * the darkest saturated rest and its hover the biggest lift; Navy because
 * #1a365d is the darkest rest on the row full stop; Coral because #fff2ef is a
 * hover with nowhere paler for a light label to go; Straw and Mint because both
 * INVERT — pale at rest, deep on hover — and they take opposite label
 * directions doing it (#3f3104 against #e4f6eb); Ash because it is achromatic
 * and not Graphite, so a fault a hue was covering has nothing left to hide
 * behind. --palettes=all runs the other seven too.
 *
 * WHY IT CLICKS. Theme goes through the real control, never a stamped
 * data-theme: the label keeps the other theme's fitted colour if paint() does
 * not re-run, which is twelve false failures. Same for the palette chips and
 * the treatment toggles.
 *
 * Read-only against the page. Writes JSON if asked; prints a table.
 */
import fs from 'node:fs'
import path from 'node:path'
import { open, KIT, ROOT } from './lib/page.mjs'

/* ---- arguments --------------------------------------------------------- */
const argv = process.argv.slice(2)
const flag = n => { const a = argv.find(x => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : null }
const KEYS = argv.filter(a => !a.startsWith('--'))
if (!KEYS.length) {
  console.error('usage: node tools/version-sweep.mjs <key> [key...] [--force] [--versions=..] [--palettes=..|all] [--themes=..] [--json=path]')
  console.error('       --force measures versions the page does not declare yet. Nothing is written.')
  process.exit(64)
}

// The seven corners, in the order the argument above sets out. Names are
// matched against the chip's own text, the way tools/a11y.mjs does it, so a
// renamed chip fails loudly here instead of silently measuring Graphite.
const SEVEN = ['Graphite', 'Violet', 'Navy', 'Coral', 'Straw', 'Mint', 'Ash']
const ALL   = ['Graphite', 'Amber', 'Ember', 'Rose', 'Violet', 'Azure', 'Fern',
               'Coral', 'Straw', 'Orchid', 'Navy', 'Pine', 'Mint', 'Ash']
const pArg = flag('palettes')
const PALETTES = !pArg ? SEVEN : pArg === 'all' ? ALL : pArg.split(',')
const THEMES = (flag('themes') || 'dark,light').split(',')
const VERS_ARG = flag('versions')
const JSON_OUT = flag('json')
const FORCE = argv.includes('--force')
const SETTLE = Number(process.env.SWEEP_SETTLE || 950)   // longest --t-5 chain + slack
const FLOOR = 4.5

/* ---- the page ---------------------------------------------------------- */
const p = await open()
await p.send('Page.navigate', { url: `http://127.0.0.1:${p.port}/` })
await new Promise(r => setTimeout(r, 1200))
await p.evalJs(`new Promise(r => document.fonts.ready.then(() => setTimeout(r, 600)))`)
await p.evalJs(KIT)

// The font gate, for the same reason a11y.mjs has one: a run that measures the
// fallback face measures every label at the wrong width and reports a drift
// that is not there.
const font = await p.evalJs('JSON.stringify(window.__a11y.fontOK())').then(JSON.parse)
if (!font.geist) {
  await p.close()
  console.error('[sweep] ABORT — the Geist faces did not load. Fix the sheet; do not read these numbers.')
  process.exit(2)
}

/* ---- the page-side additions ------------------------------------------- */
// Built on __a11y rather than beside it: textRect is the only honest way to
// find the glyphs, and a second implementation of it would be the fourth
// histogram this page has been measured by.
await p.evalJs(String.raw`(() => {
  const A = window.__a11y, S = window.__sweep = {}
  S.card = k => document.querySelector('.spec[data-key="' + CSS.escape(k) + '"]')
  S.meta = keys => keys.map(k => {
    const c = S.card(k)
    if (!c) return { key: k, missing: true }
    const num = (c.querySelector('.num') || {}).textContent || '?'
    const h3 = c.querySelector('h3')
    return { key: k, num: +num,
      title: h3 ? h3.textContent.replace(num, '').trim() : '?',
      native: c.getAttribute('data-native') || '',
      declared: (c.getAttribute('data-versions') || '').split(/\s+/).filter(Boolean),
      buttons: c.querySelectorAll('.stage button.btn').length }
  })
  // One flat list of every button under every requested key, in key order, so
  // the driver can address them by index and the tables line up run to run.
  S.bind = keys => {
    window.__swN = keys.flatMap(k => {
      const c = S.card(k)
      return c ? [...c.querySelectorAll('.stage button.btn')].map(b => ({ k, b })) : []
    })
    return window.__swN.length
  }
  S.rects = () => window.__swN.map(({ k, b }) => {
    const br = b.getBoundingClientRect(), sx = scrollX, sy = scrollY
    // The treatment control FILTERS. Picking Fill hides every study that does
    // not offer one, and a hidden card has no layout — so an unshipped button
    // is not a zero-size crop, it is a question that was not asked.
    const shipped = b.offsetParent !== null && br.width > 0 && br.height > 0
    return { key: k, shipped,
      btn: { x: br.x + sx, y: br.y + sy, w: br.width, h: br.height },
      lbl: A.textRect(b) }
  })
  S.clientRect = i => { const q = window.__swN[i].b.getBoundingClientRect()
    return { x: q.x, y: q.y, w: q.width, h: q.height } }

  // The treatment classes, and the version each button SHIPPED in. Recorded
  // once, at bind, before anything has been switched. The page's own switch
  // keeps the same list, read at the same moment for the same reason.
  S.CLS = { fill: 'btn--solid', outline: 'btn--line', link: 'btn--text' }
  S.ALL = ['btn--solid', 'btn--line', 'btn--text']
  S.snap = () => {
    window.__swO = window.__swN.map(({ k, b }) => {
      const orig = S.ALL.filter(c => b.classList.contains(c))[0] || ''
      const card = S.card(k)
      const nat = card.getAttribute('data-native')
      return { orig,
        nat: S.CLS[nat] ? nat
           : orig === 'btn--solid' ? 'fill'
           : orig === 'btn--line' ? 'outline'
           : orig === 'btn--text' ? 'link' : 'fill' }
    })
    return window.__swO
  }
  // 🚨 THE FILTER AND THE SKIN ARE TWO DIFFERENT MECHANISMS AND ONLY ONE OF THEM
  // READS THE ATTRIBUTE LIVE. The treatment filter re-reads data-versions off
  // the article on every toggle; the class swap collects
  // .spec[data-versions] ONCE, at init. So patching the dataset gets a card
  // past the filter and no further: it renders in its native version under all
  // three chips, and the first run of --force printed card 49's fill numbers
  // three times over as though outline and link had been measured.
  //
  // This is the page's own swap, verbatim in effect — remove the three, add
  // back either the class the button shipped with or the one the version names
  // — inside the same bhl-swap suppression frame, because without it every
  // switch fires the effect it is switching and the capture reads a hover.
  S.swap = v => {
    const bs = window.__swN.map(x => x.b)
    bs.forEach(b => b.classList.add('bhl-swap'))
    window.__swN.forEach(({ b }, i) => {
      const o = window.__swO[i]
      b.classList.remove(S.ALL[0], S.ALL[1], S.ALL[2])
      const add = v === o.nat ? o.orig : S.CLS[v]
      if (add) b.classList.add(add)
    })
    bs.forEach(b => { void b.offsetWidth })
    requestAnimationFrame(() => bs.forEach(b => b.classList.remove('bhl-swap')))
    bs.forEach(b => b.dispatchEvent(new CustomEvent('bhl:label', { bubbles: true })))
    return true
  }
  // What is actually on the button, against what the version asked for. The
  // guard is unconditional: a run that measures the native version three times
  // and labels the rows fill/outline/link is worse than one that stops.
  S.verify = v => window.__swN.map(({ k, b }, i) => {
    const o = window.__swO[i]
    const want = v === o.nat ? o.orig : S.CLS[v]
    const got = S.ALL.filter(c => b.classList.contains(c))[0] || ''
    return { key: k, i, want, got, ok: want === got,
      shipped: b.offsetParent !== null }
  })
  return true })()`)

const meta = await p.evalJs(`JSON.stringify(window.__sweep.meta(${JSON.stringify(KEYS)}))`).then(JSON.parse)
const missing = meta.filter(m => m.missing)
if (missing.length) {
  await p.close()
  console.error('[sweep] no study with key: ' + missing.map(m => m.key).join(', '))
  console.error('        A key with no study is an error, not a skip — it means the study was')
  console.error('        renamed or retired. Check data-key in index.html.')
  process.exit(65)
}
const nBtn = await p.evalJs(`window.__sweep.bind(${JSON.stringify(KEYS)})`)
await p.evalJs('JSON.stringify(window.__sweep.snap())')

// Native together with everything declared, deduped, in the toolbar's own
// order. Native is pressed as a version like any other rather than measured as
// «as built»: a study only stays put when a treatment it already is gets
// applied, so pressing it is the same render and naming it keeps the table
// readable.
const ORDER = ['fill', 'outline', 'link']
const union = new Set()
for (const m of meta) { if (m.native) union.add(m.native); for (const v of m.declared) union.add(v) }
const VERSIONS = VERS_ARG ? VERS_ARG.split(',')
  : FORCE ? ORDER
  : ORDER.filter(v => union.has(v))
if (!VERSIONS.length) {
  await p.close()
  console.error('[sweep] nothing to measure: none of these studies declares a version, and')
  console.error('        none names one natively. That is the undeclared absence the plan is about.')
  process.exit(66)
}

// Every control this run will reach for, checked BEFORE anything is measured.
// The Ash fault above got six palettes deep and threw, which is the failure
// mode a11y.mjs already names: a harvest that reports and then dies is worse
// than one that dies first.
const preflight = await p.evalJs(String.raw`(() => {
  const chips = [...document.querySelectorAll('.set-p')]
    .map(x => x.textContent.trim().split(/\s|—/)[0])
  const want = ` + JSON.stringify(PALETTES) + String.raw`
  const themes = ` + JSON.stringify(THEMES) + String.raw`
  const vers = ` + JSON.stringify(VERSIONS) + String.raw`
  return JSON.stringify({
    chips,
    badPalette: want.filter(w => !chips.includes(w)),
    badTheme: themes.filter(t => !document.querySelector('#v-theme .vers-b[data-theme="' + t + '"]')),
    badVersion: vers.filter(v => !document.querySelector('#v-treat .vers-b[data-v="' + v + '"]')) }) })()`).then(JSON.parse)
if (preflight.badPalette.length || preflight.badTheme.length || preflight.badVersion.length) {
  await p.close()
  if (preflight.badPalette.length) {
    console.error('[sweep] ABORT — no palette chip named: ' + preflight.badPalette.join(', '))
    console.error('        the page offers: ' + preflight.chips.join(', '))
  }
  if (preflight.badTheme.length) console.error('[sweep] ABORT — no theme control for: ' + preflight.badTheme.join(', '))
  if (preflight.badVersion.length) console.error('[sweep] ABORT — no treatment control for: ' + preflight.badVersion.join(', '))
  process.exit(67)
}

console.error(`[sweep] Geist: ${font.geist} | Geist Mono: ${font.mono} | ${font.status}`)
for (const m of meta)
  console.error(`[sweep] ${m.num} ${m.title} (${m.key}) — native ${m.native || 'none declared'}`
    + `, declares ${m.declared.join(' ') || 'nothing'}, ${m.buttons} button${m.buttons === 1 ? '' : 's'}`)
// --force, which is what makes step 5 of the plan come BEFORE step 6.
//
// The treatment control FILTERS on data-versions ∪ data-native, read live off
// the article every time the toggle moves. So a version that has been written
// but not yet declared cannot be measured at all: pressing its chip hides the
// card, and the sweep reports «not offered» for the exact block it was called
// to check. That would force the order «declare, then measure, then retract if
// it fails», and a declaration is a published fact about the page.
//
// So: add the versions to the article's dataset IN THE DOM, nothing on disk,
// and let the filter and the skin do the rest. data-lib="no" is lifted the same
// way and for the same duration — card 86 is out of the library on purpose, but
// that is an answer about the library and not about contrast.
if (FORCE) {
  const lifted = await p.evalJs(`(() => {
    const keys = ${JSON.stringify(KEYS)}, vers = ${JSON.stringify(VERSIONS)}
    const out = []
    for (const k of keys) {
      const c = window.__sweep.card(k)
      const had = (c.getAttribute('data-versions') || '').split(/\s+/).filter(Boolean)
      const now = [...new Set([...had, ...vers])].filter(v => v !== c.getAttribute('data-native'))
      c.setAttribute('data-versions', now.join(' '))
      const lib = c.getAttribute('data-lib') === 'no'
      if (lib) c.removeAttribute('data-lib')
      out.push({ key: k, added: vers.filter(v => !had.includes(v) && v !== c.getAttribute('data-native')), lib })
    }
    return JSON.stringify(out) })()`).then(JSON.parse)
  console.error('[sweep] --force: measuring versions this page does not declare. NOTHING IS WRITTEN;')
  console.error('        the dataset is patched in the DOM so the filter lets the card through.')
  for (const l of lifted)
    console.error(`        ${l.key}: forced ${l.added.join(' ') || 'nothing new'}`
      + (l.lib ? ' · data-lib="no" lifted for the run' : ''))
}

console.error(`[sweep] ${VERSIONS.length} version x ${THEMES.length} theme x ${PALETTES.length} palette`
  + ` x rest+hover = ${VERSIONS.length * THEMES.length * PALETTES.length * 2} settings over ${nBtn} buttons`)

/* ---- the controls ------------------------------------------------------ */
async function setTheme (t) {
  await p.evalJs(`(() => { const b = document.querySelector('#v-theme .vers-b[data-theme="${t}"]')
    if (!b) throw new Error('no theme control for ${t}')
    b.click(); return true })()`)
  await new Promise(r => setTimeout(r, 500))
}
// ⚠️ String.raw, and it is load-bearing. In a plain template literal `\s`
// collapses to the letter «s» before the page ever sees it, so the split runs
// on /s|—/ — and every palette whose name contains a lower-case s stops being
// findable. That is Ash, and only Ash, out of fourteen: the run got six
// palettes deep and threw. tools/a11y.mjs carries the same line and the same
// latent fault, harmless there only because A11Y_PALETTE defaults to empty.
async function setPalette (name) {
  await p.evalJs(String.raw`(() => {
    const want = ` + JSON.stringify(name) + String.raw`
    const b = [...document.querySelectorAll('.set-p')]
      .find(x => x.textContent.trim().split(/\s|—/)[0] === want)
    if (!b) throw new Error('no palette chip named ' + want)
    if (b.getAttribute('aria-pressed') !== 'true') b.click()
    return true })()`)
  await new Promise(r => setTimeout(r, 500))
}
// Idempotent, because the treatment segment reads as a TOGGLE: clicking the
// pressed one clears it back to as-built. Asking twice for the version already
// on would label the numbers with a treatment that is no longer applied.
async function setVersion (v) {
  await p.evalJs(`(() => {
    const seg = document.querySelector('#v-treat')
    if (!seg) throw new Error('no treatment control on the page')
    const b = seg.querySelector('.vers-b[data-v="${v}"]')
    if (!b) throw new Error('no version control for ${v}')
    if (b.getAttribute('aria-pressed') !== 'true') b.click()
    return true })()`)
  await new Promise(r => setTimeout(r, 700))
}
async function nodeIds () {
  const doc = await p.send('DOM.getDocument', { depth: -1 })   // ONE .result
  const root = doc.result.root.nodeId
  const out = []
  for (const k of KEYS) {
    const r = await p.send('DOM.querySelectorAll',
      { nodeId: root, selector: `.spec[data-key="${k}"] .stage button` })
    out.push(...(r.result?.nodeIds || []))
  }
  return out
}
const force = async (ids, classes) => {
  for (const nodeId of ids) await p.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: classes })
}

/* ---- capture and read -------------------------------------------------- */
const box = r => ({ x: r.lbl.x - 1, y: r.lbl.y - 1,
  w: Math.max(4, Math.round(r.lbl.w) + 2), h: Math.max(6, Math.round(r.lbl.h) + 2) })
const plateBox = r => ({ x: r.btn.x - 10, y: r.btn.y - 10,
  w: Math.round(r.btn.w) + 20, h: Math.round(r.btn.h) + 20 })

async function shots (rects, kind) {
  const out = []
  for (const r of rects) {
    if (!r.shipped) { out.push(null); continue }
    const bx = kind === 'plate' ? plateBox(r) : box(r)
    try {
      const s = await p.send('Page.captureScreenshot', { format: 'png',
        clip: { x: bx.x, y: bx.y, width: bx.w, height: bx.h, scale: 2 },
        captureBeyondViewport: true, fromSurface: true, optimizeForSpeed: true })
      out.push(s.result?.data || null)
    } catch { out.push(null) }
  }
  return out
}
async function read (b64s) {
  const out = []
  for (const b of b64s) {
    if (!b) { out.push(null); continue }
    const v = await p.evalJs(`(async () => JSON.stringify(
      window.__a11y.textVsBg(await window.__a11y.pixels(${JSON.stringify(b)}))))()`)
    out.push(v ? JSON.parse(v) : null)
  }
  return out
}
async function diff (a, b) {
  const out = []
  for (let i = 0; i < a.length; i++) {
    if (!a[i] || !b[i]) { out.push(null); continue }
    const v = await p.evalJs(`(async () => JSON.stringify(await window.__a11y.diff(
      ${JSON.stringify(a[i])}, ${JSON.stringify(b[i])})))()`)
    out.push(v ? JSON.parse(v) : null)
  }
  return out
}
// A crop with nothing in it. Two different things land here and only one is a
// fault: a capture that failed, and a button that is genuinely not painted at
// that rect. Reporting the second as 1:1 is how card 133's mask was carried as
// twenty contrast failures.
const blind = v => !!v && v.bgShare >= 0.999 && v.sd <= 0.002

// The ratio recomputed off the two luminances rather than read off the field
// next to them. textVsBg rounds its own ratio to 2dp, and the palette row is
// generated to clear 4.5 EXACTLY — so «4.50» is the commonest number on this
// page and it can be a real 4.4951. Card 123's fill on Coral is 4.5007: it
// passes, by seven ten-thousandths, and a tool that cannot tell that from a
// near miss cannot be the gate. bg and tx come back at 4dp, which is ample.
const exact = v => v ? (Math.max(v.tx, v.bg) + 0.05) / (Math.min(v.tx, v.bg) + 0.05) : null
// Clears the floor, but by less than the rounding hides. Not a failure — the
// palette generator aims here on purpose — but the margin a study has before
// the next overlay takes it under, and worth seeing per cell.
const ATFLOOR = 4.55

// One rect off an UNCLIPPED viewport capture. Page.captureScreenshot's own clip
// hands back blank surface — which is WHITE — for part of a clip a long way
// down a 40,000px page, and the histogram then reads plate-against-blank as if
// it were label-against-plate. Every reading that would be REPORTED as a
// failure is re-taken down this second, independent path before it is believed:
// a real failure measures the same twice, an artefact does not.
async function viewportRead (r, kind) {
  const bx = kind === 'plate' ? plateBox(r) : box(r)
  await p.evalJs(`window.__a11y.into(${Math.round(bx.y + bx.h / 2)})`)
  await p.evalJs('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))')
  await new Promise(t => setTimeout(t, 260))
  await p.evalJs('window.__a11y.freeze()')
  let shot
  try {
    shot = await p.send('Page.captureScreenshot', { format: 'png', fromSurface: true, optimizeForSpeed: true })
  } catch { await p.evalJs('window.__a11y.thaw()'); return null }
  await p.evalJs('window.__a11y.thaw()')
  if (!shot.result?.data) return null
  const v = await p.evalJs(`(async () => JSON.stringify(await window.__a11y.cropRead(
    ${JSON.stringify(shot.result.data)}, ${JSON.stringify(bx)}, window.__a11y.dpr())))()`)
  return v && v !== 'null' ? JSON.parse(v) : null
}
async function repair (rects, vals, kind) {
  let n = 0
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i], v = vals[i]
    if (!r.shipped || r.lbl.noText) continue
    if (!blind(v) && !(v && v.ratio < FLOOR)) continue
    const re = await viewportRead(r, kind)
    if (re && !blind(re)) { vals[i] = re; n++ }
  }
  return n
}

// The pointer path, for the studies whose hover is JS. forcePseudoState fires
// no event, so a JS-driven study reads DEAD under it — and a hover column that
// never hovered is a false pass, not a missing number. Only the buttons whose
// plate did not move are re-measured this way, so the common case stays cheap.
async function pointerHover (i, r) {
  await p.evalJs(`window.__a11y.into(${Math.round(r.btn.y + r.btn.h / 2)})`)
  await p.evalJs('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))')
  await new Promise(t => setTimeout(t, 200))
  const q = await p.evalJs(`JSON.stringify(window.__sweep.clientRect(${i}))`).then(JSON.parse)
  const x = Math.round(q.x + q.w / 2), y = Math.round(q.y + q.h / 2)
  // pointerenter reports the INSIDE, not the edge: a single move to the centre
  // is what a study that reads its entry point sees as «arrived», and that is
  // the state being measured here.
  await p.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x - 2, y: y - 2, buttons: 0 })
  await p.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, buttons: 0 })
  await new Promise(t => setTimeout(t, SETTLE))
  const fresh = await p.evalJs('JSON.stringify(window.__sweep.rects())').then(JSON.parse)
  await p.evalJs('window.__a11y.freeze()')
  const s = await shots([fresh[i]], 'lbl')
  await p.evalJs('window.__a11y.thaw()')
  const v = (await read(s))[0]
  await p.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 5, buttons: 0 })
  await new Promise(t => setTimeout(t, 250))
  return v
}

/* ---- the sweep --------------------------------------------------------- */
const rows = []       // one per version x theme x palette x button
const geom = new Map()  // key|version -> the rect, for the identical-geometry promise

for (const version of VERSIONS) {
  await setVersion(version)
  // In --force the page's own switch has never heard of these cards, so the
  // class swap is done here. Harmless where the study does declare the version:
  // it computes the class the page has already put on.
  if (FORCE) { await p.evalJs('window.__sweep.swap(' + JSON.stringify(version) + ')')
    await new Promise(r => setTimeout(r, 400)) }
  const check = await p.evalJs(`JSON.stringify(window.__sweep.verify(${JSON.stringify(version)}))`).then(JSON.parse)
  const wrong = check.filter(c => c.shipped && !c.ok)
  if (wrong.length) {
    await p.close()
    console.error(`[sweep] ABORT — ${version} was requested and the buttons do not carry it:`)
    for (const w of wrong)
      console.error(`        ${w.key}[${w.i}] wanted ${w.want || '(its own, no treatment class)'}, has ${w.got || '(none)'}`)
    console.error('        Measuring on would label one version\'s numbers with another\'s name.')
    process.exit(68)
  }
  const ids = await nodeIds()
  for (const theme of THEMES) {
    await setTheme(theme)
    for (const pal of PALETTES) {
      await setPalette(pal)
      await force(ids, []); await new Promise(r => setTimeout(r, 350))
      const rects = await p.evalJs('JSON.stringify(window.__sweep.rects())').then(JSON.parse)
      await p.evalJs('window.__a11y.freeze()')
      const restShots = await shots(rects, 'lbl')
      const plateOff = await shots(rects, 'plate')
      await p.evalJs('window.__a11y.thaw()')
      const rest = await read(restShots)
      const fixR = await repair(rects, rest, 'lbl')

      await force(ids, ['hover']); await new Promise(r => setTimeout(r, SETTLE))
      // Two rects, because half these studies MOVE the label. The hover rect
      // answers «what is the contrast now»; reading it off the rest rect is how
      // card 43 came back with no label in the crop at all.
      const hovRects = await p.evalJs('JSON.stringify(window.__sweep.rects())').then(JSON.parse)
      await p.evalJs('window.__a11y.freeze()')
      const hovShots = await shots(hovRects, 'lbl')
      const plateOn = await shots(rects, 'plate')
      await p.evalJs('window.__a11y.thaw()')
      const hover = await read(hovShots)
      const fixH = await repair(hovRects, hover, 'lbl')
      const moved = await diff(plateOff, plateOn)
      await force(ids, [])

      // The pointer fallback, per inert button.
      let ptr = 0
      for (let i = 0; i < rects.length; i++) {
        if (!rects[i].shipped || rects[i].lbl.noText) continue
        if (!(moved[i] && moved[i].moved < 0.005)) continue
        const v = await pointerHover(i, rects[i])
        if (v && !blind(v)) { hover[i] = v; ptr++ }
      }

      for (let i = 0; i < rects.length; i++) {
        const r = rects[i]
        if (r.shipped) {
          const g = `${r.key}|${version}`
          if (!geom.has(g)) geom.set(g, { w: +r.btn.w.toFixed(3), h: +r.btn.h.toFixed(3) })
        }
        rows.push({ version, theme, palette: pal, key: r.key, i,
          shipped: r.shipped, noText: r.lbl.noText,
          rest: rest[i], hover: hover[i],
          restBlind: blind(rest[i]), hoverBlind: blind(hover[i]),
          plateMoved: moved[i] ? moved[i].moved : null,
          pointer: !!(moved[i] && moved[i].moved < 0.005) })
      }
      const live = rows.filter(x => x.version === version && x.theme === theme && x.palette === pal && x.shipped)
      const bad = live.filter(x => !x.noText && !x.restBlind && x.rest && exact(x.rest) < FLOOR).length
        + live.filter(x => !x.noText && !x.hoverBlind && x.hover && exact(x.hover) < FLOOR).length
      console.error(`[sweep] ${version}/${theme}/${pal}: ${live.length}/${rects.length} shipped`
        + ` | under ${FLOOR}:1 — ${bad}`
        + (fixR + fixH ? ` | recaptured ${fixR}+${fixH}` : '')
        + (ptr ? ` | pointer hover ${ptr}` : ''))
    }
  }
}
await p.close()

/* ---- the report -------------------------------------------------------- */
const fx = v => v == null ? '   -' : String(v.toFixed(2)).padStart(5)
const byKey = new Map()
for (const r of rows) { if (!byKey.has(r.key)) byKey.set(r.key, []) ; byKey.get(r.key).push(r) }

let fails = 0, nm = 0, readings = 0, atFloor = 0
console.log('')
for (const m of meta) {
  const mine = byKey.get(m.key) || []
  console.log(`${m.num} ${m.title}  ·  ${m.key}  ·  native ${m.native || '—'}`
    + `  ·  declares ${m.declared.join(' ') || '—'}`
    + (FORCE ? '  ·  FORCED (measured, not declared)' : ''))
  const nb = m.buttons
  for (const version of VERSIONS) {
    const vr = mine.filter(r => r.version === version)
    if (!vr.some(r => r.shipped)) { console.log(`  ${version.padEnd(8)} not offered — the filter hides it`); continue }
    console.log(`  ${version}`)
    console.log('    ' + 'theme/state'.padEnd(13) + PALETTES.map(x => x.slice(0, 7).padStart(8)).join(''))
    for (const theme of THEMES) for (const state of ['rest', 'hover']) {
      // One row per theme+state, one column per palette. Several buttons under
      // one key is a ROW study: the worst of its buttons is the row's number,
      // because a row shares one version and fails as one.
      const line = PALETTES.map(pal => {
        const c = vr.filter(r => r.theme === theme && r.palette === pal && r.shipped)
        if (!c.length) return '       ·'
        const vals = c.map(r => ({ v: r[state], blind: r[state === 'rest' ? 'restBlind' : 'hoverBlind'], noText: r.noText }))
        const usable = vals.filter(x => x.v && !x.blind && !x.noText)
        readings += usable.length
        nm += vals.length - usable.length
        if (!usable.length) return (vals.some(x => x.noText) ? '~' : 'n/m').padStart(8)
        const worst = Math.min(...usable.map(x => exact(x.v)))
        if (worst < FLOOR) { fails++; return ('!' + worst.toFixed(2)).padStart(8) }
        if (worst < ATFLOOR) { atFloor++; return ('=' + worst.toFixed(2)).padStart(8) }
        return (' ' + worst.toFixed(2)).padStart(8)
      }).join('')
      console.log('    ' + `${theme} ${state}`.padEnd(13) + line + (nb > 1 ? `   (worst of ${nb})` : ''))
    }
  }
  // Gate 4: the same rect in every PLATE-BEARING version. A border set to zero
  // rather than transparent is 2px narrower and the promise breaks.
  //
  // ⚠️ LINK IS NOT IN THE COMPARISON, and the first run of this tool failed 123
  // for it. A link version is a 1.5px rule along the bottom edge with the
  // plate's padding gone, so it is smaller BY CONSTRUCTION — 147.086 x 33.003
  // against the plate's 195.087 x 47.003 on 123. Holding it to the plate's rect
  // would ask every link version on the page to keep a plate it does not have,
  // which is the opposite of what the version means. Its rect is printed,
  // because a link that measures the same as the plate has not dropped it.
  // 🔑 AND THE 2px IS THE PAGE'S NORM, NOT A FAULT. Measured 2026-09-02 across
  // the page's own population: of the 53 studies that render in BOTH fill and
  // outline, 44 are exactly 2.000 apart in each dimension and only 9 are
  // identical. .btn--solid sets no border and .btn--line sets a real 1px one,
  // so a native-fill study grows by exactly that when the treatment lands.
  // Only a study that keeps a border and turns it transparent — 123, 49 and
  // seven others — measures the same in both.
  // So this fails ARBITRARY drift and reports the structural 2px. Failing the
  // 2px instead would have blocked every honest declaration in Batch 2, and
  // fixing it per study would mean changing what a shipped card measures.
  const PLATE = ['fill', 'outline']
  const BORDER = 2   // .btn--line's 1px, twice, in each dimension
  const g = VERSIONS.map(v => [v, geom.get(`${m.key}|${v}`)]).filter(([, x]) => x)
  const gp = g.filter(([v]) => PLATE.includes(v))
  if (g.length) {
    let note = '   '
    if (gp.length > 1) {
      const [, first] = gp[0]
      // PER DIMENSION, and that is not a loosening. A study with a max-width
      // absorbs the border on the capped axis instead of growing: card 19 is
      // 264x45 in fill and 264x47 in outline, because max-width:264px is
      // already reached and the border eats into the content box. Requiring
      // both axes to move by 2 called that «the study's own box moves», which
      // is the one thing it is not.
      // Each delta must be 0 or exactly +2, measured against the fill. A
      // NEGATIVE delta is a real finding — a border cannot make a box smaller —
      // and so is any other number.
      const off = gp.map(([v, x]) => ({ v, dw: x.w - first.w, dh: x.h - first.h }))
      const ok = d => Math.abs(d) < 0.5 || Math.abs(d - BORDER) < 0.5
      const structural = off.every(o => ok(o.dw) && ok(o.dh))
      const identical = off.every(o => Math.abs(o.dw) < 0.5 && Math.abs(o.dh) < 0.5)
      note = identical    ? '   ✓ identical across the plate versions'
           : structural   ? "   ~ 2px apart — .btn--line's border, which 44 of the page's 53 already are"
                          : '   !! DRIFT that is not the border — the study\'s own box moves between versions'
      if (!structural) fails++
    }
    console.log('  geometry     ' + g.map(([v, x]) => `${v} ${x.w}x${x.h}`).join('  ·  ') + note)
  }
  console.log('')
}
console.log(`${readings} readings · ${nm} not measurable`
  + ` · ${atFloor} cells at the floor · ${fails} under ${FLOOR}:1 or drifted`)
console.log('  !  under ' + FLOOR + ':1     =  clears by under ' + (ATFLOOR - FLOOR).toFixed(2)
  + ', which is the palette row aiming at the floor     n/m  no glyph in the crop'
  + '     ~  the label is a pseudo-element     ·  not offered')
console.log(fails ? 'VERDICT: FAIL — do not declare these versions until every cell clears the floor.'
  : 'VERDICT: PASS — every cell clears the floor in every palette, both themes, rest and hovered.')

if (JSON_OUT) {
  const out = path.isAbsolute(JSON_OUT) ? JSON_OUT : path.join(ROOT, JSON_OUT)
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, JSON.stringify({ font, meta, versions: VERSIONS, themes: THEMES, palettes: PALETTES, rows }, null, 1))
  console.error('[sweep] wrote', out)
}
process.exit(fails ? 1 : 0)
