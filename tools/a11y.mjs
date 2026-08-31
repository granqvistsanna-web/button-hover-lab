#!/usr/bin/env node
/* tools/a11y.mjs — accessibility harvest for the ninety studies.
 *
 * WHY A BROWSER. Three of the five things this measures cannot be read off the
 * source. Contrast is decided by whatever pixel actually lands under a glyph,
 * and half the studies paint their plate with a pseudo-element, a mask or a
 * translucent overlay — compositing that by hand is how the pair-tuck bug
 * survived a source review and only showed up on a screenshot. Target size is
 * layout. And a focus ring's visibility is a fact about two adjacent pixels.
 *
 * WHY PIXELS AND NOT getComputedStyle. Same reason. The label's `color` is not
 * the colour you see once an ::after has been drawn over it at 60% alpha, and
 * `background` is not the plate when the plate is a child element. So: clip a
 * screenshot to the label, hand the PNG back to the page, let the browser
 * decode it into a canvas, and split the luminance histogram. The browser is
 * the only honest compositor available.
 *
 * WHY THE FONT GATE. A harvest that runs before the Geist faces land measures
 * every button in the fallback, at the wrong width, and reports a page-wide
 * drift that does not exist. That has happened. The run aborts instead.
 *
 * Read-only. Writes JSON next to nothing; prints a table.
 */
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import { spawn } from 'node:child_process'

const ROOT = path.resolve(import.meta.dirname, '..')
const OUT  = process.env.A11Y_OUT || path.join(ROOT, 'build', 'a11y.json')

const MIME = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8',
  '.json':'application/json', '.png':'image/png', '.woff2':'font/woff2',
  '.woff':'font/woff', '.svg':'image/svg+xml' }

function findChrome () {
  if (process.env.CHROME) return process.env.CHROME
  const cache = path.join(process.env.HOME, 'Library/Caches/ms-playwright')
  const shells = fs.existsSync(cache)
    ? fs.readdirSync(cache).filter(d => d.startsWith('chromium_headless_shell-')).sort().reverse()
    : []
  for (const d of shells) for (const arch of ['mac-arm64','mac-x64','linux64']) {
    const p = path.join(cache, d, `chrome-headless-shell-${arch}`, 'chrome-headless-shell')
    if (fs.existsSync(p)) return p
  }
  const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  if (fs.existsSync(chrome)) return chrome
  throw new Error('no Chrome found; set CHROME=<path>')
}

