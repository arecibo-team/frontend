import { useMap } from "react-leaflet";
import MapControl from "./MapControl.jsx";
import { HOME_BOUNDS, FLY_DURATION } from "../config.js";

export default function ResetViewButton() {
  const map = useMap();
  return (
    <MapControl position="topright">
      <button
        type="button"
        className="map-btn"
        title="Reset view to Europe"
        onClick={() => map.flyToBounds(HOME_BOUNDS, { duration: FLY_DURATION, easeLinearity: 0.35 })}
      >
        Reset view
      </button>
    </MapControl>
  );
}
