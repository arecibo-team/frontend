# Arecibo frontend

Web app for our NASA Space Apps 2026 entry, *Harmonization of MODIS and VIIRS Hot Spots*.

It shows a harmonized MODIS + VIIRS burning calendar for every EU country, how much firefighting power each country has
left after the hazards it is already dealing with, and which countries could send help.

## How it works

One screen built around the EU map.

- **Map layers**: Power, Amber index, **Regions** (each country split into north, east, south and west, coloured by
  regional firefighting power from the regional firefighter estimates and this month's fire), and **Dryness** (soil
  moisture deficit and land heat against 2001–2020 on a 1° grid, Jan 2024 to Oct 2026).
- **Map**: click a country, or press Draw area and drag a box. Coordinates takes a box in degrees, or a point and a
  distance. The map shows firefighting power or the Amber index for the replay day, with the active fires.
- **Timeline** under the map: harmonized fire cell-days for the selected area, by day for one year or by month for
  2001–2025. Drag across it to select a date range, click a day to replay it.
- **Active fires** sidebar: selecting a fire shows the fire weather at its last satellite pass and the land cover and
  terrain around it.
- **Active fires** list: every fire on the replay day, ranked against the 2001–2020 median of the area around it.
- **Area** sidebar: Now (power, rank, firefighters by region with the most stretched region called out, is this
  normal, fuel and dryness, why this score from the model's SHAP reasons, index and power over the years, outlook,
  largest fires, and a dialog to weigh the index yourself), Calendar (harmonized or raw sensors,
  click a month to select it, shift-click to extend) and Range (comparison with the same dates in every year, fires,
  and CSV exports of every hotspot, daily counts and the monthly calendar).
- **Simulate** sidebar: start from the replay day and add hazards (fire, flood, quake, drought, storm, volcano) to any
  countries, or pick a scenario like a Mediterranean heatwave. The map switches between power before and after, and
  the panel shows who falls below 50 and how many firefighters are tied up.
- **Data** sidebar: detection-level MODIS and VIIRS data from the FIRMS server. Coverage of the store, the selected
  area and range split by cross-sensor match (seen by both, MODIS only, VIIRS only) and by satellite, detections per
  day, CSV exports of the harmonized detections (both sensors, MODIS only, VIIRS only), a drop zone to import any FIRMS
  CSV, and the pipeline steps. **Detections** on the map toolbar shows the heat tiles (MODIS, VIIRS, confirmed) and the
  independent incident polygons for the selected dates.
- **Who can help** sidebar: pick a scenario and rules, and the plan draws donor routes on the map. Simulations and plans
  lock the screen until the result is in.

Every sidebar opens in a large dialog, and Method explains the harmonization, the index and the plan. The state lives in
the URL, so a link opens the same area, dates and panels.

## Running it

The app reads two APIs from the data-science repo: the Amber API (`amber-index`, harmonized record, index,
simulations) and the FIRMS server (`server`, detection-level data, tiles, imports, exports).

With Docker, run the whole stack from the `arecibo` repository (`docker compose up --build`). The image here builds
the app and serves it with nginx, which proxies `/amber/*` and `/api/*` to the two APIs.

For development, start the Amber API on port 8000 and the FIRMS server on port 8002, then:

```bash
npm install
npm run dev
```

Vite proxies `/api` to the FIRMS server (`FIRMS_PROXY` changes the target). Build-time settings:

| Variable | Default | Meaning |
| --- | --- | --- |
| `VITE_API_URL` | `http://127.0.0.1:8000` (`/amber` in the Docker image) | Amber API base |
| `VITE_FIRMS_URL` | empty, same origin | FIRMS server base |
| `VITE_CONTEXT_URL` | `/context` | Context API base (Vite proxies it to port 8003 in development) |

`scripts/build-regions.mjs` rebuilds the region shapes (`src/data/eu-regions.json`) and the anchors the Amber API uses
(`node scripts/build-regions.mjs ../data-science/amber-index/amber/regions_geo.json`).

## Deployment

The stack runs as four containers from `docker-compose.yml`: `frontend` (nginx, the only one with a published port),
`amber-api`, `firms-server` and `context-api`. The two backends build from the data-science repo, which sits next to this
one, so both are checked out side by side:

```
~/arecibo/
  frontend/          this repo
  data-science/      the APIs
  actions-runner/    the GitHub Actions self-hosted runner
```

On the server, copy `.env.example` to `.env` and adjust it, then:

```bash
cd ~/arecibo/frontend
docker compose up -d --build
docker compose ps
```

The front listens on `127.0.0.1:8088` by default, and the Pangolin tunnel publishes it. `context-api` reads its JSON
files from `CONTEXT_DATA_DIR`, which has to be filled in before that container can start.

Deployment is automatic. `.github/workflows/ci.yml` (in both repos) builds the images on every pull request on GitHub,
and on a push to `main` the self-hosted runner on lazarvps runs `deploy/deploy.sh`. The script updates both checkouts
to `origin/main`, rebuilds the stack and waits for the front to answer.

## Data

NASA FIRMS MODIS C6.1 and VIIRS S-NPP 375 m country archives, GDACS, Eurostat, OpenStreetMap, GWIS through Our World in
Data, GeoNames and Natural Earth. We acknowledge the use of data and imagery from LANCE FIRMS operated by NASA's Earth
Science Data and Information System (ESDIS) with funding provided by NASA Headquarters.
