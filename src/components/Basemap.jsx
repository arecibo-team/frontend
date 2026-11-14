import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "@maplibre/maplibre-gl-leaflet"; // adds L.maplibreGL
import { BASEMAPS, CAPITALS_MIN_ZOOM } from "../config.js";

const findBasemap = id => BASEMAPS.find(b => b.id === id) || BASEMAPS[0];

// National capitals are tagged capital = "yes" (or admin level "2") in the vector tiles.
// They're hidden when zoomed out and shown (for every country) once zoomed in
// to about country level. MapLibre's zoom inside Leaflet is Leaflet's zoom − 1.
const NOT_A_CAPITAL_OR_ZOOMED_IN = ["any",
  ["!", ["in", ["coalesce", ["get", "capital"], ""], ["literal", ["yes", "2"]]]],
  [">=", ["zoom"], CAPITALS_MIN_ZOOM - 1]
];

// Adjust the vector style's labels:
// - country names come from our own label layer (CountryLabels) → hide the built-in ones
// - capital city names (and their dots) only appear when zoomed in; other cities are unchanged
function adjustStyleLabels(glMap) {
  const apply = () => {
    for (const layer of glMap.getStyle()?.layers || []) {
      if (layer.type !== "symbol") continue;
      if (/country/i.test(layer.id)) {
        glMap.setLayoutProperty(layer.id, "visibility", "none");
      } else if (/^place_(city|capital|town)/.test(layer.id)) {
        glMap.setFilter(layer.id, layer.filter ? ["all", layer.filter, NOT_A_CAPITAL_OR_ZOOMED_IN] : NOT_A_CAPITAL_OR_ZOOMED_IN);
      }
    }
  };
  glMap.on("style.load", apply);
  if (glMap.isStyleLoaded()) apply();
}

function createLayer(bm) {
  if (bm.type === "vector") {
    const gl = L.maplibreGL({ style: bm.style, interactive: false });
    gl.once("add", () => adjustStyleLabels(gl.getMaplibreMap()));
    return gl;
  }
  return L.tileLayer(bm.url, {
    maxNativeZoom: bm.maxNativeZoom,
    maxZoom: 19,
    keepBuffer: 8,           // keep more nearby tiles loaded → no blank edges while panning
    updateWhenZooming: true, // fetch the new zoom level's tiles during the zoom, not after it
    updateWhenIdle: false,   // ...and while dragging, not only when the map stops
    className: "basemap-tiles"
  });
}

// The base map underneath everything: one layer at a time, swapped when
// the selection in the layer switcher changes.
export default function Basemap({ basemap }) {
  const map = useMap();

  useEffect(() => {
    map.attributionControl.setPrefix(false);
    const bm = findBasemap(basemap);
    const layer = createLayer(bm).addTo(map);
    layer.bringToBack?.();
    map.attributionControl.addAttribution(bm.attribution);
    return () => {
      map.removeLayer(layer);
      map.attributionControl.removeAttribution(bm.attribution);
    };
  }, [map, basemap]);

  return null;
}
