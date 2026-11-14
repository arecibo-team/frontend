import { useState } from "react";
import MapControl from "./MapControl.jsx";
import { BASEMAPS, basemapHasOwnLabels } from "../config.js";

// Google-Maps-style "Layers" button in the bottom-left corner of the map.
export default function LayerSwitcher({ basemap, onBasemapChange, bordersOn, onBordersChange, namesOn, onNamesChange }) {
  const [open, setOpen] = useState(false);
  const current = BASEMAPS.find(b => b.id === basemap) || BASEMAPS[0];
  const ownLabels = basemapHasOwnLabels(basemap);

  return (
    <MapControl position="bottomleft">
      <div className="lc">
        <button
          type="button"
          className="lc-toggle"
          style={{ background: current.thumb }}
          aria-expanded={open}
          aria-label="Map layers"
          onClick={() => setOpen(o => !o)}
        >
          <span>Layers</span>
        </button>

        {open && (
          <div className="lc-card">
            <h4>Map type</h4>
            <div className="lc-bases">
              {BASEMAPS.map(b => (
                <button
                  key={b.id}
                  type="button"
                  className="lc-base"
                  aria-pressed={b.id === basemap}
                  onClick={() => onBasemapChange(b.id)}
                >
                  <i style={{ background: b.thumb }} />
                  {b.label}
                </button>
              ))}
            </div>

            <h4>Overlays</h4>
            <div className="lc-ov">
              <label>
                <input type="checkbox" checked={bordersOn} onChange={e => onBordersChange(e.target.checked)} />
                Country borders
              </label>
              <div className="hint">Natural Earth</div>
            </div>
            <div className={"lc-ov" + (ownLabels ? "" : " disabled")}>
              <label>
                <input
                  type="checkbox"
                  checked={ownLabels && namesOn}
                  disabled={!ownLabels}
                  onChange={e => onNamesChange(e.target.checked)}
                />
                Country names
              </label>
              {!ownLabels && <div className="hint">Already shown by this map</div>}
            </div>
          </div>
        )}
      </div>
    </MapControl>
  );
}
