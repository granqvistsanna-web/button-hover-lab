/* tools/lib/page.mjs — the headless page harness and the page-side pixel kit.
 *
 * WHY THIS FILE EXISTS. Two tools now need the same three things: a Chrome that
 * serves this repo over http (file:// silently no-ops the sync tripwire), a CDP
 * channel, and a pixel reader that composites the way the browser does. The
 * second tool is tools/version-sweep.mjs, and reimplementing textVsBg for it
 * would have been the fourth time this page has been measured by a histogram
 * written from scratch — the first three disagreed with each other.
 *
 * ⚠️ tools/a11y.mjs STILL CARRIES ITS OWN COPY, on purpose, as of 2026-09-02.
 * It is the contrast gate that stands in front of every push, its numbers are
 * the ones quoted in CLAUDE.md, and repointing it at a fresh module in the same
 * commit that introduces that module would mean the gate and the thing being
 * gated change together. The copy below is verbatim from a11y.mjs at a84e6cd
 * with ONE deliberate change — ROOT, which has to climb two directories from
 * here rather than one, and which is commented at the line because getting it
 * wrong looks like a missing study rather than a broken server. Converging the
 * two copies is a separate, reviewable commit.
 */
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import { spawn } from 'node:child_process'

// ⚠️ TWO levels, not one. This file sits in tools/lib, so the verbatim line
// from a11y.mjs (which sits in tools) pointed the static server at tools/ — and
// a server with no index.html to serve hands back a 404, which renders as a
// blank page with no .spec in it. That reads exactly like a study that has been
// renamed or retired, and the first run of version-sweep.mjs reported its key
// as missing rather than its server as misrooted.
const ROOT = path.resolve(import.meta.dirname, '..', '..')

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
    const floor = Math.max(3, px.length * 0.003)
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

  // The rect the GLYPHS occupy, not the rect a wrapper occupies. Half the
  // studies have no .lbl at all and the rest wrap it in per-character spans, so
  // both fallbacks measure a plate and the histogram then reads a plate: the
  // ink is under a per-cent of the crop and gets thrown out with the
  // antialiasing. A Range over each visible text node gives the real box.
  A.textRect = b => {
    const sx = window.scrollX, sy = window.scrollY
    const w = document.createTreeWalker(b, NodeFilter.SHOW_TEXT, {
      acceptNode (n) {
        if (!n.nodeValue.trim()) return NodeFilter.FILTER_REJECT
        // aria-hidden is a fact about the accessibility tree, not about paint.
        // Thirteen studies show their label from per-character spans marked
        // aria-hidden with an .sr copy alongside — the correct pattern — and
        // excluding those here left thirteen labels unmeasured.
        for (let e = n.parentElement; e && e !== b.parentElement; e = e.parentElement) {
          const cs = getComputedStyle(e)
          if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0)
            return NodeFilter.FILTER_REJECT
          if (e.classList.contains('sr')) return NodeFilter.FILTER_REJECT
        }
        return NodeFilter.FILTER_ACCEPT
      }
    })
    // 🚨 AND EVERY RECT IS CLIPPED BY ITS OWN ANCESTORS BEFORE IT JOINS THE
    // UNION. Clamping the union to the button was half the answer and fixed the
    // studies whose duplicate is drawn OUTSIDE it — 19's second run of the word,
    // 106px to the right. It cannot touch the commoner case, where the duplicate
    // is inside the button and outside a track: 137's label rect stayed 35px
    // tall for a 15px line, because a roll parks its second copy one face below
    // the first under overflow:hidden on a 1.25em .track. Those pixels are
    // never on screen, and the crop that took them in read the study's own
    // --card isolation ground as its text — luminance 1.000, pure white, against
    // a #00aa46 plate, which is the 3.07:1 that survived the clamp on a label
    // whose real number is 6.05.
    // Per RECT and not per union, because two copies of one label sit in two
    // different tracks and are clipped by different boxes. A rect clipped away
    // to nothing is dropped rather than unioned: that is the outgoing copy of a
    // swap, which is exactly what should not be measured once it has left.
    // Bounded at the button, so nothing here has to reason about the feed —
    // .sect and .grid are display:contents and have no box to intersect with,
    // and the button clamp below is the outer bound anyway.
    const clipped = (q, from) => {
      let l = q.left, t = q.top, r = q.right, bo = q.bottom
      for (let e = from; e && e !== b.parentElement; e = e.parentElement) {
        const cs = getComputedStyle(e)
        if (cs.display === 'contents') continue
        if (cs.overflow === 'visible' && cs.overflowX === 'visible'
            && cs.overflowY === 'visible') continue
        const c = e.getBoundingClientRect()
        l = Math.max(l, c.left);  t = Math.max(t, c.top)
        r = Math.min(r, c.right); bo = Math.min(bo, c.bottom)
      }
      return { l, t, r, b: bo }
    }
    let box = null
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const r = document.createRange(); r.selectNodeContents(n)
      for (const q of r.getClientRects()) {
        if (q.width < 0.5 || q.height < 0.5) continue
        const c = clipped(q, n.parentElement)
        if (c.r - c.l < 0.5 || c.b - c.t < 0.5) continue
        box = box
          ? { l: Math.min(box.l, c.l), t: Math.min(box.t, c.t),
              r: Math.max(box.r, c.r), b: Math.max(box.b, c.b) }
          : c
      }
    }
    let noText = false
    if (!box) { noText = true; const q = b.getBoundingClientRect()
      box = { l: q.left, t: q.top, r: q.right, b: q.bottom } }
    // 🚨 AND THE BOX IS CLIPPED TO THE BUTTON. Thirteen studies duplicate their
    // label — a roll keeps a second copy below the plate, 19 keeps a whole
    // second run of the word 106px to the right — and the range covers the
    // duplicate too, because it is painted, it is not aria-hidden and it is not
    // display:none. It is, however, CLIPPED: overflow:hidden on the plate means
    // those pixels are never on screen. The crop then ran past the plate onto
    // the card, and textVsBg did exactly what it is built to do — took the two
    // extremes of what it was handed, which were the plate and the card, and
    // reported plate-against-card as if it were label-against-plate. That is
    // where «3.07:1» came from on ten studies whose labels measure 6.11.
    // A label pixel is inside its button by definition, so intersect. If the
    // intersection is empty the label really is drawn outside its own button
    // and the histogram is advisory again, the same as a pseudo-element one.
    const q = b.getBoundingClientRect()
    const cl = { l: Math.max(box.l, q.left),  t: Math.max(box.t, q.top),
                 r: Math.min(box.r, q.right), b: Math.min(box.b, q.bottom) }
    if (cl.r - cl.l >= 0.5 && cl.b - cl.t >= 0.5) box = cl
    else noText = true
    // A study whose label is painted by a pseudo-element has no text node to
    // range over. The crop then falls back to the plate and the histogram is
    // advisory, not a verdict — so say so rather than reporting a ratio of 1.
    return { x: box.l+sx, y: box.t+sy, w: box.r-box.l, h: box.b-box.t, noText }
  }

  A.rects = () => [...document.querySelectorAll('.spec')].flatMap(card =>
    [...card.querySelectorAll('.stage button.btn')].map(b => {
      const br = b.getBoundingClientRect()
      const sx = window.scrollX, sy = window.scrollY
      // The version control FILTERS: picking Fill hides every study that does
      // not ship one, and a hidden card has no layout. Measuring those as
      // zero-size crops reported 100 of 118 "under 4.5:1" on the first run —
      // an artefact of the filter and not a contrast fault anywhere.
      const shipped = b.offsetParent !== null && br.width > 0 && br.height > 0
      return { shipped, btn: { x: br.x+sx, y: br.y+sy, w: br.width, h: br.height },
               lbl: A.textRect(b) }
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
  // Twelve studies loop for ever and the rest are mid-transition for up to
  // 900ms. Pausing every running animation for the length of one capture is the
  // difference between a measurement and a coin toss: two runs of the same
  // build disagreed on cards 43 and 82 before this.
  // A rect cut out of a WHOLE-VIEWPORT shot, in the page rather than by CDP.
  // This is the other half of the surface answer: Page.captureScreenshot's own
  // clip is what comes back blank, and captureBeyondViewport is only ever
  // reached for because the clip cannot be trusted. An unclipped viewport
  // capture is neither — it is the surface as it is actually painted — so the
  // rectangle is taken from it here, in device pixels, against the live scroll.
  A.cropRead = async (b64, page, dpr) => {
    const x = page.x - scrollX, y = page.y - scrollY
    if (y < 0 || y + page.h > innerHeight || x < 0 || x + page.w > innerWidth) return null
    const bmp = await createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob())
    const w = Math.max(1, Math.round(page.w * dpr)), h = Math.max(1, Math.round(page.h * dpr))
    const cv = new OffscreenCanvas(w, h)
    const cx = cv.getContext('2d', { willReadFrequently: true })
    cx.drawImage(bmp, Math.round(x * dpr), Math.round(y * dpr), w, h, 0, 0, w, h)
    return A.textVsBg(cx.getImageData(0, 0, w, h))
  }
  A.dpr = () => devicePixelRatio
  A.freeze = () => { const a = document.getAnimations(); a.forEach(x => { try { x.pause() } catch (e) {} }); return a.length }
  A.thaw   = () => { document.getAnimations().forEach(x => { try { x.play() } catch (e) {} }); return true }
  // behavior:'instant' is load-bearing. The page sets html{scroll-behavior:smooth}
  // under prefers-reduced-motion:no-preference, so a plain scrollTo ANIMATES —
  // and scrollY comes back as the target while the surface is still travelling.
  // A capture clipped against that number lands somewhere the label is not, which
  // reads as a flat crop and gets filed as «not measurable» for a label that is
  // sitting there in plain sight.
  A.into   = y => { window.scrollTo({ top: Math.max(0, y - window.innerHeight/2),
                                      left: 0, behavior: 'instant' }); return window.scrollY }

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

export { open, KIT, ROOT, MIME, findChrome }
