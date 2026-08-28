#!/usr/bin/env node
/**
 * Sync every study on this page to a code file in a Framer project, and write
 * the resulting module URLs back into index.html.
 *
 * Why it works at all: a Framer code file gets a public framer.com/m/ module
 * URL the moment it exists — no publishing, no marketplace, no account on the
 * other end. Paste that URL onto any Framer canvas and the component arrives
 * already built, as a remote module; nothing is copied into the recipient's
 * project. We store the versionless form of the URL, because Framer resolves
 * it at paste time and pins the instance to the version it found. So editing a
 * study reaches the next person who pastes it, and can never change a button
 * somebody has already placed.
 *
 *   node tools/sync-framer.mjs --session <id>          # full run
 *   node tools/sync-framer.mjs --session <id> --dry    # harvest only, no writes
 *
 * Get <id> from `npx @framer/agent@latest session new "<project url>"`. The
 * project is whatever that session points at, so no project id lives in here.
 *
 * The generated code is never written by hand: it comes from clicking this
 * page's own "copy as Framer component" button in a headless browser, with the
 * clipboard stubbed. That guarantees the hosted component and the code a
 * visitor copies are the same bytes — there is no second implementation to
 * drift.
 */
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawn, execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const INDEX = path.join(ROOT, 'index.html')
const MANIFEST = path.join(ROOT, 'framer-components.json')
const args = process.argv.slice(2)
const SESSION = args[args.indexOf('--session') + 1]
const DRY = args.includes('--dry')
if (!DRY && (!SESSION || SESSION.startsWith('--'))) {
  console.error('usage: node tools/sync-framer.mjs --session <id> [--dry]')
  process.exit(1)
}
const say = (...m) => console.error('·', ...m)

/* ---- 1. a browser ------------------------------------------------------ */
// chrome-headless-shell ships with Playwright; a full Chrome works too. The
// cache holds several versions, so take the newest rather than pinning one.
function findChrome () {
  if (process.env.CHROME) return process.env.CHROME
  const cache = path.join(process.env.HOME, 'Library/Caches/ms-playwright')
  const shells = fs.existsSync(cache)
    ? fs.readdirSync(cache).filter(d => d.startsWith('chromium_headless_shell-')).sort()
    : []
  for (const d of shells.reverse()) {
    for (const arch of ['mac-arm64', 'mac-x64', 'linux64']) {
      const p = path.join(cache, d, `chrome-headless-shell-${arch}`, 'chrome-headless-shell')
      if (fs.existsSync(p)) return p
    }
  }
  for (const p of ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
                   '/usr/bin/google-chrome', '/usr/bin/chromium']) {
    if (fs.existsSync(p)) return p
  }
  throw new Error('no Chrome found — set CHROME=/path/to/chrome')
}

