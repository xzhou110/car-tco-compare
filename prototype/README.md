# Prototype — Car TCO Compare

A **zero-build, zero-dependency** clickable prototype of the TCO comparison tool.
Purpose: validate the calculation model and UX before building the production app.

## Run it

**Option A — just open the file:**
Double-click `index.html` (or right-click → Open with → your browser).
Everything is vanilla HTML/CSS/JS loaded as plain scripts, so it runs straight from disk.

**Option B — tiny local server** (nicer for live-reload, avoids any `file://` quirks):
```powershell
# from the prototype/ folder
python -m http.server 8000
# then open http://localhost:8000
```

## What you can do

- **Compare 2–6 cars** — start with 2, **+ Add car** (up to 6), remove any with ✕.
- **Load a preset or a saved car** per card (the `Load…` dropdown).
- **Save a car** to your browser with the 💾 button (stored under its nickname; appears in the dropdown under "Saved" next time).
- **Edit any number** — results recompute live.
- **Change shared assumptions** (holding years, annual miles, tax, registration, fuel/elec price) and watch the winner flip.
- Leave **Resale value blank** for the auto-estimate (shown as the placeholder); type a number to override.
- Toggle **Finance** to count loan interest — with **separate New vs Used brackets** (down payment is a **% of price**). Each car uses the bracket matching its condition.
- **Reset** returns to defaults (RAV4 New vs. RAV4 Used) and clears your saved session.
- **Auto-save:** everything you enter (assumptions + all cars) is saved in this browser and **restored automatically next time you open the app** — close it and pick up where you left off.

## Files

| File | Role |
|---|---|
| `index.html` | Page shell + containers |
| `css/styles.css` | All styling |
| `js/data.js` | Sample vehicles + default assumptions |
| `js/tco.js` | **Pure calculation engine** (mirrors `docs/design/tco-model.md`) |
| `js/app.js` | UI wiring: form generation, reading inputs, rendering results & charts |

## Known prototype limitations (by design)

- Numbers are **illustrative heuristics**, not live market data.
- Your session + saved cars live in **this browser only** (localStorage) — no cross-device sync or shareable URLs yet (planned for the production app).
- No lease modeling yet (planned for the production app).
- Up to 6 cars at once.

See [`../docs/PRD.md`](../docs/PRD.md) and [`../docs/design/DESIGN.md`](../docs/design/DESIGN.md) for the full plan.
