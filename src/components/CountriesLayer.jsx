import { useEffect, useMemo, useRef } from "react";
import { GeoJSON, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { getCountries, displayName } from "../lib/countries.js";
import { EUROPE_BOUNDS, FLY_DURATION } from "../config.js";

const baseStyle = { color: "#7f9bd0", weight: 1, opacity: 0.75, fillColor: "#4a6fa5", fillOpacity: 0.04 };
const passiveStyle = { color: "#7f9bd0", weight: 1, opacity: 0.4, fill: false };
const hiddenStyle = { opacity: 0, fillOpacity: 0 };
const hoverStyle = { color: "#ffb48a", weight: 2, opacity: 1, fillOpacity: 0.16 };
const selectedStyle = { color: "#ffd2b8", weight: 3, opacity: 1, fillOpacity: 0.08 };

// Fly to a country, but only to the part inside the map area.
function flyToCountry(map, layer) {
  const b = layer.getBounds();
  const e = L.latLngBounds(EUROPE_BOUNDS);
  const clipped = L.latLngBounds(
    [Math.max(b.getSouth(), e.getSouth()), Math.max(b.getWest(), e.getWest())],
    [Math.min(b.getNorth(), e.getNorth()), Math.min(b.getEast(), e.getEast())]
  );
  map.flyToBounds(clipped, { padding: [30, 30], maxZoom: 7, duration: FLY_DURATION });
}

export default function CountriesLayer({ selected, bordersOn, onSelect, onClear }) {
  const map = useMap();
  const { interactive, passive } = useMemo(getCountries, []);
  const layerRef = useRef(null);
  const passiveRef = useRef(null);

  // Leaflet event handlers are bound once, so they read the latest props via refs.
  const latest = useRef({});
  latest.current = {
    selected, onSelect, onClear,
    styleFor: f => (f === selected ? selectedStyle : bordersOn ? baseStyle : hiddenStyle)
  };

  // Restyle when the selection or the borders toggle changes.
  useEffect(() => {
    layerRef.current?.eachLayer(l => {
      l.setStyle(latest.current.styleFor(l.feature));
      if (l.feature === selected) l.bringToFront();
    });
    passiveRef.current?.setStyle(bordersOn ? passiveStyle : hiddenStyle);
  }, [selected, bordersOn]);

  // Click on the sea (or a non-interactive country) or press Esc to deselect.
  useMapEvents({ click: () => latest.current.onClear() });
  useEffect(() => {
    const onKey = e => { if (e.key === "Escape") latest.current.onClear(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const onEachFeature = (f, layer) => {
    layer.bindTooltip(displayName(f), { sticky: true, direction: "top", offset: [0, -6] });
    layer.on({
      mouseover: () => { if (f !== latest.current.selected) layer.setStyle(hoverStyle); },
      mouseout: () => layer.setStyle(latest.current.styleFor(f)),
      click: e => {
        L.DomEvent.stopPropagation(e);
        latest.current.onSelect(f);
        flyToCountry(map, layer);
      }
    });
  };

  return (
    <>
      {/* Russia, Turkey, North Africa, Middle East: outline only, no hover/click. */}
      <GeoJSON ref={passiveRef} data={passive} style={passiveStyle} interactive={false} />
      <GeoJSON
        ref={layerRef}
        data={interactive}
        style={f => latest.current.styleFor(f)}
        onEachFeature={onEachFeature}
      />
    </>
  );
}
