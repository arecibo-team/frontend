// Global settings shared by all scripts. Everything hangs off window.App.
window.App = window.App || {};

(function () {
  // A plain raster style for MapLibre, used for the satellite and terrain base maps.
  function rasterStyle(tiles, maxzoom) {
    return {
      version: 8,
      sources: { base: { type: "raster", tiles: [].concat(tiles), tileSize: 256, maxzoom: maxzoom } },
      layers: [{ id: "base", type: "raster", source: "base" }]
    };
  }

  App.config = {
    // ---- Navigation --------------------------------------------------------
    // The user can never pan outside these corners (south-west, north-east).
    EUROPE_BOUNDS: [[33, -26], [72, 46]],
    // What "Reset view" flies back to.
    HOME_BOUNDS: [[35, -11], [66, 35]],
    MAX_ZOOM: 12,
    FLY_DURATION: 0.6, // seconds; short = crisp

    // ---- Data sources ------------------------------------------------------
    // Fire / risk layers are placeholders for now: nothing is drawn on the map
    // and the panel shows "—". Set to true to switch them on.
    SHOW_FIRE_DATA: false,

    COUNTRIES_URL: "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json",

    // NASA GIBS: daily MODIS / VIIRS thermal anomaly tiles, no key needed.
    GIBS_URL: "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/{layer}/default/{time}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png",

    // NASA FIRMS hotspot points. Get a free MAP_KEY at
    // https://firms.modaps.eosdis.nasa.gov/api/map_key/ and paste it here.
    FIRMS_MAP_KEY: "",
    FIRMS_SOURCE: "VIIRS_SNPP_SP",

    // Where the ML model output will come from. null = use the built-in mock.
    PREDICTIONS_URL: null,

    // ---- Time --------------------------------------------------------------
    FIRST_YEAR: 2001,
    DEFAULT_DATE: "2023-08-20", // Evros fire, Greece

    // ---- Base maps (switchable, like Google Maps "Map type") ----------------
    BASEMAPS: [
      {
        id: "dark", label: "Dark",
        style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>',
        thumb: "linear-gradient(135deg,#0d1424 0%,#1e2a40 55%,#33435f 100%)"
      },
      {
        id: "streets", label: "Streets",
        style: "https://tiles.openfreemap.org/styles/liberty",
        attribution: '<a href="https://openfreemap.org">OpenFreeMap</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        thumb: "linear-gradient(135deg,#f2efe9 0%,#d9e8c8 50%,#aad3df 100%)"
      },
      {
        id: "satellite", label: "Satellite",
        style: rasterStyle("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", 19),
        attribution: "Imagery © Esri, Maxar, Earthstar Geographics",
        thumb: "linear-gradient(135deg,#1f3b2a 0%,#4d5f36 45%,#1c3a55 100%)"
      }
    ],

    // ML risk colour scale (low → extreme).
    RISK_STEPS: [
      { min: 0.3, color: "#fee08b", label: "Low" },
      { min: 0.45, color: "#fdae61", label: "Moderate" },
      { min: 0.6, color: "#f46d43", label: "High" },
      { min: 0.75, color: "#d73027", label: "Very high" },
      { min: 0.88, color: "#a50026", label: "Extreme" }
    ]
  };

  // ---- Countries ------------------------------------------------------------
  // Name as spelled in world-atlas → ISO 3166-1 alpha-2.
  App.EU27 = {
    "Austria": "AT", "Belgium": "BE", "Bulgaria": "BG", "Croatia": "HR", "Cyprus": "CY", "Czechia": "CZ",
    "Denmark": "DK", "Estonia": "EE", "Finland": "FI", "France": "FR", "Germany": "DE", "Greece": "GR",
    "Hungary": "HU", "Ireland": "IE", "Italy": "IT", "Latvia": "LV", "Lithuania": "LT", "Luxembourg": "LU",
    "Malta": "MT", "Netherlands": "NL", "Poland": "PL", "Portugal": "PT", "Romania": "RO", "Slovakia": "SK",
    "Slovenia": "SI", "Spain": "ES", "Sweden": "SE"
  };
  App.OTHER_EUROPE = {
    "Albania": "AL", "Andorra": "AD", "Belarus": "BY", "Bosnia and Herz.": "BA", "Iceland": "IS", "Kosovo": "XK",
    "Liechtenstein": "LI", "Moldova": "MD", "Monaco": "MC", "Montenegro": "ME", "North Macedonia": "MK", "Macedonia": "MK",
    "Norway": "NO", "San Marino": "SM", "Serbia": "RS", "Switzerland": "CH", "Ukraine": "UA",
    "United Kingdom": "GB", "Vatican": "VA"
  };
  App.isEU = n => n in App.EU27;
  App.isEurope = n => n in App.EU27 || n in App.OTHER_EUROPE;
  App.isoCode = n => App.EU27[n] || App.OTHER_EUROPE[n] || "";

  // ---- Small date helpers -----------------------------------------------------
  App.dates = {
    // Latest day NASA has data for (yesterday, UTC).
    latest() { const d = new Date(); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); },
    fromDayOfYear(year, doy) { const d = new Date(Date.UTC(year, 0, 1)); d.setUTCDate(doy); return d.toISOString().slice(0, 10); },
    dayOfYear(iso) { const d = new Date(iso + "T00:00:00Z"); return Math.round((d - Date.UTC(d.getUTCFullYear(), 0, 1)) / 864e5) + 1; },
    daysInYear(year) { return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365; },
    pretty(iso) { return new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }); }
  };
})();