async function open () {
  const server = http.createServer((rq, rs) => {
    const u = decodeURIComponent(rq.url.split('?')[0])
    const f = path.join(ROOT, u === '/' ? 'index.html' : u)
    fs.readFile(f, (e, d) => {
      if (e) { rs.writeHead(404); rs.end('nf'); return }
      rs.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream',
        'Cache-Control': 'no-store' })
      rs.end(d)
    })
  })
  await new Promise(r => server.listen(0, r))
  const port = server.address().port
  const profile = fs.mkdtempSync('/tmp/bhl-a11y-')
  const chrome = spawn(findChrome(), ['--remote-debugging-port=0','--headless=new',
    '--disable-gpu','--no-first-run','--hide-scrollbars','--force-device-scale-factor=2',
    '--window-size=1440,1200', `--user-data-dir=${profile}`,'about:blank'],
    { stdio: ['ignore','ignore','pipe'] })
  const cdpPort = await new Promise((res, rej) => {
    let buf = ''
    chrome.stderr.on('data', d => { buf += d
      const m = buf.match(/ws:\/\/127\.0\.0\.1:(\d+)/); if (m) res(Number(m[1])) })
    setTimeout(() => rej(new Error('chrome did not report a debug port')), 20000)
  })
  let target
  for (let i = 0; i < 120 && !target; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).json()
      target = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl)
    } catch {}
    if (!target) await new Promise(r => setTimeout(r, 150))
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let id = 0; const waits = new Map(); const events = []
  ws.onmessage = e => {
    const m = JSON.parse(e.data)
    if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id) }
    else if (m.method) events.push(m)
  }
  const send = (method, params = {}) => new Promise(r => {
    const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
  const evalJs = async expression => {
    const r = await send('Runtime.evaluate',
      { expression, returnByValue: true, awaitPromise: true })
    if (r.result?.exceptionDetails)
      throw new Error(r.result.exceptionDetails.exception?.description || 'eval failed')
    return r.result?.result?.value
  }
  const close = async () => {
    ws.close(); chrome.kill(); server.close()
    await new Promise(r => setTimeout(r, 300))
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
  await send('Runtime.enable'); await send('Page.enable'); await send('DOM.enable')
  await send('CSS.enable'); await send('Emulation.setFocusEmulationEnabled', { enabled: true })
  return { send, evalJs, close, port, events }
}

/* ---- the page-side kit ------------------------------------------------- */
// Installed once. Everything below runs in the page: the pixel reader, the
// contrast maths, and the two selectors the harvest walks.
const KIT = String.raw`(() => {
  const A = window.__a11y = {}

  A.lin = c => { c /= 255; return c <= 0.04045 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4) }
  A.lum = (r,g,b) => 0.2126*A.lin(r) + 0.7152*A.lin(g) + 0.0722*A.lin(b)
  A.ratio = (a,b) => { const [x,y] = a > b ? [a,b] : [b,a]; return (x+0.05)/(y+0.05) }

  // Decode a clipped PNG the browser just produced for us, into an
  // ImageData. The browser owns PNG; we only own the histogram.
  A.pixels = async (b64, w, h) => {
    const bmp = await createImageBitmap(await (await fetch('data:image/png;base64,'+b64)).blob())
    const cv = new OffscreenCanvas(bmp.width, bmp.height)
    const cx = cv.getContext('2d', { willReadFrequently: true })
    cx.drawImage(bmp, 0, 0)
    return cx.getImageData(0, 0, bmp.width, bmp.height)
  }

  // Text-vs-background out of one crop. A label crop is bimodal: a lot of
  // plate and a little ink, with antialiased pixels between the two. Take the
  // most common luminance as the background, then the FARTHEST luminance that
  // holds at least 1% of the pixels as the text — a single stray pixel from a
  // neighbouring element must not be allowed to set the number, and neither
  // must the antialiasing, which is why it is the far mode and not the max.
  A.textVsBg = img => {
    const d = img.data, n = d.length/4
    const bins = new Float64Array(101), cnt = new Float64Array(101)
    const px = []
    for (let i = 0; i < n; i++) {
      const r = d[i*4], g = d[i*4+1], b = d[i*4+2], a = d[i*4+3]
      if (a < 250) continue
      const L = A.lum(r,g,b), k = Math.round(L*100)
      bins[k] += L; cnt[k]++; px.push(L)
    }
    if (!px.length) return null
    let bgK = 0; for (let k = 0; k <= 100; k++) if (cnt[k] > cnt[bgK]) bgK = k
    const bg = bins[bgK]/cnt[bgK]
    const floor = Math.max(3, px.length * 0.01)
    let txK = bgK, best = 0
    for (let k = 0; k <= 100; k++) {
      if (cnt[k] < floor) continue
      const dist = Math.abs(k - bgK)
      if (dist > best) { best = dist; txK = k }
    }
    const tx = bins[txK]/cnt[txK]
    let sum = 0; for (const L of px) sum += L
    const mean = sum/px.length
    let vr = 0; for (const L of px) vr += (L-mean)*(L-mean)
    return { bg: +bg.toFixed(4), tx: +tx.toFixed(4),
             ratio: +A.ratio(tx, bg).toFixed(2), pixels: px.length,
             bgShare: +(cnt[bgK]/px.length).toFixed(3),
             mean: +mean.toFixed(4), sd: +Math.sqrt(vr/px.length).toFixed(4) }
  }

  // Every button on the page, with the card it belongs to and the rect the
  // label occupies. The label rect and not the button rect: a crop of the whole
  // plate is dominated by plate, and on the wide studies by the plate's
  // neighbours.
  A.inventory = () => [...document.querySelectorAll('.spec')].flatMap(card => {
    const num = (card.querySelector('.num')||{}).textContent || '?'
    const h3 = card.querySelector('h3')
    const title = h3 ? h3.textContent.replace(num, '').trim() : '?'
    const key = card.getAttribute('data-key') || '?'
    return [...card.querySelectorAll('.stage button.btn')].map((b, i) => {
      return { num: +num, key, title, idx: i,
               cls: [...b.classList].filter(c => c !== 'btn').join(' '),
               ariaHidden: b.getAttribute('aria-hidden') === 'true',
               tabidx: b.getAttribute('tabindex') }
    })
  })

  A.rects = () => [...document.querySelectorAll('.spec')].flatMap(card =>
    [...card.querySelectorAll('.stage button.btn')].map(b => {
      const lbl = b.querySelector('.lbl') || b
      const br = b.getBoundingClientRect(), lr = lbl.getBoundingClientRect()
      const sx = window.scrollX, sy = window.scrollY
      return { btn: { x: br.x+sx, y: br.y+sy, w: br.width, h: br.height },
               lbl: { x: lr.x+sx, y: lr.y+sy, w: lr.width, h: lr.height } }
    }))

  A.nodes = () => [...document.querySelectorAll('.spec .stage button.btn')]

  // Two crops of the same rect, one per state: how much of it moved, and by
  // how much. A study whose focus or hover leaves this at ~0 is not reacting.
  A.diff = async (a, b) => {
    const A1 = await A.pixels(a), B1 = await A.pixels(b)
    const d1 = A1.data, d2 = B1.data, n = Math.min(d1.length, d2.length)/4
    let moved = 0, maxd = 0, sum = 0
    for (let i = 0; i < n; i++) {
      const la = A.lum(d1[i*4], d1[i*4+1], d1[i*4+2])
      const lb = A.lum(d2[i*4], d2[i*4+1], d2[i*4+2])
      const dd = Math.abs(la - lb)
      if (dd > 0.01) moved++
      if (dd > maxd) maxd = dd
      sum += dd
    }
    return { moved: +(moved/n).toFixed(4), maxDelta: +maxd.toFixed(4),
             meanDelta: +(sum/n).toFixed(5) }
  }

  // The declared ring, and the ground it is drawn on. Contrast of an outline is
  // against what is BEHIND it, and at outline-offset:3px that is the card, not
  // the plate — so both are reported and the caller takes the worse.
  A.ring = () => [...document.querySelectorAll('.spec .stage button.btn')].map(b => {
    const cs = getComputedStyle(b)
    const parse = c => { const m = c.match(/[\d.]+/g); if (!m) return null
      return { r: +m[0], g: +m[1], b: +m[2], a: m[3] === undefined ? 1 : +m[3] } }
    const o = parse(cs.outlineColor)
    const walk = el => { // first opaque painted ancestor
      let n = el.parentElement
      while (n) { const c = parse(getComputedStyle(n).backgroundColor)
        if (c && c.a > 0.9) return c; n = n.parentElement }
      return { r: 0, g: 0, b: 0, a: 1 }
    }
    const ground = walk(b)
    const plate = parse(cs.backgroundColor)
    const L = c => c ? A.lum(c.r, c.g, c.b) : null
    return { style: cs.outlineStyle, width: cs.outlineWidth, offset: cs.outlineOffset,
             color: cs.outlineColor,
             vsGround: o ? +A.ratio(L(o), L(ground)).toFixed(2) : null,
             vsPlate: (o && plate && plate.a > 0.9)
               ? +A.ratio(L(o), L(plate)).toFixed(2) : null }
  })
  A.fontOK = () => {
    const sheets = [...document.styleSheets].map(s => s.href).filter(Boolean)
    let faces = 0
    try { for (const s of document.styleSheets) { try {
      for (const r of s.cssRules) if (r.constructor.name === 'CSSFontFaceRule') faces++
    } catch (e) {} } } catch (e) {}
    return { sheets, faces,
             geist: document.fonts.check('500 15px Geist'),
             mono: document.fonts.check('500 11px "Geist Mono"'),
             status: document.fonts.status }
  }
  return true
})()`

/* ---- main -------------------------------------------------------------- */
/* Four passes, each measuring the thing it can measure honestly.
 *
 *  REST     every theme x version, no interaction. Cheap, so it runs the whole
 *           matrix — and the link version is the one that shrinks the target,
 *           so geometry is re-read per version rather than assumed constant.
 *  HOVER-CSS every theme x version, via CSS.forcePseudoState. Cheap and covers
 *           the ~70 studies whose hover IS css. It reports a NO-OP for the
 *           twenty that drive hover from JS, which is a finding in itself.
 *  HOVER-PTR dark / as-built only, with a real pointer at the plate's centre,
 *           so the JS-driven studies are measured as a visitor gets them.
 *           Expensive (scroll + settle per button), hence the narrow sweep.
 *  FOCUS    forcePseudoState('focus-visible'), both themes. A programmatic
 *           .focus() does NOT match :focus-visible on a button, so this is the
 *           only way to see the ring without tabbing 616 stops.
 */
const OUTDIR = path.dirname(OUT)
const SETTLE = Number(process.env.A11Y_SETTLE || 950)   // longest --t-5 chain + slack
const THEMES   = (process.env.A11Y_THEMES   ?? 'dark,light').split(',')
const VERSIONS = (process.env.A11Y_VERSIONS ?? ',fill,outline,link').split(',')
const LIMIT    = Number(process.env.A11Y_LIMIT || 0)     // first N buttons, for a smoke run

const p = await open()
await p.send('Page.navigate', { url: `http://127.0.0.1:${p.port}/` })
await new Promise(r => setTimeout(r, 1200))
await p.evalJs(`new Promise(r => document.fonts.ready.then(() => setTimeout(r, 600)))`)
await p.evalJs(KIT)

const font = await p.evalJs('JSON.stringify(window.__a11y.fontOK())').then(JSON.parse)
console.error('[a11y] stylesheets:', font.sheets.length, '| Geist:', font.geist,
  '| Geist Mono:', font.mono, '|', font.status)
if (!font.geist) {
  await p.close()
  console.error('[a11y] ABORT — the Geist faces did not load. Every number below would have')
  console.error('       been measured in the fallback font. Fix the sheet; do not read these.')
  process.exit(2)
}

const inv = await p.evalJs('JSON.stringify(window.__a11y.inventory())').then(JSON.parse)
console.error('[a11y] stage buttons:', inv.length, 'across',
  new Set(inv.map(b => b.num)).size, 'cards')

// Node ids for forcePseudoState. Refetched after every version switch: the
// switch rewrites classes, and a stale nodeId forces the pseudo-state onto
// nothing, in silence.
async function nodeIds () {
  const doc = await p.send('DOM.getDocument', { depth: -1 })   // ONE .result
  const root = doc.result.root.nodeId
  const r = await p.send('DOM.querySelectorAll',
    { nodeId: root, selector: '.spec .stage button' })
  return r.result.nodeIds
}
async function force (ids, classes) {
  for (const nodeId of ids)
    await p.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: classes })
}

