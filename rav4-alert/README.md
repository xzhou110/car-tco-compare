# rav4-alert (POC)

Twice-daily used-car listing alert for a Toyota RAV4 Hybrid, near zip 94030.
Data source: **Auto.dev** listings API (SDK). Long-term goal: a consumer-facing app.

## One-time setup

1. **Install Node.js LTS** (system-wide, on PATH):
   ```powershell
   winget install OpenJS.NodeJS.LTS
   ```
   Open a NEW terminal and confirm: `node -v`

2. **Set your Auto.dev API key** as a Windows User env var (regenerate it first if it was ever exposed):
   ```powershell
   [Environment]::SetEnvironmentVariable('AUTODEV_API_KEY', 'PASTE_FRESH_KEY', 'User')
   ```
   Verify in a new terminal: `[Environment]::GetEnvironmentVariable('AUTODEV_API_KEY','User')`

3. **Install deps** (from this folder):
   ```powershell
   npm install
   ```

## Run the reconnaissance query

```powershell
npm run query
```

`query.mjs` hits Auto.dev for both target lists and dumps the raw response, so we
can confirm (a) real RAV4 Hybrids come back and (b) whether the payload carries any
vehicle-history fields (accident / owners / title). This answers the open question
about the "free Carfax/AutoCheck badge" plan.

## Interfaces

- **SDK** (`@auto.dev/sdk`) — what the actual scheduled routine uses. ← primary
- **MCP** (`.mcp.json`, `auto --mcp`) — for interactive querying inside Claude Code.
  Requires `npm install -g @auto.dev/sdk` and a Claude Code restart.

## Status / open items

- Auto.dev has **no documented `trim` filter** → XLE+ (List 2) is filtered client-side.
- Auto.dev has **no documented history fields** → "no accident / clean title / personal
  use" handling is TBD pending the recon query. Fallbacks: best-effort/verify-on-click,
  or a cheap NMVTIS lookup (VinAudit ~$1-3/VIN). "Personal use" is Carfax-only.
- Email digest + scheduling: not built yet. Sends outbound (own provider); no inbox auth.
