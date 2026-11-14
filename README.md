# Arecibo frontend

Web app for our NASA Space Apps 2026 entry, *Harmonization of MODIS and VIIRS Hot Spots*.

It shows a harmonized MODIS + VIIRS burning calendar for every EU country, how much firefighting power each country has
left after the hazards it is already dealing with, and which countries could send help.

## Pages

- **Map**: active fires for the replay day, ranked against the 2001–2020 median of the area around them, and an EU map of
  firefighting power or the Amber index. Click a country for its details, or a bar under the map to change the day.
- **History**: harmonized burning calendar since 2001 for any area. Pick a country, drag a box on the map, type its
  edges, or give a point and a distance. Choose any date range with the date fields, the presets or by clicking months
  in the calendar (shift-click extends). The range card compares the period with the same dates in every other year,
  shows the daily or monthly series and the fires in it, and exports three CSV files: every hotspot detected, daily
  counts and the monthly calendar.
- **Who can help**: pick a country and a scenario, set the rules, and get a plan of who sends what and when it arrives.
- **Method**: how the harmonization, the index and the plan work.

Every view keeps its state in the URL, so a link opens the same country, day and settings.

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
