// Data overlays (NASA fire history, FIRMS points, ML risk), the layer
// switcher control and the legend.
(function () {
  const C = App.config;
  App.state = App.state || { date: C.DEFAULT_DATE, predictions: null };

  let map, overlays;

  // ---- Overlay definitions ------------------------------------------------
  function gibsLayer(name, pane) {
    return L.tileLayer(C.GIBS_URL, {
      layer: name,
      time: App.state.date,
      pane: pane,
      maxNativeZoom: 9,   // GIBS fire tiles exist up to z9; Leaflet upscales beyond
      maxZoom: C.MAX_ZOOM,
      bounds: C.EUROPE_BOUNDS,
      tileSize: 256,
      updateWhenZooming: false,
      keepBuffer: 4,
      attribution: 'Fires: <a href="https://earthdata.nasa.gov/gibs">NASA GIBS</a>'
    });
  }

  function buildOverlays() {
    const hasKey = !!C.FIRMS_MAP_KEY;
    const list = [
      {
        id: "borders", label: "Country borders", hint: "Natural Earth", on: true, noOpacity: true,
        add: () => App.setBordersVisible && App.setBordersVisible(true),
        remove: () => App.setBordersVisible && App.setBordersVisible(false)
      },
      {
        id: "viirs", label: "Fire history · VIIRS 375 m", hint: "NASA GIBS, daily, 2012 →",
        pane: "viirs", z: 355, on: true, opacity: 1, from: "2012-01-20",
        layer: gibsLayer("VIIRS_SNPP_Thermal_Anomalies_375m_All", "viirs"),
        legend: { label: "VIIRS fire", color: "#ff3b1f", dot: true }
      },
      {
        id: "modis", label: "Fire history · MODIS 1 km", hint: "NASA GIBS, daily, 2000 →",
        pane: "modis", z: 350, on: false, opacity: 1, from: "2000-11-01",
        layer: gibsLayer("MODIS_Terra_Thermal_Anomalies_All", "modis"),
        legend: { label: "MODIS fire", color: "#ffb000", dot: true }
      },
      {
        id: "firms", label: "FIRMS hotspot points", pane: "firms", z: 370, on: false, opacity: 1,
        hint: hasKey ? "NASA FIRMS API, 1-day window" : "Needs a FIRMS MAP_KEY in js/config.js",
        disabled: !hasKey, badge: hasKey ? "" : "connect data",
        layer: L.layerGroup(),
        legend: { label: "FIRMS hotspot", color: "#ff2d55", dot: true }
      },
      {
        id: "risk", label: "ML wildfire risk (prediction)", pane: "risk", z: 360, on: true, opacity: 0.75,
        hint: C.PREDICTIONS_URL ? "Model output" : "Mock model output — placeholder",
        badge: C.PREDICTIONS_URL ? "" : "mock",
        layer: L.layerGroup(),
        legend: "risk"
      }
    ];
    // Until the fire data is wired in, only offer layers that can actually be shown.
    return C.SHOW_FIRE_DATA ? list : list.filter(o => o.id === "borders");
  }

  const available = o => !o.from || App.state.date >= o.from;

  function applyOverlay(o) {
    if (o.add || o.remove) { (o.on ? o.add : o.remove)(); return; }
    const show = o.on && available(o);
    if (show && !map.hasLayer(o.layer)) o.layer.addTo(map);
    if (!show && map.hasLayer(o.layer)) map.removeLayer(o.layer);
  }

  // ---- ML predictions -----------------------------------------------------
  // Swap this for the real model: return the same shape as generateMockPredictions.
  App.loadPredictions = async function (isoDate) {
    if (C.PREDICTIONS_URL) {
      const r = await fetch(C.PREDICTIONS_URL + "?date=" + encodeURIComponent(isoDate));
      if (!r.ok) throw new Error("Predictions HTTP " + r.status);
      return r.json();
    }
    if (!App.countryFeatures) return null;
    return App.generateMockPredictions(App.countryFeatures, isoDate);
  };

  App.riskStep = risk => {
    let step = null;
    for (const s of C.RISK_STEPS) if (risk >= s.min) step = s;
    return step;
  };

  let riskRenderer;
  async function refreshRisk() {
    const o = overlays.find(o => o.id === "risk");
    if (!C.SHOW_FIRE_DATA) return;
    const data = await App.loadPredictions(App.state.date).catch(err => { status("Predictions: " + err.message); return null; });
    App.state.predictions = data;
    o.layer.clearLayers();
    if (!data) return;
    const h = data.cellSizeDeg / 2;
    data.cells.forEach(c => {
      const s = App.riskStep(c.risk);
      if (!s) return;
      L.rectangle([[c.lat - h, c.lon - h], [c.lat + h, c.lon + h]], {
        renderer: riskRenderer, pane: "risk", interactive: false,
        stroke: false, fillColor: s.color, fillOpacity: 0.85
      }).addTo(o.layer);
    });
    document.dispatchEvent(new CustomEvent("predictionsupdate", { detail: data }));
  }

  // ---- FIRMS points (only with a MAP_KEY) ----------------------------------
  let firmsRenderer;
  async function refreshFirms() {
    const o = overlays.find(o => o.id === "firms");
    if (o.disabled || !o.on) return;
    const [[s, w], [n, e]] = C.EUROPE_BOUNDS;
    const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${C.FIRMS_MAP_KEY}/${C.FIRMS_SOURCE}/${w},${s},${e},${n}/1/${App.state.date}`;
    try {
      const text = await fetch(url).then(r => r.text());
      const [head, ...rows] = text.trim().split("\n");
      const cols = head.split(",");
      const iLat = cols.indexOf("latitude"), iLon = cols.indexOf("longitude"), iFrp = cols.indexOf("frp");
      o.layer.clearLayers();
      rows.forEach(r => {
        const v = r.split(",");
        L.circleMarker([+v[iLat], +v[iLon]], {
          renderer: firmsRenderer, radius: 3, weight: 0, fillColor: "#ff2d55", fillOpacity: 0.9
        }).bindTooltip("FRP " + v[iFrp] + " MW").addTo(o.layer);
      });
      status(rows.length + " FIRMS hotspots on " + App.state.date);
    } catch (err) { status("FIRMS: " + err.message); }
  }

  // ---- Date ---------------------------------------------------------------
  App.setDate = function (iso) {
    App.state.date = iso;
    overlays.forEach(o => {
      if (o.layer && o.layer.setUrl) {
        o.layer.options.time = iso;
        // Not redraw(): with fractional zoom it requests tiles like z=4.25.
        if (map.hasLayer(o.layer)) { o.layer._removeAllTiles(); o.layer._update(); }
      }
      applyOverlay(o);
    });
    if (overlays.some(o => o.id === "firms")) refreshFirms();
    if (overlays.some(o => o.id === "risk")) refreshRisk();
    renderLegend();
    document.dispatchEvent(new CustomEvent("datechange", { detail: iso }));
  };

  // ---- Legend under the map ------------------------------------------------
  function renderLegend() {
    const el = document.getElementById("legend");
    const parts = overlays.filter(o => o.on && o.legend && available(o)).map(o => {
      if (o.legend === "risk") {
        return '<span class="legend-group"><b>Risk</b>' + C.RISK_STEPS.map(s =>
          `<span class="swatch" style="background:${s.color}" title="${s.label}"></span>`).join("") +
          '<span>low → extreme</span></span>';
      }
      return `<span class="legend-group"><span class="swatch dot" style="background:${o.legend.color}"></span>${o.legend.label}</span>`;
    });
    const missing = overlays.filter(o => o.on && !available(o)).map(o => `<span class="legend-group">${o.label.split("·")[1].trim()}: no data before ${o.from.slice(0, 4)}</span>`);
    el.innerHTML = parts.concat(missing).join("") ||
      `<span class="legend-group">${C.SHOW_FIRE_DATA ? "No data layers on" : "Fire history & ML risk layers: coming soon"}</span>`;
  }

  // ---- Layer switcher (Google-Maps style) ----------------------------------
  const LayerControl = L.Control.extend({
    options: { position: "bottomleft" },
    onAdd() {
      const root = L.DomUtil.create("div", "lc");
      root.innerHTML = `
        <button class="lc-toggle" type="button" aria-expanded="false" aria-label="Map layers"><span>Layers</span></button>
        <div class="lc-card" hidden>
          <h4>Map type</h4>
          <div class="lc-bases">${C.BASEMAPS.map(b =>
            `<button type="button" class="lc-base" data-id="${b.id}" aria-pressed="${b.id === App.basemap()}"><i style="background:${b.thumb}"></i>${b.label}</button>`).join("")}
          </div>
          <h4>Overlays</h4>
          <div>${overlays.map(o => `
            <div class="lc-ov${o.disabled ? " disabled" : ""}" data-id="${o.id}">
              <label><input type="checkbox" ${o.on ? "checked" : ""} ${o.disabled ? "disabled" : ""}> ${o.label}
                ${o.badge ? `<span class="badge">${o.badge}</span>` : ""}</label>
              <div class="hint">${o.hint}</div>
              ${o.noOpacity || o.disabled ? "" : `<input type="range" min="0" max="1" step="0.05" value="${o.opacity}" aria-label="${o.label} opacity">`}
            </div>`).join("")}
          </div>
        </div>`;

      const toggle = root.querySelector(".lc-toggle");
      const card = root.querySelector(".lc-card");
      const paintToggle = () => { toggle.style.background = C.BASEMAPS.find(b => b.id === App.basemap()).thumb; };
      paintToggle();

      toggle.onclick = () => {
        card.hidden = !card.hidden;
        toggle.setAttribute("aria-expanded", String(!card.hidden));
      };
      root.querySelectorAll(".lc-base").forEach(btn => btn.onclick = () => {
        App.setBasemap(btn.dataset.id);
        root.querySelectorAll(".lc-base").forEach(b => b.setAttribute("aria-pressed", String(b === btn)));
        paintToggle();
      });
      root.querySelectorAll(".lc-ov").forEach(row => {
        const o = overlays.find(o => o.id === row.dataset.id);
        const cb = row.querySelector("input[type=checkbox]");
        const range = row.querySelector("input[type=range]");
        cb.onchange = () => {
          o.on = cb.checked;
          applyOverlay(o);
          if (o.id === "firms") refreshFirms();
          renderLegend();
        };
        if (range) range.oninput = () => { o.opacity = +range.value; map.getPane(o.pane).style.opacity = o.opacity; };
      });

      L.DomEvent.disableClickPropagation(root);
      L.DomEvent.disableScrollPropagation(root);
      return root;
    }
  });

  let statusEl;
  function status(msg) { statusEl.textContent = msg; }
  App.status = msg => status(msg);

  App.initLayers = function (m) {
    map = m;
    statusEl = document.getElementById("status");
    overlays = buildOverlays();

    // One pane per overlay, so each gets its own z-order and opacity slider.
    overlays.filter(o => o.pane).forEach(o => {
      const p = map.createPane(o.pane);
      p.style.zIndex = o.z;
      p.style.opacity = o.opacity;
      p.style.pointerEvents = o.id === "firms" ? "auto" : "none";
    });
    riskRenderer = L.canvas({ pane: "risk", padding: 0.5 });
    firmsRenderer = L.canvas({ pane: "firms", padding: 0.5 });

    new LayerControl().addTo(map);
    overlays.forEach(applyOverlay);
    renderLegend();
  };

  App.refreshPredictions = () => overlays.some(o => o.id === "risk") && refreshRisk();
  App.overlayOn = id => { const o = overlays.find(o => o.id === id); return !!(o && o.on); };
})();
