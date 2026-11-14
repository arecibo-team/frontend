import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { getCountries } from "../lib/countries.js";

// Must match the .country-label span CSS (font, size, letter-spacing, line height).
const FONT = "700 11px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const LETTER_SPACING = 0.88; // .08em of 11px
const LINE_HEIGHT = 13;

let measureCtx;
function textWidth(text) {
  measureCtx ??= document.createElement("canvas").getContext("2d");
  measureCtx.font = FONT;
  return measureCtx.measureText(text.toUpperCase()).width + LETTER_SPACING * text.length;
}

// Country names drawn by Leaflet in their own pane above the borders, so they
// look the same on every base map. A name only shows when it fits inside its
// country at the current zoom, so it never spills over the neighbours.
export default function CountryLabels({ visible }) {
  const map = useMap();

  useEffect(() => {
    if (!visible) return;
    if (!map.getPane("labels")) {
      const pane = map.createPane("labels");
      pane.style.zIndex = 650;           // above borders (400) and markers
      pane.style.pointerEvents = "none"; // never blocks hover/click on countries
    }

    const labels = getCountries().labels.map(l => ({
      ...l,
      width: Math.max(...l.lines.map(textWidth)),
      height: l.lines.length * LINE_HEIGHT,
      marker: L.marker(l.latlng, {
        pane: "labels",
        interactive: false,
        keyboard: false,
        icon: L.divIcon({
          className: "country-label" + (l.interactive ? "" : " passive"),
          html: `<span>${l.lines.join("<br>")}</span>`,
          iconSize: null
        })
      })
    }));

    const update = () => {
      const pxPerDegree = (256 * 2 ** map.getZoom()) / 360;
      for (const l of labels) {
        // Free space around the label point, in pixels at this zoom.
        const room = 2 * l.radius * pxPerDegree;
        const fits = l.width <= room * 1.6 && l.height <= room;
        if (fits && !map.hasLayer(l.marker)) l.marker.addTo(map);
        if (!fits && map.hasLayer(l.marker)) map.removeLayer(l.marker);
      }
    };
    update();
    map.on("zoomend", update);

    return () => {
      map.off("zoomend", update);
      labels.forEach(l => map.removeLayer(l.marker));
    };
  }, [map, visible]);

  return null;
}
