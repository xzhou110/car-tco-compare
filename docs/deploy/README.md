# Deploying Car TCO Compare

The app (`app/`) is a **static single-page app** — `npm run build` emits `app/dist`, which
is just HTML/CSS/JS. No server is required (state lives in the browser + URL).

## Recommended (commercial product): private repo + Vercel or Cloudflare Pages

Because this is proprietary and intended for commercialization, keep the **source private**
and deploy from the private repo:

1. **Make the repo private** — GitHub → Settings → General → Danger Zone → Change visibility.
2. **Import it into [Vercel](https://vercel.com)** (or **Cloudflare Pages**):
   - **Root directory:** `app`
   - **Build command:** `npm run build`
   - **Output directory:** `dist`
3. Deploy. Add a **custom domain** when ready. Every push auto-deploys.

Why these: both have free tiers, **deploy from private repos**, give HTTPS + custom domains,
and can add **serverless functions** later — which you'll want when you add accounts,
payments, or saved-comparison sync to monetize.

| Host | Private repo? | Custom domain | Serverless later | Free tier |
|------|---------------|---------------|------------------|-----------|
| **Vercel** (recommended) | ✅ | ✅ | ✅ | ✅ |
| **Cloudflare Pages** | ✅ | ✅ | ✅ (Workers) | ✅ generous |
| GitHub Pages | ❌ public only (free) | ✅ | ❌ | ✅ |

## Free alternative (public/open demo only): GitHub Pages

GitHub Pages' free tier serves **public** repos only, so it fits an open demo — not a
proprietary product you plan to sell. If you want it anyway, the workflow is ready at
[`github-pages-deploy.yml`](github-pages-deploy.yml) (see its header for the one-time
setup); it publishes to `https://xzhou110.github.io/car-tco-compare/`.

## Protecting the code

Any web app ships its (minified) JavaScript to the browser, so the **running app is always
inspectable** — there's no way around that for client-side code. What you *can* control:

- **Source privacy** → a **private repo** (so the readable source isn't public).
- **Legal rights** → the proprietary **[LICENSE](../../LICENSE)** (forbids reuse).

A private repo + Vercel/Cloudflare + the proprietary license gives you a public *app*, a
private *codebase*, and reserved *rights* — the right setup for commercialization.
