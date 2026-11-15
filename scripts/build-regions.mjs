import fs from "fs";
import { feature } from "topojson-client";
import { geoArea, geoCentroid } from "d3-geo";
import pc from "polygon-clipping";

const world = JSON.parse(fs.readFileSync("src/data/europe-10m.json", "utf8"));
const geoSrc = fs.readFileSync("src/lib/geo.js", "utf8");
const EU = Object.fromEntries([...geoSrc.match(/export const EU = \{([\s\S]*?)\};/)[1].matchAll(/"(\d+)": "([A-Z]{2})"/g)].map(m => [m[1], m[2]]));
const REGIONS = { north: 90, east: 0, south: 270, west: 180 };
const R = 30;

const polys = f => (f.geometry.type === "MultiPolygon" ? f.geometry.coordinates : [f.geometry.coordinates]);
const fixWinding = mp => mp.map(poly => {
  const p = { type: "Polygon", coordinates: poly };
  return geoArea(p) > 2 * Math.PI ? poly.map(r => [...r].reverse()) : poly;
});

const byIso = {};
for (const f of feature(world, world.objects.countries).features) {
  const iso2 = EU[f.id];
  if (iso2) byIso[iso2] = [...(byIso[iso2] || []), ...polys(f)];
}

const features = [];
const meta = {};
for (const [iso2, mp] of Object.entries(byIso)) {
  let best = null;
  for (const poly of mp) {
    const a = geoArea({ type: "Polygon", coordinates: poly });
    if (!best || a > best.a) best = { a, poly };
  }
  const [lon0, lat0] = geoCentroid({ type: "Polygon", coordinates: best.poly });
  const k = Math.cos((lat0 * Math.PI) / 180);
  meta[iso2] = { centroid: [+lat0.toFixed(4), +lon0.toFixed(4)], anchors: {}, area_share: {} };
  const total = geoArea({ type: "MultiPolygon", coordinates: fixWinding(mp) });
  for (const [region, mid] of Object.entries(REGIONS)) {
    const ring = [[lon0, lat0]];
    for (let d = -45; d <= 45; d += 7.5) {
      const t = ((mid + d) * Math.PI) / 180;
      ring.push([lon0 + (R * Math.cos(t)) / k, Math.max(-85, Math.min(85, lat0 + R * Math.sin(t)))]);
    }
    ring.push([lon0, lat0]);
    const clipped = pc.intersection(mp, [ring]);
    if (!clipped.length) continue;
    const geom = { type: "MultiPolygon", coordinates: fixWinding(clipped) };
    let piece = null;
    for (const poly of geom.coordinates) {
      const a = geoArea({ type: "Polygon", coordinates: poly });
      if (!piece || a > piece.a) piece = { a, poly };
    }
    const [alon, alat] = geoCentroid({ type: "Polygon", coordinates: piece.poly });
    meta[iso2].anchors[region] = [+alat.toFixed(4), +alon.toFixed(4)];
    meta[iso2].area_share[region] = +(geoArea(geom) / total).toFixed(4);
    features.push({ type: "Feature", properties: { iso2, region }, geometry: geom });
  }
}

const round = c => (typeof c[0] === "number" ? [+c[0].toFixed(3), +c[1].toFixed(3)] : c.map(round));
for (const f of features) f.geometry.coordinates = round(f.geometry.coordinates);
fs.writeFileSync("src/data/eu-regions.json", JSON.stringify({ type: "FeatureCollection", features }));
fs.writeFileSync(process.argv[2] || "regions-meta.json", JSON.stringify(meta, null, 1));
console.log(features.length, "region shapes,", Object.keys(meta).length, "countries");