async function setTheme (t) {
  await p.evalJs(`(() => { const b = document.querySelector('#v-theme .vers-b[data-theme="${t}"]');
    if (!b) throw new Error('no theme control for ${t}'); b.click(); return true })()`)
  await new Promise(r => setTimeout(r, 500))
}
async function setVersion (v) {
  await p.evalJs(`(() => { const s = '${v}' === '' ? '#v-treat .vers-b[data-v=""]'
      : '#v-treat .vers-b[data-v="${v}"]'
    const b = document.querySelector(s); if (!b) throw new Error('no version control for ${v}')
    b.click(); return true })()`)
  await new Promise(r => setTimeout(r, 700))
}

// One crop, one verdict. The label rect padded by a pixel each way, floored at
// 6px tall so a one-line label still yields a histogram.
async function measure (rects) {
  const out = []
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i]
    const w = Math.max(4, Math.round(r.lbl.w) + 2), h = Math.max(6, Math.round(r.lbl.h) + 2)
    let shot
    try {
      shot = await p.send('Page.captureScreenshot', { format: 'png',
        clip: { x: r.lbl.x - 1, y: r.lbl.y - 1, width: w, height: h, scale: 2 },
        captureBeyondViewport: true, fromSurface: true, optimizeForSpeed: true })
    } catch (e) { out.push(null); continue }
    const b64 = shot.result?.data
    if (!b64) { out.push(null); continue }
    const v = await p.evalJs(`(async () => { const img = await window.__a11y.pixels(${JSON.stringify(b64)})
      return JSON.stringify(window.__a11y.textVsBg(img)) })()`)
    out.push(v ? JSON.parse(v) : null)
  }
  return out
}

