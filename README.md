# Button Hover Lab

Thirty-five button hover animations, actually built. Hover, tab and press all of them.

**→ [Open the lab](https://granqvistsanna-web.github.io/button-hover-lab/)**

A monochrome specimen page, so each effect can be judged on its mechanism rather than its
colour. Every card names the technique, says when to reach for it, and is honest about what
it costs to build.

## House rules

Every one of the thirty-five obeys all four:

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

## The eight families

| | |
|---|---|
| **A** The label does the work | roll, weight crossfade, split-flap |
| **B** The fill tells you | directional sweep, shutter, ink fill from the pointer, sheen |
| **C** The sign points | arrow relay, dot→arrow, guillemets, crop marks, directional underline |
| **D** You feel the physics | elevation step, magnetic spring |
| **E** The challengers | weight wave, drawn outline, chamfer, out-of-register frame, levelling wave, counter |
| **F** Light and material | frosted glass, backlight, lantern, settling grain, edge light |
| **G** The plate and its geometry | diagonal radius, seam, rule→frame, filling the measure, keycap |
| **H** The word and the mark | tracking, second line, three dots→arrow, caret, overflow marquee |

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

Two documented exceptions. The caret on card 34 blinks on a 1.1 s loop — a rhythm, not a
transition. And card 35's marquee travel is proportional to the distance clipped
(160 ms + 2.2 ms/px, capped at 600) so the label moves at a constant *speed*; a fixed rung
would crawl on a long label and race on a short one.

## Porting to Framer

Each card carries an honest chip:

- **Variant in Framer** — builds as a hover variant straight on the canvas.
- **Code in Framer** — needs a code override or a component. Duplicated labels,
  `transform-origin` swaps, per-character work, `@property` values, blend modes, SVG stroke
  animation and springs are all things Framer variants cannot express.

## Notes on the build

Single file, no dependencies, no build step. Two Google Fonts (Schibsted Grotesk, Spline
Sans Mono); everything else is CSS, with small vanilla-JS loops only where CSS genuinely
cannot reach — a critically damped spring, a pointer-driven gradient, a per-character weight
ripple, and an overflow measurement.

Colour lives entirely in tokens defined three times over: a light `:root`, a
`prefers-color-scheme: dark` block guarded so an explicit light choice still wins, and a
`[data-theme="dark"]` block so a host toggle wins in both directions.

Every effect in here was checked in a real browser — rect deltas measured to three decimals,
contrast sampled frame by frame during blend-mode transitions, `@property` values sampled
mid-interpolation to prove they actually interpolate. Four real bugs were found and fixed
that way, which is the argument for doing it.

## Licence

MIT. Take the techniques.
