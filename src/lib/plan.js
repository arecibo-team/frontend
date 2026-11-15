import { geoArea, geoBounds, geoCentroid } from "d3-geo";
import { COUNTRIES } from "./geo.js";

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
