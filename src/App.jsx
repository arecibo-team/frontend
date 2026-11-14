import { useCallback, useState } from "react";
import EuropeMap from "./components/EuropeMap.jsx";
import CountryPanel from "./components/CountryPanel.jsx";
import { BASEMAPS } from "./config.js";

export default function App() {
  const [basemap, setBasemap] = useState(BASEMAPS[0].id);
  const [bordersOn, setBordersOn] = useState(true);
  const [namesOn, setNamesOn] = useState(true);
  const [selected, setSelected] = useState(null); // GeoJSON feature of the selected country

  const clearSelection = useCallback(() => setSelected(null), []);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <h1>Europe Wildfire Monitor</h1>
        </div>
      </header>

      <main className="layout">
        <EuropeMap
          basemap={basemap}
          onBasemapChange={setBasemap}
          bordersOn={bordersOn}
          onBordersChange={setBordersOn}
          namesOn={namesOn}
          onNamesChange={setNamesOn}
          selected={selected}
          onSelect={setSelected}
          onClear={clearSelection}
        />
        <CountryPanel selected={selected} />
      </main>
    </div>
  );
}
