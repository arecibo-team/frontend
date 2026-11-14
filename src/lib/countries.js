// Country borders: Natural Earth 1:50m via world-atlas, bundled locally.
import { feature } from "topojson-client";
import world50m from "world-atlas/countries-50m.json";
import polylabel from "polylabel";
import { clipPolygon } from "lineclip";
import L from "leaflet";
import { EUROPE_BOUNDS, NON_INTERACTIVE } from "../config.js";

// world-atlas uses short names for some countries; show the full ones.
const DISPLAY_NAMES = {
  "Macedonia": "North Macedonia",
  "Bosnia and Herz.": "Bosnia and Herzegovina",
  "Faeroe Is.": "Faroe Islands",
  "N. Cyprus": "Northern Cyprus",
  "W. Sahara": "Western Sahara"
};
export const displayName = f => DISPLAY_NAMES[f.properties.name] || f.properties.name;
export const isInteractive = f => !NON_INTERACTIVE.has(f.properties.name);

const polygonsOf = f => (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates);

// Keep only the parts of a country that reach into the map area
// (drops French Guiana, Alaska, etc.).
function clipToMap(f, bounds) {
  if (!f.geometry) return null;
  // Rings that cross the 180° line (Russia's far east) would draw lines across
  // the whole map; shift their western half by +360° to keep them continuous.
  const polys = polygonsOf(f).map(p => p.map(ring => {
    const wraps = ring.some(([x]) => x > 90) && ring.some(([x]) => x < -90);
    return wraps ? ring.map(([x, y]) => [x < 0 ? x + 360 : x, y]) : ring;
  }));
  const kept = polys.filter(p => bounds.intersects(L.latLngBounds(p[0].map(([x, y]) => [y, x]))));
  return kept.length ? { ...f, geometry: { type: "MultiPolygon", coordinates: kept } } : null;
}

// Rough area in "degrees²", corrected for latitude so northern countries aren't overrated.
function area(ring) {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
  }
  const lat = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  return Math.abs(a / 2) * Math.cos((lat * Math.PI) / 180);
}

// Long multi-word names go on two lines ("Bosnia and / Herzegovina"),
// split at the space closest to the middle.
function wrapName(name) {
  if (name.length <= 10 || !name.includes(" ")) return [name];
  let best = -1;
  for (let i = name.indexOf(" "); i !== -1; i = name.indexOf(" ", i + 1)) {
    if (best === -1 || Math.abs(i - name.length / 2) < Math.abs(best - name.length / 2)) best = i;
  }
  return [name.slice(0, best), name.slice(best + 1)];
}

// Where to put the country's name: the point deepest inside its biggest
// visible piece (so the label never sits on a border). `radius` is how far
// that point is from the nearest border, in degrees: the label is only shown
// at zoom levels where the text fits in that space.
function labelFor(f) {
  const [[s, w], [n, e]] = EUROPE_BOUNDS;
  let best = null;
  for (const p of polygonsOf(f)) {
    const ring = clipPolygon(p[0], [w, s, e, n]);
    if (ring.length < 4) continue;
    const a = area(ring);
    if (!best || a > best.area) best = { ring, area: a };
  }
  if (!best) return null;
  const point = polylabel([best.ring], 0.05);
  return { latlng: [point[1], point[0]], radius: point.distance };
}

let cache = null;

// Every country that is (at least partly) inside the map area, with label info.
export function getCountries() {
  if (cache) return cache;
  const bounds = L.latLngBounds(EUROPE_BOUNDS);
  const all = feature(world50m, world50m.objects.countries);
  const features = all.features.map(f => clipToMap(f, bounds)).filter(Boolean);
  cache = {
    interactive: { type: "FeatureCollection", features: features.filter(isInteractive) },
    passive: { type: "FeatureCollection", features: features.filter(f => !isInteractive(f)) },
    labels: features
      .map(f => ({ name: displayName(f), lines: wrapName(displayName(f)), interactive: isInteractive(f), ...labelFor(f) }))
      .filter(l => l.latlng)
  };
  return cache;
}