/* ---- 2. harvest -------------------------------------------------------- */
// The page is served over http rather than opened as a file:// URL so the
// linked Graphite Console stylesheet loads the way it does in production; the
// copied token values are read from computed style and would otherwise fall
// back to the inlined copy in <head>.
async function harvest () {
  const html = fs.readFileSync(INDEX, 'utf8')
  const server = http.createServer((_, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(html)
  })
  await new Promise(r => server.listen(0, '127.0.0.1', r))
  const pageUrl = `http://127.0.0.1:${server.address().port}/`

  const port = 9200 + Math.floor(process.pid % 500)
  const profile = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'bhl-'))
  const chrome = spawn(findChrome(), ['--headless', '--disable-gpu', '--no-sandbox',
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'],
    { stdio: 'ignore' })

  let targets
  for (let i = 0; i < 60; i++) {
    try { targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); break }
    catch { await new Promise(r => setTimeout(r, 250)) }
  }
  const target = targets?.find(t => t.type === 'page')
  if (!target) throw new Error('devtools never came up')

  const ws = new WebSocket(target.webSocketDebuggerUrl)
  let id = 0
  const pending = new Map()
  const seen = new Set()
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data)
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
    else if (m.method) seen.add(m.method)
  })
  await new Promise(r => ws.addEventListener('open', r))
  const send = (method, params = {}) => new Promise(res => {
    const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params }))
  })
  const evalJs = async expression => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    const ex = r.result?.exceptionDetails
    if (ex) throw new Error(JSON.stringify(ex).slice(0, 600))
    return r.result.result.value
  }

  await send('Page.enable'); await send('Runtime.enable')
  await send('Page.navigate', { url: pageUrl })
  for (let i = 0; i < 120 && !seen.has('Page.loadEventFired'); i++) await new Promise(r => setTimeout(r, 100))
  await new Promise(r => setTimeout(r, 1500))   // let the linked token sheet land

  // The copy button is the only generator. Stub the clipboard and press it.
  const n = await evalJs(`(() => {
    const cap = { v: null }
    const stub = { writeText: t => { cap.v = t; return Promise.resolve() } }
    try { Object.defineProperty(navigator, 'clipboard', { value: stub, configurable: true }) }
    catch (e) { navigator.clipboard.writeText = stub.writeText }
    window.__cap = cap
    window.__cards = [...document.querySelectorAll('.spec')].filter(c => c.querySelector('.copy--fr'))
    return window.__cards.length
  })()`)
  say(`harvesting ${n} studies`)

  const out = []
  for (let i = 0; i < n; i++) {
    const rec = JSON.parse(await evalJs(`(async () => {
      const card = window.__cards[${i}]
      const num = (card.querySelector('.num') || {}).textContent.trim()
      const name = (card.querySelector('h3') || {}).textContent.replace(num, '').trim()
      window.__cap.v = null
      // altKey defaults false, so this is the URL path — which is exactly why
      // it must fall through to the code file while the map is still empty.
      card.querySelector('.copy--fr').dispatchEvent(new MouseEvent('click', { altKey: true }))
      await new Promise(r => setTimeout(r, 0))
      return JSON.stringify({ num, name, code: window.__cap.v })
    })()`))
    if (!rec.code) throw new Error(`study ${rec.num} “${rec.name}” produced nothing`)
    const m = rec.code.match(/export default function ([A-Za-z0-9_]+)/)
    if (!m) throw new Error(`study ${rec.num} has no default export`)
    out.push({ ...rec, comp: m[1], file: m[1] + '.tsx',
               hash: crypto.createHash('sha256').update(rec.code).digest('hex').slice(0, 16) })
  }

  ws.close(); chrome.kill(); server.close()
  // Chrome flushes its profile on the way out; removing it from under the
  // process races that and throws ENOTEMPTY. The directory is disposable.
  await new Promise(r => chrome.once("exit", r) && setTimeout(r, 3000))
  try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}

  const dupes = out.map(o => o.file).filter((f, i, a) => a.indexOf(f) !== i)
  if (dupes.length) throw new Error(`two studies want the same file name: ${dupes.join(', ')}`)
  return out
}

/* ---- 3. push to Framer ------------------------------------------------- */
// One exec call for the whole set. It skips anything whose content hash has
// not moved, so a re-run after a new study only touches that study — and the
// URLs of everything else stay exactly as published.
function sync (payload) {
  fs.writeFileSync('/tmp/bhl-payload.json', JSON.stringify(payload))
  const script = `
const fs = require("fs")
const payload = JSON.parse(fs.readFileSync("/tmp/bhl-payload.json", "utf8"))
let manifest = []
try { manifest = JSON.parse(fs.readFileSync("/tmp/bhl-manifest.json", "utf8")) } catch (e) {}
const done = new Map(manifest.map(m => [m.file, m]))
const byName = new Map((await framer.getCodeFiles()).map(f => [f.name, f]))
let created = 0, updated = 0, skipped = 0
for (const p of payload) {
  if (done.get(p.file) && done.get(p.file).hash === p.hash) { skipped++; continue }
  let f = byName.get(p.file)
  if (f) { await f.setFileContent(p.code); updated++ }
  else { f = await framer.createCodeFile(p.file, p.code); byName.set(p.file, f); created++ }
  const fresh = (await framer.getCodeFiles()).find(x => x.name === p.file)
  const exp = (fresh.exports || []).find(e => e.isDefaultExport)
  if (!exp || !exp.insertURL) throw new Error("no insert URL for " + p.file)
  const rec = { num: p.num, name: p.name, comp: p.comp, file: p.file, hash: p.hash,
                id: fresh.id, url: exp.insertURL.split("@")[0] }
  const at = manifest.findIndex(m => m.file === p.file)
  if (at >= 0) manifest[at] = rec; else manifest.push(rec)
  fs.writeFileSync("/tmp/bhl-manifest.json", JSON.stringify(manifest))
}
// A file in the project that no study claims any more: reported, never
// deleted. Its URL may already be pasted into somebody's site.
//
// It does have to stop claiming a card NUMBER, though. Numbers are reused the
// moment the sections are reordered, so a retired study goes on holding, say,
// "07" while a live one is issued the same number — and since the URL map is
// keyed by number, whichever is written last silently takes the other's place.
// Marking them here is what keeps the map free of that; the entry, the code
// file and the published URL all stay exactly where they are.
const claimed = new Set(payload.map(p => p.file))
const orphans = (await framer.getCodeFiles()).map(f => f.name).filter(n => !claimed.has(n))
for (const m of manifest) { if (claimed.has(m.file)) delete m.retired; else m.retired = true }
manifest.sort((a, b) => a.num.localeCompare(b.num))
fs.writeFileSync("/tmp/bhl-manifest.json", JSON.stringify(manifest, null, 2))
console.log(JSON.stringify({ created, updated, skipped, orphans }))
`
  const out = execFileSync('npx', ['@framer/agent@latest', 'exec', '-s', SESSION], {
    input: script, encoding: 'utf8', maxBuffer: 1 << 28
  })
  const line = out.trim().split('\n').filter(l => l.startsWith('{')).pop()
  if (!line) throw new Error('framer exec returned nothing usable:\n' + out.slice(-800))
  return { stats: JSON.parse(line), manifest: JSON.parse(fs.readFileSync('/tmp/bhl-manifest.json', 'utf8')) }
}

