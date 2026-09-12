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
 * 🚨 HOW A CROP IS TAKEN, AND WHY NOT THE WAY IT WAS. Until 2026-09-11 every
 * crop was a Page.captureScreenshot with a clip AND captureBeyondViewport, one
 * shot per rect, and only a reading that failed was re-read down a second path
 * and swapped for it. Ported here from tools/version-sweep.mjs (cac107d), where
 * that combination was caught passing real failures. Measured cause:
 * captureBeyondViewport RESIZES THE PAGE for every capture — the page sees a
 * resize event per crop, 115 in the first pass of a run — so (min-width:1360px)
 * goes false and true again and the hidden inspector (#tools, fixed, 276px on
 * the right wall) runs its 340ms slide out FROM ON SCREEN, over whatever the
 * viewport's band of the page holds. Painted magenta, it was in the plate crops
 * of every right-column study in that band — up to 46,800 of a crop's pixels —
 * and the band moves whenever a re-read of a failure centres its study. A strip
 * of panel in a crop reads as plate-against-panel, or as a hover that changed.
 * So: NO captureBeyondViewport anywhere. Every crop is brought ON SCREEN first
 * (bring), below the fixed masthead, and clipped in page coordinates — the
 * surface as painted, no emulation, no resize. Every label is read until two
 * reads A11Y_GAP apart agree within 0.02 (A11Y_READS at most); one that never
 * agrees is a loop and is reported at its WORST read. A failing number is never
 * swapped for a viewport re-read; only a flat crop is re-taken. A resize seen
 * mid-run aborts the run (exit 69).
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
  // 🚨 THE FAR MODE IS NOT ALWAYS THE INK, and a rotated face is where that
  // shows. 149's hovered floor fills 87.6% of its label crop at #b4b4b4 with
  // the glyphs at 2.7% (#121212) — and 5.7% of the crop is the CARD, seen past
  // a face that is 102px wide inside a 98.6px button. White is farther from the
  // plate than the ink is, so «farthest luminance holding 1%» took the card and
  // reported 2.07:1 for a label measuring 8.9:1. So the ink is named rather
  // than guessed: inks holds the luminance of every colour the browser says is
  // painted on text inside this button, and the far mode is chosen from the
  // bins that match one of them. ⚠️ NOT WHERE THE LABEL IS BLENDED — under
  // difference or hard-light (137) the computed colour is a constant and the
  // rendered glyph is |ground − constant|, so inkOf() returns nothing there and
  // the old rule stands, which is the rule that reads a blend correctly.
  // A label that really has gone invisible still fails: its ink bin IS the
  // plate bin, so the restricted pick returns ~1:1 exactly as before.
  A.textVsBg = (img, inks) => {
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
    const near = k => !inks || !inks.length ||
      inks.some(L => Math.abs(k - Math.round(L * 100)) <= 3)
    for (let pass = 0; pass < 2; pass++) {
      for (let k = 0; k <= 100; k++) {
        if (cnt[k] < floor) continue
        if (!pass && !near(k)) continue
        const dist = Math.abs(k - bgK)
        if (dist > best) { best = dist; txK = k }
      }
      if (best) break                    // nothing matched an ink: old rule
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

  // Every colour the browser paints text in, inside this button. A blend
  // anywhere over the glyphs means the painted colour is not this one, so the
  // list comes back empty and textVsBg keeps its own rule.
  A.inkOf = b => {
    const out = new Set()
    const w = document.createTreeWalker(b, NodeFilter.SHOW_TEXT)
    for (let t = w.nextNode(); t; t = w.nextNode()) {
      if (!t.nodeValue.trim()) continue
      for (let e = t.parentElement; e && e !== b.parentElement; e = e.parentElement) {
        const cs = getComputedStyle(e)
        if (cs.mixBlendMode !== 'normal') return []
      }
      const m = (getComputedStyle(t.parentElement).color || '').match(/[\d.]+/g)
      if (m) out.add(+A.lum(+m[0], +m[1], +m[2]).toFixed(4))
    }
    return [...out]
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
               lbl: A.textRect(b), ink: A.inkOf(b) }
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
  A.cropRead = async (b64, page, dpr, inks) => {
    const x = page.x - scrollX, y = page.y - scrollY
    if (y < 0 || y + page.h > innerHeight || x < 0 || x + page.w > innerWidth) return null
    const bmp = await createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob())
    const w = Math.max(1, Math.round(page.w * dpr)), h = Math.max(1, Math.round(page.h * dpr))
    const cv = new OffscreenCanvas(w, h)
    const cx = cv.getContext('2d', { willReadFrequently: true })
    cx.drawImage(bmp, Math.round(x * dpr), Math.round(y * dpr), w, h, 0, 0, w, h)
    return A.textVsBg(cx.getImageData(0, 0, w, h), inks)
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
  // Where the viewport is, for bring(). And the tripwire: nothing this tool
  // does resizes the page any more, so a real resize seen mid-run means a
  // capture path that emulates the viewport has come back. The page dispatches
  // synthetic resize events of its own, so it is the SIZE that is compared.
  A.view = () => JSON.stringify({ sx: scrollX, sy: scrollY, iw: innerWidth, ih: innerHeight })
  A.size0 = [innerWidth, innerHeight]; A.resized = 0
  addEventListener('resize', () => {
    if (innerWidth !== A.size0[0] || innerHeight !== A.size0[1]) A.resized++ })

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
const GAP    = Number(process.env.A11Y_GAP || 120)      // between two reads of one label
const READS  = Number(process.env.A11Y_READS || 8)      // reads of one label before it is called a loop
const sleep  = ms => new Promise(r => setTimeout(r, ms))
const THEMES   = (process.env.A11Y_THEMES   ?? 'dark,light').split(',')
// THREE, NOT FOUR -- the same correction the toolbar already made. The leading
// '' measured the page with no treatment pressed and printed it as «built»,
// which reads as a fourth category beside fill/outline/link. It is not one:
// the version axis has three, and «no treatment» is the absence of the
// question rather than an answer to it. Every study is already measured in
// the version it natively ships, because a study that offers nothing else
// stays put when a treatment is applied. So the pass added a row and no
// coverage. Overridable for a one-off (A11Y_VERSIONS=',fill' still works);
// the ring pass below still clears the treatment, because that is a geometry
// baseline and not a category anyone reports.
const VERSIONS = (process.env.A11Y_VERSIONS ?? 'fill,outline,link').split(',')
const LIMIT    = Number(process.env.A11Y_LIMIT || 0)     // first N buttons, for a smoke run
const PALETTE  = process.env.A11Y_PALETTE || ''          // '' = the page as it ships

const p = await open()
await p.send('Page.navigate', { url: `http://127.0.0.1:${p.port}/` })
await new Promise(r => setTimeout(r, 1200))
await p.evalJs(`new Promise(r => document.fonts.ready.then(() => setTimeout(r, 600)))`)
await p.evalJs(KIT)

// Windows High Contrast, as the platform reports it to CSS. Every study here
// states hover and press with background, box-shadow or a pseudo-element, and
// forced-colors replaces all three with a system colour — so the question is
// not whether the CSS is there, it is whether anything still CHANGES.
if (process.env.A11Y_FORCED) {
  await p.send('Emulation.setEmulatedMedia', { features: [
    { name: 'forced-colors', value: 'active' },
    { name: 'prefers-color-scheme', value: 'dark' }] })
  await new Promise(r => setTimeout(r, 800))
  console.error('[a11y] forced-colors: active')
}

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

/* ---- motion mode ------------------------------------------------------- */
// 2.2.2 asks that anything which starts moving on its own and runs past five
// seconds can be stopped. An infinite CSS animation that is still `running`
// under prefers-reduced-motion:reduce is exactly that, and it cannot be found
// by grepping for the media query — a study can carry a reduce block that
// misses one of its three loops. So: ask the animation timeline.
if (process.env.A11Y_MODE === 'motion') {
  const probe = async label => {
    await new Promise(r => setTimeout(r, 1200))
    const v = await p.evalJs(`(() => {
      const rows = []
      for (const a of document.getAnimations()) {
        const t = a.effect && a.effect.getTiming ? a.effect.getTiming() : {}
        const el = a.effect && a.effect.target
        if (!el || !el.closest) continue
        const card = el.closest('.spec')
        if (!card) continue
        const num = (card.querySelector('.num') || {}).textContent || '?'
        const h3 = card.querySelector('h3')
        rows.push({ num: +num,
          title: h3 ? h3.textContent.replace(num, '').trim() : '?',
          name: a.animationName || (a.transitionProperty ? 'transition:' + a.transitionProperty : a.constructor.name),
          state: a.playState, inf: t.iterations === Infinity,
          dur: Math.round(t.duration || 0) })
      }
      return JSON.stringify(rows)
    })()`)
    return { label, rows: JSON.parse(v) }
  }
  await p.send('Emulation.setEmulatedMedia',
    { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] })
  const free = await probe('no-preference')
  await p.send('Emulation.setEmulatedMedia',
    { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  const red = await probe('reduce')
  await p.close()
  const key = r => r.num + '|' + r.name
  const survivors = red.rows.filter(r => r.inf && r.state === 'running')
  console.log('animations running, no-preference:', free.rows.filter(r => r.state === 'running').length,
    '(of which infinite:', free.rows.filter(r => r.inf).length + ')')
  console.log('animations running, reduce:      ', red.rows.filter(r => r.state === 'running').length,
    '(of which infinite:', red.rows.filter(r => r.inf).length + ')')
  console.log('\nINFINITE and still running under reduce:')
  const by = new Map()
  for (const r of survivors) {
    const k = r.num + ' ' + r.title
    by.set(k, (by.get(k) || new Set()).add(r.name + ' ' + r.dur + 'ms'))
  }
  if (!by.size) console.log('  none')
  for (const [k, v] of [...by].sort((a, b) => a[0].localeCompare(b[0])))
    console.log('  ' + k + ' -> ' + [...v].join(', '))
  process.exit(0)
}
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

// A palette, for the runs that need one. The harvest measures the page as it
// ships, and every number it has ever printed is Graphite — which is the one
// palette where --ink-on-fill and --on-ink-hover resolve to the SAME colour, so
// the whole class of «label fitted against the wrong plate» is invisible to it
// by construction. Card 140 sat at 1.19:1 for a week behind exactly that.
// Off by default: this changes what is being measured, not how.
async function setPalette (name) {
  if (!name) return
  await p.evalJs(`(() => {
    const b = [...document.querySelectorAll('.set-p')]
      .find(x => x.textContent.trim().split(/\s|—/)[0] === ${JSON.stringify(name)})
    if (!b) throw new Error('no palette ' + ${JSON.stringify(name)})
    if (b.getAttribute('aria-pressed') !== 'true') b.click()
    return true })()`)
  await new Promise(r => setTimeout(r, 500))
}

async function setTheme (t) {
  await p.evalJs(`(() => { const b = document.querySelector('#v-theme .vers-b[data-theme="${t}"]');
    if (!b) throw new Error('no theme control for ${t}'); b.click(); return true })()`)
  await new Promise(r => setTimeout(r, 500))
}
// AS BUILT IS NOT A BUTTON. The treatment control is three independent toggles
// whose answer can be none, and it clears by pressing the pressed one — so ''
// means «press whatever is on», and nothing pressed is already as built rather
// than a missing control. This asked for [data-v=""], which stopped existing
// when the fourth button came out, and the throw landed AFTER the six label
// passes had printed: the run looked like it had worked, the ring was never
// measured, and OUT was never written. A harvest that reports and then dies is
// worse than one that dies first, so the '' case cannot fail on absence.
async function setVersion (v) {
  await p.evalJs(`(() => {
    const seg = document.querySelector('#v-treat')
    if (!seg) throw new Error('no treatment control on the page')
    if ('${v}' === '') {
      const on = seg.querySelector('.vers-b[aria-pressed="true"]')
      if (on) on.click()
      return true
    }
    const b = seg.querySelector('.vers-b[data-v="${v}"]')
    if (!b) throw new Error('no version control for ${v}')
    // Idempotent, because pickTreat() reads as a TOGGLE: clicking the pressed
    // one sets vTreat back to '' rather than re-selecting it. Asking twice for
    // the version already on would therefore measure the run as built and
    // label the numbers with a treatment that was not applied. Latent in the
    // current sweep, which never repeats a version back to back -- but the
    // caller should not have to know that to be correct.
    if (b.getAttribute('aria-pressed') !== 'true') b.click()
    return true })()`)
  await new Promise(r => setTimeout(r, 700))
}

const results = []   // one row per theme x version x state
const rings   = []   // one row per theme

// The two boxes every crop is cut to. The label rect padded by a pixel each
// way, floored at 6px tall so a one-line label still yields a histogram; and
// the plate with 10px of its ground, which is where hover and focus show.
const lblBox  = r => ({ x: r.lbl.x - 1, y: r.lbl.y - 1,
  w: Math.max(4, Math.round(r.lbl.w) + 2), h: Math.max(6, Math.round(r.lbl.h) + 2) })
const ringBox = r => ({ x: r.btn.x - 10, y: r.btn.y - 10,
  w: Math.round(r.btn.w) + 20, h: Math.round(r.btn.h) + 20 })
const boxOf = kind => kind === 'ring' ? ringBox : lblBox

// One crop, of a rect that bring() has already put ON SCREEN. The clip is in
// PAGE coordinates (a clip of a rect off screen comes back as flat page ground,
// which blind() catches rather than reads). captureBeyondViewport is false and
// stays false: see the header. It is the path that resized the page under
// every capture and slid the inspector back over the studies.
async function clip (bx) {
  try {
    const s = await p.send('Page.captureScreenshot', { format: 'png',
      clip: { x: bx.x, y: bx.y, width: bx.w, height: bx.h, scale: 2 },
      captureBeyondViewport: false, fromSurface: true, optimizeForSpeed: true })
    return s.result?.data || null
  } catch { return null }
}

// The top 80px of the viewport is where the page keeps its fixed chrome — the
// masthead and both panel handles sit at y 24..58 — so no crop is taken there.
const VIEW_TOP = 80, VIEW_BOT = 16
const onScreen = (bx, v) => bx.y - v.sy >= VIEW_TOP && bx.y + bx.h - v.sy <= v.ih - VIEW_BOT
  && bx.x - v.sx >= 0 && bx.x + bx.w - v.sx <= v.iw
const view = async () => JSON.parse(await p.evalJs('window.__a11y.view()'))
// Scroll only when the rect is not already on screen, and then put it at the
// top of the usable band, so the rects after it in page order ride along in
// the same viewport. Returns the viewport, or null if the rect cannot be shown.
async function bring (bx) {
  let v = await view()
  if (onScreen(bx, v)) return v
  await p.evalJs(`window.scrollTo({ top: ${Math.max(0, Math.round(bx.y - VIEW_TOP - 8))}, left: 0, behavior: 'instant' })`)
  await p.evalJs('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))')
  v = await view()
  if (onScreen(bx, v)) return v
  await p.evalJs(`window.__a11y.into(${Math.round(bx.y + bx.h / 2)})`)
  await p.evalJs('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))')
  v = await view()
  return onScreen(bx, v) ? v : null
}

// The ratio off the two luminances rather than the 2dp field beside them, for
// the agreement test only: two reads 0.004 apart can round 0.01 apart.
const exact = v => v ? (Math.max(v.tx, v.bg) + 0.05) / (Math.min(v.tx, v.bg) + 0.05) : null
// Two reads of one label agree. Two flat crops agree too: a flat crop twice is
// a flat crop, and blind() decides what that means, not this.
const agree = (a, b) => !!a && !!b
  && (blind(a) && blind(b) || !blind(a) && !blind(b) && Math.abs(exact(a) - exact(b)) <= 0.02)

// Every shipped button, captured on screen and held still. A band is the run
// of rects one viewport can show; each round freezes the page, crops every
// rect still pending in the band, and thaws; a rect is done when two rounds
// GAP apart agree. One crop under a freeze that followed a fixed sleep was a
// guess about when a transition had ended.
//   settle 'lbl'  — the label box of rects[i], read with textVsBg; agreement is
//                   the two ratios within 0.02. A label that never agrees in
//                   READS rounds is a loop, not a transition: it is reported
//                   at the WORST read seen and counted, because a gate has to
//                   answer for the frame a visitor can land on.
//   settle 'ring' — the plate box of rects[i], compared as pixels; agreement is
//                   no visible change between the two (the ring pass's own
//                   0.002). A loop keeps its last crop.
// `extras` are further crops of the same buttons — [{ rects, kind }] — taken
// ONCE per band after the band has settled, in the same viewport: the rest-rect
// label under hover, and the plate crops the inert-hover diff compares.
// Returns per index: val (label reading), b64 (the settled crop), loose,
// reads, and extra[k] (the k-th extra crop).
async function capture (rects, settle, extras = []) {
  const n = rects.length, kinds = [{ rects, kind: settle }, ...extras]
  const val = new Array(n).fill(null), b64 = new Array(n).fill(null)
  const reads = new Array(n).fill(0), loose = new Array(n).fill(false)
  const extra = extras.map(() => new Array(n).fill(null))
  const outer = i => {
    const bs = kinds.map(k => boxOf(k.kind)(k.rects[i]))
    const x = Math.min(...bs.map(b => b.x)), y = Math.min(...bs.map(b => b.y))
    return { x, y, w: Math.max(...bs.map(b => b.x + b.w)) - x, h: Math.max(...bs.map(b => b.y + b.h)) - y }
  }
  const todo = rects.map((r, i) => i).filter(i => rects[i].shipped).sort((a, b) => outer(a).y - outer(b).y)
  for (let k = 0; k < todo.length;) {
    const v = await bring(outer(todo[k]))
    if (!v) { k++; continue }                 // cannot be shown: stays null, counted
    const band = []
    while (k < todo.length && onScreen(outer(todo[k]), v)) band.push(todo[k++])
    const hist = new Map(band.map(i => [i, []]))
    let pending = band
    for (let r = 0; r < READS && pending.length; r++) {
      if (r) await sleep(GAP)
      await p.evalJs('window.__a11y.freeze()')
      const got = []
      for (const i of pending) got.push(await clip(boxOf(settle)(rects[i])))
      await p.evalJs('window.__a11y.thaw()')
      const vals = settle === 'lbl'
        ? await read(got, pending.map(i => rects[i].ink)) : null
      const same = settle === 'ring'
        ? await diff(pending.map(i => hist.get(i).at(-1)?.b ?? null), got) : null
      pending = pending.filter((i, j) => {
        const h = hist.get(i), prev = h.at(-1)
        h.push({ b: got[j], v: vals ? vals[j] : null }); reads[i]++
        const ok = prev && (settle === 'lbl' ? agree(prev.v, vals[j])
          : !!(prev.b && got[j] && same[j] && same[j].moved < 0.002))
        if (ok) { b64[i] = got[j]; val[i] = vals ? vals[j] : null; return false }
        return true
      })
    }
    for (const i of pending) {
      const h = hist.get(i)
      loose[i] = true
      const seen = settle === 'lbl' ? h.filter(x => x.v && !blind(x.v)) : []
      const pick = seen.length ? seen.reduce((a, b) => exact(b.v) < exact(a.v) ? b : a) : h.at(-1)
      b64[i] = pick.b; val[i] = pick.v
    }
    if (extras.length) {
      await p.evalJs('window.__a11y.freeze()')
      for (const i of band) for (let e = 0; e < extras.length; e++)
        extra[e][i] = await clip(boxOf(extras[e].kind)(extras[e].rects[i]))
      await p.evalJs('window.__a11y.thaw()')
    }
  }
  return { val, b64, reads, loose, extra }
}

// A crop that comes back flat has no glyph in it, and two different things land
// here. One is a fault the tool can fix: a capture that failed, which repair()
// scrolls to and asks again. The other is a button that is genuinely NOT PAINTED
// at that rect — masked, clipped or faded away, which card 133 does to five of
// its chips on purpose and 65 does to the segment moving under the pointer.
// Reporting the second as 1:1 is how 133's mask has been carried as twenty
// contrast failures. Not measurable is not the same as unreadable, so it is
// counted and named separately rather than folded into the verdict.
const blind = v => !!v && v.bgShare >= 0.999 && v.sd <= 0.002

// ✅ AND A THIRD KIND, CLOSED 2026-09-01 — the note it replaces is kept below
// because the symptom is worth recognising again. captureBeyondViewport hands back
// blank surface — which is WHITE — for part of a clip a long way down a
// 40,000px page. The crop is then part real and part nothing, so it is not flat
// and repair() never looks at it, and the histogram takes the plate as its
// modal bin and the blank as the far one: plate-against-blank, reported as
// label-against-plate. Measured 2026-09-01 with a picked colour in light: ten
// studies whose labels are 6.11:1 came back as 3.07, which is exactly
// #00aa46-against-white. It does not show on the default palette, where
// plate-against-white is either far above the floor or caught by blind().
// 🔑 WHAT THE SURFACE IS ACTUALLY DOING: Page.captureScreenshot's own `clip` is
// the broken part, not the scrolling. Clipped in viewport coordinates it returns
// blank for anything below the fold in this headless build — which is why the
// earlier attempt turned nine crops flat and read as trading one artefact for
// another — and captureBeyondViewport is only ever reached for because the clip
// cannot be trusted. An UNCLIPPED viewport capture is neither, and the rectangle
// is cut out of it in the page (A.cropRead). Confirmed against this tool's own
// numbers: 143 in dark/outline reads 14.21 rest / 14.19 hover either way.
//
// ⚠️ SUPERSEDED 2026-09-11, and the paragraph above is only half right. What
// came back blank was a clip taken of a rect that was NOT ON SCREEN; a clip in
// page coordinates of a rect bring() has scrolled into view is the surface as
// painted, and that is now the only way a crop is taken (capture). And the
// rule that used to follow here — every reading under the floor re-taken down
// the viewport path and REPLACED by it — is gone, for three measured reasons.
// Each re-read scrolled, and moving the scroll is what put the sliding
// inspector over a new band of studies for every crop that came after it. The
// two paths do not resolve the same: the clip rasterises at scale 2 on a 2x
// surface, the viewport is the 2x surface itself, and across 1,232 cells
// compared in version-sweep they differ by up to 0.035 at the floor — enough
// to turn a real 4.4995 into a 4.50 pass. And a rule that only ever looks at
// failures can never catch a false PASS, which is the fault this one hid.
// So only a FLAT crop is re-taken, and replaced only if that one sees a glyph.
async function repair (rects, b64s, vals, kind) {
  let n = 0
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i], v = vals[i]
    if (!r.shipped || r.lbl.noText) continue
    if (v && !blind(v)) continue
    const re = await viewportRead(r, kind)
    if (re && !blind(re)) { vals[i] = re; n++ }
  }
  return n
}

// One rect, read off an UNCLIPPED viewport capture. Scroll it into view, hold
// every animation for the length of the shot exactly as the main pass does, and
// cut the rectangle out in the page against the live scroll.
async function viewportRead (r, kind) {
  const box = kind === 'ring'
    ? { x: r.btn.x - 10, y: r.btn.y - 10, w: Math.round(r.btn.w) + 20, h: Math.round(r.btn.h) + 20 }
    : { x: r.lbl.x - 1,  y: r.lbl.y - 1,  w: Math.max(4, Math.round(r.lbl.w) + 2),
        h: Math.max(6, Math.round(r.lbl.h) + 2) }
  await p.evalJs(`window.__a11y.into(${Math.round(box.y + box.h / 2)})`)
  // Two frames, not one: this page is 940KB of interleaved CSS and the surface
  // is still the old scroll position for longer than a 120ms guess allows.
  await p.evalJs('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))')
  await new Promise(t => setTimeout(t, 260))
  await p.evalJs('window.__a11y.freeze()')
  let shot
  try {
    shot = await p.send('Page.captureScreenshot',
      { format: 'png', fromSurface: true, optimizeForSpeed: true })
  } catch (e) { await p.evalJs('window.__a11y.thaw()'); return null }
  await p.evalJs('window.__a11y.thaw()')
  const b64 = shot.result?.data
  if (!b64) return null
  const v = await p.evalJs(`(async () => JSON.stringify(await window.__a11y.cropRead(
    ${JSON.stringify(b64)}, ${JSON.stringify(box)}, window.__a11y.dpr(),
    ${JSON.stringify(kind === 'lbl' ? (r.ink || []) : [])})))()`)
  return v && v !== 'null' ? JSON.parse(v) : null
}
async function read (b64s, inks = []) {
  const out = []
  for (let i = 0; i < b64s.length; i++) {
    const b = b64s[i]
    if (!b) { out.push(null); continue }
    const v = await p.evalJs(`(async () => JSON.stringify(
      window.__a11y.textVsBg(await window.__a11y.pixels(${JSON.stringify(b)}),
        ${JSON.stringify(inks[i] || [])})))()`)
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

// Nothing this tool does resizes the page any more. A resize seen mid-run
// means every number since was measured on a page that had just been re-laid
// out at another size — the false-pass fault this was rebuilt to remove — so
// the run stops rather than print them.
async function tripwire (where) {
  const n = await p.evalJs('window.__a11y.resized')
  if (!n) return
  await p.close()
  console.error(`[a11y] ABORT — the page was resized ${n}x by the end of ${where}.`)
  console.error('       Every capture since was taken on a page re-laid-out at another size, which')
  console.error('       is the false-pass fault this tool was rebuilt to remove. Find the resize.')
  process.exit(69)
}

for (const theme of THEMES) {
  await setTheme(theme)
  await setPalette(PALETTE)
  for (const version of VERSIONS) {
    await setVersion(version)
    const ids = await nodeIds()
    await force(ids, []); await new Promise(r => setTimeout(r, 350))
    let rects = await p.evalJs('JSON.stringify(window.__a11y.rects())').then(JSON.parse)
    if (LIMIT) rects = rects.slice(0, LIMIT)
    // Rest: every label read on screen until it holds still, and the plate plus
    // its ground cropped once per band after that — the «off» half of the
    // inert-hover diff. It used to be re-taken after hover was released and
    // another SETTLE had passed; the rest before hover is the same state, and
    // the cleaner one.
    const R = await capture(rects, 'lbl', [{ rects, kind: 'ring' }])
    const rest = R.val, restShots = R.b64, plateOff = R.extra[0]
    const fixR = await repair(rects, restShots, rest, 'lbl')
    await force(ids, ['hover']); await new Promise(r => setTimeout(r, SETTLE))
    // Two hover crops, because half these studies MOVE the label. The rest-rect
    // crop answers "did this region change" — the diff. The hover-rect crop
    // answers "what is the contrast now". Reading the second question off the
    // first rect is how card 43 came back with no label at all: the keycap had
    // translated out of the box the rect was taken from.
    // The label box is too narrow to decide whether hover did anything: a study
    // that lights its edge or walks its mark leaves the label untouched and
    // would read as inert. The plate plus ten pixels of ground is the question,
    // so that is the second extra crop — at the REST rect, one region in two
    // states, in the same viewport as the reading.
    let hovRects = await p.evalJs('JSON.stringify(window.__a11y.rects())').then(JSON.parse)
    if (LIMIT) hovRects = hovRects.slice(0, LIMIT)
    const H = await capture(hovRects, 'lbl', [{ rects, kind: 'lbl' }, { rects, kind: 'ring' }])
    const hover = H.val, hovShots = H.b64, hovAtRest = H.extra[0], plateRest = H.extra[1]
    const fixH = await repair(hovRects, hovShots, hover, 'lbl')
    await force(ids, [])
    const moved = await diff(restShots, hovAtRest)
    const plateMoved = await diff(plateOff, plateRest)
    await tripwire(`${theme}/${version || 'built'}`)
    results.push({ theme, version, rects, hovRects, rest, hover, moved, plateMoved,
      blind: { rest: rest.map(blind), hover: hover.map(blind) },
      reads: { rest: R.reads, hover: H.reads }, loose: { rest: R.loose, hover: H.loose } })
    const ship = rects.filter(r => r.shipped).length
    const u = a => a.filter((x, i) =>
      x && !rects[i].lbl.noText && !blind(x) && x.ratio < 4.5).length
    const nb = a => a.filter((x, i) => x && !rects[i].lbl.noText && blind(x)).length
    const blindR = nb(rest), blindH = nb(hover)
    const inert = moved.filter(m => m && m.moved < 0.005).length
    // Counted, not folded in: a loop is reported at its worst read (see
    // capture), and a shipped label with no reading at all was never on screen.
    const lp = a => a.filter((x, i) => x && rects[i].shipped && !rects[i].lbl.noText).length
    const looseN = lp(R.loose) + lp(H.loose)
    const lost = rects.filter((r, i) => r.shipped && !r.lbl.noText && !rest[i]).length
      + hovRects.filter((r, i) => r.shipped && !r.lbl.noText && !hover[i]).length
    console.error(`[a11y] ${theme}/${version || 'built'}: ${ship}/${rects.length} shipped`
      + ` | under 4.5:1 — rest ${u(rest)}, hover ${u(hover)}`
      + ` | css-hover inert ${plateMoved.filter(m => m && m.moved < 0.005).length}`
      + `/${plateMoved.filter(Boolean).length} (plate), ${inert} (label)`
      + ` | recaptured ${fixR}+${fixH}`
      + (blindR + blindH
          ? ` | NOT MEASURABLE (no glyph in the crop) ${blindR}+${blindH}`
          : '')
      + (looseN ? ` | never held still ${looseN}` : '')
      + (lost ? ` | NOT CAPTURED ${lost}` : ''))
  }
}

// The ring, as-built, both themes: the declared outline plus a pixel diff of
// the plate and 10px of its ground, focused against not.
await setVersion('')
for (const theme of THEMES) {
  await setTheme(theme)
  await setPalette(PALETTE)
  const ids = await nodeIds()
  let rects = await p.evalJs('JSON.stringify(window.__a11y.rects())').then(JSON.parse)
  if (LIMIT) rects = rects.slice(0, LIMIT)
  await force(ids, []); await new Promise(r => setTimeout(r, 350))
  // Both halves on screen and held still, the same as every label: a crop is
  // done when two in a row show no visible change against each other.
  const off = (await capture(rects, 'ring')).b64
  await force(ids, ['focus-visible']); await new Promise(r => setTimeout(r, 500))
  // The ring crop keeps the REST rect on purpose: 10px of ground either side is
  // enough to hold a plate that shifts, and the diff needs one frame of
  // reference. A moved plate is itself a visible focus change.
  const on = (await capture(rects, 'ring')).b64
  const declared = await p.evalJs('JSON.stringify(window.__a11y.ring())').then(JSON.parse)
  const changed = await diff(off, on)
  await force(ids, [])
  await tripwire(`ring/${theme}`)
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
