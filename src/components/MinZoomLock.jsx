import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { EUROPE_BOUNDS } from "../config.js";

// Never let the user zoom out far enough to see beyond Europe.
// Recomputed whenever the map container changes size.
export default function MinZoomLock() {
  const map = useMap();

  useEffect(() => {
    if (import.meta.env.DEV) window.__map = map; // handy for debugging in the console
    const europe = L.latLngBounds(EUROPE_BOUNDS);
    const lock = () => {
      const z = Math.ceil(map.getBoundsZoom(europe, true) * 4) / 4;
      map.setMinZoom(z);
      if (map.getZoom() < z) map.setZoom(z, { animate: false });
    };
    lock();
    map.on("resize", lock);

    const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    observer.observe(map.getContainer());

    return () => {
      map.off("resize", lock);
      observer.disconnect();
    };
  }, [map]);

  return null;
}
