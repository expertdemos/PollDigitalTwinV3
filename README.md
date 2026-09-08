# Urban Environment Twin — Air Quality

A single-file, browser-based **air-quality digital twin** for cities, plus a free
**data agent** (GitHub Actions) that publishes live data as static JSON.

```
.
├─ index.html                        ← the app (v3, agent-aware, 27 cities)
├─ cities.json                       ← all 27 cities the agent fetches (aligned to app)
├─ scripts/fetch-air.mjs             ← the "agent" (Node, no dependencies)
├─ data/                             ← agent writes <city>.json + index.json here
└─ .github/workflows/refresh-data.yml   ← runs the agent on a timer
```

## How the data flows (v3)
The app tries three sources, in order — so it always works:
1. **Agent JSON** — `./data/<city>.json` published by the GitHub Action (can include real **WAQI** ground-sensor readings when a token is set).
2. **Direct Open-Meteo** — if the agent file is missing, the browser calls Open-Meteo (CAMS) live.
3. **Sample data** — if nothing is reachable (offline / corporate proxy), clearly-labelled fallback.

The top-bar badge shows which source is active: **Agent / Agent + WAQI / Live / Sample**.

## Deploy in 5 minutes (GitHub Pages + agent)
1. **Create a new GitHub repo** and push everything in this folder (keep the structure).
   ```bash
   git init && git add -A && git commit -m "Urban Environment Twin v3 + data agent"
   git branch -M main
   git remote add origin https://github.com/<you>/<repo>.git
   git push -u origin main
   ```
2. **Enable Pages:** Settings → Pages → Deploy from a branch → `main` / root → Save.
   Site: `https://<user>.github.io/<repo>/`.
3. **Run the agent once:** Actions tab → "Refresh air-quality data" → Run workflow.
   It creates `data/*.json` and commits them. The app picks them up automatically.
4. *(Optional)* real ground sensors: get a free token at https://aqicn.org/data-platform/token/
   then add repo secret `WAQI_TOKEN`.

> Tip: `.github` is a hidden folder. Uploading via the GitHub web UI can skip it —
> use `git push` (above) so the workflow lands correctly.

## All 27 cities are agent-served
`cities.json` contains every city in the app, with each city's `points` in the exact
station order used by `index.html` (they map by index). Change what the agent samples
by editing `points` — keep them aligned with that city's stations in the app.

## Run locally (test before pushing)
```bash
node scripts/fetch-air.mjs        # writes data/*.json (or WAQI_TOKEN=xxx node ...)
python -m http.server 8000        # serve over http so fetch() works (NOT file://)
# open http://localhost:8000/
```

## Notes & guardrails
- **Free.** GitHub Actions minutes + Pages hosting cost nothing for this workload.
- **Keys stay secret.** Tokens live in GitHub Secrets, never in the browser.
- **No CORS.** The app reads same-origin JSON.
- **Honest labelling.** CAMS is a model (~11 km), not raw sensors, unless a WAQI value is present.
  Interpolated/scenario values are never shown as measured. Not health advice; not a validated dispersion study.
- **Take it down anytime:** delete the repo, or Settings → Pages → disable.