/* ---- 4. write the map back into the page ------------------------------- */
function inject (manifest) {
  // Built as text rather than via an object literal: JS hoists integer-like
  // keys, which would print 10-79 ahead of 01-09 and make this generated block
  // needlessly hard to read in a diff.
  const rows = manifest.filter(m => !m.retired).sort((a, b) => a.num.localeCompare(b.num))
  const dupes = rows.map(m => m.num).filter((n, i, a) => a.indexOf(n) !== i)
  if (dupes.length) throw new Error(`two studies claim the same number: ${dupes.join(', ')}`)
  const map = "{" + rows.map(m => JSON.stringify(m.num) + ":" + JSON.stringify(m.url)).join(",") + "}"
  // The same rows keyed to the hash of the code that was pushed for them. The
  // URL is versionless on purpose, so it silently follows the module and a
  // visitor cannot tell whether what they are pasting still matches the demo
  // they just hovered. The page can: it generates the code with the same
  // generator this harvest read, hashes it the same way, and compares. What is
  // published here is only ever what sync actually pushed, so a difference at
  // runtime means the page moved on since — which is precisely the thing worth
  // saying out loud.
  const sync = "{" + rows.map(m => JSON.stringify(m.num) + ":" + JSON.stringify(m.hash)).join(",") + "}"
  const html = fs.readFileSync(INDEX, 'utf8')
  const re = /(<!-- BHL:FRAMER-URLS start[^>]*-->\n<script type="application\/json" id="bhl-framer-urls">)[\s\S]*?(<\/script>)/
  if (!re.test(html)) throw new Error('the BHL:FRAMER-URLS block is missing from index.html')
  const reSync = /(<!-- BHL:FRAMER-SYNC start[^>]*-->\n<script type="application\/json" id="bhl-framer-sync">)[\s\S]*?(<\/script>)/
  if (!reSync.test(html)) throw new Error('the BHL:FRAMER-SYNC block is missing from index.html')
  const next = html.replace(re, (_, a, b) => a + map + b)
                   .replace(reSync, (_, a, b) => a + sync + b)
  if (next === html) { say('map unchanged'); return }
  fs.writeFileSync(INDEX, next)
  const retired = manifest.length - rows.length
  say(`map written: ${rows.length} URLs` + (retired ? `, ${retired} retired entry/entries left out` : ''))
}

/* ---- run --------------------------------------------------------------- */
const payload = await harvest()
say(`${payload.length} studies, ${payload.filter(p => /@ts-nocheck/.test(p.code)).length} carrying an init script`)
if (DRY) { say('dry run — nothing written'); process.exit(0) }
const { stats, manifest } = sync(payload)
say(`framer: created=${stats.created} updated=${stats.updated} unchanged=${stats.skipped}`)
if (stats.orphans.length) say(`orphaned code files (left alone on purpose): ${stats.orphans.join(', ')}`)
fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n')
inject(manifest)
say('done')
