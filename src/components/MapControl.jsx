import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useMap } from "react-leaflet";
import L from "leaflet";

// Renders React children inside a real Leaflet control, so it sits in the
// map's corners alongside zoom/scale and doesn't pan or zoom the map when used.
export default function MapControl({ position = "topright", children }) {
  const map = useMap();
  const [container] = useState(() => {
    const div = L.DomUtil.create("div", "leaflet-control");
    L.DomEvent.disableClickPropagation(div);
    L.DomEvent.disableScrollPropagation(div);
    return div;
  });

  useEffect(() => {
    const Control = L.Control.extend({ onAdd: () => container });
    const control = new Control({ position }).addTo(map);
    return () => control.remove();
  }, [map, position, container]);

  return createPortal(children, container);
}
