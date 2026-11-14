# Arecibo frontend

Web app for our NASA Space Apps 2026 entry, *Harmonization of MODIS and VIIRS Hot Spots*.

It shows a harmonized MODIS + VIIRS burning calendar for every EU country, how much firefighting power each country has
left after the hazards it is already dealing with, and which countries could send help.

## How it works

One screen built around the EU map.

- **Map**: click a country, or press Draw area and drag a box. Coordinates takes a box in degrees, or a point and a
  distance. The map shows firefighting power or the Amber index for the replay day, with the active fires.
- **Timeline** under the map: harmonized fire cell-days for the selected area, by day for one year or by month for
  2001–2025. Drag across it to select a date range, click a day to replay it.
- **Active fires** sidebar: every fire on the replay day, ranked against the 2001–2020 median of the area around it.
- **Area** sidebar: Now (power, rank, is this normal, outlook, largest fires), Calendar (harmonized or raw sensors,
  click a month to select it, shift-click to extend) and Range (comparison with the same dates in every year, fires,
  and CSV exports of every hotspot, daily counts and the monthly calendar).
- **Who can help** sidebar: pick a scenario and rules, and the plan draws donor routes on the map.

Every sidebar opens in a large dialog, and Method explains the harmonization, the index and the plan. The state lives in
the URL, so a link opens the same area, dates and panels.

## Running it

The app reads everything from the Amber Index API (`amber-index/api` in the data-science repo). Start that first, on
port 8000 by default.

```bash
npm install
npm run dev
```

Point it at another API with `VITE_API_URL`:

```bash
VITE_API_URL=https://api.example.org npm run build
```

## Data

NASA FIRMS MODIS C6.1 and VIIRS S-NPP 375 m country archives, GDACS, Eurostat, OpenStreetMap, GWIS through Our World in
Data, GeoNames and Natural Earth. We acknowledge the use of data and imagery from LANCE FIRMS operated by NASA's Earth
Science Data and Information System (ESDIS) with funding provided by NASA Headquarters.
