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

## The twenty-one families

| | |
|---|---|
| **A** The ones everyone ships | the small grow, the small shrink, it grows from where you came in, the bloom, lit from within, it breathes, until you arrive |
| **B** The fill tells you | directional sweep, shutter, ink fill, sheen |
| **C** The sign points | arrow relay, dot becomes arrow, crop marks, directional underline |
| **D** The word and the mark | label roll, the second line, three dots become an arrow, the caret, only when it doesn't fit |
| **E** The label, letter by letter | the roll, letter by letter, a lift, not a roll, it lands past its mark, word by word, from the middle out, in no particular order |
| **F** The challengers | weight wave, drawn outline, chamfered corner, in register, counter |
| **G** Light and material | frosted glass, backlight, the lantern |
| **H** From a brief of eleven | the light source flips, the tube converges, two frames, it prints, the measure absorbs the tracking, no direction at all |
| **I** The plate and its geometry | diagonal radius, filling the measure, edge light, the key |
| **J** Borrowed from objects | knurling, deboss, the line gauge, the data plate, continuous corners |
| **K** You feel the physics | elevation step, magnetic |
| **L** Mass, lag and resistance | the plate gives, the type doesn't, two masses, the settle, anticipation, the rule takes the load, re-spacing, the real underline, it matches your tempo, the exit remembers |
| **M** In company | the others recede, the travelling indicator, conserved compression, repulsion, the pair, the divider yields |
| **N** The pair, other than joining | the pieces part, the mark walks the plate, they trade fill, the arrow leaves, the plates stay, the mark hinges, the mark slips behind |
| **O** After the press | it reports on itself, the plate becomes the mark, it asks you to mean it |
| **P** The studio idioms | directional fill, the wave, in one order, out another, it leaves by the corner, the optical centre holds, resolve |
| **Q** The third showcase | straightens up, the riser, it goes to work, one full turn, nervous type |
| **R** The second showcase | nothing but the press, overruns its measure, too long to sit still, the plate has no direction, the hatch withdraws, stepped fill |
| **S** Argued the other way | changes sides, the pieces join, ticker label, struck through |
| **T** Everything on a grid | the fill has no edge, set on a four-pixel grid, the corner comes off in cells, four frames, not a tween, it does not rotate, the same grey, a coarser grid |
| **U** The machine had an answer | split-flap, the needle swings, outset, then inset, the dotted rectangle |

**Mass, lag and resistance** treats the button as an object
with weight — parts of it arrive at different times, it resists, it settles rather than
stops, and it answers at the tempo you approached it with. **The studio idioms** rebuilds the
agency vocabulary — direction-aware fills, liquid wipes, resolve-from-noise labels — to this
page's rules rather than to theirs. **In company** is the first family where a button knows
its siblings exist: the row receding so one item can lead, an indicator travelling, a group
conserving its width as one item gains. **Borrowed from objects** takes its references from
outside the browser entirely — a knurled camera dial, a letterpress impression, a printer's
line gauge, a machine's data plate, a milled chassis — and two of them were not buildable at
all when the rest of the page was written.

The last two families both came off hover showcases, and both are mostly arguments with
cards that already existed. **Argued the other way** keeps only the positions this page had
not taken, and names the card each one disagrees with. **The second showcase** is the more
honest of the two about its own redundancy: five of its six were already answered here and
are built anyway, because a specimen page earns nothing by asserting a duplicate exists —
the near-miss sitting next to the original is the argument. Only the stepped fill is a
mechanism the page did not have. Every one of the six arrived described by its colour, and
none of that survived: there is no hue here, so each colour swap is rebuilt as the inverse
pair.

Filter by intensity or by how it ports, and star the ones worth keeping — the shortlist
persists in your browser.

The same toolbar carries four global settings that restyle all one hundred and five at once:
**text**, **accent**, **hover** and a **button radius**. All are written as custom properties
on the root element, which is also where the copy buttons resolve from, so a snippet copied
with colours set carries those colours rather than the defaults they replaced.

Three colours, because a monochrome page hides the fact that `--ink` was doing three jobs at
once. **Text** is the label at rest, and everything that belongs to the label — card 57's
underline goes with it, not with the fill that arrives behind it. **Accent** is the fill and
the mark: `--ink` and `--accent` together. **Hover** is whatever arrives when you point at
something. Set all three the same and the page behaves exactly as it did when there was one
swatch.

Text means the label everywhere, filled plates included. Cards 01 and 02 are both
`btn--solid`, and so are every plate and mark study, where the label has to contrast with the
fill it sits on rather than with the card behind it — so the chosen colour is re-fitted
against that fill and written to `--ink-on-fill`. One amber therefore reads as full amber on
a dark card and as a dark amber on a pale plate: the hue is yours, the lightness is whatever
keeps it legible. With no text colour chosen, that token stays the computed black-or-white it
has always been. The fit walks lightness in **either** direction for exactly this reason — a
label on a near-white accent has to go down, and the one-way walk the single-primary toolbar
used would have sent it to white on white.

**Hover reaches about twenty of the hundred and five, and that is the page's own thesis
showing through rather than a gap.** These effects are geometric: most of them paint their
arriving layer at rest and animate `transform`, `clip-path` or `height`, so the colour that
arrives is the same declaration as the fill. Which ones count was settled by reading every
accent-coloured layer's *computed style at rest* — a `::before` at `scaleX(0)`, a bar
translated out of its slot, a riser with no height yet is a hover colour; anything already
visible is an accent. Reading selectors instead would have missed all of them, because none
declare their colour inside a `:hover` rule.

Label furniture stays with the text: the corner brackets of 13, the underline of 14, the
strike of 95, the dot grid of 100 and every SVG glyph paint in `currentColor` and so follow
whatever the label is doing. An arrow beside a word belongs to the word.

Unset is not "follow another swatch" — it leaves the authored alias standing, and the aliases
are deliberately uneven. `--ink-text` is pinned to `--ink-hi`, so the label does not drift
when only the accent is picked. `--ink-hover` is pinned to `--ink`, so hover *does* follow
the accent until it is given a colour of its own. That is what each one is expected to do:
text stays put, hover goes along.

White is the default for all three, and it is graphite's white — `--ink-hi`, a shade under
pure, because pure white on near-black glares. The toolbar measures it off a probe that asks
for `var(--ink)` rather than naming it, and leaves it as an alias rather than writing it to
the root, so a snippet copied at the default still reads `--ink-hi` and follows the system it
lands in. Picking `#ffffff` by hand is a real choice and is treated as one.

No page chrome reads any of the three, so the tint stops at the stage edge whatever is set. A
dark-only page cannot carry a dark colour in any of the roles — the label would go under AA,
the fill would vanish into the panel — so a chosen colour has its lightness walked up, hue and
saturation intact, until it clears its floor: 4.5:1 for text, 3:1 for the hover fill and its
borders. Accent is held to 4.5 rather than 3 even though it is a fill token, because cards 31
and 44 feed local pair aliases from `--ink` and put it behind a label. Each caption is marked
`↑` when its colour had to move, and the toolbar prints the label's measured ratio.

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
