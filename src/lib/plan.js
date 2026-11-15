import { geoArea, geoBounds, geoCentroid } from "d3-geo";
import { COUNTRIES } from "./geo.js";
import { listJoin, word } from "./format.js";

export const SCENARIOS = [
  ["wildfire_season", "Wildfire season"],
  ["several_hazards", "Several hazards at once"],
  ["major_flood", "Major flood"],
  ["earthquake", "Earthquake"],
  ["drought", "Drought"]
];

const REASONS = {
  "already below": ["is already below 50", "are already below 50"],
  "would drop below": ["would drop below 50", "would drop below 50"],
  "active fires": ["has active fires", "have active fires"],
  "low power": ["has little to spare", "have little to spare"]
};

function polygons(feature) {
  const g = feature.geometry;
  const list = g.type === "MultiPolygon" ? g.coordinates : [g.coordinates];
  return list.map(coordinates => ({ type: "Polygon", coordinates }));
}

export const CENTROIDS = {};
export const BOUNDS = {};
const LARGEST = {};
COUNTRIES.filter(f => f.iso2).forEach(f => {
  polygons(f).forEach(p => {
    const a = geoArea(p);
    if (a > (LARGEST[f.iso2] || 0)) {
      LARGEST[f.iso2] = a;
      const [lon, lat] = geoCentroid(p);
      CENTROIDS[f.iso2] = [lat, lon];
      const [[w, s], [e, n]] = geoBounds(p);
      BOUNDS[f.iso2] = [w, s, e, n].map(v => Math.round(v * 100) / 100);
    }
  });
});

export function headline(plan) {
  const r = plan.recipient;
  const n = plan.donors.length;
  if (!n) return `No country can send help to ${r.name} under these rules`;
  const who = n === 1 ? "One country" : `${word(n)} countries`;
  const lift = r.power_with_help >= r.power_before - 0.5 ? "back to" : "up to";
  return `${who} can bring ${r.name} ${lift} ${Math.round(r.power_with_help)} within ${Math.round(plan.hours)} hours`;
}

export function leftOutSentence(items) {
  if (!items.length) return null;
  const groups = {};
  items.forEach(i => (groups[i.reason] = [...(groups[i.reason] || []), i.name]));
  const parts = Object.entries(groups).map(([reason, names]) => `${listJoin(names)} ${(REASONS[reason] || [reason, reason])[names.length > 1 ? 1 : 0]}`);
  return `Left out: ${parts.join("; ")}.`;
}

export function routesFor(plan) {
  return plan.donors.map((d, i, all) => ({ from: CENTROIDS[d.iso2], to: plan.incident, width: 1.2 + 2 * (1 - i / Math.max(all.length, 1)) }));
}
