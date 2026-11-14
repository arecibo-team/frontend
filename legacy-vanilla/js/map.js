// Map creation: Europe-only navigation, crisp zoom, MapLibre base maps.
(function () {
  const C = App.config;

  App.initMap = function () {
    const europe = L.latLngBounds(C.EUROPE_BOUNDS);
    const home = L.latLngBounds(C.HOME_BOUNDS);

    const map = L.map("map", {
      maxBounds: europe,
      maxBoundsViscosity: 1.0,   // hard wall: cannot drag outside Europe
      maxZoom: C.MAX_ZOOM,
      zoomSnap: 0.25,            // fine-grained zoom levels
      zoomDelta: 0.5,            // +/- buttons and keyboard step
      wheelPxPerZoomLevel: 90,   // responsive mouse-wheel zoom
      wheelDebounceTime: 20,
      inertia: true,
      inertiaDeceleration: 2500, // short, snappy glide after a drag
      zoomAnimation: true,
      fadeAnimation: true,
      preferCanvas: true,        // vector overlays on canvas = fast redraws
      zoomControl: false,
      attributionControl: true
    });
    map.attributionControl.setPrefix(false);
    map.fitBounds(home, { animate: false });

    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.control.scale({ position: "bottomright", imperial: false }).addTo(map);

    // Never let the user zoom out far enough to see beyond Europe.
    // Recomputed whenever the map container changes size.
    function lockMinZoom() {
      const z = Math.ceil(map.getBoundsZoom(europe, true) * 4) / 4;
      map.setMinZoom(z);
      if (map.getZoom() < z) map.setZoom(z, { animate: false });
    }
    lockMinZoom();
    map.on("resize", lockMinZoom);
    new ResizeObserver(() => map.invalidateSize({ pan: false })).observe(document.querySelector(".map-wrap"));

    document.getElementById("reset").onclick = () =>
      map.flyToBounds(home, { duration: C.FLY_DURATION, easeLinearity: 0.35 });

    // ---- Base maps drawn by MapLibre GL -------------------------------------
    const first = C.BASEMAPS[0];
    const gl = L.maplibreGL({ style: first.style, interactive: false }).addTo(map);
    let current = first;
    map.attributionControl.addAttribution(first.attribution);

    App.basemap = () => current.id;
    App.setBasemap = function (id) {
      const next = C.BASEMAPS.find(b => b.id === id);
      if (!next || next === current) return;
      map.attributionControl.removeAttribution(current.attribution);
      map.attributionControl.addAttribution(next.attribution);
      gl.getMaplibreMap().setStyle(next.style);
      current = next;
      document.dispatchEvent(new CustomEvent("basemapchange", { detail: next }));
    };

    App.map = map;
    return map;
  };
})();
