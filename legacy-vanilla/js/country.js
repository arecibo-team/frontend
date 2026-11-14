// Countries: hover shows the name, click selects it and shows the name in the side panel.
(function () {
  const C = App.config;
  let map, layer, selected = null, bordersOn = true;

  // world-atlas uses short names for some countries; show the full ones.
  const DISPLAY_NAMES = {
    "Macedonia": "North Macedonia",
    "Bosnia and Herz.": "Bosnia and Herzegovina",
    "Faeroe Is.": "Faroe Islands",
    "N. Cyprus": "Northern Cyprus",
    "W. Sahara": "Western Sahara"
  };
  const displayName = f => DISPLAY_NAMES[f.properties.name] || f.properties.name;

  // ---- Styles ---------------------------------------------------------------
  const baseStyle = { color: "#7f9bd0", weight: 1, opacity: 0.75, fillColor: "#4a6fa5", fillOpacity: 0.04 };
  const hiddenStyle = { opacity: 0, fillOpacity: 0 };
  const hoverStyle = { color: "#ffb48a", weight: 2, opacity: 1, fillOpacity: 0.16 };
  const selectedStyle = { color: "#ffd2b8", weight: 3, opacity: 1, fillOpacity: 0.08 };

  const styleFor = lyr => (lyr === selected ? selectedStyle : bordersOn ? baseStyle : hiddenStyle);
  const restyleAll = () => layer.eachLayer(l => l.setStyle(styleFor(l)));

  // Keep only the parts of a country that reach into the map area
  // (drops French Guiana, Alaska, etc.).
  function clipToMap(f, bounds) {
    if (!f.geometry) return null;
    let polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    // Rings that cross the 180° line (Russia's far east) would draw lines across
    // the whole map; shift their western half by +360° to keep them continuous.
    polys = polys.map(p => p.map(ring => {
      const wraps = ring.some(([x]) => x > 90) && ring.some(([x]) => x < -90);
      return wraps ? ring.map(([x, y]) => [x < 0 ? x + 360 : x, y]) : ring;
    }));
    const kept = polys.filter(p => bounds.intersects(L.latLngBounds(p[0].map(([x, y]) => [y, x]))));
    return kept.length ? { ...f, geometry: { type: "MultiPolygon", coordinates: kept } } : null;
  }

  // Fly to a country, but only to the part inside the map area (e.g. Russia).
  function flyTo(lyr) {
    const b = lyr.getBounds(), e = L.latLngBounds(C.EUROPE_BOUNDS);
    const clipped = L.latLngBounds(
      [Math.max(b.getSouth(), e.getSouth()), Math.max(b.getWest(), e.getWest())],
      [Math.min(b.getNorth(), e.getNorth()), Math.min(b.getEast(), e.getEast())]
    );
    map.flyToBounds(clipped, { padding: [30, 30], maxZoom: 7, duration: C.FLY_DURATION });
  }

  // ---- Selection --------------------------------------------------------------
  function select(lyr) {
    selected = lyr;
    restyleAll();
    lyr.bringToFront();
    flyTo(lyr);
    renderPanel();
  }

  App.clearCountry = function () {
    if (!selected) return;
    selected = null;
    restyleAll();
    renderPanel();
  };

  App.setBordersVisible = function (on) {
    bordersOn = on;
    if (layer) restyleAll();
  };

  // ---- Side panel: just the name ------------------------------------------------
  function renderPanel() {
    const panel = document.getElementById("panel");
    panel.innerHTML = selected
      ? `<h2>${displayName(selected.feature)}</h2>`
      : `<p class="empty">Click a country on the map</p>`;
  }

  // ---- Init -------------------------------------------------------------------------
  App.initCountries = async function (m) {
    map = m;
    renderPanel();

    const res = await fetch(C.COUNTRIES_URL);
    if (!res.ok) throw new Error("borders HTTP " + res.status);
    const topo = await res.json();
    const world = topojson.feature(topo, topo.objects.countries);
    const bounds = L.latLngBounds(C.EUROPE_BOUNDS);
    const features = world.features.map(f => clipToMap(f, bounds)).filter(Boolean);

    // Used later by the (currently disabled) ML mock: European countries only.
    App.countryFeatures = features.filter(f => App.isEurope(f.properties.name));

    layer = L.geoJSON({ type: "FeatureCollection", features }, {
      style: baseStyle,
      onEachFeature: (f, lyr) => {
        lyr.bindTooltip(displayName(f), { sticky: true, direction: "top", offset: [0, -6] });
        lyr.on({
          mouseover: () => { if (lyr !== selected) lyr.setStyle(hoverStyle); },
          mouseout: () => lyr.setStyle(styleFor(lyr)),
          click: e => { L.DomEvent.stopPropagation(e); select(lyr); }
        });
      }
    }).addTo(map);

    // Click on the sea or press Esc to deselect.
    map.on("click", App.clearCountry);
    document.addEventListener("keydown", e => { if (e.key === "Escape") App.clearCountry(); });
    return features.length;
  };
})();
