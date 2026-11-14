import { useEffect, useMemo, useRef } from "react";
import { GeoJSON, useMap } from "react-leaflet";
import L from "leaflet";
import { getCountries, displayName } from "../lib/countries.js";
import { EUROPE_BOUNDS, FLY_DURATION } from "../config.js";
import { EU } from "../lib/geo.js";

const passiveStyle = { color: "#9aa3b2", weight: 0.8, opacity: 0.6, fill: false };
const hiddenStyle = { opacity: 0, fillOpacity: 0 };

// Fly to a country, but only to the part inside the map area.
function flyToCountry(map, layer) {
  const b = layer.getBounds();
  const e = L.latLngBounds(EUROPE_BOUNDS);
  const clipped = L.latLngBounds(
    [Math.max(b.getSouth(), e.getSouth()), Math.max(b.getWest(), e.getWest())],
    [Math.min(b.getNorth(), e.getNorth()), Math.min(b.getEast(), e.getEast())]
  );
  map.flyToBounds(clipped, { padding: [30, 30], maxZoom: 6, duration: FLY_DURATION });
}

const isoOf = f => EU[f.id] || null;

export default function CountriesLayer({ fill, outline, hatch, selected, bordersOn, onSelect, flyOnSelect }) {
  const map = useMap();
  const { interactive, passive } = useMemo(getCountries, []);
  const layerRef = useRef(null);
  const passiveRef = useRef(null);
  const hover = useRef(null);

  const latest = useRef({});
  latest.current = {
    onSelect,
    flyOnSelect,
    styleFor: f => {
      const iso2 = isoOf(f);
      const strong = iso2 && (iso2 === selected || outline.includes(iso2));
      const hovered = iso2 && hover.current === iso2 && onSelect;
      if (!iso2) return bordersOn ? { color: "#ffffff", weight: 0.8, opacity: 0.9, fillColor: "#dfe3e8", fillOpacity: 0.35 } : hiddenStyle;
      return {
        color: strong || hovered ? "#18181b" : "#ffffff",
        weight: strong ? 1.8 : hovered ? 1.4 : bordersOn ? 0.9 : 0,
        opacity: 1,
        fillColor: hatch.includes(iso2) ? "url(#map-hatch)" : fill(iso2),
        fillOpacity: hatch.includes(iso2) ? 1 : 0.92
      };
    }
  };

  useEffect(() => {
    layerRef.current?.eachLayer(l => {
      l.setStyle(latest.current.styleFor(l.feature));
      const iso2 = isoOf(l.feature);
      if (iso2 && (iso2 === selected || outline.includes(iso2))) l.bringToFront();
    });
    passiveRef.current?.setStyle(bordersOn ? passiveStyle : hiddenStyle);
  });


  const onEachFeature = (f, layer) => {
    const iso2 = isoOf(f);
    layer.bindTooltip(displayName(f), { sticky: true, direction: "top", offset: [0, -6] });
    if (!iso2) return;
    layer.on({
      mouseover: () => {
        hover.current = iso2;
        layer.setStyle(latest.current.styleFor(f));
      },
      mouseout: () => {
        hover.current = null;
        layer.setStyle(latest.current.styleFor(f));
      },
      click: e => {
        L.DomEvent.stopPropagation(e);
        if (!latest.current.onSelect) return;
        latest.current.onSelect(iso2);
        if (latest.current.flyOnSelect) flyToCountry(map, layer);
      }
    });
  };

  return (
    <>
      {/* Russia, Turkey, North Africa, Middle East: outline only, no hover/click. */}
      <GeoJSON ref={passiveRef} data={passive} style={passiveStyle} interactive={false} />
      <GeoJSON ref={layerRef} data={interactive} style={f => latest.current.styleFor(f)} onEachFeature={onEachFeature} />
    </>
  );
}
