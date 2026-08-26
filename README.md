# Button Hover Lab

Fifty-two button hover animations, actually built. Hover, tab and press all of them.

**→ [Open the lab](https://granqvistsanna-web.github.io/button-hover-lab/)**

A monochrome specimen page, so each effect can be judged on its mechanism rather than its
colour. Every card names the technique, says when to reach for it, and is honest about what
it costs to build. Each one also has a **Copy** button that hands you a paste-ready snippet —
only the tokens that effect actually reads, the button base, its own rules, its markup and
its script, extracted from the live stylesheet so nothing can drift out of sync.

## House rules

Every one of the fifty-two obeys all five:

| | |
|---|---|
| **Instant response** | The press lands on pointer-down, not on release. |
| **Interruptible** | Hover out halfway and the animation turns smoothly from wherever it is — no waiting for it to finish. |
| **In one way, out another** | The exit takes its own path — and its own clock, one rung down the ladder. |
| **Reduced motion** | Everything falls back to plain colour and opacity changes. |
| **Five durations, no more** | 83 / 133 / 200 / 300 / 450 ms — frame-quantised at 60 fps, declared as tokens, never improvised. |

And, without exception: no layout shift (the button's own box and its parent's stay
identical to three decimals), nothing longer than 600 ms, a visible focus state, a working
light *and* dark theme, and a clean accessible name even where the label is split into
per-character spans.

## The ten families

| | |
|---|---|
| **A** The fill tells you | directional sweep, shutter, ink fill, sheen |
| **B** The sign points | arrow relay, dot becomes arrow, guillemets, crop marks, directional underline |
| **C** You feel the physics | elevation step, magnetic |
| **D** The challengers | weight wave, drawn outline, chamfered corner, in register, counter |
| **E** Light and material | frosted glass, backlight, the lantern, the grain settles, edge light |
| **F** The plate and its geometry | diagonal radius, rule becomes frame, filling the measure, the key |
| **G** The word and the mark | label roll, the second line, three dots become an arrow, the caret, only when it doesn't fit |
| **H** Mass, lag and resistance | the plate gives, the type doesn't, two masses, the settle, anticipation, the rule takes the load, re-spacing, setting the line, the real underline, it matches your tempo, the exit remembers |
| **I** The studio idioms | directional fill, the wave, in one order, out another, it leaves by the corner, the optical centre holds, resolve |
| **J** In company | the others recede, the travelling indicator, conserved compression, repulsion, the pair, the divider yields |

The last three are the newest. **Mass, lag and resistance** treats the button as an object
with weight — parts of it arrive at different times, it resists, it settles rather than
stops, and it answers at the tempo you approached it with. **The studio idioms** rebuilds the
agency vocabulary — direction-aware fills, liquid wipes, resolve-from-noise labels — to this
page's rules rather than to theirs. **In company** is the first family where a button knows
its siblings exist: the row receding so one item can lead, an indicator travelling, a group
conserving its width as one item gains.

Filter by intensity or by how it ports, and star the ones worth keeping — the shortlist
persists in your browser.

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

Three documented exceptions. The caret blinks on a 1.1 s loop, which is a rhythm and not a
transition. The overflow marquee travels in proportion to the distance clipped
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

## Notes on the build

Single file, no dependencies, no build step. Two Google Fonts (Schibsted Grotesk, Spline
Sans Mono); everything else is CSS, with small vanilla-JS loops in 10 of the 52 cards, only
where CSS genuinely cannot reach — a critically damped spring, a pointer-driven gradient, a
per-character weight ripple, an overflow measurement, a velocity handoff, a pointer-speed
reading, and the edge the pointer crossed.

Colour lives entirely in tokens defined three times over: a light `:root`, a
`prefers-color-scheme: dark` block guarded so an explicit light choice still wins, and a
`[data-theme="dark"]` block so a host toggle wins in both directions.

Every effect in here was checked in a real browser — rect deltas measured to three decimals,
contrast sampled frame by frame during blend-mode transitions, `@property` values sampled
mid-interpolation to prove they actually interpolate. That is how a `border-radius`
interpolating to `999px` on a 43px-tall box was caught reaching its visual maximum two
milliseconds into a 450 ms transition, and how a spring integrated by Euler steps was caught
swallowing two thirds of its handed-over velocity in a single frame. Neither was visible in
the code.

## Licence

MIT. Take the techniques.
