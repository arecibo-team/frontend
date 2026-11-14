import { MapContainer, ScaleControl, ZoomControl } from "react-leaflet";
import { EUROPE_BOUNDS, HOME_BOUNDS, MAX_ZOOM, basemapHasOwnLabels } from "../config.js";
import MinZoomLock from "./MinZoomLock.jsx";
import Basemap from "./Basemap.jsx";
import CountriesLayer from "./CountriesLayer.jsx";
import CountryLabels from "./CountryLabels.jsx";
import LayerSwitcher from "./LayerSwitcher.jsx";
import ResetViewButton from "./ResetViewButton.jsx";

export default function EuropeMap({
  basemap, onBasemapChange, bordersOn, onBordersChange, namesOn, onNamesChange, selected, onSelect, onClear
}) {
  return (
    <div className="map-wrap">
      <MapContainer
        className="map"
        bounds={HOME_BOUNDS}
        maxBounds={EUROPE_BOUNDS}
        maxBoundsViscosity={1.0}   // hard wall: cannot drag outside Europe
        maxZoom={MAX_ZOOM}
        zoomSnap={0.25}            // fine-grained zoom levels
        zoomDelta={0.5}            // +/- buttons and keyboard step
        wheelPxPerZoomLevel={90}   // responsive mouse-wheel zoom
        wheelDebounceTime={20}
        inertia
        inertiaDeceleration={2500} // short, snappy glide after a drag
        fadeAnimation={false}      // tiles appear instantly instead of fading in one by one
        preferCanvas               // vector overlays on canvas = fast redraws
        zoomControl={false}
        attributionControl
      >
        <ZoomControl position="bottomright" />
        <ScaleControl position="bottomright" imperial={false} />
        <MinZoomLock />
        <Basemap basemap={basemap} />
        <CountriesLayer selected={selected} bordersOn={bordersOn} onSelect={onSelect} onClear={onClear} />
        <CountryLabels visible={namesOn && basemapHasOwnLabels(basemap)} />
        <ResetViewButton />
        <LayerSwitcher
          basemap={basemap}
          onBasemapChange={onBasemapChange}
          bordersOn={bordersOn}
          onBordersChange={onBordersChange}
          namesOn={namesOn}
          onNamesChange={onNamesChange}
        />
      </MapContainer>
    </div>
  );
}
