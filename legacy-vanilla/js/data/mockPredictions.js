// Mock output of the wildfire ML model.
//
// The real model should return the same shape, so swapping it in only means
// changing App.loadPredictions():
//
//   {
//     modelVersion: "string",
//     forecastDate: "YYYY-MM-DD",
//     cellSizeDeg:  0.5,
//     cells: [ { lat, lon, risk /* 0..1 */, country /* world-atlas name */ } ]   // lat/lon = cell centre
//   }
window.App = window.App || {};

(function () {
  // Deterministic pseudo-random number in [0,1) from integers.
  function hash(a, b, c) {
    let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  // Smooth noise: average a cell's hash with its neighbours so risk forms blobs.
  function smoothNoise(i, j, seed) {
    let s = 0;
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) s += hash(i + di, j + dj, seed);
    return s / 9;
  }

  function inRing(lon, lat, ring) {
    let inside = false;
    for (let a = 0, b = ring.length - 1; a < ring.length; b = a++) {
      const [xa, ya] = ring[a], [xb, yb] = ring[b];
      if ((ya > lat) !== (yb > lat) && lon < ((xb - xa) * (lat - ya)) / (yb - ya) + xa) inside = !inside;
    }
    return inside;
  }

  // Polygon = [outer, hole, hole...]
  function inPolygon(lon, lat, poly) {
    if (!inRing(lon, lat, poly[0])) return false;
    for (let k = 1; k < poly.length; k++) if (inRing(lon, lat, poly[k])) return false;
    return true;
  }

  // Pre-compute a bbox per country so the point-in-polygon test is cheap.
  function index(features) {
    return features.map(f => {
      const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
      let w = 180, s = 90, e = -180, n = -90;
      polys.forEach(p => p[0].forEach(([x, y]) => { w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y); }));
      return { name: f.properties.name, polys, w, s, e, n };
    });
  }

  App.generateMockPredictions = function (features, isoDate) {
    const step = 0.5;
    const [S, W] = App.config.EUROPE_BOUNDS[0], [N, E] = App.config.EUROPE_BOUNDS[1];
    const idx = index(features);
    const year = +isoDate.slice(0, 4);
    const doy = App.dates.dayOfYear(isoDate);
    // Fire season peaks around late July (day ~205).
    const season = 0.5 + 0.5 * Math.cos(((doy - 205) / 365) * 2 * Math.PI);
    const seed = year * 1000 + Math.floor(doy / 7); // changes weekly

    const cells = [];
    for (let lat = S + step / 2; lat < N; lat += step) {
      for (let lon = W + step / 2; lon < E; lon += step) {
        const c = idx.find(c => lon >= c.w && lon <= c.e && lat >= c.s && lat <= c.n && c.polys.some(p => inPolygon(lon, lat, p)));
        if (!c) continue;
        const south = Math.min(1, Math.max(0, (58 - lat) / 22));     // Mediterranean = higher
        const noise = smoothNoise(Math.round(lat / step), Math.round(lon / step), seed);
        const risk = Math.min(1, Math.max(0, south * (0.25 + 0.75 * season) * 0.8 + (noise - 0.5) * 1.0));
        cells.push({ lat: +lat.toFixed(2), lon: +lon.toFixed(2), risk: +risk.toFixed(3), country: c.name });
      }
    }
    return { modelVersion: "mock-0.1", forecastDate: isoDate, cellSizeDeg: step, cells };
  };
})();
