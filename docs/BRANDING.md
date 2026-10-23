# Product Icon

**Status:** approved by the owner 2026-10-23, from a review sheet of the pick and one alternative at 16, 30, 64 and 128 px on light and dark.

## The Icon

[app/public/favicon.svg](../app/public/favicon.svg) is the master: a hand-written 64 × 64 SVG, no generated image and no prompt. An ivory dashboard gauge whose low-cost zone is gold, its needle reading low, on navy: what a car really costs to own, and finding the one that costs least. A gauge, not a car, keeps it apart from Car Shopping; the navy echoes the app's accent `#2f6fed`. One symbol tied to the app's core promise, not a collage of features.

| Part | Value |
|---|---|
| Tile | Rounded square, corner radius 14 of 64, vertical gradient `#24539f` → `#142f63` (navy) |
| Symbol | Ivory, gradient `#fffaea` → `#f3e5c0` |
| Accent | Gold, gradient `#e8c066` → `#c38f2c` |

It belongs to the XuSeak product-icon family (owner approval 2026-10-21, the shared [brand guide](../../agent-skills/skills/ship-mobile-app/references/xuseak-brand-assets.md#product-icons-and-maker-brand)): each app has its own symbol and tile color, joined by an ivory symbol, one restrained gold accent and the same rounded-tile finish as XuSeak To-Do's folded check. Sibling icons on 2026-10-23: Apartment Shopping (home, terracotta), Car Shopping (car in profile, indigo), Car TCO Compare (cost gauge, navy).

## Where It Shows

- **Browser tab:** `<link rel="icon" type="image/svg+xml" href="/favicon.svg">` in [app/index.html](../app/index.html). Vite's relative base turns it into `./favicon.svg` in the build, so the GitHub Pages subpath serves it.
- **X Command Center card:** its collector reads the same link, so nothing else to register.

## Quality Bar and Checks

The symbol must read at 16 px (a tab) and 30 px (the card) on light and dark surroundings, stay distinct from the sibling icons, and keep one gold accent. Checked 2026-10-23: rendered at 16, 30, 64 and 128 px on light and dark with headless Chrome; the build references `./favicon.svg` and copies it; the dev server answers `image/svg+xml`; the image decodes in a real browser tab; the X Command Center card shows it.

Considered and not chosen: a balance scale with gold pans (reads as "law"), and a gauge with only a thin gold needle (vanished at 16 px).

Not covered: an iPhone home-screen icon (`apple-touch-icon`, a PNG) and Safari's tab, whose SVG favicon support was not checked.