const results = []   // one row per theme x version x state
const rings   = []   // one row per theme

// Crops kept per (theme,version) so hover can be diffed against rest without a
// second capture of the same rect.
async function shots (rects, kind) {
  const out = []
  for (const r of rects) {
    const box = kind === 'ring'
      ? { x: r.btn.x - 10, y: r.btn.y - 10, w: Math.round(r.btn.w) + 20, h: Math.round(r.btn.h) + 20 }
      : { x: r.lbl.x - 1,  y: r.lbl.y - 1,  w: Math.max(4, Math.round(r.lbl.w) + 2),
          h: Math.max(6, Math.round(r.lbl.h) + 2) }
    try {
      const s = await p.send('Page.captureScreenshot', { format: 'png',
        clip: { x: box.x, y: box.y, width: box.w, height: box.h, scale: 2 },
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

for (const theme of THEMES) {
  await setTheme(theme)
  for (const version of VERSIONS) {
    await setVersion(version)
    const ids = await nodeIds()
    await force(ids, []); await new Promise(r => setTimeout(r, 350))
    let rects = await p.evalJs('JSON.stringify(window.__a11y.rects())').then(JSON.parse)
    if (LIMIT) rects = rects.slice(0, LIMIT)
    const restShots = await shots(rects, 'lbl')
    const rest = await read(restShots)
    await force(ids, ['hover']); await new Promise(r => setTimeout(r, SETTLE))
    // Two hover crops, because half these studies MOVE the label. The rest-rect
    // crop answers "did this region change" — the diff. The hover-rect crop
    // answers "what is the contrast now". Reading the second question off the
    // first rect is how card 43 came back with no label at all: the keycap had
    // translated out of the box the rect was taken from.
    const hovAtRest = await shots(rects, 'lbl')
    let hovRects = await p.evalJs('JSON.stringify(window.__a11y.rects())').then(JSON.parse)
    if (LIMIT) hovRects = hovRects.slice(0, LIMIT)
    const hovShots = await shots(hovRects, 'lbl')
    const hover = await read(hovShots)
    const moved = await diff(restShots, hovAtRest)
    await force(ids, [])
    results.push({ theme, version, rects, hovRects, rest, hover, moved })
    const u = a => a.filter(x => x && x.ratio < 4.5).length
    const inert = moved.filter(m => m && m.moved < 0.005).length
    console.error(`[a11y] ${theme}/${version || 'built'}: under 4.5:1 — rest ${u(rest)},`
      + ` hover ${u(hover)} | css-hover inert on ${inert}/${moved.length}`)
  }
}

// The ring, as-built, both themes: the declared outline plus a pixel diff of
// the plate and 10px of its ground, focused against not.
await setVersion('')
for (const theme of THEMES) {
  await setTheme(theme)
  const ids = await nodeIds()
  let rects = await p.evalJs('JSON.stringify(window.__a11y.rects())').then(JSON.parse)
  if (LIMIT) rects = rects.slice(0, LIMIT)
  await force(ids, []); await new Promise(r => setTimeout(r, 350))
  const off = await shots(rects, 'ring')
  await force(ids, ['focus-visible']); await new Promise(r => setTimeout(r, 500))
  // The ring crop keeps the REST rect on purpose: 10px of ground either side is
  // enough to hold a plate that shifts, and the diff needs one frame of
  // reference. A moved plate is itself a visible focus change.
  const on = await shots(rects, 'ring')
  const declared = await p.evalJs('JSON.stringify(window.__a11y.ring())').then(JSON.parse)
  const changed = await diff(off, on)
  await force(ids, [])
  rings.push({ theme, declared, changed })
  const dead = changed.filter(c => c && c.moved < 0.002).length
  const thin = declared.filter(d => d.style === 'none' || parseFloat(d.width) < 2).length
  const low  = declared.filter(d => d.vsGround !== null && d.vsGround < 3).length
  console.error(`[a11y] ring/${theme}: no visible change on ${dead}/${changed.length},`
    + ` under 2px or none on ${thin}, under 3:1 vs ground on ${low}`)
}

await p.close()
fs.mkdirSync(OUTDIR, { recursive: true })
fs.writeFileSync(OUT, JSON.stringify({ font, inventory: inv, results, rings }, null, 1))
console.error('[a11y] wrote', OUT)
