# UI Design Notes & Engineering Handoff

**Status:** v0.3 (post design-critique pass)
**Last updated:** 2026-06-15

Captures the visual language and UX decisions baked into the prototype so the React
rebuild carries them over intentionally. Pair with [`DESIGN.md`](DESIGN.md) (architecture)
and [`tco-model.md`](tco-model.md) (math).

## Design tokens (lift these into CSS vars / a theme)

| Token | Value | Use |
|---|---|---|
| `--ink` | `#14202c` | primary text |
| `--muted` | `#5f6b78` | secondary text (≥4.5:1 on white) |
| `--faint` | `#707c8a` | tertiary/labels (≥4.5:1 on white) |
| `--line` | `#e6eaef` | borders/hairlines |
| `--surface` | `#ffffff` | cards |
| `--surface-2` | `#f7f9fc` | insets, fieldset/adornment bg |
| `--accent` | `#2f6fed` → `#2459c8` | primary actions, focus |
| `--good` | `#16a34a` | "cheapest" highlight |
| radius | 14 / 9 px | cards / controls |
| shadow | `0 2px 6px /.06`, `0 12px 28px /.07` | card elevation |
| Slot colors | teal `#0f9b8e`, amber `#e08a1e`, indigo `#5b6ee0`, rose `#d6457f`, green `#3f9a4e`, violet `#8b5cf6` | per-vehicle identity for up to 6 slots (cards, bars, lines, rank chips — used consistently) |

Background is a soft dual radial-gradient wash (blue + teal) on `#eef2f7`.
Type: system stack; **tabular numerals** on all monetary figures; hero total ~27px/800.

## Component patterns

- **Vehicle card** — colored top-border (slot color), header with rank/load/save/remove, then **progressive disclosure**: `Car` + `Energy` always visible; `Depreciation` and `Running costs` are collapsed `<details>` by default (chevron rotates on open). *Note for React:* keep the collapse purely visual — the values must stay mounted and feed the calc even when collapsed (the prototype relies on this).
- **Summary card** — rank chip (#1–#6 in slot color), name, hero total, pill chips for `$/yr` and `¢/mi`, resale/down footnote. Cheapest gets a green ring + "🏆 cheapest" ribbon.
- **Winner banner** — tinted with the winner's slot color; verdict + delta vs. priciest.
- **Category bars** — rounded track + gradient fill per slot color, value right-aligned with fixed min-width for column alignment.
- **Cumulative chart** — inline SVG, per-slot gradient area fill under each line, white-cored data points, dashed gridlines.

## Critique pass — what changed (v0.3)

| Finding | Action taken |
|---|---|
| Input wall above results | **Progressive disclosure**: default card shows only identity + energy |
| Low-contrast tertiary text | Darkened `--faint`/`--muted` to ~4.5:1 |
| Sub-44px icon buttons | Enlarged tiny buttons (min-height 30px) |
| Weak ranking signal | Added #1–#6 **rank chips** |
| Static load-in | Added staggered `fadeUp` entrance + bar transitions (respects `prefers-reduced-motion`) |

## Deferred to the React build (recommended)

1. **Results-first / sticky summary** — pin a condensed verdict bar so the answer stays visible while editing inputs (prototype keeps the linear scroll).
2. **True bar-grow animation** from 0 on mount (needs mount lifecycle; CSS-only can't).
3. **Full responsive QA** at 320 / 768 / 1024 / 1440, plus real touch testing.
4. **Focus-visible audit** and keyboard nav order across the dynamic card list.
5. **Dark mode** via the same tokens.
6. **Shareable-URL state + PWA** (per platform recommendation: web-first, PWA, React so a Capacitor store wrapper stays cheap later).

## Accessibility checklist for handoff
- [ ] All text ≥ 4.5:1 (tokens above pass; re-verify slot-color text on tints)
- [ ] Focus ring visible on every control (prototype uses 3px accent ring)
- [ ] Touch targets ≥ 44px on mobile
- [ ] Chart not color-only — keep the text legend + values
- [ ] `prefers-reduced-motion` honored
