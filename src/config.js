// Map settings shared across components.

// The user can never pan outside these corners (south-west, north-east).
export const EUROPE_BOUNDS = [[24, -40], [74, 64]];
// What "Reset view" flies back to.
export const HOME_BOUNDS = [[35, -11], [66, 35]];
export const MAX_ZOOM = 12;
export const FLY_DURATION = 0.6; // seconds; short = crisp
// Dark map: capital city names appear from this zoom (about the level you get when selecting a country).
export const CAPITALS_MIN_ZOOM = 6;

// Countries drawn on the map but not hoverable/clickable.
export const NON_INTERACTIVE = new Set([
  "Russia", "Turkey",
  // South of Russia
  "Georgia", "Armenia", "Azerbaijan", "Kazakhstan",
  // North Africa
  "Morocco", "Algeria", "Tunisia", "Libya", "Egypt", "W. Sahara",
  // Middle East (also outside Europe)
  "Syria", "Lebanon", "Israel", "Palestine", "Jordan", "Iraq", "Iran", "Saudi Arabia"
]);

// Base maps (switchable, like Google Maps "Map type").
// type "vector": drawn by MapLibre GL.  type "raster": plain Leaflet tiles
// (no WebGL syncing, so panning/zooming is as smooth as Leaflet itself).
export const BASEMAPS = [
  {
    id: "light",
    label: "Light",
    type: "vector",
    style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
    fallbackAttribution: "Tiles © Esri",
    fallback: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>',
    thumb: "linear-gradient(135deg,#f6f6f4 0%,#e4e6ea 55%,#d4dae3 100%)",
    labelTone: "dark"
  },
  {
    id: "dark",
    label: "Dark",
    type: "vector",
    style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
    fallbackAttribution: "Tiles © Esri",
    fallback: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>',
    thumb: "linear-gradient(135deg,#0d1424 0%,#1e2a40 55%,#33435f 100%)"
  },
  {
    id: "streets",
    label: "Streets",
    type: "raster",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    maxNativeZoom: 19,
    ownLabels: false, // OSM tiles already contain country names
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    thumb: "linear-gradient(135deg,#f2efe9 0%,#d9e8c8 50%,#aad3df 100%)"
  },
  {
    id: "satellite",
    label: "Satellite",
    type: "raster",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    maxNativeZoom: 19,
    attribution: "Imagery © Esri, Maxar, Earthstar Geographics",
    thumb: "linear-gradient(135deg,#1f3b2a 0%,#4d5f36 45%,#1c3a55 100%)"
  }
];

// Whether we draw our own country names on this base map.
export const basemapHasOwnLabels = id => BASEMAPS.find(b => b.id === id)?.ownLabels !== false;
