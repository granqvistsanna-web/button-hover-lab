# Button Hover Lab

One hundred and five button hover animations, actually built. Hover, tab and press all of them.

**→ [Open the lab](https://granqvistsanna-web.github.io/button-hover-lab/)**

A monochrome specimen page, so each effect can be judged on its mechanism rather than its
colour. The page itself is built in
[Graphite Console](https://granqvistsanna-web.github.io/graphite-console/) — one grayscale
ladder, white as the only accent, elevation stated as lightness rather than shadow — so the
chrome stays out of the way of the thing being shown. Every card names the technique, says when to reach for it, and is honest about what
it costs to build. Each one also has two copy buttons, both extracted from the live
stylesheet so nothing can drift out of sync: **CSS** hands you a paste-ready snippet — only
the tokens that effect actually reads, the button base, its own rules, its markup and its
script — and **`</>`** hands you the same effect as a Framer code component.

## House rules

Every one of the one hundred and five obeys all five:

| | |
|---|---|
| **Instant response** | The press lands on pointer-down, not on release. |
| **Interruptible** | Hover out halfway and the animation turns smoothly from wherever it is — no waiting for it to finish. |
| **In one way, out another** | The exit takes its own path — and its own clock, one rung down the ladder. |
| **Reduced motion** | Everything falls back to plain colour and opacity changes. |
| **Five durations, no more** | 83 / 133 / 200 / 300 / 450 ms — frame-quantised at 60 fps, declared as tokens, never improvised. The ladder governs the one hundred and five effects; the toolbar chrome runs on the design system's own `--t-fast`. |

And, without exception: no layout shift — every button's own box stays identical to three
decimals, and in the group cards the row does too, the one deliberate exception being
*Conserved compression*, where items trade width precisely so the row does not move. No
transition longer than 450 ms, a visible focus state, every string at AA contrast or better,
and a clean accessible name even where the label is split into per-character spans. Three
cards run a *loop* rather than a transition, and those are listed as exceptions below.

## The eight groups

Each group names the part of the button that performs, because that is what you already know
before you arrive: a text link has no fill to move, a button with no icon cannot relay an
arrow, and an effect that reads the row needs a row to put it in.

| | |
|---|---|
| **Whole button** | it lifts, scales, leans, settles, or answers a press |
| **Fill** | a fill arrives or leaves |
| **Border, corner and rule** | an outline draws, a radius changes, a rule moves |
| **Label** | the word moves as one unit |
| **Label, per character** | the word is split and the parts move separately |
| **Icon** | an arrow, dot, caret, needle or dash does the work |
| **Material and light** | the button looks like a thing — glass, metal, letterpress, grain |
| **Buttons in a row** | siblings react to the one you are on |

They replaced twenty-one lettered sections, which recorded where each study was written
rather than what it does. Half of those names were provenance — *the challengers*, *from a
brief of eleven*, *the third showcase*, *argued the other way* — which is the author's
business and not the reader's. The rest overlapped: someone hunting a fill sweep had to check
four sections before they could be sure they had seen them all.

The numbers did not move with the cards. Forty-odd studies cite each other by bare number in
their own prose, so a number is a catalogue entry and not a position, and a group runs 07, 78,
92 without apology.

The cut is `tools/regroup.mjs`, and it is re-runnable. It is keyed on **title** rather than
number, because the numbering gets resequenced and the titles do not. A card whose title is
not in the map stops the run rather than being dropped or filed under a guess, so the page
cannot quietly lose a study the next time it runs.

Search, the derived facets and the starred shortlist do the rest of the narrowing — and the
shortlist persists in your browser.

The same toolbar carries two global settings that restyle all one hundred and five at once: a
**primary** and a **button radius**. Both are written as custom properties on the root
element, which is also where the copy buttons resolve from, so a snippet copied with a
primary set carries that primary rather than the default it replaced.

White is the default primary, and it is graphite's white — `--ink-hi`, a shade under pure,
because pure white on near-black glares. The toolbar measures it off a rendered button
rather than naming it, and leaves it as an alias rather than writing it to the root, so a
snippet copied at the default still reads `--ink-hi` and follows the system it lands in.
Picking `#ffffff` by hand is a real choice and is treated as one.

The primary re-points `--ink` and `--accent` and nothing else — no page chrome reads
either, so the tint stops at the stage edge. A dark-only page cannot carry a dark accent:
`--ink` colours label text as well as fills, so a chosen colour has its lightness walked up,
hue and saturation intact, until the label clears 4.5:1 on the panel. The toolbar prints the
measured ratio and marks it `↑` when the colour had to move.

Radius is deliberately partial. Six studies fix or animate their own corner — 09, 13, 14,
22, 23 and the text variant — and there the radius *is* the effect, so the setting leaves
them alone. Every other card's overlays already say `border-radius: inherit` and follow for
free.

## The timing system

Five durations and two curves, and one rule for asymmetry: **the exit is one rung down the
ladder from the enter.** That rule costs a single pair of declarations, because every effect
references the tokens rather than a literal:

```css
.btn                { --t-2: 83ms;  --t-3: 133ms; --t-4: 200ms; --t-5: 300ms }
.btn:hover,
.btn:focus-visible  { --t-2: 133ms; --t-3: 200ms; --t-4: 300ms; --t-5: 450ms }
```

At rest each token resolves one step shorter; `:hover` restores the full value. So a hover
*enters* at the full rung and *leaves* at the shorter one — and custom properties inherit, so
pseudo-elements and child spans come along for free. `--t-1` (83 ms) is deliberately left out:
a press must read as instant whether or not the pointer is already there.

Sibling effects needed one addition. A row's non-hovered items are not themselves hovered, so
they would read the short rung in both directions and lose the asymmetry entirely. The row
captures the full ladder into its own aliases — it is not a `.btn`, so it still sees the root
values — and hands them back to every button in the row while any one of them is hovered.

Five documented exceptions. Three of them are loops, which are rhythms and not transitions,
so the ladder does not apply and the 450 ms ceiling does not either: the caret blinks on
1.1 s, *Ticker label* runs 5.4 s, and *Too long to sit still* runs 5 s. A loop is judged on
its speed rather than its duration — long enough that the eye is not chased, slow enough to
be read. The overflow marquee travels in proportion to the distance clipped
(160 ms + 2.2 ms/px, capped at 600) so the label moves at a constant *speed*; a fixed rung
would crawl on a long label and race on a short one. And two cards carry easings shaped like
springs rather than curves — one a `linear()` sampled from a damped oscillator, one a
cubic-bézier whose control point dips below zero to wind up before it goes.

## Porting to Framer

Each card carries an honest chip:

- **Variant in Framer** — builds as a hover variant straight on the canvas.
- **Code in Framer** — needs a code override or a component. Duplicated labels,
  `transform-origin` swaps, per-character work, `@property` values, blend modes, SVG stroke
  animation, springs, `:has()` sibling logic and anything asymmetric between enter and exit
  are all things Framer variants cannot express.

The **`</>`** button on each card hands you the component itself. Press it and you get a
`framer.com/m/…` URL — paste that onto a Framer canvas and the button arrives already built.
Every study in here is a code file in a Framer project, and a Framer code file gets a public
module URL the moment it exists: no publishing, no marketplace, no account on your end.
Nothing is copied into your project either. The component stays a remote module, so it costs
you one layer rather than a file you now own.

**Option-click** the same button for the whole code file instead. Paste it into Assets → Code
→ New File and the effect appears in the Code section, ready to drag out. Take that route if
you would rather own the source than reference it — a remote module exposes its property
controls but not its code.

The URL is the versionless form on purpose. Framer resolves it at paste time and pins your
instance to the version it found, so a fix here reaches the next person who pastes it and can
never change a button you have already placed.

Both routes hand you the same generated file, and it is generated by pressing this page's own
copy button in a headless browser — there is no second implementation that could drift. What
it does on the way there is worth knowing, because Framer is not a browser page and the
extraction has to make up the difference:

- The colour tokens are **scoped to the component**, not to `:root`, and the shared classes
  are prefixed `bhl-`. Nothing a pasted component brings with it restyles the rest of the
  site. Tokens that live in a stylesheet the page cannot enumerate are resolved off the root
  and labelled as such, so an alias chain still arrives with a value.
- Two page-wide rules are **element selectors**, so the extractor cannot see them and writes
  them back by hand: the box model, and the `prefers-reduced-motion` fallback. Losing the
  second one silently would be the worst of the two.
- The label becomes a **property control**, except where the effect duplicates it across
  layers to hold its width — there a single control would change one copy and not the other,
  so the labels stay in the markup and the file's header says so.
- A section's init script moves into a `useEffect`, **scoped to the instance**, so two of them
  on one page never bind each other's nodes. Only that card's chunk comes along, unless the
  block shares state between cards, in which case it arrives whole.
- The face arrives as a resolved stack under `--font-ui`, so the component stands up on its
  own in system fonts. Add the real webfont to the Framer project for the intended face, or
  point the token at your own — a component cannot bring a webfont with it.
- A card that carries an init script vendors this page's browser JS verbatim, so those files
  open with `@ts-nocheck` and say why. The component around it is typed; the borrowed script
  is not TypeScript and pretending otherwise would mean rewriting it.

Studies added since the last sync have no URL yet. Those fall back to the code file and say
so in the confirmation, rather than copying nothing.

## Notes on the build

Single file, no dependencies, no build step — `tools/sync-framer.mjs` is the one exception,
and it is a maintenance tool rather than part of the page. It serves `index.html` to a
headless Chrome, presses every card's copy button with the clipboard stubbed, pushes the
result into a Framer project as one code file per study, and writes the module URLs back into
the page and into `framer-components.json`. It skips any study whose content hash has not
moved, so published URLs stay put, and it never deletes a code file that no study claims any
more — somebody may already have pasted it. One linked stylesheet — the Graphite Console
tokens, which carry self-hosted Geist and Geist Mono — and everything else is CSS, with
small vanilla-JS loops in 14 of the 105 cards, only
where CSS genuinely cannot reach — a critically damped spring, a pointer-driven gradient, a
per-character weight ripple, an overflow measurement, a velocity handoff, a pointer-speed
reading, and the edge the pointer crossed.

Colour lives entirely in tokens, and there is now exactly one set of them: Graphite Console
is dark-only, so the light `:root` / `prefers-color-scheme` / `[data-theme]` trio is gone.
The page's own names (`--ink`, `--stage`, `--accent`, …) survive as **aliases** onto the
graphite ladder, which is why all sixty-four effect rules kept working untouched — and why
the copy buttons still hand you a self-contained snippet, resolving each alias to its value
off the computed root.

Every effect in here was checked in a real browser — rect deltas measured to three decimals,
contrast sampled frame by frame during blend-mode transitions, `@property` values sampled
mid-interpolation to prove they actually interpolate. That is how a `border-radius`
interpolating to `999px` on a 43px-tall box was caught reaching its visual maximum two
milliseconds into a 450 ms transition, and how a spring integrated by Euler steps was caught
swallowing two thirds of its handed-over velocity in a single frame. Neither was visible in
the code.

## Licence

MIT. Take the techniques.
